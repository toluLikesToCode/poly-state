import {ValidationError} from '../../shared/errors'
import * as storage from '../storage/index'
import {Middleware, PersistedState} from './state-types/types'
import {ValidationErrorHandler, ValidatorFn} from './state-types/middlewear-types'
import {TypeRegistry} from './typeRegistry'

import {produce, Draft} from 'immer'
import {deepClone} from '../utils'

// Special marker for property deletion
export const DELETE_PROPERTY = Symbol('DELETE_PROPERTY')

/**
 * Deeply merges newState into state using Immer, handling arrays, objects, Maps, Sets, Dates, and custom classes.
 * Arrays are replaced, not merged. Maps/Sets are replaced by default, but can be extended for custom merge logic.
 * Custom classes are replaced unless a type handler is registered.
 * @param state - The current state
 * @param newState - The new state to merge
 * @param typeRegistry - Optional TypeRegistry for custom class/complex type handling, defaults to a new instance
 * @returns The next state
 * @example
 * assignState({a: {b: 1}}, {a: {c: 2}}) // {a: {b: 1, c: 2}}
 *
 * @todo Support for circular references in state is not currently implemented due to Immer limitations.
 *       See test for circular references for more details and future implementation notes.
 */
export function assignState<S extends object>(
  state: S,
  newState: Partial<S>,
  typeRegistry: {findTypeFor: (value: any) => any} = new TypeRegistry()
): S {
  /**
   * Checks for circular references in an object.
   * @param obj - The object to check
   * @returns true if a circular reference is found, false otherwise
   */
  function hasCircularReference(obj: any, seen = new WeakSet()): boolean {
    if (obj && typeof obj === 'object') {
      if (seen.has(obj)) return true
      seen.add(obj)
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          if (hasCircularReference(obj[key], seen)) return true
        }
      }
      seen.delete(obj)
    }
    return false
  }

  if (hasCircularReference(newState)) {
    throw new ValidationError(
      'Circular references in state are not supported by Immer or Poly State.'
    )
  }
  return produce(state, (draft: Draft<S>) => {
    deepMerge(draft, newState, typeRegistry)
  })
}

/**
 * Recursively merges source into target, handling arrays, Maps, Sets, Dates, and custom classes.
 * Arrays are replaced, Maps/Sets are shallow copied, Dates are cloned, and custom classes are replaced
 * unless a typeRegistry is provided to handle serialization/deserialization.
 * @param target - The target object to merge into
 * @param source - The source object to merge from
 * @param typeRegistry - Optional TypeRegistry for custom class handling
 */
function deepMerge(target: any, source: any, typeRegistry?: {findTypeFor: (value: any) => any}) {
  for (const key of Object.keys(source)) {
    const srcVal = source[key]
    const tgtVal = target[key]

    // Handle deletion marker
    if (srcVal === DELETE_PROPERTY) {
      delete target[key]
      continue
    }

    // Handle null/undefined
    if (srcVal === null || srcVal === undefined) {
      target[key] = srcVal
      continue
    }

    // Handle arrays (replace, not merge)
    if (Array.isArray(srcVal)) {
      target[key] = srcVal.slice()
      continue
    }

    // Handle Map
    if (srcVal instanceof Map) {
      if (srcVal === tgtVal) {
        console.warn(
          '[Poly State] Warning: Map reference reused in state update. This may indicate an in-place mutation, which is not supported. Always dispatch a new Map instance.'
        )
      }
      target[key] = new Map(srcVal)
      continue
    }

    // Handle Set
    if (srcVal instanceof Set) {
      target[key] = new Set(srcVal)
      continue
    }

    // Handle Date
    if (srcVal instanceof Date) {
      target[key] = new Date(srcVal.getTime())
      continue
    }

    // Handle custom class or registered type
    if (typeof srcVal === 'object' && srcVal.constructor && srcVal.constructor !== Object) {
      // If a typeRegistry is provided, try to use it
      if (typeRegistry) {
        const typeDef = typeRegistry.findTypeFor(srcVal)
        if (typeDef) {
          // Use serialize/deserialize to ensure correct type
          target[key] = typeDef.deserialize(typeDef.serialize(srcVal))
          continue
        }
      }
      // Otherwise, just replace the value (shallow copy)
      target[key] = srcVal
      continue
    }

    // Handle plain object
    if (typeof srcVal === 'object' && srcVal !== null && srcVal.constructor === Object) {
      // If the new object is empty, replace the old object
      if (Object.keys(srcVal).length === 0) {
        target[key] = {}
        continue
      }
      // If the target is not an object, replace it
      if (!tgtVal || typeof tgtVal !== 'object' || tgtVal.constructor !== Object) {
        target[key] = {...srcVal}
        continue
      }
      // Otherwise, merge recursively
      deepMerge(target[key], srcVal)
      continue
    }

    // Primitive or fallback
    target[key] = srcVal
  }
}

