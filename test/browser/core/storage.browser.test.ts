import {beforeEach, describe, expect, it} from 'vitest'
import {
  createStore,
  getCookie,
  getLocalStorage,
  getSessionStorage,
  isLocalStorageAvailable,
  isSessionStorageAvailable,
  Listener,
  removeCookie,
  setCookie,
  setLocalStorage,
  setSessionStorage,
  StorageType,
} from '../../../src/core'

describe('Real Browser Storage Tests', () => {
  beforeEach(() => {
    // Tests run in real browser - clear actual storage
    localStorage.clear()
    sessionStorage.clear()
  })

  describe('localStorage Integration', () => {
    it('should persist state to real localStorage', () => {
      const store = createStore(
        {count: 0, name: 'test'},
        {
          persistKey: 'browser-test-store',
          storageType: StorageType.Local,
        }
      )

      // Update state
      store.dispatch({count: 42, name: 'updated'})

      // Verify real localStorage contains the data
      const stored = localStorage.getItem('browser-test-store')
      expect(stored).toBeTruthy()

      const parsedData = JSON.parse(stored!)
      expect(parsedData.data).toMatchObject({count: 42, name: 'updated'})
    })

    it('should restore state from real localStorage', () => {
      // Pre-populate localStorage with test data
      const testData = {
        data: {count: 99, name: 'restored'},
        meta: {
          lastUpdated: Date.now(),
          sessionId: 'test-session',
          storeName: 'TestStore',
        },
      }
      localStorage.setItem('restore-test', JSON.stringify(testData))

      // Create new store that should load from localStorage
      const store = createStore(
        {count: 0, name: 'initial'},
        {
          persistKey: 'restore-test',
          storageType: StorageType.Local,
        }
      )

      // Verify state was restored
      expect(store.getState()).toMatchObject({count: 99, name: 'restored'})
    })

    it('should handle localStorage quota exceeded', () => {
      // Create large data to test quota
      const largeData = 'x'.repeat(1024 * 1024) // 1MB

      try {
        localStorage.setItem('large-test', largeData)
        // If we get here, the test environment allows large storage
        expect(localStorage.getItem('large-test')).toBe(largeData)
        localStorage.removeItem('large-test')
      } catch (error) {
        // Expected in some environments with storage limits
        expect(error).toBeInstanceOf(Error)
      }
    })

    it('should use real localStorage utility functions', () => {
      const testData = {key: 'value', number: 42}

      // Test setLocalStorage function
      setLocalStorage('utility-test', testData)

      // Verify with native localStorage
      const stored = localStorage.getItem('utility-test')
      expect(JSON.parse(stored!)).toEqual(testData)

      // Test getLocalStorage function
      const retrieved = getLocalStorage('utility-test', {})
      expect(retrieved).toEqual(testData)

      // Test fallback
      const fallback = getLocalStorage('non-existent', {default: true})
      expect(fallback).toEqual({default: true})
    })

    it('should detect localStorage availability', () => {
      expect(isLocalStorageAvailable()).toBe(true)
    })
  })

  describe('sessionStorage Integration', () => {
    it('should persist state to real sessionStorage', () => {
      const store = createStore(
        {session: 'test'},
        {
          persistKey: 'session-test-store',
          storageType: StorageType.Session,
        }
      )

      store.dispatch({session: 'updated'})

      // Verify real sessionStorage
      const stored = sessionStorage.getItem('session-test-store')
      expect(stored).toBeTruthy()

      const parsedData = JSON.parse(stored!)
      expect(parsedData.data).toMatchObject({session: 'updated'})
    })

    it('should use real sessionStorage utility functions', () => {
      const testData = {session: 'data', count: 24}

      // Test setSessionStorage function
      setSessionStorage('session-utility-test', testData)

      // Verify with native sessionStorage
      const stored = sessionStorage.getItem('session-utility-test')
      expect(JSON.parse(stored!)).toEqual(testData)

      // Test getSessionStorage function
      const retrieved = getSessionStorage('session-utility-test', {})
      expect(retrieved).toEqual(testData)
    })

    it('should detect sessionStorage availability', () => {
      expect(isSessionStorageAvailable()).toBe(true)
    })
  })

  describe('Cookie Storage Integration', () => {
    it('should persist state to real cookies', () => {
      const store = createStore(
        {cookie: 'test'},
        {
          persistKey: 'cookie-test-store',
          storageType: StorageType.Cookie,
          cookieOptions: {
            expires: 1, // 1 day
            path: '/',
          },
        }
      )

      store.dispatch({cookie: 'updated'})

      // Verify real document.cookie
      expect(document.cookie).toContain('cookie-test-store')

      // Check cookie value
      const cookieValue = getCookie('__store_cookie-test-store')
      expect(cookieValue, 'cookie-test-store should be set in document.cookie').not.toBeUndefined()
      const parsedData = JSON.parse(cookieValue!)
      expect(parsedData.data).toMatchObject({cookie: 'updated'})
    })

    it('should use real cookie utility functions', () => {
      // Test setCookie function
      setCookie('test-cookie', 'test-value', {
        path: '/',
        expires: 1, // 1 day
      })

      // Verify cookie was set
      expect(document.cookie).toContain('test-cookie=test-value')

      // Test getCookie function
      const cookieValue = getCookie('test-cookie')
      expect(cookieValue).toBe('test-value')

      // Test removeCookie function
      removeCookie('test-cookie')

      // Verify cookie was removed (might still exist in document.cookie but with past expiry)
      const removedValue = getCookie('test-cookie')
      expect(removedValue).toBeUndefined()
    })

    it('should handle cookie size limits gracefully', () => {
      const largeCookieValue = 'x'.repeat(5000) // Larger than typical 4KB limit

      try {
        setCookie('large-cookie', largeCookieValue)
        // If successful, verify it was set
        const retrieved = getCookie('large-cookie')
        if (retrieved) {
          expect(retrieved).toBe(largeCookieValue)
        }
      } catch (error) {
        // Expected in browsers with strict cookie size limits
        expect(error).toBeInstanceOf(Error)
      }
    })
  })

  describe('Cross-Tab Synchronization', () => {
    it('should handle storage events for cross-tab sync', async () => {
      const store = createStore(
        {shared: 0},
        {
          persistKey: 'cross-tab-test',
          storageType: StorageType.Local,
          syncAcrossTabs: true,
        }
      )

      // Listen for state changes
      const stateChanges: any[] = []
      const listener: Listener<{shared: number}> = (newState, prevState) => {
        stateChanges.push(newState)
      }
      store.subscribe(listener)

      // Simulate another tab changing localStorage
      const newData = {
        data: {shared: 999},
        meta: {
          lastUpdated: Date.now(),
          sessionId: 'other-tab-session',
          storeName: 'TestStore',
        },
      }
      localStorage.setItem('cross-tab-test', JSON.stringify(newData))

      // Trigger storage event (simulates cross-tab change)
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'cross-tab-test',
          newValue: localStorage.getItem('cross-tab-test'),
          oldValue: null,
          storageArea: localStorage,
        })
      )

      // Wait for event processing and state update
      await new Promise(resolve => setTimeout(resolve, 100))

      // Assert that the store's state was updated from the storage event
      expect(store.getState().shared).toBe(999)
      // Optionally, check that the stateChanges array captured the update
      expect(stateChanges.some(s => s.shared === 999)).toBe(true)
    })
  })

  describe('Storage Availability Detection', () => {
    it('should correctly detect localStorage availability', () => {
      expect(isLocalStorageAvailable()).toBe(true)
    })

    it('should correctly detect sessionStorage availability', () => {
      expect(isSessionStorageAvailable()).toBe(true)
    })

    it('should correctly detect document availability for cookies', () => {
      expect(typeof document !== 'undefined').toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed data in localStorage', () => {
      // Put invalid JSON in localStorage
      localStorage.setItem('malformed-test', 'invalid-json{')

      expect(() => {
        getLocalStorage('malformed-test', {})
      }).not.toThrow() // Should handle gracefully

      const result = getLocalStorage('malformed-test', {fallback: true})
      expect(result).toEqual({fallback: true})
    })

    it('should handle malformed data in sessionStorage', () => {
      // Put invalid JSON in sessionStorage
      sessionStorage.setItem('malformed-session-test', 'invalid-json{')

      expect(() => {
        getSessionStorage('malformed-session-test', {})
      }).not.toThrow() // Should handle gracefully

      const result = getSessionStorage('malformed-session-test', {fallback: true})
      expect(result).toEqual({fallback: true})
    })

    it('should handle storage operation failures gracefully', () => {
      // Test with very long key (browser-dependent limits)
      const longKey = 'x'.repeat(5000)

      expect(() => {
        setLocalStorage(longKey, 'test')
      }).not.toThrow() // Should handle gracefully or succeed

      expect(() => {
        setSessionStorage(longKey, 'test')
      }).not.toThrow() // Should handle gracefully or succeed
    })
  })
})
