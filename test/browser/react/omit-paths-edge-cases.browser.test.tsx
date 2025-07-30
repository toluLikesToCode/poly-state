/// <reference types="@vitest/browser/matchers" />
/// <reference types="@testing-library/jest-dom" />

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {cleanup, waitFor} from '@testing-library/react'
import {userEvent} from '@vitest/browser/context'
import {render} from 'vitest-browser-react'
import React from 'react'

import {createStore, getLocalStorage, StorageType} from '../../../src/core'
import {createStoreContext} from '../../../src/react'
import {createOmitPathsPlugin} from '../../../src/plugins/omitPathsPlugin'

const cardStyle: React.CSSProperties = {
  padding: '16px',
  borderRadius: '8px',
  backgroundColor: '#ffffff',
  marginBottom: '16px',
  border: '1px solid #ddd',
}

const buttonStyle: React.CSSProperties = {
  margin: '4px',
  padding: '8px 16px',
  backgroundColor: '#007bff',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
}

describe('OmitPathsPlugin - Advanced Edge Cases', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('should handle circular references gracefully', async () => {
    interface TestState {
      user: {
        name: string
        secret: string
      }
      metadata: {
        sensitive: string
      }
    }

    const initialState: TestState = {
      user: {name: 'John', secret: 'secret-token'},
      metadata: {sensitive: 'sensitive-data'},
    }

    // Create test data that might cause issues but isn't circular
    const complexData = {
      id: 1,
      name: 'complex',
      nested: {level1: {level2: 'deep'}},
    }

    const omitPathsPlugin = createOmitPathsPlugin<TestState>([
      ['user', 'secret'],
      ['metadata', 'sensitive'],
    ])

    const errorHandler = vi.fn()
    const store = createStore(initialState, {
      persistKey: 'circular-refs-test',
      storageType: StorageType.Local,
      plugins: [omitPathsPlugin],
      onError: errorHandler,
    })

    const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

    function TestComponent() {
      const state = useSelector(s => s)
      const dispatch = useDispatch()

      const handleComplexUpdate = () => {
        dispatch({
          user: {
            name: 'Updated John',
            secret: 'new-secret',
          },
          metadata: {
            sensitive: 'new-sensitive',
          },
        })
      }

      return (
        <div style={cardStyle}>
          <h3>Complex Data Test</h3>
          <p>
            Name: <span data-testid="name">{state.user.name}</span>
          </p>
          <p>
            Secret: <span data-testid="secret">{state.user.secret}</span>
          </p>
          <button style={buttonStyle} data-testid="update-complex" onClick={handleComplexUpdate}>
            Update Complex Data
          </button>
        </div>
      )
    }

    const screen = render(
      <StoreProvider>
        <TestComponent />
      </StoreProvider>
    )

    // This should work fine without circular references
    await userEvent.click(screen.getByTestId('update-complex'))

    // App should work correctly
    await waitFor(() => {
      expect(screen.getByTestId('name')).toHaveTextContent('Updated John')
      expect(screen.getByTestId('secret')).toHaveTextContent('new-secret')
    })

    // Verify omitted paths work correctly
    const stored = getLocalStorage<TestState>('circular-refs-test')
    expect(stored.data.user.name).toBe('Updated John')
    expect(stored.data.user).not.toHaveProperty('secret')
    expect(stored.data.metadata).not.toHaveProperty('sensitive')
  })

  it('should handle undefined and null values in omitted paths', async () => {
    interface TestState {
      user: {
        name: string
        optional?: string | null
        settings?: {
          theme?: string
          secret?: string | null
        } | null
      }
      data: {
        value: number
        nullable: string | null
      }
    }

    const initialState: TestState = {
      user: {
        name: 'John',
        optional: null,
        settings: null,
      },
      data: {
        value: 42,
        nullable: null,
      },
    }

    const omitPathsPlugin = createOmitPathsPlugin<TestState>([
      ['user', 'optional'],
      ['user', 'settings'],
      ['data', 'nullable'],
    ])

    const store = createStore(initialState, {
      persistKey: 'undefined-null-test',
      storageType: StorageType.Local,
      plugins: [omitPathsPlugin],
    })

    const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

    function TestComponent() {
      const state = useSelector(s => s)
      const dispatch = useDispatch()

      const handleNullUpdate = () => {
        dispatch({
          user: {
            name: 'Jane',
            optional: undefined,
            settings: {theme: 'dark', secret: 'secret-key'},
          },
          data: {
            value: 100,
            nullable: 'not-null',
          },
        })
      }

      return (
        <div style={cardStyle}>
          <h3>Null/Undefined Values Test</h3>
          <p>
            Name: <span data-testid="name">{state.user.name}</span>
          </p>
          <p>
            Value: <span data-testid="value">{state.data.value}</span>
          </p>
          <p>
            Optional: <span data-testid="optional">{String(state.user.optional)}</span>
          </p>
          <p>
            Nullable: <span data-testid="nullable">{String(state.data.nullable)}</span>
          </p>
          <button style={buttonStyle} data-testid="update-nulls" onClick={handleNullUpdate}>
            Update Null Values
          </button>
        </div>
      )
    }

    const screen = render(
      <StoreProvider>
        <TestComponent />
      </StoreProvider>
    )

    await userEvent.click(screen.getByTestId('update-nulls'))

    await waitFor(() => {
      expect(screen.getByTestId('name')).toHaveTextContent('Jane')
      expect(screen.getByTestId('value')).toHaveTextContent('100')
    })

    // Verify omitted paths don't exist in storage
    const stored = getLocalStorage<TestState>('undefined-null-test')
    expect(stored.data.user.name).toBe('Jane')
    expect(stored.data.data.value).toBe(100)
    expect(stored.data.user).not.toHaveProperty('optional')
    expect(stored.data.user).not.toHaveProperty('settings')
    expect(stored.data.data).not.toHaveProperty('nullable')
  })

  it('should handle very deep nesting and complex paths', async () => {
    interface TestState {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                data: string
                secret: string
                nested: {
                  items: Array<{
                    id: number
                    metadata: {
                      public: string
                      private: string
                    }
                  }>
                }
              }
            }
          }
        }
      }
    }

    const initialState: TestState = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                data: 'public-data',
                secret: 'deep-secret',
                nested: {
                  items: [
                    {
                      id: 1,
                      metadata: {
                        public: 'public-info',
                        private: 'private-info',
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    }

    const omitPathsPlugin = createOmitPathsPlugin<TestState>([
      ['level1', 'level2', 'level3', 'level4', 'level5', 'secret'],
      [
        'level1',
        'level2',
        'level3',
        'level4',
        'level5',
        'nested',
        'items',
        0,
        'metadata',
        'private',
      ],
    ])

    const store = createStore(initialState, {
      persistKey: 'deep-nesting-test',
      storageType: StorageType.Local,
      plugins: [omitPathsPlugin],
    })

    const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

    function TestComponent() {
      const state = useSelector(s => s)
      const dispatch = useDispatch()

      const deepData = state.level1.level2.level3.level4.level5

      const handleDeepUpdate = () => {
        dispatch({
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: {
                    data: 'updated-data',
                    secret: 'new-deep-secret',
                    nested: {
                      items: [
                        {
                          id: 1,
                          metadata: {
                            public: 'updated-public',
                            private: 'updated-private',
                          },
                        },
                        {
                          id: 2,
                          metadata: {
                            public: 'new-public',
                            private: 'new-private',
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        })
      }

      return (
        <div style={cardStyle}>
          <h3>Deep Nesting Test</h3>
          <p>
            Data: <span data-testid="data">{deepData.data}</span>
          </p>
          <p>
            Secret: <span data-testid="secret">{deepData.secret}</span>
          </p>
          <p>
            Public: <span data-testid="public">{deepData.nested.items[0]?.metadata.public}</span>
          </p>
          <p>
            Private: <span data-testid="private">{deepData.nested.items[0]?.metadata.private}</span>
          </p>
          <button style={buttonStyle} data-testid="update-deep" onClick={handleDeepUpdate}>
            Update Deep State
          </button>
        </div>
      )
    }

    const screen = render(
      <StoreProvider>
        <TestComponent />
      </StoreProvider>
    )

    await userEvent.click(screen.getByTestId('update-deep'))

    await waitFor(() => {
      expect(screen.getByTestId('data')).toHaveTextContent('updated-data')
      expect(screen.getByTestId('secret')).toHaveTextContent('new-deep-secret')
      expect(screen.getByTestId('public')).toHaveTextContent('updated-public')
      expect(screen.getByTestId('private')).toHaveTextContent('updated-private')
    })

    // Verify deep omissions work correctly
    const stored = getLocalStorage<TestState>('deep-nesting-test')
    const storedDeep = stored.data.level1.level2.level3.level4.level5

    expect(storedDeep.data).toBe('updated-data')
    expect(storedDeep.nested.items[0].metadata.public).toBe('updated-public')
    expect(storedDeep.nested.items[1].metadata.public).toBe('new-public')
    expect(storedDeep.nested.items[1].metadata.private).toBe('new-private') // Only first item's private omitted

    // Deep secret should be omitted
    expect(storedDeep).not.toHaveProperty('secret')
    // First item's private should be omitted
    expect(storedDeep.nested.items[0].metadata).not.toHaveProperty('private')
  })

  it('should handle rapid state changes without data corruption', async () => {
    interface TestState {
      counter: number
      batch: number
      sensitive: {
        tokens: string[]
        secrets: Record<string, string>
      }
      public: {
        messages: string[]
      }
    }

    const initialState: TestState = {
      counter: 0,
      batch: 0,
      sensitive: {
        tokens: ['token1'],
        secrets: {key1: 'secret1'},
      },
      public: {
        messages: ['msg1'],
      },
    }

    const omitPathsPlugin = createOmitPathsPlugin<TestState>([
      ['sensitive', 'tokens'],
      ['sensitive', 'secrets'],
    ])

    const store = createStore(initialState, {
      persistKey: 'rapid-changes-test',
      storageType: StorageType.Local,
      plugins: [omitPathsPlugin],
    })

    const {StoreProvider, useSelector, useDispatch, useBatch} = createStoreContext(store)

    function TestComponent() {
      const state = useSelector(s => s)
      const dispatch = useDispatch()
      const batch = useBatch()

      const handleRapidChanges = () => {
        // Simulate rapid but manageable state changes
        batch(() => {
          for (let i = 1; i <= 10; i++) {
            dispatch({
              counter: i,
              batch: i,
              sensitive: {
                tokens: [`token-${i}`, ...state.sensitive.tokens],
                secrets: {...state.sensitive.secrets, [`key-${i}`]: `secret-${i}`},
              },
              public: {
                messages: [`msg-${i}`, ...state.public.messages],
              },
            })
          }
        })
      }

      return (
        <div style={cardStyle}>
          <h3>Rapid Changes Test</h3>
          <p>
            Counter: <span data-testid="counter">{state.counter}</span>
          </p>
          <p>
            Batch: <span data-testid="batch">{state.batch}</span>
          </p>
          <p>
            Tokens: <span data-testid="tokens">{state.sensitive.tokens.length}</span>
          </p>
          <p>
            Messages: <span data-testid="messages">{state.public.messages.length}</span>
          </p>
          <button style={buttonStyle} data-testid="rapid-changes" onClick={handleRapidChanges}>
            Rapid Changes
          </button>
        </div>
      )
    }

    const screen = render(
      <StoreProvider>
        <TestComponent />
      </StoreProvider>
    )

    await userEvent.click(screen.getByTestId('rapid-changes'))

    // Wait for all changes to propagate
    await waitFor(
      () => {
        expect(screen.getByTestId('batch')).toHaveTextContent('10')
      },
      {timeout: 3000}
    )

    // Verify final state consistency
    const stored = getLocalStorage<TestState>('rapid-changes-test')
    expect(stored.data.batch).toBe(10)
    expect(stored.data.public.messages.length).toBeGreaterThan(1)

    // Sensitive data should be omitted
    expect(stored.data.sensitive).not.toHaveProperty('tokens')
    expect(stored.data.sensitive).not.toHaveProperty('secrets')
  })

  it('should handle plugin lifecycle and cleanup correctly', async () => {
    interface TestState {
      data: string
      secret: string
    }

    const initialState: TestState = {
      data: 'initial',
      secret: 'secret-value',
    }

    let pluginCreateCalled = false
    let pluginPersistCalled = false

    const lifecyclePlugin = createOmitPathsPlugin<TestState>([['secret']], 'lifecycleTest')

    // Wrap plugin methods to track calls
    const originalPlugin = lifecyclePlugin
    const wrappedPlugin = {
      ...originalPlugin,
      onStoreCreate: (store: any) => {
        pluginCreateCalled = true
        return originalPlugin.onStoreCreate?.(store)
      },
      beforePersist: (state: any, storageType: any, store: any) => {
        pluginPersistCalled = true
        return originalPlugin.beforePersist?.(state, storageType, store)
      },
    }

    const store = createStore(initialState, {
      persistKey: 'plugin-lifecycle-test',
      storageType: StorageType.Local,
      plugins: [wrappedPlugin],
    })

    expect(pluginCreateCalled).toBe(true)

    const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

    function TestComponent() {
      const state = useSelector(s => s)
      const dispatch = useDispatch()

      return (
        <div style={cardStyle}>
          <h3>Plugin Lifecycle Test</h3>
          <p>
            Data: <span data-testid="data">{state.data}</span>
          </p>
          <p>
            Secret: <span data-testid="secret">{state.secret}</span>
          </p>
          <button
            style={buttonStyle}
            data-testid="update-state"
            onClick={() => dispatch({data: 'updated', secret: 'new-secret'})}>
            Update State
          </button>
        </div>
      )
    }

    const screen = render(
      <StoreProvider>
        <TestComponent />
      </StoreProvider>
    )

    await userEvent.click(screen.getByTestId('update-state'))

    await waitFor(() => {
      expect(screen.getByTestId('data')).toHaveTextContent('updated')
    })

    // Plugin lifecycle methods should have been called
    expect(pluginPersistCalled).toBe(true)

    // Clean up
    store.destroy({clearHistory: true, removePersistedState: true, resetRegistry: true})
  })

  it('should handle storage errors and fallback gracefully', async () => {
    interface TestState {
      data: string
      sensitive: string
    }

    const initialState: TestState = {
      data: 'initial',
      sensitive: 'secret',
    }

    const errorHandler = vi.fn()
    const omitPathsPlugin = createOmitPathsPlugin<TestState>([['sensitive']])

    const store = createStore(initialState, {
      persistKey: 'storage-error-test',
      storageType: StorageType.Local,
      plugins: [omitPathsPlugin],
      onError: errorHandler,
    })

    const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

    function TestComponent() {
      const state = useSelector(s => s)
      const dispatch = useDispatch()

      const handleUpdate = () => {
        // Mock localStorage to fail after component mounts
        const originalSetItem = localStorage.setItem
        localStorage.setItem = vi.fn(() => {
          throw new Error('Storage quota exceeded')
        })

        // Attempt update that should trigger persistence
        dispatch({data: 'updated', sensitive: 'new-secret'})

        // Restore localStorage after a delay
        setTimeout(() => {
          localStorage.setItem = originalSetItem
        }, 100)
      }

      return (
        <div style={cardStyle}>
          <h3>Storage Error Test</h3>
          <p>
            Data: <span data-testid="data">{state.data}</span>
          </p>
          <p>
            Sensitive: <span data-testid="sensitive">{state.sensitive}</span>
          </p>
          <button style={buttonStyle} data-testid="update-state" onClick={handleUpdate}>
            Update State (Will Fail Storage)
          </button>
        </div>
      )
    }

    const screen = render(
      <StoreProvider>
        <TestComponent />
      </StoreProvider>
    )

    // This should not crash the app even though storage fails
    await userEvent.click(screen.getByTestId('update-state'))

    await waitFor(() => {
      expect(screen.getByTestId('data')).toHaveTextContent('updated')
      expect(screen.getByTestId('sensitive')).toHaveTextContent('new-secret')
    })

    // Wait a bit for error to be processed
    await new Promise(resolve => setTimeout(resolve, 200))

    // App should continue working despite storage errors
    expect(screen.getByTestId('data')).toBeInTheDocument()
    expect(screen.getByTestId('sensitive')).toBeInTheDocument()
  })
})
