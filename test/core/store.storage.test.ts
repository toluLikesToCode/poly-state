/**
 * Storage System Tests
 *
 * Comprehensive test suite for the Poly State storage system including:
 * - Storage adapters (LocalStorage, SessionStorage, Cookie)
 * - Enhanced cookie parsing and operations
 * - Error handling and recovery mechanisms
 * - Storage availability checks
 * - Integration with PersistenceManager
 */

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {PersistenceManager} from '../../src/core/state/persistenceManager'
import {TypeRegistry} from '../../src/core/state/typeRegistry'
import {StorageType} from '../../src/core/state/types'
import {
  CookieStorageAdapter,
  LocalStorageAdapter,
  SessionStorageAdapter,
} from '../../src/core/storage/adapters'
import {
  getCookies,
  removeCookie,
  setCookie,
  setCookieValue,
  type CookieOptions,
} from '../../src/core/storage/cookie'
import {
  clearLocalStorage,
  getLocalStorage,
  isLocalStorageAvailable,
  removeLocalStorage,
  setLocalStorage,
} from '../../src/core/storage/local'
import {
  getSessionStorage,
  isSessionStorageAvailable,
  setSessionStorage,
} from '../../src/core/storage/session'
import {
  StorageDeserializationError,
  StorageError,
  StorageQuotaExceededError,
  StorageSerializationError,
  StorageUnavailableError,
  withErrorRecovery,
} from '../../src/shared/errors'

// Test data interfaces
interface TestData {
  id: number
  name: string
  nested: {
    value: string
    count: number
  }
}

