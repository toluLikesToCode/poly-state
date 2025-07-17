/**
 * @fileoverview React integration type definitions for Poly State
 *
 * This module contains all TypeScript type definitions and interfaces for the React
 * integration of Poly State. These types provide comprehensive IntelliSense
 * support and documentation for developers using the package.
 *
 * @example
 * ```tsx
 * import type { StoreContextResult, StoreHooks } from 'poly-state/react';
 * import { createStoreContext } from 'poly-state/react';
 *
 * // Type-safe store context creation
 * interface AppState { count: number; user: { name: string } }
 * const context: StoreContextResult<AppState> = createStoreContext(store);
 * ```
 */

import type {ReactNode, ComponentType, DependencyList} from 'react'
import type {Store, ReadOnlyStore, Thunk} from '../core/state/index'
import type {
  Selector,
  DependencyListener,
  DependencySubscriptionOptions,
} from '../core/selectors/index'
import type {Draft} from 'immer'

/**
 * Context value containing the store instance
 * @template S - The shape of the state object
 * @public
 */
export interface StoreContextValue<S extends object> {
  /** The store instance providing state management capabilities */
  store: Store<S>
}

/**
 * Hook that provides access to the raw store instance with full capabilities
 * @template S - The shape of the state object
 * @returns The complete store instance
 * @public
 *
 * @example
 * ```tsx
 * const store = useStore();
 * const state = store.getState();
 * const unsubscribe = store.subscribe(() => console.log('State changed'));
 * ```
 */
export type UseStoreHook<S extends object> = () => Store<S>

/**
 * Hook that selects and subscribes to specific parts of the state
 * @template S - The shape of the state object
 * @template R - The return type of the selector
 * @param selector - Function that extracts a value from the state
 * @returns The selected value that updates when the relevant state changes
 * @public
 *
 * @example
 * ```tsx
 * const count = useSelector(state => state.count);
 * const userName = useSelector(state => state.user.name);
 * const todoCount = useSelector(state => state.todos.length);
 * ```
 */
/**
 * Hook that selects and subscribes to specific parts of the state
 * Supports both single selector and multiple selectors with projector patterns
 * @template S - The shape of the state object
 */
export type UseSelectorHook<S extends object> = {
  // Single selector overload
  <R>(selector: Selector<S, R>): R

  // Multiple selectors with projector overload
  <R, P extends Selector<S, any>[]>(
    ...args: [
      ...P,
      (
        ...results: {
          [K in keyof P]: P[K] extends Selector<S, infer RT> ? RT : never
        }
      ) => R,
    ]
  ): R
}

export type UseCombinedSelectorHook<S extends object> = <R, P extends Selector<S, any>[]>(
  ...args: [
    ...P,
    (
      ...results: {
        [K in keyof P]: P[K] extends Selector<S, infer RT> ? RT : never
      }
    ) => R,
  ]
) => R

/**
 * Hook that provides the dispatch function for updating state
 * @template S - The shape of the state object
 * @returns Function to dispatch actions or thunks
 * @public
 *
 * @example
 * ```tsx
 * const dispatch = useDispatch();
 *
 * // Dispatch state updates
 * dispatch({ count: 5 });
 * dispatch({ user: { name: 'John', email: 'john@example.com' } });
 *
 * // Dispatch thunks
 * dispatch(async (dispatch, getState) => {
 *   const data = await fetch('/api/data');
 *   dispatch({ data: await data.json() });
 * });
 * ```
 */
export type UseDispatchHook<S extends object> = () => Store<S>['dispatch']

/**
 * Hook that provides access to the complete store state
 * @template S - The shape of the state object
 * @returns The entire state object that updates when any part changes
 * @public
 *
 * @example
 * ```tsx
 * const state = useStoreState();
 * console.log(state.count, state.user.name, state.todos);
 * ```
 */
export type UseStoreStateHook<S extends object> = () => S

/**
 * Hook that subscribes to changes in a specific selected value
 * @template S - The shape of the state object
 * @template R - The return type of the selector
 * @param selector - Function that extracts a value from the state
 * @param listener - Callback invoked when the selected value changes
 * @param options - Optional subscription configuration
 * @public
 *
 * @example
 * ```tsx
 * useSubscribeTo(
 *   state => state.user.theme,
 *   (newTheme, oldTheme) => {
 *     document.body.className = `theme-${newTheme}`;
 *     console.log(`Theme changed from ${oldTheme} to ${newTheme}`);
 *   },
 *   { immediate: true }
 * );
 * ```
 */
export type UseSubscribeToHook<S extends object> = <R>(
  selector: Selector<S, R>,
  listener: DependencyListener<R>,
  options?: DependencySubscriptionOptions
) => void

