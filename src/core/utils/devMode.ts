import {getLocalStorage} from '../storage/local'
import {LocalStorageAdapter} from '../storage/adapters'
import {withErrorRecovery} from '../../shared/errors'

// Create a dedicated storage adapter for development mode utilities
const devModeStorage = new LocalStorageAdapter()

/**
 * Development mode configuration interface
 */
export interface DevModeConfig {
  /** Enable development mode */
  enabled: boolean
  /** Enable verbose logging */
  verboseLogging: boolean
  /** Enable storage adapter testing */
  storageAdapterTesting: boolean
  /** Enable performance monitoring */
  performanceMonitoring: boolean
  /** Enable state validation */
  stateValidation: boolean
  /** Last updated timestamp */
  lastUpdated: string
}

/**
 * Default development mode configuration
 */
const DEFAULT_DEV_CONFIG: DevModeConfig = {
  enabled: true,
  verboseLogging: true,
  storageAdapterTesting: true,
  performanceMonitoring: false,
  stateValidation: true,
  lastUpdated: new Date().toISOString(),
}

/**
 * Checks if the application is running in development mode
 * Enhanced with unified storage adapter and multiple detection methods
 */
export function isDevMode(): boolean {
  // Check multiple indicators for development mode
  return (
    process.env.NODE_ENV === 'development' ||
    getDevModeFromStorage() ||
    // @ts-ignore - Check for Vite dev mode
    import.meta?.env?.DEV === true ||
    // Check for common dev server indicators
    (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('dev') ||
        window.location.port !== ''))
  )
}

/**
 * Get dev mode setting from storage with fallback to legacy approach
 * @private
 */
function getDevModeFromStorage(): boolean {
  try {
    // Use legacy approach for backward compatibility in synchronous context
    return getLocalStorage('APP_CLIENT_DEV_MODE', false)
  } catch (error) {
    // Fail silently for dev mode detection
    return false
  }
}

/**
 * Load development mode configuration with unified storage and error recovery
 *
 * @returns Promise resolving to development configuration
 */
export async function getDevModeConfig(): Promise<DevModeConfig> {
  return withErrorRecovery(
    async () => {
      if (!devModeStorage.isAvailable()) {
        console.warn('[DevMode] Storage unavailable, using defaults')
        return DEFAULT_DEV_CONFIG
      }

      // Use direct localStorage with error throwing for error recovery
      const configString = localStorage.getItem('APP_CLIENT_DEV_CONFIG')

      if (configString === null) {
        // No config found, create default
        const defaultConfig = {...DEFAULT_DEV_CONFIG}
        localStorage.setItem('APP_CLIENT_DEV_CONFIG', JSON.stringify(defaultConfig))
        return defaultConfig
      }

      let config: any
      try {
        config = JSON.parse(configString)
      } catch (parseError) {
        // JSON is corrupted, reset to defaults and throw error for retry mechanism
        console.warn('[DevMode] Corrupted configuration detected, resetting to defaults')
        const defaultConfig = {...DEFAULT_DEV_CONFIG}
        localStorage.setItem('APP_CLIENT_DEV_CONFIG', JSON.stringify(defaultConfig))
        return defaultConfig
      }

      // Validate and merge with defaults to handle version migration
      const validatedConfig: DevModeConfig = {
        enabled: typeof config.enabled === 'boolean' ? config.enabled : DEFAULT_DEV_CONFIG.enabled,
        verboseLogging:
          typeof config.verboseLogging === 'boolean'
            ? config.verboseLogging
            : DEFAULT_DEV_CONFIG.verboseLogging,
        storageAdapterTesting:
          typeof config.storageAdapterTesting === 'boolean'
            ? config.storageAdapterTesting
            : DEFAULT_DEV_CONFIG.storageAdapterTesting,
        performanceMonitoring:
          typeof config.performanceMonitoring === 'boolean'
            ? config.performanceMonitoring
            : DEFAULT_DEV_CONFIG.performanceMonitoring,
        stateValidation:
          typeof config.stateValidation === 'boolean'
            ? config.stateValidation
            : DEFAULT_DEV_CONFIG.stateValidation,
        lastUpdated:
          typeof config.lastUpdated === 'string' ? config.lastUpdated : new Date().toISOString(),
      }

      return validatedConfig
    },
    {
      maxRetries: 1,
      retryDelay: 30,
      fallbackValue: DEFAULT_DEV_CONFIG,
      onRetry: (attempt, error) => {
        console.warn(`[DevMode] Config load retry ${attempt}:`, error.message)
      },
    }
  )
}

