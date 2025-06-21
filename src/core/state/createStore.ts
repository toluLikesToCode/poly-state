import * as immer from "immer";
import { Draft } from "immer";
import {
  MiddlewareError,
  PersistenceError,
  StoreError,
  SyncError,
  TransactionError,
} from "../../shared/errors";
import {
  type DependencyListener,
  type DependencySubscriptionOptions,
  type Selector,
  SelectorManager,
} from "../selectors";
import {
  getClientSessionId,
  getCookie,
  getLocalStorage,
  getSessionStorage,
  isLocalStorageAvailable,
  isSessionStorageAvailable,
  removeCookie,
  removeLocalStorage,
  removeSessionStorage,
  setCookie,
  setLocalStorage,
  setSessionStorage,
} from "../storage/index";
import { deepEqual, getPath, isDevMode } from "../utils/index";
import type {
  ActionPayload,
  CleanupOptions,
  historyChangePluginOptions,
  Listener,
  PersistedState,
  ReadOnlyStore,
  Store,
  StoreOptions,
  Thunk,
} from "./types";
import { StorageType } from "./types";
import { cleanupStaleStates } from "./utils";
import { TypeRegistry } from "./typeRegistry";
import { storeRegistry } from "./storeRegistry";
immer.enableMapSet();

/**
 * Creates a new store
 */
