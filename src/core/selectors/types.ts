/**
 * @fileoverview Type definitions for the SelectorManager system
 *
 * This file contains all type definitions, interfaces, and utility types
 * used by the SelectorManager for creating memoized selectors, dependency
 * subscriptions, and parameterized selectors with optimal performance.
 */

import type {Store} from '../state/index'

/**
 * Function that computes a derived state value
 * @typeParam S - The type of the main state
 * @typeParam R - The type of the derived value
 */
export type Selector<S extends object, R = unknown> = (state: S) => R

/**
 * A memoized selector function with enhanced caching and cleanup capabilities.
 *
 * @template R - The return type of the selector
 *
 * @remarks
 * Memoized selectors provide automatic caching and lifecycle management for
 * computed state values. They leverage Immer's structural sharing for optimal
 * performance and include automatic cleanup to prevent memory leaks.
 */
export interface MemoizedSelector<R> {
  /**
   * Invokes the selector and returns the computed result.
   *
   * @remarks
   * The selector automatically memoizes results based on state changes and
   * input equality. Results are recomputed only when necessary, providing
   * optimal performance for expensive computations.
   *
   * @returns The computed selector result
   */
  (): R

  /**
   * Optional cleanup function for resource management.
   *
   * @remarks
   * Called automatically during selector lifecycle management to clean up
   * subscriptions, timers, or other resources. This prevents memory leaks
   * in long-running applications.
   */
  _cleanup?: () => void

  /**
   * Timestamp of the last time this selector was accessed.
   *
   * @remarks
   * Used by the cleanup system to identify inactive selectors that can be
   * garbage collected. Selectors that haven't been accessed within the
   * inactive threshold are automatically cleaned up.
   */
  _lastAccessed?: number

  /**
   * Whether this selector is currently active and should be retained.
   *
   * @remarks
   * Active selectors are kept in memory and continue to receive updates.
   * Inactive selectors are eligible for cleanup and removal from the cache.
   */
  _isActive?: boolean

  /**
   * The last computed result of this selector.
   *
   * @remarks
   * This property provides access to the most recent computed value without
   * triggering recomputation. Useful for debugging and subscription systems
   * that need to compare old and new values.
   */
  lastValue?: R
}

/**
 * Dependency-based subscription callback function.
 *
 * @template T - The type of the selected value
 * @param newValue - The new value after the change
 * @param oldValue - The previous value before the change
 *
 * @example
 * ```typescript
 * const listener: DependencyListener<string> = (newName, oldName) => {
 *   console.log(`Name changed from ${oldName} to ${newName}`);
 * };
 * ```
 */
export type DependencyListener<T> = (newValue: T, oldValue: T) => void

/**
 * Internal tracking information for dependency-based subscriptions.
 *
 * @template T - The type of the watched value
 *
 * @remarks
 * This interface maintains all state needed for efficient dependency tracking,
 * including selectors, listeners, debouncing, and cleanup mechanisms. Each
 * subscription is independently managed with its own lifecycle.
 */
export interface DependencySubscription<T> {
  /**
   * Unique identifier for this subscription instance.
   *
   * @remarks
   * Used for debugging, error reporting, and subscription management.
   * Generated automatically when the subscription is created.
   */
  id: string

  /**
   * The memoized selector used to extract the watched value.
   *
   * @remarks
   * This selector is automatically memoized for optimal performance and
   * provides the current value for change detection. The selector is
   * cleaned up when the subscription is destroyed.
   */
  selector: MemoizedSelector<T>

  /**
   * The callback function invoked when the watched value changes.
   *
   * @remarks
   * Called with the new and old values when a change is detected.
   * The listener execution is wrapped in error handling to prevent
   * subscription failures from affecting the store.
   */
  listener: DependencyListener<T>

  /**
   * Function used to determine if the watched value has changed.
   *
   * @remarks
   * Defaults to the store's smart equality function that leverages
   * Immer's structural sharing. Custom equality functions can be
   * provided for specialized comparison logic.
   */
  equalityFn: <V>(a: V, b: V) => boolean

  /**
   * Timeout identifier for debounced listener execution.
   *
   * @remarks
   * When debouncing is enabled, this stores the timeout ID so it can
   * be cleared if subsequent changes occur before the timeout fires.
   * Undefined when no debouncing is active.
   */
  debounceTimeoutId?: NodeJS.Timeout

  /**
   * Debounce delay in milliseconds for throttling rapid changes.
   *
   * @remarks
   * When greater than 0, the listener will be delayed and only called
   * once after the specified time has passed since the last change.
   * This prevents expensive operations from running on every change.
   */
  debounceMs: number

  /**
   * The last known value for change detection comparison.
   *
   * @remarks
   * Used by the equality function to determine if the watched value
   * has changed. Updated whenever the listener is successfully invoked.
   */
  lastValue?: T

  /**
   * Whether this subscription is currently active and receiving updates.
   *
   * @remarks
   * Active subscriptions continue to monitor changes and invoke listeners.
   * Inactive subscriptions stop processing changes and are eligible for cleanup.
   */
  isActive: boolean

  /**
   * Store subscription cleanup function for unsubscribing from state changes.
   *
   * @remarks
   * This function unsubscribes the dependency subscription from store updates.
   * Called automatically during subscription cleanup to prevent memory leaks.
   */
  storeUnsubscribe: (() => void) | null

  /**
   * Complete cleanup function for this dependency subscription.
   *
   * @remarks
   * Cleans up all resources associated with this subscription including
   * debounce timeouts, store subscriptions, and memoized selectors.
   * Safe to call multiple times.
   */
  cleanup: () => void
}

/**
 * Configuration options for dependency-based subscriptions.
 *
 * @remarks
 * These options control how the subscription behaves, including immediate execution,
 * custom equality checking, and debouncing for performance optimization.
 */
export interface DependencySubscriptionOptions {
  /**
   * Whether to call the listener immediately with the current value.
   *
   * @remarks
   * When true, the listener is called once immediately after subscription
   * with the current value passed as both new and old parameters.
   *
   * @defaultValue false
   */
  immediate?: boolean

  /**
   * Custom equality function to determine if the value has changed.
   *
   * @remarks
   * If not provided, uses the store's built-in deep equality comparison.
   * Custom equality functions can optimize performance for complex objects
   * or provide specialized comparison logic.
   *
   * @param a - The previous value
   * @param b - The current value
   * @returns True if the values are considered equal, false if they differ
   *
   * @defaultValue Uses {@link deepEqual} from store utilities
   *
   * @example
   * ```typescript
   * // Custom equality for arrays based on length only
   * const options = {
   *   equalityFn: (a: any[], b: any[]) => a.length === b.length
   * };
   * ```
   */
  equalityFn?: <T>(a: T, b: T) => boolean

