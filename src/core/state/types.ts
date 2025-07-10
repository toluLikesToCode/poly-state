import type {Draft} from 'immer'
import {ErrorContext, StoreError, ValidationError} from '../../shared/errors'
import {DependencyListener, DependencySubscriptionOptions, Selector} from '../selectors/types'

/**
 * Type definition for custom serialization/deserialization of complex objects
 * @template T - The type of the object being handled
 */
export interface TypeDefinition<T> {
  /**
   * Identifies if a value matches this type
   * @param value - The value to check
   * @returns True if the value is of this type
   */
  isType: (value: any) => boolean

  /**
   * Converts the value to a serializable form
   * @param value - The value to serialize
   * @returns The serialized representation
   */
  serialize: (value: T) => any

  /**
   * Converts the serialized form back to the original type
   * @param value - The serialized value to deserialize
   * @returns The deserialized object
   */
  deserialize: (value: any) => T

  /**
   * Type name for debugging and identification
   */
  typeName: string
}

/**
 * Function that receives state updates
 * @typeParam S - The type of the state
 */
export type Listener<S extends object> = (newState: S, prevState?: S) => void

/**
 * Function that intercepts and potentially modifies state updates
 * @typeParam S - The type of the state
 */
export type Middleware<S extends object> = (
  action: ActionPayload<S>,
  prevState: S,
  dispatch: (action: ActionPayload<S>) => void,
  getState: () => S,
  reset: () => void
) => void | Promise<void>

/**
 * Dispatch function for the store with improved return type handling
 * @typeParam S – the shape of the state
 */
export type Dispatch<S extends object> = {
  <R>(action: Thunk<S, R>): R extends Promise<any> ? Promise<R> : R
  (action: ActionPayload<S>): void
}

export type ThunkContext<S extends object> = {
  dispatch: Dispatch<S>
  getState: () => S
  updatePath: <V = any>(path: (string | number)[], updater: (currentValue: V) => V) => void
  transaction: (recipe: (draft: Draft<S>) => void) => boolean
  batch: (fn: () => void) => void
}

export type Thunk<S extends object, R = void> = (ctx: ThunkContext<S>) => R | Promise<R>

// /**
//  * Thunk for async/sync logic
//  * @typeParam S – the shape of the state
//  * @typeParam R – return type of the thunk (defaults to void)
//  */
// export type Thunk<S extends object, R = void> = (
//   dispatch: Dispatch<S>,
//   getState: () => S,
//   updatePath: <V = any>(path: (string | number)[], updater: (currentValue: V) => V) => void,
//   transaction: (recipe: (draft: Draft<S>) => void) => boolean,
//   batch: (fn: () => void) => void
// ) => R | Promise<R>

/**
 * Direct state‐update payload
 * Only keys present on S are allowed
 */
export type ActionPayload<S extends object> = {
  [K in keyof S]?: S[K]
}

/**
 * Union of a payload update or a thunk
 */
export type Action<S extends object> = ActionPayload<S> | Thunk<S, any>

/**
 * Storage type to use for state persistence
 */
export enum StorageType {
  Local = 'local',
  Session = 'session',
  Cookie = 'cookie',
  None = 'none',
}

/**
 * Options for cookie-based storage
 */
export interface CookieStorageOptions {
  expires?: number
  path?: string
  domain?: string
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

export interface historyChangePluginOptions<S extends object> {
  operation: 'undo' | 'redo'
  steps: number
  store: Store<S>
  oldState: S
  newState: S
  persistFn?: (state: S) => void // Optional function to persist state after history change
  notifyFn?: (prevState: S, actionApplied?: ActionPayload<S> | null) => void // Optional function to notify about history change
}

export interface Plugin<S extends object> {
  name: string
  /**
   * Called immediately after the store is created.
   * @param store - The newly created store instance.
   * @throws Error if initialization fails, this will fail fast and prevent the store from being used.
   */
  onStoreCreate?: (store: Store<S>) => void

  /**
   * Intercepts each dispatched action before it reaches the reducer.
   * Can transform or replace the incoming action payload.
   * @param action - The action being dispatched.
   * @param prevState - The state of the store before the action is applied.
   * @param store - The store instance dispatching the action.
   * @returns A new or modified ActionPayload to apply, or void to use the original.
   * @remarks This is useful for logging, validation, or modifying actions before they reach the reducer.
   * @throws MiddlewareError if the action is invalid or cannot be processed. This error is handled internally by the store and logged.
   */
  beforeStateChange?: (
    action: ActionPayload<S>,
    prevState: S,
    store: Store<S>
  ) => ActionPayload<S> | void // Can transform action