/**
 * Clean up stale persisted states across all storage types
 */
export function cleanupStaleStates(
  maxAge: number = 30 * 24 * 60 * 60 * 1000,
  cookiePrefix: string = '__store_' // Default prefix
): {
  local: number
  session: number
  cookie: number
} {
  const now = Date.now()
  const result = {local: 0, session: 0, cookie: 0}
  const handleError = (e: any, type: string, key: string) => {
    // In a real app, this might use a global error logger
    console.warn('Error cleaning stale state', type, key, e)
  }

  // Clean localStorage
  if (storage.isLocalStorageAvailable()) {
    /* iterate backwards so index shifts don’t skip keys */
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key) {
        try {
          const item = storage.getLocalStorage<PersistedState<any>>(key, {} as PersistedState<any>)
          if (item && item.meta && now - item.meta.lastUpdated > maxAge) {
            storage.removeLocalStorage(key)
            result.local++
          }
        } catch (e) {
          handleError(e, 'localStorage', key)
        }
      }
    }
  }

  // Clean sessionStorage
  if (storage.isSessionStorageAvailable()) {
    /* iterate backwards so index shifts don’t skip keys */
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i)
      if (key) {
        try {
          const rawData = sessionStorage.getItem(key)
          if (rawData) {
            const item = JSON.parse(rawData) as PersistedState<any>
            if (item && item.meta && now - item.meta.lastUpdated > maxAge) {
              sessionStorage.removeItem(key)
              result.session++
            }
          }
        } catch (e) {
          handleError(e, 'sessionStorage', key)
        }
      }
    }
  }

  // Clean cookies using prefix
  if (typeof document !== 'undefined' && document.cookie) {
    const cookies = document.cookie.split(';')
    for (const cookie of cookies) {
      const [namePart] = cookie.split('=')
      const name = namePart.trim()
      if (name.startsWith(cookiePrefix)) {
        try {
          const cookieValue = storage.getCookie(name)
          if (cookieValue) {
            const item = JSON.parse(cookieValue) as PersistedState<any>
            if (item && item.meta && now - item.meta.lastUpdated > maxAge) {
              storage.removeCookie(name) // Assuming removeCookie uses appropriate path/domain or this cookie was set with defaults
              result.cookie++
            }
          }
        } catch (e) {
          handleError(e, 'cookie', name)
        }
      }
    }
  }
  return result
}

// --- Built-in Middleware Creators (createLoggerMiddleware, createValidatorMiddleware) ---

/**
 * Recursively checks that the structure and types of `obj` and `template` match exactly.
 * For Map/Set, only checks that both are the same type (not contents).
 * For Array, checks both are arrays and, if both are non-empty, that the element types match.
 * For plain objects, checks keys and recursively checks structure.
 * For primitives, checks type equality.
 * @param obj - The object to validate (e.g., loaded state)
 * @param template - The template object (e.g., initial state)
 * @returns True if `obj` matches the structure and types of `template` exactly
 */