  /**
   * Debounce delay in milliseconds for throttling rapid changes.
   *
   * @remarks
   * When set to a value greater than 0, the listener will be delayed and
   * only called once after the specified time has passed since the last change.
   * This is useful for expensive operations that shouldn't run on every change.
   *
   * @defaultValue 0 (no debouncing)
   *
   * @example
   * ```typescript
   * // Debounce API calls for 300ms
   * const options = { debounceMs: 300 };
   * ```
   */
  debounceMs?: number
}

/**
 * Cache entry for parameterized selectors with TTL-based cleanup.
 *
 * @template R - The return type of the parameterized selector
 * @template Props - The type of parameters accepted by the selector
 *
 * @remarks
 * Each unique parameter combination gets its own cache entry with automatic
 * TTL-based cleanup to prevent memory leaks in long-running applications.
 */
export interface ParameterCacheEntry<R, Props> {
  /**
   * The memoized selector instance for this parameter combination.
   *
   * @remarks
   * Each parameter set gets its own optimized selector instance with
   * independent memoization and caching. This provides optimal performance
   * while maintaining flexibility for dynamic parameter usage.
   */
  selector: MemoizedSelector<R>

  /**
   * Timestamp of the last time this cache entry was accessed.
   *
   * @remarks
   * Used by the TTL cleanup system to identify unused parameter combinations
   * that can be garbage collected. Entries not accessed within the TTL
   * period are automatically removed.
   */
  lastAccessed: number

  /**
   * The parameters associated with this cache entry.
   *
   * @remarks
   * Stored for debugging and potential future use. Helps identify which
   * parameter combinations are being cached and their access patterns.
   */
  params: Props
}

/**
 * Configuration options for selector cleanup behavior.
 *
 * @remarks
 * These constants control the automatic cleanup system that prevents
 * memory leaks by removing unused selectors and subscriptions.
 */
export interface SelectorCleanupConfig {
  /**
   * Interval between cleanup cycles in milliseconds.
   *
   * @remarks
   * Controls how frequently the cleanup system checks for inactive
   * selectors and subscriptions. Shorter intervals provide more
   * aggressive cleanup but use more CPU cycles.
   *
   * @defaultValue 1000 (1 second)
   */
  readonly CLEANUP_INTERVAL: number

  /**
   * Time threshold for considering selectors inactive.
   *
   * @remarks
   * Selectors that haven't been accessed within this time period
   * are considered inactive and eligible for cleanup. Longer
   * thresholds are more conservative but use more memory.
   *
   * @defaultValue 120000 (2 minutes)
   */
  readonly INACTIVE_THRESHOLD: number
}

/**
 * Configuration options for parameterized selector caching.
 *
 * @remarks
 * These constants control the TTL-based cleanup system for parameterized
 * selectors that prevents memory growth from unused parameter combinations.
 */
export interface ParameterCacheConfig {
  /**
   * Interval between parameter cache cleanup cycles in milliseconds.
   *
   * @remarks
   * Controls how frequently the cleanup system removes unused parameter
   * combinations from the cache. More frequent cleanup prevents memory
   * growth but uses more CPU cycles.
   *
   * @defaultValue 30000 (30 seconds)
   */
  readonly CLEANUP_INTERVAL: number

  /**
   * Time-to-live for parameter cache entries in milliseconds.
   *
   * @remarks
   * Parameter combinations that haven't been accessed within this
   * time period are automatically removed from the cache. Longer
   * TTL values cache more aggressively but use more memory.
   *
   * @defaultValue 300000 (5 minutes)
   */
  readonly CACHE_TTL: number
}

/**
 * Statistics and debugging information for the SelectorManager.
 *
 * @remarks
 * Provides insight into selector usage patterns, cache performance,
 * and subscription activity for debugging and optimization purposes.
 */
export interface SelectorManagerStats {
  /**
   * Number of currently active memoized selectors.
   *
   * @remarks
   * Includes all selectors that are currently cached and receiving
   * updates. High numbers might indicate memory usage concerns.
   */
  activeSelectorCount: number

  /**
   * Number of currently active dependency subscriptions.
   *
   * @remarks
   * Includes all subscriptions that are monitoring state changes.
   * Useful for understanding subscription patterns and potential leaks.
   */
  dependencySubscriptionCount: number

  /**
   * Whether the cleanup interval is currently running.
   *
   * @remarks
   * Indicates if the automatic cleanup system is active. The cleanup
   * system automatically starts and stops based on selector activity.
   */
  cleanupIntervalActive: boolean

  /**
   * Total number of selectors cleaned up since manager creation.
   *
   * @remarks
   * Cumulative count of selectors that have been automatically cleaned
   * up due to inactivity. Useful for understanding cleanup effectiveness.
   */
  totalSelectorsCleanedUp: number

  /**
   * Total number of dependency subscriptions cleaned up since manager creation.
   *
   * @remarks
   * Cumulative count of subscriptions that have been cleaned up either
   * manually or automatically. Helps track subscription lifecycle patterns.
   */
  totalDependencySubscriptionsCleanedUp: number
}

/**
 * Internal selector cache structure using WeakMap for memory efficiency.
 *
 * @remarks
 * The cache uses a two-level WeakMap structure where the first level keys
 * on the selector function and the second level keys on the store instance
 * or input selectors. This provides automatic garbage collection when
 * selectors or stores are no longer referenced.
 */
export type SelectorCache = WeakMap<Function, WeakMap<any, MemoizedSelector<any>>>

/**
 * Enhanced cache structure with explicit state type information.
 *
 * @template S - The state type
 *
 * @remarks
 * Provides type-safe access to the selector cache with state-specific
 * type information. Used internally by the SelectorManager to ensure
 * type safety across all cache operations.
 */
export type TypedSelectorCache<S extends object> = WeakMap<Function, WeakMap<any, MemoizedSelector<any>>>

/**
 * Cache entry metadata for debugging and monitoring.
 *
 * @template R - The return type of the selector
 *
 * @remarks
 * Contains metadata about cached selector instances for debugging,
 * monitoring, and optimization purposes. Not used in production
 * paths but valuable for development and troubleshooting.
 */
export interface SelectorCacheMetadata<R> {
  /**
   * The cached selector instance.
   */
  selector: MemoizedSelector<R>

  /**
   * Timestamp when this cache entry was created.
   */
  createdAt: number

  /**
   * Number of times this selector has been accessed.
   */
  accessCount: number

  /**
   * Last access timestamp for TTL calculations.
   */
  lastAccessedAt: number

  /**
   * Whether this is a single or multi-selector.
   */
  selectorType: 'single' | 'multi' | 'parameterized'

  /**
   * Hash of the selector configuration for debugging.
   */
  configurationHash?: string
}

