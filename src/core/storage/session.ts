import {StorageError} from '../../shared/errors'

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
 * Generates a new session ID using crypto.randomUUID() with fallback
 */
export function generateSessionId(): string {
  if (crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for older browsers
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Gets a value from sessionStorage and parses it from JSON.
 */
export function getSessionStorage<T>(key: string, fallback: T): T {
  try {
    const saved = sessionStorage.getItem(key)
    if (saved !== null) {
      return JSON.parse(saved)
    }
  } catch (error) {
    handleStorageError('get sessionStorage', key, error)
  }
  return fallback
}

/**
 * Sets a value in sessionStorage after serializing it to JSON.
 */
export function setSessionStorage(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    handleStorageError('set sessionStorage', key, error)
    throw new StorageError(`Failed to set sessionStorage for key '${key}'`, 'setSessionStorage', key, error)
  }
}

/**
 * Removes a key from sessionStorage.
 */
export function removeSessionStorage(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch (error) {
    handleStorageError('remove sessionStorage', key, error)
  }
}

/**
 * Clears all data from sessionStorage.
 */
export function clearSessionStorage(): void {
  try {
    sessionStorage.clear()
  } catch (error) {
    handleStorageError('clear sessionStorage', 'all', error)
  }
}

/**
 * Checks if sessionStorage is available and functional.
 *
 * @returns True if available, false otherwise
 */
export function isSessionStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__'
    sessionStorage.setItem(testKey, 'test')
    sessionStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}
