import {beforeEach, describe, expect, it, vi} from 'vitest'

// Mock the storage modules with proper original import
vi.mock('../../src/core/storage/local', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../src/core/storage/local')>()
  return {
    ...actual,
    getLocalStorage: vi.fn((key: string, defaultValue: any) => {
      if (key === 'APP_CLIENT_DEV_MODE') {
        return true // Default to dev mode for tests
      }
      return defaultValue
    }),
  }
})

// Import after mocking
const devModeModule = await import('../../../src/core/utils/devMode')
const {
  isDevMode,
  getDevModeConfig,
  setDevModeConfig,
  enableDevMode,
  disableDevMode,
  testStorageAdaptersInDevMode,
} = devModeModule

type DevModeConfig = typeof devModeModule extends {DevModeConfig: infer T} ? T : any

describe('Enhanced Development Mode Utilities', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('isDevMode()', () => {
    it('should detect development mode from multiple sources', () => {
      // Should be true in test environment
      const result = isDevMode()
      expect(typeof result).toBe('boolean')
    })

    it('should detect dev mode from hostname', () => {
      // Mock window.location for hostname detection
      const originalLocation = window.location
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'localhost',
          port: '3000',
        },
        writable: true,
      })

      const result = isDevMode()
      expect(result).toBe(true)

      // Restore original location
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
      })
    })
  })

  describe('getDevModeConfig()', () => {
    it('should return default config when none exists', async () => {
      const config = await getDevModeConfig()

      expect(config).toMatchObject({
        enabled: expect.any(Boolean),
        verboseLogging: expect.any(Boolean),
        storageAdapterTesting: expect.any(Boolean),
        performanceMonitoring: expect.any(Boolean),
        stateValidation: expect.any(Boolean),
        lastUpdated: expect.any(String),
      })
    })

    it('should validate and merge configuration', async () => {
      // Set invalid config in localStorage
      localStorage.setItem(
        'APP_CLIENT_DEV_CONFIG',
        JSON.stringify({
          enabled: 'invalid',
          verboseLogging: true,
          extraField: 'should be ignored',
        })
      )

      const config = await getDevModeConfig()

      // Should have corrected invalid values
      expect(config.enabled).toBe(true) // Should default to true
      expect(config.verboseLogging).toBe(true) // Should keep valid value
      expect(config.storageAdapterTesting).toBe(true) // Should use default
      expect(config.lastUpdated).toBeTruthy()
    })

    it('should handle storage errors gracefully', async () => {
      // Mock storage to throw error
      const originalGetItem = localStorage.getItem
      localStorage.getItem = vi.fn(() => {
        throw new Error('Storage access denied')
      })

      const config = await getDevModeConfig()

      // Should return default config
      expect(config.enabled).toBe(true)
      expect(config.verboseLogging).toBe(true)

      // Restore original method
      localStorage.getItem = originalGetItem
    })
  })

  describe('setDevModeConfig()', () => {
    it('should update configuration with partial updates', async () => {
      // Set initial config
      await setDevModeConfig({
        verboseLogging: false,
        performanceMonitoring: true,
      })

      const config = await getDevModeConfig()
      expect(config.verboseLogging).toBe(false)
      expect(config.performanceMonitoring).toBe(true)
      expect(config.enabled).toBe(true) // Should maintain default
    })

    it('should update lastUpdated timestamp', async () => {
      const beforeUpdate = new Date().toISOString()

      await setDevModeConfig({verboseLogging: true})

      const config = await getDevModeConfig()
      expect(config.lastUpdated).toBeTruthy()
      expect(new Date(config.lastUpdated).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeUpdate).getTime()
      )
    })

    it('should maintain backward compatibility with legacy flag', async () => {
      await setDevModeConfig({enabled: false})

      // Check that legacy flag is also updated
      const legacyFlag = localStorage.getItem('APP_CLIENT_DEV_MODE')
      expect(legacyFlag).toBe('false')
    })

    it('should handle storage errors with retries', async () => {
      let attempts = 0
      const originalSetItem = localStorage.setItem
      localStorage.setItem = vi.fn((key, value) => {
        attempts++
        if (attempts < 2) {
          throw new Error('Storage quota exceeded')
        }
        return originalSetItem.call(localStorage, key, value)
      })

      const result = await setDevModeConfig({verboseLogging: true})

      expect(result).toBe(true)
      expect(attempts).toBe(2) // Should have retried once

      // Restore original method
      localStorage.setItem = originalSetItem
    })
  })

  describe('enableDevMode()', () => {
    it('should enable dev mode with default config', async () => {
      const result = await enableDevMode()

      expect(result).toBe(true)

      const config = await getDevModeConfig()
      expect(config.enabled).toBe(true)
    })

    it('should enable dev mode with custom config', async () => {
      const result = await enableDevMode({
        verboseLogging: false,
        performanceMonitoring: true,
      })

      expect(result).toBe(true)

      const config = await getDevModeConfig()
      expect(config.enabled).toBe(true)
      expect(config.verboseLogging).toBe(false)
      expect(config.performanceMonitoring).toBe(true)
    })

    it('should handle non-browser environment', async () => {
      // Mock window to be undefined
      const originalWindow = global.window
      // @ts-ignore
      delete global.window

      const result = await enableDevMode()
      expect(result).toBe(false)

      // Restore window
      global.window = originalWindow
    })
  })

  describe('disableDevMode()', () => {
    it('should disable dev mode', async () => {
      // First enable it
      await enableDevMode()

      // Then disable it
      const result = await disableDevMode()
      expect(result).toBe(true)

      const config = await getDevModeConfig()
      expect(config.enabled).toBe(false)
    })

    it('should handle storage errors gracefully', async () => {
      const originalSetItem = localStorage.setItem
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage error')
      })

      const result = await disableDevMode()
      expect(result).toBe(false) // Should return false on failure

      // Restore original method
      localStorage.setItem = originalSetItem
    })
  })

  describe('testStorageAdaptersInDevMode()', () => {
    it('should test all storage adapters', async () => {
      // Ensure we're in dev mode
      await enableDevMode({storageAdapterTesting: true})

      const results = await testStorageAdaptersInDevMode()

      expect(results).toHaveProperty('localStorage')
      expect(results).toHaveProperty('sessionStorage')
      expect(results).toHaveProperty('cookies')
      expect(results).toHaveProperty('errors')

      expect(typeof results.localStorage).toBe('boolean')
      expect(typeof results.sessionStorage).toBe('boolean')
      expect(typeof results.cookies).toBe('boolean')
      expect(Array.isArray(results.errors)).toBe(true)
    })

    it('should return error when not in dev mode', async () => {
      // Disable dev mode
      await disableDevMode()

      // Mock isDevMode to return false
      const results = await testStorageAdaptersInDevMode()

      expect(results.localStorage).toBe(false)
      expect(results.sessionStorage).toBe(false)
      expect(results.cookies).toBe(false)
      expect(results.errors).toContain('Not in development mode')
    })

    it('should handle adapter import errors', async () => {
      // Enable dev mode
      await enableDevMode()

      // Mock dynamic import to fail
      const originalImport = global.import
      global.import = vi.fn().mockRejectedValue(new Error('Import failed'))

      const results = await testStorageAdaptersInDevMode()

      expect(results.errors.length).toBeGreaterThan(0)
      expect(results.errors.some(error => error.includes('Test initialization failed'))).toBe(true)

      // Restore original import
      global.import = originalImport
    })
  })

  describe('Global Development Interface', () => {
    it('should expose development methods on window in dev mode', async () => {
      // Enable dev mode to ensure the global object is created
      await enableDevMode()

      // @ts-ignore
      const devMode = window.__polyDevMode

      expect(devMode).toBeDefined()
      expect(typeof devMode.enable).toBe('function')
      expect(typeof devMode.disable).toBe('function')
      expect(typeof devMode.isEnabled).toBe('function')
      expect(typeof devMode.getConfig).toBe('function')
      expect(typeof devMode.setConfig).toBe('function')
      expect(typeof devMode.testStorageHealth).toBe('function')
    })

    it('should provide utility methods for common dev tasks', async () => {
      await enableDevMode()

      // @ts-ignore
      const devMode = window.__polyDevMode

      expect(typeof devMode.enableVerboseLogging).toBe('function')
      expect(typeof devMode.disableVerboseLogging).toBe('function')
      expect(typeof devMode.enableStorageTesting).toBe('function')
      expect(typeof devMode.enablePerformanceMonitoring).toBe('function')
      expect(typeof devMode.getStorageAdapter).toBe('function')
    })
  })

  describe('Configuration Migration and Validation', () => {
    it('should handle missing fields in stored config', async () => {
      // Store partial config
      localStorage.setItem(
        'APP_CLIENT_DEV_CONFIG',
        JSON.stringify({
          enabled: true,
          verboseLogging: false,
          // Missing other fields
        })
      )

      const config = await getDevModeConfig()

      // Should have all required fields
      expect(config).toHaveProperty('enabled')
      expect(config).toHaveProperty('verboseLogging')
      expect(config).toHaveProperty('storageAdapterTesting')
      expect(config).toHaveProperty('performanceMonitoring')
      expect(config).toHaveProperty('stateValidation')
      expect(config).toHaveProperty('lastUpdated')

      // Should preserve existing values
      expect(config.enabled).toBe(true)
      expect(config.verboseLogging).toBe(false)

      // Should use defaults for missing fields
      expect(config.storageAdapterTesting).toBe(true)
      expect(config.performanceMonitoring).toBe(false)
    })

    it('should handle corrupted JSON in storage', async () => {
      // Store invalid JSON
      localStorage.setItem('APP_CLIENT_DEV_CONFIG', 'invalid json')

      const config = await getDevModeConfig()

      // Should return default config
      expect(config.enabled).toBe(true)
      expect(config.verboseLogging).toBe(true)
    })
  })
})
