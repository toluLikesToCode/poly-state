import {Store, Plugin, ActionPayload} from '../core/state/types'
import type {
  EnhancerOptions,
  ConnectResponse,
  DevToolsMessage,
  DispatchPayload,
  LiftedState,
  PerformedAction,
  StoredAction,
} from './devToolsTypes'
const jsan = require('jsan')

/**
 * Configuration options for the simple Redux DevTools plugin.
 */
export interface ReduxDevToolsOptions extends EnhancerOptions {
  /**
   * Time travel support.
   * @default true
   */
  jump?: boolean

  /**
   * *string or array of strings as regex* - actions types to be hidden / shown in the monitors (while passed to the reducers).
   * If `actionsAllowlist` specified, `actionsDenylist` is ignored.
   */
  actionsDenylist?: string[]
}

/**
 * Action name contexts for DevTools action labeling.
 */
export enum ActionNameContext {
  Transaction = 'transaction',
  Batch = 'batch',
  History = 'history',
  Normal = 'action',
}

/**
 * Internal state manager for DevTools lifted state
 */
class LiftedStateManager<S extends object> {
  private liftedState: LiftedState<S>
  private maxAge: number

  constructor(initialState: S, maxAge: number = 50) {
    this.maxAge = maxAge
    this.liftedState = {
      actionsById: {
        0: {
          type: '@@INIT',
          timestamp: Date.now(),
        },
      },
      computedStates: [{state: initialState}],
      stagedActionIds: [0],
      currentStateIndex: 0,
      nextActionId: 1,
      skippedActionIds: [],
    }
  }

  /**
   * Add a new action and state to the lifted state
   */
  addAction(action: StoredAction, state: S): void {
    const actionId = this.liftedState.nextActionId++

    // Add action
    this.liftedState.actionsById[actionId] = action
    this.liftedState.stagedActionIds.push(actionId)
    this.liftedState.computedStates.push({state})
    this.liftedState.currentStateIndex = this.liftedState.computedStates.length - 1

    // Enforce maxAge limit, always keep @@INIT (ID 0)
    if (this.liftedState.stagedActionIds.length > this.maxAge) {
      const excess = this.liftedState.stagedActionIds.length - this.maxAge
      const removedIds = this.liftedState.stagedActionIds.splice(1, excess)

      removedIds.forEach(id => delete this.liftedState.actionsById[id])
      this.liftedState.computedStates.splice(1, excess)
      this.liftedState.currentStateIndex = Math.max(0, this.liftedState.computedStates.length - 1)
    }
  }

  /**
   * Jump to a specific action in the history
   */
  jumpToAction(actionId: number): S | undefined {
    const index = this.liftedState.stagedActionIds.indexOf(actionId)
    if (index === -1) return undefined

    this.liftedState.currentStateIndex = index
    return this.liftedState.computedStates[index]?.state
  }

  /**
   * Jump to a specific state index
   */
  jumpToState(stateIndex: number): S | undefined {
    if (stateIndex < 0 || stateIndex >= this.liftedState.computedStates.length) {
      return undefined
    }

    this.liftedState.currentStateIndex = stateIndex
    return this.liftedState.computedStates[stateIndex]?.state
  }

  /**
   * Toggle (skip/unskip) an action
   */
  toggleAction(actionId: number): void {
    const skippedIndex = this.liftedState.skippedActionIds?.indexOf(actionId) ?? -1

    if (skippedIndex === -1) {
      // Skip the action
      if (!this.liftedState.skippedActionIds) {
        this.liftedState.skippedActionIds = []
      }
      this.liftedState.skippedActionIds.push(actionId)
    } else {
      // Unskip the action
      this.liftedState.skippedActionIds?.splice(skippedIndex, 1)
    }
  }

  /**
   * Commit the current state (remove all actions except the current state)
   */
  commit(): S {
    const currentState = this.liftedState.computedStates[this.liftedState.currentStateIndex].state

    // Reset to just the current state
    this.liftedState = {
      actionsById: {
        0: {
          type: '@@INIT',
          timestamp: Date.now(),
        },
      },
      computedStates: [{state: currentState}],
      stagedActionIds: [0],
      currentStateIndex: 0,
      nextActionId: 1,
      skippedActionIds: [],
      committedState: currentState,
    }

    return currentState
  }

