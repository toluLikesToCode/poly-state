/**
 * Universal Store - Core Module
 *
 * @remarks
 * This is the main entry point for the universal store package.
 * It exports all core functionality for vanilla TypeScript usage.
 * For React-specific features, import from 'open-store/react'.
 *
 * @example
 * ```typescript
 * import { createStore } from 'open-store';
 *
 * const store = createStore({ count: 0 });
 * store.dispatch({ count: 1 });
 * ```
 *
 * @packageDocumentation
 */

// Re-export everything from core
export * from './core'

// Re-export plugins
export * from './plugins'

export * from './shared'
