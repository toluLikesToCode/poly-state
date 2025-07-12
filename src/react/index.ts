/**
 * @fileoverview React integration utilities for Poly State
 *
 * This module provides React hooks and context providers that enable seamless integration
 * of the Poly State with React applications. It includes hooks for state selection,
 * dispatching actions, transactions, path-based operations, and more.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type ComponentType,
} from 'react'
import type {Store, ReadOnlyStore, Thunk} from '../core/state/index'
import type {
  Selector,
  DependencyListener,
  DependencySubscriptionOptions,
} from '../core/selectors/index'
import type {Draft} from 'immer'
import {getPath} from '../core/utils/path'

// Re-export all types for convenience
export * from './types'

// Import types from the dedicated types file
import type {StoreContextValue, StoreContextResult, UseSubscribeToHook} from './types'

// Cache for store hooks to avoid recreating them
const globalStoreHooks = new WeakMap<
  Store<any>,
  Omit<StoreContextResult<any>, 'StoreContext' | 'StoreProvider'>
>()

/**
 * Creates React context and hooks for a store instance
 *
 * This is the main function for integrating Poly State with React applications.
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
 * import { createStore } from 'poly-state';
 * import { createStoreContext } from 'poly-state/react';
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
export function createStoreContext<S extends object>(store: Store<S>): StoreContextResult<S> {
  const StoreContext = createContext<StoreContextValue<S> | null>(null)
  StoreContext.displayName = 'StoreContext'

  const StoreProvider: React.FC<{children: ReactNode}> = ({children}) => {
    const contextValue = useMemo(
      () => ({
        store: store,
      }),
      []
    )

    return React.createElement(StoreContext.Provider, {value: contextValue}, children)
  }
  StoreProvider.displayName = 'StoreProvider'

  const useStore = (): Store<S> => {
    const context = useContext(StoreContext)
    if (!context) {
      throw new Error('useStore must be used within a StoreProvider')
    }
    return context.store
  }

  // Multiple selectors with projector hook
  const useCombinedSelector = <R, P extends Selector<S, any>[]>(
    ...args: [
      ...P,
      (
        ...results: {
          [K in keyof P]: P[K] extends Selector<S, infer RT> ? RT : never
        }
      ) => R,
    ]
  ): R => {
    const store = useStore()

    const memoizedSelector = useMemo(() => {
      return store.select(...args)
    }, [store, ...args])

    // Create stable subscribe function
    const subscribe = useCallback(
      (callback: () => void) => {
        return store.subscribe(callback)
      },
      [store]
    )

    // Create stable getSnapshot function
    const getSnapshot = useCallback(() => {
      return memoizedSelector()
    }, [memoizedSelector])

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  }

  // Overloaded useSelector that supports both patterns
  const useSelector = <R, P extends Selector<S, any>[]>(
    ...args:
      | [Selector<S, R>]
      | [
          ...P,
          (
            ...results: {
              [K in keyof P]: P[K] extends Selector<S, infer RT> ? RT : never
            }
          ) => R,
        ]
  ): R => {
    const store = useStore()

    const memoizedSelector = useMemo(() => {
      // Delegate to store.select which handles both patterns and memoization
      return store.select(...(args as any)) as (() => R) & {lastValue?: R}
    }, [store, ...args])

    // Create stable subscribe function
    const subscribe = useCallback(
      (callback: () => void) => {
        return store.subscribe(callback)
      },
      [store]
    )

    // Create stable getSnapshot function
    const getSnapshot = useCallback(() => {
      return memoizedSelector()
    }, [memoizedSelector])

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  }

  const useDispatch = (): Store<S>['dispatch'] => {
    const context = useContext(StoreContext)
    if (!context) {
      throw new Error('useDispatch must be used within a StoreProvider')
    }

    const writableStore = context.store as any as Store<S>
    if (!writableStore.dispatch) {
      throw new Error('Store does not support dispatching actions')
    }

    return writableStore.dispatch
  }

  const useStoreState = (): S => {
    const store = useStore()

    // Create stable subscribe function
    const subscribe = useCallback(
      (callback: () => void) => {
        return store.subscribe(callback)
      },
      [store]
    )

    // Create stable getSnapshot function
    const getSnapshot = useCallback(() => {
      return store.getState()
    }, [store])

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  }

  const useSubscribeTo: UseSubscribeToHook<S> = <R>(
    selector: Selector<S, R>,
    listener: DependencyListener<R>,
    options?: DependencySubscriptionOptions
  ) => {
    const store = useStore()
    const listenerRef = useRef(listener)
    listenerRef.current = listener

    useEffect(() => {
      return store.subscribeTo(
        selector,
        (newVal, oldVal) => listenerRef.current(newVal, oldVal),
        options
      )
    }, [store, selector, options?.immediate])
  }

  const useSubscribeToPath = <T = any>(
    path: string | (string | number)[],
    listener: DependencyListener<T>,
    options?: DependencySubscriptionOptions
  ) => {
    const store = useStore()
    const listenerRef = useRef(listener)
    listenerRef.current = listener

    useEffect(() => {
      return store.subscribeToPath(
        path,
        (newVal: T, oldVal: T) => listenerRef.current(newVal, oldVal),
        options
      )
    }, [store, path, options?.immediate])
  }

  const useStoreValue = <T = any>(path: string | (string | number)[]): T => {
    const store = useStore()
    const pathArray = useMemo(() => (Array.isArray(path) ? path : path.split('.')), [path])

    // Create stable subscribe function that subscribes to the specific path
    const subscribe = useCallback(
      (callback: () => void) => {
        return store.subscribeToPath(path, callback)
      },
      [store, path]
    )

    // Create stable getSnapshot function
    const getSnapshot = useCallback(() => {
      const state = store.getState()
      return getPath(state, pathArray) as T
    }, [store, pathArray])

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  }

  const useTransaction = () => {
    const store = useStore()

    return useCallback(
      (recipe: (draft: Draft<S>) => void) => {
        return store.transaction(recipe)
      },
      [store]
    )
  }

  const useBatch = () => {
    const store = useStore()

    return useCallback(
      (fn: () => void) => {
        store.batch(fn)
      },
      [store]
    )
  }

  const useUpdatePath = () => {
    const store = useStore()

    return useCallback(
      <V = any>(path: (string | number)[], updater: (currentValue: V) => V) => {
        store.updatePath(path, updater)
      },
      [store]
    )
  }

  const useStoreHistory = () => {
    const store = useStore()

    // Create stable subscribe function
    const subscribe = useCallback(
      (callback: () => void) => {
        return store.subscribe(callback)
      },
      [store]
    )

    // Create stable getSnapshot function
    const getSnapshot = useCallback(() => {
      return store.getHistory()
    }, [store])

    const historyState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

    const undo = useCallback((steps?: number) => store.undo(steps), [store])
    const redo = useCallback((steps?: number) => store.redo(steps), [store])

    return {
      ...historyState,
      undo,
      redo,
      canUndo: historyState.currentIndex > 0,
      canRedo: historyState.currentIndex < historyState.history.length - 1,
    }
  }

  const useThunk = () => {
    const dispatch = useDispatch()

    return useCallback(
      <R>(thunk: Thunk<S, R>) => {
        return dispatch(thunk)
      },
      [dispatch]
    )
  }

  const useAsyncThunk = () => {
    const dispatch = useDispatch()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const execute = useCallback(
      async <R>(thunk: Thunk<S, Promise<R>>) => {
        setLoading(true)
        setError(null)

        try {
          const result = await dispatch(thunk)
          return result
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err))
          setError(error)
          throw error
        } finally {
          setLoading(false)
        }
      },
      [dispatch]
    )

    return {execute, loading, error}
  }

  const useStoreEffect = <R>(
    selector: Selector<S, R>,
    effect: (value: R, prevValue: R | undefined) => void | (() => void),
    deps?: React.DependencyList
  ) => {
    const value = useSelector(selector)
    const prevValueRef = useRef<R>()

    useEffect(() => {
      const cleanup = effect(value, prevValueRef.current)
      prevValueRef.current = value
      return cleanup
    }, [value, ...(deps || [])])
  }

  return {
    StoreContext,
    StoreProvider,
    useStore,
    useSelector,
    useCombinedSelector,
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
  }
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
 * import { createStore } from 'poly-state';
 * import { withStore } from 'poly-state/react';
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
  Component: ComponentType<P & {store: ReadOnlyStore<S>}>,
  store: Store<S>
): React.FC<P> {
  const {StoreProvider, useStore} = createStoreContext(store)

  const WrappedComponent: React.FC<P> = props =>
    React.createElement(StoreProvider, {
      children: React.createElement(ConnectedComponent, props),
    })

  const ConnectedComponent: React.FC<P> = props => {
    const storeInstance = useStore()
    return React.createElement(Component, {
      ...props,
      store: storeInstance.asReadOnly(),
    } as P & {store: ReadOnlyStore<S>})
  }

  WrappedComponent.displayName = `withStore(${Component.displayName || Component.name})`

  return WrappedComponent
}

/**
 * Alternative hook-based approach that doesn't require context setup
 *
 * This function provides all store hooks without needing a provider, making it perfect
 * for simple components, testing, or when you prefer direct store passing over context.
 *
 * @template S - The shape of the state object
 * @param store - The store instance to use
 * @returns All store hooks bound to the provided store instance
 *
 * @example
 * **Simple Usage - No Provider Needed**
 * ```tsx
 * import { useStoreHooks } from 'poly-state/react';
 * import { appStore } from './store';
 *
 * function Counter() {
 *   const { useSelector, useDispatch } = useStoreHooks(appStore);
 *   const count = useSelector(state => state.count);
 *   const dispatch = useDispatch();
 *
 *   return (
 *     <button onClick={() => dispatch({ count: count + 1 })}>
 *       {count}
 *     </button>
 *   );
 * }
 *
 * // No provider wrapper needed!
 * function App() {
 *   return <Counter />;
 * }
 * ```
 *
 * @example
 * **Perfect for Testing**
 * ```tsx
 * import { render, screen } from '@testing-library/react';
 * import { createStore } from 'poly-state';
 * import { useStoreHooks } from 'poly-state/react';
 *
 * function TestComponent() {
 *   const testStore = createStore({ count: 5 });
 *   const { useSelector } = useStoreHooks(testStore);
 *   const count = useSelector(state => state.count);
 *   return <div>{count}</div>;
 * }
 *
 * test('component works with direct store', () => {
 *   render(<TestComponent />);
 *   expect(screen.getByText('5')).toBeInTheDocument();
 * });
 * ```
 *
 * @example
 * **Advanced Features Still Available**
 * ```tsx
 * function AdvancedComponent() {
 *   const {
 *     useSelector,
 *     useTransaction,
 *     useStoreValue,
 *     useAsyncThunk,
 *     useStoreHistory
 *   } = useStoreHooks(appStore);
 *
 *   const userName = useStoreValue<string>('user.name');
 *   const transaction = useTransaction();
 *   const { execute, loading } = useAsyncThunk();
 *   const { undo, redo, canUndo } = useStoreHistory();
 *
 *   // All features work exactly the same!
 * }
 * ```
 *
 * @see {@link createStoreContext} for context-based integration (recommended for large apps)
 * @see {@link StoreContextResult} for all available hooks
 */
