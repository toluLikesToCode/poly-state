import createStore from './createStore'
import {Store, StoreOptions, StorageType} from './state-types/types'

/**
 * Creates a store with automatic persistence
 * @template S - The store state type
 * @param initialState - Initial state for the store
 * @param persistKey - Key to use for persistence
 * @param options - Additional store options
 * @returns Store instance with persistence enabled
 */
export function createPersistentStore<S extends object>(
  initialState: S,
  persistKey: string,
  options: Omit<StoreOptions<S>, 'persistKey'> = {}
): Store<S> {
  return createStore(initialState, {
    ...options,
    persistKey,
    storageType: options.storageType || StorageType.Local,
  })
}

/**
 * Creates a store with cross-tab synchronization
 * @template S - The store state type
 * @param initialState - Initial state for the store
 * @param persistKey - Key to use for persistence and sync
 * @param options - Additional store options
 * @returns Store instance with cross-tab sync enabled
 */
export function createSharedStore<S extends object>(
  initialState: S,
  persistKey: string,
  options: Omit<StoreOptions<S>, 'persistKey' | 'storageType' | 'syncAcrossTabs'> = {}
): Store<S> {
  return createStore(initialState, {
    ...options,
    persistKey,
    storageType: StorageType.Local,
    syncAcrossTabs: true,
  })
}