/**
 * Hook that subscribes to changes at a specific state path
 * @template T - The type of value at the path
 * @param path - Dot-separated path to the state value (e.g., 'user.profile.name')
 * @param listener - Callback invoked when the path value changes
 * @param options - Optional subscription configuration
 * @public
 *
 * @example
 * ```tsx
 * useSubscribeToPath(
 *   'user.preferences.theme',
 *   (newTheme, oldTheme) => {
 *     updateThemeClass(newTheme);
 *     saveThemePreference(newTheme);
 *   }
 * );
 *
 * useSubscribeToPath(
 *   ['todos', 0, 'completed'],
 *   (isCompleted) => {
 *     if (isCompleted) showCelebration();
 *   }
 * );
 * ```
 */
export type UseSubscribeToPathHook = <T = any>(
  path: string | (string | number)[],
  listener: DependencyListener<T>,
  options?: DependencySubscriptionOptions
) => void

/**
 * Hook that accesses a specific value by path and subscribes to its changes
 * @template T - The type of value at the path
 * @param path - Dot-separated path to the state value (e.g., 'user.profile.name')
 * @returns The value at the specified path that updates when it changes
 * @public
 *
 * @example
 * ```tsx
 * const userName = useStoreValue<string>('user.name');
 * const themeMode = useStoreValue<'light' | 'dark'>('settings.theme');
 * const firstTodoText = useStoreValue<string>('todos.0.text');
 * const userAge = useStoreValue<number>('user.profile.age');
 * ```
 */
export type UseStoreValueHook = <T = any>(path: string) => T

/**
 * Hook that provides a transaction function for atomic state updates
 * @template S - The shape of the state object
 * @returns Function that executes mutations atomically using Immer
 * @public
 *
 * @example
 * ```tsx
 * const transaction = useTransaction();
 *
 * const updateUserProfile = (name: string, email: string) => {
 *   transaction(draft => {
 *     draft.user.name = name;
 *     draft.user.email = email;
 *     draft.user.lastUpdated = Date.now();
 *     draft.user.profileComplete = true;
 *   });
 * };
 *
 * const addTodoWithCounter = (text: string) => {
 *   transaction(draft => {
 *     draft.todos.push({ id: Date.now(), text, completed: false });
 *     draft.stats.totalTodos += 1;
 *   });
 * };
 * ```
 */
export type UseTransactionHook<S extends object> = () => (
  recipe: (draft: Draft<S>) => void
) => boolean

/**
 * Hook that provides a batch function for grouping multiple updates
 * @returns Function that batches multiple dispatches into a single notification
 * @public
 *
 * @example
 * ```tsx
 * const batch = useBatch();
 * const dispatch = useDispatch();
 *
 * const updateMultipleFields = () => {
 *   batch(() => {
 *     dispatch({ count: 1 });
 *     dispatch({ user: { name: 'John' } });
 *     dispatch({ settings: { theme: 'dark' } });
 *     dispatch({ lastActivity: Date.now() });
 *   });
 * };
 *
 * const resetForm = () => {
 *   batch(() => {
 *     dispatch({ form: { name: '', email: '', message: '' } });
 *     dispatch({ errors: {} });
 *     dispatch({ submitted: false });
 *   });
 * };
 * ```
 */
export type UseBatchHook = () => (fn: () => void) => void

/**
 * Hook that provides a function for updating values at specific paths
 * @returns Function that updates a value at a given path using an updater function
 * @public
 *
 * @example
 * ```tsx
 * const updatePath = useUpdatePath();
 *
 * const incrementCount = () => {
 *   updatePath(['count'], (current: number) => current + 1);
 * };
 *
 * const updateUserName = (name: string) => {
 *   updatePath(['user', 'name'], () => name);
 * };
 *
 * const toggleTodoComplete = (index: number) => {
 *   updatePath(['todos', index, 'completed'], (current: boolean) => !current);
 * };
 * ```
 */
export type UseUpdatePathHook = () => <V = any>(
  path: (string | number)[],
  updater: (currentValue: V) => V
) => void

/**
 * Store history state information
 * @template S - The shape of the state object
 * @public
 */
export interface StoreHistoryState<S extends object> {
  /** Array of historical states */
  history: readonly S[]
  /** Current position in history */
  currentIndex: number
  /** The initial state when store was created */
  initialState: Readonly<S> | null
  /** Function to undo one or more steps */
  undo: (steps?: number) => boolean
  /** Function to redo one or more steps */
  redo: (steps?: number) => boolean
  /** Whether undo is possible */
  canUndo: boolean
  /** Whether redo is possible */
  canRedo: boolean
}

