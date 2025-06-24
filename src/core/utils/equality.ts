/**
 * Performs a deep equality comparison between two values of any JavaScript type.
 *
 * @typeParam T - The type of the values being compared.
 * @param a - The first value to compare.
 * @param b - The second value to compare.
 * @returns `true` if the two inputs are deeply equal, `false` otherwise.
 *
 * @remarks
 * This function handles all JavaScript data types including objects, arrays,
 * primitive values, dates, regular expressions, maps, sets, typed arrays,
 * and more. It also properly handles circular references.
 *
 * @example
 * ```typescript
 * deepEqual({ a: [1, 2, { b: 3 }] }, { a: [1, 2, { b: 3 }] }); // true
 * deepEqual(new Date(2023, 0, 1), new Date(2023, 0, 1)); // true
 * deepEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])); // true
 * ```
 */
export function deepEqual<T>(a: T, b: T): boolean {
  // WeakMap to track already compared object pairs and avoid circular references
  const seen = new WeakMap<object, object>()

  function isEqual(x: any, y: any): boolean {
    // Fast reference or primitive check
    if (x === y) return true

    // Handle null / undefined
    if (x == null || y == null) return x === y

    // Type check - must be the same type
    if (typeof x !== typeof y) return false

    // Handle primitive types that aren't caught by === (like NaN)
    if (typeof x !== 'object' && typeof x !== 'function') {
      // Special case for NaN
      if (Number.isNaN(x) && Number.isNaN(y)) return true
      // Otherwise primitives must be strictly equal
      return x === y
    }

    // Handle Date objects
    if (x instanceof Date && y instanceof Date) {
      return x.getTime() === y.getTime()
    }

    // Handle RegExp
    if (x instanceof RegExp && y instanceof RegExp) {
      return x.source === y.source && x.flags === y.flags
    }

    // Handle Error objects
    if (x instanceof Error && y instanceof Error) {
      return x.name === y.name && x.message === y.message && isEqual(x.stack, y.stack)
    }

    // Avoid revisiting the same pair to handle circular references
    if (seen.get(x) === y) {
      return true
    }
    seen.set(x, y)

    // Handle ArrayBuffer
    if (x instanceof ArrayBuffer && y instanceof ArrayBuffer) {
      if (x.byteLength !== y.byteLength) return false
      const viewX = new Uint8Array(x)
      const viewY = new Uint8Array(y)
      for (let i = 0; i < viewX.length; i++) {
        if (viewX[i] !== viewY[i]) return false
      }
      return true
    }

    // Handle TypedArrays (Int8Array, Uint8Array, etc.)
    if (ArrayBuffer.isView(x) && ArrayBuffer.isView(y) && !(x instanceof DataView) && !(y instanceof DataView)) {
      if (x.byteLength !== y.byteLength) return false
      const typedX = x as any
      const typedY = y as any
      for (let i = 0; i < x.byteLength; i++) {
        if (typedX[i] !== typedY[i]) return false
      }
      return true
    }

    // Handle DataView
    if (x instanceof DataView && y instanceof DataView) {
      if (x.byteLength !== y.byteLength) return false
      for (let i = 0; i < x.byteLength; i++) {
        if (x.getUint8(i) !== y.getUint8(i)) return false
      }
      return true
    }

    // Handle Map
    if (x instanceof Map && y instanceof Map) {
      if (x.size !== y.size) return false
      for (const [key, valX] of x.entries()) {
        // For object keys, we need to search for an equivalent key
        if (typeof key === 'object' && key !== null) {
          let found = false
          for (const [keyY] of y.entries()) {
            if (isEqual(key, keyY)) {
              found = isEqual(valX, y.get(keyY))
              if (found) break
            }
          }
          if (!found) return false
        } else {
          // For primitive keys, we can directly check
          if (!y.has(key) || !isEqual(valX, y.get(key))) {
            return false
          }
        }
      }
      return true
    }

    // Handle Set
    if (x instanceof Set && y instanceof Set) {
      if (x.size !== y.size) return false

      // Convert sets to arrays for easier comparison
      const arrX = Array.from(x)
      const arrY = Array.from(y)

      // For each item in x, find it in y
      for (const itemX of arrX) {
        const found = arrY.some(itemY => isEqual(itemX, itemY))
        if (!found) return false
      }
      return true
    }

    // Handle DOM nodes (if in a browser environment)
    if (typeof window !== 'undefined' && window.Node) {
      if (x instanceof Node && y instanceof Node) {
        return x.isEqualNode(y)
      }
    }

    // Handle boxed primitives
    if (
      (x instanceof String && y instanceof String) ||
      (x instanceof Number && y instanceof Number) ||
      (x instanceof Boolean && y instanceof Boolean)
    ) {
      return x.valueOf() === y.valueOf()
    }

    // Handle Array
    if (Array.isArray(x) && Array.isArray(y)) {
      if (x.length !== y.length) return false
      for (let i = 0; i < x.length; i++) {
        if (!isEqual(x[i], y[i])) return false
      }
      return true
    }

    // Handle plain objects (including class instances)
    const protoX = Object.getPrototypeOf(x)
    const protoY = Object.getPrototypeOf(y)

    // If the prototypes don't match, they're different types
    if (protoX !== protoY) {
      return false
    }

    const keysX = Object.keys(x)
    const keysY = Object.keys(y)

    if (keysX.length !== keysY.length) {
      return false
    }

    // Check property symbols too
    const symbolsX = Object.getOwnPropertySymbols(x)
    const symbolsY = Object.getOwnPropertySymbols(y)

    if (symbolsX.length !== symbolsY.length) {
      return false
    }

    // Check all string keys
    for (const key of keysX) {
      if (!Object.prototype.hasOwnProperty.call(y, key)) {
        return false
      }
      if (!isEqual(x[key], y[key])) {
        return false
      }
    }

    // Check all symbol keys
    for (const sym of symbolsX) {
      if (!Object.prototype.hasOwnProperty.call(y, sym)) {
        return false
      }
      if (!isEqual(x[sym], y[sym])) {
        return false
      }
    }

    return true
  }

  return isEqual(a, b)
}
