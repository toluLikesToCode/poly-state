import type {PathsOf, FlexiblePath} from '../core/state/state-types/path-types'
import type {Plugin} from '../core/state/state-types/types'
import {deepMergeWithPathPreservation} from '../core/utils/path'

// Describe supported path patterns for omission.
// - FlexiblePath covers string/number segments e.g. ['user', 'token'] or ['todos', 0, 'id']
// - Appending a '*' segment enables wildcards at any depth to target all keys/indices at that level
//   e.g. ['users', '*', 'password'] will omit password for every entry in users array/object.
//   A trailing '*' at the last segment clears an entire collection (array -> [], object -> {}).
//
// Examples:
//  - ['profile', 'secrets', '*']    -> remove all properties of secrets object
//  - ['todos', '*']                 -> remove all items in todos array
//  - ['entities', '*', 'byId', '*'] -> remove all nested byId maps under each entity
//
// Note: Numeric indices are supported for arrays; when out of bounds, the path is ignored with a dev warning.
// Missing object keys are also ignored with a dev warning.
//
// These types are exported implicitly through the plugin signature for better DX.

type PathPattern = FlexiblePath | [...FlexiblePath, '*']
/**
 * A single path specification to remove from persisted state.
 * Supports precise paths (['user', 'token']), numeric indices (['todos', 0]), and wildcards
 * (['users', '*', 'password']).
 */

type PathToRemove<S, P extends PathsOf<S> = PathsOf<S>> = P | PathPattern
/**
 * Collection of path specifications to remove.
 */

type PathsToRemove<S> = PathToRemove<S>[]

/**
 * Create an omit-paths plugin that redacts/omits specific paths from persisted state while
 * preserving those values in memory. Useful for secrets, tokens, ephemeral queues, and any
 * data that should never be written to storage or synced across tabs as-is.
 *
 * How it works
 * 1) beforePersist: Prior to serialization, the plugin walks the state and removes the requested
 *    paths. Wildcards ('*') can target all keys or indices at a level. A final '*' clears an entire
 *    collection (array -> [], object -> {}). The resulting state is what gets persisted.
 * 2) onStoreCreate: Captures the initial in-memory state (or uses initialStateParam) so that when a
 *    persisted snapshot is loaded, the omitted paths can be restored from this initial baseline.
 * 3) onStateLoaded: After reading from storage, merges the loaded state with the captured initial
 *    state using deepMergeWithPathPreservation, ensuring omitted paths are preserved from the
 *    in-memory baseline while persisted fields override the rest.
 * 4) onCrossTabSync: When receiving synced state from another tab, merges it with the current state
 *    using the same preservation rules to avoid leaking/redacting fields.
 *
 * Safety and validation
 * - Invalid or non-object states are sanitized to avoid crashes.
 * - Missing keys and out-of-bounds indices are ignored with dev-time warnings.
 * - Undefined values are filtered out during sanitization.
 *
 * Wildcards
 * - Intermediate '*' applies operation to all children at that level (object keys or array items).
 * - Trailing '*' clears the current collection entirely (object -> {}, array -> []).
 * - Mix concrete indices/keys with '*' to target complex shapes.
 *
 * Gotchas (common pitfalls)
 * - Persistence vs runtime: redaction happens only to persisted/synced snapshots; the in-memory
 *   state still contains the omitted values. Do not assume those fields are missing at runtime.
 * - Array indices: concrete indices like 0 target only that position; if the array order changes,
 *   a different item will be affected. Use '*' when you intend to target all items.
 * - Restoration baseline: if onStoreCreate cannot capture initial state and no initialStateParam is
 *   provided, onStateLoaded cannot restore omitted paths. The validated loaded snapshot will be
 *   used as-is (with a dev warning).
 * - Not a security boundary: secrets remain in memory; this only redacts what is written to
 *   storage/sync. Avoid logging or exposing secrets elsewhere.
 * - Parent creation: the plugin never creates missing parent branches; it only removes existing
 *   values. Ensure your initial state defines defaults for omitted branches.
 * - Clearing vs removing key: a trailing '*' clears collections to [] or {}, it does not remove the
 *   parent key. If you need to remove an entire keyed object, target its parent property.
 * - Schemas & validators: if a downstream schema requires a field you omit, make it optional or
 *   provide a default in initial state to avoid validation failures on load.
 *
 * @typeParam S - Store state shape
 * @param pathsToRemove - One or more paths to omit from persistence. Supports wildcards with '*'.
 * @param storeName - Optional custom plugin name for diagnostics.
 * @param initialStateParam - Optional initial state snapshot used as a restoration baseline if
 *                            capture during onStoreCreate is not desired/possible.
 * @returns Plugin instance that integrates with the store persistence lifecycle.
 *
 * @example
 * // Basic redaction
 * const omitSecrets = createOmitPathsPlugin<{ user: { token?: string } }>([
 *   ['user', 'token'],
 * ])
 *
 * @example
 * // Redact password for every account entry (wildcard over array)
 * const plugin = createOmitPathsPlugin<{
 *   accounts: Array<{ id: string; profile: { password?: string } }>
 * }>([
 *   ['accounts', '*', 'profile', 'password'],
 * ])
 *
 * @example
 * // Clear entire logs array from persistence while keeping it in memory
 * const plugin = createOmitPathsPlugin<{ logs: string[] }>([
 *   ['logs', '*'],
 * ])
 *
 * @example
 * // Mixed deep wildcard over objects
 * const plugin = createOmitPathsPlugin<{
 *   entities: Record<string, { byId: Record<string, { secret?: string }> }>
 * }>([
 *   ['entities', '*', 'byId', '*', 'secret'],
 * ])
 *
 * @remarks
 * When no paths are provided, the plugin becomes a no-op and returns only its name. Provide
 * initialStateParam if you need deterministic restoration in environments where onStoreCreate cannot
 * reliably read state at the right moment (e.g., SSR hydration edge cases).
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
  let storedInitialState: S | null = initialStateParam || null
  // Recursively remove value at a given path, supporting arrays, objects, and wildcards
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