/**
 * Subscription cleanup function signature.
 *
 * @remarks
 * Standard signature for all subscription cleanup functions throughout
 * the selector system. Ensures consistent cleanup behavior across
 * different subscription types.
 */
export type SubscriptionCleanupFunction = () => void

/**
 * Selector lifecycle event types for monitoring and debugging.
 *
 * @remarks
 * Enumeration of all lifecycle events that can occur during selector
 * management. Used by debugging and monitoring systems to track
 * selector usage patterns and identify potential issues.
 */
export enum SelectorLifecycleEvent {
  /**
   * Selector instance was created and cached.
   */
  CREATED = 'created',

  /**
   * Selector was accessed and returned cached result.
   */
  CACHE_HIT = 'cache_hit',

  /**
   * Selector was accessed but had to recompute result.
   */
  CACHE_MISS = 'cache_miss',

  /**
   * Selector was marked as inactive due to lack of access.
   */
  MARKED_INACTIVE = 'marked_inactive',

  /**
   * Selector was cleaned up and removed from cache.
   */
  CLEANED_UP = 'cleaned_up',

  /**
   * Selector was manually destroyed.
   */
  DESTROYED = 'destroyed',

  /**
   * Parameter cache entry was created for parameterized selector.
   */
  PARAMETER_CACHE_CREATED = 'parameter_cache_created',

  /**
   * Parameter cache entry was removed due to TTL expiration.
   */
  PARAMETER_CACHE_EXPIRED = 'parameter_cache_expired',
}

/**
 * Selector performance metrics for monitoring and optimization.
 *
 * @remarks
 * Detailed performance metrics collected during selector operations.
 * Used for optimization, debugging, and understanding selector
 * usage patterns in production applications.
 */
export interface SelectorPerformanceMetrics {
  /**
   * Total number of selector calls.
   */
  totalCalls: number

  /**
   * Number of calls that resulted in cache hits.
   */
  cacheHits: number

  /**
   * Number of calls that resulted in cache misses.
   */
  cacheMisses: number

  /**
   * Average execution time for cache hits (microseconds).
   */
  averageCacheHitTime: number

  /**
   * Average execution time for cache misses (microseconds).
   */
  averageCacheMissTime: number

  /**
   * Total time spent in selector computations (microseconds).
   */
  totalComputationTime: number

  /**
   * Total time spent in equality checking (microseconds).
   */
  totalEqualityCheckTime: number

  /**
   * Number of times smart equality was used successfully.
   */
  smartEqualitySuccesses: number

  /**
   * Number of times deep equality fallback was required.
   */
  deepEqualityFallbacks: number
}

/**
 * Internal state management for the SelectorManager.
 *
 * @template S - The state type
 *
 * @remarks
 * Contains all internal state variables used by the SelectorManager
 * for tracking selectors, subscriptions, and performance metrics.
 * This interface documents the complete internal state structure.
 */
export interface SelectorManagerInternalState<S extends object> {
  /**
   * Primary selector cache using WeakMap structure.
   */
  selectorCache: TypedSelectorCache<S>

  /**
   * Set of all currently active selectors.
   */
  activeSelectors: Set<MemoizedSelector<any>>

  /**
   * Set of all currently active dependency subscriptions.
   */
  dependencySubscriptions: Set<DependencySubscription<any>>

  /**
   * Background cleanup interval timer.
   */
  cleanupInterval: NodeJS.Timeout | null

  /**
   * Performance metrics collection (when enabled).
   */
  performanceMetrics?: Map<string, SelectorPerformanceMetrics>

  /**
   * Debugging metadata collection (when enabled).
   */
  debugMetadata?: Map<string, SelectorCacheMetadata<any>>

  /**
   * Lifecycle event listeners for monitoring.
   */
  lifecycleListeners?: Array<(event: SelectorLifecycleEvent, data: any) => void>
}

/**
 * Type guard for checking if a value is a memoized selector.
 *
 * @param value - The value to check
 * @returns True if the value is a memoized selector
 *
 * @remarks
 * Useful for runtime type checking and debugging selector-related issues.
 * Checks for the presence of selector-specific properties.
 */
export function isMemoizedSelector<R>(value: any): value is MemoizedSelector<R> {
  return typeof value === 'function' && (value._isActive !== undefined || value._lastAccessed !== undefined)
}

/**
 * Type guard for checking if a value is a dependency subscription.
 *
 * @param value - The value to check
 * @returns True if the value is a dependency subscription
 *
 * @remarks
 * Useful for runtime type checking and debugging subscription-related issues.
 * Checks for the presence of subscription-specific properties.
 */
export function isDependencySubscription<T>(value: any): value is DependencySubscription<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    typeof value.cleanup === 'function' &&
    typeof value.isActive === 'boolean'
  )
}

/**
 * Utility type for extracting the return type from a selector function.
 *
 * @template S - The state type
 * @template T - The selector function type
 *
 * @remarks
 * This utility type helps with complex selector compositions and type inference
 * in advanced selector patterns. Used internally by the selector system.
 */
export type SelectorReturnType<S extends object, T> = T extends Selector<S, infer R> ? R : never

/**
 * Utility type for creating a tuple of selector return types.
 *
 * @template S - The state type
 * @template P - Array of selector types
 *
 * @remarks
 * Converts an array of selector functions into a tuple of their return types.
 * Used for type inference in multi-selector compositions and parameterized selectors.
 */
export type SelectorResults<S extends object, P extends readonly Selector<S, any>[]> = {
  readonly [K in keyof P]: P[K] extends Selector<S, infer RT> ? RT : never
}

/**
 * Function signature for parameterized selector projector functions.
 *
 * @template Props - The type of parameters
 * @template S - The state type
 * @template P - Array of input selector types
 * @template R - The return type
 *
 * @remarks
 * Defines the curried function signature used in parameterized selectors.
 * The projector takes parameters and returns a combiner function that
 * operates on the input selector results.
 */
export type ParameterizedProjector<Props, S extends object, P extends readonly Selector<S, any>[], R> = (
  params: Props
) => (...results: SelectorResults<S, P>) => R

/**
 * Return type for parameterized selectors with enhanced caching.
 *
 * @template Props - The type of parameters
 * @template R - The return type
 *
 * @remarks
 * Parameterized selectors return a function that accepts parameters and
 * returns a memoized selector. Each parameter combination gets its own
 * cached selector instance for optimal performance.
 */
export type ParameterizedSelector<Props, R> = (params: Props) => (() => R) & {lastValue?: R}

/**
 * Internal cache structure for tracking selector instances.
 *
 * @template S - The state type
 *
 * @remarks
 * Maps selector functions to their memoized instances using WeakMaps for
 * automatic garbage collection. The two-level structure allows caching
 * based on both the selector function and its input dependencies.
 */
export type SelectorCacheStructure<S extends object> = WeakMap<Function, WeakMap<any, MemoizedSelector<any>>>

