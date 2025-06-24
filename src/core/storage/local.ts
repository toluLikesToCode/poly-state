import {StorageError} from '../../shared/errors'

/**
 * The key used to store the client session ID in localStorage.
 */
export const CLIENT_SESSION_KEY = 'clientSessionId'

/**
 * Internal state for the current client session ID.
 */
let _currentClientSessionId: string | null = null

/**
 * Gets the current client session ID.
 *
 * @returns The current client session ID, or null if not initialized
 */
export function getClientSessionId(): string | null {
  return _currentClientSessionId
}

/**
 * Updates the client session ID and persists it to localStorage.
 *
 * @param newId - The new client session ID to set
 * @returns True if successfully updated, false otherwise
 */
export function updateClientSessionId(newId: string): boolean {
  if (!newId || newId === _currentClientSessionId) {
    return false
  }

  try {
    _currentClientSessionId = newId
    if (isLocalStorageAvailable()) {
      setLocalStorage(CLIENT_SESSION_KEY, newId)
    }
    console.info('Client Session ID updated', {
      operation: 'updateClientSessionId',
      sessionId: newId,
    })
    return true
  } catch (error) {
    console.error('Failed to update client session ID', {
      operation: 'updateClientSessionId',
      error: error instanceof Error ? error.message : String(error),
      newId,
    })
    return false
  }
}

/**
 * Safe error handler for storage operations
 */
function handleStorageError(operation: string, key: string, error: unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error)
  console.warn(`Failed to ${operation}`, {
    operation,
    key,
    error: errorMessage,
  })
}

/**
 * Gets a value from localStorage and parses it from JSON.
 */
export function getLocalStorage<T>(key: string, fallback: T, reviver?: (this: any, key: string, value: any) => any): T {
  try {
    const saved = localStorage.getItem(key)
    if (saved !== null) {
      return JSON.parse(saved, reviver)
    }
  } catch (error) {
    handleStorageError('get localStorage', key, error)
  }
  return fallback
}

/**
 * Sets a value in localStorage after serializing it to JSON.
 */
export function setLocalStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    handleStorageError('set localStorage', key, error)
    throw new StorageError(`Failed to set localStorage for key '${key}'`, 'setLocalStorage', key, error)
  }
}

/**
 * Removes a key from localStorage.
 */
export function removeLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (error) {
    handleStorageError('remove localStorage', key, error)
  }
}

/**
 * Clears all data from localStorage.
 */
export function clearLocalStorage(): void {
  try {
    localStorage.clear()
  } catch (error) {
    handleStorageError('clear localStorage', 'all', error)
  }
}

/**
 * Gets all keys currently stored in localStorage.
 */
export function getAllLocalStorageKeys(): string[] {
  try {
    return Object.keys(localStorage)
  } catch (error) {
    handleStorageError('get localStorage keys', 'all', error)
    return []
  }
}

/**
 * Checks if localStorage is available and functional.
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__'
    localStorage.setItem(testKey, 'test')
    localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}