  /**
   * Invoked after the store's state has been updated.
   * @param newState - The store's state after the action has been applied.
   * @param prevState - The store's state before the action was applied.
   * @param action - The action that triggered the state change, or null if none.
   * @param store - The store instance whose state changed.
   * @throws MiddlewareError if the action is invalid or cannot be processed. This error is handled internally by the store and logged.
   */
  onStateChange?: (
    newState: S,
    prevState: S,
    action: ActionPayload<S> | null,
    store: Store<S>
  ) => void

  /**
   * Called when the store is being destroyed.
   * Use this to perform any cleanup or teardown logic.
   * @param store - The store instance being destroyed.
   * @throws MiddlewareError if the action is invalid or cannot be processed. This error is handled internally by the store and logged.
   */
  onDestroy?: (store: Store<S>) => void

  /**
   * Called when an error occurs in the store or other plugins
   * @param error - The error that occurred
   * @param context - Additional context about where the error occurred
   * @param store - The store instance
   * @remarks Prevents infinite recursion by not calling handleError again
   */
  onError?: (error: StoreError, context: ErrorContext, store: Store<S>) => void

  /**
   * Called before state is persisted to storage
   * @param state - The state about to be persisted
   * @param storageType - Type of storage being used
   * @param store - The store instance
   * @returns Transformed state to persist, or void to use original
   * @throws MiddlewareError if the state is invalid or cannot be processed. It is handled internally by the store and logged. The store will proceed with the next plugins if available.
   */
  beforePersist?: (state: S, storageType: StorageType, store: Store<S>) => S | void

  /**
   * Called after state is successfully persisted
   * @param state - The state that was persisted
   * @param storageType - Type of storage used
   * @param store - The store instance
   * @throws MiddlewareError if the state is invalid or cannot be processed. It is handled internally by the store and logged. The store will proceed with the next plugins if available.
   */
  onPersisted?: (state: S, storageType: StorageType, store: Store<S>) => void

  /**
   * Called when state is loaded from storage
   * @param loadedState - The state loaded from storage
   * @param storageType - Type of storage it was loaded from
   * @param store - The store instance
   * @returns Transformed state to use, or void to use original
   * @throws MiddlewareError if the state is invalid or cannot be processed. It is handled internally by the store and logged. The store will proceed with the next plugins if available.
   */
  onStateLoaded?: (
    loadedState: Partial<S>,
    storageType: StorageType,
    store: Store<S>
  ) => Partial<S> | void

  /**
   * Called when cross-tab sync occurs
   * @param syncedState - The state received from another tab
   * @param sourceSessionId - Session ID of the tab that sent the update
   * @param store - The store instance
   * @remarks If a plugin fails during sync it will not block the sync process, the store will proceed with the next plugins if available.
   * @returns Transformed state to apply, or void to use original
   */
  onCrossTabSync?: (syncedState: S, sourceSessionId: string, store: Store<S>) => S | void

  /**
   * Called before undo/redo operations
   * @param operation - Type of operation ('undo' | 'redo')
   * @param steps - Number of steps to move
   * @param store - The store instance
   * @param oldState - Current state before operation
   * @param newState - State that will be restored
   * @returns False to prevent the operation, true/void to allow
   * @throws MiddlewareError if the operation is invalid or cannot be processed. It is handled internally by the store and logged. The store will proceed with the next plugins if available. The store will assume true if the plugin fails.
   */
  beforeHistoryChange?: (options: historyChangePluginOptions<S>) => boolean | void

  /**
   * Called after undo/redo operations complete
   * @param operation - Type of operation that occurred
   * @param steps - Number of steps that were moved
   * @param store - The store instance
   * @param oldState - State before the operation
   * @param newState - State after the operation
   * @throws MiddlewareError if the operation is invalid or cannot be processed. It is handled internally by the store and logged. The store will proceed with the next plugins if available. The store will assume true if the plugin fails.
   */
  onHistoryChanged?: (options: historyChangePluginOptions<S>) => void

  /**
   * Called when a batch operation begins
   * @param store - The store instance
   * @throws MiddlewareError if the batch cannot be started. It is handled internally by the store and logged. The store will proceed with the next plugins if available.
   */
  onBatchStart?: (store: Store<S>) => void

