import {StorageError} from '../../shared/errors'

/**
 * Cookie options interface for type safety
 */
export interface CookieOptions {
  /** Expiration in days or as Date object */
  expires?: number | Date
  /** Cookie path */
  path?: string
  /** Cookie domain */
  domain?: string
  /** Secure flag */
  secure?: boolean
  /** SameSite attribute */
  sameSite?: 'Strict' | 'Lax' | 'None'
}

/**
 * Enhanced cookie parsing with better error handling
 */
function parseCookies(): Map<string, string> {
  const cookies = new Map<string, string>()

  if (!document?.cookie) return cookies

  try {
    // More robust cookie parsing
    document.cookie.split(';').forEach(cookie => {
      const trimmed = cookie.trim()
      if (!trimmed) return

      const equalIndex = trimmed.indexOf('=')

      if (equalIndex > 0) {
        try {
          const name = decodeURIComponent(trimmed.substring(0, equalIndex).trim())
          const value = decodeURIComponent(trimmed.substring(equalIndex + 1).trim())
          cookies.set(name, value)
        } catch (decodeError) {
          // Skip malformed cookies but don't fail completely
          console.warn('Failed to decode cookie:', trimmed, decodeError)
        }
      }
    })
  } catch (error) {
    console.warn('Failed to parse document.cookie:', error)
  }

  return cookies
}

/**
 * Enhanced cookie operations with better parsing and validation
 */
export function getCookieValue(name: string): string | undefined {
  try {
    const cookies = parseCookies()
    return cookies.get(name)
  } catch (error) {
    console.warn('Failed to get cookie', {name, error})
    return undefined
  }
}

/**
 * Get multiple cookies at once with better performance
 */
export function getCookies(names: string[]): Record<string, string | undefined> {
  const cookies = parseCookies()
  const result: Record<string, string | undefined> = {}

  for (const name of names) {
    result[name] = cookies.get(name)
  }

  return result
}

/**
 * Enhanced cookie setting with validation
 */
export function setCookieValue(name: string, value: string, options?: CookieOptions): boolean {
  try {
    // Validate cookie name and value
    if (!name || name.includes(';') || name.includes(',') || name.includes('=')) {
      throw new StorageError('Invalid cookie name', 'setCookie', name)
    }

    // Check cookie size (typical limit is 4KB per cookie)
    const cookieString = `${name}=${value}`
    if (cookieString.length > 4096) {
      console.warn('Cookie size exceeds typical browser limit', {
        name,
        size: cookieString.length,
      })
    }

    setCookie(name, value, options)
    return true
  } catch (error) {
    console.warn('Failed to set cookie', {name, error})
    return false
  }
}

/**
 * Sets a cookie with optional attributes.
 */
export function setCookie(name: string, value: string, options?: CookieOptions): void {
  try {
    let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`

    if (options) {
      if (options.expires) {
        const expires =
          typeof options.expires === 'number'
            ? new Date(Date.now() + options.expires * 864e5)
            : options.expires
        cookieStr += `; expires=${expires.toUTCString()}`
      }
      if (options.path) cookieStr += `; path=${options.path}`
      if (options.domain) cookieStr += `; domain=${options.domain}`
      if (options.secure) cookieStr += `; secure`
      if (options.sameSite) cookieStr += `; samesite=${options.sameSite}`
    }

    document.cookie = cookieStr
  } catch (error) {
    console.warn('Failed to set cookie', {
      operation: 'set cookie',
      name,
      error,
    })
    throw new StorageError(`Failed to set cookie '${name}'`, 'setCookie', name, error)
  }
}

/**
 * Gets a cookie value by name.
 */
export function getCookie(name: string): string | undefined {
  return getCookieValue(name)
}

/**
 * Removes a cookie by name.
 */
export function removeCookie(name: string, path: string = '/'): void {
  setCookie(name, '', {expires: -1, path})
}
