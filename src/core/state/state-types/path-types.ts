/**
 * Advanced path utility types for type-safe nested property access
 * These types enable compile-time validation of object paths and proper type inference
 */

/**
 * Utility type to prevent infinite recursion in path type generation
 */
type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ...0[]]
/**
 * Extracts the value type at a given path in an object type.
 * Provides compile-time type safety for nested property access.
 *
 * @template T - The object type to traverse
 * @template P - The path tuple type representing keys/indices
 *
 * @example
 * ```typescript
 * type User = { profile: { name: string; age: number } }
 * type NameType = PathValue<User, ['profile', 'name']> // string
 * type AgeType = PathValue<User, ['profile', 'age']> // number
 * ```
 */
export type PathValue<T, P extends readonly (string | number)[]> = P extends readonly [
  infer Head,
  ...infer Tail,
]
  ? Head extends keyof T
    ? Tail extends readonly (string | number)[]
      ? Tail['length'] extends 0
        ? T[Head]
        : PathValue<T[Head], Tail>
      : T[Head]
    : Head extends number
      ? T extends readonly (infer U)[]
        ? Tail extends readonly (string | number)[]
          ? Tail['length'] extends 0
            ? U
            : PathValue<U, Tail>
          : U
        : unknown
      : unknown
  : T
/**
 * Generates all possible valid paths for a given object type.
 * Limited to a specific depth to prevent infinite recursion.
 *
 * @template T - The object type to generate paths for
 * @template D - Maximum depth to traverse (default: 4)
 *
 * @example
 * ```typescript
 * type User = { profile: { name: string; settings: { theme: string } } }
 * type UserPaths = PathsOf<User>
 * // ['profile'] | ['profile', 'name'] | ['profile', 'settings'] | ['profile', 'settings', 'theme']
 * ```
 */
export type PathsOf<T, D extends number = 6> = D extends 0
  ? never
  : T extends readonly (infer U)[]
    ? [number] | [number, ...PathsOf<U, Prev[D]>]
    : T extends object
      ? {
          [K in keyof T]: T[K] extends object ? [K] | [K, ...PathsOf<T[K], Prev[D]>] : [K]
        }[keyof T]
      : never

/**
 * More lenient path type that allows any string/number combination.
 * Useful when strict path validation isn't needed but type safety is desired.
 */
export type FlexiblePath = readonly (string | number)[]

/**
 * Validates that a path exists in the given type structure.
 * Returns the path type if valid, never if invalid.
 */
export type ValidPath<T, P extends FlexiblePath> = PathValue<T, P> extends never ? never : P

/**
 * Helper type to extract keys that can be used as path segments.
 * Filters out symbol keys to ensure compatibility with FlexiblePath.
 */
export type PathKey<T> = T extends readonly any[]
  ? number
  : keyof T extends string | number
    ? keyof T
    : Extract<keyof T, string | number>

/**
 * Utility type for building paths incrementally with type safety.
 * Ensures that only valid string/number keys are used in path construction.
 *
 * @template T - The root object type
 * @template P - The current path being built
 *
 * @example
 * ```typescript
 * type User = { profile: { name: string } }
 * type UserPath = BuildPath<User, []>
 * // { current: [], value: User, extend: (key: 'profile') => BuildPath<User, ['profile']> }
 * ```
 */
export type BuildPath<T, P extends FlexiblePath = []> = {
  current: P
  value: PathValue<T, P>
  extend: <K extends PathKey<PathValue<T, P>>>(
    key: K
  ) => K extends string | number ? BuildPath<T, [...P, K]> : never
}

/**
 * Utility type to get all valid string/number keys from a type.
 * This is used internally to ensure type safety in path operations.
 */
export type ValidKeys<T> = T extends readonly any[]
  ? number
  : T extends object
    ? Extract<keyof T, string | number>
    : never

/**
 * More restrictive path type that only allows paths that exist in the type structure.
 * Provides compile-time validation of path existence.
 *
 * @template T - The object type to validate against
 * @template P - The path to validate
 */
export type StrictPath<T, P extends FlexiblePath> = P extends readonly [infer Head, ...infer Tail]
  ? Head extends ValidKeys<T>
    ? Tail extends FlexiblePath
      ? [Head, ...StrictPath<T[Head & keyof T], Tail>]
      : [Head]
    : never
  : []

/**
 * Utility type to determine if a path is valid for a given type.
 * Returns true if the path exists, false otherwise.
 */
export type IsValidPath<T, P extends FlexiblePath> = PathValue<T, P> extends never ? false : true

/**
 * Extracts all possible leaf paths (paths to primitive values) from a type.
 * Useful for getting all possible end-points in a nested structure.
 *
 * @template T - The object type to extract leaf paths from
 * @template D - Maximum depth to traverse
 */
export type LeafPaths<T, D extends number = 4> = D extends 0
  ? never
  : T extends object
    ? T extends readonly (infer U)[]
      ? U extends object
        ? [number, ...LeafPaths<U, Prev[D]>]
        : [number]
      : {
          [K in keyof T]: T[K] extends object ? [K, ...LeafPaths<T[K], Prev[D]>] : [K]
        }[keyof T]
    : never