  /**
   * Called when a batch operation completes
   * @param actions - Array of actions that were batched
   * @param finalState - The final state after all actions
   * @param store - The store instance
   * @throws MiddlewareError if the batch cannot be started. It is handled internally by the store and logged. The store will proceed with the next plugins if available.
   */
  onBatchEnd?: (actions: ActionPayload<S>[], finalState: S, store: Store<S>) => void

  /**
   * Called when a transaction begins
   * @param store - The store instance
   * @throws MiddlewareError if the batch cannot be started. It is handled internally by the store and logged. The store will proceed with the next plugins if available.
   */
  onTransactionStart?: (store: Store<S>) => void

  /**
   * Called when a transaction completes (success or failure)
   * @param success - Whether the transaction succeeded
   * @param changes - The changes that were applied (if successful)
   * @param error - The error that occurred (if failed)
   * @param store - The store instance
   * @throws MiddlewareError if the batch cannot be started. It is handled internally by the store and logged. The store will proceed with the next plugins if available.
   */
  onTransactionEnd?: (
    success: boolean,
    store: Store<S>,
    changes?: Partial<S>,
    error?: Error
  ) => void
}

/**
 * Metadata stored with persisted state
 */
export interface StateMetadata {
  lastUpdated: number
  sessionId: string | null
  storeName?: string
}

/**
 * Wrapper for state with metadata
 */
export interface PersistedState<S extends object> {
  data: S
  meta: StateMetadata
}

/**
 * Additional cleanup options for store
 */
export interface CleanupOptions {
  removePersistedState?: boolean
  clearHistory?: boolean
  resetRegistry?: boolean // Reset the global store registry
}

/**
 * Options for store creation
 * @typeParam S - The type of the state
 */
export interface StoreOptions<S extends object> {
  persistKey?: string
  storageType?: StorageType
  cookieOptions?: CookieStorageOptions
  cookiePrefix?: string // For improved cookie cleanup
  syncAcrossTabs?: boolean
  middleware?: Middleware<S>[]
  historyLimit?: number
  name?: string
  staleAge?: number
  cleanupStaleStatesOnLoad?: boolean // Renamed for clarity
  cleanupOptions?: CleanupOptions
  plugins?: Plugin<S>[]
  onError?: (error: StoreError) => void // Centralized error handler
}

/**
 * A read-only interface for a state store that provides access to application state
 * without allowing direct mutations.
 *
 * @template S - The type of the state object, must extend object
 *
 * @example
 * ```typescript
 * const store: ReadOnlyStore<{ count: number }> = createStore();
 * const state = store.getState();
 * const unsubscribe = store.subscribe((state) => console.log(state));
 * const selectCount = store.select(state => state.count);
 * ```
 */
export interface ReadOnlyStore<S extends object> {
  /**
   * Retrieves the current state of the store.
   *
   * @remarks
   * Returns a frozen copy of the state in development mode to prevent accidental mutations.
   * During batching operations, returns the state with all batched actions applied.
   * The returned state object maintains reference equality for memoization optimizations.
   *
   * @returns The current state object, frozen in development mode
   *
   * @example
   * ```typescript
   * const userStore = createStore({ name: '', age: 0 });
   * const currentState = userStore.getState();
   * console.log(currentState); // { name: '', age: 0 }
   * ```
   *
   * @see {@link ReadOnlyStore | ReadOnlyStore} for computed state access
   * @see {@link Store.dispatch} for state updates
   */
  getState: () => S

  /**
   * Subscribes to state changes in the store.
   *
   * @remarks
   * The listener is called whenever the state changes, receiving both the new and previous state.
   * The subscription is automatically cleaned up when the store is destroyed.
   * Multiple listeners can be registered and will be called in the order they were added.
   *
   * @param listener - Function called when state changes
   * @returns Unsubscribe function to stop listening to state changes
   *
   * @example
   * ```typescript
   * const unsubscribe = store.subscribe((newState, prevState) => {
   *   console.log('State changed from', prevState, 'to', newState);
   * });
   *
   * // Later, when you want to stop listening
   * unsubscribe();
   * ```
   *
   * @see {@link Listener} for the listener function signature
   */
  subscribe: (listener: Listener<S>) => () => void

