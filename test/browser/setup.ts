import {beforeEach, afterEach} from 'vitest'

/**
 * Browser test setup - runs in real browser environment
 * No mocking of storage APIs here - we want to test real browser behavior
 */

// Global cleanup before each test
beforeEach(() => {
  // Clear real browser storage
  if (typeof localStorage !== 'undefined') {
    localStorage.clear()
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear()
  }

  // Clear cookies
  if (typeof document !== 'undefined') {
    document.cookie.split(';').forEach(cookie => {
      const eqPos = cookie.indexOf('=')
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
    })
  }
})

// Cleanup after each test
afterEach(() => {
  // Additional cleanup if needed
})
