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
  // Use deepClone to create mutable copies and then merge them safely
  const safeDeepMerge = (target: any, source: any): any => {
    if (source === null || source === undefined) {
      return target
    }

    // If source is not an object but target is, prefer target (initial state)
    if (typeof source !== 'object') {
      return target
    }

    // If target is not an object but source is, use source
    if (typeof target !== 'object') {
      return source
    }

    // Handle type mismatches - if types don't match, prefer the target (initial state)
    if (typeof target !== typeof source) {
      return target
    }

    if (Array.isArray(target) && Array.isArray(source)) {
      return deepClone(source) // Use deepClone for arrays
    }

    if (Array.isArray(target) || Array.isArray(source)) {
      // If one is array and other isn't, prefer the target (initial state)
      return target
    }

    // Create deep clones to avoid any frozen object issues
    const clonedTarget = deepClone(target)
    const clonedSource = deepClone(source)

    const result = {...clonedTarget}
    for (const [key, value] of Object.entries(clonedSource)) {
      if (
        clonedTarget[key] !== undefined &&
        typeof clonedTarget[key] === 'object' &&
        value &&
        typeof value === 'object'
      ) {
        result[key] = safeDeepMerge(clonedTarget[key], value)
      } else if (clonedTarget[key] !== undefined && typeof clonedTarget[key] !== typeof value) {
        // Type mismatch - prefer target (initial state) value
        result[key] = clonedTarget[key]
      } else {
        result[key] = value
      }
    }
    return result
  }

  // Start with initial state as base, then merge loaded state
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