  /**
   * Subscribe to changes in a specific part of the state using a selector.
   *
   * @template T - The type of the selected value
   * @param selector - Function that selects the value to watch from the state
   * @param listener - Callback invoked when the selected value changes
   * @param options - Optional configuration for the subscription behavior
   * @returns Unsubscribe function to stop listening to changes
   *
   * @remarks
   * This method creates a targeted subscription that only triggers when the specific
   * selected value changes, providing better performance than subscribing to all state changes.
   * The selector is memoized automatically for optimal performance.
   *
   * @example
   * ```typescript
   * // Subscribe to user name changes
   * const unsubscribe = store.subscribeTo(
   *   (state) => state.user.name,
   *   (newName, oldName) => {
   *     console.log(`User name changed: ${oldName} → ${newName}`);
   *   },
   *   { immediate: true, debounceMs: 100 }
   * );
   *
   * // Later, stop listening
   * unsubscribe();
   * ```
   *
   * @see {@link subscribeToMultiple} for watching multiple values
   * @see {@link subscribeToPath} for path-based subscriptions
   * @see {@link DependencyListener} for the listener function signature
   * @see {@link DependencySubscriptionOptions} for available options
   */
  subscribeTo: <T>(
    selector: Selector<S, T>,
    listener: DependencyListener<T>,
    options?: DependencySubscriptionOptions
  ) => () => void

  /**
   * Subscribe to changes in multiple state values using multiple selectors.
   *
   * @template P - Array of selector types
   * @param selectors - Array of selectors to watch for changes
   * @param listener - Callback invoked when any selected value changes
   * @param options - Optional configuration for the subscription behavior
   * @returns Unsubscribe function to stop listening to changes
   *
   * @remarks
   * This method allows efficient monitoring of multiple state values with a single subscription.
   * The listener is called whenever any of the selected values change, receiving arrays of
   * new and old values corresponding to the selector order.
   *
   * @example
   * ```typescript
   * // Watch user name, email, and active status
   * const unsubscribe = store.subscribeToMultiple(
   *   [
   *     (state) => state.user.name,
   *     (state) => state.user.email,
   *     (state) => state.user.isActive
   *   ],
   *   (newValues, oldValues) => {
   *     const [newName, newEmail, newIsActive] = newValues;
   *     const [oldName, oldEmail, oldIsActive] = oldValues;
   *
   *     console.log('User data changed:', {
   *       name: { old: oldName, new: newName },
   *       email: { old: oldEmail, new: newEmail },
   *       isActive: { old: oldIsActive, new: newIsActive }
   *     });
   *   },
   *   { debounceMs: 300 }
   * );
   * ```
   *
   * @see {@link subscribeTo} for single value subscriptions
   * @see {@link subscribeToPath} for path-based subscriptions
   */
  subscribeToMultiple: <P extends Selector<S, any>[]>(
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
  ) => () => void

  /**
   * Subscribe to changes in specific state paths using dot notation.
   *
   * @template T - The type of the value at the specified path
   * @param path - Dot-separated path to the state value (e.g., 'user.profile.name')
   * @param listener - Callback invoked when the path value changes
   * @param options - Optional configuration for the subscription behavior
   * @returns Unsubscribe function to stop listening to changes
   *
   * @remarks
   * This method provides a convenient way to subscribe to deeply nested state properties
   * using string paths instead of selector functions. The path is converted internally
   * to a selector for optimal performance.
   *
   * @example
   * ```typescript
   * // Subscribe to theme changes using path notation
   * const unsubscribe = store.subscribeToPath(
   *   'user.preferences.theme',
   *   (newTheme, oldTheme) => {
   *     document.body.className = `theme-${newTheme}`;
   *   },
   *   { immediate: true }
   * );
   *
   * // Subscribe to nested array element
   * store.subscribeToPath(
   *   'items.0.completed',
   *   (newCompleted, oldCompleted) => {
   *     console.log(`First item completion: ${oldCompleted} → ${newCompleted}`);
   *   }
   * );
   * ```
   *
   * @see {@link Store.subscribeTo} for selector-based subscriptions
   * @see {@link Store.subscribeToMultiple} for multiple value subscriptions
   */
  subscribeToPath: <T = any>(
    path: string | (string | number)[],
    listener: DependencyListener<T>,
    options?: DependencySubscriptionOptions
  ) => () => void