/**
 * Set of active selectors being tracked by the manager.
 *
 * @remarks
 * Maintains references to all active selectors for cleanup and lifecycle
 * management. Selectors are automatically added when created and removed
 * when cleaned up or destroyed.
 */
export type ActiveSelectorsSet = Set<MemoizedSelector<any>>

/**
 * Set of active dependency subscriptions being tracked by the manager.
 *
 * @remarks
 * Maintains references to all active dependency subscriptions for cleanup
 * and lifecycle management. Subscriptions are automatically managed through
 * their lifecycle from creation to cleanup.
 */
export type DependencySubscriptionsSet<S extends object> = Set<DependencySubscription<any>>

/**
 * Smart equality comparison function signature.
 *
 * @template T - The type of values being compared
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns `true` if values are considered equal, `false` otherwise
 *
 * @remarks
 * Used throughout the selector system for optimized equality checking that
 * leverages Immer's structural sharing while falling back to deep equality
 * when necessary for complex nested structures.
 */
export type SmartEqualityFunction<T = any> = (a: T, b: T) => boolean

/**
 * Enhanced input change detection function signature.
 *
 * @template T - The type of input array
 * @param previousInputs - Previously cached input values
 * @param currentInputs - Current input values to compare
 * @returns `true` if inputs have changed, `false` otherwise
 *
 * @remarks
 * Optimized for Immer's structural sharing by using reference equality as
 * the primary check, with smart equality as fallback for complex cases.
 */
export type InputChangeDetectionFunction<T extends readonly unknown[]> = (
  previousInputs: T | undefined,
  currentInputs: T
) => boolean

/**
 * Type guard function for checking if a value is a simple primitive.
 *
 * @param value - The value to check
 * @returns `true` if the value is a simple primitive, `false` otherwise
 *
 * @remarks
 * Simple values include null, undefined, string, number, boolean, and symbol.
 * Used to optimize equality checking by avoiding expensive deep comparisons
 * for primitive values that can use strict equality.
 */
export type SimpleValueChecker = (value: any) => boolean

/**
 * Type guard function for checking if a value is a plain object.
 *
 * @param value - The value to check
 * @returns `true` if the value is a plain object, `false` otherwise
 *
 * @remarks
 * Plain objects are regular objects created with object literals or
 * Object.create(null), excluding arrays, functions, classes, etc.
 * Used to optimize equality checking strategies.
 */
export type PlainObjectChecker = (value: any) => boolean

/**
 * Private method signature for creating single selectors.
 *
 * @template S - The state type
 * @template R - The return type of the selector
 * @param selectorFn - The selector function to memoize
 * @returns A memoized selector function
 *
 * @remarks
 * Internal method that creates optimized single selectors leveraging
 * Immer's structural sharing for state reference equality checks.
 */
export type CreateSingleSelectorMethod<S extends object> = <R>(selectorFn: Selector<S, R>) => MemoizedSelector<R>

/**
 * Private method signature for creating multi-selectors.
 *
 * @template S - The state type
 * @template R - The return type of the selector
 * @template P - Array of input selector types
 * @param inputSelectors - Array of input selectors
 * @param projector - Function that combines the input selector results
 * @returns A memoized selector function
 *
 * @remarks
 * Internal method that creates optimized multi-selectors with enhanced
 * input change detection using Immer-aware equality functions.
 */
export type CreateMultiSelectorMethod<S extends object> = <R, P extends Selector<S, any>[]>(
  inputSelectors: P,
  projector: (...results: any[]) => R
) => MemoizedSelector<R>

/**
 * Private method signature for creating multi-selectors with specific combiner functions.
 *
 * @template S - The state type
 * @template R - The return type of the selector
 * @template P - Array of input selector types
 * @param inputSelectors - Array of state selectors
 * @param combiner - Function that combines the selector results
 * @returns A memoized selector function
 *
 * @remarks
 * Internal method used by parameterized selectors to create optimized
 * selector instances for specific parameter combinations. Includes
 * state reference caching and enhanced input change detection.
 */
export type CreateMultiSelectorWithCombinerMethod<S extends object> = <R, P extends Selector<S, any>[]>(
  inputSelectors: readonly [...P],
  combiner: (...results: any[]) => R
) => MemoizedSelector<R>

/**
 * Cleanup management method signature for ensuring cleanup intervals are running.
 *
 * @remarks
 * Internal method that starts the automatic cleanup interval when selectors
 * are active and stops it when no selectors remain. Prevents unnecessary
 * background work when the manager is idle.
 */
export type EnsureCleanupRunningMethod = () => void

/**
 * Individual selector cleanup method signature.
 *
 * @param selector - The selector to clean up
 *
 * @remarks
 * Internal method that cleans up a specific selector instance, calling its
 * cleanup function, marking it as inactive, and removing it from active sets.
 * Also handles parameterized selector cache cleanup.
 */
export type CleanupSelectorMethod = (selector: MemoizedSelector<any>) => void

/**
 * Parameter serialization function signature for parameterized selectors.
 *
 * @template Props - The type of parameters to serialize
 * @param params - The parameters to serialize into a cache key
 * @returns A string key suitable for caching
 *
 * @remarks
 * Used internally by parameterized selectors to create consistent cache keys
 * for different parameter combinations. Handles complex objects gracefully
 * with fallback strategies for non-serializable values.
 */
export type ParameterSerializationFunction<Props> = (params: Props) => string

/**
 * Cleanup interval management function signature for parameterized selectors.
 *
 * @remarks
 * Internal function that manages TTL-based cleanup intervals for parameter
 * cache entries. Automatically starts and stops cleanup based on cache
 * activity to prevent memory leaks while minimizing overhead.
 */
export type ParameterCleanupManagementFunction = () => void

/**
 * Complete interface for the SelectorManager class including all private methods.
 *
 * @template S - The state type
 *
 * @remarks
 * Defines all public and private methods of the SelectorManager class.
 * This interface serves as the complete contract for selector management
 * functionality including internal optimization methods and helpers.
 *
 * **Note:** This is a documentation interface only. TypeScript interfaces
 * cannot include private members, so this serves as comprehensive documentation
 * of the complete SelectorManager implementation.
 */
export interface ISelectorManager<S extends object> {
  // --- Core Selector Creation ---

  /**
   * Creates a memoized selector with enhanced Immer-aware caching.
   *
   * @template R - The return type of the selector
   * @template P - Array of input selector types
   * @param args - Either a single selector or multiple selectors with a combiner function
   * @returns A memoized selector function
   *
   * @remarks
   * This method supports both single selectors and multi-selector compositions.
   * All selectors are automatically memoized and cached for optimal performance.
   * Uses Immer's structural sharing for efficient change detection.
   */
  createSelector<R, P extends Selector<S, any>[]>(
    ...args:
      | [
          ...P,
          (
            ...results: {
              [K in keyof P]: P[K] extends Selector<S, infer RT> ? RT : never
            }
          ) => R,
        ]
      | [Selector<S, R>]
  ): MemoizedSelector<R>