function strictStructureMatch(obj: any, template: any): boolean {
  if (obj === template) return true
  if (typeof obj !== typeof template) return false
  if (obj === null || template === null) return obj === template

  // Map type check
  if (obj instanceof Map || template instanceof Map) {
    return obj instanceof Map && template instanceof Map
  }

  // Set type check
  if (obj instanceof Set || template instanceof Set) {
    return obj instanceof Set && template instanceof Set
  }

  // Array type and element type check
  if (Array.isArray(obj) || Array.isArray(template)) {
    if (!Array.isArray(obj) || !Array.isArray(template)) return false
    if (obj.length > 0 && template.length > 0) {
      if (!strictStructureMatch(obj[0], template[0])) return false
    }
    return true
  }

  // Plain object structure check
  if (typeof obj === 'object' && typeof template === 'object') {
    const objKeys = Object.keys(obj)
    const templateKeys = Object.keys(template)
    if (objKeys.length !== templateKeys.length) return false
    for (const key of templateKeys) {
      if (!(key in obj)) return false
      if (!strictStructureMatch(obj[key], template[key])) return false
    }
    for (const key of objKeys) {
      if (!(key in template)) return false
    }
    return true
  }

  // Primitive type check
  return typeof obj === typeof template
}

/**
 * Supported logger types for the logging middleware.
 */
export type SupportedLogger =
  | ((...args: any[]) => void) // Generic function logger
  | typeof console // Browser/Node console
  | {
      // Consola-like logger
      log?: Function
      info?: Function
      success?: Function
      warn?: Function
      error?: Function
      debug?: Function
      trace?: Function
      box?: Function
    }
  | {
      // Custom client logger interface
      log: (...args: any[]) => void
      info: (...args: any[]) => void
      warn: (...args: any[]) => void
      error: (...args: any[]) => void
      debug: (...args: any[]) => void
      trace?: (...args: any[]) => void
      silly?: (...args: any[]) => void
      group?: (label?: string) => void
      groupCollapsed?: (label?: string) => void
      groupEnd?: () => void
      table?: (data: any, columns?: string[]) => void
      getCorrelationId?: () => string
      setCorrelationId?: (id: string) => void
      child?: (childContextSuffix: string, childDefaultMeta?: Record<string, any>) => any
    }

type StandardLoggerLevel =
  | 'log'
  | 'info'
  | 'success'
  | 'warn'
  | 'error'
  | 'debug'
  | 'trace'
  | 'silly'

// Allows any string, but gives autocomplete for standard levels
export type LoggerLevel = StandardLoggerLevel | (string & {})
/**
 * Configuration options for the logger middleware.
 */
export interface LoggerMiddlewareOptions<S extends object> {
  /** Whether logging is enabled. Defaults to true in development, false otherwise. */
  enabled?: boolean
  /** The log level to use. Defaults to 'log'. */
  logLevel?: LoggerLevel
  /** Paths to exclude from logging. Array of property paths as arrays. */
  blacklist?: Array<Array<keyof S | number | string>>
  /** Whether to use console.group for grouping. Defaults to true. */
  useGrouping?: boolean
  /** Custom correlation ID for tracking related actions. */
  correlationId?: string
  /** Whether to include timestamps in logs. Defaults to true. */
  includeTimestamp?: boolean
  /** Custom action name formatter. */
  actionNameFormatter?: (action: any) => string
}

