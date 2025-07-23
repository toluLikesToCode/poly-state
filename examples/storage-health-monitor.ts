/**
 * Storage Health Monitor Usage Examples
 *
 * This file demonstrates how to use the new Storage Health Monitor
 * component that showcases the unified storage interface.
 */

import {
  StorageHealthMonitor,
  storageHealthMonitor,
  type StorageHealthReport,
} from '@tolulikestocode/poly-state'

/**
 * Example 1: Basic Health Check
 */
export async function basicHealthCheck() {
  console.log('=== Basic Health Check ===')

  const monitor = new StorageHealthMonitor()
  const report = await monitor.checkHealth()

  console.log('Overall Health:', report.overall.healthy)
  console.log('Preferred Adapter:', report.overall.preferredAdapter)
  console.log('Warnings:', report.overall.warnings)

  // Check specific adapters
  console.log('localStorage:', {
    available: report.adapters.localStorage.available,
    working: report.adapters.localStorage.canRead && report.adapters.localStorage.canWrite,
    latency: `${report.adapters.localStorage.latency.toFixed(2)}ms`,
  })

  console.log('sessionStorage:', {
    available: report.adapters.sessionStorage.available,
    working: report.adapters.sessionStorage.canRead && report.adapters.sessionStorage.canWrite,
    latency: `${report.adapters.sessionStorage.latency.toFixed(2)}ms`,
  })

  console.log('cookies:', {
    available: report.adapters.cookies.available,
    working: report.adapters.cookies.canRead && report.adapters.cookies.canWrite,
    latency: `${report.adapters.cookies.latency.toFixed(2)}ms`,
  })
}

/**
 * Example 2: Using Recommended Adapter
 */
export async function useRecommendedAdapter() {
  console.log('=== Using Recommended Adapter ===')

  const monitor = new StorageHealthMonitor()
  await monitor.checkHealth()

  const adapter = monitor.getRecommendedAdapter()
  if (adapter) {
    console.log('Using recommended adapter for storage operations...')

    // Store some data
    const testData = {
      user: 'john_doe',
      preferences: {
        theme: 'dark',
        language: 'en',
      },
      timestamp: new Date().toISOString(),
    }

    const success = await adapter.set('user-data', testData)
    console.log('Data stored successfully:', success)

    // Retrieve the data
    const retrieved = await adapter.get('user-data')
    console.log('Retrieved data:', retrieved)

    // Clean up
    await adapter.remove('user-data')
    console.log('Data cleaned up')
  } else {
    console.warn('No storage adapter available!')
  }
}

/**
 * Example 3: Continuous Monitoring
 */
export async function continuousMonitoring() {
  console.log('=== Continuous Monitoring ===')

  let checkCount = 0
  const monitor = new StorageHealthMonitor()

  // Custom monitoring setup
  const startTime = Date.now()
  const monitoringDuration = 5000 // 5 seconds

  console.log('Starting continuous monitoring for 5 seconds...')

  monitor.startMonitoring(1000) // Check every second

  // Monitor for changes
  const checkInterval = setInterval(() => {
    const report = monitor.getLastReport()
    if (report) {
      checkCount++
      console.log(
        `Check ${checkCount}: Health=${report.overall.healthy}, Preferred=${report.overall.preferredAdapter}`
      )
    }

    if (Date.now() - startTime > monitoringDuration) {
      monitor.stopMonitoring()
      clearInterval(checkInterval)
      console.log('Monitoring stopped')
    }
  }, 1100)
}

/**
 * Example 4: Force Specific Adapter (Testing/Special Requirements)
 */
export async function forceSpecificAdapter() {
  console.log('=== Force Specific Adapter ===')

  const monitor = new StorageHealthMonitor()

  // Force use of sessionStorage (for example, privacy requirements)
  const sessionAdapter = await monitor.forceAdapterPreference('sessionStorage')

  if (sessionAdapter) {
    console.log('Successfully forced sessionStorage adapter')

    // Use it for sensitive data that shouldn't persist across browser sessions
    await sessionAdapter.set('session-data', {
      temporaryToken: 'abc123',
      timestamp: Date.now(),
    })

    const data = await sessionAdapter.get('session-data')
    console.log('Session data stored and retrieved:', data)

    // Verify it's using sessionStorage
    console.log('Data is in sessionStorage:', sessionStorage.getItem('session-data') !== null)
    console.log('Data is NOT in localStorage:', localStorage.getItem('session-data') === null)

    await sessionAdapter.remove('session-data')
  } else {
    console.warn('Could not force sessionStorage adapter')
  }
}

/**
 * Example 5: Using the Singleton Instance
 */
export async function usingSingleton() {
  console.log('=== Using Singleton Instance ===')

  // The singleton instance automatically starts monitoring in dev mode
  console.log('Singleton health monitoring is active')

  const report = await storageHealthMonitor.checkHealth()
  console.log('Singleton health check:', report.overall.healthy)

  // Get adapter details for debugging
  const details = storageHealthMonitor.getAdapterDetails()
  console.log('Adapter details:')
  console.log('- localStorage:', details.localStorage.info)
  console.log('- sessionStorage:', details.sessionStorage.info)
  console.log('- cookies:', details.cookies.info)
}

/**
 * Example 6: Error Handling and Fallbacks
 */
export async function errorHandlingExample() {
  console.log('=== Error Handling Example ===')

  const monitor = new StorageHealthMonitor()
  const report = await monitor.checkHealth()

  // Check for issues and handle them
  if (!report.overall.healthy) {
    console.warn('Storage is unhealthy!')

    // Check each adapter individually
    const issues: string[] = []

    if (!report.adapters.localStorage.available) {
      issues.push('localStorage unavailable')
    } else if (!report.adapters.localStorage.canWrite) {
      issues.push('localStorage read-only (quota exceeded?)')
    }

    if (!report.adapters.sessionStorage.available) {
      issues.push('sessionStorage unavailable')
    }

    if (!report.adapters.cookies.available) {
      issues.push('cookies unavailable')
    }

    console.log('Storage issues detected:', issues)

    // Fallback strategy
    if (report.overall.preferredAdapter === 'none') {
      console.log('Falling back to in-memory storage (data will be lost on page reload)')
      // Implement in-memory fallback here
    } else {
      console.log(`Using fallback adapter: ${report.overall.preferredAdapter}`)
    }
  } else {
    console.log('All storage systems are healthy!')
  }

  // Performance warnings
  if (report.overall.warnings.length > 0) {
    console.warn('Storage warnings:', report.overall.warnings)
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('🚀 Storage Health Monitor Examples\n')

  try {
    await basicHealthCheck()
    console.log('\n' + '='.repeat(50) + '\n')

    await useRecommendedAdapter()
    console.log('\n' + '='.repeat(50) + '\n')

    await continuousMonitoring()
    console.log('\n' + '='.repeat(50) + '\n')

    await forceSpecificAdapter()
    console.log('\n' + '='.repeat(50) + '\n')

    await usingSingleton()
    console.log('\n' + '='.repeat(50) + '\n')

    await errorHandlingExample()
  } catch (error) {
    console.error('Example failed:', error)
  }
}

// Auto-run examples in development mode
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Add global function for easy testing
  // @ts-ignore
  window.runStorageHealthExamples = runAllExamples

  console.log('💡 Storage Health Monitor examples loaded!')
  console.log('Run window.runStorageHealthExamples() in the console to see them in action.')
}
