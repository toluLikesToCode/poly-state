/**
 * StorageManager: Unified Browser Storage Utility
 *
 * @remarks
 * This module provides a unified interface for browser storage needs, including
 * sessionStorage, localStorage, and cookies. It abstracts away browser quirks
 * and provides safe, typed methods for storing and retrieving data.
 *
 * @packageDocumentation
 */
/**
 * The key used to store the client session ID in localStorage.
 */
export const CLIENT_SESSION_KEY = "clientSessionId";

/**
 * Internal state for the current client session ID.
 */
let _currentClientSessionId: string | null = null;

/**
 * Cookie options interface for type safety
 */
export interface CookieOptions {
  /** Expiration in days or as Date object */
  expires?: number | Date;
  /** Cookie path */
  path?: string;
  /** Cookie domain */
  domain?: string;
  /** Secure flag */
  secure?: boolean;
  /** SameSite attribute */
  sameSite?: "Strict" | "Lax" | "None";
}

/**
 * Storage operation error with context
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public operation: string,
    public key?: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = "StorageError";
  }
}

/**
 * Safe error handler for storage operations
 */
function handleStorageError(
  operation: string,
  key: string,
  error: unknown
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.warn(`Failed to ${operation}`, {
    operation,
    key,
    error: errorMessage,
  });
}

/**
 * Gets a value from localStorage and parses it from JSON.
 *
 * @param key - The localStorage key
 * @param fallback - The fallback value if not found or parse fails
 * @param reviver - Optional JSON reviver function
 * @returns The parsed value or the fallback
 * @example
 * ```typescript
 * const user = getLocalStorage<User>("user", null);
 * ```
 */
export function getLocalStorage<T>(
  key: string,
  fallback: T,
  reviver?: (this: any, key: string, value: any) => any
): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      return JSON.parse(saved, reviver);
    }
  } catch (error) {
    handleStorageError("get localStorage", key, error);
  }
  return fallback;
}

/**
 * Sets a value in localStorage after serializing it to JSON.
 *
 * @param key - The localStorage key
 * @param value - The value to store (must be serializable)
 * @throws {StorageError} If the value is not serializable or storage fails
 * @example
 * ```typescript
 * setLocalStorage("user", { name: "Alice" });
 * ```
 */
export function setLocalStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    handleStorageError("set localStorage", key, error);
    throw new StorageError(
      `Failed to set localStorage for key '${key}'`,
      "setLocalStorage",
      key,
      error
    );
  }
}

/**
 * Removes a key from localStorage.
 *
 * @param key - The key to remove
 */
export function removeLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    handleStorageError("remove localStorage", key, error);
  }
}

/**
 * Gets a value from sessionStorage and parses it from JSON.
 *
 * @param key - The sessionStorage key
 * @param fallback - The fallback value if not found or parse fails
 * @returns The parsed value or the fallback
 */
export function getSessionStorage<T>(key: string, fallback: T): T {
  try {
    const saved = sessionStorage.getItem(key);
    if (saved !== null) {
      return JSON.parse(saved);
    }
  } catch (error) {
    handleStorageError("get sessionStorage", key, error);
  }
  return fallback;
}

/**
 * Sets a value in sessionStorage after serializing it to JSON.
 *
 * @param key - The sessionStorage key
 * @param value - The value to store (must be serializable)
 * @throws {StorageError} If the value is not serializable or storage fails
 */
export function setSessionStorage(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    handleStorageError("set sessionStorage", key, error);
    throw new StorageError(
      `Failed to set sessionStorage for key '${key}'`,
      "setSessionStorage",
      key,
      error
    );
  }
}

/**
 * Removes a key from sessionStorage.
 *
 * @param key - The key to remove
 */
export function removeSessionStorage(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    handleStorageError("remove sessionStorage", key, error);
  }
}

/**
 * Sets a cookie with optional attributes.
 *
 * @param name - The cookie name
 * @param value - The cookie value
 * @param options - Optional attributes (expires, path, domain, secure, sameSite)
 * @example
 * ```typescript
 * setCookie('user', 'alice', { expires: 7 });
 * ```
 */
