import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
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
  LocalStorageAdapter,
  SessionStorageAdapter,
  CookieStorageAdapter,
  Store,
} from '../../../src/core'

import {withErrorRecovery} from '../../../src/shared'

describe('Real Browser Storage Tests', () => {
  beforeEach(() => {
    // Tests run in real browser - clear actual storage
    localStorage.clear()
    sessionStorage.clear()
  })

  describe('localStorage Integration', () => {
    let store: Store<{count: number; name: string}>

    afterEach(() => {
      // Clean up after each test
      if (store) {
        store.destroy({removePersistedState: true})
      }
    })
    it('should persist state to real localStorage', () => {
      store = createStore(
        {count: 0, name: 'test'},
        {
          persistKey: 'browser-test-store',
          storageType: StorageType.Local,
          name: 'TEST =>should persist state to real localStorage<=',
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

    it('should restore state from real localStorage', async () => {
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
      store = createStore(
        {count: 0, name: 'initial'},
        {
          persistKey: 'restore-test',
          storageType: StorageType.Local,
        }
      )
      await store.waitForStateLoad()

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

      // Create a promise that resolves when the state changes to the expected value
      const waitForStateChange = new Promise<void>(resolve => {
        const listener: Listener<{shared: number}> = newState => {
          if (newState.shared === 999) {
            resolve()
          }
        }
        store.subscribe(listener)
      })

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

      // Wait for the specific state change we expect
      await waitForStateChange

      // Assert that the store's state was updated from the storage event
      expect(store.getState().shared).toBe(999)
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

  describe('Unified Storage Adapters (Development)', () => {
    describe('LocalStorageAdapter', () => {
      let adapter: LocalStorageAdapter

      beforeEach(() => {
        adapter = new LocalStorageAdapter()
        localStorage.clear()
      })

      it('should perform basic CRUD operations', async () => {
        const testData = {test: 'value', number: 42}

        // Test availability
        expect(adapter.isAvailable()).toBe(true)

        // Test set
        const setResult = await adapter.set('test-key', testData)
        expect(setResult).toBe(true)

        // Test get
        const getData = await adapter.get('test-key')
        expect(getData).toEqual(testData)

        // Test keys
        const keys = await adapter.keys()
        expect(keys).toContain('test-key')

        // Test remove
        const removeResult = await adapter.remove('test-key')
        expect(removeResult).toBe(true)

        // Verify removal
        const verifyData = await adapter.get('test-key')
        expect(verifyData).toBeNull()
      })

      it('should handle errors gracefully', async () => {
        // Test with very large data that might exceed quota
        const largeData = 'x'.repeat(1024 * 1024) // 1MB

        const result = await withErrorRecovery(() => adapter.set('large-test', largeData), {
          maxRetries: 2,
          fallbackValue: false,
          retryDelay: 10,
        })

        // Should either succeed or fail gracefully
        expect(typeof result).toBe('boolean')
      })
    })

    describe('SessionStorageAdapter', () => {
      let adapter: SessionStorageAdapter

      beforeEach(() => {
        adapter = new SessionStorageAdapter()
        sessionStorage.clear()
      })

      it('should perform basic CRUD operations', async () => {
        const testData = {session: 'data', count: 24}

        expect(adapter.isAvailable()).toBe(true)

        await adapter.set('session-test', testData)
        const retrieved = await adapter.get('session-test')
        expect(retrieved).toEqual(testData)

        await adapter.remove('session-test')
        const removed = await adapter.get('session-test')
        expect(removed).toBeNull()
      })
    })

    describe('CookieStorageAdapter', () => {
      let adapter: CookieStorageAdapter

      beforeEach(() => {
        adapter = new CookieStorageAdapter({
          expires: 1,
          path: '/',
          sameSite: 'Lax',
        })
        // Clear existing cookies by setting them to expire
        document.cookie.split(';').forEach(cookie => {
          const eqPos = cookie.indexOf('=')
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
        })
      })

      it('should perform basic CRUD operations', async () => {
        const testData = {cookie: 'test', value: 123}

        expect(adapter.isAvailable()).toBe(true)

        await adapter.set('cookie-test', testData)
        const retrieved = await adapter.get('cookie-test')
        expect(retrieved).toEqual(testData)

        const keys = await adapter.keys()
        expect(keys).toContain('cookie-test')

        await adapter.remove('cookie-test')
        const removed = await adapter.get('cookie-test')
        expect(removed).toBeNull()
      })
    })
  })

  describe('Error Recovery Utilities (Development)', () => {
    it('should retry failed operations', async () => {
      let attempts = 0

      const result = await withErrorRecovery(
        async () => {
          attempts++
          if (attempts < 3) {
            throw new Error('Simulated failure')
          }
          return 'success'
        },
        {
          maxRetries: 3,
          retryDelay: 1,
          onRetry: attempt => {
            expect(attempt).toBeGreaterThan(0)
          },
        }
      )

      expect(result).toBe('success')
      expect(attempts).toBe(3)
    })

    it('should return fallback value on complete failure', async () => {
      const result = await withErrorRecovery(
        async () => {
          throw new Error('Always fails')
        },
        {
          maxRetries: 2,
          retryDelay: 1,
          fallbackValue: 'fallback',
        }
      )

      expect(result).toBe('fallback')
    })
  })

  describe('Storage Health Monitor (New Component)', () => {
    describe('StorageHealthMonitor Class', () => {
      it('should create instance and perform health checks', async () => {
        const {StorageHealthMonitor} = await import(
          '../../../src/core/monitors/storageHealthMonitor'
        )

        const monitor = new StorageHealthMonitor()

        // Run health check
        const report = await monitor.checkHealth()

        // Verify report structure
        expect(report).toHaveProperty('timestamp')
        expect(report).toHaveProperty('adapters')
        expect(report).toHaveProperty('overall')

        // Verify adapter results structure
        expect(report.adapters.localStorage).toHaveProperty('available')
        expect(report.adapters.localStorage).toHaveProperty('canRead')
        expect(report.adapters.localStorage).toHaveProperty('canWrite')
        expect(report.adapters.localStorage).toHaveProperty('latency')

        expect(report.adapters.sessionStorage).toHaveProperty('available')
        expect(report.adapters.sessionStorage).toHaveProperty('canRead')
        expect(report.adapters.sessionStorage).toHaveProperty('canWrite')
        expect(report.adapters.sessionStorage).toHaveProperty('latency')

        expect(report.adapters.cookies).toHaveProperty('available')
        expect(report.adapters.cookies).toHaveProperty('canRead')
        expect(report.adapters.cookies).toHaveProperty('canWrite')
        expect(report.adapters.cookies).toHaveProperty('latency')

        // In browser environment, localStorage should be available
        expect(report.adapters.localStorage.available).toBe(true)
        expect(report.adapters.localStorage.canRead).toBe(true)
        expect(report.adapters.localStorage.canWrite).toBe(true)
        expect(report.adapters.localStorage.latency).toBeGreaterThan(0)

        // sessionStorage should also be available
        expect(report.adapters.sessionStorage.available).toBe(true)
        expect(report.adapters.sessionStorage.canRead).toBe(true)
        expect(report.adapters.sessionStorage.canWrite).toBe(true)

        // Cookies should be available in browser
        expect(report.adapters.cookies.available).toBe(true)

        // Verify overall health
        expect(report.overall.healthy).toBe(true)
        expect(report.overall.preferredAdapter).toBe('localStorage')
        expect(Array.isArray(report.overall.warnings)).toBe(true)

        // Test getting last report
        const lastReport = monitor.getLastReport()
        expect(lastReport?.timestamp).toBe(report.timestamp)
      })

      it('should get recommended adapter', async () => {
        const {StorageHealthMonitor} = await import(
          '../../../src/core/monitors/storageHealthMonitor'
        )

        const monitor = new StorageHealthMonitor()

        // Run health check first
        await monitor.checkHealth()

        // Test recommended adapter
        const recommendedAdapter = monitor.getRecommendedAdapter()
        expect(recommendedAdapter).not.toBeNull()
        expect(recommendedAdapter?.isAvailable()).toBe(true)

        // Test that we can use the recommended adapter
        if (recommendedAdapter) {
          const testKey = 'health-monitor-test'
          const testValue = {test: true, timestamp: Date.now()}

          const setResult = await recommendedAdapter.set(testKey, testValue)
          expect(setResult).toBe(true)

          const getValue = await recommendedAdapter.get(testKey)
          expect(getValue).toEqual(testValue)

          const removeResult = await recommendedAdapter.remove(testKey)
          expect(removeResult).toBe(true)

          const verifyRemoval = await recommendedAdapter.get(testKey)
          expect(verifyRemoval).toBeNull()
        }
      })

      it('should handle monitoring lifecycle', async () => {
        const {StorageHealthMonitor} = await import(
          '../../../src/core/monitors/storageHealthMonitor'
        )

        const monitor = new StorageHealthMonitor()

        // Initially no report
        expect(monitor.getLastReport()).toBeNull()

        // Start monitoring with short interval for testing
        monitor.startMonitoring(10)

        // Wait for a couple of cycles
        await new Promise(resolve => setTimeout(resolve, 20))

        // Should have run at least one check
        const report = monitor.getLastReport()
        expect(report).not.toBeNull()
        expect(report?.overall.healthy).toBe(true)

        // Stop monitoring
        monitor.stopMonitoring()

        // The report should still be available
        expect(monitor.getLastReport()).not.toBeNull()

        // Test multiple start/stop cycles
        monitor.startMonitoring(10)
        monitor.stopMonitoring()
        monitor.startMonitoring(10)
        monitor.stopMonitoring()

        // Should still have the report
        expect(monitor.getLastReport()).not.toBeNull()
      })

      it('should force adapter preferences', async () => {
        const {StorageHealthMonitor} = await import(
          '../../../src/core/monitors/storageHealthMonitor'
        )

        const monitor = new StorageHealthMonitor()

        // Test forcing localStorage preference
        const localStorageAdapter = await monitor.forceAdapterPreference('localStorage')
        expect(localStorageAdapter).not.toBeNull()
        expect(localStorageAdapter?.isAvailable()).toBe(true)

        // Test forcing sessionStorage preference
        const sessionStorageAdapter = await monitor.forceAdapterPreference('sessionStorage')
        expect(sessionStorageAdapter).not.toBeNull()
        expect(sessionStorageAdapter?.isAvailable()).toBe(true)

        // Test forcing cookies preference
        const cookieAdapter = await monitor.forceAdapterPreference('cookies')
        expect(cookieAdapter).not.toBeNull()
        expect(cookieAdapter?.isAvailable()).toBe(true)
      })

      it('should provide adapter details for debugging', async () => {
        const {StorageHealthMonitor} = await import(
          '../../../src/core/monitors/storageHealthMonitor'
        )

        const monitor = new StorageHealthMonitor()
        const details = monitor.getAdapterDetails()

        // Verify structure
        expect(details).toHaveProperty('localStorage')
        expect(details).toHaveProperty('sessionStorage')
        expect(details).toHaveProperty('cookies')

        // Each should have adapter and info
        expect(details.localStorage).toHaveProperty('adapter')
        expect(details.localStorage).toHaveProperty('info')
        expect(typeof details.localStorage.info).toBe('string')

        expect(details.sessionStorage).toHaveProperty('adapter')
        expect(details.sessionStorage).toHaveProperty('info')
        expect(typeof details.sessionStorage.info).toBe('string')

        expect(details.cookies).toHaveProperty('adapter')
        expect(details.cookies).toHaveProperty('info')
        expect(typeof details.cookies.info).toBe('string')

        // Test that adapters work
        expect(details.localStorage.adapter.isAvailable()).toBe(true)
        expect(details.sessionStorage.adapter.isAvailable()).toBe(true)
        expect(details.cookies.adapter.isAvailable()).toBe(true)
      })
    })

    describe('Singleton Instance', () => {
      it('should provide a singleton instance', async () => {
        const {storageHealthMonitor} = await import(
          '../../../src/core/monitors/storageHealthMonitor'
        )

        // Should be available
        expect(storageHealthMonitor).toBeDefined()

        // Should work like a regular instance
        const report = await storageHealthMonitor.checkHealth()
        expect(report.overall.healthy).toBe(true)

        const adapter = storageHealthMonitor.getRecommendedAdapter()
        expect(adapter).not.toBeNull()

        // Test persistence across calls
        const firstReport = storageHealthMonitor.getLastReport()
        expect(firstReport).not.toBeNull()

        // Wait a moment to ensure different timestamp
        await new Promise(resolve => setTimeout(resolve, 10))

        // Should be the same instance
        const report2 = await storageHealthMonitor.checkHealth()
        expect(report2.timestamp).toBeGreaterThan(firstReport!.timestamp)
      })
    })

    describe('Real-world Storage Scenarios', () => {
      it('should handle storage quota scenarios', async () => {
        const {StorageHealthMonitor} = await import(
          '../../../src/core/monitors/storageHealthMonitor'
        )

        const monitor = new StorageHealthMonitor()

        // Run initial health check
        const initialReport = await monitor.checkHealth()
        expect(initialReport.overall.healthy).toBe(true)

        // Simulate filling up storage (we'll just test normal operation since
        // actually filling storage is unreliable in tests)
        const adapter = monitor.getRecommendedAdapter()
        if (adapter) {
          // Test large data operations
          const largeData = {content: 'x'.repeat(1000)} // 1KB

          const setResult = await adapter.set('large-test-key', largeData)
          expect(setResult).toBe(true)

          const getData = await adapter.get('large-test-key')
          expect(getData?.content).toBe('x'.repeat(1000))

          await adapter.remove('large-test-key')
        }
      })

      it('should handle cross-adapter operations', async () => {
        const {StorageHealthMonitor} = await import(
          '../../../src/core/monitors/storageHealthMonitor'
        )

        const monitor = new StorageHealthMonitor()
        await monitor.checkHealth()

        const details = monitor.getAdapterDetails()
        const testData = {crossAdapter: true, timestamp: Date.now()}

        // Test each adapter individually
        for (const [name, {adapter}] of Object.entries(details)) {
          if (adapter.isAvailable()) {
            const testKey = `cross-adapter-test-${name}`

            await adapter.set(testKey, testData)
            const retrieved = await adapter.get(testKey)
            expect(retrieved).toEqual(testData)

            await adapter.remove(testKey)
            const removed = await adapter.get(testKey)
            expect(removed).toBeNull()
          }
        }
      })

      it('should provide meaningful performance metrics', async () => {
        const {StorageHealthMonitor} = await import(
          '../../../src/core/monitors/storageHealthMonitor'
        )

        const monitor = new StorageHealthMonitor()
        const report = await monitor.checkHealth()

        // All latencies should be reasonable (less than 100ms in normal conditions)
        expect(report.adapters.localStorage.latency).toBeGreaterThan(0)
        expect(report.adapters.localStorage.latency).toBeLessThan(100)

        expect(report.adapters.sessionStorage.latency).toBeGreaterThan(0)
        expect(report.adapters.sessionStorage.latency).toBeLessThan(100)

        if (report.adapters.cookies.available) {
          expect(report.adapters.cookies.latency).toBeGreaterThan(0)
          expect(report.adapters.cookies.latency).toBeLessThan(100)
        }

        // Should not have performance warnings for normal operation
        const perfWarnings = report.overall.warnings.filter(w => w.includes('latency'))
        expect(perfWarnings.length).toBe(0)
      })
    })
  })

  describe('Enhanced Development Mode Utilities (Real Browser)', () => {
    // Import dev mode utilities
    let devModeUtils: typeof import('../../../src/core/utils/devMode')

    beforeEach(async () => {
      devModeUtils = await import('../../../src/core/utils/devMode')
      localStorage.clear()
      sessionStorage.clear()
    })

    describe('Development Mode Configuration', () => {
      it('should manage dev mode config with real storage', async () => {
        const {getDevModeConfig, setDevModeConfig, enableDevMode, disableDevMode} = devModeUtils

        // Test getting default config
        const defaultConfig = await getDevModeConfig()
        expect(defaultConfig).toMatchObject({
          enabled: expect.any(Boolean),
          verboseLogging: expect.any(Boolean),
          storageAdapterTesting: expect.any(Boolean),
          performanceMonitoring: expect.any(Boolean),
          stateValidation: expect.any(Boolean),
          lastUpdated: expect.any(String),
        })

        // Test updating config
        const updateResult = await setDevModeConfig({
          verboseLogging: false,
          performanceMonitoring: true,
        })
        expect(updateResult).toBe(true)

        // Verify config was updated
        const updatedConfig = await getDevModeConfig()
        expect(updatedConfig.verboseLogging).toBe(false)
        expect(updatedConfig.performanceMonitoring).toBe(true)

        // Test enable/disable
        const enableResult = await enableDevMode({
          storageAdapterTesting: true,
        })
        expect(enableResult).toBe(true)

        const enabledConfig = await getDevModeConfig()
        expect(enabledConfig.enabled).toBe(true)
        expect(enabledConfig.storageAdapterTesting).toBe(true)

        // Test disable
        const disableResult = await disableDevMode()
        expect(disableResult).toBe(true)

        const disabledConfig = await getDevModeConfig()
        expect(disabledConfig.enabled).toBe(false)
      })

      it('should maintain backward compatibility with legacy flag', async () => {
        const {setDevModeConfig} = devModeUtils

        // Update config
        await setDevModeConfig({enabled: true})

        // Check legacy flag in localStorage
        const legacyFlag = localStorage.getItem('APP_CLIENT_DEV_MODE')
        expect(legacyFlag).toBe('true')

        // Disable and check again
        await setDevModeConfig({enabled: false})
        const disabledFlag = localStorage.getItem('APP_CLIENT_DEV_MODE')
        expect(disabledFlag).toBe('false')
      })
    })

    describe('Storage Adapter Testing in Development', () => {
      it('should test all storage adapters with real browser storage', async () => {
        const {testStorageAdaptersInDevMode, enableDevMode} = devModeUtils

        // Enable dev mode first
        await enableDevMode({storageAdapterTesting: true})

        // Test storage adapters
        const results = await testStorageAdaptersInDevMode()

        expect(results).toHaveProperty('localStorage')
        expect(results).toHaveProperty('sessionStorage')
        expect(results).toHaveProperty('cookies')
        expect(results).toHaveProperty('errors')

        // In real browser environment, localStorage and sessionStorage should work
        expect(results.localStorage).toBe(true)
        expect(results.sessionStorage).toBe(true)

        // Cookies should work in browser environment
        expect(results.cookies).toBe(true)

        // Should have no errors in normal browser environment
        expect(results.errors).toEqual([])
      })

      it('should handle storage quota errors gracefully', async () => {
        const {testStorageAdaptersInDevMode, enableDevMode} = devModeUtils

        await enableDevMode()

        // Fill up localStorage to near capacity (this might not work in all test environments)
        try {
          const largeData = 'x'.repeat(1024 * 1024) // 1MB chunks
          let i = 0
          while (i < 10) {
            // Try to fill some space
            localStorage.setItem(`large_test_${i}`, largeData)
            i++
          }
        } catch (error) {
          // Expected if quota is exceeded
        }

        // Test should still work with error recovery
        const results = await testStorageAdaptersInDevMode()
        expect(typeof results.localStorage).toBe('boolean')
        expect(Array.isArray(results.errors)).toBe(true)

        // Clean up
        for (let i = 0; i < 10; i++) {
          localStorage.removeItem(`large_test_${i}`)
        }
      })
    })

    describe('Global Development Interface', () => {
      it('should provide working global development methods', async () => {
        const {enableDevMode} = devModeUtils

        // Enable dev mode to set up global interface
        await enableDevMode()

        // @ts-ignore - Access global dev mode interface
        const devMode = window.__polyDevMode

        expect(devMode).toBeDefined()

        // Test utility methods work
        const enableLoggingResult = await devMode.enableVerboseLogging()
        expect(enableLoggingResult).toBe(true)

        const disableLoggingResult = await devMode.disableVerboseLogging()
        expect(disableLoggingResult).toBe(true)

        const enableTestingResult = await devMode.enableStorageTesting()
        expect(enableTestingResult).toBe(true)

        const enableMonitoringResult = await devMode.enablePerformanceMonitoring()
        expect(enableMonitoringResult).toBe(true)

        // Test storage adapter access
        const adapter = devMode.getStorageAdapter()
        expect(adapter).toBeDefined()
        expect(typeof adapter.isAvailable).toBe('function')
        expect(adapter.isAvailable()).toBe(true)

        // Test storage health method
        const healthResults = await devMode.testStorageHealth()
        expect(healthResults).toHaveProperty('localStorage')
        expect(healthResults).toHaveProperty('sessionStorage')
        expect(healthResults).toHaveProperty('cookies')
      })
    })

    describe('Configuration Persistence and Recovery', () => {
      it('should persist configuration across page reloads', async () => {
        const {setDevModeConfig, getDevModeConfig} = devModeUtils

        // Set specific configuration
        const testConfig = {
          verboseLogging: false,
          performanceMonitoring: true,
          stateValidation: false,
        }

        await setDevModeConfig(testConfig)

        // Simulate page reload by creating new dev mode instance
        const newDevModeUtils = await import('../../../src/core/utils/devMode')

        // Configuration should persist
        const persistedConfig = await newDevModeUtils.getDevModeConfig()
        expect(persistedConfig.verboseLogging).toBe(false)
        expect(persistedConfig.performanceMonitoring).toBe(true)
        expect(persistedConfig.stateValidation).toBe(false)
      })

      it('should recover from corrupted configuration', async () => {
        const {getDevModeConfig} = devModeUtils

        // Manually corrupt the stored configuration
        localStorage.setItem('APP_CLIENT_DEV_CONFIG', 'invalid json data')

        // Should recover with default configuration
        const recoveredConfig = await getDevModeConfig()
        expect(recoveredConfig).toMatchObject({
          enabled: expect.any(Boolean),
          verboseLogging: expect.any(Boolean),
          storageAdapterTesting: expect.any(Boolean),
          performanceMonitoring: expect.any(Boolean),
          stateValidation: expect.any(Boolean),
          lastUpdated: expect.any(String),
        })

        // Should have fixed the corrupted data
        const configAfterRecovery = localStorage.getItem('APP_CLIENT_DEV_CONFIG')
        expect(() => JSON.parse(configAfterRecovery!)).not.toThrow()
      })
    })

    describe('Error Recovery and Resilience', () => {
      it('should handle storage unavailable scenarios', async () => {
        const {getDevModeConfig, setDevModeConfig} = devModeUtils

        // Mock localStorage to be unavailable
        const originalLocalStorage = window.localStorage
        Object.defineProperty(window, 'localStorage', {
          value: {
            getItem: () => {
              throw new Error('Storage unavailable')
            },
            setItem: () => {
              throw new Error('Storage unavailable')
            },
            removeItem: () => {
              throw new Error('Storage unavailable')
            },
            clear: () => {
              throw new Error('Storage unavailable')
            },
          },
          writable: true,
        })

        // Should still work with fallback values
        const config = await getDevModeConfig()
        expect(config).toBeDefined()
        expect(typeof config.enabled).toBe('boolean')

        // Should handle save failures gracefully
        const saveResult = await setDevModeConfig({verboseLogging: true})
        expect(typeof saveResult).toBe('boolean')

        // Restore localStorage
        Object.defineProperty(window, 'localStorage', {
          value: originalLocalStorage,
          writable: true,
        })
      })

      it('should retry operations on transient failures', async () => {
        const {setDevModeConfig} = devModeUtils

        let attempts = 0
        const originalSetItem = localStorage.setItem

        // Mock setItem to fail on first few attempts
        localStorage.setItem = vi.fn((key, value) => {
          attempts++
          if (attempts <= 1) {
            // Fail first attempt
            throw new Error('Transient storage error')
          }
          return originalSetItem.call(localStorage, key, value)
        })

        // Should succeed after retries
        const result = await setDevModeConfig({verboseLogging: true})
        expect(result).toBe(true)
        expect(attempts).toBeGreaterThan(1) // Should have made multiple attempts

        // Restore original method
        localStorage.setItem = originalSetItem
      })
    })
  })
})
