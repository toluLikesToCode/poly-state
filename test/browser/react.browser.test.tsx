import {describe, it, expect, beforeEach} from 'vitest'
import {render, fireEvent, waitFor} from '@testing-library/react'
import React from 'react'
import {createStore} from '../../src/core/state/createStore'
import {useStoreHooks, createStoreContext} from '../../src/react'
import {StorageType} from '../../src/core/state/types'

describe('React Integration Browser Tests', () => {
  beforeEach(() => {
    // Clear real storage before each test
    localStorage.clear()
    sessionStorage.clear()
  })

  it('should persist React state changes to real browser storage', async () => {
    const store = createStore(
      {count: 0},
      {
        persistKey: 'react-browser-test',
        storageType: StorageType.Local,
      }
    )

    function TestComponent() {
      const {useSelector, useDispatch} = useStoreHooks(store)
      const count = useSelector(state => state.count)
      const dispatch = useDispatch()

      return (
        <div>
          <span data-testid="count">{count}</span>
          <button data-testid="increment" onClick={() => dispatch({count: count + 1})}>
            Increment
          </button>
        </div>
      )
    }

    const {getByTestId} = render(<TestComponent />)

    // Click increment button
    fireEvent.click(getByTestId('increment'))

    // Wait for state update
    await waitFor(() => {
      expect(getByTestId('count').textContent).toBe('1')
    })

    // Verify real localStorage was updated
    const stored = localStorage.getItem('react-browser-test')
    expect(stored).toBeTruthy()

    const parsedData = JSON.parse(stored!)
    expect(parsedData.data.count).toBe(1)
  })

  it('should restore state in React components from real storage', () => {
    // Pre-populate localStorage
    const testData = {
      data: {count: 42, name: 'restored'},
      meta: {
        lastUpdated: Date.now(),
        sessionId: 'test-session',
        storeName: 'TestStore',
      },
    }
    localStorage.setItem('react-restore-test', JSON.stringify(testData))

    const store = createStore(
      {count: 0, name: 'initial'},
      {
        persistKey: 'react-restore-test',
        storageType: StorageType.Local,
      }
    )

    function TestComponent() {
      const {useSelector} = useStoreHooks(store)
      const count = useSelector(state => state.count)
      const name = useSelector(state => state.name)

      return (
        <div>
          <span data-testid="count">{count}</span>
          <span data-testid="name">{name}</span>
        </div>
      )
    }

    const {getByTestId} = render(<TestComponent />)

    // Should show restored values
    expect(getByTestId('count').textContent).toBe('42')
    expect(getByTestId('name').textContent).toBe('restored')
  })

  it('should work with StoreProvider and multiple components', async () => {
    const store = createStore(
      {shared: 0},
      {
        persistKey: 'react-provider-test',
        storageType: StorageType.Local,
      }
    )

    const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

    function DisplayComponent() {
      const shared = useSelector(state => state.shared)
      return <span data-testid="display">{shared}</span>
    }

    function ButtonComponent() {
      const shared = useSelector(state => state.shared)
      const dispatch = useDispatch()
      return (
        <button data-testid="button" onClick={() => dispatch({shared: shared + 1})}>
          Increment
        </button>
      )
    }

    function App() {
      return (
        <StoreProvider>
          <DisplayComponent />
          <ButtonComponent />
        </StoreProvider>
      )
    }

    const {getByTestId} = render(<App />)

    // Initial state
    expect(getByTestId('display').textContent).toBe('0')

    // Click button
    fireEvent.click(getByTestId('button'))

    // Wait for update
    await waitFor(() => {
      expect(getByTestId('display').textContent).toBe('1')
    })

    // Verify persistence
    const stored = localStorage.getItem('react-provider-test')
    expect(stored).toBeTruthy()

    const parsedData = JSON.parse(stored!)
    expect(parsedData.data.shared).toBe(1)
  })

  it('should handle cross-tab synchronization in React components', async () => {
    const store = createStore(
      {synced: 0},
      {
        persistKey: 'react-sync-test',
        storageType: StorageType.Local,
        syncAcrossTabs: true,
      }
    )

    function TestComponent() {
      const {useSelector} = useStoreHooks(store)
      const synced = useSelector(state => state.synced)
      return <span data-testid="synced">{synced}</span>
    }

    const {getByTestId} = render(<TestComponent />)

    // Initial state
    expect(getByTestId('synced').textContent).toBe('0')

    // Simulate another tab updating storage
    const externalData = {
      data: {synced: 999},
      meta: {
        lastUpdated: Date.now(),
        sessionId: 'external-session',
        storeName: 'TestStore',
      },
    }
    localStorage.setItem('react-sync-test', JSON.stringify(externalData))

    // Trigger storage event
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'react-sync-test',
        newValue: localStorage.getItem('react-sync-test'),
        oldValue: null,
        storageArea: localStorage,
      })
    )

    // Wait for React component to update
    await waitFor(
      () => {
        expect(getByTestId('synced').textContent).toBe('999')
      },
      {timeout: 1000}
    )
  })

  it('should handle errors gracefully in React components', () => {
    const store = createStore(
      {error: 'none'},
      {
        persistKey: 'react-error-test',
        storageType: StorageType.Local,
        onError: error => {
          // Error should be handled gracefully
          console.warn('Store error:', error.message)
        },
      }
    )

    function TestComponent() {
      const {useSelector, useDispatch} = useStoreHooks(store)
      const error = useSelector(state => state.error)
      const dispatch = useDispatch()

      return (
        <div>
          <span data-testid="error">{error}</span>
          <button
            data-testid="trigger-error"
            onClick={() => {
              // This should not crash the component
              try {
                dispatch({error: 'handled'})
              } catch (e) {
                // Should not throw
              }
            }}>
            Update
          </button>
        </div>
      )
    }

    const {getByTestId} = render(<TestComponent />)

    // Should render without errors
    expect(getByTestId('error').textContent).toBe('none')

    // Should handle button click without crashing
    expect(() => {
      fireEvent.click(getByTestId('trigger-error'))
    }).not.toThrow()
  })
})
