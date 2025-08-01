/**
 * Flattens and prettifies complex TypeScript types for improved readability and usability.
 *
 * This utility type is especially useful in the Poly State package for simplifying
 * types that result from intersections, mapped types, or advanced generics—making them
 * easier to inspect in editor tooltips and documentation.
 *
 * @remarks
 * TypeScript sometimes produces deeply nested or intersection types when composing
 * store state, selectors, plugin results, or context values. Wrapping such types
 * with `Prettify` ensures that the resulting type is displayed as a plain object
 * with all properties visible, rather than as a complex intersection or mapped type.
 *
 * @example
 * // Example 1: Flattening a store context result type
 * import type { StoreContextResult } from 'poly-state/react'
 * type RawType = StoreContextResult<{ count: number, user: { name: string } }>
 * type PrettyType = Prettify<RawType>
 * // PrettyType will show all hooks and context properties as a flat object
 *
 * @example
 * // Example 2: Simplifying plugin extension types
 * type PluginResult = { pluginA: string } & { pluginB: number }
 * type FlatPluginResult = Prettify<PluginResult>
 * // FlatPluginResult is { pluginA: string; pluginB: number }
 *
 * @example
 * // Example 3: Improving selector return types
 * import type { Selector } from 'poly-state/core/selectors'
 * type UserSelector = Selector<{ user: { name: string; age: number } }, { name: string }>
 * type PrettySelector = Prettify<UserSelector>
 * // PrettySelector is { name: string }
 *
 * @example
 * // Example 4: Use in React context integration
 * import { createStoreContext } from 'poly-state/react'
 * const store = createStore({ todos: [], filter: 'all' })
 * type ContextType = ReturnType<typeof createStoreContext>
 * type PrettyContextType = Prettify<ContextType>
 * // PrettyContextType exposes all hooks and provider as a flat object
 *
 * @see {@link https://github.com/toluLikesToCode/poly-state | Poly State GitHub}
 * @see {@link StoreContextResult} for context integration types
 * @see {@link Selector} for selector types
 *
 * @param T - The type to be prettified (flattened)
 * @returns A new type with all properties of T, flattened for readability
 */
export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}