/**
 * Creates a robust logging middleware with support for multiple logger types including
 * custom client loggers, Consola, console, and generic logging utilities.
 *
 * @param logger - A logging function, console, Consola instance, or custom client logger. Defaults to console.
 * @param options - Optional configuration for logging behavior.
 * @returns Middleware function for logging state transitions
 *
 * @remarks
 * The middleware automatically detects the logger type and adapts its behavior:
 * - **Custom Client Logger**: Uses all available methods including grouping and correlation IDs
 * - **Consola**: Uses Consola's methods and box formatting for pretty output
 * - **Console**: Uses standard console methods with grouping
 * - **Generic Function**: Calls the function with formatted messages
 *
 * Features:
 * - Automatic logger type detection and adaptation
 * - Support for log grouping (console.group/groupCollapsed)
 * - Blacklisting of sensitive data paths
 * - Correlation ID support for tracking related actions
 * - Custom action name formatting
 * - Error handling that never blocks state updates
 * - Development/production environment detection
 *
 * @example
 * **Basic usage with console:**
 * ```typescript
 * import { createStore } from './core/state/createStore'
 * import { createLoggerMiddleware } from './core/state/utils'
 *
 * const store = createStore(
 *   { count: 0 },
 *   { middleware: [createLoggerMiddleware()] }
 * )
 *
 * store.dispatch({ count: 1 })
 * // Logs grouped state transition in console
 * ```
 *
 * @example
 * **With Consola for pretty output:**
 * ```typescript
 * import consola from 'consola'
 * import { createLoggerMiddleware } from './core/state/utils'
 *
 * const store = createStore(
 *   { user: null },
 *   { middleware: [createLoggerMiddleware(consola)] }
 * )
 *
 * store.dispatch({ user: { name: 'Ada' } })
 * // Logs with Consola's formatting and box grouping
 * ```
 *
 * @example
 * **With custom client logger:**
 * ```typescript
 * import { createClientLogger, createLoggerMiddleware } from './utils'
 *
 * const clientLogger = createClientLogger('Store', { module: 'state-management' })
 * const store = createStore(
 *   { items: [] },
 *   {
 *     middleware: [createLoggerMiddleware(clientLogger, {
 *       logLevel: 'debug',
 *       correlationId: 'user-session-123'
 *     })]
 *   }
 * )
 * ```
 *
 * @example
 * **Advanced configuration with blacklisting:**
 * ```typescript
 * const loggerMiddleware = createLoggerMiddleware(console, {
 *   enabled: true,
 *   logLevel: 'info',
 *   blacklist: [
 *     ['user', 'password'],     // Remove user.password
 *     ['apiKeys'],              // Remove entire apiKeys object
 *     ['tokens', 0, 'secret']   // Remove tokens[0].secret
 *   ],
 *   useGrouping: true,
 *   includeTimestamp: true,
 *   actionNameFormatter: (action) => {
 *     if (typeof action === 'function') return '[async-thunk]'
 *     return Object.keys(action).join('+') || '[empty]'
 *   }
 * })
 * ```
 *
 * @example
 * **Custom analytics logger:**
 * ```typescript
 * const analyticsLogger = (message: string, ...data: any[]) => {
 *   myAnalytics.track('state_change', { message, data })
 * }
 *
 * const store = createStore(
 *   { analytics: {} },
 *   { middleware: [createLoggerMiddleware(analyticsLogger, { enabled: true })] }
 * )
 * ```
 *
 * @example
 * **Environment-aware logging:**
 * ```typescript
 * const conditionalLogger = (...args: any[]) => {
 *   if (process.env.NODE_ENV === 'development') {
 *     console.log(...args)
 *   } else {
 *     prodLogger.info(...args)
 *   }
 * }
 *
 * const middleware = createLoggerMiddleware(conditionalLogger, {
 *   enabled: process.env.NODE_ENV !== 'test'
 * })
 * ```
 */