export function useStoreHooks<S extends object>(
  store: Store<S>
): Omit<StoreContextResult<S>, 'StoreContext' | 'StoreProvider'> {
  if (!globalStoreHooks.has(store)) {
    // Create standalone hooks that work directly with the store
    const hooks = {
      useStore: () => store,

      useSelector: <R, P extends Selector<S, any>[]>(
        ...args:
          | [Selector<S, R>]
          | [
              ...P,
              (
                ...results: {
                  [K in keyof P]: P[K] extends Selector<S, infer RT> ? RT : never
                }
              ) => R,
            ]
      ): R => {
        const memoizedSelector = useMemo(() => {
          return store.select(...(args as any)) as (() => R) & {lastValue?: R}
        }, [store, ...args])

        // Create stable subscribe function
        const subscribe = useCallback(
          (callback: () => void) => {
            return store.subscribe(callback)
          },
          [store]
        )

        // Create stable getSnapshot function
        const getSnapshot = useCallback(() => {
          return memoizedSelector()
        }, [memoizedSelector])

        return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
      },

      useCombinedSelector: <R, P extends Selector<S, any>[]>(
        ...args: [
          ...P,
          (
            ...results: {
              [K in keyof P]: P[K] extends Selector<S, infer RT> ? RT : never
            }
          ) => R,
        ]
      ): R => {
        const memoizedSelector = useMemo(() => {
          return store.select(...args)
        }, [store, ...args])

        // Create stable subscribe function
        const subscribe = useCallback(
          (callback: () => void) => {
            return store.subscribe(callback)
          },
          [store]
        )

        // Create stable getSnapshot function
        const getSnapshot = useCallback(() => {
          return memoizedSelector()
        }, [memoizedSelector])

        return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
      },

      useDispatch: () => store.dispatch,

      useStoreState: () => {
        // Create stable subscribe function
        const subscribe = useCallback(
          (callback: () => void) => {
            return store.subscribe(callback)
          },
          [store]
        )

        // Create stable getSnapshot function
        const getSnapshot = useCallback(() => {
          return store.getState()
        }, [store])

        return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
      },

      useSubscribeTo: <R>(
        selector: Selector<S, R>,
        listener: DependencyListener<R>,
        options?: DependencySubscriptionOptions
      ) => {
        const listenerRef = useRef(listener)
        listenerRef.current = listener

        useEffect(() => {
          return store.subscribeTo(
            selector,
            (newVal, oldVal) => listenerRef.current(newVal, oldVal),
            options
          )
        }, [store, selector, options?.immediate])
      },

      useSubscribeToPath: <T = any>(
        path: string | (string | number)[],
        listener: DependencyListener<T>,
        options?: DependencySubscriptionOptions
      ) => {
        const listenerRef = useRef(listener)
        listenerRef.current = listener

        useEffect(() => {
          return store.subscribeToPath(
            path,
            (newVal: T, oldVal: T) => listenerRef.current(newVal, oldVal),
            options
          )
        }, [store, path, options?.immediate])
      },

      useStoreValue: <T = any>(path: string): T => {
        const pathArray = useMemo(() => path.split('.'), [path])

        // Create stable subscribe function that subscribes to the specific path
        const subscribe = useCallback(
          (callback: () => void) => {
            return store.subscribeToPath(path, callback)
          },
          [store, path]
        )

        // Create stable getSnapshot function
        const getSnapshot = useCallback(() => {
          const state = store.getState()
          return getPath(state, pathArray) as T
        }, [store, pathArray])

        return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
      },

      useTransaction: () => {
        return useCallback(
          (recipe: (draft: Draft<S>) => void) => {
            return store.transaction(recipe)
          },
          [store]
        )
      },

      useBatch: () => {
        return useCallback(
          (fn: () => void) => {
            store.batch(fn)
          },
          [store]
        )
      },

      useUpdatePath: () => {
        return useCallback(
          <V = any>(path: (string | number)[], updater: (currentValue: V) => V) => {
            store.updatePath(path, updater)
          },
          [store]
        )
      },

      useStoreHistory: () => {
        // Create stable subscribe function
        const subscribe = useCallback(
          (callback: () => void) => {
            return store.subscribe(callback)
          },
          [store]
        )

        // Create stable getSnapshot function
        const getSnapshot = useCallback(() => {
          return store.getHistory()
        }, [store])

        const historyState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

        const undo = useCallback((steps?: number) => store.undo(steps), [store])
        const redo = useCallback((steps?: number) => store.redo(steps), [store])

        return {
          ...historyState,
          undo,
          redo,
          canUndo: historyState.currentIndex > 0,
          canRedo: historyState.currentIndex < historyState.history.length - 1,
        }
      },

      useThunk: () => {
        return useCallback(
          <R>(thunk: Thunk<S, R>) => {
            return store.dispatch(thunk)
          },
          [store]
        )
      },

      useAsyncThunk: () => {
        const [loading, setLoading] = useState(false)
        const [error, setError] = useState<Error | null>(null)

        const execute = useCallback(
          async <R>(thunk: Thunk<S, Promise<R>>) => {
            setLoading(true)
            setError(null)

            try {
              const result = await store.dispatch(thunk)
              return result
            } catch (err) {
              const error = err instanceof Error ? err : new Error(String(err))
              setError(error)
              throw error
            } finally {
              setLoading(false)
            }
          },
          [store]
        )

        return {execute, loading, error}
      },

      useStoreEffect: <R>(
        selector: Selector<S, R>,
        effect: (value: R, prevValue: R | undefined) => void | (() => void),
        deps?: React.DependencyList
      ) => {
        const memoizedSelector = useMemo(() => {
          return store.select(selector) as (() => R) & {lastValue?: R}
        }, [store, selector])

        // Create stable subscribe function
        const subscribe = useCallback(
          (callback: () => void) => {
            return store.subscribe(callback)
          },
          [store]
        )

        // Create stable getSnapshot function
        const getSnapshot = useCallback(() => {
          return memoizedSelector()
        }, [memoizedSelector])

        const selectedValue = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
        const prevValueRef = useRef<R>()

        useEffect(() => {
          const cleanup = effect(selectedValue, prevValueRef.current)
          prevValueRef.current = selectedValue
          return cleanup
        }, [selectedValue, ...(deps || [])])
      },
    }

    globalStoreHooks.set(store, hooks as any)
  }

  return globalStoreHooks.get(store)! as Omit<
    StoreContextResult<S>,
    'StoreContext' | 'StoreProvider'
  >
}
