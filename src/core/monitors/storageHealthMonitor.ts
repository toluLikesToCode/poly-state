import {
  LocalStorageAdapter,
  SessionStorageAdapter,
  CookieStorageAdapter,
  type StorageAdapter,
} from '../storage/adapters'
import {withErrorRecovery} from '../../shared/errors'
import {isDevMode} from '../utils/devMode'

/**
 * Storage health report interface
 */
export interface StorageHealthReport {
  timestamp: number
  adapters: {
    localStorage: {
      available: boolean
      canRead: boolean
      canWrite: boolean
      latency: number
      error?: string
    }
    sessionStorage: {
      available: boolean
      canRead: boolean
      canWrite: boolean
      latency: number
      error?: string
    }
    cookies: {
      available: boolean
      canRead: boolean
      canWrite: boolean
      latency: number
      error?: string
    }
  }
  overall: {
    healthy: boolean
    preferredAdapter: 'localStorage' | 'sessionStorage' | 'cookies' | 'none'
    warnings: string[]
  }
}

/**
 * Storage health monitor using unified storage adapters
 *
 * This is a new component that demonstrates the unified storage interface
 * without modifying any existing critical code paths.
 *
 * @example
 * ```typescript
 * const monitor = new StorageHealthMonitor()
 *
 * // Run a health check
 * const report = await monitor.checkHealth()
 * console.log('Storage health:', report.overall.healthy)
 * console.log('Preferred adapter:', report.overall.preferredAdapter)
 *
 * // Start continuous monitoring
 * monitor.startMonitoring(30000) // Check every 30 seconds
 *
 * // Get recommended adapter
 * const adapter = monitor.getRecommendedAdapter()
 * if (adapter) {
 *   await adapter.set('test-key', 'test-value')
 * }
 * ```
 */
export class StorageHealthMonitor {
  private adapters: {
    localStorage: LocalStorageAdapter
    sessionStorage: SessionStorageAdapter
    cookies: CookieStorageAdapter
  }

  private lastReport: StorageHealthReport | null = null
  private monitoringInterval: number | null = null

  constructor() {
    this.adapters = {
      localStorage: new LocalStorageAdapter(),
      sessionStorage: new SessionStorageAdapter(),
      cookies: new CookieStorageAdapter({
        expires: 1,
        path: '/',
        sameSite: 'Lax',
      }),
    }
  }

  /**
   * Test a specific storage adapter
   * @private
   */
  private async testAdapter(
    name: string,
    adapter: StorageAdapter
  ): Promise<StorageHealthReport['adapters']['localStorage']> {
    const testKey = `__health_test_${name}_${Date.now()}`
    const testValue = {test: true, timestamp: Date.now()}

    return withErrorRecovery(
      async () => {
        const startTime = performance.now()

        // Test availability
        const available = adapter.isAvailable()
        if (!available) {
          return {
            available: false,
            canRead: false,
            canWrite: false,
            latency: 0,
            error: 'Adapter reports as unavailable',
          }
        }

        // Test write
        const writeSuccess = await adapter.set(testKey, testValue)
        if (!writeSuccess) {
          return {
            available: true,
            canRead: false,
            canWrite: false,
            latency: performance.now() - startTime,
            error: 'Write operation failed',
          }
        }

        // Test read
        const readValue = await adapter.get(testKey)
        const canRead =
          readValue !== null && typeof readValue === 'object' && readValue.test === true

        if (!canRead) {
          // Try to cleanup even if read failed
          try {
            await adapter.remove(testKey)
          } catch {}
          return {
            available: true,
            canRead: false,
            canWrite: true,
            latency: performance.now() - startTime,
            error: 'Read operation failed or data corrupted',
          }
        }

        // Cleanup
        await adapter.remove(testKey)

        return {
          available: true,
          canRead: true,
          canWrite: true,
          latency: performance.now() - startTime,
          error: undefined,
        }
      },
      {
        maxRetries: 1,
        retryDelay: 50,
        fallbackValue: {
          available: false,
          canRead: false,
          canWrite: false,
          latency: 0,
          error: 'Health test failed with error recovery',
        },
      }
    )
  }