export function createLoggerMiddleware<S extends object>(
  logger: SupportedLogger = console,
  options: LoggerMiddlewareOptions<S> = {}
): Middleware<S> {
  const {
    enabled = typeof process !== 'undefined' &&
      process.env &&
      process.env.NODE_ENV === 'development',
    logLevel = 'log',
    blacklist = [],
    useGrouping = true,
    correlationId,
    includeTimestamp = true,
    actionNameFormatter,
  } = options

  // Detect logger type and capabilities
  const loggerType = detectLoggerType(logger)
  const hasGrouping = loggerType.hasGrouping
  const hasCorrelationId = loggerType.hasCorrelationId
  const hasBoxFormatting = loggerType.hasBoxFormatting

  // Set correlation ID if provided and supported
  if (correlationId && hasCorrelationId && typeof (logger as any).setCorrelationId === 'function') {
    ;(logger as any).setCorrelationId(correlationId)
  }

  // Helper to infer a human-friendly action name
  function inferActionName(action: any): string {
    if (actionNameFormatter) {
      try {
        return actionNameFormatter(action)
      } catch (err) {
        console.warn('Custom actionNameFormatter threw an error:', err)
        // Fall through to default logic
      }
    }

    if (action == null) return '[null]'
    if (typeof action === 'function') return '[thunk]'
    if (typeof action !== 'object') return `[${typeof action}]`

    const keys = Object.keys(action)
    if (keys.length === 0) return '[empty action]'
    if (keys.length === 1) return keys[0]

    return keys.join(', ')
  }

  // Helper to remove blacklisted paths from an object (non-mutating)
  function removeBlacklistedPaths(obj: any): any {
    if (!blacklist.length || !obj || typeof obj !== 'object') return obj

    // Deep clone the object/array to avoid mutating frozen objects
    const clone = deepClone(obj)

    for (const path of blacklist) {
      if (!Array.isArray(path) || path.length === 0) continue

      let node = clone
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i]
        if (node && typeof node === 'object' && key in node) {
          node = node[key]
        } else {
          node = null
          break
        }
      }

      if (node && typeof node === 'object') {
        const lastKey = path[path.length - 1]
        if (Array.isArray(node)) {
          if (typeof lastKey === 'number' && lastKey >= 0 && lastKey < node.length) {
            node.splice(lastKey, 1)
          }
        } else if (lastKey in node) {
          delete (node as Record<string | number, any>)[lastKey as string | number]
        }
      }
    }

    return clone
  }

  // Helper to create timestamp string
  function getTimestamp(): string {
    return includeTimestamp ? new Date().toISOString() : ''
  }

  // Helper to log with the appropriate method
  function logWithMethod(method: string, message: string, ...args: any[]): void {
    if (loggerType.type === 'function') {
      ;(logger as Function)(message, ...args)
    } else if (loggerType.type === 'console') {
      const consoleMethod = (console as any)[method]
      if (typeof consoleMethod === 'function') {
        consoleMethod(message, ...args)
      } else {
        console.log(message, ...args)
      }
    } else if (loggerType.type === 'object') {
      const loggerObj = logger as any
      if (typeof loggerObj[method] === 'function') {
        loggerObj[method](message, ...args)
      } else if (typeof loggerObj.log === 'function') {
        loggerObj.log(message, ...args)
      }
    }
  }

  return (action, prevState, dispatchNext, getState) => {
    if (!enabled) return dispatchNext(action)

    // Remove blacklisted paths from the action for logging only
    const loggedAction = removeBlacklistedPaths(action)

    // Skip logging if the action is now empty after blacklisting
    if (
      !loggedAction ||
      (typeof loggedAction === 'object' && Object.keys(loggedAction).length === 0)
    ) {
      return dispatchNext(action)
    }

    const timestamp = getTimestamp()
    const actionName = inferActionName(loggedAction)
    const groupLabel = `Action: ${actionName}${timestamp ? ` @ ${timestamp}` : ''}`

    try {
      // Start logging group
      if (useGrouping && hasGrouping) {
        if (loggerType.type === 'console') {
          if (typeof console.groupCollapsed === 'function') {
            console.groupCollapsed(groupLabel)
          } else if (typeof console.group === 'function') {
            console.group(groupLabel)
          }
        } else if (loggerType.type === 'object') {
          const loggerObj = logger as any
          if (typeof loggerObj.groupCollapsed === 'function') {
            loggerObj.groupCollapsed(groupLabel)
          } else if (typeof loggerObj.group === 'function') {
            loggerObj.group(groupLabel)
          }
        }
      }

      // Special formatting for Consola box if available
      if (hasBoxFormatting && typeof (logger as any).box === 'function') {
        ;(logger as any).box(`🔨 ${groupLabel}`)
      }

      // Log previous state
      logWithMethod(logLevel, 'Prev state', prevState)

      // Log action
      logWithMethod(logLevel, 'Action', loggedAction)

      // Execute the action
      dispatchNext(action)

      // Log next state
      const nextState = getState()
      logWithMethod(logLevel, 'Next state', nextState)

      // End logging group
      if (useGrouping && hasGrouping) {
        if (loggerType.type === 'console') {
          if (typeof console.groupEnd === 'function') {
            console.groupEnd()
          }
        } else if (loggerType.type === 'object') {
          const loggerObj = logger as any
          if (typeof loggerObj.groupEnd === 'function') {
            loggerObj.groupEnd()
          }
        }
      }
    } catch (err) {
      // Handle logging errors without blocking state updates
      const errorMessage = 'Logger middleware error'

      if (loggerType.type === 'console') {
        console.error(errorMessage, err)
      } else if (loggerType.type === 'object') {
        const loggerObj = logger as any
        if (typeof loggerObj.error === 'function') {
          loggerObj.error(errorMessage, err)
        } else {
          console.error(errorMessage, err)
        }
      } else {
        console.error(errorMessage, err)
      }

      // Ensure the action still gets dispatched
      dispatchNext(action)
    }
  }
}