  /**
   * Creates a memoized selector function for deriving computed values from the store state.
   *
   * @typeParam R - The return type of the computed selector result.
   * @typeParam P - A tuple of input selector functions, each mapping the state to a value.
   *
   * @remarks
   * This function supports two usage patterns:
   * 1. **Single selector:** Pass a single selector function to derive a value from the state.
   *    The returned function will recompute the result only when the state changes (deep equality).
   * 2. **Multiple selectors with projector:** Pass multiple input selectors followed by a projector function.
   *    The projector receives the results of the input selectors and computes the final value.
   *    The returned function will recompute only when any input selector's result changes (deep equality).
   *
   * Memoization is based on deep equality comparison of state and selector results, ensuring efficient recomputation.
   * The returned selector function includes a `lastValue` property for accessing the most recent computed value.
   *
   * @param args - Either a single selector function, or multiple selectors followed by a projector function.
   * @returns A memoized function that computes the derived value, with an optional `lastValue` property
   *
   * @example
   * ```typescript
   * // Single selector usage
   * const selectCount = store.select(state => state.count);
   * const count = selectCount(); // Returns the current count
   * console.log(selectCount.lastValue); // Access last computed value
   *
   * // Multiple selectors with projector
   * const selectSum = store.select(
   *   state => state.a,
   *   state => state.b,
   *   (a, b) => a + b
   * );
   * const sum = selectSum(); // Returns the sum of a and b
   * ```
   *
   * @see {@link Selector} for the selector type definition
   * @see {@link Store.selectWith} for parameterized selectors
   */
  select: <R, P extends Selector<S, any>[]>(
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
  ) => (() => R) & {lastValue?: R}

  /**
   * Gets the name of the store if one was provided during creation.
   *
   * @remarks
   * Store names are useful for debugging, logging, and identifying stores in development tools.
   * The name is also used in error messages and plugin identification.
   *
   * @returns The store name if provided, undefined otherwise
   *
   * @example
   * ```typescript
   * const store = createStore(initialState, { name: 'UserStore' });
   * console.log(store.getName()); // 'UserStore'
   * ```
   */
  getName: () => string | undefined

  /**
   * Gets the unique session identifier for this store instance.
   *
   * @remarks
   * Session IDs are used for cross-tab synchronization and store registry management.
   * Each browser session gets a unique identifier that persists until the tab is closed.
   * This is useful for debugging multi-tab scenarios and preventing sync loops.
   *
   * @returns The session ID string, or null if session management is disabled
   *
   * @example
   * ```typescript
   * const sessionId = store.getSessionId();
   * console.log('Store session:', sessionId); // e.g., 'sess_1234567890'
   * ```
   *
   * @see {@link StoreOptions.syncAcrossTabs} for cross-tab synchronization
   */
  getSessionId: () => string | null

  /**
   * Gets the current history of state changes.
   *
   * @remarks
   * Returns an object containing the history of states, the current index in the history,
   * and the initial state. The history is an array of states, allowing for undo/redo operations.
   * The initial state is the state provided when the store was created.
   *
   * @returns An object with `history`, `currentIndex`, and `initialState`
   *
   * @example
   * ```typescript
   * const history = store.getHistory();
   * console.log(history.history); // Array of past states
   * console.log(history.currentIndex); // Current position in history
   * console.log(history.initialState); // Initial state of the store
   * ```
   */
  getHistory: () => {
    history: readonly S[]
    currentIndex: number
    initialState: Readonly<S> | null
  }
}

/**
 * Store instance interface that extends {@link ReadOnlyStore} with mutation capabilities.
 * Provides comprehensive state management with persistence, history, transactions, and advanced features.
 *
 * @template S - The type of the state object, must extend object
 *
 * @example
 * ```typescript
 * interface AppState {
 *   user: { name: string; age: number };
 *   settings: { theme: 'light' | 'dark' };
 * }
 *
 * const store = createStore<AppState>({
 *   user: { name: '', age: 0 },
 *   settings: { theme: 'light' }
 * });
 *
 * // Dispatch state changes
 * store.dispatch({ user: { name: 'John', age: 30 } });
 *
 * // Use transactions for atomic updates with Immer
 * store.transaction(draft => {
 *   draft.user.age = 31;
 *   draft.user.lastUpdated = Date.now();
 * });
 * ```
 */
export interface Store<S extends object> extends ReadOnlyStore<S> {
  /**
   * Dispatches an action to update the store state.
   *
   * @remarks
   * This is the primary method for updating store state. It supports both direct state updates
   * and async thunk functions. State updates are merged with the current state, and all
   * middleware and plugins are invoked during the dispatch process.
   *
   * For thunk functions, the return type is preserved, allowing both synchronous and
   * asynchronous operations with proper TypeScript inference.
   *
   * @param action - Either a partial state object for direct updates, or a thunk function for complex logic
   * @returns void for state updates, or the thunk's return value (sync/async) for thunk actions
   *
   * @example
   * ```typescript
   * // Direct state update
   * store.dispatch({ count: 42 });
   *
   * // Async thunk
   * const result = await store.dispatch(async (dispatch, getState) => {
   *   const response = await fetch('/api/data');
   *   const data = await response.json();
   *   dispatch({ data });
   *   return data;
   * });
   *
   * // Sync thunk
   * const computed = store.dispatch((dispatch, getState) => {
   *   const state = getState();
   *   dispatch({ computed: state.a + state.b });
   *   return state.a + state.b;
   * });
   * ```
   *
   * @see {@link ActionPayload} for direct state updates
   * @see {@link Thunk} for async/sync logic functions
   * @see {@link Dispatch} for the dispatch function type
   */
  dispatch: Dispatch<S>

