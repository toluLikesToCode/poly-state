import * as immer from 'immer'
import {Draft} from 'immer'
import {PluginManager} from '../../plugins/pluginManager'
import {
  MiddlewareError,
  StoreError,
  SyncError,
  TransactionError,
  withErrorRecovery,
  StorageUnavailableError,
  StorageQuotaExceededError,
} from '../../shared/errors'
import {
  type DependencyListener,
  type DependencySubscriptionOptions,
  type Selector,
  SelectorManager,
} from '../selectors'
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
  EnhancedPathUpdater,
  Listener,
  PersistedState,
  ReadOnlyStore,
  Store,
  StoreOptions,
  Thunk,
} from './state-types/types'
import {StorageType} from './state-types/types'
import {assignState, cleanupStaleStates} from './utils'
import {PathValue, PathsOf} from './state-types/path-types'

// Enable Immer features for better performance and functionality
immer.enableMapSet()
immer.enablePatches()

/**
 * Creates a new store
 */
export function createStore<S extends object>(
  initialState: S,
  options: StoreOptions<S> = {}
): Store<S> {
  let state = assignState({} as S, initialState) as S // Ensure state is a copy of initialState
  let listeners: Listener<S>[] = []
  let isDestroyed = false
  let batching = false
  let batchedActions: ActionPayload<S>[] = []

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
    onError = err =>
      console.error(`[Store: ${name || 'Unnamed'}] Error:`, err.message, err.context || ''),
  } = options

  const sessionId = getClientSessionId()

  const storeInstance: Store<S> = {} as Store<S>

  const selectorManager = new SelectorManager(storeInstance)

  const typeRegistry = new TypeRegistry()

  // --- Core Store Functions ---
  const handleError = (error: StoreError) => {
    // Custom Immer mutation error detection
    if (
      error.context?.error &&
      error.context.error instanceof Error &&
      typeof error.context.error.message === 'string' &&
      error.context.error.message.includes('frozen and should not be mutated')
    ) {
      console.error(
        `[Poly State] State mutation error: You attempted to directly mutate a frozen object (e.g., Map, Set, Array, or plain object) returned from getState().\n` +
          `State objects are immutable and must not be mutated. To update state, always create a new object or use the store's transaction API.\n` +
          `\nExample fixes:\n` +
          `  // Instead of mutating:\n` +
          `  const map = store.getState().map;\n` +
          `  map.clear(); // ❌ This will throw\n\n` +
          `  // Option 1: Create a new Map and dispatch it:\n` +
          `  const newMap = new Map(map);\n` +
          `  newMap.clear();\n` +
          `  store.dispatch({ map: newMap }); // ✅\n\n` +
          `  // Option 2 (Recommended): Use store.transaction for safe mutation:\n` +
          `  store.transaction(draft => {\n` +
          `    draft.map?.clear(); // ✅\n` +
          `  });\n`
      )

      // Re-throw a more user-friendly error
      throw new StoreError(
        'Direct mutation of state is not allowed. Use store.dispatch to update state.',
        {
          operation: 'handleError',
          error: error.context.error,
          context: error.context, // Preserve original context for debugging
        }
      )
    }

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
    if (!persistKey || storageType === StorageType.None) return

    try {
      const success = persistenceManager.persistState(
        persistKey,
        dataToPersist,
        pluginManager,
        storeInstance
      )
      if (!success && isDevMode()) {
        console.warn(
          `[Store: ${name || 'Unnamed'}] Failed to persist state. Check storage availability or configuration.`
        )
      }
    } catch (error) {
      if (error instanceof StorageQuotaExceededError) {
        handleError(
          new StoreError('Storage quota exceeded during persist', {
            operation: 'persistState',
            error,
            storageType,
            persistKey,
          })
        )
        // Optionally trigger cleanup or notify user
      } else if (error instanceof StorageUnavailableError) {
        handleError(
          new StoreError('Storage unavailable during persist', {
            operation: 'persistState',
            error,
            storageType,
            persistKey,
          })
        )
      } else {
        handleError(
          new StoreError('Unexpected error during persist', {
            operation: 'persistState',
            error,
            storageType,
            persistKey,
          })
        )
      }
    }
  }

  /* Freeze helper – prevents accidental mutation in dev
     while keeping reference‑equality for memoisation. */
  const freezeDev = <T>(obj: T): T => (true ? Object.freeze(obj) : obj)
  // const freezeDev = <T>(obj: T): T => (isDevMode() ? Object.freeze(obj) : obj)

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
    // Create safe immutable copies while preserving structural sharing for unchanged properties
    const safeCurrentState = assignState(state, state) as S

    // For prevState, create a copy that preserves structural sharing with currentState
    // for properties that weren't modified
    let safePrevState: S
    if (actionApplied && Object.keys(actionApplied).length > 0) {
      // Build prevState copy with selective structural sharing
      safePrevState = immer.produce(prevState, draft => {
        // For each property not in the action, try to preserve the reference
        // from the current state if the values are equivalent
        for (const key in state) {
          if (!(key in actionApplied)) {
            const currentValue = (state as any)[key]
            const prevValue = (prevState as any)[key]

            // If the values are the same reference (unchanged), use the safe current value
            if (currentValue === prevValue) {
              ;(draft as any)[key] = (safeCurrentState as any)[key]
            }
          }
        }
      }) as S
    } else {
      safePrevState = assignState(prevState, prevState) as S
    }

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
  let historyManager = new HistoryManager<S>(historyLimit, pluginManager, initialState)

  const _applyStateChange = (payload: ActionPayload<S>, fromSync = false): void => {
    if (isDestroyed) return

    // Capture the current state reference (not a copy) for comparison
    const prevState = state
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

    // Apply the new state change while preserving structural sharing
    // Use shallow merge to preserve references for unchanged root-level keys
    // only update if something actually changed
    // const nextState = {...state, ...newPartialState} as S
    const nextState = assignState(state, newPartialState)

    // const nextState = immer.produce(state, draft => {
    //   for (const key in newPartialState) {
    //     if (Object.prototype.hasOwnProperty.call(newPartialState, key)) {
    //       // Immer will handle structural sharing automatically
    //       ;(draft as any)[key] = newPartialState[key]
    //     }
    //   }
    // })

    if (Object.is(nextState, state)) return // No changes, exit early
    state = nextState

    // --- Notifications and History ---
    if (!fromSync && persistKey && storageType !== StorageType.None) {
      persistState(state)
    }

    historyManager.addToHistory(state) // Add state to history for undo/redo
    notifyListeners(prevState, newPartialState) // Notify with the state *before* this change as prevState
  }

  const _internalDispatch = async (
    action: ActionPayload<S>,
    isChainedCall = false
  ): Promise<void> => {
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

    if (
      typeof action === 'object' &&
      action !== null &&
      '__REDUX_DEVTOOLS_TIME_TRAVEL__' in action
    ) {
      // This is a DevTools time travel action, apply it directly without middleware
      const {actualPayload} = action as any
      _applyStateChange(actualPayload as ActionPayload<S>, false)
      return
    }

    if (batching && !isChainedCall) {
      // TODO: Decide if history manager should include the internals of a batch in history or
      // just the final accumulation
      batchedActions.push(action)
      return
    }

    await middlewareExecutor.execute(
      action,
      assignState(state, state) as S, // Use a copy of the current state
      storeInstance.getState,
      _applyStateChange,
      storeInstance.reset
    )
  }

  // --- Store Methods ---
  storeInstance.getState = () => {
    if (batching && batchedActions.length > 0) {
      // During batching, return the state with all batched actions applied to the current state
      const intermediateState = batchedActions.reduce(
        (acc, curr) => assignState(acc as S, curr),
        state as S
      )
      return freezeDev(intermediateState) as S
    }
    // Return a safe immutable copy that preserves structural sharing
    return freezeDev(state) as S
  }

  storeInstance.dispatch = (action: ActionPayload<S> | Thunk<S, any>): void | Promise<any> => {
    if (isDestroyed) return
    if (typeof action === 'function') {
      try {
        const result = (action as Thunk<S, any>)({
          dispatch: storeInstance.dispatch,
          getState: storeInstance.getState,
          updatePath: storeInstance.updatePath,
          transaction: storeInstance.transaction,
          batch: storeInstance.batch,
        })

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
        3

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
      console.warn(
        `[Store: ${name || 'Unnamed'}] Cannot create multi-subscription on destroyed store`
      )
      return () => {} // Return no-op cleanup function
    }

    return selectorManager.createMultiDependencySubscription(
      selectors,
      listener as any, // Type assertion to fix the generic constraint issue
      options
    )
  }

  storeInstance.subscribeToPath = <T = any>(
    path: string | (string | number)[],
    listener: DependencyListener<T>,
    options?: DependencySubscriptionOptions
  ): (() => void) => {
    if (isDestroyed) {
      console.warn(
        `[Store: ${name || 'Unnamed'}] Cannot create path subscription on destroyed store`
      )
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

  storeInstance.reset = (clearHistory: boolean = true) => {
    if (isDestroyed) return
    const prevState = assignState(state, state) as S // Capture state before reset

    // use immer to reset the state to the initial state
    state = assignState({} as S, initialState)
    persistState(state)

    // Clear history when resetting the store
    if (clearHistory) {
      historyManager.clear(true)
    } else {
      historyManager.addToHistory(initialState) // Add initial state to history if not clearing
    }

    notifyListeners(prevState, null) // Notify with state before reset as prevState
  }

  storeInstance.undo = (steps: number = 1, path?: (string | number)[]) => {
    const prevState = {...state}
    const result = historyManager.undo({
      operation: 'undo',
      steps,
      store: storeInstance,
      oldState: state,
      newState: historyManager.getUndoState(steps) || state,
      persistFn: persistState,
    })
    if (result === false) return false

    if (path) {
      //@ts-ignore
      if (false === true) {
        // if (path.length > 1) {
        //const pathSubLevel = path.slice(1)
        const subValue = getPath(result, path)
        const diff = buildMinimalDiff(subValue, path)
        state = assignState(state, diff) // Update only the sub-path
        return true
      } else {
        const diff = buildMinimalDiff(result, path)
        state = assignState(state, diff)
        return true
      }
    }

    state = assignState(state, result) // Update the store's state, ensuring reference equality
    notifyListeners(prevState, null) // Notify with the state before undo as prevState
    return true
  }

  storeInstance.redo = (steps = 1, path?: (string | number)[]) => {
    const prevState = {...state}
    const result = historyManager.redo({
      operation: 'redo',
      steps,
      oldState: state,
      newState: historyManager.getRedoState(steps) || state,
      store: storeInstance,
      persistFn: persistState,
    })

    if (result === false) return false

    if (path) {
      const diff = buildMinimalDiff(result, path)
      state = assignState(state, diff)
      return true
    }

    state = assignState(state, result) // Update the store's state, ensuring reference equality
    notifyListeners(prevState, null) // Notify with the state before redo as prevState
    return true
  }

  // Enhanced updatePath with multiple overloads for different type safety levels
  storeInstance.updatePath = (<const P extends PathsOf<S>>(
    path: P,
    updater: PathValue<S, P> extends infer V
      ? V extends never
        ? never
        : EnhancedPathUpdater<V>
      : never
  ) => {
    if (isDestroyed) return

    // // Validate path is not empty
    // if (!Array.isArray(path) || path.length === 0) {
    //   handleError(
    //     new StoreError('updatePath requires a non-empty path array', {
    //       operation: 'updatePath',
    //       path,
    //     })
    //   )
    //   return
    // }

    // Use Immer to safely update the path with automatic structural sharing
    // During batching, use the virtual state that includes batched changes
    const baseState =
      batching && batchedActions.length > 0
        ? batchedActions.reduce((acc, curr) => assignState(acc as S, curr), state)
        : state

    const nextState = immer.produce(baseState, draft => {
      // Navigate to the parent of the target path
      let current: any = draft

      // Navigate to the parent object/array with better error handling
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i]

        if (current[key] === undefined) {
          // Auto-create missing intermediate objects/arrays based on next key type
          const nextKey = path[i + 1]
          current[key] = typeof nextKey === 'number' ? [] : {}
        } else if (
          current[key] === null ||
          (typeof current[key] !== 'object' && typeof current[key] !== 'function')
        ) {
          // Cannot navigate through null or non-object values
          handleError(
            new StoreError('Cannot navigate through non-object value in path', {
              operation: 'updatePath',
              path,
              pathIndex: i + 1,
              currentValue: current[key],
            })
          )
          return // Exit the produce function early
        }

        current = current[key]
      }

      // Get the final key and current value
      const finalKey = path[path.length - 1]
      const currentValue = current[finalKey]

      try {
        // Apply the updater function with proper type handling
        let newValue: any
        if (typeof updater === 'function') {
          newValue = (updater as Function)(currentValue)
        } else {
          newValue = updater
        }

        // Handle deletion (undefined means delete)
        if (newValue === undefined) {
          if (Array.isArray(current)) {
            // For arrays, remove the element at the index
            if (typeof finalKey === 'number' && finalKey >= 0 && finalKey < current.length) {
              current.splice(finalKey, 1)
            }
          } else {
            // For objects, delete the property using Immer's approach
            delete current[finalKey]
          }
        } else if (newValue !== currentValue) {
          // Only assign if the returned value is different from the current value
          // This prevents overwriting in-place mutations
          current[finalKey] = newValue
        }
        // If newValue === currentValue, the updater function likely mutated in place
        // and we don't need to assign anything
      } catch (error: any) {
        handleError(
          new StoreError('Updater function threw an error', {
            operation: 'updatePath',
            path,
            currentValue,
            error: {
              message: error?.message || 'Unknown error',
              stack: error?.stack || 'No stack trace available',
              context: error?.context || {},
            },
          })
        )
      }
    })

    // Only dispatch if state actually changed (Immer provides reference equality)
    if (nextState !== baseState) {
      // Always build and dispatch the minimal diff, respecting batching
      const diff = buildMinimalDiff(nextState, path as unknown as (string | number)[])
      _internalDispatch(diff, false)
    }
  }) as any

  storeInstance.getHistory = (): {
    history: readonly S[]
    currentIndex: number
    initialState: Readonly<S> | null
  } => {
    if (historyLimit) return historyManager.getHistory()
    return {
      history: [] as readonly S[],
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

    // For the final level, get the entire value at the path from newState
    const finalKey = path[path.length - 1]
    const finalValue = getPath(newState, path)

    // Always set the final value from newState, which includes any mutations
    // made by the updater function (including deletions)
    currentDiff[finalKey] = finalValue

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
      const finalState = assignState({} as S, state) // Current state after all actions applied
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
          plugin.onBatchEnd?.([], assignState({} as S, state), storeInstance)
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
        // Find the changed paths (for now, we assume root-level keys changed)
        // For more advanced diffing, we should use/make a utility to find all changed paths
        // though this could be expensive for large states.
        // Here, we build a minimal diff for all changed root keys
        const diff: Partial<S> = {}
        for (const key in nextState) {
          if (!Object.is(state[key], nextState[key])) {
            diff[key] = nextState[key]
          }
        }
        // Use _internalDispatch to go through the full middleware/plugin flow
        _internalDispatch(diff as ActionPayload<S>, false)
      }

      // Call onTransactionEnd for all plugins with success
      pluginManager.onTransactionEnd(
        true,
        storeInstance,
        nextState !== state ? (nextState as Partial<S>) : undefined
      )

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

    const prevState = assignState(state, state) // Capture state before change

    // --- Audit and sanitize the input state ---
    let sanitizedState: S = immer.produce(newState, () => {})

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
          if (
            input &&
            typeof input === 'object' &&
            '__type' in input &&
            input.__type === typeDef.typeName
          ) {
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

    state = assignState(state, sanitizedState, typeRegistry) as S

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

  // Create a promise to track state loading completion
  let stateLoadingComplete: Promise<void> = Promise.resolve()

  const savedStatePromise = persistenceManager.loadStateAsync(
    persistKey,
    staleAge,
    pluginManager,
    storeInstance
  )

  // Handle Promise savedState
  if (typeof (savedStatePromise as any)?.then === 'function') {
    stateLoadingComplete = (savedStatePromise as Promise<Partial<S> | null>)
      .then(resolvedState => {
        if (resolvedState) {
          _internalDispatch(resolvedState as ActionPayload<S>, false)
        }
      })
      .catch(error => {
        handleError(
          new StoreError('Failed to load persisted state', {
            operation: 'loadStateAsync',
            error,
            persistKey,
          })
        )
      })
  }

  // Initialize history with the current state
  if (historyLimit > 0) {
    historyManager.addToHistory(state)
  }

  function storageEventHandler(event: StorageEvent) {
    if (event.key === persistKey && event.newValue && !isDestroyed) {
      withErrorRecovery(
        async () => {
          const persisted = JSON.parse(event.newValue!) as PersistedState<S>
          // Ensure this update isn't from the current session to avoid loops
          // And only apply if state truly differs to prevent redundant notifications
          if (
            persisted.meta &&
            persisted.meta.sessionId !== sessionId &&
            !deepEqual(state, persisted.data)
          ) {
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
        },
        {
          maxRetries: 2,
          retryDelay: 100,
          onRetry: (attempt, error) => {
            console.warn(`[Store] Cross-tab sync retry ${attempt}:`, error.message)
          },
        }
      ).catch(error => {
        handleError(
          new SyncError('Failed to sync state from another tab after retries', {
            error,
            key: persistKey,
          })
        )
      })
    }
  }

  // Cross-tab sync
  if (syncAcrossTabs && storageType === StorageType.Local && persistKey)
    window.addEventListener('storage', storageEventHandler)

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

    window.removeEventListener('storage', storageEventHandler)
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
  if (persistKey && !savedStatePromise) {
    persistState(state)
  }

  // Add utility methods to check and wait for state loading completion
  ;(storeInstance as any)._waitForStateLoad = () => stateLoadingComplete
  ;(storeInstance as any)._isStateLoading = () => {
    let isLoading = true
    stateLoadingComplete
      .then(() => {
        isLoading = false
      })
      .catch(() => {
        isLoading = false
      })
    return isLoading
  }

  // Add public method to wait for state loading completion
  storeInstance.waitForStateLoad = () => stateLoadingComplete

  return storeInstance
}

export default createStore