/**
 * Detects the type and capabilities of a logger.
 */
function detectLoggerType(logger: SupportedLogger): {
  type: 'function' | 'console' | 'object'
  hasGrouping: boolean
  hasCorrelationId: boolean
  hasBoxFormatting: boolean
} {
  if (typeof logger === 'function') {
    return {
      type: 'function',
      hasGrouping: false,
      hasCorrelationId: false,
      hasBoxFormatting: false,
    }
  }

  if (logger === console || (logger as any) === console) {
    return {
      type: 'console',
      hasGrouping: typeof console.group === 'function',
      hasCorrelationId: false,
      hasBoxFormatting: false,
    }
  }

  if (typeof logger === 'object' && logger !== null) {
    const loggerObj = logger as any
    return {
      type: 'object',
      hasGrouping:
        typeof loggerObj.group === 'function' || typeof loggerObj.groupCollapsed === 'function',
      hasCorrelationId:
        typeof loggerObj.getCorrelationId === 'function' &&
        typeof loggerObj.setCorrelationId === 'function',
      hasBoxFormatting: typeof loggerObj.box === 'function',
    }
  }

  // Fallback
  return {
    type: 'console',
    hasGrouping: false,
    hasCorrelationId: false,
    hasBoxFormatting: false,
  }
}