  /**
   * Creates a parameterized selector that accepts runtime parameters.
   *
   * @template Props - The type of runtime parameters
   * @template R - The return type of the selector
   * @template P - Array of input selector types
   * @param inputSelectors - Array of state selectors
   * @param projector - Curried function that takes params and returns a combiner function
   * @returns A function that takes parameters and returns a memoized selector
   *
   * @remarks
   * Each unique parameter combination gets its own memoized selector instance
   * with automatic TTL-based cleanup to prevent memory leaks.
   */
  createParameterizedSelector<Props, R, P extends Selector<S, any>[]>(
    inputSelectors: readonly [...P],
    projector: (params: Props) => (
      ...results: {
        [K in keyof P]: P[K] extends Selector<S, infer RT> ? RT : never
      }
    ) => R
  ): (params: Props) => (() => R) & {lastValue?: R}

  // --- Dependency Subscriptions ---

  /**
   * Creates a dependency subscription with change detection.
   *
   * @template T - The type of the selected value
   * @param selector - Function that selects the value to watch
   * @param listener - Callback invoked when the selected value changes
   * @param options - Subscription configuration options
   * @returns Unsubscribe function
   *
   * @remarks
   * Uses enhanced equality functions to minimize false positives while
   * leveraging Immer's structural sharing for optimal performance.
   */
  createDependencySubscription<T>(
    selector: Selector<S, T>,
    listener: DependencyListener<T>,
    options?: DependencySubscriptionOptions
  ): () => void

  /**
   * Creates a multi-dependency subscription using multiple selectors.
   *
   * @template P - Array of selector types
   * @param selectors - Array of selectors to watch
   * @param listener - Callback invoked when any selected value changes
   * @param options - Subscription configuration options
   * @returns Unsubscribe function
   *
   * @remarks
   * Efficiently monitors multiple state values with a single subscription
   * using individual memoized selectors for optimal change detection.
   */
  createMultiDependencySubscription<P extends Selector<S, any>[]>(
    selectors: readonly [...P],
    listener: (newValues: SelectorResults<S, P>, oldValues: SelectorResults<S, P>) => void,
    options?: DependencySubscriptionOptions
  ): () => void

  /**
   * Creates a path-based subscription using dot notation.
   *
   * @template T - The type of the value at the path
   * @param path - Dot-separated path to the state value
   * @param listener - Callback invoked when the path value changes
   * @param options - Subscription configuration options
   * @returns Unsubscribe function
   *
   * @remarks
   * Converts a string path to a selector function and delegates to the
   * single dependency subscription system for consistency and performance.
   */
  createPathSubscription<T = any>(
    path: string,
    listener: DependencyListener<T>,
    options?: DependencySubscriptionOptions
  ): () => void

  // --- Cleanup and Management ---

  /**
   * Manually cleanup inactive selectors.
   *
   * @returns Number of selectors cleaned up
   *
   * @remarks
   * Forces immediate cleanup of selectors that haven't been accessed
   * within the inactive threshold. Useful for memory management in
   * long-running applications.
   */
  cleanupSelectors(): number

  /**
   * Manually cleanup inactive dependency subscriptions.
   *
   * @returns Number of subscriptions cleaned up
   *
   * @remarks
   * Forces cleanup of subscriptions that may have become inactive but
   * haven't been garbage collected yet. Useful for debugging memory issues.
   */
  cleanupDependencySubscriptions(): number

  /**
   * Completely destroys the selector manager and all associated resources.
   *
   * @remarks
   * Cleans up all selectors, subscriptions, and intervals. Should be called
   * when the store is destroyed to prevent memory leaks.
   */
  destroyAll(): void

  // --- Debugging and Statistics ---

  /**
   * Gets the count of active dependency subscriptions for debugging.
   *
   * @returns Number of active dependency subscriptions
   *
   * @remarks
   * Useful for debugging memory leaks and understanding subscription
   * patterns in the application.
   */
  getDependencySubscriptionCount(): number
}

/**
 * Complete documentation interface for all SelectorManager private methods.
 *
 * @template S - The state type
 *
 * @remarks
 * This interface documents all private methods and internal properties of
 * the SelectorManager class. It serves as comprehensive documentation for
 * the complete implementation including internal optimization methods.
 *
 * **Note:** This is a documentation-only interface. TypeScript does not
 * support private members in interfaces, so this exists purely for
 * documentation and understanding of the complete SelectorManager structure.
 */
export interface ISelectorManagerInternal<S extends object> {
  // --- Private Core Methods ---

  /**
   * Creates an optimized single selector that leverages Immer's structural sharing.
   *
   * @template R - The return type of the selector
   * @param selectorFn - The selector function to memoize
   * @returns A memoized selector function
   *
   * @remarks
   * **Private method** - Internal implementation for single selector creation.
   *
   * This method provides the core optimization for single selectors by:
   * - Using state reference equality checks via `Object.is()`
   * - Leveraging Immer's structural sharing guarantee
   * - Avoiding expensive subscription mechanisms for simple cases
   * - Providing optimal performance for the most common selector pattern
   *
   * The implementation caches both the computed result and the state reference,
   * allowing for fast-path execution when the state hasn't changed. This is
   * particularly effective with Immer since unchanged state portions maintain
   * the same reference.
   *
   * @internal
   */
  privatecreateSingleSelector: CreateSingleSelectorMethod<S>

  /**
   * Creates an optimized multi-selector that leverages Immer's structural sharing.
   *
   * @template R - The return type of the selector
   * @template P - Array of input selector types
   * @param inputSelectors - Array of input selectors
   * @param projector - Function that combines the input selector results
   * @returns A memoized selector function
   *
   * @remarks
   * **Private method** - Internal implementation for multi-selector creation.
   *
   * This method provides enhanced performance for complex selectors by:
   * - State reference caching with `Object.is()` fast-path
   * - Smart input change detection using enhanced equality functions
   * - Subscription-based cache invalidation for efficient updates
   * - Optimal projector execution only when inputs actually change
   *
   * The implementation uses a two-tier caching strategy:
   * 1. State reference cache for immediate rejection of unchanged states
   * 2. Input results cache with smart equality for fine-grained change detection
   *
   * This approach leverages Immer's structural sharing while providing
   * accurate change detection for complex nested data structures.
   *
   * @internal
   */
  createMultiSelector: CreateMultiSelectorMethod<S>