  /**
   * Rollback to the last committed state or initial state
   */
  rollback(): S {
    const targetState = this.liftedState.committedState || this.liftedState.computedStates[0].state

    // Find the index of the committed state
    let targetIndex = 0
    if (this.liftedState.committedState) {
      for (let i = this.liftedState.computedStates.length - 1; i >= 0; i--) {
        if (this.liftedState.computedStates[i].state === this.liftedState.committedState) {
          targetIndex = i
          break
        }
      }
    }

    this.liftedState.currentStateIndex = targetIndex
    return targetState
  }

  /**
   * Reset to initial state
   */
  reset(): S {
    const initialState = this.liftedState.computedStates[0].state

    this.liftedState = {
      actionsById: {
        0: {
          type: '@@INIT',
          timestamp: Date.now(),
        },
      },
      computedStates: [{state: initialState}],
      stagedActionIds: [0],
      currentStateIndex: 0,
      nextActionId: 1,
      skippedActionIds: [],
    }

    return initialState
  }

  /**
   * Import a complete lifted state
   */
  importState(liftedState: LiftedState<S>): S {
    this.liftedState = liftedState
    return this.getCurrentState()
  }

  /**
   * Get the current state
   */
  getCurrentState(): S {
    return this.liftedState.computedStates[this.liftedState.currentStateIndex].state
  }

  /**
   * Get the full lifted state
   */
  getLiftedState(): LiftedState<S> {
    return this.liftedState
  }

  /**
   * Serialize the lifted state for DevTools
   */
  serializeLiftedState(): any {
    const {actionsById, computedStates, committedState, ...rest} = this.liftedState
    return {
      ...rest,
      actionsById: JSON.stringify(actionsById),
      computedStates: JSON.stringify(computedStates),
      committedState: typeof committedState !== 'undefined',
    }
  }
}

/**
 * Creates a plugin for connecting a custom store to the Redux DevTools extension.
 *
 * @remarks
 * This function is instrumented with additional debug logging to help diagnose communication protocol issues.
 * The plugin respects the {@link DevToolsHelper.enabled} status both at initialization and during runtime:
 * - If DevTools is disabled via configuration, the plugin returns an inactive instance
 * - Runtime checks in all event handlers prevent DevTools communication when disabled
 * - The plugin can be enabled/disabled dynamically via {@link DevToolsHelper.enable} and {@link DevToolsHelper.disable}
 *
 * @param options - The configuration options for the DevTools plugin.
 * @returns The plugin instance for the store.
 */
