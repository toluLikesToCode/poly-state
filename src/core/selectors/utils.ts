import {deepEqual} from '../utils/index'

export function smartEqual<T>(a: T, b: T): boolean {
  // Fast path: reference equality (works great with Immer's structural sharing)
  if (Object.is(a, b)) {
    return true
  }

  // Handle null/undefined cases
  if (a == null || b == null) {
    return a === b
  }

  // Handle primitives
  if (typeof a !== 'object' || typeof b !== 'object') {
    return a === b
  }

  // For arrays, check length first then shallow compare elements
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false

    // Shallow equality check for array elements
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) {
        // If reference equality fails, fall back to deep equality only if needed
        if (!isSimpleValue(a[i]) || !isSimpleValue(b[i])) {
          return deepEqual(a, b)
        }
        if (a[i] !== b[i]) return false
      }
    }
    return true
  }

  // For objects, check keys count first then shallow compare values
  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)

    if (keysA.length !== keysB.length) return false

    // Shallow equality check for object properties
    for (const key of keysA) {
      if (!(key in b)) return false

      const valueA = (a as any)[key]
      const valueB = (b as any)[key]

      if (!Object.is(valueA, valueB)) {
        // If reference equality fails, fall back to deep equality only if needed
        if (!isSimpleValue(valueA) || !isSimpleValue(valueB)) {
          return deepEqual(a, b)
        }
        if (valueA !== valueB) return false
      }
    }
    return true
  }

  // For complex objects (Sets, Maps, etc.), fall back to deep equality
  return deepEqual(a, b)
}

export function isSimpleValue(value: any): boolean {
  if (value == null) return true
  const type = typeof value
  return type === 'string' || type === 'number' || type === 'boolean' || type === 'symbol'
}

export function isPlainObject(value: any): boolean {
  return value != null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype
}

export function haveInputsChanged<T extends readonly unknown[]>(
  previousInputs: T | undefined,
  currentInputs: T
): boolean {
  // No previous inputs means this is the first run
  if (!previousInputs) return true

  // Length mismatch is always a change
  if (previousInputs.length !== currentInputs.length) return true

  // Check each input using smart equality
  for (let i = 0; i < currentInputs.length; i++) {
    if (!smartEqual(previousInputs[i], currentInputs[i])) {
      return true // Found a difference, inputs have changed
    }
  }

  return false // All inputs are equal, no change
}

/**
 * Serializes parameters for use as a cache key.
 * Handles primitives, objects (with sorted keys), and falls back for non-serializable values.
 * @param params - The parameters to serialize
 * @returns A string key for caching
 */
export function serializeParams(params: any): string {
  try {
    if (params === null || params === undefined || typeof params !== 'object') {
      return JSON.stringify(params)
    }
    const sortedParams = sortObjectKeys(params)
    return JSON.stringify(sortedParams)
  } catch {
    return `non_serializable_${Date.now()}_${Math.random().toString(36).substring(2)}`
  }
}

/**
 * Returns a new object with sorted keys for consistent serialization.
 * @param obj - The object to sort
 * @returns A new object with sorted keys
 */
export function sortObjectKeys(obj: object): object {
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = (obj as any)[key]
      return acc
    }, {} as any)
}

/**
 * Starts a TTL-based cleanup interval for a cache map.
 * @param cache - The cache map
 * @param cleanupInterval - How often to check for expired entries (ms)
 * @param ttl - Time to live for each entry (ms)
 * @param onCleanup - Callback for each removed entry
 * @returns A function to stop the cleanup
 */
export function startTTLCacheCleanup<T>(
  cache: Map<string, T>,
  cleanupInterval: number,
  ttl: number,
  onCleanup: (key: string, value: T) => void
): () => void {
  let intervalHandle: NodeJS.Timeout | null = null
  const interval = setInterval(() => {
    const now = Date.now()
    const toRemove: string[] = []
    cache.forEach((value, key) => {
      if ((value as any).lastAccessed && now - (value as any).lastAccessed > ttl) {
        toRemove.push(key)
      }
    })
    toRemove.forEach(key => {
      const value = cache.get(key)
      if (value) onCleanup(key, value)
      cache.delete(key)
    })
    if (cache.size === 0 && intervalHandle) {
      clearInterval(intervalHandle)
      intervalHandle = null
    }
  }, cleanupInterval)
  intervalHandle = interval
  return () => {
    if (intervalHandle) {
      clearInterval(intervalHandle)
      intervalHandle = null
    }
  }
}
