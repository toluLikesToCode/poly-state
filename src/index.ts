/**
 * Poly State - Core Module
 *
 * @remarks
 * This is the main entry point for the Poly State package.
 * It exports all core functionality for vanilla TypeScript usage.
 * For React-specific features, import from 'poly-state/react'.
 *
 * @example
 * ```typescript
 * import { createStore } from 'poly-state';
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
