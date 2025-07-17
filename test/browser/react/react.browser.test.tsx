import {describe, it, expect, beforeEach} from 'vitest'
import {render, fireEvent, waitFor} from '@testing-library/react'
import {act} from 'react'
import {
  createStore,
  StorageType,
  getLocalStorage,
  setLocalStorage,
  PersistedState,
  Thunk,
} from '../../../src/core'
import {useStoreHooks, createStoreContext} from '../../../src/react'

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

    const parsedValue = getLocalStorage('react-browser-test', {} as PersistedState<{count: number}>)
    expect(parsedValue.data).toMatchObject({
      count: 1,
    })
  })

  it('should restore state in React components from real storage', () => {
    interface state {
      count: number
      name: string
    }

    const initialState: state = {count: 0, name: 'initial'}
    // Pre-populate localStorage
    const testData: PersistedState<state> = {
      data: {count: 42, name: 'restored'} as state,
      meta: {
        lastUpdated: Date.now(),
        sessionId: 'test-session',
        storeName: 'TestStore',
      },
    }
    localStorage.setItem('react-restore-test', JSON.stringify(testData))

    const store = createStore(initialState, {
      persistKey: 'react-restore-test',
      storageType: StorageType.Local,
    })

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

    // verify localStorage has the restored state
    const stored = getLocalStorage('react-restore-test', {} as PersistedState<state>)
    expect(stored).toBeTruthy()
    expect(stored.data).toMatchObject({
      count: 42,
      name: 'restored',
    })
  })

  it('should work with StoreProvider and multiple components', async () => {
    interface state {
      readonly shared: number
    }
    const initialState: state = {shared: 0}
    const store = createStore(initialState, {
      persistKey: 'react-provider-test',
      storageType: StorageType.Local,
    })

    const {StoreProvider, useStoreValue, useThunk} = createStoreContext(store)

    function DisplayComponent() {
      const shared = useStoreValue('shared')
      return <span data-testid="display">{shared}</span>
    }

    function ButtonComponent() {
      const run = useThunk()
      const increment: Thunk<state> = ({getState, dispatch}) => {
        const current = getState().shared
        dispatch({shared: current + 1})
      }
      return (
        <button data-testid="button" onClick={() => run(increment)}>
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

    // Click button (wrap in act)
    await act(async () => {
      fireEvent.click(getByTestId('button'))
    })

    // Wait for update
    await waitFor(() => {
      expect(getByTestId('display').textContent).toBe('1')
    })

    // Verify persistence
    const stored = getLocalStorage('react-provider-test', {} as PersistedState<state>)
    expect(stored).toBeTruthy()
    expect(stored.data.shared).toBe(1)

    // Reset store (wrap in act)
    await act(async () => {
      store.reset()
    })

    // fire 100 events to ensure persistence works under load (wrap in act)
    await act(async () => {
      for (let i = 0; i < 100; i++) {
        fireEvent.click(getByTestId('button'))
      }
    })

    // Verify state after multiple updates
    await waitFor(() => {
      expect(getByTestId('display').textContent).toBe('100')
    })

    // Verify persistence after multiple updates
    const finalStored = getLocalStorage('react-provider-test', {} as PersistedState<state>)
    expect(finalStored).toBeTruthy()
    expect(finalStored.data.shared).toBe(100)
  })

  it('should handle cross-tab synchronization in React components', async () => {
    interface state {
      synced: number
    }
    const initialState: state = {synced: 0}
    const store = createStore(initialState, {
      persistKey: 'react-sync-test',
      storageType: StorageType.Local,
      syncAcrossTabs: true,
    })

    function TestComponent() {
      const {useStoreValue} = useStoreHooks(store)
      const synced = useStoreValue('synced')
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

    setLocalStorage('react-sync-test', externalData)

    // Wrap dispatch in act
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'react-sync-test',
          newValue: localStorage.getItem('react-sync-test'),
          oldValue: null,
          storageArea: localStorage,
        })
      )
    })
    // Wait for React component to update after act
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