  /**
   * Updates the state with partial changes (alias for dispatching a partial state).
   *
   * @deprecated Prefer {@link Store.dispatch} for all state modifications.
   * This method is provided for backward compatibility but dispatch() is the recommended approach.
   *
   * @remarks
   * This method directly merges the provided partial state with the current state.
   * It's equivalent to calling `dispatch(newState)` but doesn't support thunk functions.
   *
   * @param newState - Partial state object to merge with current state
   *
   * @example
   * ```typescript
   * // Using setState (deprecated)
   * store.setState({ count: 42 });
   *
   * // Preferred approach using dispatch
   * store.dispatch({ count: 42 });
   * ```
   */
  setState: (newState: Partial<S>) => void

  /**
   * Resets the store to its initial state.
   *
   * @remarks
   * This operation clears the current state and restores the initial state provided
   * during store creation. History is preserved unless explicitly cleared through
   * cleanup options. All subscribers are notified of the state change.
   *
   * @example
   * ```typescript
   * const store = createStore({ count: 0, name: 'Initial' });
   * store.dispatch({ count: 42, name: 'Updated' });
   * store.reset(); // State is back to { count: 0, name: 'Initial' }
   * ```
   *
   * @see {@link destroy} for complete store cleanup
   */
  reset: () => void

  /**
   * Reverts the store state to a previous point in history.
   *
   * @remarks
   * Undo operations require that history tracking is enabled via {@link StoreOptions.historyLimit}.
   * The operation fails silently if there's no history to undo to, or if history tracking
   * is disabled. Plugins can intercept and prevent undo operations via the beforeHistoryChange hook.
   *
   * @param steps - Number of steps to go back in history (defaults to 1)
   * @returns True if the undo operation succeeded, false if no history was available or operation was prevented
   *
   * @example
   * ```typescript
   * const store = createStore({ count: 0 }, { historyLimit: 10 });
   * store.dispatch({ count: 1 });
   * store.dispatch({ count: 2 });
   *
   * const success = store.undo(); // Back to count: 1
   * console.log(success); // true
   *
   * store.undo(2); // Try to go back 2 more steps
   * ```
   *
   * @see {@link Store.redo} for forward history navigation
   * @see {@link StoreOptions.historyLimit} for enabling history tracking
   */
  undo: (steps?: number, path?: (string | number)[]) => boolean

  /**
   * Moves forward in the store's history to a more recent state.
   *
   * @remarks
   * Redo operations work with states that were previously undone. Like undo, this requires
   * history tracking to be enabled. The operation fails silently if there's no forward
   * history available. Plugins can intercept and prevent redo operations.
   *
   * @param steps - Number of steps to move forward in history (defaults to 1)
   * @returns True if the redo operation succeeded, false if no forward history was available or operation was prevented
   *
   * @example
   * ```typescript
   * const store = createStore({ count: 0 }, { historyLimit: 10 });
   * store.dispatch({ count: 1 });
   * store.dispatch({ count: 2 });
   * store.undo(); // Back to count: 1
   *
   * const success = store.redo(); // Forward to count: 2
   * console.log(success); // true
   * ```
   *
   * @see {@link Store.undo} for backward history navigation
   * @see {@link StoreOptions.historyLimit} for enabling history tracking
   */
  redo: (steps?: number, path?: (string | number)[]) => boolean