/**
 * Hook that provides access to store history and undo/redo functionality
 * @template S - The shape of the state object
 * @returns Object with history state and navigation functions
 * @public
 *
 * @example
 * ```tsx
 * const { history, canUndo, canRedo, undo, redo, currentIndex } = useStoreHistory();
 *
 * return (
 *   <div className="history-controls">
 *     <button disabled={!canUndo} onClick={() => undo()}>
 *       ← Undo
 *     </button>
 *     <button disabled={!canRedo} onClick={() => redo()}>
 *       Redo →
 *     </button>
 *     <span>Step {currentIndex + 1} of {history.length}</span>
 *     <button onClick={() => undo(5)}>Undo 5 steps</button>
 *   </div>
 * );
 * ```
 */
export type UseStoreHistoryHook<S extends object> = () => StoreHistoryState<S>

/**
 * Hook that executes thunks (sync or async functions)
 * @template S - The shape of the state object
 * @returns Function that executes thunks and returns their result
 * @public
 *
 * @example
 * ```tsx
 * const executeThunk = useThunk();
 *
 * const loadUser = async () => {
 *   const user = await executeThunk(async ({dispatch, getState}) => {
 *     const response = await fetch('/api/user');
 *     const userData = await response.json();
 *     dispatch({ user: userData });
 *     return userData;
 *   });
 *   console.log('Loaded user:', user);
 * };
 *
 * const incrementCounter = () => {
 *   executeThunk(({dispatch, getState}) => {
 *     const current = getState().count;
 *     dispatch({ count: current + 1 });
 *   });
 * };
 * ```
 */
export type UseThunkHook<S extends object> = () => <R>(
  thunk: Thunk<S, R>
) => R extends Promise<any> ? Promise<R> : R

/**
 * Async thunk execution state
 * @template S - The shape of the state object
 * @public
 */
export interface AsyncThunkState<S extends object> {
  /** Function to execute async thunks */
  execute: <R>(thunk: Thunk<S, Promise<R>>) => Promise<R>
  /** Whether an async thunk is currently executing */
  loading: boolean
  /** Error from the last failed thunk execution */
  error: Error | null
}

/**
 * Hook for executing async thunks with loading and error state management
 * @template S - The shape of the state object
 * @returns Object with execute function and loading/error state
 * @public
 *
 * @example
 * ```tsx
 * const { execute, loading, error } = useAsyncThunk();
 *
 * const loadData = async () => {
 *   try {
 *     await execute(async (dispatch) => {
 *       const data = await fetchFromAPI();
 *       dispatch({ data, lastUpdated: Date.now() });
 *     });
 *   } catch (err) {
 *     console.error('Failed to load data:', error);
 *   }
 * };
 *
 * const saveProfile = async (profile: UserProfile) => {
 *   await execute(async (dispatch) => {
 *     await saveToAPI(profile);
 *     dispatch({ user: profile, saved: true });
 *   });
 * };
 *
 * if (loading) return <Spinner />;
 * if (error) return <ErrorMessage error={error} />;
 * ```
 */
export type UseAsyncThunkHook<S extends object> = () => AsyncThunkState<S>

/**
 * Hook that runs side effects when selected state values change
 * @template S - The shape of the state object
 * @template R - The return type of the selector
 * @param selector - Function that extracts a value from the state
 * @param effect - Effect function that runs when the selected value changes
 * @param deps - Optional React dependencies array
 * @public
 *
 * @example
 * ```tsx
 * // Update document title when user changes
 * useStoreEffect(
 *   state => state.user.name,
 *   (name, prevName) => {
 *     document.title = name ? `Welcome ${name}` : 'Welcome';
 *     console.log(`User changed from ${prevName} to ${name}`);
 *   }
 * );
 *
 * // Sync theme with body class
 * useStoreEffect(
 *   state => state.settings.theme,
 *   (theme) => {
 *     document.body.className = `theme-${theme}`;
 *     // Optional cleanup
 *     return () => {
 *       document.body.className = '';
 *     };
 *   }
 * );
 *
 * // Save to localStorage when data changes
 * useStoreEffect(
 *   state => state.preferences,
 *   (preferences) => {
 *     localStorage.setItem('preferences', JSON.stringify(preferences));
 *   }
 * );
 * ```
 */
export type UseStoreEffectHook<S extends object> = <R>(
  selector: Selector<S, R>,
  effect: (value: R, prevValue: R | undefined) => void | (() => void),
  deps?: DependencyList
) => void

/**
 * Complete collection of all React hooks provided by the store context
 * @template S - The shape of the state object
 * @public
 */
export interface StoreHooks<S extends object> {
  /** Hook to access the raw store instance with full capabilities */
  useStore: UseStoreHook<S>
  /** Hook to select and subscribe to specific parts of the state */
  useSelector: UseSelectorHook<S>