export function createSimpleDevToolsPlugin<S extends object>(options: ReduxDevToolsOptions): Plugin<S> {
  const {name, jump = true, maxAge = 100, trace = true, serialize = true} = options

  // Check if DevTools is enabled via configuration
  if (!DevToolsHelper.enabled) {
    return {
      name: 'SimpleDevToolsPlugin (disabled)',
    }
  }

  // Check if DevTools extension is available
  if (!window.__REDUX_DEVTOOLS_EXTENSION__) {
    return {
      name: 'SimpleDevToolsPlugin (inactive)',
    }
  }

  let devTools: ConnectResponse
  let store: Store<S>
  let liftedStateManager: LiftedStateManager<S>
  let isUpdatingFromDevTools = false
  let isPaused = false
  let isLocked = false
  let isBatch = false
  let isTransaction = false
  let batchedActions: Array<{action: PerformedAction; state: S}> = []
  let storeCreated = false

  // Helper to format an action for DevTools
  const formatAction = (changes: Partial<S>, context: ActionNameContext = ActionNameContext.Normal): StoredAction => {
    const action: StoredAction = {
      type: generateActionName(changes, name ?? '', context),
      payload: changes,
      timestamp: Date.now(),
    }

    if (trace) {
      // Capture stack trace
      const error = new Error()
      action.stack = error.stack
    }
    return action
  }

  // Helper to send the current state to DevTools
  const sendState = () => {
    if (!DevToolsHelper.enabled || isPaused || isLocked || !devTools) return

    const serialized = liftedStateManager.serializeLiftedState()

    try {
      devTools.send({type: 'STATE', ...serialized}, liftedStateManager.getCurrentState())
    } catch (error) {}
  }

  // Helper to send a single action
  const sendAction = (action: StoredAction, state: S) => {
    if (!DevToolsHelper.enabled || isPaused || isLocked || !devTools) return

    try {
      const {stack, ...sendable} = action // Remove internal 'stack'
      void stack
      devTools.send(sendable, state)
    } catch (error) {}
  }

  // Handle DISPATCH messages from DevTools
  const handleDispatchMessage = (message: DevToolsMessage) => {
    if (!message.payload || !jump) return

    const payload = message.payload as DispatchPayload

    switch (payload.type) {
      case 'JUMP_TO_ACTION': {
        if (typeof payload.actionId !== 'number') break

        const targetState = liftedStateManager.jumpToAction(payload.actionId)

        if (targetState && store._setStateForDevTools) {
          isUpdatingFromDevTools = true
          store._setStateForDevTools(targetState, true)
          isUpdatingFromDevTools = false
          sendState()
        }
        break
      }

      case 'JUMP_TO_STATE': {
        // DevTools uses state from the message
        if (message.state) {
          try {
            const parsedState = jsan.parse(message.state) as S

            if (store._setStateForDevTools) {
              isUpdatingFromDevTools = true
              store._setStateForDevTools(parsedState, true)
              isUpdatingFromDevTools = false
            }
          } catch (error) {}
        }
        break
      }

      case 'TOGGLE_ACTION': {
        if (typeof payload.actionId !== 'number') break

        liftedStateManager.toggleAction(payload.actionId)

        // In a full implementation, we'd recompute states here
        sendState()
        break
      }

      case 'COMMIT': {
        const committedState = liftedStateManager.commit()

        if (store._setStateForDevTools) {
          isUpdatingFromDevTools = true
          store._setStateForDevTools(committedState, true)
          isUpdatingFromDevTools = false
        }
        sendState()
        break
      }

      case 'ROLLBACK': {
        const rolledBackState = liftedStateManager.rollback()
        if (store._setStateForDevTools) {
          isUpdatingFromDevTools = true
          store._setStateForDevTools(rolledBackState, true)
          isUpdatingFromDevTools = false
        }
        sendState()
        break
      }

      case 'RESET': {
        const resetState = liftedStateManager.reset()

        if (store._setStateForDevTools) {
          isUpdatingFromDevTools = true
          store._setStateForDevTools(resetState, true)
          isUpdatingFromDevTools = false
        }
        sendState()
        break
      }

      case 'PAUSE_RECORDING': {
        isPaused = !!payload.status
        break
      }

      case 'LOCK_CHANGES': {
        isLocked = !!payload.status
        break
      }

      case 'IMPORT_STATE': {
        if (payload.nextLiftedState) {
          const importedState = liftedStateManager.importState(payload.nextLiftedState as LiftedState<S>)

          if (store._setStateForDevTools) {
            isUpdatingFromDevTools = true
            store._setStateForDevTools(importedState, true)
            isUpdatingFromDevTools = false
          }
          sendState()
        }
        break
      }

      default:
    }
  }

  const plugin: Plugin<S> = {
    name: 'SimpleDevToolsPlugin',

    onStoreCreate: (storeInstance: Store<S>) => {
      store = storeInstance
      const initialState = store.getState()

      // Initialize lifted state manager
      liftedStateManager = new LiftedStateManager(initialState, maxAge)

      // Connect to DevTools
      const enhancerOptions: EnhancerOptions = {
        name,
        features: {
          pause: true,
          lock: true,
          persist: false, // We'll implement this later
          export: true, // We'll implement this later
          import: true,
          jump: jump,
          skip: false, // We'll implement this later
          reorder: false, // We'll implement this later
          dispatch: false, // Disable for MVP
          test: false,
          ...options.features, // Allow overriding features
        },
        serialize,
        trace,
        ...options, // Allow additional options
      }

      try {
        devTools = window.__REDUX_DEVTOOLS_EXTENSION__!.connect(enhancerOptions)

        // Initialize DevTools with lifted state
        devTools.init(liftedStateManager.getLiftedState())

        // Subscribe to DevTools messages
        devTools.subscribe((message: DevToolsMessage) => {
          switch (message.type) {
            case 'DISPATCH':
              handleDispatchMessage(message)
              break

            case 'START':
              isPaused = false
              // Send current state
              sendState()
              break

            case 'STOP':
              isPaused = true
              break

            case 'ACTION':
              // Remote action dispatching - implement in later phase
              break

            case 'IMPORT':
              // State import - implement in later phase
              break

            case 'EXPORT':
              // State export - implement in later phase
              break
            case 'OPTIONS':
              // implement in later phase
              break

            default:
          }
        })
        storeCreated = true
      } catch (error) {}
    },

    onStateChange: (newState: S, prevState: S, action: Partial<S> | null) => {
      // Skip if DevTools is disabled, updating from DevTools, or paused/locked
      if (!DevToolsHelper.enabled || isUpdatingFromDevTools || isPaused || isLocked || !action || !storeCreated) return

      // Handle batching
      if (isBatch) {
        const performedAction = formatAction(action, ActionNameContext.Batch)
        batchedActions.push({action: performedAction, state: newState})
        return
      }

      // Skip during transactions (will be handled in onTransactionEnd)
      if (isTransaction) return

      // Add action to lifted state
      const performedAction = formatAction(action, ActionNameContext.Normal)
      liftedStateManager.addAction(performedAction, newState)

      // Send to DevTools
      sendAction(performedAction, newState)
    },

    onBatchStart: () => {
      if (!storeCreated) return
      isBatch = true
      batchedActions = []
    },

    onBatchEnd: (actions: Partial<S>[], finalState: S) => {
      if (!DevToolsHelper.enabled || isUpdatingFromDevTools || isPaused || isLocked || !storeCreated) {
        isBatch = false
        batchedActions = []
        return
      }

      // Create a batched action
      const batchAction: PerformedAction = {
        type: generateActionName(actions, name ?? '', ActionNameContext.Batch),
        payload: actions,
        timestamp: Date.now(),
      }

      if (trace) {
        batchAction.stack = new Error().stack
      }
      // Add the batch as a single action
      liftedStateManager.addAction(batchAction, finalState)

      // Send to DevTools
      sendAction(batchAction, finalState)

      isBatch = false
      batchedActions = []
    },

    onTransactionStart: () => {
      if (!storeCreated) return
      isTransaction = true
    },

    onTransactionEnd: (success: boolean, storeInstance: Store<S>, changes?: Partial<S>, error?: Error) => {
      if (
        !success ||
        !DevToolsHelper.enabled ||
        isUpdatingFromDevTools ||
        isPaused ||
        isLocked ||
        !changes ||
        !storeCreated
      ) {
        if (error) {
        }
        isTransaction = false
        return
      }

      // Create transaction action
      const transactionAction: PerformedAction = {
        type: generateActionName(changes, name ?? '', ActionNameContext.Transaction),
        payload: changes,
        timestamp: Date.now(),
      }

      if (trace) {
        transactionAction.stack = new Error().stack
      }

      const currentState = storeInstance.getState()

      // Add to lifted state
      liftedStateManager.addAction(transactionAction, currentState)

      // Send to DevTools
      sendAction(transactionAction, currentState)

      isTransaction = false
    },

    onHistoryChanged: options => {
      // Skip if DevTools is disabled or updating from DevTools
      if (!DevToolsHelper.enabled || isUpdatingFromDevTools || isPaused || isLocked || !storeCreated) return

      // Create a history action
      const historyAction: PerformedAction = {
        type: `${name}/@@${options.operation.toUpperCase()}`,
        payload: {steps: options.steps},
        timestamp: Date.now(),
      }

      // Add to lifted state
      liftedStateManager.addAction(historyAction, options.newState)

      // Send to DevTools
      sendAction(historyAction, options.newState)
    },

    onError: (error, context) => {
      if (!storeCreated) return
      // Send error to DevTools only if enabled
      if (DevToolsHelper.enabled && devTools && devTools.error) {
        devTools.error({
          message: error.message,
          source: '@devtools-extension',
          stack: error.stack,
          context,
        })
      }
    },

    onDestroy: () => {
      if (!storeCreated) return

      if (devTools) {
        devTools.unsubscribe()
      }

      if (window.__REDUX_DEVTOOLS_EXTENSION__ && typeof window.__REDUX_DEVTOOLS_EXTENSION__.disconnect === 'function') {
        window.__REDUX_DEVTOOLS_EXTENSION__.disconnect()
      }
    },
  }
  return plugin
}