  /**
   * Completely destroys the store and performs cleanup operations.
   *
   * @remarks
   * This method permanently shuts down the store, unregisters it from the global registry,
   * removes event listeners, and optionally cleans up persisted state and history.
   * After destruction, the store should not be used for any operations.
   *
   * @param options - Optional cleanup configuration
   * @param options.removePersistedState - Whether to remove persisted state from storage (defaults to false)
   * @param options.clearHistory - Whether to clear the undo/redo history (defaults to true)
   * @param options.resetRegistry - Whether to reset the global store registry (defaults to false)
   *
   * @example
   * ```typescript
   * // Basic destruction
   * store.destroy();
   *
   * // Destroy and cleanup all traces
   * store.destroy({
   *   removePersistedState: true,
   *   clearHistory: true,
   *   resetRegistry: true
   * });
   * ```
   *
   * @see {@link CleanupOptions} for available cleanup options
   * @see {@link Store.reset} for resetting state without destroying the store
   */
  destroy: (options?: CleanupOptions) => void

  /**
   * Updates a value at a specific path in the state using an updater function.
   *
   * @template V - The type of the value at the specified path
   * @param path - Array of keys/indices representing the path to the value
   * @param updater - Function that receives the current value and returns the new value
   *
   * @remarks
   * This method uses Immer's {@link https://immerjs.github.io/immer/produce | produce} function
   * to safely update nested state values while maintaining immutability and structural sharing.
   * The updater function receives the current value and should return the new value.
   *
   * Benefits over manual path updates:
   * - Automatic structural sharing for unchanged parts of state
   * - Safe handling of complex nested objects, arrays, Maps, and Sets
   * - Better TypeScript support with draft mutations
   * - Eliminates manual diff calculation and potential mutation bugs
   *
   * @example
   * ```typescript
   * // Update a nested object property
   * store.updatePath(['user', 'profile', 'name'], (currentName) => 'John Doe');
   *
   * // Update array element
   * store.updatePath(['todos', 0, 'completed'], (completed) => !completed);
   *
   * // Update Map entry
   * store.updatePath(['userMap'], (map) => {
   *   const newMap = new Map(map);
   *   newMap.set('123', { name: 'Updated User' });
   *   return newMap;
   * });
   * ```
   *
   * @see {@link https://immerjs.github.io/immer/produce | Immer produce documentation}
   * @see {@link transaction} for multiple related updates
   */
  updatePath: <V = any>(path: (string | number)[], updater: (currentValue: V) => V) => void

  /**
   * Batches multiple state updates into a single notification to subscribers.
   *
   * @remarks
   * Batching is useful for performance optimization when making multiple related state changes.
   * Instead of notifying subscribers after each individual dispatch, all changes within the
   * batch function are collected and applied as a single update. This reduces the number of
   * re-renders in UI frameworks and improves performance.
   *
   * Nested batches are supported - inner batches are absorbed into the outermost batch.
   * If an error occurs during batching, the entire batch is rolled back.
   *
   * @param fn - Function that can call dispatch multiple times; these will be batched
   *
   * @example
   * ```typescript
   * // Without batching: triggers 3 separate notifications
   * store.dispatch({ count: 1 });
   * store.dispatch({ name: 'John' });
   * store.dispatch({ active: true });
   *
   * // With batching: triggers only 1 notification at the end
   * store.batch(() => {
   *   store.dispatch({ count: 1 });
   *   store.dispatch({ name: 'John' });
   *   store.dispatch({ active: true });
   * });
   *
   * // Complex batching with conditional logic
   * store.batch(() => {
   *   const currentState = store.getState();
   *   if (currentState.count < 10) {
   *     store.dispatch({ count: currentState.count + 1 });
   *   }
   *   store.dispatch({ lastUpdated: Date.now() });
   * });
   * ```
   *
   * @see {@link Store.transaction} for atomic updates with rollback capabilities
   */
  batch: (fn: () => void) => void

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

  transaction: (recipe: (draft: Draft<S>) => void) => boolean

  /**
   * Creates a read-only view of the store that prevents accidental mutations.
   *
   * @remarks
   * The read-only store provides access to all state reading and selection capabilities
   * but removes mutation methods like dispatch, setState, and transaction. This is useful
   * for passing store access to components or modules that should only read state.
   *
   * The read-only store maintains the same subscription and selector functionality,
   * including memoization and performance optimizations.
   *
   * @returns A read-only interface to the store without mutation capabilities
   *
   * @example
   * ```typescript
   * const store = createStore({ count: 0, user: { name: 'John' } });
   * const readOnlyStore = store.asReadOnly();
   *
   * // These work fine
   * const state = readOnlyStore.getState();
   * const unsubscribe = readOnlyStore.subscribe(state => console.log(state));
   * const selectCount = readOnlyStore.select(state => state.count);
   *
   * // These methods don't exist on read-only store
   * // readOnlyStore.dispatch({ count: 1 }); // TypeScript error
   * // readOnlyStore.setState({ count: 1 }); // TypeScript error
   * ```
   *
   * @see {@link ReadOnlyStore} for the read-only interface definition
   */
  asReadOnly: () => ReadOnlyStore<S>

