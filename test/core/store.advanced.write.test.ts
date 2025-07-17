/**
 * Advanced Store Functionality Tests
 *
 * Comprehensive test suite for the Poly State's advanced features including:
 * - Thunk actions (synchronous and asynchronous)
 * - Batch operations for grouping multiple updates
 * - Transaction support with rollback capabilities
 * - Error handling and edge cases for advanced operations
 * - Performance optimization scenarios
 * - Complex state mutation patterns
 */

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {createStore, type Store, type Thunk, type Middleware} from '../../src/core'
import {StoreError, TransactionError} from '../../src/shared'

interface ThunkTestState {
  value: number
  status: 'idle' | 'pending' | 'completed' | 'error'
  data?: string
  lastUpdated?: number
  metadata?: {
    source: string
    timestamp: number
  }
}

interface BatchTestState {
  count: number
  text: string
  items: string[]
  flags: {
    processed: boolean
    validated: boolean
  }
}

interface TransactionTestState {
  balance: number
  status: string
  transactions: Array<{
    id: string
    amount: number
    type: 'credit' | 'debit'
    timestamp: number
  }>
  metadata?: {
    lastTransaction?: string
    totalProcessed?: number
  }
}

describe('Advanced Store Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Cleanup any timers or async operations
    vi.clearAllTimers()
  })

  describe('Thunk Actions', () => {
    let store: Store<ThunkTestState>
    const initialState: ThunkTestState = {
      value: 0,
      status: 'idle',
    }

    beforeEach(() => {
      store = createStore(initialState)
    })

    describe('Synchronous Thunks', () => {
      it('should execute a synchronous thunk and update state', () => {
        const listener = vi.fn()
        store.subscribe(listener)

        const syncThunk: Thunk<ThunkTestState> = ({dispatch, getState}) => {
          const currentState = getState()
          expect(typeof dispatch).toBe('function')
          expect(typeof getState).toBe('function')

          dispatch({
            value: currentState.value + 5,
            status: 'completed',
            lastUpdated: Date.now(),
          })
        }

        store.dispatch(syncThunk)

        const finalState = store.getState()
        expect(finalState.value).toBe(5)
        expect(finalState.status).toBe('completed')
        expect(finalState.lastUpdated).toBeDefined()
        expect(listener).toHaveBeenCalledTimes(1)
      })

      it('should return the thunk result for sync thunks', () => {
        const returnValue = 'sync-result'
        const syncThunk: Thunk<ThunkTestState, string> = ({dispatch, getState}) => {
          dispatch({value: getState().value + 1})
          return returnValue
        }

        const result = store.dispatch(syncThunk)
        expect(result).toBe(returnValue)
        expect(store.getState().value).toBe(1)
      })

      it('should handle complex synchronous logic in thunks', () => {
        const complexThunk: Thunk<ThunkTestState> = ({dispatch, getState}) => {
          const state = getState()

          // Complex calculation
          const multiplier = state.value < 10 ? 2 : 3
          const newValue = (state.value + 1) * multiplier

          // Conditional updates
          if (newValue > 20) {
            dispatch({
              value: newValue,
              status: 'completed',
              data: 'high-value-operation',
            })
          } else {
            dispatch({
              value: newValue,
              status: 'pending',
            })
          }
        }

        store.dispatch(complexThunk)
        let state = store.getState()
        expect(state.value).toBe(2) // (0 + 1) * 2
        expect(state.status).toBe('pending')

        // Set up for high value scenario
        store.dispatch({value: 10})
        store.dispatch(complexThunk)

        state = store.getState()
        expect(state.value).toBe(33) // (10 + 1) * 3
        expect(state.status).toBe('completed')
        expect(state.data).toBe('high-value-operation')
      })

      it('should handle thunks that dispatch other thunks', () => {
        const innerThunk: Thunk<ThunkTestState> = ({dispatch, getState}) => {
          dispatch({
            value: getState().value + 10,
            status: 'completed',
          })
        }

        const outerThunk: Thunk<ThunkTestState> = ({dispatch}) => {
          dispatch({status: 'pending'})
          dispatch(innerThunk) // Dispatch another thunk
          dispatch({
            data: 'nested-thunk-completed',
            lastUpdated: Date.now(),
          })
        }

        const listener = vi.fn()
        store.subscribe(listener)

        store.dispatch(outerThunk)

        const finalState = store.getState()
        expect(finalState.value).toBe(10)
        expect(finalState.status).toBe('completed')
        expect(finalState.data).toBe('nested-thunk-completed')
        expect(listener).toHaveBeenCalledTimes(3) // pending, completed, data update
      })
    })

    describe('Asynchronous Thunks', () => {
      it('should execute an asynchronous thunk and update state', async () => {
        const listener = vi.fn()
        store.subscribe(listener)

        const asyncThunk: Thunk<ThunkTestState, Promise<void>> = async ({dispatch, getState}) => {
          dispatch({status: 'pending'})

          // Simulate async work
          await new Promise(resolve => setTimeout(resolve, 50))

          const fetchedData = 'async-fetched-data'
          dispatch({
            data: fetchedData,
            status: 'completed',
            value: getState().value + 15,
            lastUpdated: Date.now(),
          })
        }

        await store.dispatch(asyncThunk)

        const finalState = store.getState()
        expect(finalState.value).toBe(15)
        expect(finalState.status).toBe('completed')
        expect(finalState.data).toBe('async-fetched-data')
        expect(listener).toHaveBeenCalledTimes(2) // pending + completed
      })

      it('should return promises from async thunks', async () => {
        const returnValue = 'async-result'
        const asyncThunk: Thunk<ThunkTestState, Promise<string>> = async ({dispatch}) => {
          await new Promise(resolve => setTimeout(resolve, 10))
          dispatch({status: 'completed'})
          return returnValue
        }

        const result = await store.dispatch(asyncThunk)
        expect(result).toBe(returnValue)
        expect(store.getState().status).toBe('completed')
      })

      it('should handle complex async workflows', async () => {
        const mockApiCall = vi.fn().mockResolvedValue({
          data: 'api-data',
          timestamp: Date.now(),
        })

        const complexAsyncThunk: Thunk<ThunkTestState, Promise<string>> = async ({
          dispatch,
          getState,
        }) => {
          dispatch({status: 'pending', data: 'loading...'})

          try {
            // Simulate API call
            const response = await mockApiCall()

            // Process response
            const processedValue = getState().value + response.data.length

            dispatch({
              value: processedValue,
              status: 'completed',
              data: response.data,
              metadata: {
                source: 'api',
                timestamp: response.timestamp,
              },
            })

            return 'workflow-completed'
          } catch (error) {
            dispatch({
              status: 'error',
              data: `Error: ${(error as Error).message}`,
            })
            throw error
          }
        }

        const result = await store.dispatch(complexAsyncThunk)

        expect(result).toBe('workflow-completed')
        expect(mockApiCall).toHaveBeenCalledTimes(1)

        const finalState = store.getState()
        expect(finalState.status).toBe('completed')
        expect(finalState.value).toBe(8) // 0 + 'api-data'.length
        expect(finalState.metadata?.source).toBe('api')
      })

      it('should handle async thunk errors properly', async () => {
        const erroringAsyncThunk: Thunk<ThunkTestState, Promise<void>> = async ({dispatch}) => {
          dispatch({status: 'pending'})
          await new Promise(resolve => setTimeout(resolve, 10))
          throw new Error('Async operation failed')
        }

        await expect(store.dispatch(erroringAsyncThunk)).rejects.toThrow('Async operation failed')

        // State should reflect the pending status before the error
        expect(store.getState().status).toBe('pending')
      })

      it('should handle concurrent async thunks', async () => {
        const createAsyncThunk =
          (id: number, delay: number): Thunk<ThunkTestState, Promise<number>> =>
          async ({dispatch, getState}) => {
            await new Promise(resolve => setTimeout(resolve, delay))
            dispatch({
              value: getState().value + id,
              data: `thunk-${id}-completed`,
            })
            return id
          }

        // Launch multiple async thunks concurrently
        const promises = [
          store.dispatch(createAsyncThunk(1, 30)),
          store.dispatch(createAsyncThunk(2, 20)),
          store.dispatch(createAsyncThunk(3, 10)),
        ]

        const results = await Promise.all(promises)

        expect(results).toEqual([1, 2, 3])
        expect(store.getState().value).toBe(6) // 1 + 2 + 3
        expect(store.getState().data).toBe('thunk-1-completed') // First one to complete wins in this implementation
      })
    })

    describe('Thunk Return Values', () => {
      beforeEach(() => {
        store = createStore(initialState)
      })

      it('should return primitive values from synchronous thunks', () => {
        // String return value
        const stringThunk: Thunk<ThunkTestState, string> = ({dispatch}) => {
          dispatch({value: 1})
          return 'operation-completed'
        }

        const stringResult = store.dispatch(stringThunk)
        expect(stringResult).toBe('operation-completed')
        expect(typeof stringResult).toBe('string')

        // Number return value
        const numberThunk: Thunk<ThunkTestState, number> = ({dispatch, getState}) => {
          const newValue = getState().value + 42
          dispatch({value: newValue})
          return newValue
        }

        const numberResult = store.dispatch(numberThunk)
        expect(numberResult).toBe(43) // 1 + 42
        expect(typeof numberResult).toBe('number')

        // Boolean return value
        const booleanThunk: Thunk<ThunkTestState, boolean> = ({dispatch, getState}) => {
          const currentValue = getState().value
          const isHighValue = currentValue > 40
          dispatch({status: isHighValue ? 'completed' : 'pending'})
          return isHighValue
        }

        const booleanResult = store.dispatch(booleanThunk)
        expect(booleanResult).toBe(true)
        expect(typeof booleanResult).toBe('boolean')
      })

      it('should return object values from synchronous thunks', () => {
        interface OperationResult {
          success: boolean
          data: string
          timestamp: number
          metadata: {
            operation: string
            executionTime: number
          }
        }

        const objectThunk: Thunk<ThunkTestState, OperationResult> = ({dispatch, getState}) => {
          const startTime = Date.now()
          const currentState = getState()

          dispatch({
            value: currentState.value + 1,
            status: 'completed',
            data: 'object-operation',
          })

          return {
            success: true,
            data: 'thunk-operation-completed',
            timestamp: Date.now(),
            metadata: {
              operation: 'objectThunk',
              executionTime: Date.now() - startTime,
            },
          }
        }

        const result = store.dispatch(objectThunk)

        expect(result).toMatchObject({
          success: true,
          data: 'thunk-operation-completed',
          metadata: {
            operation: 'objectThunk',
          },
        })
        expect(result.timestamp).toBeGreaterThan(0)
        expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0)
        expect(store.getState().value).toBe(1) // Started from 0, added 1
      })

      it('should return array values from synchronous thunks', () => {
        const arrayThunk: Thunk<ThunkTestState, string[]> = ({dispatch, getState}) => {
          const state = getState()
          const operations: string[] = []

          if (state.value >= 0) {
            // Changed from > 0 to >= 0 since we start with 0
            operations.push('positive-value')
            dispatch({status: 'completed'})

            // Check status again after dispatch to get updated state
            const updatedState = getState()
            if (updatedState.status === 'completed') {
              operations.push('status-completed')
            }
          }

          operations.push('final-operation')

          dispatch({
            data: `operations: ${operations.join(', ')}`,
            lastUpdated: Date.now(),
          })

          return operations
        }

        const result = store.dispatch(arrayThunk)

        expect(Array.isArray(result)).toBe(true)
        expect(result).toEqual(['positive-value', 'status-completed', 'final-operation'])
        expect(store.getState().data).toBe(
          'operations: positive-value, status-completed, final-operation'
        )
      })

      it('should return primitive values from asynchronous thunks', async () => {
        // String from async thunk
        const asyncStringThunk: Thunk<ThunkTestState, Promise<string>> = async ({dispatch}) => {
          dispatch({status: 'pending'})
          await new Promise(resolve => setTimeout(resolve, 10))
          dispatch({status: 'completed', data: 'async-string-operation'})
          return 'async-string-result'
        }

        const stringResult = await store.dispatch(asyncStringThunk)
        expect(stringResult).toBe('async-string-result')

        // Number from async thunk
        const asyncNumberThunk: Thunk<ThunkTestState, Promise<number>> = async ({
          dispatch,
          getState,
        }) => {
          await new Promise(resolve => setTimeout(resolve, 10))
          const calculatedValue = getState().value * 2
          dispatch({value: calculatedValue})
          return calculatedValue
        }

        const numberResult = await store.dispatch(asyncNumberThunk)
        expect(numberResult).toBe(0) // 0 * 2 = 0
        expect(store.getState().value).toBe(0)
      })

      it('should return complex objects from asynchronous thunks', async () => {
        interface AsyncApiResult {
          userId: number
          posts: Array<{
            id: number
            title: string
            content: string
          }>
          pagination: {
            page: number
            totalPages: number
            hasNext: boolean
          }
          metadata: {
            requestId: string
            timestamp: number
            source: string
          }
        }

        const complexAsyncThunk: Thunk<ThunkTestState, Promise<AsyncApiResult>> = async ({
          dispatch,
          getState,
        }) => {
          dispatch({status: 'pending', data: 'fetching-user-data'})

          // Simulate API call
          await new Promise(resolve => setTimeout(resolve, 20))

          const mockApiResponse: AsyncApiResult = {
            userId: 123,
            posts: [
              {id: 1, title: 'First Post', content: 'Content 1'},
              {id: 2, title: 'Second Post', content: 'Content 2'},
            ],
            pagination: {
              page: 1,
              totalPages: 5,
              hasNext: true,
            },
            metadata: {
              requestId: 'req-' + Date.now(),
              timestamp: Date.now(),
              source: 'api-v2',
            },
          }

          dispatch({
            status: 'completed',
            data: 'user-data-loaded',
            value: getState().value + mockApiResponse.posts.length,
            metadata: {
              source: mockApiResponse.metadata.source,
              timestamp: mockApiResponse.metadata.timestamp,
            },
          })

          return mockApiResponse
        }

        const result = await store.dispatch(complexAsyncThunk)

        expect(result.userId).toBe(123)
        expect(result.posts).toHaveLength(2)
        expect(result.posts[0]).toMatchObject({
          id: 1,
          title: 'First Post',
          content: 'Content 1',
        })
        expect(result.pagination.hasNext).toBe(true)
        expect(result.metadata.source).toBe('api-v2')
        expect(result.metadata.requestId).toMatch(/^req-\d+$/)

        // Verify state was updated correctly
        const finalState = store.getState()
        expect(finalState.status).toBe('completed')
        expect(finalState.value).toBe(2) // 0 + 2 posts
        expect(finalState.data).toBe('user-data-loaded')
        expect(finalState.metadata?.source).toBe('api-v2')
      })

      it('should handle chained thunks with return values', () => {
        const firstThunk: Thunk<ThunkTestState, {step: number; data: string}> = ({
          dispatch,
          getState,
        }) => {
          dispatch({value: getState().value + 10, status: 'pending'})
          return {step: 1, data: 'first-completed'}
        }

        const secondThunk: Thunk<
          ThunkTestState,
          {step: number; data: string; previousData: string}
        > = ({dispatch, getState}) => {
          const firstResult = store.dispatch(firstThunk)
          dispatch({
            value: getState().value + 20,
            status: 'completed',
            data: `${firstResult.data} -> second-completed`,
          })
          return {
            step: 2,
            data: 'second-completed',
            previousData: firstResult.data,
          }
        }

        const result = store.dispatch(secondThunk)

        expect(result.step).toBe(2)
        expect(result.data).toBe('second-completed')
        expect(result.previousData).toBe('first-completed')

        // Verify state reflects both thunk executions
        const finalState = store.getState()
        expect(finalState.value).toBe(30) // 0 + 10 + 20
        expect(finalState.status).toBe('completed')
        expect(finalState.data).toBe('first-completed -> second-completed')
      })

      it('should handle thunks returning functions (higher-order thunks)', () => {
        type ThunkFactory = (multiplier: number) => Thunk<ThunkTestState, number>

        const thunkFactoryThunk: Thunk<ThunkTestState, ThunkFactory> = ({dispatch}) => {
          dispatch({data: 'thunk-factory-created'})

          return (adder: number) =>
            ({dispatch: innerDispatch, getState: innerGetState}) => {
              const newValue = innerGetState().value + adder
              innerDispatch({value: newValue, status: 'completed'})
              return newValue
            }
        }

        const thunkFactory = store.dispatch(thunkFactoryThunk)
        expect(typeof thunkFactory).toBe('function')
        expect(store.getState().data).toBe('thunk-factory-created')

        // Use the returned thunk factory
        const addByTwoThunk = thunkFactory(2)
        const result = store.dispatch(addByTwoThunk)

        expect(result).toBe(2) // 0 + 2 = 0
        expect(store.getState().value).toBe(2)
      })

      it('should handle thunks with conditional return types', () => {
        type ConditionalResult = string | number | {error: string}

        const conditionalThunk: Thunk<ThunkTestState, ConditionalResult> = ({
          dispatch,
          getState,
        }) => {
          const currentValue = getState().value

          if (currentValue < 0) {
            dispatch({status: 'error'})
            return {error: 'Negative value not allowed'}
          } else if (currentValue < 100) {
            dispatch({status: 'pending', value: currentValue + 1})
            return 'low-value-incremented'
          } else {
            dispatch({status: 'completed', data: 'high-value-processed'})
            return currentValue
          }
        }

        // Test with high value (need to set a high value first)
        store.dispatch({value: 240})
        const result1 = store.dispatch(conditionalThunk)
        expect(typeof result1).toBe('number')
        expect(result1).toBe(240)
        expect(store.getState().status).toBe('completed')

        // Test with low value
        store.dispatch({value: 50})
        const result2 = store.dispatch(conditionalThunk)
        expect(typeof result2).toBe('string')
        expect(result2).toBe('low-value-incremented')
        expect(store.getState().value).toBe(51)

        // Test with negative value
        store.dispatch({value: -10})
        const result3 = store.dispatch(conditionalThunk)
        expect(typeof result3).toBe('object')
        expect(result3).toEqual({error: 'Negative value not allowed'})
        expect(store.getState().status).toBe('error')
      })
    })

    describe('Thunk Error Handling', () => {
      it('should handle synchronous thunk errors', () => {
        const mockOnError = vi.fn()
        const errorStore = createStore(initialState, {
          onError: mockOnError,
        })

        const errorThunk: Thunk<ThunkTestState> = () => {
          throw new Error('Sync thunk error')
        }

        // Store should handle the error internally, not throw
        errorStore.dispatch(errorThunk)

        // State should remain unchanged
        expect(errorStore.getState()).toEqual(initialState)

        // Error handler should be called
        expect(mockOnError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Thunk execution failed'),
          })
        )
      })

      it('should handle errors with custom error handling', () => {
        const mockOnError = vi.fn()
        const errorStore = createStore(initialState, {
          onError: mockOnError,
        })

        const errorThunk: Thunk<ThunkTestState> = () => {
          throw new Error('Custom error handling test')
        }

        errorStore.dispatch(errorThunk)

        expect(mockOnError).toHaveBeenCalledTimes(1)
        const errorArg = mockOnError.mock.calls[0][0]
        expect(errorArg).toBeInstanceOf(StoreError)
        expect(errorArg.context?.error?.message).toBe('Custom error handling test')
      })
    })
  })

  describe('Batch Operations', () => {
    let store: Store<BatchTestState>
    const initialState: BatchTestState = {
      count: 0,
      text: 'initial',
      items: [],
      flags: {
        processed: false,
        validated: false,
      },
    }

    beforeEach(() => {
      store = createStore(initialState)
    })

    describe('Basic Batch Functionality', () => {
      it('should group multiple dispatches into a single listener notification', () => {
        const listener = vi.fn()
        store.subscribe(listener)

        store.batch(() => {
          store.dispatch({count: 1})
          store.dispatch({text: 'batched'})
          store.dispatch({items: ['item1', 'item2']})
          store.dispatch({
            flags: {
              processed: true,
              validated: true,
            },
          })
        })

        expect(store.getState()).toEqual({
          count: 1,
          text: 'batched',
          items: ['item1', 'item2'],
          flags: {
            processed: true,
            validated: true,
          },
        })

        expect(listener).toHaveBeenCalledTimes(1)
        expect(listener).toHaveBeenCalledWith(store.getState(), initialState)
      })

      it('should handle incremental updates within batch correctly', () => {
        store.batch(() => {
          store.dispatch({count: 5})
          store.dispatch({count: store.getState().count + 3}) // Should be 5 + 3 = 8
          store.dispatch({count: store.getState().count * 2}) // Should be 8 * 2 = 16
        })

        expect(store.getState().count).toBe(16)
      })

      it('should handle empty batch operations', () => {
        const listener = vi.fn()
        store.subscribe(listener)

        store.batch(() => {
          // No operations
        })

        expect(store.getState()).toEqual(initialState)
        expect(listener).not.toHaveBeenCalled()
      })
    })

    describe('Nested Batch Operations', () => {
      it('should handle nested batch calls correctly', () => {
        const listener = vi.fn()
        store.subscribe(listener)

        store.batch(() => {
          store.dispatch({count: 1})

          store.batch(() => {
            store.dispatch({text: 'nested'})
            store.dispatch({count: store.getState().count + 2}) // Should be 1 + 2 = 3
          })

          store.dispatch({items: ['final']})
        })

        expect(store.getState()).toEqual({
          count: 3,
          text: 'nested',
          items: ['final'],
          flags: {
            processed: false,
            validated: false,
          },
        })

        expect(listener).toHaveBeenCalledTimes(1)
      })

      it('should handle deeply nested batch operations', () => {
        const listener = vi.fn()
        store.subscribe(listener)

        store.batch(() => {
          store.dispatch({count: 1})

          store.batch(() => {
            store.dispatch({text: 'level-2'})

            store.batch(() => {
              store.dispatch({count: store.getState().count + 5})
              store.dispatch({items: ['deep-item']})
            })
          })
        })

        expect(store.getState().count).toBe(6)
        expect(store.getState().text).toBe('level-2')
        expect(store.getState().items).toEqual(['deep-item'])
        expect(listener).toHaveBeenCalledTimes(1)
      })
    })

    describe('Batch with Complex Operations', () => {
      it('should handle batch operations with thunks', () => {
        const listener = vi.fn()
        store.subscribe(listener)

        const incrementThunk: Thunk<BatchTestState> = ({dispatch, getState}) => {
          dispatch({count: getState().count + 10})
        }

        store.batch(() => {
          store.dispatch({text: 'pre-thunk'})
          store.dispatch(incrementThunk)
          store.dispatch({items: ['post-thunk']})
        })

        expect(store.getState()).toEqual({
          count: 10,
          text: 'pre-thunk',
          items: ['post-thunk'],
          flags: {
            processed: false,
            validated: false,
          },
        })

        expect(listener).toHaveBeenCalledTimes(1)
      })

      it('should handle batch operations with path updates', () => {
        const listener = vi.fn()
        store.subscribe(listener)

        store.batch(() => {
          store.dispatch({
            flags: {processed: true, validated: true},
            count: store.getState().count + 5,
            text: 'path-updated',
          })
        })

        expect(store.getState()).toEqual({
          count: 5,
          text: 'path-updated',
          items: [],
          flags: {
            processed: true,
            validated: true,
          },
        })

        expect(listener).toHaveBeenCalledTimes(1)
      })
    })

    describe('Batch Error Handling', () => {
      it('should handle errors within batch functions', () => {
        const mockOnError = vi.fn()
        const errorStore = createStore(initialState, {onError: mockOnError})
        const listener = vi.fn()
        errorStore.subscribe(listener)

        errorStore.batch(() => {
          errorStore.dispatch({count: 5})
          throw new Error('Batch function error')
        })

        expect(mockOnError).toHaveBeenCalledTimes(1)
        const errorArg = mockOnError.mock.calls[0][0]
        expect(errorArg).toBeInstanceOf(StoreError)
        expect(errorArg.message).toBe('Batch execution failed')

        // State should remain unchanged due to error
        expect(errorStore.getState()).toEqual(initialState)
        expect(listener).not.toHaveBeenCalled()
      })

      it('should handle async operations within batch', async () => {
        const listener = vi.fn()
        store.subscribe(listener)

        const asyncMiddleware: Middleware<BatchTestState> = async (
          action,
          prevState,
          dispatchNext
        ) => {
          if (action.text === 'async-process') {
            await new Promise(resolve => setTimeout(resolve, 10))
            dispatchNext({
              ...action,
              items: [...(prevState.items || []), 'async-processed'],
            })
          } else {
            dispatchNext(action)
          }
        }

        const asyncStore = createStore(initialState, {
          middleware: [asyncMiddleware],
        })
        asyncStore.subscribe(listener)

        asyncStore.batch(() => {
          asyncStore.dispatch({count: 1})
          asyncStore.dispatch({text: 'async-process'})
        })

        // Wait for async middleware to complete
        await vi.waitFor(() => {
          expect(asyncStore.getState().items).toContain('async-processed')
        })

        expect(asyncStore.getState()).toEqual({
          count: 1,
          text: 'async-process',
          items: ['async-processed'],
          flags: {
            processed: false,
            validated: false,
          },
        })

        expect(listener).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('Transaction Operations', () => {
    let store: Store<TransactionTestState>
    const initialState: TransactionTestState = {
      balance: 100,
      status: 'active',
      transactions: [],
    }

    beforeEach(() => {
      store = createStore(initialState)
    })

    describe('Basic Transaction Functionality', () => {
      it('should apply changes when transaction succeeds', () => {
        const listener = vi.fn()
        store.subscribe(listener)

        const result = store.transaction(draft => {
          draft.balance = 150
          draft.status = 'updated'
          draft.transactions.push({
            id: 'tx-1',
            amount: 50,
            type: 'credit',
            timestamp: Date.now(),
          })
        })

        expect(result).toBe(true)

        const finalState = store.getState()
        expect(finalState.balance).toBe(150)
        expect(finalState.status).toBe('updated')
        expect(finalState.transactions).toHaveLength(1)
        expect(finalState.transactions[0].amount).toBe(50)

        expect(listener).toHaveBeenCalledTimes(1)
      })

      it('should return updated state object when explicitly returned', () => {
        const result = store.transaction(draft => {
          return {
            balance: 200,
            status: 'explicitly-updated',
            transactions: [
              {
                id: 'tx-explicit',
                amount: 100,
                type: 'credit',
                timestamp: Date.now(),
              },
            ],
          }
        })

        expect(result).toBe(true)
        expect(store.getState().balance).toBe(200)
        expect(store.getState().status).toBe('explicitly-updated')
        expect(store.getState().transactions[0].id).toBe('tx-explicit')
      })

      it('should handle complex transaction logic', () => {
        const result = store.transaction(draft => {
          // Complex business logic
          const transferAmount = 25

          if (draft.balance >= transferAmount) {
            draft.balance -= transferAmount
            draft.transactions.push({
              id: `tx-${Date.now()}`,
              amount: -transferAmount,
              type: 'debit',
              timestamp: Date.now(),
            })

            // Update metadata
            draft.metadata = {
              lastTransaction: `debit-${transferAmount}`,
              totalProcessed: (draft.metadata?.totalProcessed || 0) + 1,
            }

            draft.status = 'transfer-completed'
          } else {
            draft.status = 'insufficient-funds'
          }
        })

        expect(result).toBe(true)

        const finalState = store.getState()
        expect(finalState.balance).toBe(75)
        expect(finalState.status).toBe('transfer-completed')
        expect(finalState.transactions).toHaveLength(1)
        expect(finalState.metadata?.totalProcessed).toBe(1)
      })
    })

    describe('Transaction Rollback', () => {
      it('should rollback changes when transaction throws an error', () => {
        const mockOnError = vi.fn()
        const errorStore = createStore(initialState, {onError: mockOnError})
        const listener = vi.fn()
        errorStore.subscribe(listener)

        const result = errorStore.transaction(draft => {
          draft.balance = 500 // Make changes
          draft.status = 'should-not-persist'

          // Simulate error condition
          if (draft.balance > 200) {
            throw new Error('Balance too high!')
          }
        })

        expect(result).toBe(false)
        expect(errorStore.getState()).toEqual(initialState) // Should be rolled back
        expect(listener).not.toHaveBeenCalled() // No state change notification

        expect(mockOnError).toHaveBeenCalledTimes(1)
        const errorArg = mockOnError.mock.calls[0][0]
        expect(errorArg).toBeInstanceOf(TransactionError)
        expect(errorArg.context?.error?.message).toBe('Balance too high!')
      })

      it('should handle complex rollback scenarios', () => {
        const mockOnError = vi.fn()
        const errorStore = createStore(initialState, {onError: mockOnError})

        const result = errorStore.transaction(draft => {
          // Make multiple complex changes
          draft.balance = 250
          draft.transactions.push(
            {
              id: 'tx-1',
              amount: 50,
              type: 'credit',
              timestamp: Date.now(),
            },
            {
              id: 'tx-2',
              amount: 100,
              type: 'credit',
              timestamp: Date.now(),
            }
          )

          draft.metadata = {
            lastTransaction: 'multi-credit',
            totalProcessed: 2,
          }

          // Validation that causes rollback
          const totalCredits = draft.transactions
            .filter(tx => tx.type === 'credit')
            .reduce((sum, tx) => sum + tx.amount, 0)

          if (totalCredits > 100) {
            throw new Error('Credit limit exceeded')
          }
        })

        expect(result).toBe(false)
        expect(errorStore.getState()).toEqual(initialState)
        expect(mockOnError).toHaveBeenCalledTimes(1)
      })
    })

    describe('Transaction Edge Cases', () => {
      it('should handle transactions that make no changes', () => {
        const listener = vi.fn()
        store.subscribe(listener)

        const result = store.transaction(draft => {
          // Read state but make no changes
          const currentBalance = draft.balance
        })

        expect(result).toBe(true)
        expect(store.getState()).toEqual(initialState)
        expect(listener).not.toHaveBeenCalled() // No changes, no notification
      })

      it('should handle nested object mutations', () => {
        const initialStateWithNested: TransactionTestState = {
          ...initialState,
          metadata: {
            lastTransaction: 'initial',
            totalProcessed: 0,
          },
        }

        const nestedStore = createStore(initialStateWithNested)

        const result = nestedStore.transaction(draft => {
          draft.metadata!.totalProcessed = 5
          draft.metadata!.lastTransaction = 'nested-update'

          // Add nested transaction data
          draft.transactions.push({
            id: 'nested-tx',
            amount: 75,
            type: 'credit',
            timestamp: Date.now(),
          })
        })

        expect(result).toBe(true)

        const finalState = nestedStore.getState()
        expect(finalState.metadata?.totalProcessed).toBe(5)
        expect(finalState.metadata?.lastTransaction).toBe('nested-update')
        expect(finalState.transactions).toHaveLength(1)
      })

      it('should handle array mutations correctly', () => {
        const result = store.transaction(draft => {
          // Add multiple transactions
          draft.transactions.push(
            {
              id: 'tx-1',
              amount: 25,
              type: 'debit',
              timestamp: Date.now(),
            },
            {
              id: 'tx-2',
              amount: 50,
              type: 'credit',
              timestamp: Date.now(),
            }
          )

          // Remove first transaction (test array mutation)
          draft.transactions.shift()

          // Modify remaining transaction
          if (draft.transactions.length > 0) {
            draft.transactions[0].amount = 60
          }
        })

        expect(result).toBe(true)

        const finalState = store.getState()
        expect(finalState.transactions).toHaveLength(1)
        expect(finalState.transactions[0].id).toBe('tx-2')
        expect(finalState.transactions[0].amount).toBe(60)
      })
    })

    describe('Transaction Minimal Diff Implementation', () => {
      interface ComplexTransactionState {
        user: {
          id: number
          name: string
          preferences: {
            theme: string
            notifications: boolean
          }
        }
        data: {
          count: number
          items: string[]
          settings: {
            autoSave: boolean
            maxItems: number
          }
        }
        ui: {
          loading: boolean
          errors: string[]
        }
        primitives: {
          stringValue: string
          numberValue: number
          booleanValue: boolean
        }
      }

      let complexStore: Store<ComplexTransactionState>
      const complexInitialState: ComplexTransactionState = {
        user: {
          id: 1,
          name: 'Test User',
          preferences: {
            theme: 'dark',
            notifications: true,
          },
        },
        data: {
          count: 0,
          items: ['item1', 'item2'],
          settings: {
            autoSave: false,
            maxItems: 10,
          },
        },
        ui: {
          loading: false,
          errors: [],
        },
        primitives: {
          stringValue: 'initial',
          numberValue: 42,
          booleanValue: true,
        },
      }

      beforeEach(() => {
        complexStore = createStore(complexInitialState)
        store.destroy() // Ensure no interference from previous tests
      })

      afterEach(() => {
        complexStore.destroy()
        complexStore = null as any
      })

      it('should create minimal diff for root level primitive changes', () => {
        const listener = vi.fn()
        complexStore.subscribe(listener)

        const result = complexStore.transaction(draft => {
          draft.primitives.stringValue = 'updated'
          draft.primitives.numberValue = 100
          // booleanValue unchanged
        })

        expect(result).toBe(true)
        expect(listener).toHaveBeenCalledTimes(1)

        // Verify the diff only contains changed parts
        const [newState, prevState] = listener.mock.calls[0]

        // Should have primitives object with only changed sub-properties
        expect(newState.primitives.stringValue).toBe('updated')
        expect(newState.primitives.numberValue).toBe(100)
        expect(newState.primitives.booleanValue).toBe(true)

        // Other root keys should be unchanged references
        expect(newState.user).toBe(prevState.user)
        expect(newState.data).toBe(prevState.data)
        expect(newState.ui).toBe(prevState.ui)
      })

      it('should create minimal diff for nested object changes', () => {
        const listener = vi.fn()
        complexStore.subscribe(listener)

        const result = complexStore.transaction(draft => {
          draft.user.preferences.theme = 'light'
          draft.data.settings.autoSave = true
          // Leave other nested properties unchanged
        })

        expect(result).toBe(true)
        expect(listener).toHaveBeenCalledTimes(1)

        const [newState, prevState] = listener.mock.calls[0]

        // Should create diff with only changed nested properties
        expect(newState.user.preferences.theme).toBe('light')
        expect(newState.user.preferences.notifications).toBe(true) // unchanged but included in diff
        expect(newState.user.name).toBe('Test User') // unchanged but included in diff
        expect(newState.user.id).toBe(1) // unchanged but included in diff

        expect(newState.data.settings.autoSave).toBe(true)
        expect(newState.data.settings.maxItems).toBe(10) // unchanged but included in diff
        expect(newState.data.count).toBe(0) // unchanged but included in diff
        expect(Array.isArray(newState.data.items)).toBe(true) // unchanged but included in diff

        // Primitives and ui should be unchanged references
        expect(newState.primitives).toBe(prevState.primitives)
        expect(newState.ui).toBe(prevState.ui)
      })

      it('should handle array changes by replacing the entire array', () => {
        const listener = vi.fn()
        complexStore.subscribe(listener)

        const result = complexStore.transaction(draft => {
          draft.data.items.push('item3')
          draft.ui.errors.push('error1', 'error2')
        })

        expect(result).toBe(true)
        expect(listener).toHaveBeenCalledTimes(1)

        const [newState, prevState] = listener.mock.calls[0]

        // Arrays should be completely replaced in diff (not minimal sub-diffs)
        expect(newState.data.items).toEqual(['item1', 'item2', 'item3'])
        expect(newState.ui.errors).toEqual(['error1', 'error2'])

        // Should include all properties at the same level since arrays were changed
        expect(newState.data.count).toBe(0)
        expect(newState.data.settings.autoSave).toBe(false)
        expect(newState.data.settings.maxItems).toBe(10)

        expect(newState.ui.loading).toBe(false)

        // Other root keys should be unchanged references
        expect(newState.user).toBe(prevState.user)
        expect(newState.primitives).toBe(prevState.primitives)
      })

      it('should handle mixed changes across multiple root keys', () => {
        const listener = vi.fn()
        complexStore.subscribe(listener)

        const result = complexStore.transaction(draft => {
          // Change primitive
          draft.primitives.stringValue = 'mixed-update'

          // Change nested object property
          draft.user.preferences.notifications = false

          // Change array
          draft.ui.errors = ['new-error']

          // Change root level property
          draft.data.count = 5
        })

        expect(result).toBe(true)
        expect(listener).toHaveBeenCalledTimes(1)

        const [newState, prevState] = listener.mock.calls[0]

        // Verify all changes are present
        expect(newState.primitives.stringValue).toBe('mixed-update')
        expect(newState.user.preferences.notifications).toBe(false)
        expect(newState.ui.errors).toEqual(['new-error'])
        expect(newState.data.count).toBe(5)

        // Verify minimal diff structure:
        // - primitives object includes only changed sub-properties (goes one level deeper)
        expect(newState.primitives.numberValue).toBe(42)
        expect(newState.primitives.booleanValue).toBe(true)

        // - user object includes all properties since nested object changed (goes one level deeper)
        expect(newState.user.id).toBe(1)
        expect(newState.user.name).toBe('Test User')
        expect(newState.user.preferences.theme).toBe('dark')

        // - ui object includes all properties since array changed
        expect(newState.ui.loading).toBe(false)

        // - data object includes all properties since root property changed
        expect(newState.data.items).toEqual(['item1', 'item2'])
        expect(newState.data.settings.autoSave).toBe(false)
        expect(newState.data.settings.maxItems).toBe(10)
      })

      it('should not create diff when no changes are made', () => {
        const listener = vi.fn()
        complexStore.subscribe(listener)

        const result = complexStore.transaction(draft => {
          // Read values but don't change anything
          const currentTheme = draft.user.preferences.theme
          const currentCount = draft.data.count
          // No mutations
        })

        expect(result).toBe(true)
        expect(listener).not.toHaveBeenCalled() // No changes, no notification
      })

      it('should handle changes to properties with null/undefined values', () => {
        interface StateWithNullable {
          optional?: string
          nullable: string | null
          nested: {
            optional?: number
            nullable: boolean | null
          }
        }

        const nullableState: StateWithNullable = {
          nullable: null,
          nested: {
            nullable: null,
          },
        }

        const nullableStore = createStore(nullableState)
        const listener = vi.fn()
        nullableStore.subscribe(listener)

        const result = nullableStore.transaction(draft => {
          draft.optional = 'now-defined'
          draft.nullable = 'no-longer-null'
          draft.nested.optional = 42
          draft.nested.nullable = true
        })

        expect(result).toBe(true)
        expect(listener).toHaveBeenCalledTimes(1)

        const [newState] = listener.mock.calls[0]
        expect(newState.optional).toBe('now-defined')
        expect(newState.nullable).toBe('no-longer-null')
        expect(newState.nested.optional).toBe(42)
        expect(newState.nested.nullable).toBe(true)
      })

      it('should preserve object references for unchanged nested structures', () => {
        const listener = vi.fn()
        complexStore.subscribe(listener)

        // Get references to unchanged objects before transaction
        const originalUser = complexStore.getState().user
        const originalUi = complexStore.getState().ui

        const result = complexStore.transaction(draft => {
          // Only change primitive values
          draft.primitives.stringValue = 'reference-test'
          draft.data.count = 999
        })

        expect(result).toBe(true)
        expect(listener).toHaveBeenCalledTimes(1)

        const finalState = complexStore.getState()

        // Changed objects should be new references
        expect(finalState.primitives).not.toBe(complexInitialState.primitives)
        expect(finalState.data).not.toBe(complexInitialState.data)

        // But nested objects that weren't changed should maintain their references
        // Note: Due to Immer's structural sharing, these will be new references
        // but the minimal diff logic should still only include changed properties
        expect(finalState.primitives.stringValue).toBe('reference-test')
        expect(finalState.data.count).toBe(999)

        // Unchanged root objects should be same reference
        expect(finalState.user).toBe(originalUser)
        expect(finalState.ui).toBe(originalUi)
      })
    })

    describe('Transaction Performance and Optimization', () => {
      it('should handle large state mutations efficiently', () => {
        const largeState: TransactionTestState = {
          balance: 1000,
          status: 'active',
          transactions: Array.from({length: 1000}, (_, i) => ({
            id: `tx-${i}`,
            amount: Math.random() * 100,
            type: Math.random() > 0.5 ? 'credit' : 'debit',
            timestamp: Date.now() - i * 1000,
          })),
        }

        const largeStore = createStore(largeState)
        const startTime = performance.now()

        const result = largeStore.transaction(draft => {
          // Perform bulk operation
          draft.transactions.forEach((tx, index) => {
            if (tx.type === 'credit' && tx.amount > 50) {
              draft.transactions[index].amount *= 1.1 // Apply interest
            }
          })

          // Add summary transaction
          const totalCredits = draft.transactions
            .filter(tx => tx.type === 'credit')
            .reduce((sum, tx) => sum + tx.amount, 0)

          draft.metadata = {
            lastTransaction: 'bulk-update',
            totalProcessed: totalCredits,
          }
        })

        const endTime = performance.now()

        expect(result).toBe(true)
        expect(endTime - startTime).toBeLessThan(100) // Should be fast
        expect(largeStore.getState().metadata?.lastTransaction).toBe('bulk-update')
      })
    })
  })

  describe('Advanced Integration Scenarios', () => {
    interface ComplexState {
      user: {
        id: number
        profile: {
          name: string
          preferences: {
            theme: string
            notifications: boolean
          }
        }
      }
      data: {
        items: Array<{id: number; status: string; value: number}>
        cache: Map<string, any>
        metadata: {
          lastUpdate: number
          version: number
        }
      }
      ui: {
        loading: boolean
        errors: string[]
        modals: {
          [key: string]: boolean
        }
      }
    }

    it('should handle complex workflows combining all advanced features', async () => {
      const complexInitialState: ComplexState = {
        user: {
          id: 1,
          profile: {
            name: 'Test User',
            preferences: {
              theme: 'dark',
              notifications: true,
            },
          },
        },
        data: {
          items: [],
          cache: new Map(),
          metadata: {
            lastUpdate: 0,
            version: 1,
          },
        },
        ui: {
          loading: false,
          errors: [],
          modals: {},
        },
      }

      const complexStore = createStore(complexInitialState)
      const listener = vi.fn()
      complexStore.subscribe(listener)

      // Complex async workflow using all features
      const complexWorkflow: Thunk<ComplexState, Promise<string>> = async ({
        dispatch,
        getState,
      }) => {
        // Start with UI updates
        dispatch({
          ui: {
            ...getState().ui,
            loading: true,
            errors: [],
          },
        })

        try {
          // Simulate async data fetch
          await new Promise(resolve => setTimeout(resolve, 20))

          // Use batch for multiple UI updates
          const currentState = getState()
          dispatch({
            data: {
              ...currentState.data,
              items: [
                {id: 1, status: 'active', value: 100},
                {id: 2, status: 'pending', value: 200},
              ],
              metadata: {
                ...currentState.data.metadata,
                lastUpdate: Date.now(),
                version: currentState.data.metadata.version + 1,
              },
            },
          })

          // Use transaction for complex state changes
          const transactionResult = complexStore.transaction(draft => {
            // Complex business logic
            const totalValue = draft.data.items.reduce((sum, item) => sum + item.value, 0)

            if (totalValue > 250) {
              draft.user.profile.preferences.notifications = false
              draft.ui.modals['high-value-warning'] = true
            }

            // Activate all items
            draft.data.items.forEach(item => {
              item.status = 'active'
            })

            draft.ui.loading = false
          })

          if (!transactionResult) {
            throw new Error('Transaction failed')
          }

          return 'workflow-completed'
        } catch (error) {
          dispatch({
            ui: {
              ...getState().ui,
              loading: false,
              errors: [`Workflow error: ${(error as Error).message}`],
            },
          })
          throw error
        }
      }

      const result = await complexStore.dispatch(complexWorkflow)

      expect(result).toBe('workflow-completed')

      const finalState = complexStore.getState()
      expect(finalState.ui.loading).toBe(false)
      expect(finalState.data.items).toHaveLength(2)
      expect(finalState.data.items.every(item => item.status === 'active')).toBe(true)
      expect(finalState.user.profile.preferences.notifications).toBe(false)
      expect(finalState.ui.modals['high-value-warning']).toBe(true)
      expect(finalState.data.metadata.version).toBe(2)

      // Should have received multiple notifications from the complex workflow
      expect(listener.mock.calls.length).toBeGreaterThan(1)
    })
  })
})