/**
 * Generates a descriptive action name for Redux DevTools and logging.
 *
 * @param action - The action payload, array of payloads, or null/undefined.
 * @param storeName - Name of the store for context.
 * @param context - Optional context string (e.g., 'transaction', 'batch', 'history') to override or clarify the action type.
 * @returns A descriptive action name string.
 *
 * @remarks
 * This function is robust for use in {@link onTransactionEnd}, {@link onBatchEnd}, and {@link onHistoryChanged}.
 * It handles special markers, arrays, and context overrides for clear DevTools labeling.
 *
 * @example
 * ```typescript
 * generateActionName({ foo: 1 }, 'MyStore'); // 'MyStore/SET_FOO'
 * generateActionName([ { a: 1 }, { b: 2 } ], 'MyStore', 'batch'); // 'MyStore/BATCH[2]'
 * generateActionName({}, 'MyStore', 'transaction'); // 'MyStore/TRANSACTION'
 * ```
 * @see {@link onTransactionEnd}, {@link onBatchEnd}, {@link onHistoryChanged}
 */
export function generateActionName<S extends object>(
  action: ActionPayload<S> | ActionPayload<S>[] | null | undefined,
  storeName: string,
  context?: 'transaction' | 'batch' | 'history' | string
): string {
  // Handle explicit context overrides for plugin hooks
  if (context === 'transaction') {
    return `${storeName}/TRANSACTION`
  }
  if (context === 'batch') {
    const count = Array.isArray(action) ? action.length : 1
    return `${storeName}/BATCH[${count}]`
  }
  if (context === 'history') {
    return `${storeName}/HISTORY_CHANGE`
  }

  // Defensive: handle null, undefined, or non-object action
  if (!action || typeof action !== 'object') {
    return `${storeName}/EMPTY_UPDATE`
  }

  // If array, treat as batch
  if (Array.isArray(action)) {
    if (action.length === 0) {
      return `${storeName}/BATCH[0]`
    }
    // Try to summarize the batch
    const allKeys = action.flatMap(a => (a && typeof a === 'object' ? Object.keys(a) : []))
    const uniqueKeys = Array.from(new Set(allKeys.filter(k => !k.startsWith('__') && !k.startsWith('_'))))
    if (uniqueKeys.length === 0) {
      return `${storeName}/BATCH[${action.length}]_EMPTY`
    }
    if (uniqueKeys.length === 1) {
      return `${storeName}/BATCH[${action.length}]_SET_${uniqueKeys[0].toUpperCase()}`
    }
    return `${storeName}/BATCH[${action.length}]_BULK_UPDATE_${uniqueKeys.length}_FIELDS`
  }

  // Defensive: handle empty object
  const keys = Object.keys(action)
  if (keys.length === 0) {
    return `${storeName}/EMPTY_UPDATE`
  }

  // Check for special action markers first
  if ('__actionType' in action && typeof (action as any).__actionType === 'string') {
    return (action as any).__actionType
  }

  if ('__REDUX_DEVTOOLS_TIME_TRAVEL__' in action) {
    return `${storeName}/TIME_TRAVEL`
  }

  const changedKeys = keys.filter(key => !key.startsWith('__') && !key.startsWith('_'))

  if (changedKeys.length === 0) {
    return `${storeName}/EMPTY_UPDATE`
  }

  // Special handling for common patterns
  if (changedKeys.length === 1) {
    const key = changedKeys[0]
    const value = (action as any)[key]

    // Check for common action patterns
    if (key === 'mode' && typeof value === 'string') {
      return `${storeName}/SET_MODE_${value.toUpperCase()}`
    }

    if (key.endsWith('Count') && typeof value === 'number') {
      return `${storeName}/UPDATE_${key.toUpperCase()}`
    }

    return `${storeName}/SET_${key.toUpperCase()}`
  }

  // Group related updates
  const groupedUpdates = new Map<string, string[]>()

  for (const key of changedKeys) {
    const prefix =
      key
        .split(/(?=[A-Z])/) // split camelCase
        .shift()
        ?.toLowerCase() || 'misc'
    if (!groupedUpdates.has(prefix)) {
      groupedUpdates.set(prefix, [])
    }
    groupedUpdates.get(prefix)!.push(key)
  }

  if (groupedUpdates.size === 1) {
    const [prefix, keys] = Array.from(groupedUpdates.entries())[0]
    return `${storeName}/UPDATE_${prefix.toUpperCase()}_${keys.length}_FIELDS`
  }

  return `${storeName}/BULK_UPDATE_${changedKeys.length}_FIELDS`
}

