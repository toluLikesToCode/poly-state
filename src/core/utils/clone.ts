/**
 * Performs a deep clone of an object, preserving its structure and values.
 *
 * @typeParam S - The type of the object being cloned.
 * @param obj - The object to clone.
 * @returns A new object that is a deep copy of the input.
 *
 * @remarks
 * This function uses structured cloning techniques to ensure that all nested objects,
 * arrays, and primitive values are copied correctly without references to the original.
 * It handles circular references and complex types like Date, Map, Set, etc.
 *
 * @example
 * ```typescript
 * const original = { a: 1, b: { c: 2 } };
 * const clone = deepClone(original);
 * console.log(clone); // { a: 1, b: { c: 2 } }
 * ```
 */
export function deepClone<S extends object>(obj: S): S {
  const seen = new WeakMap();

  function clone<T>(value: T): T {
    // Handle primitives and functions
    if (value === null || typeof value !== "object") {
      return value;
    }

    // Handle circular references
    if (seen.has(value)) {
      return seen.get(value);
    }

    // Handle Date
    if (value instanceof Date) {
      return new Date(value.getTime()) as any;
    }

    // Handle RegExp
    if (value instanceof RegExp) {
      return new RegExp(value.source, value.flags) as any;
    }

    // Handle Map
    if (value instanceof Map) {
      const result = new Map();
      seen.set(value, result);
      value.forEach((v, k) => {
        result.set(clone(k), clone(v));
      });
      return result as any;
    }

    // Handle Set
    if (value instanceof Set) {
      const result = new Set();
      seen.set(value, result);
      value.forEach(v => {
        result.add(clone(v));
      });
      return result as any;
    }

    // Handle Array
    if (Array.isArray(value)) {
      const result: any[] = [];
      seen.set(value, result);
      for (let i = 0; i < value.length; i++) {
        result[i] = clone(value[i]);
      }
      return result as any;
    }

    // Handle plain objects (including class instances)
    const proto = Object.getPrototypeOf(value);
    const result = Object.create(proto);
    seen.set(value, result);
    for (const key of Object.keys(value)) {
      result[key] = clone((value as any)[key]);
    }
    return result;
  }

  return clone(obj);
}
