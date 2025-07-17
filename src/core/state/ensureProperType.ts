/**
 * Ensures a value is of the expected complex type, with fallback conversion
 * @template T - The expected type
 * @param value - The value to ensure proper typing for
 * @param expectedType - The expected type ('Set' or 'Map')
 * @param fallbackTransform - Optional function to transform the value if it's not the expected type
 * @returns The value as the expected type
 *
 * @example
 * ```typescript
 * const safeSet = ensureProperType<Set<string>>(
 *   possiblyInvalidSet,
 *   'Set',
 *   val => typeof val === 'object' ? Object.keys(val || {}) : []
 * );
 * ```
 */
export function ensureProperType<T>(
  value: any,
  expectedType: 'Set' | 'Map',
  fallbackTransform?: (v: any) => any
): T {
  if (expectedType === 'Set') {
    if (value instanceof Set) {
      return value as unknown as T
    }
    if (Array.isArray(value)) {
      return new Set(value) as unknown as T
    }
    if (fallbackTransform) {
      return new Set(fallbackTransform(value)) as unknown as T
    }
    return new Set() as unknown as T
  } else if (expectedType === 'Map') {
    if (value instanceof Map) {
      return value as unknown as T
    }
    if (Array.isArray(value) && value.every(item => Array.isArray(item) && item.length === 2)) {
      return new Map(value) as unknown as T
    }
    if (fallbackTransform) {
      return new Map(fallbackTransform(value)) as unknown as T
    }
    return new Map() as unknown as T
  }
  throw new Error(`Unsupported type: ${expectedType}`)
}
