import type {Store, CleanupOptions} from './index'
import {getClientSessionId} from '../storage/index'
/**
 * Registry of all active stores in the application
 *
 */
export const storeRegistry: Map<string, Set<Store<object>>> = new Map()

// --- Session Management (getCurrentSessionStores, cleanupCurrentSessionStores) ---
export function getCurrentSessionStores(): string[] {
  const sessionId = getClientSessionId()
  if (!sessionId || !storeRegistry.has(sessionId)) {
    return []
  }
  const stores = storeRegistry.get(sessionId)!
  return Array.from(stores)
    .map(store => store.getName())
    .filter((name): name is string => name !== undefined)
}

export function cleanupCurrentSessionStores(options?: CleanupOptions): number {
  const sessionId = getClientSessionId()
  if (!sessionId || !storeRegistry.has(sessionId)) return 0

  const stores = Array.from(storeRegistry.get(sessionId)!) // Copy to avoid issues if destroy modifies the set
  let count = 0
  stores.forEach(store => {
    try {
      store.destroy(options) // This will also remove it from storeRegistry
      count++
    } catch (e: any) {
      console.error('Error destroying store during session cleanup:', e)
    }
  })
  // The storeRegistry entry for the session ID should be empty now and potentially deleted by destroy
  if (storeRegistry.has(sessionId) && storeRegistry.get(sessionId)!.size === 0) {
    storeRegistry.delete(sessionId)
  }
  return count
}
