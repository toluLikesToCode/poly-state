/**
 * @fileoverview React integration utilities for Universal Store
 *
 * This module provides React hooks and context providers that enable seamless integration
 * of the Universal Store with React applications. It includes hooks for state selection,
 * dispatching actions, transactions, path-based operations, and more.
 *
 * @example
 * ```tsx
 * import { createStore } from 'universal-store';
 * import { createStoreContext } from 'universal-store/react';
 *
 * const store = createStore({ count: 0, user: { name: 'John' } });
 * const { StoreProvider, useSelector, useDispatch } = createStoreContext(store);
 *
 * function Counter() {
 *   const count = useSelector(state => state.count);
 *   const dispatch = useDispatch();
 *
 *   return (
 *     <div>
 *       <span>{count}</span>
 *       <button onClick={() => dispatch({ count: count + 1 })}>+</button>
 *     </div>
 *   );
 * }
 *
 * function App() {
 *   return (
 *     <StoreProvider>
 *       <Counter />
 *     </StoreProvider>
 *   );
 * }
 * ```
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
  type ComponentType,
} from "react";
import type { Store, ReadOnlyStore, Thunk } from "../core/state/index";
import type {
  Selector,
  DependencyListener,
  DependencySubscriptionOptions,
} from "../core/selectors/index";
import type { Draft } from "immer";
import { getPath } from "../core/utils/path";

// Re-export all types for convenience
export * from "./types";

// Import types from the dedicated types file
import type {
  StoreContextValue,
  StoreContextResult,
  UseSubscribeToHook,
} from "./types";

/**
 * Creates React context and hooks for a store instance
 *
 * This is the main function for integrating Universal Store with React applications.
 * It creates a complete set of React hooks and context providers that allow components
 * to interact with the store using React patterns.
 *
 * @template S - The shape of the state object managed by the store
 * @param store - The store instance to create React integration for
 * @returns Object containing React context and all available hooks
 *
 * @example
 * **Basic Usage**
 * ```tsx
 * import { createStore } from 'universal-store';
 * import { createStoreContext } from 'universal-store/react';
 *
 * const store = createStore({ count: 0, user: { name: '' } });
 * const { StoreProvider, useSelector, useDispatch } = createStoreContext(store);
 *
 * function Counter() {
 *   const count = useSelector(state => state.count);
 *   const dispatch = useDispatch();
 *
 *   return (
 *     <div>
 *       <span>{count}</span>
 *       <button onClick={() => dispatch({ count: count + 1 })}>+</button>
 *     </div>
 *   );
 * }
 *
 * function App() {
 *   return (
 *     <StoreProvider>
 *       <Counter />
 *     </StoreProvider>
 *   );
 * }
 * ```
 *
 * @see {@link StoreContextResult} for all available hooks and their documentation
 * @see {@link Store} for the store interface
 */