/**
 * Creates a validation middleware that can optionally validate initial state structure
 * and then validate state updates using a custom validator function. This middleware
 * provides comprehensive validation capabilities including structure validation,
 * business rule enforcement, and asynchronous validation support.
 *
 * @param validator - Function to validate state updates. Can be synchronous (returns boolean)
 *                   or asynchronous (returns Promise<boolean>). Receives the proposed next state,
 *                   the action being applied, and the current state.
 * @param validationErrorHandler - Optional custom error handler for validation failures.
 *                                If not provided, errors are logged to console.error.
 * @param initialStateTemplate - Optional template to validate initial state structure against.
 *                              Uses strict structural matching to ensure state integrity.
 * @returns Middleware function for comprehensive state validation
 *
 * @remarks
 * The validation middleware operates in two phases:
 * 1. **Initial Structure Validation** (one-time): Validates that the initial state matches
 *    the provided template structure if `initialStateTemplate` is specified.
 * 2. **Runtime Validation** (per action): Validates each state update using the provided
 *    validator function.
 *
 * **Validation Flow:**
 * - If initial validation fails, the action is blocked and an error is raised
 * - If runtime validation fails, the action is blocked and an error is raised
 * - If validation passes, the action proceeds to the next middleware or state update
 * - Async validators are properly awaited before proceeding
 *
 * **Error Handling:**
 * - Validation errors are wrapped in `ValidationError` objects with context
 * - Custom error handlers receive both the error and the action that caused it
 * - Default behavior logs errors to console but allows the application to continue
 *
 * @example
 * **Basic synchronous validation:**
 * ```typescript
 * interface AppState {
 *   count: number;
 *   user: { id: number; name: string } | null;
 * }
 *
 * const validator = createValidatorMiddleware<AppState>(
 *   (state, action, prevState) => {
 *     // Ensure count is never negative
 *     if (state.count < 0) return false;
 *
 *     // Ensure user ID is positive when user exists
 *     if (state.user && state.user.id <= 0) return false;
 *
 *     return true;
 *   }
 * );
 *
 * const store = createStore({ count: 0, user: null }, {
 *   middleware: [validator]
 * });
 * ```
 *
 * @example
 * **Structure validation with initial state template:**
 * ```typescript
 * interface UserProfile {
 *   personal: { name: string; age: number };
 *   settings: { theme: string; notifications: boolean };
 *   permissions: string[];
 * }
 *
 * const validator = createValidatorMiddleware<UserProfile>(
 *   (state) => {
 *     // Business logic validation
 *     return state.personal.age >= 0 && state.personal.age <= 150;
 *   },
 *   (error, action) => {
 *     console.error('Validation failed for action:', action);
 *     // Could send to error tracking service
 *     analytics.track('validation_error', { error, action });
 *   },
 *   // Template ensures loaded state matches expected structure
 *   {
 *     personal: { name: "", age: 0 },
 *     settings: { theme: "", notifications: false },
 *     permissions: []
 *   }
 * );
 * ```
 *
 * @example
 * **Asynchronous validation with external API calls:**
 * ```typescript
 * const asyncValidator = createValidatorMiddleware<AppState>(
 *   async (state, action, prevState) => {
 *     // Skip validation for non-user actions
 *     if (!('user' in action)) return true;
 *
 *     if (state.user) {
 *       try {
 *         // Validate user data against external service
 *         const isValid = await userService.validateUser(state.user);
 *         return isValid;
 *       } catch (error) {
 *         console.error('User validation failed:', error);
 *         return false;
 *       }
 *     }
 *
 *     return true;
 *   },
 *   (error, action) => {
 *     // Handle async validation errors
 *     errorReporting.captureException(error.context?.error || error);
 *   }
 * );
 * ```
 *
 * @example
 * **Complex business rule validation:**
 * ```typescript
 * interface ShoppingCart {
 *   items: Array<{ id: string; quantity: number; price: number }>;
 *   discounts: Array<{ code: string; amount: number }>;
 *   total: number;
 *   customerTier: 'bronze' | 'silver' | 'gold';
 * }
 *
 * const cartValidator = createValidatorMiddleware<ShoppingCart>(
 *   (state, action, prevState) => {
 *     // Validate cart total calculation
 *     const calculatedTotal = state.items.reduce(
 *       (sum, item) => sum + (item.quantity * item.price), 0
 *     ) - state.discounts.reduce((sum, discount) => sum + discount.amount, 0);
 *
 *     if (Math.abs(state.total - calculatedTotal) > 0.01) {
 *       console.error('Cart total mismatch:', {
 *         stored: state.total,
 *         calculated: calculatedTotal
 *       });
 *       return false;
 *     }
 *
 *     // Validate quantity constraints
 *     const hasInvalidQuantity = state.items.some(item =>
 *       item.quantity < 0 || item.quantity > 99
 *     );
 *     if (hasInvalidQuantity) return false;
 *
 *     // Validate discount eligibility
 *     const totalDiscounts = state.discounts.reduce((sum, d) => sum + d.amount, 0);
 *     const maxDiscount = state.customerTier === 'gold' ? 0.3 :
 *                        state.customerTier === 'silver' ? 0.2 : 0.1;
 *
 *     if (totalDiscounts > calculatedTotal * maxDiscount) {
 *       return false;
 *     }
 *
 *     return true;
 *   },
 *   (error, action) => {
 *     // Log validation failures for business intelligence
 *     businessMetrics.track('cart_validation_failure', {
 *       action: action,
 *       timestamp: Date.now(),
 *       errorDetails: error.context
 *     });
 *   }
 * );
 * ```
 *
 * @example
 * **Conditional validation based on action type:**
 * ```typescript
 * const conditionalValidator = createValidatorMiddleware<AppState>(
 *   (state, action, prevState) => {
 *     // Only validate specific action types
 *     if ('user' in action) {
 *       // User-related validations
 *       return validateUser(state.user);
 *     }
 *
 *     if ('settings' in action) {
 *       // Settings-related validations
 *       return validateSettings(state.settings);
 *     }
 *
 *     if ('payment' in action) {
 *       // Payment validations (could be async)
 *       return validatePaymentInfo(action.payment);
 *     }
 *
 *     // Allow all other actions without validation
 *     return true;
 *   }
 * );
 * ```
 *
 * @example
 * **Integration with form validation libraries:**
 * ```typescript
 * import * as yup from 'yup';
 *
 * const schema = yup.object().shape({
 *   user: yup.object().shape({
 *     email: yup.string().email().required(),
 *     age: yup.number().min(18).max(120).required()
 *   }).nullable(),
 *   preferences: yup.object().shape({
 *     theme: yup.string().oneOf(['light', 'dark']).required(),
 *     language: yup.string().length(2).required()
 *   })
 * });
 *
 * const schemaValidator = createValidatorMiddleware<AppState>(
 *   async (state) => {
 *     try {
 *       await schema.validate(state);
 *       return true;
 *     } catch (validationError) {
 *       console.error('Schema validation failed:', validationError.message);
 *       return false;
 *     }
 *   }
 * );
 * ```
 *
 * @example
 * **Development vs production validation:**
 * ```typescript
 * const createEnvironmentValidator = (isDevelopment: boolean) => {
 *   return createValidatorMiddleware<AppState>(
 *     (state, action, prevState) => {
 *       // Always run critical validations
 *       if (!validateCriticalInvariants(state)) return false;
 *
 *       if (isDevelopment) {
 *         // Additional strict validations in development
 *         if (!validateDevelopmentConstraints(state)) {
 *           console.warn('Development validation failed - this would pass in production');
 *           return false;
 *         }
 *       }
 *
 *       return true;
 *     },
 *     (error, action) => {
 *       if (isDevelopment) {
 *         // Detailed logging in development
 *         console.group('🚨 Validation Error');
 *         console.error('Action:', action);
 *         console.error('Error:', error);
 *         console.trace('Stack trace');
 *         console.groupEnd();
 *       } else {
 *         // Minimal logging in production
 *         errorService.log('validation_error', {
 *           message: error.message,
 *           action: action
 *         });
 *       }
 *     }
 *   );
 * };
 * ```
 *
 * @see {@link ValidationError} for error structure details
 * @see {@link Middleware} for middleware architecture information
 * @see {@link createLoggerMiddleware} for logging middleware
 * @see {@link strictStructureMatch} for structure validation details
 */