  /**
   * Creates a parameterized selector that accepts runtime parameters for dynamic state selection.
   *
   *
   * Parameterized selectors allow you to create reusable selector logic that can be customized
   * with different parameters at runtime. Each unique parameter combination gets its own memoized
   * selector instance, providing optimal performance while maintaining flexibility.
   *
   * The function uses a curried approach: the projector function takes parameters first, then
   * returns a combiner function that operates on the input selector results. This design enables
   * powerful memoization strategies where each parameter set maintains its own cache.
   *
   * @template Props - The type of parameters the selector accepts
   * @template R - The return type of the computed selector result
   * @template P - A tuple of input selector functions
   *
   * @param inputSelectors - Array of state selectors that extract values from the state
   * @param projector - Curried function that takes parameters and returns a combiner function
   * @returns A function that accepts parameters and returns a memoized selector
   *
   * @example
   * ```typescript
   * interface FilterParams {
   *   minAge: number;
   *   department?: string;
   * }
   *
   * // Create parameterized selector
   * const selectFilteredUsers = store.selectWith(
   *   [state => state.users, state => state.departments] as const,
   *   (filters: FilterParams) =>
   *     (users, departments) => users.filter(user => {
   *       if (user.age < filters.minAge) return false;
   *       if (filters.department && user.department !== filters.department) return false;
   *       return true;
   *     })
   * );
   *
   * // Use with different parameters
   * const engineersOver25 = selectFilteredUsers({
   *   minAge: 25,
   *   department: 'Engineering'
   * });
   * const allOver30 = selectFilteredUsers({ minAge: 30 });
   *
   * // Get the filtered results
   * const engineers = engineersOver25();
   * const seniors = allOver30();
   *
   * // Simple parameterized selector
   * const selectUserById = store.selectWith(
   *   [state => state.users] as const,
   *   (userId: string) => users => users.find(u => u.id === userId)
   * );
   *
   * const getUser42 = selectUserById('user-42');
   * const user = getUser42();
   * ```
   *
   * @see {@link Store.select} for simple selectors without parameters
   * @see {@link Selector} for the selector type definition
   */
  selectWith: <Props, R, P extends Selector<S, any>[]>(
    inputSelectors: readonly [...P],
    projector: (params: Props) => (
      ...results: {
        [K in keyof P]: P[K] extends Selector<S, infer RT> ? RT : never
      }
    ) => R
  ) => (params: Props) => (() => R) & {lastValue?: R}

  /**
   * Internal method for Redux DevTools to set state directly without going through dispatch.
   * This bypasses middleware and plugins to prevent infinite loops during time travel.
   * @internal
   * @param newState - The new state to set
   * @param isTimeTravel - Whether this is a time travel operation (defaults to true)
   */
  _setStateForDevTools?: (newState: S, isTimeTravel?: boolean) => void
}

/**
 * Interface for the validator function used in createValidatorMiddleware.
 *
 * @template S - The type of the state object
 * @param state - The proposed next state after applying the action
 * @param action - The action being applied
 * @param prevState - The previous state before the action
 * @returns True if the state is valid, false otherwise, or a Promise resolving to a boolean
 *
 * @example
 * ```typescript
 * const validator: ValidatorFn<AppState> = (state, action, prevState) => {
 *   return state.count >= 0;
 * };
 * ```
 */
export interface ValidatorFn<S extends object> {
  (state: S, action: ActionPayload<S>, prevState: S): boolean | Promise<boolean>
}

/**
 * Interface for the validation error handler used in createValidatorMiddleware.
 *
 * @template S - The type of the state object
 * @param error - The ValidationError instance
 * @param action - The action that caused the validation error
 *
 * @example
 * ```typescript
 * const errorHandler: ValidationErrorHandler<AppState> = (error, action) => {
 *   console.error(error.message, action);
 * };
 * ```
 */
export interface ValidationErrorHandler<S extends object> {
  (error: ValidationError, action: ActionPayload<S>): void
}
