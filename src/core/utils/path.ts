import {deepClone} from './clone'

export function getPath<T, V = any>(obj: T, path: (string | number)[]): V | undefined {
  let current: any = obj
  for (const key of path) {
    if (current === null || typeof current !== 'object') {
      return undefined
    }

    // Handle Map objects
    if (current instanceof Map) {
      // Try the key as-is first, then try converting string to number or vice versa
      if (current.has(key)) {
        current = current.get(key)
      } else if (typeof key === 'string' && !isNaN(Number(key))) {
        // Try converting string to number for Map access
        const numKey = Number(key)
        if (current.has(numKey)) {
          current = current.get(numKey)
        } else {
          return undefined
        }
      } else if (typeof key === 'number') {
        // Try converting number to string for Map access
        const strKey = String(key)
        if (current.has(strKey)) {
          current = current.get(strKey)
        } else {
          return undefined
        }
      } else {
        return undefined
      }
    } else {
      // Handle regular objects and arrays
      if (!(key in current)) {
        return undefined
      }
      current = current[key]
    }
  }
  return current as V
}

export function setPath<T extends object, V = any>(obj: T, path: (string | number)[], value: V): T {
  if (path.length === 0) {
    return value as any
  }

  // Handle Map objects at root level
  if (obj instanceof Map) {
    const newMap = new Map(obj)
    if (path.length === 1) {
      newMap.set(path[0], value)
      return newMap as T
    }
    // For nested paths in Maps, get the nested object and continue
    const key = path[0]
    const nestedObj = newMap.get(key)
    if (nestedObj && typeof nestedObj === 'object') {
      newMap.set(key, setPath(nestedObj, path.slice(1), value))
    }
    return newMap as T
  }

  const newObj = Array.isArray(obj) ? [...obj] : {...obj}
  let current: any = newObj

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]
    const nextKeyIsNumber = typeof path[i + 1] === 'number'

    // Handle Map objects in the path
    if (current instanceof Map) {
      if (!current.has(key)) {
        const newNestedMap = new Map(current)
        newNestedMap.set(key, nextKeyIsNumber ? [] : {})
        current = newNestedMap.get(key)
      } else {
        const existing = current.get(key)
        if (existing === null || typeof existing !== 'object') {
          const newNestedMap = new Map(current)
          newNestedMap.set(key, nextKeyIsNumber ? [] : {})
          current = newNestedMap.get(key)
        } else {
          current = Array.isArray(existing) ? [...existing] : {...existing}
        }
      }
    } else {
      // Existing logic for regular objects/arrays
      if (current[key] === null || typeof current[key] !== 'object') {
        current[key] = nextKeyIsNumber ? [] : {}
      } else {
        current[key] = Array.isArray(current[key]) ? [...current[key]] : {...current[key]}
      }
      current = current[key]
    }
  }

  current[path[path.length - 1]] = value
  return newObj as T
}

/**
 * Deep merges two objects while preserving specified paths from the initial state.
 * This function ensures that omitted paths maintain their initial values during state restoration.
 *
 * @template S - The state type
 * @param initialState - The initial state containing default values
 * @param loadedState - The loaded state from persistence (may have missing paths)
 * @param preservePaths - Array of paths that should preserve their initial values
 * @returns Merged state with preserved paths from initial state
 *
 * @example
 * ```typescript
 * const initial = { user: { name: 'Default', token: 'default-token' }, settings: { theme: 'light' } }
 * const loaded = { user: { name: 'John' }, settings: { theme: 'dark' } }
 * const preserved = [['user', 'token']]
 * const result = deepMergeWithPathPreservation(initial, loaded, preserved)
 * // Result: { user: { name: 'John', token: 'default-token' }, settings: { theme: 'dark' } }
 * ```
 */
export function deepMergeWithPathPreservation<S extends object>(
  initialState: S,
  loadedState: Partial<S>,
  preservePaths: readonly (readonly (string | number)[])[]
): Partial<S> {
  // Helper function to check if two values are compatible types
  const areTypesCompatible = (target: any, source: any): boolean => {
    // Both null/undefined are compatible
    if ((target === null || target === undefined) && (source === null || source === undefined)) {
      return true
    }

    // Null can be overwritten by any value
    if (target === null || target === undefined) {
      return true
    }

    // Don't allow overwriting valid data with null/undefined
    if (source === null || source === undefined) {
      return false
    }

    // Arrays are only compatible with arrays
    if (Array.isArray(target) !== Array.isArray(source)) {
      return false
    }

    // Objects are only compatible with objects (excluding arrays and null)
    const targetIsObject = typeof target === 'object' && !Array.isArray(target) && target !== null
    const sourceIsObject = typeof source === 'object' && !Array.isArray(source) && source !== null

    if (targetIsObject !== sourceIsObject) {
      return false
    }

    // Primitives are compatible with same type primitives
    if (typeof target !== 'object' && typeof source !== 'object') {
      return typeof target === typeof source
    }

    return true
  }

  // Use deepClone to create mutable copies and then merge them safely
  const safeDeepMerge = (target: any, source: any): any => {
    if (source === null || source === undefined) {
      return target
    }

    // Check type compatibility - if incompatible, prefer target (initial state)
    if (!areTypesCompatible(target, source)) {
      return target
    }

    // Handle non-object source values
    if (typeof source !== 'object' || source === null) {
      return source
    }

    // Handle non-object target values - if source is object, use source
    if (typeof target !== 'object' || target === null) {
      return source
    }

    if (Array.isArray(target) && Array.isArray(source)) {
      return deepClone(source) // Use deepClone for arrays
    }

    if (Array.isArray(target) || Array.isArray(source)) {
      // This should be handled by type compatibility check above
      return Array.isArray(source) ? deepClone(source) : target
    }

    // Create deep clones to avoid any frozen object issues
    const clonedTarget = deepClone(target)
    const clonedSource = deepClone(source)

    const result = {...clonedTarget}
    for (const [key, value] of Object.entries(clonedSource)) {
      if (
        clonedTarget[key] !== undefined &&
        clonedTarget[key] !== null &&
        typeof clonedTarget[key] === 'object' &&
        !Array.isArray(clonedTarget[key]) &&
        value &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        result[key] = safeDeepMerge(clonedTarget[key], value)
      } else {
        // Check compatibility before merging
        if (areTypesCompatible(clonedTarget[key], value)) {
          result[key] = value
        } else {
          // Keep the target value if types are incompatible
          result[key] = clonedTarget[key]
        }
      }
    }
    return result
  }

  // Start with loaded state as base (prefer loaded values), then apply initial state for non-existent keys
  const result = safeDeepMerge(initialState, loadedState) as Partial<S>

  // For each preserve path, ensure the initial value is maintained
  for (const path of preservePaths) {
    const initialValue = getPath(initialState, [...path])
    if (initialValue !== undefined) {
      // Build the nested structure if it doesn't exist and set the initial value
      const parentPath = path.slice(0, -1)
      const key = path[path.length - 1]

      if (parentPath.length === 0) {
        // Top-level property
        ;(result as any)[key] = initialValue
      } else {
        // Nested property - ensure parent exists
        let current = result as any
        for (let i = 0; i < parentPath.length; i++) {
          const pathKey = parentPath[i]
          if (
            current[pathKey] === undefined ||
            current[pathKey] === null ||
            typeof current[pathKey] !== 'object'
          ) {
            current[pathKey] = {}
          }
          current = current[pathKey]
        }
        current[key] = initialValue
      }
    }
  }

  return result
}