  /**
   * Creates a multi-selector with a specific combiner function for parameterized selectors.
   *
   * @template R - The return type of the selector
   * @template P - Array of input selector types
   * @param inputSelectors - Array of state selectors
   * @param combiner - Function that combines the selector results
   * @returns A memoized selector function
   *
   * @remarks
   * **Private method** - Internal implementation for parameterized selector instances.
   *
   * This method is specifically designed for use by parameterized selectors and provides:
   * - Optimized caching for specific parameter combinations
   * - State reference caching with Immer-aware fast-path optimization
   * - Enhanced input change detection using smart equality functions
   * - Subscription management for efficient cache invalidation
   *
   * Unlike the general multi-selector method, this implementation is optimized
   * for the parameter cache use case where each instance represents a specific
   * parameter combination. The combiner function is pre-bound to the parameters,
   * allowing for optimal execution performance.
   *
   * The implementation includes automatic cleanup integration with the parameter
   * cache TTL system to prevent memory leaks in long-running applications.
   *
   * @internal
   */
  createMultiSelectorWithCombiner: CreateMultiSelectorWithCombinerMethod<S>

  // --- Private Helper Methods ---

  /**
   * Smart equality function that leverages Immer's structural sharing.
   *
   * @template T - The type of values being compared
   * @param a - First value to compare
   * @param b - Second value to compare
   * @returns `true` if values are considered equal, `false` otherwise
   *
   * @remarks
   * **Private method** - Core equality function for the selector system.
   *
   * This method implements a multi-tier equality strategy optimized for Immer:
   *
   * **Tier 1: Reference Equality (`Object.is()`)**
   * - Fastest possible check, leverages Immer's structural sharing
   * - Most effective for unchanged data portions
   * - Handles all primitive types and object references
   *
   * **Tier 2: Shallow Equality**
   * - For arrays: length check + element reference comparison
   * - For objects: key count check + property reference comparison
   * - Significantly faster than deep equality for most cases
   *
   * **Tier 3: Deep Equality (Fallback)**
   * - Only used when shallow equality detects potential changes
   * - Applied selectively to complex nested structures
   * - Minimizes expensive traversals while maintaining accuracy
   *
   * The implementation is designed to work optimally with Immer's guarantees:
   * - Unchanged data maintains reference equality
   * - Changed data creates new references at change points
   * - Structural sharing preserves references for unchanged branches
   *
   * @internal
   */
  smartEqual: SmartEqualityFunction

  /**
   * Enhanced input change detection using Immer-optimized equality.
   *
   * @template T - The type of input array
   * @param previousInputs - Previously cached input values
   * @param currentInputs - Current input values to compare
   * @returns `true` if inputs have changed, `false` otherwise
   *
   * @remarks
   * **Private method** - Optimized change detection for selector inputs.
   *
   * This method provides efficient change detection specifically designed
   * for selector input arrays by:
   *
   * **Fast-Path Optimizations:**
   * - Immediate `true` for undefined previous inputs (first run)
   * - Length mismatch detection before element comparison
   * - Early termination on first detected change
   *
   * **Smart Equality Integration:**
   * - Uses the `smartEqual` method for each input comparison
   * - Leverages Immer's structural sharing for optimal performance
   * - Balances accuracy with performance for complex data structures
   *
   * **Performance Characteristics:**
   * - O(1) for unchanged inputs (common case with Immer)
   * - O(n) worst case with early termination
   * - Optimized for the typical pattern of few actual changes
   *
   * This method is central to the selector system's performance, as it
   * determines when expensive projector functions need to be re-executed.
   *
   * @internal
   */
  haveInputsChanged: InputChangeDetectionFunction<any>

  /**
   * Checks if a value is a simple primitive or simple object.
   *
   * @param value - The value to check
   * @returns `true` if the value is simple, `false` otherwise
   *
   * @remarks
   * **Private method** - Type guard for optimization decisions.
   *
   * This method identifies simple values that can use fast equality checks:
   * - `null` and `undefined`
   * - Primitive types: `string`, `number`, `boolean`, `symbol`
   *
   * Simple values can use strict equality (`===`) instead of more expensive
   * comparison strategies, providing significant performance benefits in
   * the smart equality implementation.
   *
   * This optimization is particularly valuable in selector input arrays
   * where many values are often primitives (IDs, flags, simple counters).
   *
   * @internal
   */
  isSimpleValue: SimpleValueChecker

  /**
   * Checks if a value is a plain object (not an array, Set, Map, etc.).
   *
   * @param value - The value to check
   * @returns `true` if the value is a plain object, `false` otherwise
   *
   * @remarks
   * **Private method** - Type guard for equality strategy selection.
   *
   * This method identifies plain objects that can benefit from shallow
   * equality checking strategies. Plain objects are:
   * - Regular objects created with `{}` or `Object.create(Object.prototype)`
   * - Exclude arrays, functions, classes, Maps, Sets, etc.
   *
   * Plain objects are good candidates for shallow equality optimization
   * because they typically have enumerable properties that can be efficiently
   * compared using `Object.keys()` and property access.
   *
   * Non-plain objects (custom classes, built-in types) fall back to deep
   * equality to ensure correctness for specialized comparison logic.
   *
   * @internal
   */
  isPlainObject: PlainObjectChecker

  /**
   * Ensures the cleanup interval is running when selectors are active.
   *
   * @remarks
   * **Private method** - Lifecycle management for automatic cleanup.
   *
   * This method manages the automatic cleanup system by:
   *
   * **Startup Logic:**
   * - Starts cleanup interval when first selector becomes active
   * - Prevents multiple intervals from running simultaneously
   * - Uses configurable cleanup interval and inactive threshold
   *
   * **Cleanup Process:**
   * - Periodically scans active selectors for inactivity
   * - Removes selectors that exceed the inactive threshold
   * - Calls individual selector cleanup methods
   *
   * **Shutdown Logic:**
   * - Automatically stops interval when no selectors remain active
   * - Prevents unnecessary background work in idle states
   * - Ensures clean resource management
   *
   * The cleanup system is essential for preventing memory leaks in
   * long-running applications with dynamic selector usage patterns.
   *
   * @internal
   */
  ensureCleanupRunning: EnsureCleanupRunningMethod

  /**
   * Cleans up an individual selector instance.
   *
   * @param selector - The selector instance to clean up
   *
   * @remarks
   * **Private method** - Individual selector lifecycle management.
   *
   * This method handles complete cleanup of a selector instance by:
   *
   * **Resource Cleanup:**
   * - Calls the selector's `_cleanup` method if present
   * - Handles subscription cleanup and resource disposal
   * - Clears any internal timers or intervals
   *
   * **State Management:**
   * - Marks the selector as inactive (`_isActive = false`)
   * - Removes from the active selectors set
   * - Prevents further automatic cleanup attempts
   *
   * **Special Cases:**
   * - Handles parameterized selector cache cleanup
   * - Clears parameter-specific cache entries
   * - Ensures proper memory cleanup for complex selector types
   *
   * This method is called both by automatic cleanup and manual destruction
   * to ensure consistent resource management across all cleanup scenarios.
   *
   * @internal
   */
  cleanupSelector: CleanupSelectorMethod

