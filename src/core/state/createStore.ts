import * as immer from 'immer'
import {Draft} from 'immer'
import {PluginManager} from '../../plugins/pluginManager'
import {MiddlewareError, StoreError, SyncError, TransactionError} from '../../shared/errors'
import {type DependencyListener, type DependencySubscriptionOptions, type Selector, SelectorManager} from '../selectors'
import {getClientSessionId} from '../storage/index'
import {deepEqual, getPath, isDevMode} from '../utils/index'
import {HistoryManager} from './HistoryManager'
import {PersistenceManager} from './persistenceManager'
import {storeRegistry} from './storeRegistry'
import {TypeRegistry} from './typeRegistry'
import {MiddlewareExecutor} from './middlewear'
import type {
  ActionPayload,
  CleanupOptions,
  Listener,
  PersistedState,
  ReadOnlyStore,
  Store,
  StoreOptions,
  Thunk,
} from './types'
import {StorageType} from './types'
import {cleanupStaleStates} from './utils'

// Enable Immer features for better performance and functionality
immer.enableMapSet()
immer.enablePatches()

/**
 * Creates a new store
 */
export function createStore<S extends object>(initialState: S, options: StoreOptions<S> = {}): Store<S> {
  let state = {...initialState}
  let listeners: Listener<S>[] = []
  let isDestroyed = false
  let batching = false
  let batchedActions: ActionPayload<S>[] = []
  let isInUpdatePath = false

  const {
    persistKey,
    middleware = [],
    historyLimit = 0,
    storageType = StorageType.None,
    syncAcrossTabs = false,
    cookieOptions = {},
    cookiePrefix = '__store_',
    name,
    staleAge = 30 * 24 * 60 * 60 * 1000, // 30 days
    cleanupStaleStatesOnLoad: shouldCleanupStaleStates = true,
    cleanupOptions: defaultCleanupOptions = {
      removePersistedState: false,
      clearHistory: true,
    },
    plugins = [],
    onError = err => console.error(`[Store: ${name || 'Unnamed'}] Error:`, err.message, err.context || ''),
  } = options

  const sessionId = getClientSessionId()

  const storeInstance: Store<S> = {} as Store<S>

  const selectorManager = new SelectorManager(storeInstance)

  const typeRegistry = new TypeRegistry()

  // --- Core Store Functions ---
  const handleError = (error: StoreError) => {
    // Call plugin onError hooks first
    pluginManager.onError(error, error.context, storeInstance)

    // Then call the store's onError callback
    if (onError) {
      onError(error)
    } else {
      // Use structured error logging, but do not duplicate consumer logs
      console.error(`[Store: ${name || 'Unnamed'}] Unhandled Store Error:`, {
        message: error.message,
        context: error.context,
        errorName: error.name,
      })
    }
  }

  const middlewareExecutor = new MiddlewareExecutor<S>(middleware, handleError)

  // Initialize persistence manager for handling state persistence
  const persistenceManager = new PersistenceManager<S>(
    storageType,
    typeRegistry,
    handleError,
    sessionId,
    cookieOptions,
    cookiePrefix,
    name
  )

  // Initialize plugin manager for consistent plugin lifecycle handling
  const pluginManager = new PluginManager<S>(plugins, handleError, name)

  function persistState(dataToPersist: S): void {
    const success = persistenceManager.persistState(persistKey, dataToPersist, pluginManager, storeInstance)
    if (!success && isDevMode()) {
      console.warn(
        `[Store: ${name || 'Unnamed'}] Failed to persist state. Check storage availability or configuration.`
      )
    }
  }

  /* Freeze helper – prevents accidental mutation in dev
     while keeping reference‑equality for memoisation. */
  const freezeDev = <T>(obj: T): T => (isDevMode() ? Object.freeze(obj) : obj)

  /**
   * Notifies listeners with immutable state copies to prevent accidental mutations.
   *
   * @param prevState - The previous state before changes
   * @param actionApplied - The action payload that was applied
   *
   * @remarks
   * This function ensures that listeners receive deeply immutable copies of state,
   * preventing accidental mutations while maintaining performance through selective
   * use of Immer only when deep immutability is needed.
   *
   * @see {@link https://immerjs.github.io/immer/produce | Immer produce documentation}
   */
  const notifyListeners = (prevState: S, actionApplied: ActionPayload<S> | null = null): void => {
    // Use Immer to create deeply immutable state copies for external consumption
    // This prevents listeners from accidentally mutating nested objects
    const safeCurrentState = immer.produce(state, () => {
      // Empty producer - just creates an immutable copy
    })
    const safePrevState = immer.produce(prevState, () => {
      // Empty producer - just creates an immutable copy
    })

    pluginManager.onStateChange(safeCurrentState, safePrevState, actionApplied, storeInstance)

    listeners.forEach(listener => {
      try {
        listener(safeCurrentState, safePrevState)
      } catch (e: any) {
        handleError(
          new StoreError('Listener invocation failed', {
            operation: 'notifyListeners',
            error: e,
          })
        )
      }
    })
  }

  // --- History Management ---
  let historyManager = new HistoryManager<S>(historyLimit, pluginManager)

  const _applyStateChange = (payload: ActionPayload<S>, fromSync = false): void => {
    if (isDestroyed) return

    const prevState = {...state}
    let newPartialState = payload

    // Plugin: beforeStateChange

    let transformed = pluginManager.beforeStateChange(newPartialState, prevState, storeInstance)
    if (transformed) {
      // If the plugin transformed the payload, use it
      newPartialState = transformed
    }

    /* 🏃‍♂️ Bail early if the payload is empty so we don’t burn cycles
       or generate useless listener notifications. */
    if (Object.keys(newPartialState).length === 0) return

    // Check if this is an updatePath operation that should preserve structural sharing
    if (isInUpdatePath) {
      // For updatePath, directly assign the state to preserve Immer's structural sharing

      //state = newPartialState as S
      state = immer.produce(state, draft => {
        Object.assign(draft, newPartialState)
      }) // Immer will handle structural sharing
    } else {
      // Normal case: merge the partial state
      //state = {...state, ...newPartialState} // Apply the changes
      state = immer.produce(state, draft => {
        // Use Immer to apply changes, ensureing that the partial state is applied immutably
        Object.assign(draft, newPartialState)
      })
    }

    // --- Notifications and History ---
    if (!fromSync && persistKey && storageType !== StorageType.None) {
      persistState(state)
    }

    historyManager.addToHistory(state) // Add new state to history for undo/redo
    notifyListeners(prevState, newPartialState) // Notify with the state *before* this change as prevState
  }

  const _internalDispatch = async (action: ActionPayload<S>, isChainedCall = false): Promise<void> => {
    if (isDestroyed) return
    if (typeof action !== 'object' || action === null) {
      handleError(
        new StoreError('Dispatched action payload must be an object.', {
          operation: '_internalDispatch',
          action,
        })
      )
      return
    }

    if (typeof action === 'object' && action !== null && '__REDUX_DEVTOOLS_TIME_TRAVEL__' in action) {
      // This is a DevTools time travel action, apply it directly without middleware
      const {actualPayload} = action as any
      _applyStateChange(actualPayload as ActionPayload<S>, false)
      return
    }

    if (batching && !isChainedCall) {
      batchedActions.push(action)
      return
    }

    await middlewareExecutor.execute(action, {...state}, storeInstance.getState, _applyStateChange, storeInstance.reset)
  }

  // --- Store Methods ---
  storeInstance.getState = () => {
    if (batching && batchedActions.length > 0) {
      // During batching, return the state with all batched actions applied
      const intermediateState = batchedActions.reduce((acc, curr) => ({...acc, ...curr}), state)
      return freezeDev(intermediateState as S)
    }
    // Always return a copy before freezing to prevent mutation issues with Immer
    return freezeDev(state)
  }

  storeInstance.dispatch = (action: ActionPayload<S> | Thunk<S, any>): void | Promise<any> => {
    if (isDestroyed) return
    if (typeof action === 'function') {
      try {
        const result = (action as Thunk<S, any>)(
          storeInstance.dispatch,
          storeInstance.getState,
          storeInstance.updatePath,
          storeInstance.transaction,
          storeInstance.batch
        )

        // If the thunk returns a promise, handle potential rejections
        if (result && typeof result === 'object' && typeof result.then === 'function') {
          return result.catch((e: any) => {
            handleError(
              new StoreError('Thunk execution failed', {
                operation: 'dispatchThunk',
                error: e,
                thunkName: action.name || 'anonymous',
              })
            )
            // Re-throw the error so the caller can still handle it
            throw e
          })
        }

        return result
      } catch (e: any) {
        handleError(
          new StoreError('Thunk execution failed', {
            operation: 'dispatchThunk',
            error: e,
            thunkName: action.name || 'anonymous',
          })
        )
      }
    } else if (typeof action === 'object' && action !== null) {
      const dispatchResult = _internalDispatch(action)
      // If _internalDispatch returns a promise (due to async middleware), return it
      if (dispatchResult && typeof dispatchResult.then === 'function') {
        return dispatchResult
      }
    } else {
      handleError(
        new StoreError('Invalid action dispatched. Must be an object or a thunk function.', {
          operation: 'dispatch',
          action,
        })
      )
    }
  }

  storeInstance.setState = (newState: Partial<S>) => {
    storeInstance.dispatch(newState) // setState is now an alias
  }

  storeInstance.subscribe = (listener: Listener<S>) => {
    listeners.push(listener)
    return () => {
      listeners = listeners.filter(l => l !== listener)
    }
  }

  storeInstance.subscribeTo = <T>(
    selector: Selector<S, T>,
    listener: DependencyListener<T>,
    options?: DependencySubscriptionOptions
  ): (() => void) => {
    if (isDestroyed) {
      console.warn(`[Store: ${name || 'Unnamed'}] Cannot create subscription on destroyed store`)
      return () => {} // Return no-op cleanup function
    }

    return selectorManager.createDependencySubscription(selector, listener, options)
  }

  storeInstance.subscribeToMultiple = <P extends Selector<S, any>[]>(
    selectors: readonly [...P],
    listener: (
      newValues: {
        [K in keyof P]: P[K] extends Selector<S, infer RT> ? RT : never
      },
      oldValues: {
        [K in keyof P]: P[K] extends Selector<S, infer RT> ? RT : never
      }
    ) => void,
    options?: DependencySubscriptionOptions
  ): (() => void) => {
    if (isDestroyed) {
      console.warn(`[Store: ${name || 'Unnamed'}] Cannot create multi-subscription on destroyed store`)
      return () => {} // Return no-op cleanup function
    }

    return selectorManager.createMultiDependencySubscription(
      selectors,
      listener as any, // Type assertion to fix the generic constraint issue
      options
    )
  }

  storeInstance.subscribeToPath = <T = any>(
    path: string,
    listener: DependencyListener<T>,
    options?: DependencySubscriptionOptions
  ): (() => void) => {
    if (isDestroyed) {
      console.warn(`[Store: ${name || 'Unnamed'}] Cannot create path subscription on destroyed store`)
      return () => {} // Return no-op cleanup function
    }

    return selectorManager.createPathSubscription(path, listener, options)
  }

  storeInstance.select = <R, P extends Selector<S, unknown>[]>(
    ...args:
      | [
          ...P,
          (
            ...results: {
              [K in keyof P]: P[K] extends Selector<S, infer RT> ? RT : never
            }
          ) => R,
        ]
      | [Selector<S, R>]
  ): (() => R) & {lastValue?: R} => {
    return selectorManager.createSelector(...args)
  }

  storeInstance.selectWith = <Props, R, P extends Selector<S, any>[]>(
    inputSelectors: readonly [...P],
    projector: (params: Props) => (
      ...results: {
        [K in keyof P]: P[K] extends Selector<S, infer RT> ? RT : never
      }
    ) => R
  ) => {
    return selectorManager.createParameterizedSelector(inputSelectors, projector)
  }

  storeInstance.reset = () => {
    if (isDestroyed) return
    const prevState = {...state} // Capture state before reset
    state = {...initialState}
    persistState(state)

    // Clear history when resetting the store
    historyManager.clear()

    // Add the initial state to history after reset
    historyManager.addToHistory(state)

    notifyListeners(prevState, null) // Notify with state before reset as prevState
  }

  storeInstance.undo = (steps = 1) => {
    const result = historyManager.undo({
      operation: 'undo',
      steps,
      store: storeInstance,
      oldState: state,
      newState: historyManager.getUndoState(steps) || state,
      persistFn: persistState,
      notifyFn: prevState => notifyListeners(prevState, null),
    })
    if (result === false) return false
    state = result // Update the store's state
    return true
  }

  storeInstance.redo = (steps = 1) => {
    const result = historyManager.redo({
      operation: 'redo',
      steps,
      oldState: state,
      newState: historyManager.getRedoState(steps) || state,
      store: storeInstance,
      persistFn: persistState,
      notifyFn: prevState => notifyListeners(prevState, null),
    })

    if (result !== false) {
      state = result // Update the store's state
      return true
    }
    return false
  }

  storeInstance.updatePath = <V = any>(path: (string | number)[], updater: (currentValue: V) => V) => {
    if (isDestroyed) return

    // Use Immer to safely update the path with automatic structural sharing
    const nextState = immer.produce(state, draft => {
      // Navigate to the parent of the target path
      let current: any = draft

      // Navigate to the parent object/array
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i]
        if (current[key] === undefined || current[key] === null) {
          // Auto-create missing intermediate objects/arrays
          const nextKey = path[i + 1]
          current[key] = typeof nextKey === 'number' ? [] : {}
        }
        current = current[key]
      }

      // Get the final key and current value
      const finalKey = path[path.length - 1]
      const currentValue = current[finalKey] as V

      // Apply the updater function
      const newValue = updater(currentValue)

      // Only update if the value actually changed
      if (!Object.is(currentValue, newValue)) {
        current[finalKey] = newValue
      }
    })

    // Only dispatch if state actually changed (Immer provides reference equality)
    if (nextState !== state) {
      if (batching) {
        // During batching, use minimal diff to avoid state replacement conflicts
        const diff = buildMinimalDiff(nextState, path)
        _internalDispatch(diff, false)
      } else {
        // For non-batched operations, use flag to preserve structural sharing
        // and dispatch the complete state to provide full context to plugins
        const currentUpdatePathFlag = isInUpdatePath
        isInUpdatePath = true

        try {
          _internalDispatch(nextState as ActionPayload<S>, false)
        } finally {
          isInUpdatePath = currentUpdatePathFlag
        }
      }
    }
  }

  storeInstance.getHistory = (): {
    history: readonly S[]
    currentIndex: number
    initialState: Readonly<S> | null
  } => {
    if (historyLimit) return historyManager.getHistory()
    return {
      history: [],
      currentIndex: -1,
      initialState: null,
    }
  }

  /**
   * Builds a minimal diff object containing only the changed path with sibling properties preserved.
   *
   * @param newState - The new state after update
   * @param path - The path that was updated
   * @returns A minimal object containing the changed nested structure with siblings
   */
  function buildMinimalDiff<S extends object>(newState: S, path: (string | number)[]): Partial<S> {
    const diff: any = {}
    let currentDiff: any = diff
    let currentState: any = newState

    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i]

      // Get the full object/array at this level from newState to preserve siblings
      const fullObjectAtLevel = currentState[key]

      if (Array.isArray(fullObjectAtLevel)) {
        currentDiff[key] = [...fullObjectAtLevel]
      } else if (fullObjectAtLevel && typeof fullObjectAtLevel === 'object') {
        currentDiff[key] = {...fullObjectAtLevel}
      } else {
        currentDiff[key] = fullObjectAtLevel
      }

      currentDiff = currentDiff[key]
      currentState = currentState[key]
    }

    // Set the final changed value
    currentDiff[path[path.length - 1]] = getPath(newState, path)
    return diff
  }

  storeInstance.batch = (fn: () => void) => {
    if (isDestroyed) return
    if (batching) {
      fn()
      return
    }

    batching = true
    batchedActions = []

    // Call onBatchStart for all plugins
    pluginManager.onBatchStart(storeInstance)

    try {
      fn()

      if (batchedActions.length > 0) {
        const combinedAction = batchedActions.reduce((acc, curr) => ({...acc, ...curr}), {})

        if (Object.keys(combinedAction).length) {
          // Call _internalDispatch but don't await since batch is synchronous
          // Use the result for potential future async handling
          const result = _internalDispatch(combinedAction, true)
          if (result instanceof Promise) {
            result.catch(error => {
              // Handle async middleware errors
              console.warn('Async middleware error in batch:', error)
            })
          }
          // If there's async middleware, we can't wait for it in a sync function
          // but the middleware will still execute asynchronously
        }
      }

      // Call onBatchEnd for all plugins with success
      const finalState = state // Current state after all actions applied
      pluginManager.onBatchEnd(batchedActions, finalState, storeInstance)
    } catch (e: any) {
      // Store the batched actions before clearing for error reporting
      const failedBatchedActions = [...batchedActions]
      handleError(
        new StoreError('Batch execution failed', {
          operation: 'batch',
          error: e,
          failedActions: failedBatchedActions,
          actionCount: failedBatchedActions.length,
        })
      )

      // Call onBatchEnd for all plugins even on failure
      // Pass empty array for actions since they weren't applied
      for (const plugin of plugins) {
        try {
          plugin.onBatchEnd?.([], state, storeInstance)
        } catch (pluginError: any) {
          handleError(
            new MiddlewareError(`Plugin ${plugin.name}.onBatchEnd failed after batch error`, {
              error: pluginError,
              pluginName: plugin.name,
              operation: 'onBatchEnd',
              originalError: e,
            })
          )
        }
      }
    } finally {
      batching = false
      batchedActions = []
    }
  }

  storeInstance.transaction = (recipe: (draft: Draft<S>) => void): boolean => {
    if (isDestroyed) {
      return false
    }

    let transactionError: Error | undefined

    // Call onTransactionStart for all plugins
    pluginManager.onTransactionStart(storeInstance)

    try {
      /**
       * Use Immer's produce to create a safe draft that can be mutated.
       * Important: Use the unfrozen `state` variable directly, not `getState()`,
       * since getState() returns a frozen copy which Immer cannot use as a base.
       * Immer will automatically create a new immutable state if any changes are made,
       * or return the original state if no changes occurred.
       */
      const nextState = immer.produce(state, recipe)

      // Only proceed if state actually changed (Immer provides reference equality check)
      if (nextState !== state) {
        // Use _internalDispatch to go through the full middleware/plugin flow
        _internalDispatch(nextState as ActionPayload<S>, false)
      } else {
        // No changes were made, but transaction was successful
        // TODO: add a logger that i can disable in production
        // eslint-disable-next-line no-console
        if (typeof console !== 'undefined' && console.debug) {
          // eslint-disable-next-line no-console
          console.debug(`[Store: ${name || 'Unnamed'}] Transaction completed with no state changes.`, {
            operation: 'transaction',
          })
        }
      }

      // Call onTransactionEnd for all plugins with success
      pluginManager.onTransactionEnd(true, storeInstance, nextState !== state ? (nextState as Partial<S>) : undefined)

      return true
    } catch (e: any) {
      transactionError = e

      handleError(
        new TransactionError('Transaction function encountered an exception.', {
          operation: 'transaction',
          error: e,
        })
      )

      // Call onTransactionEnd for all plugins with failure
      pluginManager.onTransactionEnd(false, storeInstance, undefined, transactionError)

      return false
    }
  }

  storeInstance.destroy = (options?: CleanupOptions) => {
    if (isDestroyed) return
    const cleanupOpts = {...defaultCleanupOptions, ...options}
    isDestroyed = true

    selectorManager.destroyAll()

    pluginManager.onDestroy(storeInstance)

    listeners = []
    if (cleanupOpts.clearHistory) historyManager.clear()
    if (cleanupOpts.removePersistedState) persistenceManager.removeState(persistKey)

    // Unregister from global registry
    if (sessionId && storeRegistry.has(sessionId)) {
      const storeSet = storeRegistry.get(sessionId)!
      storeSet.delete(storeInstance as Store<object>)
      if (storeSet.size === 0) {
        storeRegistry.delete(sessionId)
      }
    }

    if (cleanupOpts.resetRegistry) {
      // Reset the global store registry if requested
      storeRegistry.clear()
    }
  }

  storeInstance.getName = () => name
  storeInstance.getSessionId = () => sessionId

  storeInstance.asReadOnly = (): ReadOnlyStore<S> => {
    return {
      getState: storeInstance.getState,
      subscribe: storeInstance.subscribe,
      subscribeTo: storeInstance.subscribeTo,
      subscribeToMultiple: storeInstance.subscribeToMultiple,
      subscribeToPath: storeInstance.subscribeToPath,
      select: storeInstance.select,
      getName: storeInstance.getName,
      getSessionId: storeInstance.getSessionId,
      getHistory: storeInstance.getHistory,
    }
  }

  /**
   * Internal method for Redux DevTools to set state directly without going through dispatch.
   * This bypasses middleware and plugins to prevent infinite loops during time travel.
   * Audits and sanitizes the input to ensure the types and structure match the expected state.
   *
   * @param newState - The new state to set
   * @param isTimeTravel - Whether this is a time travel operation (defaults to true)
   */
  storeInstance._setStateForDevTools = (newState: S, isTimeTravel = true) => {
    if (isDestroyed) return

    const prevState = {...state}

    // --- Audit and sanitize the input state ---
    let sanitizedState: S = {...newState}

    // If the current state contains any complex types registered in TypeRegistry,
    // attempt to restore them in the new state as well.
    // This helps ensure that Sets, Maps, etc., are not accidentally replaced with plain objects/arrays.
    const auditAndSanitize = (expected: any, input: any): any => {
      // If expected is a registered complex type, try to coerce input to that type
      const typeDef = typeRegistry.findTypeFor(expected)
      if (typeDef && !typeRegistry.findTypeFor(input)) {
        // If input is not already the correct type, try to deserialize it
        try {
          // If input looks like a serialized form, try to use the typeDef's deserialize
          if (input && typeof input === 'object' && '__type' in input && input.__type === typeDef.typeName) {
            return typeDef.deserialize(input.data)
          }
          // Otherwise, try to serialize and then deserialize to coerce
          return typeDef.deserialize(typeDef.serialize(input))
        } catch {
          // Fallback to input as-is if coercion fails
          return input
        }
      }

      // If both are arrays, recursively audit each element
      if (Array.isArray(expected) && Array.isArray(input)) {
        return input.map((item, idx) => auditAndSanitize(expected[idx], item))
      }

      // If both are plain objects, recursively audit each property
      if (expected && typeof expected === 'object' && input && typeof input === 'object') {
        const result: Record<string, any> = {...input}
        for (const key of Object.keys(expected)) {
          if (key in input) {
            result[key] = auditAndSanitize(expected[key], input[key])
          }
        }
        return result
      }

      // Otherwise, return input as-is
      return input
    }

    sanitizedState = auditAndSanitize(state, newState)

    state = {...sanitizedState}

    // Persist the new state if needed
    if (persistKey && storageType !== StorageType.None) {
      persistState(state)
    }

    // Skip history tracking for time travel operations
    if (!isTimeTravel && historyLimit > 0) {
      historyManager.addToHistory(state)
    }

    // Notify listeners but indicate this is a DevTools operation
    notifyListeners(prevState, null)
  }

  // Add a public method to manually trigger selector cleanup
  ;(storeInstance as any).cleanupSelectors = () => {
    return selectorManager.cleanupSelectors()
  }

  // Add debugging methods (internal use)
  ;(storeInstance as any)._getDependencySubscriptionCount = () => {
    return selectorManager.getDependencySubscriptionCount()
  }
  ;(storeInstance as any)._cleanupDependencySubscriptions = () => {
    return selectorManager.cleanupDependencySubscriptions()
  }

  // --- Initialization ---
  if (shouldCleanupStaleStates) {
    cleanupStaleStates(staleAge, cookiePrefix)
  }

  const savedState = persistenceManager.loadState(persistKey, staleAge, pluginManager, storeInstance)
  if (savedState) {
    //state = { ...state, ...savedState };
    _internalDispatch(savedState as ActionPayload<S>, false) // allow plugins/middleware to process the loaded state
  }

  // Initialize history with the current state
  if (historyLimit > 0) {
    historyManager.addToHistory(state)
  }

  // Cross-tab sync
  if (syncAcrossTabs && storageType === StorageType.Local && persistKey) {
    const storageEventHandler = (event: StorageEvent) => {
      if (event.key === persistKey && event.newValue && !isDestroyed) {
        try {
          const persisted = JSON.parse(event.newValue) as PersistedState<S>
          // Ensure this update isn't from the current session to avoid loops

          // And only apply if state truly differs to prevent redundant notifications
          if (persisted.meta && persisted.meta.sessionId !== sessionId && !deepEqual(state, persisted.data)) {
            let stateToApply = persisted.data

            // Call plugin onCrossTabSync hooks
            const transformed = pluginManager.onCrossTabSync(
              stateToApply,
              persisted.meta.sessionId || 'unknown',
              storeInstance
            )
            if (transformed) {
              // If the plugin transformed the state, use it
              stateToApply = transformed
            }

            // _applyStateChange will capture the current `state` as its `prevState`
            _applyStateChange(stateToApply, true)
          }
        } catch (e: any) {
          handleError(
            new SyncError('Failed to sync state from another tab', {
              error: e,
              key: persistKey,
            })
          )
        }
      }
    }
    window.addEventListener('storage', storageEventHandler)
    // Need to also clean this listener up in destroy()
    const originalDestroy = storeInstance.destroy
    storeInstance.destroy = (opts?: CleanupOptions) => {
      window.removeEventListener('storage', storageEventHandler)
      originalDestroy(opts)
    }
  }

  // Register store
  if (sessionId) {
    if (!storeRegistry.has(sessionId)) {
      storeRegistry.set(sessionId, new Set())
    }
    storeRegistry.get(sessionId)!.add(storeInstance as Store<object>)
  }

  // Call onStoreCreate for plugins
  pluginManager.onStoreCreate(storeInstance)

  // Initial state persistence if key provided and no saved state (or saved state was stale and removed)
  if (persistKey && !savedState) {
    persistState(state)
  }

  return storeInstance
}

export default createStore
