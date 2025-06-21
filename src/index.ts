/**
 * Universal Store - C// Re-export plugins when you add them
export * from './plugins';

// Note: Removed default export to avoid mixing named and default exports
// Use: import { createStore } from '@tolulikescode/universal-store'odule
 *
 * @remarks
 * This is the main entry point for the universal store package.
 * It exports all core functionality for vanilla TypeScript usage.
 * For React-specific features, import from '@tolulikescode/universal-store/react'.
 *
 * @example
 * ```typescript
 * import { createStore } from '@tolulikescode/universal-store';
 *
 * const store = createStore({ count: 0 });
 * store.dispatch({ count: 1 });
 * ```
 *
 * @packageDocumentation
 */

// Re-export everything from core
export * from "./core";

// Re-export plugins Note: Add plugin later
export * from "./plugins";

export * from "./shared";

// Default export for convenience
export { createStore as default } from "./core/state/createStore";