  /** Hook to access the combined selector for multiple state values */
  useCombinedSelector: UseCombinedSelectorHook<S>
  /** Hook to get the dispatch function for updating state */
  useDispatch: UseDispatchHook<S>
  /** Hook to access the complete store state */
  useStoreState: UseStoreStateHook<S>
  /** Hook to subscribe to changes in a specific selected value */
  useSubscribeTo: UseSubscribeToHook<S>
  /** Hook to subscribe to changes at a specific state path */
  useSubscribeToPath: UseSubscribeToPathHook
  /** Hook to access a specific value by path and subscribe to its changes */
  useStoreValue: UseStoreValueHook
  /** Hook to get a transaction function for atomic state updates */
  useTransaction: UseTransactionHook<S>
  /** Hook to get a batch function for grouping multiple updates */
  useBatch: UseBatchHook
  /** Hook to get a function for updating values at specific paths */
  useUpdatePath: UseUpdatePathHook
  /** Hook to access store history and undo/redo functionality */
  useStoreHistory: UseStoreHistoryHook<S>
  /** Hook to execute thunks (sync or async functions) */
  useThunk: UseThunkHook<S>
  /** Hook for executing async thunks with loading and error state management */
  useAsyncThunk: UseAsyncThunkHook<S>
  /** Hook to run side effects when selected state values change */
  useStoreEffect: UseStoreEffectHook<S>
}

/**
 * Complete result object returned by {@link createStoreContext}
 *
 * This interface provides all the React context and hooks needed for full
 * Poly State integration with React applications.
 *
 * @template S - The shape of the state object
 * @public
 *
 * @example
 * ```tsx
 * import { createStore } from 'poly-state';
 * import { createStoreContext } from 'poly-state/react';
 * import type { StoreContextResult } from 'poly-state/react';
 *
 * interface AppState {
 *   count: number;
 *   user: { name: string; email: string };
 *   todos: Array<{ id: number; text: string; completed: boolean }>;
 * }
 *
 * const store = createStore<AppState>({
 *   count: 0,
 *   user: { name: '', email: '' },
 *   todos: []
 * });
 *
 * const context: StoreContextResult<AppState> = createStoreContext(store);
 * const {
 *   StoreProvider,
 *   useSelector,
 *   useDispatch,
 *   useTransaction,
 *   useStoreValue
 * } = context;
 * ```
 */
export interface StoreContextResult<S extends object> extends StoreHooks<S> {
  /** React context for the store */
  StoreContext: React.Context<StoreContextValue<S> | null>

  /**
   * Provider component that makes the store available to child components
   *
   * @example
   * ```tsx
   * function App() {
   *   return (
   *     <StoreProvider>
   *       <Header />
   *       <MainContent />
   *       <Footer />
   *     </StoreProvider>
   *   );
   * }
   * ```
   */
  StoreProvider: React.FC<{children: ReactNode}>
}

/**
 * Props interface for components wrapped with {@link withStore}
 * @template S - The shape of the state object
 * @template P - The original props interface of the component
 * @public
 */
export type WithStoreProps<S extends object, P extends object = {}> = P & {
  /** Read-only store instance injected by the HOC */
  store: ReadOnlyStore<S>
}

/**
 * Higher-Order Component type for {@link withStore}
 * @template S - The shape of the state object
 * @template P - The props interface of the component being wrapped
 * @public
 */
export type WithStoreHOC<S extends object, P extends object> = (
  Component: ComponentType<WithStoreProps<S, P>>
) => React.FC<P>

/**
 * Configuration options for creating React integration
 * @template S - The shape of the state object
 * @public
 */
export interface CreateStoreContextOptions<S extends object> {
  /** The store instance to create React integration for */
  store: Store<S>
  /** Optional display name for the provider component */
  displayName?: string
  /** Whether to enable development mode features */
  devMode?: boolean
}

/**
 * Type guard to check if a value is a valid store context result
 * @template S - The shape of the state object
 * @param value - The value to check
 * @returns True if the value is a StoreContextResult
 * @public
 */
export function isStoreContextResult<S extends object>(value: any): value is StoreContextResult<S> {
  return (
    value &&
    typeof value === 'object' &&
    'StoreProvider' in value &&
    'useStore' in value &&
    'useSelector' in value &&
    'useDispatch' in value
  )
}

/**
 * Utility type for extracting the state type from a store context result
 * @template T - The StoreContextResult type
 * @public
 */
export type ExtractStoreState<T> = T extends StoreContextResult<infer S> ? S : never

/**
 * Utility type for extracting the state type from a store instance
 * @template T - The Store type
 * @public
 */
export type ExtractStateFromStore<T> = T extends Store<infer S> ? S : never

/**
 * Hook function that provides all store hooks without requiring context setup
 * @template S - The shape of the state object
 * @param store - The store instance to use
 * @returns All store hooks bound to the provided store instance
 * @public
 */
export type UseStoreHooksFunction = <S extends object>(
  store: Store<S>
) => Omit<StoreContextResult<S>, 'StoreContext' | 'StoreProvider'>