  // --- Dependency Subscriptions ---

  /**
   * Creates a dependency subscription with change detection.
   *
   * @template T - The type of the selected value
   * @param selector - Function that selects the value to watch
   * @param listener - Callback invoked when the selected value changes
   * @param options - Subscription configuration options
   * @returns Unsubscribe function
   *
   * @remarks
   * Uses enhanced equality functions to minimize false positives while
   * leveraging Immer's structural sharing for optimal performance.
   */
  createDependencySubscription<T>(
    selector: Selector<S, T>,
    listener: DependencyListener<T>,
    options?: DependencySubscriptionOptions
  ): () => void

  /**
   * Creates a multi-dependency subscription using multiple selectors.
   *
   * @template P - Array of selector types
   * @param selectors - Array of selectors to watch
   * @param listener - Callback invoked when any selected value changes
   * @param options - Subscription configuration options
   * @returns Unsubscribe function
   *
   * @remarks
   * Efficiently monitors multiple state values with a single subscription
   * using individual memoized selectors for optimal change detection.
   */
  createMultiDependencySubscription<P extends Selector<S, any>[]>(
    selectors: readonly [...P],
    listener: (newValues: SelectorResults<S, P>, oldValues: SelectorResults<S, P>) => void,
    options?: DependencySubscriptionOptions
  ): () => void

  /**
   * Creates a path-based subscription using dot notation.
   *
   * @template T - The type of the value at the path
   * @param path - Dot-separated path to the state value
   * @param listener - Callback invoked when the path value changes
   * @param options - Subscription configuration options
   * @returns Unsubscribe function
   *
   * @remarks
   * Converts a string path to a selector function and delegates to the
   * single dependency subscription system for consistency and performance.
   */
  createPathSubscription<T = any>(
    path: string,
    listener: DependencyListener<T>,
    options?: DependencySubscriptionOptions
  ): () => void

  // --- Cleanup and Management ---

  /**
   * Manually cleanup inactive selectors.
   *
   * @returns Number of selectors cleaned up
   *
   * @remarks
   * Forces immediate cleanup of selectors that haven't been accessed
   * within the inactive threshold. Useful for memory management in
   * long-running applications.
   */
  cleanupSelectors(): number

  /**
   * Manually cleanup inactive dependency subscriptions.
   *
   * @returns Number of subscriptions cleaned up
   *
   * @remarks
   * Forces cleanup of subscriptions that may have become inactive but
   * haven't been garbage collected yet. Useful for debugging memory issues.
   */
  cleanupDependencySubscriptions(): number

  /**
   * Completely destroys the selector manager and all associated resources.
   *
   * @remarks
   * Cleans up all selectors, subscriptions, and intervals. Should be called
   * when the store is destroyed to prevent memory leaks.
   */
  destroyAll(): void

  // --- Debugging and Statistics ---

  /**
   * Gets the count of active dependency subscriptions for debugging.
   *
   * @returns Number of active dependency subscriptions
   *
   * @remarks
   * Useful for debugging memory leaks and understanding subscription
   * patterns in the application.
   */
  getDependencySubscriptionCount(): number

  // --- Private Internal Properties ---

  /**
   * Private cache structure for selector instances.
   *
   * @remarks
   * **Private property** - Core caching mechanism for the selector system.
   *
   * Uses a two-level WeakMap structure:
   * - First level: Maps selector functions to their cache maps
   * - Second level: Maps selector inputs/store to memoized instances
   *
   * WeakMap usage provides automatic garbage collection when:
   * - Selector functions are no longer referenced
   * - Store instances are destroyed
   * - Input selector arrays become unreferenced
   *
   * This structure enables efficient reuse of selector instances while
   * preventing memory leaks through automatic cleanup.
   *
   * @internal
   */
  selectorCache: SelectorCacheStructure<S>

  /**
   * Set of currently active memoized selectors.
   *
   * @remarks
   * **Private property** - Active selector tracking for lifecycle management.
   *
   * Maintains references to all selectors that are:
   * - Currently cached and available for use
   * - Receiving automatic cleanup monitoring
   * - Participating in the background cleanup system
   *
   * Selectors are automatically:
   * - Added when created through any creation method
   * - Removed when cleaned up due to inactivity
   * - Managed through the automatic cleanup interval
   *
   * @internal
   */
  activeSelectors: ActiveSelectorsSet

  /**
   * Cleanup interval timer for automatic selector management.
   *
   * @remarks
   * **Private property** - Background cleanup system timer.
   *
   * This timer manages the automatic cleanup cycle:
   * - Starts when first selector becomes active
   * - Runs at configured intervals to check for inactive selectors
   * - Stops automatically when no selectors remain active
   * - Prevents unnecessary background work in idle states
   *
   * The interval helps prevent memory leaks in long-running applications
   * by automatically removing selectors that haven't been accessed recently.
   *
   * @internal
   */
  cleanupInterval: NodeJS.Timeout | null

  /**
   * Set of currently active dependency subscriptions.
   *
   * @remarks
   * **Private property** - Dependency subscription tracking for lifecycle management.
   *
   * Maintains references to all dependency subscriptions that are:
   * - Currently active and monitoring state changes
   * - Managed through the subscription cleanup system
   * - Tracked for debugging and memory management
   *
   * Subscriptions are automatically:
   * - Added when created through dependency subscription methods
   * - Removed when cleaned up or destroyed
   * - Managed independently of the main selector cleanup system
   *
   * @internal
   */
  dependencySubscriptions: DependencySubscriptionsSet<S>

  // --- Configuration Constants ---

  /**
   * Interval between cleanup cycles in milliseconds.
   *
   * @remarks
   * **Private constant** - Controls automatic cleanup frequency.
   *
   * Determines how often the cleanup system checks for inactive selectors:
   * - Shorter intervals: More aggressive cleanup, higher CPU usage
   * - Longer intervals: Less frequent cleanup, potential memory growth
   *
   * Default value balances cleanup effectiveness with performance impact.
   *
   * @internal
   */
  readonly CLEANUP_INTERVAL: number

  /**
   * Time threshold for considering selectors inactive in milliseconds.
   *
   * @remarks
   * **Private constant** - Inactivity threshold for automatic cleanup.
   *
   * Selectors not accessed within this timeframe are considered inactive:
   * - Shorter thresholds: More aggressive cleanup, may cleanup active selectors
   * - Longer thresholds: More conservative cleanup, higher memory usage
   *
   * Default value provides reasonable balance for most applications.
   *
   * @internal
   */
  readonly INACTIVE_THRESHOLD: number
}