export function setCookie(
  name: string,
  value: string,
  options?: CookieOptions
): void {
  try {
    let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

    if (options) {
      if (options.expires) {
        const expires =
          typeof options.expires === "number"
            ? new Date(Date.now() + options.expires * 864e5)
            : options.expires;
        cookieStr += `; expires=${expires.toUTCString()}`;
      }
      if (options.path) cookieStr += `; path=${options.path}`;
      if (options.domain) cookieStr += `; domain=${options.domain}`;
      if (options.secure) cookieStr += `; secure`;
      if (options.sameSite) cookieStr += `; samesite=${options.sameSite}`;
    }

    document.cookie = cookieStr;
  } catch (error) {
    handleStorageError("set cookie", name, error);
    throw new StorageError(
      `Failed to set cookie '${name}'`,
      "setCookie",
      name,
      error
    );
  }
}

/**
 * Gets a cookie value by name.
 *
 * @param name - The cookie name
 * @returns The cookie value, or undefined if not found
 * @example
 * ```typescript
 * const value = getCookie('user');
 * ```
 */
export function getCookie(name: string): string | undefined {
  try {
    if (!document.cookie) return undefined;

    const cookies = document.cookie.split("; ");
    for (const cookie of cookies) {
      const [k, v] = cookie.split("=");
      if (decodeURIComponent(k) === name) {
        return decodeURIComponent(v || "");
      }
    }
  } catch (error) {
    handleStorageError("get cookie", name, error);
  }
  return undefined;
}

/**
 * Removes a cookie by name.
 *
 * @param name - The cookie name
 * @param path - The cookie path (should match the path used to set the cookie)
 * @example
 * ```typescript
 * removeCookie('user');
 * ```
 */
export function removeCookie(name: string, path: string = "/"): void {
  setCookie(name, "", { expires: -1, path });
}

/**
 * Checks if localStorage is available and functional.
 *
 * @returns True if available, false otherwise
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const testKey = "__storage_test__";
    localStorage.setItem(testKey, "test");
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if sessionStorage is available and functional.
 *
 * @returns True if available, false otherwise
 */
export function isSessionStorageAvailable(): boolean {
  try {
    const testKey = "__storage_test__";
    sessionStorage.setItem(testKey, "test");
    sessionStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates a new session ID using crypto.randomUUID() with fallback
 */
function generateSessionId(): string {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Gets the current client session ID.
 *
 * @returns The current client session ID, or null if not initialized
 */
export function getClientSessionId(): string | null {
  return _currentClientSessionId;
}

/**
 * Updates the client session ID and persists it to localStorage.
 *
 * @param newId - The new client session ID to set
 * @returns True if successfully updated, false otherwise
 */
export function updateClientSessionId(newId: string): boolean {
  if (!newId || newId === _currentClientSessionId) {
    return false;
  }

  try {
    _currentClientSessionId = newId;
    if (isLocalStorageAvailable()) {
      setLocalStorage(CLIENT_SESSION_KEY, newId);
    }
    console.info("Client Session ID updated", {
      operation: "updateClientSessionId",
      sessionId: newId,
    });
    return true;
  } catch (error) {
    console.error("Failed to update client session ID", {
      operation: "updateClientSessionId",
      error: error instanceof Error ? error.message : String(error),
      newId,
    });
    return false;
  }
}

/**
 * Clears all data from localStorage.
 *
 * @remarks
 * Use with caution! This will remove all keys for the current origin.
 */
export function clearLocalStorage(): void {
  try {
    localStorage.clear();
  } catch (error) {
    handleStorageError("clear localStorage", "all", error);
  }
}

/**
 * Clears all data from sessionStorage.
 *
 * @remarks
 * Use with caution! This will remove all keys for the current origin and session.
 */
export function clearSessionStorage(): void {
  try {
    sessionStorage.clear();
  } catch (error) {
    handleStorageError("clear sessionStorage", "all", error);
  }
}

/**
 * Gets all keys currently stored in localStorage.
 *
 * @returns An array of all localStorage keys
 */
export function getAllLocalStorageKeys(): string[] {
  try {
    return Object.keys(localStorage);
  } catch (error) {
    handleStorageError("get localStorage keys", "all", error);
    return [];
  }
}

/**
 * Gets all keys currently stored in sessionStorage.
 *
 * @returns An array of all sessionStorage keys
 */
export function getAllSessionStorageKeys(): string[] {
  try {
    return Object.keys(sessionStorage);
  } catch (error) {
    handleStorageError("get sessionStorage keys", "all", error);
    return [];
  }
}
