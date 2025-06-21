/**
 * React integration utilities for Universal Store
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
  type ComponentType,
} from "react";
import type { Store, ReadOnlyStore } from "../core/state/index";
import type { Selector } from "../core/selectors/index";

export interface StoreContextValue<S extends object> {
  store: ReadOnlyStore<S>;
}

export interface StoreContextResult<S extends object> {
  StoreContext: React.Context<StoreContextValue<S> | null>;
  StoreProvider: React.FC<{ children: ReactNode }>;
  useStore: () => ReadOnlyStore<S>;
  useSelector: <R>(selector: Selector<S, R>) => R;
  useDispatch: () => Store<S>["dispatch"];
}

export function createStoreContext<S extends object>(
  store: Store<S>
): StoreContextResult<S> {
  const StoreContext = createContext<StoreContextValue<S> | null>(null);

  const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const contextValue = useMemo(
      () => ({
        store: store.asReadOnly(),
      }),
      []
    );

    return React.createElement(
      StoreContext.Provider,
      { value: contextValue },
      children
    );
  };

  const useStore = (): ReadOnlyStore<S> => {
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
      const memoizedSelector = store.select(selector);
      setSelectedValue(memoizedSelector());

      const unsubscribe = store.subscribe(() => {
        setSelectedValue(memoizedSelector());
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

  return {
    StoreContext,
    StoreProvider,
    useStore,
    useSelector,
    useDispatch,
  };
}

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
      store: storeInstance,
    } as P & { store: ReadOnlyStore<S> });
  };

  WrappedComponent.displayName = `withStore(${
    Component.displayName || Component.name
  })`;

  return WrappedComponent;
}