/**
 * Internal helper functions and utilities used by the SelectorManager.
 *
 * @template S - The state type
 *
 * @remarks
 * These functions are used internally by parameterized selectors and other
 * advanced selector features. They are not part of the public API but are
 * documented for completeness and debugging purposes.
 */
export interface SelectorManagerInternalHelpers<S extends object> {
  /**
   * Smart parameter serialization function for cache key generation.
   *
   * @template Props - The type of parameters to serialize
   * @param params - The parameters to convert to a cache key
   * @returns A consistent string key for caching
   *
   * @remarks
   * **Internal helper** - Used by parameterized selectors for cache management.
   *
   * Provides consistent serialization with multiple strategies:
   *
   * **Simple Values:**
   * - Direct JSON serialization for primitives and null/undefined
   * - Fast and reliable for most common parameter types
   *
   * **Object Parameters:**
   * - Key sorting for consistent serialization regardless of property order
   * - Handles nested objects and arrays appropriately
   * - Ensures identical objects produce identical cache keys
   *
   * **Complex/Non-Serializable Values:**
   * - Graceful fallback for functions, symbols, circular references
   * - Generates unique identifiers to prevent cache collisions
   * - Maintains cache functionality even with exotic parameter types
   *
   * The serialization strategy ensures cache correctness while optimizing
   * for the common case of simple parameter objects.
   *
   * @internal
   */
  serializeParams<Props>(params: Props): string

  /**
   * Cleanup interval management for parameterized selector caches.
   *
   * @remarks
   * **Internal helper** - TTL-based cleanup for parameter cache entries.
   *
   * Manages automatic cleanup of parameterized selector caches by:
   *
   * **Startup Management:**
   * - Starts cleanup interval when first parameter cache entry is created
   * - Prevents multiple cleanup intervals from running simultaneously
   * - Uses configurable cleanup interval and TTL settings
   *
   * **Cleanup Process:**
   * - Periodically scans parameter cache entries for expiration
   * - Removes entries that haven't been accessed within TTL period
   * - Calls cleanup methods on expired selector instances
   *
   * **Shutdown Management:**
   * - Automatically stops cleanup when parameter cache becomes empty
   * - Minimizes background work when no parameterized selectors are active
   * - Ensures efficient resource utilization
   *
   * This system prevents memory leaks from unused parameter combinations
   * while maintaining performance for actively used parameterized selectors.
   *
   * @internal
   */
  ensureParameterCleanupRunning(): void

  /**
   * Enhanced equality checking specifically optimized for selector inputs.
   *
   * @template T - The type of values being compared
   * @param a - First value to compare
   * @param b - Second value to compare
   * @returns `true` if values are considered equal, `false` otherwise
   *
   * @remarks
   * **Internal helper** - Specialized equality for selector system optimization.
   *
   * This function extends the basic `smartEqual` implementation with
   * selector-specific optimizations:
   *
   * **Selector Result Optimization:**
   * - Recognizes common selector result patterns
   * - Optimizes for frequently unchanged data structures
   * - Leverages Immer's structural sharing guarantees
   *
   * **Performance Characteristics:**
   * - Prioritizes reference equality for maximum speed
   * - Uses shallow equality for common object patterns
   * - Falls back to deep equality only when necessary
   *
   * **Integration with Selector System:**
   * - Designed specifically for input change detection
   * - Optimized for the selector memoization use case
   * - Balances accuracy with performance for selector scenarios
   *
   * Used internally by input change detection to minimize unnecessary
   * selector recomputations while ensuring correctness.
   *
   * @internal
   */
  selectorOptimizedEqual<T>(a: T, b: T): boolean
}

/**
 * Error types specific to selector management operations.
 *
 * @remarks
 * These error types provide specific context for selector-related failures
 * and help with debugging and error handling in the selector system.
 */
export class SelectorError extends Error {
  constructor(
    message: string,
    public readonly context?: {
      operation?: string
      selectorType?: string
      parametersHash?: string
      subscriptionId?: string
      additionalInfo?: Record<string, any>
    }
  ) {
    super(message)
    this.name = 'SelectorError'
  }
}

export class SelectorCacheError extends SelectorError {
  constructor(message: string, context?: SelectorError['context']) {
    super(message, {...context, operation: 'cache'})
    this.name = 'SelectorCacheError'
  }
}

export class DependencySubscriptionError extends SelectorError {
  constructor(message: string, context?: SelectorError['context']) {
    super(message, {...context, operation: 'dependencySubscription'})
    this.name = 'DependencySubscriptionError'
  }
}

/**
 * Factory function options for creating SelectorManager instances.
 *
 * @template S - The state type
 *
 * @remarks
 * Allows customization of the SelectorManager behavior including cleanup
 * intervals, cache configuration, and debugging options.
 */
export interface SelectorManagerOptions<S extends object> {
  /**
   * Configuration for selector cleanup behavior.
   *
   * @remarks
   * Controls automatic cleanup of inactive selectors to prevent memory leaks.
   * Can be customized based on application requirements and memory constraints.
   */
  cleanupConfig?: Partial<SelectorCleanupConfig>

  /**
   * Configuration for parameterized selector caching.
   *
   * @remarks
   * Controls TTL-based cleanup of parameter cache entries to prevent
   * memory growth from unused parameter combinations.
   */
  parameterCacheConfig?: Partial<ParameterCacheConfig>

  /**
   * Whether to enable detailed debugging and statistics collection.
   *
   * @remarks
   * When enabled, the selector manager collects detailed statistics and
   * provides enhanced debugging information. May have slight performance
   * impact in production environments.
   *
   * @defaultValue false
   */
  enableDebugMode?: boolean

  /**
   * Custom error handler for selector-related errors.
   *
   * @remarks
   * Allows custom handling of errors that occur during selector operations.
   * If not provided, errors are handled by the store's error handling system.
   */
  onError?: (error: SelectorError) => void

  /**
   * The store instance this selector manager is associated with.
   *
   * @remarks
   * Required for creating subscriptions and accessing store functionality.
   * The selector manager maintains a reference to the store for its operations.
   */
  store: Store<S>
}

/**
 * Default configuration values for the SelectorManager.
 *
 * @remarks
 * These defaults provide a reasonable balance between performance and
 * memory usage for most applications. Can be overridden via options.
 */
export const DEFAULT_SELECTOR_CLEANUP_CONFIG: SelectorCleanupConfig = {
  CLEANUP_INTERVAL: 1 * 1000, // 1 second
  INACTIVE_THRESHOLD: 2 * 60 * 1000, // 2 minutes
} as const

export const DEFAULT_PARAMETER_CACHE_CONFIG: ParameterCacheConfig = {
  CLEANUP_INTERVAL: 30 * 1000, // 30 seconds
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
} as const