/**
 * Save development mode configuration with unified storage and error recovery
 *
 * @param config - Partial configuration to update
 * @returns Promise resolving to save success status
 */
export async function setDevModeConfig(config: Partial<DevModeConfig>): Promise<boolean> {
  return withErrorRecovery(
    async () => {
      const currentConfig = await getDevModeConfig()
      const updatedConfig: DevModeConfig = {
        ...currentConfig,
        ...config,
        lastUpdated: new Date().toISOString(),
      }

      // Use direct localStorage with error throwing for error recovery
      try {
        localStorage.setItem('APP_CLIENT_DEV_CONFIG', JSON.stringify(updatedConfig))

        // Also update the legacy dev mode flag for backward compatibility
        localStorage.setItem('APP_CLIENT_DEV_MODE', String(updatedConfig.enabled))

        if (updatedConfig.verboseLogging) {
          console.log('[DevMode] Configuration updated:', updatedConfig)
        }

        return true
      } catch (error) {
        // Throw the error so withErrorRecovery can handle retries
        throw error
      }
    },
    {
      maxRetries: 1,
      retryDelay: 15,
      fallbackValue: false,
      onRetry: (attempt, error) => {
        console.warn(`[DevMode] Config save retry ${attempt}:`, error.message)
      },
    }
  )
}

/**
 * Enable development mode with enhanced configuration
 * Enhanced with unified storage and error recovery
 *
 * @param config - Optional configuration overrides
 * @returns Promise resolving to enable success status
 */
export async function enableDevMode(config: Partial<DevModeConfig> = {}): Promise<boolean> {
  if (typeof window === 'undefined') {
    console.warn('[DevMode] Cannot enable dev mode in non-browser environment')
    return false
  }

  const success = await setDevModeConfig({
    enabled: true,
    ...config,
  })

  if (success) {
    const currentConfig = await getDevModeConfig()
    console.log('[Poly State] Development mode enabled with unified storage')

    // Run storage adapter tests if enabled
    if (currentConfig.storageAdapterTesting) {
      await testStorageAdaptersInDevMode()
    }

    // Initialize performance monitoring if enabled
    if (currentConfig.performanceMonitoring) {
      await initializePerformanceMonitoring()
    }
  }

  return success
}

/**
 * Disable development mode with cleanup
 * Enhanced with unified storage and error recovery
 *
 * @returns Promise resolving to disable success status
 */
export async function disableDevMode(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false
  }

  return withErrorRecovery(
    async () => {
      // Update config to disable dev mode
      const success = await setDevModeConfig({enabled: false})

      if (success) {
        console.log('[Poly State] Development mode disabled')

        // Clean up any dev-only resources
        await cleanupDevModeResources()
      }

      return success
    },
    {
      maxRetries: 2,
      retryDelay: 100,
      fallbackValue: false,
    }
  )
}

/**
 * Test storage adapter health in development mode
 * Demonstrates unified storage adapter usage
 *
 * @returns Promise resolving to storage health report
 */