export function createStore<S extends object>(
  initialState: S,
  options: StoreOptions<S> = {}
): Store<S> {
  let state = { ...initialState };
  let listeners: Listener<S>[] = [];
  let history: S[] = [];
  let historyIndex = -1;
  let isHistoryMutation = false;
  let isDestroyed = false;
  let batching = false;
  let batchedActions: ActionPayload<S>[] = [];
  let isInUpdatePath = false;

  const {
    persistKey,
    middleware = [],
    historyLimit = 0,
    storageType = StorageType.None,
    syncAcrossTabs = false,
    cookieOptions = {},
    cookiePrefix = "__store_",
    name,
    staleAge = 30 * 24 * 60 * 60 * 1000,
    cleanupStaleStatesOnLoad: shouldCleanupStaleStates = true,
    cleanupOptions: defaultCleanupOptions = {
      removePersistedState: false,
      clearHistory: true,
    },
    plugins = [],
    onError = err =>
      console.error(
        `[Store: ${name || "Unnamed"}] Error:`,
        err.message,
        err.context || ""
      ),
  } = options;

  const sessionId = getClientSessionId();
  const storeInstance: Store<S> = {} as Store<S>;

  const selectorManager = new SelectorManager(storeInstance);

  const typeRegistry = new TypeRegistry();

  // --- Core Store Functions ---
  const handleError = (error: StoreError) => {
    // Call plugin onError hooks
    for (const plugin of plugins) {
      try {
        plugin.onError?.(
          error,
          error.context || { operation: "unknown" },
          storeInstance
        );
      } catch (pluginError: any) {
        // Prevent infinite recursion by not calling handleError again
        console.error(
          `[Store: ${name || "Unnamed"}] Plugin ${plugin.name}.onError failed:`,
          {
            originalError: error.message,
            pluginError: pluginError.message || String(pluginError),
          }
        );
      }
    }

    if (onError) {
      onError(error);
    } else {
      // Use structured error logging, but do not duplicate consumer logs
      console.error(`[Store: ${name || "Unnamed"}] Unhandled Store Error:`, {
        message: error.message,
        context: error.context,
        errorName: error.name,
      });
    }
  };

  const isStorageAvailable = (): boolean => {
    switch (storageType) {
      case StorageType.Local:
        return isLocalStorageAvailable();
      case StorageType.Session:
        return isSessionStorageAvailable();
      case StorageType.Cookie:
        return typeof document !== "undefined";
      default:
        return true;
    }
  };

  const getPersistenceKey = () => {
    if (!persistKey) return null;
    return storageType === StorageType.Cookie
      ? `${cookiePrefix}${persistKey}`
      : persistKey;
  };

  const persistState = (dataToPersist: S): void => {
    const currentPersistKey = getPersistenceKey();
    if (!currentPersistKey || !isStorageAvailable() || isDestroyed) return;

    try {
      let stateToStore = dataToPersist;

      // Call plugin beforePersist hooks
      for (const plugin of plugins) {
        try {
          const transformedState = plugin.beforePersist?.(
            stateToStore,
            storageType,
            storeInstance
          );
          if (transformedState) {
            stateToStore = transformedState;
          }
        } catch (e: any) {
          handleError(
            new MiddlewareError(`Plugin ${plugin.name}.beforePersist failed`, {
              error: e,
              pluginName: plugin.name,
              operation: "beforePersist",
            })
          );
          // Continue with next plugin if this plugin fails
          continue;
        }
      }

      // Use type registry to properly serialize complex types
      const serializedData = typeRegistry.serialize(stateToStore);

      const persistedState: PersistedState<any> = {
        data: serializedData,
        meta: { lastUpdated: Date.now(), sessionId, storeName: name },
      };

      switch (storageType) {
        case StorageType.Local:
          setLocalStorage(currentPersistKey, persistedState);
          break;
        case StorageType.Session:
          setSessionStorage(currentPersistKey, persistedState);
          break;
        case StorageType.Cookie:
          setCookie(
            currentPersistKey,
            JSON.stringify(persistedState),
            cookieOptions
          );
          break;
      }

      // Call plugin onPersisted hooks
      for (const plugin of plugins) {
        try {
          plugin.onPersisted?.(stateToStore, storageType, storeInstance);
        } catch (e: any) {
          handleError(
            new MiddlewareError(`Plugin ${plugin.name}.onPersisted failed`, {
              error: e,
              pluginName: plugin.name,
              operation: "onPersisted",
            })
          );
        }
      }
    } catch (e: any) {
      handleError(
        new PersistenceError("Failed to persist state", {
          operation: "persistState",
          error: e,
          key: currentPersistKey,
        })
      );
    }
  };

  const loadState = (): Partial<S> | null => {
    const currentPersistKey = getPersistenceKey();
    if (!currentPersistKey || !isStorageAvailable() || isDestroyed) return null;

    try {
      let wrappedState: PersistedState<any> | null = null;
      switch (storageType) {
        case StorageType.Local:
          wrappedState = getLocalStorage<PersistedState<any>>(
            currentPersistKey,
            {} as PersistedState<any>
          );
          break;
        case StorageType.Session:
          wrappedState = getSessionStorage<PersistedState<any>>(
            currentPersistKey,
            {} as PersistedState<any>
          );
          break;
        case StorageType.Cookie:
          const cookieValue = getCookie(currentPersistKey);
          if (cookieValue) wrappedState = JSON.parse(cookieValue);
          break;
      }

      if (wrappedState && wrappedState.meta && staleAge) {
        if (Date.now() - wrappedState.meta.lastUpdated > staleAge) {
          console.warn(`Discarding stale state for ${currentPersistKey}`);
          removeState();
          return null;
        }
      }

      if (wrappedState && wrappedState.data) {
        // Deserialize using type registry to restore complex objects
        let deserializedData = typeRegistry.deserialize(
          wrappedState.data
        ) as Partial<S>;

        // Call plugin onStateLoaded hooks
        for (const plugin of plugins) {
          try {
            const transformedState = plugin.onStateLoaded?.(
              deserializedData,
              storageType,
              storeInstance
            );
            if (transformedState) {
              deserializedData = transformedState;
            }
          } catch (e: any) {
            handleError(
              new MiddlewareError(
                `Plugin ${plugin.name}.onStateLoaded failed`,
                {
                  error: e,
                  pluginName: plugin.name,
                  operation: "onStateLoaded",
                }
              )
            );
            // Continue with original state if plugin fails
            continue;
          }
        }

        return deserializedData;
      }

      return null;
    } catch (e: any) {
      handleError(
        new PersistenceError("Failed to load persisted state", {
          operation: "loadState",
          error: e,
          key: currentPersistKey,
        })
      );
      return null;
    }
  };

  const removeState = (): void => {
    const currentPersistKey = getPersistenceKey();
    if (!currentPersistKey || !isStorageAvailable()) return;
    try {
      switch (storageType) {
        case StorageType.Local:
          removeLocalStorage(currentPersistKey);
          break;
        case StorageType.Session:
          removeSessionStorage(currentPersistKey);
          break;
        case StorageType.Cookie:
          removeCookie(currentPersistKey);
          break;
      }
    } catch (e: any) {
      handleError(
        new PersistenceError("Failed to remove persisted state", {
          operation: "removeState",
          error: e,
          key: currentPersistKey,
        })
      );
    }
  };

  /* Freeze helper – prevents accidental mutation in dev
     while keeping reference‑equality for memoisation. */
  const freezeDev = <T>(obj: T): T => (isDevMode() ? Object.freeze(obj) : obj);

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
  const notifyListeners = (
    prevState: S,
    actionApplied: ActionPayload<S> | null = null
  ): void => {
    // Use Immer to create deeply immutable state copies for external consumption
    // This prevents listeners from accidentally mutating nested objects
    const safeCurrentState = immer.produce(state, () => {
      // Empty producer - just creates an immutable copy
    });
    const safePrevState = immer.produce(prevState, () => {
      // Empty producer - just creates an immutable copy
    });

    for (const plugin of plugins) {
      try {
        plugin.onStateChange?.(
          safeCurrentState,
          safePrevState,
          actionApplied,
          storeInstance
        );
      } catch (e: any) {
        handleError(
          new MiddlewareError(`Plugin ${plugin.name}.onStateChange failed`, {
            error: e,
            pluginName: plugin.name,
          })
        );
      }
    }

    listeners.forEach(listener => {
      try {
        listener(safeCurrentState, safePrevState);
      } catch (e: any) {
        handleError(
          new StoreError("Listener invocation failed", {
            operation: "notifyListeners",
            error: e,
          })
        );
      }
    });
  };

  // --- History Management ---
  const addToHistory = (newState: S): void => {
    if (historyLimit > 0 && !isHistoryMutation) {
      // If we're not at the end of history (after undo), clear future states
      if (historyIndex >= 0 && historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
      }

      // Add the new state to history
      history.push({ ...newState });

      // Trim history if it exceeds the limit
      if (history.length > historyLimit) {
        const excessCount = history.length - historyLimit;
        history = history.slice(excessCount);
      }

      // Point to the newly added state
      historyIndex = history.length - 1;
    }
  };

  const _applyStateChange = (
    payload: ActionPayload<S>,
    fromSync = false
  ): void => {
    if (isDestroyed) return;

    const prevState = { ...state };
    let newPartialState = payload;

    // Plugin: beforeStateChange
    for (const plugin of plugins) {
      try {
        const transformed = plugin.beforeStateChange?.(
          newPartialState,
          prevState,
          storeInstance
        );
        if (transformed) {
          newPartialState = transformed;
        }
      } catch (e: any) {
        handleError(
          new MiddlewareError(
            `Plugin ${plugin.name}.beforeStateChange failed`,
            { error: e, pluginName: plugin.name }
          )
        );
        return;
      }
    }

    /* 🏃‍♂️ Bail early if the payload is empty so we don’t burn cycles
       or generate useless listener notifications. */
    if (Object.keys(newPartialState).length === 0) return;

    // Check if this is an updatePath operation that should preserve structural sharing
    if (isInUpdatePath) {
      // For updatePath, directly assign the state to preserve Immer's structural sharing
      state = newPartialState as S;
    } else {
      // Normal case: merge the partial state
      state = { ...state, ...newPartialState }; // Apply the changes
    }

    // --- Notifications and History ---
    if (!fromSync && getPersistenceKey() && storageType !== StorageType.None) {
      persistState(state);
    }

    addToHistory(state); // Add new state to history for undo/redo
    notifyListeners(prevState, newPartialState); // Notify with the state *before* this change as prevState
  };

  const _internalDispatch = async (
    action: ActionPayload<S>,
    isChainedCall = false
  ): Promise<void> => {
    if (isDestroyed) return;
    if (typeof action !== "object" || action === null) {
      handleError(
        new StoreError("Dispatched action payload must be an object.", {
          operation: "_internalDispatch",
          action,
        })
      );
      return;
    }

    if (
      typeof action === "object" &&
      action !== null &&
      "__REDUX_DEVTOOLS_TIME_TRAVEL__" in action
    ) {
      // This is a DevTools time travel action, apply it directly without middleware
      const { __REDUX_DEVTOOLS_TIME_TRAVEL__, ...actualPayload } =
        action as any;
      _applyStateChange(actualPayload as ActionPayload<S>, false);
      return;
    }

    if (batching && !isChainedCall) {
      batchedActions.push(action);
      return;
    }

    // Capture prevState *before* any middleware or state change.
    const prevStateForMiddleware = { ...state };

    // Middleware processing
    if (middleware.length > 0) {
      let middlewareIndex = 0;
      const nextMiddleware = async (currentPayload: ActionPayload<S>) => {
        if (middlewareIndex < middleware.length) {
          const currentMiddleware = middleware[middlewareIndex++];
          try {
            const result = currentMiddleware(
              currentPayload,
              prevStateForMiddleware, // Pass the initially captured prevState
              nextMiddleware,
              storeInstance.getState
            );
            // If the middleware returns a promise, await it
            if (result && typeof result.then === "function") {
              await result;
            }
          } catch (e: any) {
            handleError(
              new MiddlewareError("Middleware execution failed", {
                operation: "middlewareExecution",
                error: e,
                middlewareName: currentMiddleware.name || "anonymous",
              })
            );
            // Optionally, do not apply state if middleware fails critically
          }
        } else {
          // If middleware chain completes, apply the (potentially transformed) payload
          _applyStateChange(currentPayload, false);
        }
      };
      await nextMiddleware(action); // Start middleware chain and wait for completion
    } else {
      // No middleware, apply directly
      _applyStateChange(action, false);
    }
  };

  // --- Store Methods ---
  storeInstance.getState = () => {
    if (batching && batchedActions.length > 0) {
      // During batching, return the state with all batched actions applied
      const intermediateState = batchedActions.reduce(
        (acc, curr) => ({ ...acc, ...curr }),
        state
      );
      return freezeDev(intermediateState as S);
    }
    // Always return a copy before freezing to prevent mutation issues with Immer
    return freezeDev(state);
  };

  storeInstance.dispatch = (
    action: ActionPayload<S> | Thunk<S, any>
  ): void | Promise<any> => {
    if (isDestroyed) return;
    if (typeof action === "function") {
      try {
        const result = (action as Thunk<S, any>)(
          storeInstance.dispatch,
          storeInstance.getState,
          storeInstance.updatePath,
          storeInstance.transaction,
          storeInstance.batch
        );

        // If the thunk returns a promise, handle potential rejections
        if (
          result &&
          typeof result === "object" &&
          typeof result.then === "function"
        ) {
          return result.catch((e: any) => {
            handleError(
              new StoreError("Thunk execution failed", {
                operation: "dispatchThunk",
                error: e,
                thunkName: action.name || "anonymous",
              })
            );
            // Re-throw the error so the caller can still handle it
            throw e;
          });
        }

        return result;
      } catch (e: any) {
        handleError(
          new StoreError("Thunk execution failed", {
            operation: "dispatchThunk",
            error: e,
            thunkName: action.name || "anonymous",
          })
        );
      }
    } else if (typeof action === "object" && action !== null) {
      const dispatchResult = _internalDispatch(action);
      // If _internalDispatch returns a promise (due to async middleware), return it
      if (dispatchResult && typeof dispatchResult.then === "function") {
        return dispatchResult;
      }
    } else {
      handleError(
        new StoreError(
          "Invalid action dispatched. Must be an object or a thunk function.",
          { operation: "dispatch", action }
        )
      );
    }
  };

  storeInstance.setState = (newState: Partial<S>) => {
    storeInstance.dispatch(newState); // setState is now an alias
  };

  storeInstance.subscribe = (listener: Listener<S>) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  };

  storeInstance.subscribeTo = <T>(
    selector: Selector<S, T>,
    listener: DependencyListener<T>,
    options?: DependencySubscriptionOptions
  ): (() => void) => {
    if (isDestroyed) {
      console.warn(
        `[Store: ${
          name || "Unnamed"
        }] Cannot create subscription on destroyed store`
      );
      return () => {}; // Return no-op cleanup function
    }

    return selectorManager.createDependencySubscription(
      selector,
      listener,
      options
    );
  };

  storeInstance.subscribeToMultiple = <P extends Selector<S, any>[]>(
    selectors: readonly [...P],
    listener: (
      newValues: {
        [K in keyof P]: P[K] extends Selector<S, infer RT> ? RT : never;
      },
      oldValues: {
        [K in keyof P]: P[K] extends Selector<S, infer RT> ? RT : never;
      }
    ) => void,
    options?: DependencySubscriptionOptions
  ): (() => void) => {
    if (isDestroyed) {
      console.warn(
        `[Store: ${
          name || "Unnamed"
        }] Cannot create multi-subscription on destroyed store`
      );
      return () => {}; // Return no-op cleanup function
    }

    return selectorManager.createMultiDependencySubscription(
      selectors,
      listener as any, // Type assertion to fix the generic constraint issue
      options
    );
  };

  storeInstance.subscribeToPath = <T = any>(
    path: string,
    listener: DependencyListener<T>,
    options?: DependencySubscriptionOptions
  ): (() => void) => {
    if (isDestroyed) {
      console.warn(
        `[Store: ${
          name || "Unnamed"
        }] Cannot create path subscription on destroyed store`
      );
      return () => {}; // Return no-op cleanup function
    }

    return selectorManager.createPathSubscription(path, listener, options);
  };

  storeInstance.select = <R, P extends Selector<S, unknown>[]>(
    ...args:
      | [
          ...P,
          (
            ...results: {
              [K in keyof P]: P[K] extends Selector<S, infer RT> ? RT : never;
            }
          ) => R
        ]
      | [Selector<S, R>]
  ): (() => R) & { lastValue?: R } => {
    return selectorManager.createSelector(...args);
  };

  storeInstance.selectWith = <Props, R, P extends Selector<S, any>[]>(
    inputSelectors: readonly [...P],
    projector: (params: Props) => (
      ...results: {
        [K in keyof P]: P[K] extends Selector<S, infer RT> ? RT : never;
      }
    ) => R
  ) => {
    return selectorManager.createParameterizedSelector(
      inputSelectors,
      projector
    );
  };

  storeInstance.reset = () => {
    if (isDestroyed) return;
    const prevState = { ...state }; // Capture state before reset
    state = { ...initialState };
    persistState(state);

    // Clear history when resetting the store
    history = [];
    historyIndex = -1;

    // Add the initial state to history after reset
    addToHistory(state);

    notifyListeners(prevState, null); // Notify with state before reset as prevState
  };

  const runHistoryPlugin = {
    beforeChange: (options: historyChangePluginOptions<S>): boolean | void => {
      // Call plugin beforeHistoryChange hooks
      for (const plugin of plugins) {
        try {
          const result = plugin.beforeHistoryChange?.({ ...options });
          if (result === false) {
            return false; // Prevent the operation
          }
        } catch (e: any) {
          handleError(
            new MiddlewareError(
              `Plugin ${plugin.name}.beforeHistoryChange failed`,
              {
                operation: "beforeHistoryChange",
                error: e,
                pluginName: plugin.name,
              }
            )
          );
        }
      }
      return true; // Allow the operation by default
    },
    afterChange: (options: historyChangePluginOptions<S>): void => {
      for (const plugin of plugins) {
        try {
          plugin.onHistoryChanged?.({ ...options });
        } catch (e: any) {
          handleError(
            new MiddlewareError(
              `Plugin ${plugin.name}.onHistoryChanged failed`,
              {
                operation: "onHistoryChanged",
                error: e,
                pluginName: plugin.name,
              }
            )
          );
        }
      }
    },
  };

  storeInstance.undo = (steps = 1) => {
    if (
      isDestroyed ||
      historyLimit === 0 ||
      history.length === 0 ||
      historyIndex - steps < 0
    )
      return false;

    // Check if any plugin wants to prevent this undo operation
    const canUndo = runHistoryPlugin.beforeChange({
      operation: "undo",
      steps,
      oldState: state,
      newState: history[historyIndex - steps],
      store: storeInstance,
    });
    if (canUndo === false) return false;

    isHistoryMutation = true;
    const prevStateForNotification = { ...state }; // Capture state before it changes

    // Move back in history
    historyIndex = historyIndex - steps;

    // Restore the state from history
    state = { ...history[historyIndex] };

    persistState(state);
    notifyListeners(prevStateForNotification, null); // Notify with the state *before* undo as prevState
    isHistoryMutation = false;
    // Call plugin afterHistoryChange hooks
    runHistoryPlugin.afterChange({
      operation: "undo",
      steps,
      oldState: prevStateForNotification,
      newState: state,
      store: storeInstance,
    });
    return true;
  };

  storeInstance.redo = (steps = 1) => {
    if (
      isDestroyed ||
      historyLimit === 0 ||
      history.length === 0 ||
      historyIndex + steps >= history.length
    )
      return false;
    // Check if any plugin wants to prevent this redo operation
    const canRedo = runHistoryPlugin.beforeChange({
      operation: "redo",
      steps,
      oldState: state,
      newState: history[historyIndex + steps],
      store: storeInstance,
    });
    if (canRedo === false) return false;

    isHistoryMutation = true;
    const prevStateForNotification = { ...state }; // Capture state before it changes

    // Move forward in history
    historyIndex = historyIndex + steps;

    // Restore the state from history
    state = { ...history[historyIndex] };

    persistState(state);
    notifyListeners(prevStateForNotification, null); // Notify with the state *before* redo as prevState
    isHistoryMutation = false;

    // Call plugin afterHistoryChange hooks
    runHistoryPlugin.afterChange({
      operation: "redo",
      steps,
      oldState: prevStateForNotification,
      newState: state,
      store: storeInstance,
    });
    return true;
  };

  storeInstance.updatePath = <V = any>(
    path: (string | number)[],
    updater: (currentValue: V) => V
  ) => {
    if (isDestroyed) return;

    // Use Immer to safely update the path with automatic structural sharing
    const nextState = immer.produce(state, draft => {
      // Navigate to the parent of the target path
      let current: any = draft;

      // Navigate to the parent object/array
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (current[key] === undefined || current[key] === null) {
          // Auto-create missing intermediate objects/arrays
          const nextKey = path[i + 1];
          current[key] = typeof nextKey === "number" ? [] : {};
        }
        current = current[key];
      }

      // Get the final key and current value
      const finalKey = path[path.length - 1];
      const currentValue = current[finalKey] as V;

      // Apply the updater function
      const newValue = updater(currentValue);

      // Only update if the value actually changed
      if (!Object.is(currentValue, newValue)) {
        current[finalKey] = newValue;
      }
    });

    // Only dispatch if state actually changed (Immer provides reference equality)
    if (nextState !== state) {
      if (batching) {
        // During batching, use minimal diff to avoid state replacement conflicts
        const diff = buildMinimalDiff(nextState, path);
        _internalDispatch(diff, false);
      } else {
        // For non-batched operations, use flag to preserve structural sharing
        // and dispatch the complete state to provide full context to plugins
        const currentUpdatePathFlag = isInUpdatePath;
        isInUpdatePath = true;

        try {
          _internalDispatch(nextState as ActionPayload<S>, false);
        } finally {
          isInUpdatePath = currentUpdatePathFlag;
        }
      }
    }
  };

  /**
   * Builds a minimal diff object containing only the changed path with sibling properties preserved.
   *
   * @param newState - The new state after update
   * @param path - The path that was updated
   * @returns A minimal object containing the changed nested structure with siblings
   */
  function buildMinimalDiff<S extends object>(
    newState: S,
    path: (string | number)[]
  ): Partial<S> {
    const diff: any = {};
    let currentDiff: any = diff;
    let currentState: any = newState;

    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];

      // Get the full object/array at this level from newState to preserve siblings
      const fullObjectAtLevel = currentState[key];

      if (Array.isArray(fullObjectAtLevel)) {
        currentDiff[key] = [...fullObjectAtLevel];
      } else if (fullObjectAtLevel && typeof fullObjectAtLevel === "object") {
        currentDiff[key] = { ...fullObjectAtLevel };
      } else {
        currentDiff[key] = fullObjectAtLevel;
      }

      currentDiff = currentDiff[key];
      currentState = currentState[key];
    }

    // Set the final changed value
    currentDiff[path[path.length - 1]] = getPath(newState, path);
    return diff;
  }

  storeInstance.batch = (fn: () => void) => {
    if (isDestroyed) return;
    if (batching) {
      fn();
      return;
    }

    batching = true;
    batchedActions = [];

    // Call onBatchStart for all plugins
    for (const plugin of plugins) {
      try {
        plugin.onBatchStart?.(storeInstance);
      } catch (e: any) {
        handleError(
          new MiddlewareError(`Plugin ${plugin.name}.onBatchStart failed`, {
            error: e,
            pluginName: plugin.name,
            operation: "onBatchStart",
          })
        );
      }
    }

    try {
      fn();

      if (batchedActions.length > 0) {
        const combinedAction = batchedActions.reduce(
          (acc, curr) => ({ ...acc, ...curr }),
          {}
        );

        if (Object.keys(combinedAction).length) {
          // Call _internalDispatch but don't await since batch is synchronous
          // Use the result for potential future async handling
          const result = _internalDispatch(combinedAction, true);
          if (result instanceof Promise) {
            result.catch(error => {
              // Handle async middleware errors
              console.warn("Async middleware error in batch:", error);
            });
          }
          // If there's async middleware, we can't wait for it in a sync function
          // but the middleware will still execute asynchronously
        }
      }

      // Call onBatchEnd for all plugins with success
      const finalState = state; // Current state after all actions applied
      for (const plugin of plugins) {
        try {
          plugin.onBatchEnd?.(batchedActions, finalState, storeInstance);
        } catch (e: any) {
          handleError(
            new MiddlewareError(`Plugin ${plugin.name}.onBatchEnd failed`, {
              error: e,
              pluginName: plugin.name,
              operation: "onBatchEnd",
            })
          );
        }
      }
    } catch (e: any) {
      // Store the batched actions before clearing for error reporting
      const failedBatchedActions = [...batchedActions];
      handleError(
        new StoreError("Batch execution failed", {
          operation: "batch",
          error: e,
          failedActions: failedBatchedActions,
          actionCount: failedBatchedActions.length,
        })
      );

      // Call onBatchEnd for all plugins even on failure
      // Pass empty array for actions since they weren't applied
      for (const plugin of plugins) {
        try {
          plugin.onBatchEnd?.([], state, storeInstance);
        } catch (pluginError: any) {
          handleError(
            new MiddlewareError(
              `Plugin ${plugin.name}.onBatchEnd failed after batch error`,
              {
                error: pluginError,
                pluginName: plugin.name,
                operation: "onBatchEnd",
                originalError: e,
              }
            )
          );
        }
      }
    } finally {
      batching = false;
      batchedActions = [];
    }
  };

  /**
   * Executes a transaction function that can safely mutate a draft copy of the state.
   *
   * @remarks
   * This method uses Immer's {@link https://immerjs.github.io/immer/produce | produce} function
   * to create a draft state that can be safely mutated. The transaction function should
   * mutate the draft directly rather than returning values.
   *
   * Key benefits over the previous transaction implementation:
   * - Uses Immer for safe mutations and automatic structural sharing
   * - Eliminates complex deep cloning and mutation detection logic
   * - Provides better TypeScript support for nested updates
   * - Automatically handles immutability without manual object spreading
   * - Supports readonly properties through Immer's Draft type
   *
   * @param recipe - The transaction function that receives a mutable draft of the current state.
   *                The draft parameter is typed as {@link Draft<S>} which allows mutation
   *                of readonly properties and provides better TypeScript safety.
   *                Should mutate the draft directly and return `void`.
   * @returns `true` if the transaction succeeded and state was updated, `false` if it failed.
   *
   * @example
   * ```typescript
   * // Mutating the draft directly (recommended approach)
   * const success = store.transaction((draft) => {
   *   draft.user.name = "John Doe";
   *   draft.todos.push({ id: 1, text: "Learn Immer", done: false });
   *   draft.settings.theme = "dark";
   * });
   *
   * // Working with Maps and Sets
   * const success = store.transaction((draft) => {
   *   draft.userMap.set("123", { name: "John", age: 30 });
   *   draft.tagSet.add("typescript");
   *   draft.tagSet.delete("javascript");
   * });
   *
   * // Working with readonly properties (now supported)
   * interface ReadonlyState {
   *   readonly config: {
   *     readonly apiUrl: string;
   *     readonly timeout: number;
   *   };
   * }
   * const success = store.transaction((draft) => {
   *   // These mutations work even though the properties are readonly
   *   draft.config.apiUrl = "https://new-api.example.com";
   *   draft.config.timeout = 5000;
   * });
   * ```
   *
   * @see {@link https://immerjs.github.io/immer/produce | Immer produce documentation}
   * @see {@link https://immerjs.github.io/immer/update-patterns | Immer update patterns}
   * @see {@link https://immerjs.github.io/immer/typescript | Immer TypeScript documentation}
   * @see {@link batch} for batching multiple state updates
   */
  storeInstance.transaction = (recipe: (draft: Draft<S>) => void): boolean => {
    if (isDestroyed) {
      return false;
    }

    let transactionError: Error | undefined;

    // Call onTransactionStart for all plugins
    for (const plugin of plugins) {
      try {
        plugin.onTransactionStart?.(storeInstance);
      } catch (e: any) {
        handleError(
          new MiddlewareError(
            `Plugin ${plugin.name}.onTransactionStart failed`,
            {
              error: e,
              pluginName: plugin.name,
              operation: "onTransactionStart",
            }
          )
        );
      }
    }

    try {
      /**
       * Use Immer's produce to create a safe draft that can be mutated.
       * Important: Use the unfrozen `state` variable directly, not `getState()`,
       * since getState() returns a frozen copy which Immer cannot use as a base.
       * Immer will automatically create a new immutable state if any changes are made,
       * or return the original state if no changes occurred.
       */
      const nextState = immer.produce(state, recipe);

      // Only proceed if state actually changed (Immer provides reference equality check)
      if (nextState !== state) {
        // Use _internalDispatch to go through the full middleware/plugin flow
        _internalDispatch(nextState as ActionPayload<S>, false);
      } else {
        // No changes were made, but transaction was successful
        if (typeof console !== "undefined" && console.debug) {
          console.debug(
            `[Store: ${
              name || "Unnamed"
            }] Transaction completed with no state changes.`,
            { operation: "transaction" }
          );
        }
      }

      // Call onTransactionEnd for all plugins with success
      for (const plugin of plugins) {
        try {
          plugin.onTransactionEnd?.(
            true,
            storeInstance,
            nextState !== state ? (nextState as Partial<S>) : undefined
          );
        } catch (e: any) {
          handleError(
            new MiddlewareError(
              `Plugin ${plugin.name}.onTransactionEnd failed`,
              {
                error: e,
                pluginName: plugin.name,
                operation: "onTransactionEnd",
              }
            )
          );
        }
      }

      return true;
    } catch (e: any) {
      transactionError = e;

      handleError(
        new TransactionError("Transaction function encountered an exception.", {
          operation: "transaction",
          error: e,
        })
      );

      // Call onTransactionEnd for all plugins with failure
      for (const plugin of plugins) {
        try {
          plugin.onTransactionEnd?.(
            false,
            storeInstance,
            undefined,
            transactionError
          );
        } catch (pluginError: any) {
          handleError(
            new MiddlewareError(
              `Plugin ${plugin.name}.onTransactionEnd failed after transaction error`,
              {
                error: pluginError,
                pluginName: plugin.name,
                operation: "onTransactionEnd",
                originalError: e,
              }
            )
          );
        }
      }

      return false;
    }
  };

  storeInstance.destroy = (options?: CleanupOptions) => {
    if (isDestroyed) return;
    const cleanupOpts = { ...defaultCleanupOptions, ...options };
    isDestroyed = true;

    selectorManager.destroyAll();

    for (const plugin of plugins) {
      try {
        plugin.onDestroy?.(storeInstance);
      } catch (e: any) {
        handleError(
          new MiddlewareError(`Plugin ${plugin.name}.onDestroy failed`, {
            operation: "pluginOnDestroy",
            error: e,
            pluginName: plugin.name,
          })
        );
      }
    }

    listeners = [];
    if (cleanupOpts.clearHistory) {
      history = [];
      historyIndex = -1;
    }
    if (cleanupOpts.removePersistedState) {
      removeState();
    }

    // Unregister from global registry
    if (sessionId && storeRegistry.has(sessionId)) {
      const storeSet = storeRegistry.get(sessionId)!;
      storeSet.delete(storeInstance as Store<object>);
      if (storeSet.size === 0) {
        storeRegistry.delete(sessionId);
      }
    }

    if (cleanupOpts.resetRegistry) {
      // Reset the global store registry if requested
      storeRegistry.clear();
    }
  };

  storeInstance.getName = () => name;
  storeInstance.getSessionId = () => sessionId;

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
    };
  };

  /**
   * Internal method for Redux DevTools to set state directly without going through dispatch.
   * This bypasses middleware and plugins to prevent infinite loops during time travel.
   * Audits and sanitizes the input to ensure the types and structure match the expected state.
   *
   * @param newState - The new state to set
   * @param isTimeTravel - Whether this is a time travel operation (defaults to true)
   */
  storeInstance._setStateForDevTools = (newState: S, isTimeTravel = true) => {
    if (isDestroyed) return;

    const prevState = { ...state };

    // --- Audit and sanitize the input state ---
    let sanitizedState: S = { ...newState };

    // If the current state contains any complex types registered in TypeRegistry,
    // attempt to restore them in the new state as well.
    // This helps ensure that Sets, Maps, etc., are not accidentally replaced with plain objects/arrays.
    const auditAndSanitize = (expected: any, input: any): any => {
      // If expected is a registered complex type, try to coerce input to that type
      const typeDef = typeRegistry.findTypeFor(expected);
      if (typeDef && !typeRegistry.findTypeFor(input)) {
        // If input is not already the correct type, try to deserialize it
        try {
          // If input looks like a serialized form, try to use the typeDef's deserialize
          if (
            input &&
            typeof input === "object" &&
            "__type" in input &&
            input.__type === typeDef.typeName
          ) {
            return typeDef.deserialize(input.data);
          }
          // Otherwise, try to serialize and then deserialize to coerce
          return typeDef.deserialize(typeDef.serialize(input));
        } catch {
          // Fallback to input as-is if coercion fails
          return input;
        }
      }

      // If both are arrays, recursively audit each element
      if (Array.isArray(expected) && Array.isArray(input)) {
        return input.map((item, idx) => auditAndSanitize(expected[idx], item));
      }

      // If both are plain objects, recursively audit each property
      if (
        expected &&
        typeof expected === "object" &&
        input &&
        typeof input === "object"
      ) {
        const result: Record<string, any> = { ...input };
        for (const key of Object.keys(expected)) {
          if (key in input) {
            result[key] = auditAndSanitize(expected[key], input[key]);
          }
        }
        return result;
      }

      // Otherwise, return input as-is
      return input;
    };

    sanitizedState = auditAndSanitize(state, newState);

    state = { ...sanitizedState };

    // Persist the new state if needed
    if (getPersistenceKey() && storageType !== StorageType.None) {
      persistState(state);
    }

    // Skip history tracking for time travel operations
    if (!isTimeTravel && historyLimit > 0) {
      addToHistory(state);
    }

    // Notify listeners but indicate this is a DevTools operation
    notifyListeners(prevState, null);
  };

  // Add a public method to manually trigger selector cleanup
  (storeInstance as any).cleanupSelectors = () => {
    return selectorManager.cleanupSelectors();
  };

  // Add debugging methods (internal use)
  (storeInstance as any)._getDependencySubscriptionCount = () => {
    return selectorManager.getDependencySubscriptionCount();
  };

  (storeInstance as any)._cleanupDependencySubscriptions = () => {
    return selectorManager.cleanupDependencySubscriptions();
  };

  // --- Initialization ---
  if (shouldCleanupStaleStates) {
    cleanupStaleStates(staleAge, cookiePrefix);
  }

  const savedState = loadState();
  if (savedState) {
    state = { ...state, ...savedState };
  }

  // Initialize history with the current state if historyLimit is set
  if (historyLimit > 0) {
    addToHistory(state);
  }

  // Cross-tab sync
  if (
    syncAcrossTabs &&
    storageType === StorageType.Local &&
    getPersistenceKey()
  ) {
    const currentPersistKey = getPersistenceKey()!;
    const storageEventHandler = (event: StorageEvent) => {
      if (event.key === currentPersistKey && event.newValue && !isDestroyed) {
        try {
          const persisted = JSON.parse(event.newValue) as PersistedState<S>;
          // Ensure this update isn't from the current session to avoid loops

          // And only apply if state truly differs to prevent redundant notifications
          if (
            persisted.meta &&
            persisted.meta.sessionId !== sessionId &&
            !deepEqual(state, persisted.data)
          ) {
            let stateToApply = persisted.data;

            // Call plugin onCrossTabSync hooks
            for (const plugin of plugins) {
              try {
                const transformedState = plugin.onCrossTabSync?.(
                  stateToApply,
                  persisted.meta.sessionId || "unknown",
                  storeInstance
                );
                if (transformedState) {
                  stateToApply = transformedState;
                }
              } catch (e: any) {
                handleError(
                  new MiddlewareError(
                    `Plugin ${plugin.name}.onCrossTabSync failed`,
                    {
                      error: e,
                      pluginName: plugin.name,
                      operation: "onCrossTabSync",
                      sourceSessionId: persisted.meta.sessionId,
                    }
                  )
                );
                // Continue with original state if plugin fails
                continue;
              }
            }

            // _applyStateChange will capture the current `state` as its `prevState`
            _applyStateChange(stateToApply, true);
          }
        } catch (e: any) {
          handleError(
            new SyncError("Failed to sync state from another tab", {
              error: e,
              key: currentPersistKey,
            })
          );
        }
      }
    };
    window.addEventListener("storage", storageEventHandler);
    // Need to also clean this listener up in destroy()
    const originalDestroy = storeInstance.destroy;
    storeInstance.destroy = (opts?: CleanupOptions) => {
      window.removeEventListener("storage", storageEventHandler);
      originalDestroy(opts);
    };
  }

  // Register store
  if (sessionId) {
    if (!storeRegistry.has(sessionId)) {
      storeRegistry.set(sessionId, new Set());
    }
    storeRegistry.get(sessionId)!.add(storeInstance as Store<object>);
  }

  // Call onStoreCreate for plugins
  for (const plugin of plugins) {
    try {
      plugin.onStoreCreate?.(storeInstance);
    } catch (e: any) {
      handleError(
        new MiddlewareError(`Plugin ${plugin.name}.onStoreCreate failed`, {
          error: e,
          pluginName: plugin.name,
        })
      );
      throw new StoreError(
        `Store creation failed due to plugin ${plugin.name}`,
        {
          error: e,
          pluginName: plugin.name,
        }
      );
    }
  }

  // Initial state persistence if key provided and no saved state (or saved state was stale and removed)
  if (getPersistenceKey() && !savedState) {
    persistState(state);
  }

  return storeInstance;
}

export default createStore;
