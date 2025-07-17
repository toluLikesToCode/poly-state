import {CookieOptions} from './cookie'

/**
 * Common interface for all storage types
 */
export interface StorageAdapter<T = any> {
  get(key: string): Promise<T | null>
  set(key: string, value: T): Promise<boolean>
  remove(key: string): Promise<boolean>
  clear(): Promise<boolean>
  keys(): Promise<string[]>
  isAvailable(): boolean
}

export class LocalStorageAdapter implements StorageAdapter {
  async get(key: string): Promise<any> {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : null
    } catch {
      return null
    }
  }

  async set(key: string, value: any): Promise<boolean> {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  }

  async remove(key: string): Promise<boolean> {
    try {
      localStorage.removeItem(key)
      return true
    } catch {
      return false
    }
  }

  async clear(): Promise<boolean> {
    try {
      localStorage.clear()
      return true
    } catch {
      return false
    }
  }

  async keys(): Promise<string[]> {
    return Object.keys(localStorage)
  }

  isAvailable(): boolean {
    try {
      const testKey = '__storage_test__'
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)
      return true
    } catch {
      return false
    }
  }
}

export class SessionStorageAdapter implements StorageAdapter {
  async get(key: string): Promise<any> {
    try {
      const item = sessionStorage.getItem(key)
      return item ? JSON.parse(item) : null
    } catch {
      return null
    }
  }

  async set(key: string, value: any): Promise<boolean> {
    try {
      sessionStorage.setItem(key, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  }

  async remove(key: string): Promise<boolean> {
    try {
      sessionStorage.removeItem(key)
      return true
    } catch {
      return false
    }
  }

  async clear(): Promise<boolean> {
    try {
      sessionStorage.clear()
      return true
    } catch {
      return false
    }
  }

  async keys(): Promise<string[]> {
    return Object.keys(sessionStorage)
  }

  isAvailable(): boolean {
    try {
      const testKey = '__storage_test__'
      sessionStorage.setItem(testKey, 'test')
      sessionStorage.removeItem(testKey)
      return true
    } catch {
      return false
    }
  }
}

export class CookieStorageAdapter implements StorageAdapter {
  private readonly options: CookieOptions

  constructor(options: CookieOptions = {}) {
    this.options = options
  }

  async get(key: string): Promise<any> {
    try {
      const value = this.getCookieValue(key)
      return value ? JSON.parse(value) : null
    } catch {
      return null
    }
  }

  async set(key: string, value: any): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value)
      this.setCookieValue(key, serialized, this.options)
      return true
    } catch {
      return false
    }
  }

  async remove(key: string): Promise<boolean> {
    try {
      this.removeCookieValue(key, this.options.path)
      return true
    } catch {
      return false
    }
  }

  async clear(): Promise<boolean> {
    // Cookies don't have a clear method, so this is a no-op
    return true
  }

  async keys(): Promise<string[]> {
    return this.getAllCookieKeys()
  }

  isAvailable(): boolean {
    return typeof document !== 'undefined'
  }

  private getCookieValue(name: string): string | undefined {
    const cookies = this.parseCookies()
    return cookies.get(name)
  }

  private setCookieValue(name: string, value: string, options?: CookieOptions): void {
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
  }

  private removeCookieValue(name: string, path: string = '/'): void {
    this.setCookieValue(name, '', {expires: -1, path})
  }

  private parseCookies(): Map<string, string> {
    const cookies = new Map<string, string>()

    if (!document.cookie) return cookies

    document.cookie.split(';').forEach(cookie => {
      const trimmed = cookie.trim()
      const equalIndex = trimmed.indexOf('=')

      if (equalIndex > 0) {
        const name = decodeURIComponent(trimmed.substring(0, equalIndex))
        const value = decodeURIComponent(trimmed.substring(equalIndex + 1))
        cookies.set(name, value)
      }
    })

    return cookies
  }

  private getAllCookieKeys(): string[] {
    return Array.from(this.parseCookies().keys())
  }
}