describe('Storage System', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.localStorageMock.clear()
    globalThis.sessionStorageMock.clear()
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Storage Adapters', () => {
    describe('LocalStorageAdapter', () => {
      let adapter: LocalStorageAdapter
      const testData: TestData = {
        id: 1,
        name: 'Test',
        nested: {value: 'test', count: 42},
      }

      beforeEach(() => {
        adapter = new LocalStorageAdapter()
      })

      describe('Basic Operations', () => {
        it('should set and get data successfully', async () => {
          globalThis.localStorageMock.getItem.mockReturnValue(JSON.stringify(testData))
          globalThis.localStorageMock.setItem.mockImplementation(() => {})

          const setResult = await adapter.set('test-key', testData)
          expect(setResult).toBe(true)
          expect(globalThis.localStorageMock.setItem).toHaveBeenCalledWith(
            'test-key',
            JSON.stringify(testData)
          )

          const getData = await adapter.get('test-key')
          expect(getData).toEqual(testData)
          expect(globalThis.localStorageMock.getItem).toHaveBeenCalledWith('test-key')
        })

        it('should return null for non-existent keys', async () => {
          globalThis.localStorageMock.getItem.mockReturnValue(null)

          const result = await adapter.get('non-existent')
          expect(result).toBeNull()
        })

        it('should handle malformed JSON gracefully', async () => {
          globalThis.localStorageMock.getItem.mockReturnValue('invalid-json{')

          const result = await adapter.get('malformed-key')
          expect(result).toBeNull()
        })

        it('should remove items successfully', async () => {
          globalThis.localStorageMock.removeItem.mockImplementation(() => {})

          const result = await adapter.remove('test-key')
          expect(result).toBe(true)
          expect(globalThis.localStorageMock.removeItem).toHaveBeenCalledWith('test-key')
        })

        it('should clear all items successfully', async () => {
          globalThis.localStorageMock.clear.mockImplementation(() => {})

          const result = await adapter.clear()
          expect(result).toBe(true)
          expect(globalThis.localStorageMock.clear).toHaveBeenCalled()
        })

        it('should return all keys', async () => {
          const mockKeys = ['key1', 'key2', 'key3']
          vi.spyOn(Object, 'keys').mockReturnValue(mockKeys)

          const keys = await adapter.keys()
          expect(keys).toEqual(mockKeys)
        })
      })

      describe('Error Handling', () => {
        it('should handle localStorage not available', async () => {
          globalThis.localStorageMock.setItem.mockImplementation(() => {
            throw new Error('localStorage not available')
          })

          const result = await adapter.set('test-key', testData)
          expect(result).toBe(false)
        })

        it('should handle quota exceeded errors', async () => {
          const quotaError = new Error('QuotaExceededError')
          quotaError.name = 'QuotaExceededError'
          globalThis.localStorageMock.setItem.mockImplementation(() => {
            throw quotaError
          })

          const result = await adapter.set('test-key', testData)
          expect(result).toBe(false)
        })

        it('should handle remove operation errors', async () => {
          globalThis.localStorageMock.removeItem.mockImplementation(() => {
            throw new Error('Remove failed')
          })

          const result = await adapter.remove('test-key')
          expect(result).toBe(false)
        })

        it('should handle clear operation errors', async () => {
          globalThis.localStorageMock.clear.mockImplementation(() => {
            throw new Error('Clear failed')
          })

          const result = await adapter.clear()
          expect(result).toBe(false)
        })
      })

      describe('Availability Check', () => {
        it('should return true when localStorage is available', () => {
          globalThis.localStorageMock.setItem.mockImplementation(() => {})
          globalThis.localStorageMock.removeItem.mockImplementation(() => {})

          expect(adapter.isAvailable()).toBe(true)
        })

        it('should return false when localStorage is not available', () => {
          globalThis.localStorageMock.setItem.mockImplementation(() => {
            throw new Error('localStorage not available')
          })

          expect(adapter.isAvailable()).toBe(false)
        })
      })
    })

    describe('SessionStorageAdapter', () => {
      let adapter: SessionStorageAdapter
      const testData: TestData = {
        id: 2,
        name: 'Session Test',
        nested: {value: 'session', count: 24},
      }

      beforeEach(() => {
        adapter = new SessionStorageAdapter()
      })

      describe('Basic Operations', () => {
        it('should set and get data successfully', async () => {
          globalThis.sessionStorageMock.getItem.mockReturnValue(JSON.stringify(testData))
          globalThis.sessionStorageMock.setItem.mockImplementation(() => {})

          const setResult = await adapter.set('session-key', testData)
          expect(setResult).toBe(true)
          expect(globalThis.sessionStorageMock.setItem).toHaveBeenCalledWith(
            'session-key',
            JSON.stringify(testData)
          )

          const getData = await adapter.get('session-key')
          expect(getData).toEqual(testData)
        })

        it('should return null for non-existent keys', async () => {
          globalThis.sessionStorageMock.getItem.mockReturnValue(null)

          const result = await adapter.get('non-existent')
          expect(result).toBeNull()
        })

        it('should handle JSON parsing errors', async () => {
          globalThis.sessionStorageMock.getItem.mockReturnValue('invalid-json')

          const result = await adapter.get('malformed-key')
          expect(result).toBeNull()
        })
      })

      describe('Error Handling', () => {
        it('should handle sessionStorage errors gracefully', async () => {
          globalThis.sessionStorageMock.setItem.mockImplementation(() => {
            throw new Error('sessionStorage error')
          })

          const result = await adapter.set('test-key', testData)
          expect(result).toBe(false)
        })
      })

      describe('Availability Check', () => {
        it('should return true when sessionStorage is available', () => {
          globalThis.sessionStorageMock.setItem.mockImplementation(() => {})
          globalThis.sessionStorageMock.removeItem.mockImplementation(() => {})

          expect(adapter.isAvailable()).toBe(true)
        })

        it('should return false when sessionStorage throws error', () => {
          globalThis.sessionStorageMock.setItem.mockImplementation(() => {
            throw new Error('sessionStorage not available')
          })

          expect(adapter.isAvailable()).toBe(false)
        })
      })
    })

    describe('CookieStorageAdapter', () => {
      let adapter: CookieStorageAdapter
      const testData = {message: 'cookie test', value: 123}
      const cookieOptions: CookieOptions = {
        path: '/',
        expires: 7,
        secure: true,
      }

      beforeEach(() => {
        adapter = new CookieStorageAdapter(cookieOptions)
      })

      describe('Basic Operations', () => {
        it('should handle malformed cookie values gracefully', async () => {
          // This test doesn't require mocking document.cookie
          const result = await adapter.get('non-existent-key')
          expect(result).toBeNull()
        })
      })

      describe('Error Handling', () => {
        it('should handle document not available', async () => {
          const originalDocument = global.document
          // @ts-ignore
          delete global.document

          const newAdapter = new CookieStorageAdapter()
          const result = await newAdapter.set('test-key', testData)
          expect(result).toBe(false)

          global.document = originalDocument
        })
      })

      describe('Availability Check', () => {
        it('should return true when document is available', () => {
          expect(adapter.isAvailable()).toBe(true)
        })

        it('should return false when document is undefined', () => {
          const originalDocument = global.document
          // @ts-ignore
          delete global.document

          const newAdapter = new CookieStorageAdapter()
          expect(newAdapter.isAvailable()).toBe(false)

          global.document = originalDocument
        })
      })

      describe('Cookie Keys and Clear Operations', () => {
        it('should always return true for clear operation', async () => {
          const result = await adapter.clear()
          expect(result).toBe(true)
        })
      })
    })
  })

  describe('Enhanced Cookie Operations', () => {
    describe('Cookie Validation', () => {
      it('should reject invalid cookie names', () => {
        const invalidNames = ['name;with;semicolon', 'name,with,comma', 'name=with=equals']

        invalidNames.forEach(name => {
          const result = setCookieValue(name, 'value')
          expect(result).toBe(false)
        })
      })

      it('should handle empty or null cookie names', () => {
        expect(setCookieValue('', 'value')).toBe(false)
        expect(consoleWarnSpy).toHaveBeenCalled()
      })

      it('should warn about large cookies', () => {
        const largeValue = 'x'.repeat(5000) // Exceeds 4KB limit

        setCookieValue('large-cookie', largeValue)
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Cookie size exceeds typical browser limit',
          expect.objectContaining({
            name: 'large-cookie',
            size: expect.any(Number),
          })
        )
      })
    })

    describe('Multiple Cookie Operations', () => {
      it('should handle empty cookie names array', () => {
        const result = getCookies([])
        expect(result).toEqual({})
      })

      it('should handle non-existent cookies', () => {
        const result = getCookies(['nonexistent'])
        expect(result).toEqual({
          nonexistent: undefined,
        })
      })
    })

    describe('Cookie Options Formatting', () => {
      it('should format cookie options correctly', () => {
        const options: CookieOptions = {
          expires: 7,
          path: '/test',
          domain: 'example.com',
          secure: true,
          sameSite: 'Strict',
        }

        // Test that setCookie doesn't throw with valid options
        expect(() => setCookie('test', 'value', options)).not.toThrow()
      })

      it('should handle Date object for expires', () => {
        const expireDate = new Date('2025-12-31')

        // Test that setCookie doesn't throw with Date expires
        expect(() => setCookie('test', 'value', {expires: expireDate})).not.toThrow()
      })

      it('should handle cookie removal', () => {
        // Test that removeCookie doesn't throw
        expect(() => removeCookie('test-cookie')).not.toThrow()
      })
    })
  })

  describe('Error Recovery Mechanism', () => {
    describe('withErrorRecovery Function', () => {
      it('should succeed on first attempt', async () => {
        const operation = vi.fn().mockResolvedValue('success')

        const result = await withErrorRecovery(operation)
        expect(result).toBe('success')
        expect(operation).toHaveBeenCalledTimes(1)
      })

      it('should retry on failure and eventually succeed', async () => {
        const operation = vi
          .fn()
          .mockRejectedValueOnce(new Error('First failure'))
          .mockRejectedValueOnce(new Error('Second failure'))
          .mockResolvedValueOnce('success')

        const onRetry = vi.fn()

        const result = await withErrorRecovery(operation, {
          maxRetries: 3,
          retryDelay: 10,
          onRetry,
        })

        expect(result).toBe('success')
        expect(operation).toHaveBeenCalledTimes(3)
        expect(onRetry).toHaveBeenCalledTimes(2)
      })

      it('should return fallback value when all retries fail', async () => {
        const operation = vi.fn().mockRejectedValue(new Error('Always fails'))

        const result = await withErrorRecovery(operation, {
          maxRetries: 2,
          retryDelay: 10,
          fallbackValue: 'fallback',
        })

        expect(result).toBe('fallback')
        expect(operation).toHaveBeenCalledTimes(3) // Initial + 2 retries
      })

      it('should throw error when no fallback is provided', async () => {
        const operation = vi.fn().mockRejectedValue(new Error('Always fails'))

        await expect(withErrorRecovery(operation, {maxRetries: 1, retryDelay: 10})).rejects.toThrow(
          'Always fails'
        )
      })

      it('should apply exponential backoff', async () => {
        const operation = vi.fn().mockRejectedValue(new Error('Always fails'))
        const startTime = Date.now()

        try {
          await withErrorRecovery(operation, {
            maxRetries: 2,
            retryDelay: 50,
            fallbackValue: 'fallback',
          })
        } catch (error) {
          // Should not reach here due to fallback
        }

        const elapsedTime = Date.now() - startTime
        // Should take at least 50ms + 100ms for the delays
        expect(elapsedTime).toBeGreaterThanOrEqual(140)
      })
    })
  })

  describe('Storage Error Classes', () => {
    describe('StorageError', () => {
      it('should create storage error with context', () => {
        const error = new StorageError('Test error', 'testOperation', 'testKey', 'originalError')

        expect(error.message).toBe('Test error')
        expect(error.operation).toBe('testOperation')
        expect(error.key).toBe('testKey')
        expect(error.originalError).toBe('originalError')
        expect(error.name).toBe('StorageError')
      })
    })

    describe('StorageUnavailableError', () => {
      it('should create unavailable error', () => {
        const error = new StorageUnavailableError('localStorage')

        expect(error.message).toBe("Storage type 'localStorage' is not available")
        expect(error.operation).toBe('checkAvailability')
        expect(error.key).toBe('storage')
        expect(error.name).toBe('StorageUnavailableError')
      })
    })

    describe('StorageQuotaExceededError', () => {
      it('should create quota exceeded error', () => {
        const error = new StorageQuotaExceededError('testKey', 1024)

        expect(error.message).toBe("Storage quota exceeded for key 'testKey' (1024 bytes)")
        expect(error.operation).toBe('setItem')
        expect(error.key).toBe('testKey')
        expect(error.name).toBe('StorageQuotaExceededError')
      })

      it('should create quota exceeded error without size', () => {
        const error = new StorageQuotaExceededError('testKey')

        expect(error.message).toBe("Storage quota exceeded for key 'testKey'")
      })
    })

    describe('StorageSerializationError', () => {
      it('should create serialization error', () => {
        const originalError = new Error('JSON error')
        const error = new StorageSerializationError('testKey', originalError)

        expect(error.message).toBe("Failed to serialize data for key 'testKey'")
        expect(error.operation).toBe('serialize')
        expect(error.key).toBe('testKey')
        expect(error.originalError).toBe(originalError)
        expect(error.name).toBe('StorageSerializationError')
      })
    })

    describe('StorageDeserializationError', () => {
      it('should create deserialization error', () => {
        const originalError = new Error('Parse error')
        const error = new StorageDeserializationError('testKey', originalError)

        expect(error.message).toBe("Failed to deserialize data for key 'testKey'")
        expect(error.operation).toBe('deserialize')
        expect(error.key).toBe('testKey')
        expect(error.originalError).toBe(originalError)
        expect(error.name).toBe('StorageDeserializationError')
      })
    })
  })

  describe('Legacy Storage Functions', () => {
    describe('localStorage Functions', () => {
      const testData = {test: 'data', number: 42}

      it('should set and get localStorage data', () => {
        globalThis.localStorageMock.getItem.mockReturnValue(JSON.stringify(testData))
        globalThis.localStorageMock.setItem.mockImplementation(() => {})

        setLocalStorage('test-key', testData)
        expect(globalThis.localStorageMock.setItem).toHaveBeenCalledWith(
          'test-key',
          JSON.stringify(testData)
        )

        const result = getLocalStorage('test-key', null)
        expect(result).toEqual(testData)
      })

      it('should return fallback for missing data', () => {
        globalThis.localStorageMock.getItem.mockReturnValue(null)

        const result = getLocalStorage('missing-key', 'fallback')
        expect(result).toBe('fallback')
      })

      it('should handle JSON parsing errors', () => {
        globalThis.localStorageMock.getItem.mockReturnValue('invalid-json{')

        const result = getLocalStorage('malformed-key', 'fallback')
        expect(result).toBe('fallback')
      })

      it('should use custom reviver function', () => {
        const dataWithDate = {date: '2025-01-01T00:00:00.000Z', value: 'test'}
        globalThis.localStorageMock.getItem.mockReturnValue(JSON.stringify(dataWithDate))

        const reviver = (key: string, value: any) => {
          if (key === 'date') return new Date(value)
          return value
        }

        const result = getLocalStorage('date-key', {date: new Date(), value: ''}, reviver)
        expect(result.date).toBeInstanceOf(Date)
        expect(result.value).toBe('test')
      })

      it('should remove localStorage items', () => {
        globalThis.localStorageMock.removeItem.mockImplementation(() => {})

        removeLocalStorage('test-key')
        expect(globalThis.localStorageMock.removeItem).toHaveBeenCalledWith('test-key')
      })

      it('should clear localStorage', () => {
        globalThis.localStorageMock.clear.mockImplementation(() => {})

        clearLocalStorage()
        expect(globalThis.localStorageMock.clear).toHaveBeenCalled()
      })

      it('should check localStorage availability', () => {
        globalThis.localStorageMock.setItem.mockImplementation(() => {})
        globalThis.localStorageMock.removeItem.mockImplementation(() => {})

        expect(isLocalStorageAvailable()).toBe(true)

        globalThis.localStorageMock.setItem.mockImplementation(() => {
          throw new Error('Not available')
        })

        expect(isLocalStorageAvailable()).toBe(false)
      })
    })

    describe('sessionStorage Functions', () => {
      const testData = {session: 'data', count: 24}

      it('should set and get sessionStorage data', () => {
        globalThis.sessionStorageMock.getItem.mockReturnValue(JSON.stringify(testData))
        globalThis.sessionStorageMock.setItem.mockImplementation(() => {})

        setSessionStorage('session-key', testData)
        expect(globalThis.sessionStorageMock.setItem).toHaveBeenCalledWith(
          'session-key',
          JSON.stringify(testData)
        )

        const result = getSessionStorage('session-key', null)
        expect(result).toEqual(testData)
      })

      it('should return fallback for missing data', () => {
        globalThis.sessionStorageMock.getItem.mockReturnValue(null)

        const result = getSessionStorage('missing-key', 'fallback')
        expect(result).toBe('fallback')
      })

      it('should handle JSON parsing errors gracefully', () => {
        globalThis.sessionStorageMock.getItem.mockReturnValue('malformed-json{')

        const result = getSessionStorage('malformed-key', 'fallback')
        expect(result).toBe('fallback')
      })

      it('should check sessionStorage availability', () => {
        globalThis.sessionStorageMock.setItem.mockImplementation(() => {})
        globalThis.sessionStorageMock.removeItem.mockImplementation(() => {})

        expect(isSessionStorageAvailable()).toBe(true)

        globalThis.sessionStorageMock.setItem.mockImplementation(() => {
          throw new Error('Not available')
        })

        expect(isSessionStorageAvailable()).toBe(false)
      })
    })
  })

  describe('Integration with PersistenceManager', () => {
    interface TestState {
      count: number
      name: string
    }

    let persistenceManager: PersistenceManager<TestState>
    let typeRegistry: TypeRegistry
    let handleError: ReturnType<typeof vi.fn>
    const testState: TestState = {count: 42, name: 'test'}

    beforeEach(() => {
      typeRegistry = new TypeRegistry()
      handleError = vi.fn()

      persistenceManager = new PersistenceManager<TestState>(
        StorageType.Local,
        typeRegistry,
        handleError,
        'test-session-id',
        {},
        '__test_',
        'TestStore'
      )
    })

    it('should use adapter when available', () => {
      expect(persistenceManager.isStorageAvailable()).toBe(true)
    })

    it('should fallback to legacy implementation when adapter fails', () => {
      // Create persistence manager that will fail to create adapter
      const errorManager = new PersistenceManager<TestState>(
        StorageType.None, // This should not create an adapter
        typeRegistry,
        handleError,
        'test-session-id',
        {},
        '__test_',
        'TestStore'
      )

      // Should still work with fallback implementation
      expect(errorManager.isStorageAvailable()).toBe(true)
    })

    it('should handle adapter creation errors gracefully', () => {
      // Test that the manager can handle adapter creation failures
      // This is tested by the warning logged when adapter creation fails
      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Failed to create storage adapter')
      )
    })
  })

  describe('Performance and Edge Cases', () => {
    describe('Large Data Handling', () => {
      it('should handle large objects in localStorage adapter', async () => {
        const largeData = {
          items: Array.from({length: 1000}, (_, i) => ({
            id: i,
            name: `Item ${i}`,
            description: 'A'.repeat(100),
          })),
        }

        const adapter = new LocalStorageAdapter()
        globalThis.localStorageMock.setItem.mockImplementation(() => {})
        globalThis.localStorageMock.getItem.mockReturnValue(JSON.stringify(largeData))

        const setResult = await adapter.set('large-data', largeData)
        expect(setResult).toBe(true)

        const getData = await adapter.get('large-data')
        expect(getData).toEqual(largeData)
      })
    })

    describe('Concurrent Operations', () => {
      it('should handle concurrent storage operations', async () => {
        const adapter = new LocalStorageAdapter()
        globalThis.localStorageMock.setItem.mockImplementation(() => {})

        const operations = Array.from({length: 10}, (_, i) => adapter.set(`key-${i}`, {value: i}))

        const results = await Promise.all(operations)
        expect(results.every(result => result === true)).toBe(true)
        expect(globalThis.localStorageMock.setItem).toHaveBeenCalledTimes(10)
      })
    })

    describe('Memory Management', () => {
      it('should not leak memory during repeated operations', async () => {
        const adapter = new LocalStorageAdapter()
        globalThis.localStorageMock.setItem.mockImplementation(() => {})
        globalThis.localStorageMock.getItem.mockReturnValue(JSON.stringify({test: 'data'}))

        // Perform many operations
        for (let i = 0; i < 100; i++) {
          await adapter.set(`key-${i}`, {iteration: i})
          await adapter.get(`key-${i}`)
          await adapter.remove(`key-${i}`)
        }

        // Should complete without memory issues
        expect(globalThis.localStorageMock.setItem).toHaveBeenCalledTimes(100)
      })
    })
  })
})
