import type {PathsOf, FlexiblePath} from '../core/state/state-types/path-types'
import type {Plugin} from '../core/state/state-types/types'
import {deepMergeWithPathPreservation} from '../core/utils/path'

type PathPattern = FlexiblePath | [...FlexiblePath, '*']
type PathToRemove<S, P extends PathsOf<S> = PathsOf<S>> = P | PathPattern
type PathsToRemove<S> = PathToRemove<S>[]

/**
 * Plugin to omit specific paths from persisted state.
 *
 * @template S State type
 * @template P Tuple of valid paths to omit
 * @param pathsToRemove Tuple of valid paths to omit from persistence (supports wildcards with '*')
 * @param storeName Optional plugin name
 * @param capturedInitialState Optional initial state to use for restoration (captures at plugin creation time)
 * @returns Plugin instance
 *
 * @example
 * // Omit user.token and all user passwords from persistence
 * const plugin = createOmitPathsPlugin<{ user: { token: string }, users: Array<{ password: string }> }>([
 *   ['user', 'token'],
 *   ['users', '*', 'password'] // Wildcard for all array items
 * ])
 */
export function createOmitPathsPlugin<S extends object>(
  pathsToRemove: PathsToRemove<S>,
  storeName?: string,
  initialStateParam?: S
): Plugin<S> {
  // Early exit for empty paths
  if (!pathsToRemove.length) {
    return {
      name: storeName || 'omitPathsPlugin',
    }
  }

  // Store the captured initial state at plugin creation time
  let storedInitialState: S | null = initialStateParam || null // Recursively remove value at a given path, supporting arrays, objects, and wildcards
  const removeAtPath = (
    obj: any,
    pathSegments: readonly (string | number | '*')[],
    depth: number
  ): any => {
    // Defensive validation
    if (!obj || (typeof obj !== 'object' && !Array.isArray(obj))) {
      return obj
    }

    if (depth === pathSegments.length - 1) {
      const key = pathSegments[depth]

      // Handle wildcard at final level
      if (key === '*') {
        if (Array.isArray(obj)) {
          // For arrays, return empty array (removes all items)
          return []
        } else if (typeof obj === 'object') {
          // For objects, return empty object (removes all properties)
          return {}
        }
        return obj
      }

      // Handle specific key removal
      if (Array.isArray(obj)) {
        const idx = Number(key)
        if (Number.isInteger(idx) && idx >= 0 && idx < obj.length) {
          return [...obj.slice(0, idx), ...obj.slice(idx + 1)]
        }
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[omitPathsPlugin] Array index out of bounds: ${pathSegments.join('.')}`)
        }
        return obj
      } else if (obj && typeof obj === 'object') {
        if (!(key in obj)) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`[omitPathsPlugin] Path does not exist: ${pathSegments.join('.')}`)
          }
          return obj
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {[key]: removed, ...rest} = obj
        return rest
      }
      return obj
    }

    const key = pathSegments[depth]

    // Handle wildcard at intermediate level
    if (key === '*') {
      if (Array.isArray(obj)) {
        // Apply to all array items
        return obj.map(item => removeAtPath(item, pathSegments, depth + 1))
      } else if (typeof obj === 'object') {
        // Apply to all object properties
        const result: any = {}
        for (const [objKey, value] of Object.entries(obj)) {
          result[objKey] = removeAtPath(value, pathSegments, depth + 1)
        }
        return result
      }
      return obj
    }

    // Handle specific key traversal
    if (Array.isArray(obj)) {
      const idx = Number(key)
      if (Number.isInteger(idx) && idx >= 0 && idx < obj.length) {
        const updated = removeAtPath(obj[idx], pathSegments, depth + 1)
        return [...obj.slice(0, idx), updated, ...obj.slice(idx + 1)]
      }
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[omitPathsPlugin] Array index out of bounds: ${pathSegments.slice(0, depth + 1).join('.')}`
        )
      }
      return obj
    } else if (obj && typeof obj === 'object') {
      if (!(key in obj)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `[omitPathsPlugin] Path does not exist: ${pathSegments.slice(0, depth + 1).join('.')}`
          )
        }
        return obj
      }
      return {
        ...obj,
        [key]: removeAtPath(obj[key], pathSegments, depth + 1),
      }
    }
    return obj
  }

  // Enhanced state validation to prevent crashes
  const validateAndSanitizeState = (state: any): any => {
    if (!state || typeof state !== 'object') {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[omitPathsPlugin] Invalid state structure, using fallback')
      }
      return storedInitialState || {}
    }

    // Recursively validate and fix common issues
    const sanitize = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj

      if (Array.isArray(obj)) {
        // Ensure array items are valid
        return obj.filter(item => item !== undefined).map(sanitize)
      }

      const result: any = {}
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          result[key] = sanitize(value)
        }
      }
      return result
    }

    return sanitize(state)
  }

  return {
    name: storeName || 'omitPathsPlugin',
    onStoreCreate(store) {
      // Capture the initial state when the store is created
      try {
        storedInitialState = store.getState()
      } catch (error) {
        console.warn('[OmitPathsPlugin] Failed to capture initial state in onStoreCreate:', error)
      }
    },
    beforePersist(state) {
      try {
        // Validate and sanitize state before processing
        const validState = validateAndSanitizeState(state)

        let newState = validState
        for (const path of pathsToRemove) {
          newState = removeAtPath(newState, path as readonly (string | number | '*')[], 0)
        }
        return newState
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[omitPathsPlugin] Error in beforePersist:', error)
        }
        // Return original state as fallback
        return state
      }
    },
    onStateLoaded(loadedState, _storageType, _store) {
      try {
        // Validate and sanitize loaded state
        const validLoadedState = validateAndSanitizeState(loadedState)

        // If no initial state was captured, we can't properly restore omitted paths
        // In this case, just return the validated loaded state
        if (!storedInitialState) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[omitPathsPlugin] No initial state available for path restoration')
          }
          return validLoadedState
        }

        // Merge loaded state with initial state, preserving omitted paths
        const result = deepMergeWithPathPreservation(
          storedInitialState,
          validLoadedState,
          pathsToRemove as readonly (readonly (string | number)[])[]
        )

        return result
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[omitPathsPlugin] Error in onStateLoaded:', error)
        }
        // Return original loaded state as fallback
        return loadedState
      }
    },
    onCrossTabSync(syncedState, sourceSessionId, store) {
      try {
        // Validate and sanitize the synced state
        const validSyncedState = validateAndSanitizeState(syncedState)

        // Get the current state to restore omitted paths from
        const currentState = store.getState()

        if (!currentState) {
          return validSyncedState
        }

        // Merge synced state with current state, preserving omitted paths from current state
        const result = deepMergeWithPathPreservation(
          currentState,
          validSyncedState,
          pathsToRemove as readonly (readonly (string | number)[])[]
        )

        return result
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[omitPathsPlugin] Error in onCrossTabSync:', error)
        }
        // Return original synced state as fallback
        return syncedState
      }
    },
  }
}
