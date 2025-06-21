/**
 * Universal Store - React integration
 *
 * @remarks
 * This module provides React-specific hooks and components for the universal store.
 * It requires React as a peer dependency.
 *
 * @example
 * ```typescript
 * import { createStoreContext } from '@tolulikescode/universal-store/react';
 * import { createStore } from '@tolulikescode/universal-store';
 *
 * const store = createStore({ count: 0 });
 * const { StoreProvider, useSelector } = createStoreContext(store);
 * ```
 *
 * @packageDocumentation
 */

// Storage API for use in React apps
export * from "./core/storage/index";

// React-specific hooks and components
export * from "./react/index";