  /**
   * Run a complete storage health check
   */
  async checkHealth(): Promise<StorageHealthReport> {
    const timestamp = Date.now()

    // Test all adapters in parallel
    const [localStorageResult, sessionStorageResult, cookiesResult] = await Promise.all([
      this.testAdapter('localStorage', this.adapters.localStorage),
      this.testAdapter('sessionStorage', this.adapters.sessionStorage),
      this.testAdapter('cookies', this.adapters.cookies),
    ])

    // Determine overall health and preferred adapter
    const adapters = {
      localStorage: localStorageResult,
      sessionStorage: sessionStorageResult,
      cookies: cookiesResult,
    }

    const warnings: string[] = []
    let preferredAdapter: StorageHealthReport['overall']['preferredAdapter'] = 'none'

    // Prefer localStorage if available and working
    if (
      adapters.localStorage.available &&
      adapters.localStorage.canRead &&
      adapters.localStorage.canWrite
    ) {
      preferredAdapter = 'localStorage'
    } else if (
      adapters.sessionStorage.available &&
      adapters.sessionStorage.canRead &&
      adapters.sessionStorage.canWrite
    ) {
      preferredAdapter = 'sessionStorage'
      warnings.push('localStorage unavailable, falling back to sessionStorage')
    } else if (
      adapters.cookies.available &&
      adapters.cookies.canRead &&
      adapters.cookies.canWrite
    ) {
      preferredAdapter = 'cookies'
      warnings.push('Browser storage unavailable, falling back to cookies')
    } else {
      warnings.push('No storage adapters available - application will run in memory-only mode')
    }

    // Add performance warnings
    Object.entries(adapters).forEach(([name, result]) => {
      if (result.available && result.latency > 100) {
        warnings.push(`${name} showing high latency (${result.latency.toFixed(1)}ms)`)
      }
    })

    const report: StorageHealthReport = {
      timestamp,
      adapters,
      overall: {
        healthy: preferredAdapter !== 'none',
        preferredAdapter,
        warnings,
      },
    }

    this.lastReport = report

    if (isDevMode()) {
      console.log('[StorageHealthMonitor] Health check completed:', report)
    }

    return report
  }

  /**
   * Get the last health report without running a new check
   */
  getLastReport(): StorageHealthReport | null {
    return this.lastReport
  }

  /**
   * Start continuous monitoring
   * @param intervalMs - Monitoring interval in milliseconds (default: 30000 = 30s)
   */
  startMonitoring(intervalMs = 30000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring()
    }

    // Run initial check
    this.checkHealth().catch(error => {
      console.warn('[StorageHealthMonitor] Initial health check failed:', error)
    })

    // Set up interval
    this.monitoringInterval = window.setInterval(() => {
      this.checkHealth().catch(error => {
        console.warn('[StorageHealthMonitor] Periodic health check failed:', error)
      })
    }, intervalMs)

    if (isDevMode()) {
      console.log(`[StorageHealthMonitor] Started monitoring with ${intervalMs}ms interval`)
    }
  }

  /**
   * Stop continuous monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null

      if (isDevMode()) {
        console.log('[StorageHealthMonitor] Stopped monitoring')
      }
    }
  }

  /**
   * Get recommended storage adapter based on health check
   */
  getRecommendedAdapter(): StorageAdapter | null {
    if (!this.lastReport) {
      return null
    }

    switch (this.lastReport.overall.preferredAdapter) {
      case 'localStorage':
        return this.adapters.localStorage
      case 'sessionStorage':
        return this.adapters.sessionStorage
      case 'cookies':
        return this.adapters.cookies
      default:
        return null
    }
  }

  /**
   * Force a storage adapter preference (useful for testing or specific requirements)
   * @param adapterType - The adapter type to prefer
   */
  async forceAdapterPreference(
    adapterType: 'localStorage' | 'sessionStorage' | 'cookies'
  ): Promise<StorageAdapter | null> {
    const adapter = this.adapters[adapterType]

    // Test the specific adapter
    const result = await this.testAdapter(adapterType, adapter)

    if (result.available && result.canRead && result.canWrite) {
      if (isDevMode()) {
        console.log(`[StorageHealthMonitor] Forced preference to ${adapterType}`)
      }
      return adapter
    } else {
      if (isDevMode()) {
        console.warn(
          `[StorageHealthMonitor] Cannot force ${adapterType} - adapter not working:`,
          result.error
        )
      }
      return null
    }
  }

  /**
   * Get detailed adapter information for debugging
   */
  getAdapterDetails(): {
    localStorage: {adapter: LocalStorageAdapter; info: string}
    sessionStorage: {adapter: SessionStorageAdapter; info: string}
    cookies: {adapter: CookieStorageAdapter; info: string}
  } {
    return {
      localStorage: {
        adapter: this.adapters.localStorage,
        info: `Available: ${this.adapters.localStorage.isAvailable()}, Type: LocalStorage`,
      },
      sessionStorage: {
        adapter: this.adapters.sessionStorage,
        info: `Available: ${this.adapters.sessionStorage.isAvailable()}, Type: SessionStorage`,
      },
      cookies: {
        adapter: this.adapters.cookies,
        info: `Available: ${this.adapters.cookies.isAvailable()}, Type: Cookies`,
      },
    }
  }
}

// Export a singleton instance for convenience
export const storageHealthMonitor = new StorageHealthMonitor()

// Auto-start monitoring in development mode
if (isDevMode() && typeof window !== 'undefined') {
  // Start monitoring after a short delay to avoid blocking initialization
  setTimeout(() => {
    storageHealthMonitor.startMonitoring(60000) // Check every minute in dev mode
  }, 2000)
}
