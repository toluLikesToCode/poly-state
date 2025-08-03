/// <reference types="@vitest/browser/matchers" />
/// <reference types="@testing-library/jest-dom" />

import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {cleanup, waitFor} from '@testing-library/react'
import {render} from 'vitest-browser-react'
import React from 'react'

import {
  createStore,
  getLocalStorage,
  PersistedState,
  setLocalStorage,
  StateMetadata,
  StorageType,
  TypeRegistry,
} from '../../../src/core'
import {createStoreContext} from '../../../src/react'
import {createOmitPathsPlugin} from '../../../src/plugins/omitPathsPlugin'

const cardStyle: React.CSSProperties = {
  padding: '16px',
  borderRadius: '8px',
  backgroundColor: '#ffffff',
  marginBottom: '16px',
  border: '1px solid #ddd',
  fontFamily: 'sans-serif',
}

const valueStyle: React.CSSProperties = {
  fontWeight: 'bold',
  backgroundColor: '#e3f2fd',
  padding: '2px 6px',
  borderRadius: '3px',
  display: 'inline-block',
  minWidth: '20px',
}

describe('Core Merge Fixes - Focused Tests', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Fix 1: Null Value Handling in State Restoration', () => {
    interface TestState {
      version: number | null
      config: {
        theme: string
        features: {
          analytics: boolean | null
          darkMode: boolean | null
        }
      }
    }

    it('should correctly handle null to non-null transitions during state restoration', async () => {
      const initialState: TestState = {
        version: null, // Initial state has null
        config: {
          theme: 'light',
          features: {
            analytics: null, // Initial state has null
            darkMode: null, // Initial state has null
          },
        },
      }

      // Persisted state has non-null values
      const typeRegistry = new TypeRegistry()
      const persistedData: TestState = {
        version: 2, // null -> number
        config: {
          theme: 'dark',
          features: {
            analytics: true, // null -> boolean
            darkMode: false, // null -> boolean
          },
        },
      }

      const serializedData = typeRegistry.serialize(persistedData)
      const persistedState: PersistedState<TestState> = {
        data: serializedData,
        meta: {
          lastUpdated: Date.now(),
          sessionId: 'test-session',
          storeName: 'test-store',
        },
      }
      setLocalStorage('null-fix-test', persistedState)

      const store = createStore(initialState, {
        persistKey: 'null-fix-test',
        storageType: StorageType.Local,
      })

      const {StoreProvider, useSelector} = createStoreContext(store)

      function TestComponent() {
        const state = useSelector(s => s)

        return (
          <div style={cardStyle}>
            <h3>Null Value Handling Fix</h3>
            <p>
              Version:{' '}
              <span data-testid="version" style={valueStyle}>
                {state.version ?? 'null'}
              </span>
            </p>
            <p>
              Theme:{' '}
              <span data-testid="theme" style={valueStyle}>
                {state.config.theme}
              </span>
            </p>
            <p>
              Analytics:{' '}
              <span data-testid="analytics" style={valueStyle}>
                {state.config.features.analytics?.toString() ?? 'null'}
              </span>
            </p>
            <p>
              Dark Mode:{' '}
              <span data-testid="dark-mode" style={valueStyle}>
                {state.config.features.darkMode?.toString() ?? 'null'}
              </span>
            </p>
          </div>
        )
      }

      const screen = render(
        <StoreProvider>
          <TestComponent />
        </StoreProvider>
      )

      await waitFor(() => {
        // All values should be loaded from persisted state (null -> non-null works)
        expect(screen.getByTestId('version')).toHaveTextContent('2')
        expect(screen.getByTestId('theme')).toHaveTextContent('dark')
        expect(screen.getByTestId('analytics')).toHaveTextContent('true')
        expect(screen.getByTestId('dark-mode')).toHaveTextContent('false')
      })
    })

    it('should correctly handle non-null to null transitions during state restoration', async () => {
      const initialState: TestState = {
        version: 1, // Initial state has non-null
        config: {
          theme: 'light',
          features: {
            analytics: false, // Initial state has non-null
            darkMode: true, // Initial state has non-null
          },
        },
      }

      // Persisted state has null values
      const typeRegistry = new TypeRegistry()
      const persistedData: TestState = {
        version: null, // number -> null
        config: {
          theme: 'system',
          features: {
            analytics: null, // boolean -> null
            darkMode: null, // boolean -> null
          },
        },
      }

      const serializedData = typeRegistry.serialize(persistedData)
      const persistedState: PersistedState<TestState> = {
        data: serializedData,
        meta: {
          lastUpdated: Date.now(),
          sessionId: 'test-session',
          storeName: 'test-store',
        },
      }
      setLocalStorage('null-to-nonnull-test', persistedState)

      const store = createStore(initialState, {
        persistKey: 'null-to-nonnull-test',
        storageType: StorageType.Local,
      })

      const {StoreProvider, useSelector} = createStoreContext(store)

      function TestComponent() {
        const state = useSelector(s => s)

        return (
          <div style={cardStyle}>
            <h3>Non-Null to Null Transition</h3>
            <p>
              Version:{' '}
              <span data-testid="version" style={valueStyle}>
                {state.version ?? 'null'}
              </span>
            </p>
            <p>
              Theme:{' '}
              <span data-testid="theme" style={valueStyle}>
                {state.config.theme}
              </span>
            </p>
            <p>
              Analytics:{' '}
              <span data-testid="analytics" style={valueStyle}>
                {state.config.features.analytics?.toString() ?? 'null'}
              </span>
            </p>
            <p>
              Dark Mode:{' '}
              <span data-testid="dark-mode" style={valueStyle}>
                {state.config.features.darkMode?.toString() ?? 'null'}
              </span>
            </p>
          </div>
        )
      }

      const screen = render(
        <StoreProvider>
          <TestComponent />
        </StoreProvider>
      )

      await waitFor(() => {
        // All values should be loaded from persisted state (non-null -> null works)
        expect(screen.getByTestId('version')).toHaveTextContent('null')
        expect(screen.getByTestId('theme')).toHaveTextContent('system')
        expect(screen.getByTestId('analytics')).toHaveTextContent('null')
        expect(screen.getByTestId('dark-mode')).toHaveTextContent('null')
      })
    })
  })

  describe('Fix 2: Understanding Data Persistence Behavior', () => {
    interface TestState {
      user: {
        name: string
        settings: {
          theme: string
          notifications: boolean
        }
      }
      data: {
        items: Array<{id: number; value: string}>
      }
    }

    it('should load persisted data as-is, even if shape differs from initial state', async () => {
      const initialState: TestState = {
        user: {
          name: 'Default User',
          settings: {
            theme: 'light',
            notifications: false,
          },
        },
        data: {
          items: [{id: 1, value: 'default'}],
        },
      }

      // Persisted data with different shape (this is allowed behavior)
      const differentShapeData = {
        data: {
          user: 'not-an-object', // Different type
          data: {
            items: 'not-an-array', // Different type
          },
        },
        meta: {
          lastUpdated: Date.now(),
          sessionId: 'different-shape-session',
          storeName: 'different-shape-store',
        },
      }

      localStorage.setItem('different-shape-test', JSON.stringify(differentShapeData))

      const store = createStore(initialState, {
        persistKey: 'different-shape-test',
        storageType: StorageType.Local,
      })

      await store.waitForStateLoad()

      const {StoreProvider, useSelector} = createStoreContext(store)

      function TestComponent() {
        const state = useSelector(s => s)

        console.log('Different shape test - actual state:', JSON.stringify(state, null, 2))

        return (
          <div style={cardStyle}>
            <h3>Data Persistence Behavior</h3>
            <p>
              User (type):{' '}
              <span data-testid="user-type" style={valueStyle}>
                {typeof state.user}
              </span>
            </p>
            <p>
              User (value):{' '}
              <span data-testid="user-value" style={valueStyle}>
                {String(state.user)}
              </span>
            </p>
            <p>
              Data Items (type):{' '}
              <span data-testid="items-type" style={valueStyle}>
                {typeof (state as any).data?.items}
              </span>
            </p>
            <p>
              Data Items (value):{' '}
              <span data-testid="items-value" style={valueStyle}>
                {String((state as any).data?.items)}
              </span>
            </p>
          </div>
        )
      }

      const screen = render(
        <StoreProvider>
          <TestComponent />
        </StoreProvider>
      )

      await waitFor(() => {
        // System loads persisted data as-is, without type validation
        expect(screen.getByTestId('user-type')).toHaveTextContent('string')
        expect(screen.getByTestId('user-value')).toHaveTextContent('not-an-object')
        expect(screen.getByTestId('items-type')).toHaveTextContent('string')
        expect(screen.getByTestId('items-value')).toHaveTextContent('not-an-array')
      })
    })

    it('should handle valid data shape changes correctly', async () => {
      const initialState: TestState = {
        user: {
          name: 'Default User',
          settings: {
            theme: 'light',
            notifications: false,
          },
        },
        data: {
          items: [{id: 1, value: 'default'}],
        },
      }

      // Valid but different structured data
      const validDifferentData = {
        data: {
          user: {
            name: 'Loaded User',
            settings: {
              theme: 'dark',
              notifications: true,
              // Extra field should be preserved
              newField: 'extra',
            },
          },
          data: {
            items: [
              {id: 2, value: 'loaded'},
              {id: 3, value: 'another'},
            ],
          },
        },
        meta: {
          lastUpdated: Date.now(),
          sessionId: 'valid-different-session',
          storeName: 'valid-different-store',
        },
      }

      localStorage.setItem('valid-different-test', JSON.stringify(validDifferentData))

      const store = createStore(initialState, {
        persistKey: 'valid-different-test',
        storageType: StorageType.Local,
      })

      await store.waitForStateLoad()

      const {StoreProvider, useSelector} = createStoreContext(store)

      function TestComponent() {
        const state = useSelector(s => s)

        return (
          <div style={cardStyle}>
            <h3>Valid Data Shape Changes</h3>
            <p>
              User Name:{' '}
              <span data-testid="user-name" style={valueStyle}>
                {state.user.name}
              </span>
            </p>
            <p>
              Theme:{' '}
              <span data-testid="theme" style={valueStyle}>
                {state.user.settings.theme}
              </span>
            </p>
            <p>
              Notifications:{' '}
              <span data-testid="notifications" style={valueStyle}>
                {state.user.settings.notifications.toString()}
              </span>
            </p>
            <p>
              Extra Field:{' '}
              <span data-testid="extra-field" style={valueStyle}>
                {(state.user.settings as any).newField ?? 'undefined'}
              </span>
            </p>
            <p>
              Items Count:{' '}
              <span data-testid="items-count" style={valueStyle}>
                {state.data.items.length}
              </span>
            </p>
          </div>
        )
      }

      const screen = render(
        <StoreProvider>
          <TestComponent />
        </StoreProvider>
      )

      await waitFor(() => {
        // All valid data should be loaded correctly, including extra fields
        expect(screen.getByTestId('user-name')).toHaveTextContent('Loaded User')
        expect(screen.getByTestId('theme')).toHaveTextContent('dark')
        expect(screen.getByTestId('notifications')).toHaveTextContent('true')
        expect(screen.getByTestId('extra-field')).toHaveTextContent('extra')
        expect(screen.getByTestId('items-count')).toHaveTextContent('2')
      })
    })
  })

  describe('Combined: Omit Paths + Null Handling + Malformed Data', () => {
    interface ComplexState {
      user: {
        id: string
        profile: {
          name: string
          avatar: string | null
        } | null
        secret: string // This will be omitted from persistence
      }
      settings: {
        theme: string
        advanced: Record<string, any> | null
      }
    }

    it('should handle all three scenarios correctly in combination', async () => {
      const initialState: ComplexState = {
        user: {
          id: 'default-id',
          profile: null,
          secret: 'default-secret',
        },
        settings: {
          theme: 'light',
          advanced: null,
        },
      }

      // Create omit paths plugin that omits the secret
      const omitPathsPlugin = createOmitPathsPlugin<ComplexState>(
        [['user', 'secret']],
        'complexTest',
        initialState
      )

      // Corrupted data with mixed scenarios
      const complexData = {
        data: {
          user: {
            id: 'loaded-user',
            profile: {
              name: 'Loaded User',
              avatar: null, // null value
            },
            // secret omitted from persisted data
          },
          settings: 'corrupted-settings', // Malformed - should fallback
        },
        meta: {
          lastUpdated: Date.now(),
          sessionId: 'complex-session',
          storeName: 'complex-store',
        },
      }

      localStorage.setItem('complex-test', JSON.stringify(complexData))

      const store = createStore(initialState, {
        persistKey: 'complex-test',
        storageType: StorageType.Local,
        plugins: [omitPathsPlugin],
      })

      await store.waitForStateLoad()

      const {StoreProvider, useSelector} = createStoreContext(store)

      function TestComponent() {
        const state = useSelector(s => s)

        return (
          <div style={cardStyle}>
            <h3>Combined Edge Cases</h3>
            <p>
              User ID:{' '}
              <span data-testid="user-id" style={valueStyle}>
                {state.user.id}
              </span>
            </p>
            <p>
              User Name:{' '}
              <span data-testid="user-name" style={valueStyle}>
                {state.user.profile?.name ?? 'null'}
              </span>
            </p>
            <p>
              Avatar:{' '}
              <span data-testid="avatar" style={valueStyle}>
                {state.user.profile?.avatar ?? 'null'}
              </span>
            </p>
            <p>
              Secret:{' '}
              <span data-testid="secret" style={valueStyle}>
                {state.user.secret}
              </span>
            </p>
            <p>
              Theme:{' '}
              <span data-testid="theme" style={valueStyle}>
                {state.settings.theme}
              </span>
            </p>
            <p>
              Advanced:{' '}
              <span data-testid="advanced" style={valueStyle}>
                {state.settings.advanced ? 'object' : 'null'}
              </span>
            </p>
          </div>
        )
      }

      const screen = render(
        <StoreProvider>
          <TestComponent />
        </StoreProvider>
      )

      await waitFor(() => {
        // Valid loaded data should be used
        expect(screen.getByTestId('user-id')).toHaveTextContent('loaded-user')
        expect(screen.getByTestId('user-name')).toHaveTextContent('Loaded User')

        // Null values should be preserved
        expect(screen.getByTestId('avatar')).toHaveTextContent('null')

        // Omitted paths should keep initial values
        expect(screen.getByTestId('secret')).toHaveTextContent('default-secret')

        // Malformed data should fallback to initial state
        expect(screen.getByTestId('theme')).toHaveTextContent('light')
        expect(screen.getByTestId('advanced')).toHaveTextContent('null')
      })
    })
  })
})
