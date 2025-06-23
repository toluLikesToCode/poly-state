import { StoreError, ValidationError } from "../../shared/errors";
import * as storage from "../storage/index";
import {
  ActionPayload,
  Middleware,
  PersistedState,
  StorageType,
  Store,
  StoreOptions,
  ValidationErrorHandler,
  ValidatorFn,
} from "./types";
/**
 * Clean up stale persisted states across all storage types
 */
export function cleanupStaleStates(
  maxAge: number = 30 * 24 * 60 * 60 * 1000,
  cookiePrefix: string = "__store_" // Default prefix
): {
  local: number;
  session: number;
  cookie: number;
} {
  const now = Date.now();
  const result = { local: 0, session: 0, cookie: 0 };
  const handleError = (e: any, type: string, key: string) => {
    // In a real app, this might use a global error logger
    console.warn("Error cleaning stale state", type, key, e);
  };

  // Clean localStorage
  if (storage.isLocalStorageAvailable()) {
    /* iterate backwards so index shifts don’t skip keys */
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key) {
        try {
          const item = storage.getLocalStorage<PersistedState<any>>(
            key,
            {} as PersistedState<any>
          );
          if (item && item.meta && now - item.meta.lastUpdated > maxAge) {
            storage.removeLocalStorage(key);
            result.local++;
          }
        } catch (e) {
          handleError(e, "localStorage", key);
        }
      }
    }
  }

  // Clean sessionStorage
  if (storage.isSessionStorageAvailable()) {
    /* iterate backwards so index shifts don’t skip keys */
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key) {
        try {
          const rawData = sessionStorage.getItem(key);
          if (rawData) {
            const item = JSON.parse(rawData) as PersistedState<any>;
            if (item && item.meta && now - item.meta.lastUpdated > maxAge) {
              sessionStorage.removeItem(key);
              result.session++;
            }
          }
        } catch (e) {
          handleError(e, "sessionStorage", key);
        }
      }
    }
  }

  // Clean cookies using prefix
  if (typeof document !== "undefined" && document.cookie) {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [namePart] = cookie.split("=");
      const name = namePart.trim();
      if (name.startsWith(cookiePrefix)) {
        try {
          const cookieValue = storage.getCookie(name);
          if (cookieValue) {
            const item = JSON.parse(cookieValue) as PersistedState<any>;
            if (item && item.meta && now - item.meta.lastUpdated > maxAge) {
              storage.removeCookie(name); // Assuming removeCookie uses appropriate path/domain or this cookie was set with defaults
              result.cookie++;
            }
          }
        } catch (e) {
          handleError(e, "cookie", name);
        }
      }
    }
  }
  return result;
}

// --- Built-in Middleware Creators (createLoggerMiddleware, createValidatorMiddleware) ---

/**
 * Recursively checks that the structure and types of `obj` and `template` match exactly.
 * All keys must exist in both, and types must match.
 * @param obj - The object to validate (e.g., loaded state)
 * @param template - The template object (e.g., initial state)
 * @returns True if `obj` matches the structure and types of `template` exactly
 */
function strictStructureMatch(obj: any, template: any): boolean {
  if (typeof obj !== typeof template) return false;
  if (obj === null || template === null) return obj === template;
  if (Array.isArray(obj) || Array.isArray(template)) {
    if (!Array.isArray(obj) || !Array.isArray(template)) return false;
    // make sure both arrays have the same element type in the first position
    if (obj.length > 0 && template.length > 0) {
      if (typeof obj[0] !== typeof template[0]) return false;
    }
    return true;
  }
  if (typeof obj === "object" && typeof template === "object") {
    const objKeys = Object.keys(obj);
    const templateKeys = Object.keys(template);
    if (objKeys.length !== templateKeys.length) return false;
    for (const key of templateKeys) {
      if (!(key in obj)) return false;
      if (!strictStructureMatch(obj[key], template[key])) return false;
    }
    for (const key of objKeys) {
      if (!(key in template)) return false;
    }
    return true;
  }
  return true;
}