/**
 * Checks if the Redux DevTools extension is available in the current environment.
 *
 * @returns True if the Redux DevTools extension is available, false otherwise.
 * @remarks
 * This function checks for the presence of the Redux DevTools browser extension.
 * @see {@link https://github.com/reduxjs/redux-devtools/tree/main/extension#api | Redux DevTools Extension API}
 */
export function isReduxDevToolsAvailable(): boolean {
  if (typeof window === 'undefined') return false
  return !!window.__REDUX_DEVTOOLS_EXTENSION__
}

/**
 * Helper API for enabling/disabling DevTools at runtime, checking status, and integrating with localStorage.
 *
 * @remarks
 * This object provides runtime control over DevTools, including enable/disable/reset and status queries.
 * It is designed to be compatible with the global DevTools config in appConfig.ts.
 *
 * @example
 * ```typescript
 * DevToolsHelper.enable();
 * DevToolsHelper.disable();
 * DevToolsHelper.reset();
 * const enabled = DevToolsHelper.enabled;
 * const available = DevToolsHelper.extensionAvailable;
 * const status = DevToolsHelper.getStatus();
 * ```
 */
export const DevToolsHelper = {
  /** Enable DevTools (persists to localStorage if available) */
  enable(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('DISABLE_DEVTOOLS', 'false')
      }
    } catch {}
  },

  /** Disable DevTools (persists to localStorage if available) */
  disable(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('DISABLE_DEVTOOLS', 'true')
      }
    } catch {}
  },

  /** Reset DevTools setting (removes from localStorage, will use defaults) */
  reset(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('DISABLE_DEVTOOLS')
      }
      if (typeof window !== 'undefined') {
        delete (window as any).__DISABLE_DEVTOOLS__
      }
    } catch {}
  },

  /** Whether DevTools is currently enabled (based on localStorage, env, or default) */
  get enabled(): boolean {
    // Simple logic: check localStorage, fallback to NODE_ENV
    try {
      if (typeof window !== 'undefined' && (window as any).__DISABLE_DEVTOOLS__ === true) {
        return false
      }
      if (typeof localStorage !== 'undefined') {
        const v = localStorage.getItem('DISABLE_DEVTOOLS')
        if (v === 'true') return false
        if (v === 'false') return true
      }
      // Fallback to NODE_ENV
      return (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') || false
    } catch {
      return false
    }
  },

  /** Whether the Redux DevTools browser extension is available */
  get extensionAvailable(): boolean {
    return isReduxDevToolsAvailable()
  },

  /**
   * Get status of DevTools enablement and extension availability.
   * @returns An object with enabled, extensionAvailable, and reason fields.
   */
  getStatus(): {
    enabled: boolean
    extensionAvailable: boolean
    reason: string
  } {
    let reason = ''
    let enabled = this.enabled
    let extensionAvailable = this.extensionAvailable
    if (!extensionAvailable) {
      reason = 'Redux DevTools extension not installed or not available.'
    } else if (!enabled) {
      reason = 'DevTools disabled by configuration (localStorage, env, or global flag).'
    } else {
      reason = 'DevTools enabled and extension available.'
    }
    return {enabled, extensionAvailable, reason}
  },
} as const

// Expose DevToolsHelper and isReduxDevToolsAvailable globally for debugging and runtime control
if (typeof window !== 'undefined') {
  ;(window as any).DevToolsHelper = DevToolsHelper
  ;(window as any).isReduxDevToolsAvailable = isReduxDevToolsAvailable
}