export function createValidatorMiddleware<S extends object>(
  validator: ValidatorFn<S>, // Validator can be async
  validationErrorHandler?: ValidationErrorHandler<S>,
  initialStateTemplate?: S
): Middleware<S> {
  let hasValidatedInitialState = false

  return (action, prevState, dispatchNext, getState, reset) => {
    // Validate initial state structure on first run if template provided
    if (!hasValidatedInitialState && initialStateTemplate) {
      hasValidatedInitialState = true

      if (!strictStructureMatch(prevState, initialStateTemplate)) {
        const validationError = new ValidationError(
          'Initial state structure does not match the provided template',
          {
            currentState: prevState,
            expectedTemplate: initialStateTemplate,
          }
        )

        if (validationErrorHandler) {
          validationErrorHandler(validationError, action)
        } else {
          console.error(validationError.message, validationError.context)
        }

        // Block the action if initial state validation fails
        reset() // Reset state to initial

        // Don't proceed with the action if initial state is invalid
        return
      }
    }

    const tempNextState = {...prevState, ...action}

    try {
      const validationResult = validator(tempNextState, action, prevState)

      // Handle synchronous validator
      if (typeof validationResult === 'boolean') {
        if (validationResult === false) {
          const validationError = new ValidationError('State update validation failed', {
            state: tempNextState,
            action,
          })

          if (validationErrorHandler) {
            validationErrorHandler(validationError, action)
          } else {
            console.error(validationError.message, validationError.context)
          }

          // Block the action if validation fails
          return
        }
      } else if (validationResult instanceof Promise) {
        // Handle asynchronous validator
        validationResult
          .then(result => {
            if (result === false) {
              const validationError = new ValidationError('Async state update validation failed', {
                state: tempNextState,
                action,
              })

              if (validationErrorHandler) {
                validationErrorHandler(validationError, action)
              } else {
                console.error(validationError.message, validationError.context)
              }

              // Block the action if validation fails
              return
            }

            dispatchNext(action) // Proceed with the action if validation passes
          })
          .catch(error => {
            const validationError = new ValidationError('Async validation error', {
              error,
              action,
            })

            if (validationErrorHandler) {
              validationErrorHandler(validationError, action)
            } else {
              console.error(validationError.message, validationError.context)
            }

            // Block the action on validation error
          })
        return // Prevent dispatching the action multiple times
      }

      dispatchNext(action) // Proceed with the action if validation passes
    } catch (error) {
      const validationError = new ValidationError('Validation middleware error', {
        error,
        action,
      })

      if (validationErrorHandler) {
        validationErrorHandler(validationError, action)
      } else {
        console.error(validationError.message, validationError.context)
      }

      // Allow the action to proceed even if validation middleware encounters an error
      dispatchNext(action)
    }
  }
}