export function createStoreContext<S extends object>(
  store: Store<S>
): StoreContextResult<S> {
  const StoreContext = createContext<StoreContextValue<S> | null>(null);

  const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const contextValue = useMemo(
      () => ({
        store: store,
      }),
      []
    );

    return React.createElement(
      StoreContext.Provider,
      { value: contextValue },
      children
    );
  };

  const useStore = (): Store<S> => {
    const context = useContext(StoreContext);
    if (!context) {
      throw new Error("useStore must be used within a StoreProvider");
    }
    return context.store;
  };

  const useSelector = <R>(selector: Selector<S, R>): R => {
    const store = useStore();
    const [selectedValue, setSelectedValue] = useState<R>(() =>
      selector(store.getState())
    );

    useEffect(() => {
      // Update the value immediately in case the selector or store changed
      const newValue = selector(store.getState());
      setSelectedValue(newValue);

      const unsubscribe = store.subscribe(() => {
        const latestValue = selector(store.getState());
        setSelectedValue(latestValue);
      });

      return unsubscribe;
    }, [store, selector]);

    return selectedValue;
  };

  const useDispatch = (): Store<S>["dispatch"] => {
    const context = useContext(StoreContext);
    if (!context) {
      throw new Error("useDispatch must be used within a StoreProvider");
    }

    const writableStore = context.store as any as Store<S>;
    if (!writableStore.dispatch) {
      throw new Error("Store does not support dispatching actions");
    }

    return writableStore.dispatch;
  };

  const useStoreState = (): S => {
    const store = useStore();
    const [state, setState] = useState<S>(() => store.getState());

    useEffect(() => {
      const unsubscribe = store.subscribe(() => {
        setState(store.getState());
      });

      return unsubscribe;
    }, [store]);

    return state;
  };

  const useSubscribeTo: UseSubscribeToHook<S> = <R>(
    selector: Selector<S, R>,
    listener: DependencyListener<R>,
    options?: DependencySubscriptionOptions
  ) => {
    const store = useStore();
    const listenerRef = useRef(listener);
    listenerRef.current = listener;

    useEffect(() => {
      return store.subscribeTo(
        selector,
        (newVal, oldVal) => listenerRef.current(newVal, oldVal),
        options
      );
    }, [store, selector, options?.immediate]);
  };

  const useSubscribeToPath = <T = any>(
    path: string,
    listener: DependencyListener<T>,
    options?: DependencySubscriptionOptions
  ) => {
    const store = useStore();
    const listenerRef = useRef(listener);
    listenerRef.current = listener;

    useEffect(() => {
      return store.subscribeToPath(
        path,
        (newVal: T, oldVal: T) => listenerRef.current(newVal, oldVal),
        options
      );
    }, [store, path, options?.immediate]);
  };

  const useStoreValue = <T = any>(path: string): T => {
    const store = useStore();
    const pathArray = path.split(".");
    const [value, setValue] = useState<T>(() => {
      const state = store.getState();
      return getPath(state, pathArray) as T;
    });

    useEffect(() => {
      return store.subscribeToPath(path, (newVal: T) => {
        setValue(newVal);
      });
    }, [store, path]);

    return value;
  };

  const useTransaction = () => {
    const store = useStore();

    return useCallback(
      (recipe: (draft: Draft<S>) => void) => {
        return store.transaction(recipe);
      },
      [store]
    );
  };

  const useBatch = () => {
    const store = useStore();

    return useCallback(
      (fn: () => void) => {
        store.batch(fn);
      },
      [store]
    );
  };

  const useUpdatePath = () => {
    const store = useStore();

    return useCallback(
      <V = any>(path: (string | number)[], updater: (currentValue: V) => V) => {
        store.updatePath(path, updater);
      },
      [store]
    );
  };

  const useStoreHistory = () => {
    const store = useStore();
    const [historyState, setHistoryState] = useState(() => store.getHistory());

    useEffect(() => {
      const unsubscribe = store.subscribe(() => {
        setHistoryState(store.getHistory());
      });
      return unsubscribe;
    }, [store]);

    const undo = useCallback((steps?: number) => store.undo(steps), [store]);
    const redo = useCallback((steps?: number) => store.redo(steps), [store]);

    return {
      ...historyState,
      undo,
      redo,
      canUndo: historyState.currentIndex > 0,
      canRedo: historyState.currentIndex < historyState.history.length - 1,
    };
  };

  const useThunk = () => {
    const dispatch = useDispatch();

    return useCallback(
      <R>(thunk: Thunk<S, R>) => {
        return dispatch(thunk);
      },
      [dispatch]
    );
  };

  const useAsyncThunk = () => {
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const execute = useCallback(
      async <R>(thunk: Thunk<S, Promise<R>>) => {
        setLoading(true);
        setError(null);

        try {
          const result = await dispatch(thunk);
          return result;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          throw error;
        } finally {
          setLoading(false);
        }
      },
      [dispatch]
    );

    return { execute, loading, error };
  };

  const useStoreEffect = <R>(
    selector: Selector<S, R>,
    effect: (value: R, prevValue: R | undefined) => void | (() => void),
    deps?: React.DependencyList
  ) => {
    const value = useSelector(selector);
    const prevValueRef = useRef<R>();

    useEffect(() => {
      const cleanup = effect(value, prevValueRef.current);
      prevValueRef.current = value;
      return cleanup;
    }, [value, ...(deps || [])]);
  };

  return {
    StoreContext,
    StoreProvider,
    useStore,
    useSelector,
    useDispatch,
    useStoreState,
    useSubscribeTo,
    useSubscribeToPath,
    useStoreValue,
    useTransaction,
    useBatch,
    useUpdatePath,
    useStoreHistory,
    useThunk,
    useAsyncThunk,
    useStoreEffect,
  };
}

/**
 * Higher-Order Component (HOC) that provides store access to a component
 *
 * This HOC wraps a component with store context and automatically provides
 * the store as a prop. Useful for components that need direct store access
 * or for migration from prop-based store passing patterns.
 *
 * @template S - The shape of the state object
 * @template P - The props interface of the component being wrapped
 * @param Component - React component that expects a store prop
 * @param store - The store instance to provide
 * @returns New component that automatically receives the store as a prop
 *
 * @example
 * **Basic Usage**
 * ```tsx
 * import { createStore } from 'universal-store';
 * import { withStore } from 'universal-store/react';
 *
 * interface Props {
 *   title: string;
 *   store: ReadOnlyStore<{ count: number }>; // Store will be injected
 * }
 *
 * function MyComponent({ title, store }: Props) {
 *   const state = store.getState();
 *   return <div>{title}: {state.count}</div>;
 * }
 *
 * const store = createStore({ count: 0 });
 * const ConnectedComponent = withStore(MyComponent, store);
 *
 * // Usage - no need to pass store prop manually
 * function App() {
 *   return <ConnectedComponent title="My App" />;
 * }
 * ```
 *
 * @see {@link createStoreContext} for hook-based integration (recommended for new code)
 * @see {@link ReadOnlyStore} for the store interface provided to components
 */
export function withStore<S extends object, P extends object>(
  Component: ComponentType<P & { store: ReadOnlyStore<S> }>,
  store: Store<S>
): React.FC<P> {
  const { StoreProvider, useStore } = createStoreContext(store);

  const WrappedComponent: React.FC<P> = props =>
    React.createElement(StoreProvider, {
      children: React.createElement(ConnectedComponent, props),
    });

  const ConnectedComponent: React.FC<P> = props => {
    const storeInstance = useStore();
    return React.createElement(Component, {
      ...props,
      store: storeInstance.asReadOnly(),
    } as P & { store: ReadOnlyStore<S> });
  };

  WrappedComponent.displayName = `withStore(${
    Component.displayName || Component.name
  })`;

  return WrappedComponent;
}