export async function testStorageAdaptersInDevMode(): Promise<{
  localStorage: boolean
  sessionStorage: boolean
  cookies: boolean
  errors: string[]
}> {
  if (!isDevMode()) {
    return {
      localStorage: false,
      sessionStorage: false,
      cookies: false,
      errors: ['Not in development mode'],
    }
  }

  const errors: string[] = []
  const results = {localStorage: false, sessionStorage: false, cookies: false, errors}

  try {
    // Import adapters dynamically to avoid unnecessary loading in production
    const {LocalStorageAdapter, SessionStorageAdapter, CookieStorageAdapter} = await import(
      '../storage/adapters'
    )

    // Test each adapter
    const adapters = [
      {name: 'localStorage', adapter: new LocalStorageAdapter()},
      {name: 'sessionStorage', adapter: new SessionStorageAdapter()},
      {name: 'cookies', adapter: new CookieStorageAdapter({expires: 1, path: '/'})},
    ]

    const testResults = await Promise.allSettled(
      adapters.map(async ({name, adapter}) => {
        const testKey = `__dev_test_${name}_${Date.now()}`
        const testData = {test: true, timestamp: Date.now()}

        return withErrorRecovery(
          async () => {
            if (!adapter.isAvailable()) {
              throw new Error(`${name} adapter not available`)
            }

            await adapter.set(testKey, testData)
            const retrieved = await adapter.get(testKey)
            await adapter.remove(testKey)

            if (!retrieved || retrieved.test !== true) {
              throw new Error(`${name} data integrity test failed`)
            }

            return true
          },
          {
            maxRetries: 1,
            retryDelay: 50,
            fallbackValue: false,
          }
        )
      })
    )

    // Process results
    testResults.forEach((result, index) => {
      const adapterName = adapters[index].name
      if (result.status === 'fulfilled') {
        if (adapterName === 'localStorage') results.localStorage = result.value
        else if (adapterName === 'sessionStorage') results.sessionStorage = result.value
        else if (adapterName === 'cookies') results.cookies = result.value
      } else {
        if (adapterName === 'localStorage') results.localStorage = false
        else if (adapterName === 'sessionStorage') results.sessionStorage = false
        else if (adapterName === 'cookies') results.cookies = false
        errors.push(`${adapterName}: ${result.reason}`)
      }
    })

    const config = await getDevModeConfig()
    if (config.verboseLogging) {
      console.log('[DevMode] Storage adapter test results:', results)
    }
  } catch (error) {
    errors.push(`Test initialization failed: ${error}`)
  }

  return results
}

/**
 * Initialize performance monitoring for development mode
 * @private
 */
async function initializePerformanceMonitoring(): Promise<void> {
  try {
    // Import storage health monitor dynamically
    const {storageHealthMonitor} = await import('../monitors/storageHealthMonitor')

    // Start monitoring with shorter interval for development
    storageHealthMonitor.startMonitoring(30000) // 30 seconds

    console.log('[DevMode] Performance monitoring initialized')
  } catch (error) {
    console.warn('[DevMode] Failed to initialize performance monitoring:', error)
  }
}

/**
 * Clean up development mode resources
 * @private
 */
async function cleanupDevModeResources(): Promise<void> {
  try {
    // Stop storage health monitoring
    const {storageHealthMonitor} = await import('../monitors/storageHealthMonitor')
    storageHealthMonitor.stopMonitoring()

    // Clean up test data
    const testKeys = ['__dev_test_localStorage', '__dev_test_sessionStorage', '__dev_test_cookies']
    for (const key of testKeys) {
      try {
        if (devModeStorage.isAvailable()) {
          await devModeStorage.remove(key)
        }
      } catch {
        // Ignore cleanup errors
      }
    }

    console.log('[DevMode] Development resources cleaned up')
  } catch (error) {
    console.warn('[DevMode] Cleanup failed:', error)
  }
}

// Add enhanced global methods for easy testing in development
if (typeof window !== 'undefined' && isDevMode()) {
  // @ts-ignore
  window.__polyDevMode = {
    // Legacy methods for backward compatibility
    enable: enableDevMode,
    disable: disableDevMode,
    isEnabled: isDevMode,

    // New enhanced methods
    getConfig: getDevModeConfig,
    setConfig: setDevModeConfig,
    testStorageHealth: testStorageAdaptersInDevMode,

    // Utility methods for development
    enableVerboseLogging: () => setDevModeConfig({verboseLogging: true}),
    disableVerboseLogging: () => setDevModeConfig({verboseLogging: false}),
    enableStorageTesting: () => setDevModeConfig({storageAdapterTesting: true}),
    enablePerformanceMonitoring: () => setDevModeConfig({performanceMonitoring: true}),

    // Storage adapter instance for manual testing
    getStorageAdapter: () => devModeStorage,
  }
}