/**
 * Creates a logging middleware that logs state changes and actions for debugging purposes.
 * The middleware logs both before and after the action is applied, providing full visibility
 * into the state transition process.
 *
 * @param logger - Custom logging function. Defaults to console.log. Can be any function
 *                that accepts multiple arguments for flexible logging strategies.
 * @returns Middleware function that logs state updates
 *
 * @remarks
 * The logger middleware provides two log entries per action:
 * 1. **Before dispatch**: Shows the action and potential next state
 * 2. **After dispatch**: Shows the actual applied state after all middleware processing
 *
 * This is particularly useful for:
 * - Debugging state changes during development
 * - Auditing state transitions in production (with appropriate loggers)
 * - Understanding middleware execution flow
 * - Tracking performance issues with state updates
 *
 * @example
 * **Basic usage with console logging:**
 * ```typescript
 * const store = createStore(
 *   { count: 0, user: null },
 *   {
 *     middleware: [createLoggerMiddleware()]
 *   }
 * );
 *
 * store.dispatch({ count: 1 });
 * // Output:
 * // State Update: {
 * //   action: { count: 1 },
 * //   prevState: { count: 0, user: null },
 * //   nextPotentialState: { count: 1, user: null }
 * // }
 * // State Update Applied. New state: { count: 1, user: null }
 * ```
 *
 * @example
 * **Custom logger for structured logging:**
 * ```typescript
 * const structuredLogger = (message: string, data: any) => {
 *   console.log(JSON.stringify({
 *     timestamp: new Date().toISOString(),
 *     level: 'INFO',
 *     message,
 *     data
 *   }, null, 2));
 * };
 *
 * const store = createStore(
 *   { items: [], loading: false },
 *   {
 *     middleware: [createLoggerMiddleware(structuredLogger)]
 *   }
 * );
 * ```
 *
 * @example
 * **Integration with external logging services:**
 * ```typescript
 * import { analytics } from './analytics-service';
 *
 * const analyticsLogger = (message: string, data: any) => {
 *   if (message.includes('State Update:')) {
 *     analytics.track('state_change_initiated', {
 *       action: data.action,
 *       timestamp: Date.now()
 *     });
 *   } else if (message.includes('Applied')) {
 *     analytics.track('state_change_completed', {
 *       newState: data,
 *       timestamp: Date.now()
 *     });
 *   }
 * };
 *
 * const store = createStore(initialState, {
 *   middleware: [createLoggerMiddleware(analyticsLogger)]
 * });
 * ```
 *
 * @example
 * **Conditional logging based on environment:**
 * ```typescript
 * const conditionalLogger = (...args: any[]) => {
 *   if (process.env.NODE_ENV === 'development') {
 *     console.log(...args);
 *   } else if (process.env.NODE_ENV === 'production') {
 *     // Send to production logging service
 *     productionLogger.info(args);
 *   }
 * };
 *
 * const store = createStore(initialState, {
 *   middleware: [createLoggerMiddleware(conditionalLogger)]
 * });
 * ```
 *
 * @example
 * **Filtering sensitive data:**
 * ```typescript
 * const sanitizingLogger = (message: string, data: any) => {
 *   const sanitizedData = JSON.parse(JSON.stringify(data, (key, value) => {
 *     // Filter out sensitive fields
 *     if (['password', 'token', 'secret'].includes(key.toLowerCase())) {
 *       return '[REDACTED]';
 *     }
 *     return value;
 *   }));
 *
 *   console.log(message, sanitizedData);
 * };
 *
 * const store = createStore(
 *   { user: { name: '', password: '' }, session: { token: '' } },
 *   { middleware: [createLoggerMiddleware(sanitizingLogger)] }
 * );
 * ```
 *
 * @see {@link Middleware} for more information about middleware architecture
 * @see {@link createValidatorMiddleware} for validation middleware
 */
export function createLoggerMiddleware<S extends object>(
  logger: (...args: any[]) => void = console.log
): Middleware<S> {
  return (action, prevState, dispatchNext, getState) => {
    logger("State Update: ", {
      action,
      prevState: { ...prevState }, // Log copy
      nextPotentialState: { ...prevState, ...action }, // What it would be if applied directly
    });
    dispatchNext(action); // Pass the action to the next middleware or applyState
    logger("State Update Applied. New state:", { ...getState() });
  };
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
  let hasValidatedInitialState = false;

  return (action, prevState, dispatchNext, _getState, reset) => {
    // Validate initial state structure on first run if template provided
    if (!hasValidatedInitialState && initialStateTemplate) {
      hasValidatedInitialState = true;

      if (!strictStructureMatch(prevState, initialStateTemplate)) {
        const validationError = new ValidationError(
          "Initial state structure does not match the provided template",
          {
            currentState: prevState,
            expectedTemplate: initialStateTemplate,
          }
        );

        if (validationErrorHandler) {
          validationErrorHandler(validationError, action);
        } else {
          console.error(validationError.message, validationError.context);
        }

        // Block the action if initial state validation fails
        reset(); // Reset state to initial

        // Don't proceed with the action if initial state is invalid
        return;
      }
    }

    const tempNextState = { ...prevState, ...action };

    try {
      const validationResult = validator(tempNextState, action, prevState);

      // Handle synchronous validator
      if (typeof validationResult === "boolean") {
        if (validationResult) {
          dispatchNext(action);
        } else {
          const validationError = new ValidationError(
            "State validation failed",
            {
              action,
              stateAttempted: tempNextState,
            }
          );
          if (validationErrorHandler)
            validationErrorHandler(validationError, action);
          else console.error(validationError.message, validationError.context);
        }
        return;
      }

      // Handle asynchronous validator
      if (validationResult && typeof validationResult.then === "function") {
        return validationResult
          .then((isValid: boolean) => {
            if (isValid) {
              dispatchNext(action);
            } else {
              const validationError = new ValidationError(
                "State validation failed",
                {
                  action,
                  stateAttempted: tempNextState,
                }
              );
              if (validationErrorHandler)
                validationErrorHandler(validationError, action);
              else
                console.error(validationError.message, validationError.context);
            }
          })
          .catch((e: any) => {
            const validationError = new ValidationError(
              e.message || "State validation threw an error",
              { error: e, action, stateAttempted: tempNextState }
            );
            if (validationErrorHandler)
              validationErrorHandler(validationError, action);
            else
              console.error(validationError.message, validationError.context);
          });
      }
    } catch (e: any) {
      const validationError = new ValidationError(
        e.message || "State validation threw an error",
        { error: e, action, stateAttempted: tempNextState }
      );
      if (validationErrorHandler)
        validationErrorHandler(validationError, action);
      else console.error(validationError.message, validationError.context);
    }
  };
}
