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

// Re-export core for convenience
export * from "./core/store";
export * from "./core/types";
export * from "./core/selector-manager-types";
export * from "./core/utils";
export * from "./core/storage";

// Export React-specific functionality
export * from "./react/index.js";
