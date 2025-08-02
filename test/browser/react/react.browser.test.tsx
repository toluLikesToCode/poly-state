/// <reference types="@vitest/browser/matchers" />
/// <reference types="@testing-library/jest-dom" />
import {afterEach, beforeEach, describe, expect, it, vi, beforeAll, afterAll} from 'vitest'
import {cleanup, waitFor, screen} from '@testing-library/react'
import {userEvent} from '@vitest/browser/context'

import {render} from 'vitest-browser-react'
import React, {Profiler} from 'react'
import {
  createStore,
  getLocalStorage,
  PersistedState,
  setLocalStorage,
  StorageType,
  Thunk,
} from '../../../src/core'
import {createStoreContext, useStoreHooks} from '../../../src/react'
import {createOmitPathsPlugin} from '../../../src/plugins/omitPathsPlugin'

// --- Reusable Styles for Test Components ---
const containerStyle: React.CSSProperties = {
  fontFamily: 'sans-serif',
  padding: '20px',
  backgroundColor: '#f4f7f9',
}

const cardStyle: React.CSSProperties = {
  padding: '16px',
  borderRadius: '8px',
  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
  marginBottom: '16px',
  backgroundColor: '#ffffff',
  color: '#333',
}

const buttonStyle: React.CSSProperties = {
  margin: '0 4px',
  padding: '10px 15px',
  borderRadius: '6px',
  border: 'none',
  backgroundColor: '#007bff',
  color: 'white',
  fontWeight: 'bold',
  cursor: 'pointer',
  transition: 'background-color 0.2s',
}

const valueStyle: React.CSSProperties = {
  fontWeight: 'bold',
  color: '#0056b3',
  backgroundColor: '#eef',
  padding: '2px 6px',
  borderRadius: '4px',
  display: 'inline-block',
  minWidth: '20px',
  textAlign: 'center',
}

// Configure React testing environment for browser mode
beforeAll(() => {
  // Set up React testing environment globals
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    value: true,
    writable: true,
    configurable: true,
  })

  // Ensure React DevTools are available in browser mode
  if (typeof window !== 'undefined') {
    ;(window as any).IS_REACT_ACT_ENVIRONMENT = true
  }
})

// Clean up after each test
afterAll(() => {
  cleanup()
})

describe('React Integration Browser Tests', () => {
  beforeEach(() => {
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
        <div style={cardStyle}>
          <h3>State Persistence</h3>
          <p>
            Count:{' '}
            <span style={valueStyle} data-testid="count">
              {count}
            </span>
          </p>
          <button
            style={buttonStyle}
            data-testid="increment"
            onClick={() => dispatch({count: count + 1})}>
            Increment
          </button>
        </div>
      )
    }

    const screen = render(
      <div style={containerStyle}>
        <TestComponent />
      </div>
    )
    await userEvent.click(screen.getByTestId('increment'))
    await expect.element(screen.getByTestId('count')).toHaveTextContent('1')
    const stored = getLocalStorage<{count: number}>('react-browser-test')
    expect(stored.data.count).toBe(1)
  })

  it('should restore state in React components from real storage', async () => {
    interface State {
      count: number
      name: string
    }
    const testData: PersistedState<State> = {
      data: {count: 42, name: 'restored'},
      meta: {lastUpdated: Date.now(), sessionId: 'test-session', storeName: 'TestStore'},
    }
    localStorage.setItem('react-restore-test', JSON.stringify(testData))

    const store = createStore({count: 0, name: 'initial'} as State, {
      persistKey: 'react-restore-test',
      storageType: StorageType.Local,
    })
    await store.waitForStateLoad()

    function TestComponent() {
      const {count, name} = useStoreHooks(store).useSelector(state => state)
      return (
        <div style={cardStyle}>
          <h3>State Restoration</h3>
          <p>
            Restored Count:{' '}
            <span style={valueStyle} data-testid="count">
              {count}
            </span>
          </p>
          <p>
            Restored Name:{' '}
            <span style={valueStyle} data-testid="name">
              {name}
            </span>
          </p>
        </div>
      )
    }

    const screen = render(
      <div style={containerStyle}>
        <TestComponent />
      </div>
    )
    await expect.element(screen.getByTestId('count')).toHaveTextContent('42')
    await expect.element(screen.getByTestId('name')).toHaveTextContent('restored')
  })

  it('should work with StoreProvider and multiple components', async () => {
    interface State {
      readonly shared: number
    }
    const store = createStore({shared: 0} as State, {
      persistKey: 'react-provider-test',
      storageType: StorageType.Local,
    })
    const {StoreProvider, useStoreValue, useThunk} = createStoreContext(store)

    const Display = () => (
      <p>
        Shared:{' '}
        <span style={valueStyle} data-testid="display">
          {useStoreValue('shared')}
        </span>
      </p>
    )
    const Controls = () => {
      const run = useThunk()
      const increment: Thunk<State> = ({getState, transaction}) =>
        void transaction(draft => {
          draft.shared += 1
        })

      return (
        <button style={buttonStyle} data-testid="button" onClick={() => run(increment)}>
          Increment
        </button>
      )
    }

    const screen = render(
      <StoreProvider>
        <div style={containerStyle}>
          <div style={cardStyle}>
            <Display />
            <Controls />
          </div>
        </div>
      </StoreProvider>
    )

    await expect.element(screen.getByTestId('display')).toHaveTextContent('0')
    await userEvent.click(screen.getByTestId('button'))
    await expect.element(screen.getByTestId('display')).toHaveTextContent('1')

    store.reset()

    for (let i = 0; i < 100; i++) await userEvent.click(screen.getByTestId('button'))
    await expect.element(screen.getByTestId('display')).toHaveTextContent('100')
    const finalStored = getLocalStorage<State>('react-provider-test')
    expect(finalStored.data.shared).toBe(100)
  })

  it('should handle cross-tab synchronization in React components', async () => {
    const store = createStore(
      {synced: 0},
      {persistKey: 'react-sync-test', storageType: StorageType.Local, syncAcrossTabs: true}
    )

    function TestComponent() {
      const synced = useStoreHooks(store).useStoreValue('synced')
      return (
        <div style={cardStyle}>
          <h3>Tab Sync</h3>
          <p>
            Synced Value:{' '}
            <span style={valueStyle} data-testid="synced">
              {synced}
            </span>
          </p>
        </div>
      )
    }

    const screen = render(
      <div style={containerStyle}>
        <TestComponent />
      </div>
    )
    await expect.element(screen.getByTestId('synced')).toHaveTextContent('0')

    const externalData = {
      data: {synced: 999},
      meta: {lastUpdated: Date.now(), sessionId: 'external', storeName: 'TestStore'},
    }
    setLocalStorage('react-sync-test', externalData)

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'react-sync-test',
        newValue: JSON.stringify(externalData),
      })
    )

    await expect.element(screen.getByTestId('synced')).toHaveTextContent('999')
  })

  it('should handle errors gracefully in React components', async () => {
    const onError = vi.fn()
    const store = createStore(
      {error: 'none'},
      {persistKey: 'react-error-test', storageType: StorageType.Local, onError}
    )

    function TestComponent() {
      const {useSelector, useDispatch} = useStoreHooks(store)
      return (
        <div style={cardStyle}>
          <h3>Error Handling</h3>
          <p>
            Error State:{' '}
            <span style={valueStyle} data-testid="error">
              {useSelector(s => s.error)}
            </span>
          </p>
          <button
            style={buttonStyle}
            data-testid="trigger-error"
            onClick={() => useDispatch()({error: 'handled'})}>
            Update
          </button>
        </div>
      )
    }

    const screen = render(
      <div style={containerStyle}>
        <TestComponent />
      </div>
    )
    await expect.element(screen.getByTestId('error')).toHaveTextContent('none')
    await userEvent.click(screen.getByTestId('trigger-error'))
    await expect.element(screen.getByTestId('error')).toHaveTextContent('handled')
    expect(onError).not.toHaveBeenCalled() // Assuming dispatch doesn't throw, onError handles store-level errors
  })
})

describe('Browser: useSyncExternalStore Integration Functionality', () => {
  interface TestState {
    count: number
    user: {name: string; email: string}
    nested: {deep: {value: string}}
  }
  let store: ReturnType<typeof createStore<TestState>>
  const initialState: TestState = {
    count: 0,
    user: {name: 'John', email: 'john@example.com'},
    nested: {deep: {value: 'test'}},
  }

  beforeEach(context => {
    store = createStore<TestState>(initialState, {name: context.task.name, historyLimit: 100})
  })

  afterEach(() => {
    store.destroy({clearHistory: true, removePersistedState: true, resetRegistry: true})
  })

  describe('Browser: Basic functionality', () => {
    it('Browser: useSelector works correctly with context', async () => {
      const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)
      function CtxComponent() {
        const count = useSelector(state => state.count)
        const dispatch = useDispatch()
        return (
          <div style={cardStyle}>
            <h3>useSelector (Context)</h3>
            <p>
              Count:{' '}
              <span style={valueStyle} data-testid="count">
                {count}
              </span>
            </p>
            <button
              data-testid="increment-button"
              style={buttonStyle}
              onClick={() => dispatch({count: count + 1})}>
              Increment
            </button>
          </div>
        )
      }

      const screen = render(
        <StoreProvider>
          <div style={containerStyle}>
            <CtxComponent />
          </div>
        </StoreProvider>
      )
      await expect.element(screen.getByTestId('count')).toHaveTextContent('0')
      await userEvent.click(screen.getByTestId('increment-button'))
      await expect.element(screen.getByTestId('count')).toHaveTextContent('1')
    })

    it('Browser: useSelector works correctly with context-free hooks', async () => {
      const {useSelector, useDispatch} = useStoreHooks(store)
      function CtxFreeComponent() {
        const count = useSelector(state => state.count)
        const dispatch = useDispatch()
        return (
          <div style={cardStyle}>
            <h3>useSelector (Context-Free)</h3>
            <p>
              Count:{' '}
              <span style={valueStyle} data-testid="count">
                {count}
              </span>
            </p>
            <button
              data-testid="increment-button"
              style={buttonStyle}
              onClick={() => dispatch({count: count + 1})}>
              Increment
            </button>
          </div>
        )
      }

      const screen = render(
        <div style={containerStyle}>
          <CtxFreeComponent />
        </div>
      )
      await expect.element(screen.getByTestId('count')).toHaveTextContent('0')
      await userEvent.click(screen.getByTestId('increment-button'))
      await expect.element(screen.getByTestId('count')).toHaveTextContent('1')
    })

    it('Browser: useStoreState works correctly', async () => {
      const {StoreProvider, useStoreState, useDispatch} = createStoreContext(store)
      function TestComponent() {
        const state = useStoreState()
        const dispatch = useDispatch()
        return (
          <div style={cardStyle}>
            <h3>useStoreState</h3>
            <p>
              Count:{' '}
              <span style={valueStyle} data-testid="count">
                {state.count}
              </span>
            </p>
            <p>
              Name:{' '}
              <span style={valueStyle} data-testid="name">
                {state.user.name}
              </span>
            </p>
            <button
              data-testid="increment-button"
              style={buttonStyle}
              onClick={() => dispatch({count: state.count + 1})}>
              Increment
            </button>
          </div>
        )
      }

      const screen = render(
        <StoreProvider>
          <div style={containerStyle}>
            <TestComponent />
          </div>
        </StoreProvider>
      )
      await expect.element(screen.getByTestId('count')).toHaveTextContent('0')
      await expect.element(screen.getByTestId('name')).toHaveTextContent('John')
      await userEvent.click(screen.getByTestId('increment-button'))
      await expect.element(screen.getByTestId('count')).toHaveTextContent('1')
    })

    it('Browser: useStoreValue works correctly with path-based access', async () => {
      const {StoreProvider, useStoreValue, useUpdatePath} = createStoreContext(store)
      function TestComponent() {
        const name = useStoreValue<string>('user.name')
        const updatePath = useUpdatePath()
        return (
          <div style={cardStyle}>
            <h3>useStoreValue</h3>
            <p>
              Name:{' '}
              <span style={valueStyle} data-testid="name">
                {name}
              </span>
            </p>
            <button
              data-testid="update-button"
              style={buttonStyle}
              onClick={() => updatePath(['user', 'name'], () => 'Jane')}>
              Update Name
            </button>
          </div>
        )
      }

      const screen = render(
        <StoreProvider>
          <div style={containerStyle}>
            <TestComponent />
          </div>
        </StoreProvider>
      )
      await expect.element(screen.getByTestId('name')).toHaveTextContent('John')
      await userEvent.click(screen.getByTestId('update-button'))
      await expect.element(screen.getByTestId('name')).toHaveTextContent('Jane')
    })

    it('Browser: useCombinedSelector works correctly', async () => {
      const {StoreProvider, useCombinedSelector, useDispatch} = createStoreContext(store)
      const selectCount = store.select(s => s.count)
      const selectName = store.select(s => s.user.name)

      function TestComponent() {
        const result = useCombinedSelector(
          selectCount,
          selectName,
          (count, name) => `${name}: ${count}`
        )
        const dispatch = useDispatch()
        return (
          <div style={cardStyle}>
            <h3>useCombinedSelector</h3>
            <p>
              Result:{' '}
              <span style={valueStyle} data-testid="combined">
                {result}
              </span>
            </p>
            <button
              data-testid="update-button"
              style={buttonStyle}
              onClick={() => dispatch({count: 1})}>
              Update
            </button>
          </div>
        )
      }

      const screen = render(
        <StoreProvider>
          <div style={containerStyle}>
            <TestComponent />
          </div>
        </StoreProvider>
      )
      await expect.element(screen.getByTestId('combined')).toHaveTextContent('John: 0')
      await userEvent.click(screen.getByTestId('update-button'))
      await expect.element(screen.getByTestId('combined')).toHaveTextContent('John: 1')
    })
  })

  describe('Browser: Performance characteristics', () => {
    it('Browser: useSelector only re-renders when selected state changes', async () => {
      const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)
      let counterCommits = 0,
        nameCommits = 0

      const Counter = () => (
        <p>
          Count: <span style={valueStyle}>{useSelector(s => s.count)}</span>
        </p>
      )
      const Name = () => (
        <p>
          Name: <span style={valueStyle}>{useSelector(s => s.user.name)}</span>
        </p>
      )
      const Controls = () => {
        const dispatch = useDispatch()
        return (
          <>
            <button
              data-testid="update-count-button"
              style={buttonStyle}
              onClick={() => dispatch({count: store.getState().count + 1})}>
              Update Count
            </button>
            <button
              data-testid="update-name-button"
              style={buttonStyle}
              onClick={() => dispatch({user: {...store.getState().user, name: 'Jane'}})}>
              Update Name
            </button>
          </>
        )
      }

      const screen = render(
        <StoreProvider>
          <div style={containerStyle}>
            <div style={cardStyle}>
              <h3>Selective Re-renders</h3>
              <Profiler
                id="Counter"
                onRender={(_, phase) => {
                  if (phase !== 'nested-update') counterCommits++
                }}>
                <Counter />
              </Profiler>
              <Profiler
                id="Name"
                onRender={(_, phase) => {
                  if (phase !== 'nested-update') nameCommits++
                }}>
                <Name />
              </Profiler>
              <Controls />
            </div>
          </div>
        </StoreProvider>
      )

      expect(counterCommits).toBe(1)
      expect(nameCommits).toBe(1)

      await userEvent.click(screen.getByTestId('update-count-button'))
      expect(counterCommits).toBe(2)
      expect(nameCommits).toBe(1) // Unchanged

      await userEvent.click(screen.getByTestId('update-name-button'))
      expect(nameCommits).toBe(2)
      expect(counterCommits).toBe(2) // Unchanged
    })

    it('Browser: should handle high frequency updates efficiently', async () => {
      const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)
      let commitCount = 0

      function TestComponent() {
        const count = useSelector(state => state.count)
        const dispatch = useDispatch()
        const startRapidUpdates = () => {
          for (let i = 0; i < 10; i++) {
            setTimeout(() => dispatch({count: store.getState().count + 1}), i * 10)
          }
        }

        return (
          <div style={cardStyle}>
            <h3>High Frequency Updates</h3>
            <p>
              Count:{' '}
              <span style={valueStyle} data-testid="count">
                {count}
              </span>
            </p>
            <button
              data-testid="rapid-update-button"
              style={buttonStyle}
              onClick={startRapidUpdates}>
              Start Rapid Updates
            </button>
          </div>
        )
      }

      const screen = render(
        <div style={containerStyle}>
          <Profiler
            id="Test"
            onRender={(_, phase) => {
              if (phase !== 'nested-update') commitCount++
            }}>
            <StoreProvider>
              <TestComponent />
            </StoreProvider>
          </Profiler>
        </div>
      )

      expect(commitCount).toBe(1)
      await userEvent.click(screen.getByTestId('rapid-update-button'))

      await expect.element(screen.getByTestId('count'), {timeout: 2000}).toHaveTextContent('10')
      // Render count should be reasonable, React will batch updates
      expect(commitCount).toBeLessThanOrEqual(11)
    })

    it.skip('Browser: should work efficiently with React.memo', async () => {
      const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)
      let parentCommits = 0,
        memoCommits = 0

      const MemoizedCounter = React.memo(({value}: {value: number}) => (
        <p>
          Memo Count:{' '}
          <span style={valueStyle} data-testid="memo-count">
            {value}
          </span>
        </p>
      ))

      function ParentComponent() {
        const {count, user} = useSelector(s => ({count: s.count, user: s.user}))
        const dispatch = useDispatch()
        return (
          <div style={cardStyle}>
            <h3>React.memo</h3>
            <p>
              Name:{' '}
              <span style={valueStyle} data-testid="name">
                {user.name}
              </span>
            </p>
            <Profiler
              id="Memo"
              onRender={(_, phase) => {
                if (phase !== 'nested-update') memoCommits++
              }}>
              <MemoizedCounter value={count} />
            </Profiler>
            <button
              data-testid="update-name-button"
              style={buttonStyle}
              onClick={() => dispatch({user: {...user, name: 'Jane'}})}>
              Update Name
            </button>
            <button
              data-testid="update-count-button"
              style={buttonStyle}
              onClick={() => dispatch({count: count + 1})}>
              Update Count
            </button>
          </div>
        )
      }

      const screen = render(
        <div style={containerStyle}>
          <StoreProvider>
            <Profiler
              id="Parent"
              onRender={(_, phase) => {
                if (phase !== 'nested-update') parentCommits++
              }}>
              <ParentComponent />
            </Profiler>
          </StoreProvider>
        </div>
      )

      const initialParent = parentCommits
      const initialMemo = memoCommits

      await userEvent.click(screen.getByTestId('update-name-button'))
      await expect.element(screen.getByTestId('name')).toHaveTextContent('Jane')
      expect(parentCommits - initialParent).toBe(1)
      expect(memoCommits - initialMemo).toBe(0) // Should not re-render

      await userEvent.click(screen.getByTestId('update-count-button'))
      await expect.element(screen.getByTestId('memo-count')).toHaveTextContent('1')
      expect(parentCommits - initialParent).toBe(2)
      expect(memoCommits - initialMemo).toBe(1) // Should re-render
    })
  })

  describe('Browser: Context-free hooks', () => {
    it('Browser: should work with multiple stores', async () => {
      const store1 = createStore({count: 1})
      const store2 = createStore({count: 10})
      const useStore1 = useStoreHooks(store1)
      const useStore2 = useStoreHooks(store2)

      function TestComponent() {
        const count1 = useStore1.useSelector(s => s.count)
        const dispatch1 = useStore1.useDispatch()
        const count2 = useStore2.useSelector(s => s.count)
        const dispatch2 = useStore2.useDispatch()
        return (
          <div style={cardStyle}>
            <h3>Multi-Store (Context-Free)</h3>
            <p>
              Store 1:{' '}
              <span style={valueStyle} data-testid="count1">
                {count1}
              </span>
              <button
                data-testid="inc-1-button"
                style={buttonStyle}
                onClick={() => dispatch1({count: count1 + 1})}>
                Inc 1
              </button>
            </p>
            <p>
              Store 2:{' '}
              <span style={valueStyle} data-testid="count2">
                {count2}
              </span>
              <button
                data-testid="inc-2-button"
                style={buttonStyle}
                onClick={() => dispatch2({count: count2 + 1})}>
                Inc 2
              </button>
            </p>
          </div>
        )
      }

      const screen = render(
        <div style={containerStyle}>
          <TestComponent />
        </div>
      )
      await expect.element(screen.getByTestId('count1')).toHaveTextContent('1')
      await expect.element(screen.getByTestId('count2')).toHaveTextContent('10')

      await userEvent.click(screen.getByTestId('inc-1-button'))
      await expect.element(screen.getByTestId('count1')).toHaveTextContent('2')
      await expect.element(screen.getByTestId('count2')).toHaveTextContent('10') // Unchanged

      await userEvent.click(screen.getByTestId('inc-2-button'))
      await expect.element(screen.getByTestId('count2')).toHaveTextContent('11')
      await expect.element(screen.getByTestId('count1')).toHaveTextContent('2') // Unchanged
    })
  })

  describe('Browser: Integration with existing hooks', () => {
    it('Browser: should work with useTransaction', async () => {
      const {StoreProvider, useSelector, useTransaction} = createStoreContext(store)
      function TestComponent() {
        const {count, user} = useSelector(s => ({count: s.count, user: s.user}))
        const transaction = useTransaction()
        const updateBoth = () =>
          transaction(draft => {
            draft.count = count + 1
            draft.user.name = 'Updated'
          })
        return (
          <div style={cardStyle}>
            <h3>useTransaction</h3>
            <p>
              Count:{' '}
              <span style={valueStyle} data-testid="count">
                {count}
              </span>
            </p>
            <p>
              Name:{' '}
              <span style={valueStyle} data-testid="name">
                {user.name}
              </span>
            </p>
            <button data-testid="update-both-button" style={buttonStyle} onClick={updateBoth}>
              Update Both
            </button>
          </div>
        )
      }

      const screen = render(
        <StoreProvider>
          <div style={containerStyle}>
            <TestComponent />
          </div>
        </StoreProvider>
      )
      await userEvent.click(screen.getByTestId('update-both-button'))
      await expect.element(screen.getByTestId('count')).toHaveTextContent('1')
      await expect.element(screen.getByTestId('name')).toHaveTextContent('Updated')
    })

    it('Browser: should work with useBatch', async () => {
      const {StoreProvider, useSelector, useDispatch, useBatch} = createStoreContext(store)
      let commitCount = 0
      function TestComponent() {
        const {count, user} = useSelector(s => ({count: s.count, user: s.user}))
        const dispatch = useDispatch()
        const batch = useBatch()
        const updateBoth = () =>
          batch(() => {
            dispatch({count: count + 1})
            dispatch({user: {...user, name: 'Batched'}})
          })
        return (
          <div style={cardStyle}>
            <h3>useBatch</h3>
            <p>
              Count:{' '}
              <span style={valueStyle} data-testid="count">
                {count}
              </span>
            </p>
            <p>
              Name:{' '}
              <span style={valueStyle} data-testid="name">
                {user.name}
              </span>
            </p>
            <button data-testid="batch-update-button" style={buttonStyle} onClick={updateBoth}>
              Batch Update
            </button>
          </div>
        )
      }

      const screen = render(
        <Profiler
          id="Test"
          onRender={(_, phase) => {
            if (phase !== 'nested-update') commitCount++
          }}>
          <StoreProvider>
            <div style={containerStyle}>
              <TestComponent />
            </div>
          </StoreProvider>
        </Profiler>
      )

      const initialCommits = commitCount
      await userEvent.click(screen.getByTestId('batch-update-button'))
      await expect.element(screen.getByTestId('count')).toHaveTextContent('1')
      await expect.element(screen.getByTestId('name')).toHaveTextContent('Batched')
      expect(commitCount).toBe(initialCommits + 1) // Should only render once
    })
  })
})

describe('Browser: OmitPathsPlugin Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('should omit simple paths from persisted state', async () => {
    interface TestState {
      user: {
        name: string
        email: string
        token: string
      }
      settings: {
        theme: string
        secret: string
      }
    }

    const initialState: TestState = {
      user: {name: 'John', email: 'john@example.com', token: 'secret-token'},
      settings: {theme: 'dark', secret: 'secret-key'},
    }

    const omitPathsPlugin = createOmitPathsPlugin<TestState>([
      ['user', 'token'],
      ['settings', 'secret'],
    ])

    const store = createStore(initialState, {
      persistKey: 'omit-paths-test',
      storageType: StorageType.Local,
      plugins: [omitPathsPlugin],
    })

    const {StoreProvider, useStoreState, useUpdatePath, useBatch} = createStoreContext(store)

    function TestComponent() {
      const state = useStoreState()
      const updatePath = useUpdatePath()
      const batch = useBatch()

      function handleUpdate() {
        updatePath(['user', 'name'], 'Jane')
        updatePath(['user', 'token'], 'new-token')
        updatePath(['settings', 'theme'], 'light')
        updatePath(['settings', 'secret'], 'new-secret')
      }

      function handleClick() {
        batch(handleUpdate)
      }

      return (
        <div style={cardStyle}>
          <h3>OmitPaths - Simple Paths</h3>
          <p>
            Name:{' '}
            <span style={valueStyle} data-testid="name">
              {state.user.name}
            </span>
          </p>
          <p>
            Token:{' '}
            <span style={valueStyle} data-testid="token">
              {state.user.token}
            </span>
          </p>
          <p>
            Theme:{' '}
            <span style={valueStyle} data-testid="theme">
              {state.settings.theme}
            </span>
          </p>
          <p>
            Secret:{' '}
            <span style={valueStyle} data-testid="secret">
              {state.settings.secret}
            </span>
          </p>
          <button style={buttonStyle} data-testid="update-state" onClick={handleClick}>
            Update State
          </button>
        </div>
      )
    }

    const screen = render(
      <StoreProvider>
        <div style={containerStyle}>
          <TestComponent />
        </div>
      </StoreProvider>
    )

    // Update state to trigger persistence
    await userEvent.click(screen.getByTestId('update-state'))

    // Verify React state updates
    await expect.element(screen.getByTestId('name')).toHaveTextContent('Jane')
    await expect.element(screen.getByTestId('token')).toHaveTextContent('new-token')
    await expect.element(screen.getByTestId('theme')).toHaveTextContent('light')
    await expect.element(screen.getByTestId('secret')).toHaveTextContent('new-secret')

    // Verify persistence excludes omitted paths
    const stored = getLocalStorage<TestState>('omit-paths-test')
    expect(stored.data.user.name).toBe('Jane')
    expect(stored.data.user.email).toBe('john@example.com')
    expect(stored.data.settings.theme).toBe('light')

    // Omitted paths should not be in persisted state
    expect(stored.data.user).not.toHaveProperty('token')
    expect(stored.data.settings).not.toHaveProperty('secret')
  })

  it('should handle array paths correctly', async () => {
    interface TestState {
      items: Array<{
        id: number
        name: string
        sensitive: string
      }>
      metadata: {
        created: string
        secret: string
      }
    }

    const initialState: TestState = {
      items: [
        {id: 1, name: 'Item 1', sensitive: 'sensitive-1'},
        {id: 2, name: 'Item 2', sensitive: 'sensitive-2'},
      ],
      metadata: {created: '2023-01-01', secret: 'meta-secret'},
    }

    const omitPathsPlugin = createOmitPathsPlugin<TestState>([
      ['items', 0, 'sensitive'],
      ['metadata', 'secret'],
    ])

    const store = createStore(initialState, {
      persistKey: 'omit-array-paths-test',
      storageType: StorageType.Local,
      plugins: [omitPathsPlugin],
    })

    const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

    function TestComponent() {
      const state = useSelector(s => s)
      const dispatch = useDispatch()

      return (
        <div style={cardStyle}>
          <h3>OmitPaths - Array Paths</h3>
          <p>
            Item 1 Name:{' '}
            <span style={valueStyle} data-testid="item1-name">
              {state.items[0]?.name}
            </span>
          </p>
          <p>
            Item 1 Sensitive:{' '}
            <span style={valueStyle} data-testid="item1-sensitive">
              {state.items[0]?.sensitive}
            </span>
          </p>
          <p>
            Item 2 Sensitive:{' '}
            <span style={valueStyle} data-testid="item2-sensitive">
              {state.items[1]?.sensitive}
            </span>
          </p>
          <p>
            Metadata Created:{' '}
            <span style={valueStyle} data-testid="metadata-created">
              {state.metadata.created}
            </span>
          </p>
          <p>
            Metadata Secret:{' '}
            <span style={valueStyle} data-testid="metadata-secret">
              {state.metadata.secret}
            </span>
          </p>
          <button
            style={buttonStyle}
            data-testid="update-state"
            onClick={() =>
              dispatch({
                items: [
                  {id: 1, name: 'Updated Item 1', sensitive: 'new-sensitive-1'},
                  {id: 2, name: 'Updated Item 2', sensitive: 'new-sensitive-2'},
                ],
                metadata: {created: '2023-12-31', secret: 'new-meta-secret'},
              })
            }>
            Update State
          </button>
        </div>
      )
    }

    const screen = render(
      <StoreProvider>
        <div style={containerStyle}>
          <TestComponent />
        </div>
      </StoreProvider>
    )

    // Update state to trigger persistence
    await userEvent.click(screen.getByTestId('update-state'))

    // Verify React state updates
    await expect.element(screen.getByTestId('item1-name')).toHaveTextContent('Updated Item 1')
    await expect.element(screen.getByTestId('item1-sensitive')).toHaveTextContent('new-sensitive-1')
    await expect.element(screen.getByTestId('item2-sensitive')).toHaveTextContent('new-sensitive-2')
    await expect.element(screen.getByTestId('metadata-created')).toHaveTextContent('2023-12-31')
    await expect.element(screen.getByTestId('metadata-secret')).toHaveTextContent('new-meta-secret')

    // Verify persistence behavior
    const stored = getLocalStorage<TestState>('omit-array-paths-test')
    expect(stored.data.items[0].name).toBe('Updated Item 1')
    expect(stored.data.items[1].name).toBe('Updated Item 2')
    expect(stored.data.items[1].sensitive).toBe('new-sensitive-2') // Only first item's sensitive omitted
    expect(stored.data.metadata.created).toBe('2023-12-31')

    // First item's sensitive and metadata secret should be omitted
    expect(stored.data.items[0]).not.toHaveProperty('sensitive')
    expect(stored.data.metadata).not.toHaveProperty('secret')
  })

  it('should restore state correctly with omitted paths using defaults', async () => {
    interface TestState {
      user: {
        name: string
        email: string
        token: string
      }
      config: {
        apiKey: string
        theme: string
      }
    }

    const omitPathsPlugin = createOmitPathsPlugin<TestState>([
      ['user', 'token'],
      ['config', 'apiKey'],
    ])

    const initialState: TestState = {
      user: {name: 'Default', email: 'default@example.com', token: 'default-token'},
      config: {apiKey: 'default-key', theme: 'default-theme'},
    }

    const store = createStore(initialState, {
      persistKey: 'omit-restore-test',
      storageType: StorageType.Local,
      plugins: [omitPathsPlugin],
    })

    await store.waitForStateLoad()

    // First, update the state with some data
    store.dispatch({
      user: {name: 'Stored User', email: 'stored@example.com', token: 'stored-token'},
      config: {apiKey: 'stored-key', theme: 'stored-theme'},
    })

    // Wait for persistence to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    // Destroy the store and create a new one to test restoration
    store.destroy({clearHistory: true, removePersistedState: false, resetRegistry: true})

    const newStore = createStore(initialState, {
      persistKey: 'omit-restore-test',
      storageType: StorageType.Local,
      plugins: [omitPathsPlugin],
    })

    await newStore.waitForStateLoad()

    // Give React time to process the state change
    await new Promise(resolve => setTimeout(resolve, 50))

    const {StoreProvider, useSelector} = createStoreContext(newStore)

    function TestComponent() {
      const state = useSelector(s => s)

      return (
        <div style={cardStyle}>
          <h3>OmitPaths - State Restoration</h3>
          <p>
            Name:{' '}
            <span style={valueStyle} data-testid="name">
              {state.user.name}
            </span>
          </p>
          <p>
            Email:{' '}
            <span style={valueStyle} data-testid="email">
              {state.user.email}
            </span>
          </p>
          <p>
            Token:{' '}
            <span style={valueStyle} data-testid="token">
              {state.user.token}
            </span>
          </p>
          <p>
            Theme:{' '}
            <span style={valueStyle} data-testid="theme">
              {state.config.theme}
            </span>
          </p>
          <p>
            API Key:{' '}
            <span style={valueStyle} data-testid="api-key">
              {state.config.apiKey}
            </span>
          </p>
        </div>
      )
    }

    const screen = render(
      <StoreProvider>
        <div style={containerStyle}>
          <TestComponent />
        </div>
      </StoreProvider>
    )

    // Use waitFor to ensure state has been properly restored
    await waitFor(
      async () => {
        await expect.element(screen.getByTestId('name')).toHaveTextContent('Stored User')
      },
      {timeout: 3000}
    )

    await waitFor(
      async () => {
        await expect.element(screen.getByTestId('email')).toHaveTextContent('stored@example.com')
      },
      {timeout: 3000}
    )

    await waitFor(
      async () => {
        await expect.element(screen.getByTestId('theme')).toHaveTextContent('stored-theme')
      },
      {timeout: 3000}
    )

    // Omitted values should use default/initial values
    await waitFor(
      async () => {
        await expect.element(screen.getByTestId('token')).toHaveTextContent('default-token')
      },
      {timeout: 3000}
    )

    await waitFor(
      async () => {
        await expect.element(screen.getByTestId('api-key')).toHaveTextContent('default-key')
      },
      {timeout: 3000}
    )

    newStore.destroy({clearHistory: true, removePersistedState: true, resetRegistry: true})
  })

  it('should handle empty paths gracefully', async () => {
    interface TestState {
      count: number
      message: string
    }

    const initialState: TestState = {count: 0, message: 'initial'}

    // Plugin with empty paths should not affect persistence
    const emptyOmitPathsPlugin = createOmitPathsPlugin<TestState>([], 'emptyOmitPlugin')

    const store = createStore(initialState, {
      persistKey: 'empty-omit-paths-test',
      storageType: StorageType.Local,
      plugins: [emptyOmitPathsPlugin],
    })

    const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

    function TestComponent() {
      const state = useSelector(s => s)
      const dispatch = useDispatch()

      return (
        <div style={cardStyle}>
          <h3>OmitPaths - Empty Paths</h3>
          <p>
            Count:{' '}
            <span style={valueStyle} data-testid="count">
              {state.count}
            </span>
          </p>
          <p>
            Message:{' '}
            <span style={valueStyle} data-testid="message">
              {state.message}
            </span>
          </p>
          <button
            style={buttonStyle}
            data-testid="update-state"
            onClick={() => dispatch({count: state.count + 1, message: 'updated'})}>
            Update State
          </button>
        </div>
      )
    }

    const screen = render(
      <StoreProvider>
        <div style={containerStyle}>
          <TestComponent />
        </div>
      </StoreProvider>
    )

    await userEvent.click(screen.getByTestId('update-state'))

    await expect.element(screen.getByTestId('count')).toHaveTextContent('1')
    await expect.element(screen.getByTestId('message')).toHaveTextContent('updated')

    // All state should be persisted when no paths are omitted
    const stored = getLocalStorage<TestState>('empty-omit-paths-test')
    expect(stored.data.count).toBe(1)
    expect(stored.data.message).toBe('updated')
  })

  it('should handle nested array structures', async () => {
    interface TestState {
      departments: Array<{
        name: string
        employees: Array<{
          id: number
          name: string
          salary: number
        }>
      }>
    }

    const initialState: TestState = {
      departments: [
        {
          name: 'Engineering',
          employees: [
            {id: 1, name: 'Alice', salary: 100000},
            {id: 2, name: 'Bob', salary: 120000},
          ],
        },
        {
          name: 'Marketing',
          employees: [{id: 3, name: 'Carol', salary: 90000}],
        },
      ],
    }

    const omitPathsPlugin = createOmitPathsPlugin<TestState>([
      ['departments', 0, 'employees', 0, 'salary'],
      ['departments', 1, 'employees', 0, 'salary'],
    ])

    const store = createStore(initialState, {
      persistKey: 'nested-array-omit-test',
      storageType: StorageType.Local,
      plugins: [omitPathsPlugin],
    })

    const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

    function TestComponent() {
      const state = useSelector(s => s)
      const dispatch = useDispatch()

      return (
        <div style={cardStyle}>
          <h3>OmitPaths - Nested Arrays</h3>
          <p>
            Alice Salary:{' '}
            <span style={valueStyle} data-testid="alice-salary">
              {state.departments[0]?.employees[0]?.salary}
            </span>
          </p>
          <p>
            Bob Salary:{' '}
            <span style={valueStyle} data-testid="bob-salary">
              {state.departments[0]?.employees[1]?.salary}
            </span>
          </p>
          <p>
            Carol Salary:{' '}
            <span style={valueStyle} data-testid="carol-salary">
              {state.departments[1]?.employees[0]?.salary}
            </span>
          </p>
          <button
            style={buttonStyle}
            data-testid="update-salaries"
            onClick={() =>
              dispatch({
                departments: [
                  {
                    name: 'Engineering',
                    employees: [
                      {id: 1, name: 'Alice', salary: 110000},
                      {id: 2, name: 'Bob', salary: 130000},
                    ],
                  },
                  {
                    name: 'Marketing',
                    employees: [{id: 3, name: 'Carol', salary: 95000}],
                  },
                ],
              })
            }>
            Update Salaries
          </button>
        </div>
      )
    }

    const screen = render(
      <StoreProvider>
        <div style={containerStyle}>
          <TestComponent />
        </div>
      </StoreProvider>
    )

    await userEvent.click(screen.getByTestId('update-salaries'))

    // Verify React state updates
    await expect.element(screen.getByTestId('alice-salary')).toHaveTextContent('110000')
    await expect.element(screen.getByTestId('bob-salary')).toHaveTextContent('130000')
    await expect.element(screen.getByTestId('carol-salary')).toHaveTextContent('95000')

    // Verify persistence behavior
    const stored = getLocalStorage<TestState>('nested-array-omit-test')
    expect(stored.data.departments[0].name).toBe('Engineering')
    expect(stored.data.departments[0].employees[0].name).toBe('Alice')
    expect(stored.data.departments[0].employees[1].name).toBe('Bob')
    expect(stored.data.departments[0].employees[1].salary).toBe(130000) // Bob's salary should be preserved
    expect(stored.data.departments[1].employees[0].name).toBe('Carol')

    // Alice's and Carol's salaries should be omitted
    expect(stored.data.departments[0].employees[0]).not.toHaveProperty('salary')
    expect(stored.data.departments[1].employees[0]).not.toHaveProperty('salary')
  })

  it('should work with multiple plugins', async () => {
    interface TestState {
      user: {
        name: string
        token: string
        settings: {
          theme: string
          apiKey: string
        }
      }
      debug: {
        enabled: boolean
        logs: string[]
      }
    }

    const initialState: TestState = {
      user: {
        name: 'John',
        token: 'secret-token',
        settings: {theme: 'dark', apiKey: 'api-secret'},
      },
      debug: {enabled: true, logs: ['log1', 'log2']},
    }

    // Multiple plugins working together
    const omitSecretsPlugin = createOmitPathsPlugin<TestState>(
      [
        ['user', 'token'],
        ['user', 'settings', 'apiKey'],
      ],
      'omitSecrets'
    )

    const omitDebugPlugin = createOmitPathsPlugin<TestState>([['debug', 'logs']], 'omitDebugLogs')

    const store = createStore(initialState, {
      persistKey: 'multiple-plugins-test',
      storageType: StorageType.Local,
      plugins: [omitSecretsPlugin, omitDebugPlugin],
    })

    const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

    function TestComponent() {
      const state = useSelector(s => s)
      const dispatch = useDispatch()

      return (
        <div style={cardStyle}>
          <h3>OmitPaths - Multiple Plugins</h3>
          <p>
            Name:{' '}
            <span style={valueStyle} data-testid="name">
              {state.user.name}
            </span>
          </p>
          <p>
            Token:{' '}
            <span style={valueStyle} data-testid="token">
              {state.user.token}
            </span>
          </p>
          <p>
            Theme:{' '}
            <span style={valueStyle} data-testid="theme">
              {state.user.settings.theme}
            </span>
          </p>
          <p>
            API Key:{' '}
            <span style={valueStyle} data-testid="api-key">
              {state.user.settings.apiKey}
            </span>
          </p>
          <p>
            Debug Enabled:{' '}
            <span style={valueStyle} data-testid="debug-enabled">
              {state.debug.enabled.toString()}
            </span>
          </p>
          <p>
            Logs Count:{' '}
            <span style={valueStyle} data-testid="logs-count">
              {state.debug.logs.length}
            </span>
          </p>
          <button
            style={buttonStyle}
            data-testid="update-state"
            onClick={() =>
              dispatch({
                user: {
                  name: 'Jane',
                  token: 'new-secret-token',
                  settings: {theme: 'light', apiKey: 'new-api-secret'},
                },
                debug: {enabled: false, logs: ['log1', 'log2', 'log3']},
              })
            }>
            Update State
          </button>
        </div>
      )
    }

    const screen = render(
      <StoreProvider>
        <div style={containerStyle}>
          <TestComponent />
        </div>
      </StoreProvider>
    )

    await userEvent.click(screen.getByTestId('update-state'))

    // Verify React state updates
    await expect.element(screen.getByTestId('name')).toHaveTextContent('Jane')
    await expect.element(screen.getByTestId('token')).toHaveTextContent('new-secret-token')
    await expect.element(screen.getByTestId('theme')).toHaveTextContent('light')
    await expect.element(screen.getByTestId('api-key')).toHaveTextContent('new-api-secret')
    await expect.element(screen.getByTestId('debug-enabled')).toHaveTextContent('false')
    await expect.element(screen.getByTestId('logs-count')).toHaveTextContent('3')

    // Verify persistence behavior with multiple plugins
    const stored = getLocalStorage<TestState>('multiple-plugins-test')
    expect(stored.data.user.name).toBe('Jane')
    expect(stored.data.user.settings.theme).toBe('light')
    expect(stored.data.debug.enabled).toBe(false)

    // All omitted paths should be missing
    expect(stored.data.user).not.toHaveProperty('token')
    expect(stored.data.user.settings).not.toHaveProperty('apiKey')
    expect(stored.data.debug).not.toHaveProperty('logs')
  })

  // --- Advanced Edge Case Tests for Robustness ---

  it('should handle concurrent state updates with omitted paths', async () => {
    interface TestState {
      counter: number
      sensitive: {
        token: string
        refreshToken: string
      }
      public: {
        userName: string
        lastActivity: number
      }
    }

    const initialState: TestState = {
      counter: 0,
      sensitive: {token: 'initial-token', refreshToken: 'initial-refresh'},
      public: {userName: 'user', lastActivity: Date.now()},
    }

    const omitPathsPlugin = createOmitPathsPlugin<TestState>([
      ['sensitive', 'token'],
      ['sensitive', 'refreshToken'],
    ])

    const store = createStore(initialState, {
      persistKey: 'concurrent-updates-test',
      storageType: StorageType.Local,
      plugins: [omitPathsPlugin],
    })

    const {StoreProvider, useSelector, useDispatch, useBatch} = createStoreContext(store)

    function TestComponent() {
      const state = useSelector(s => s)
      const dispatch = useDispatch()
      const batch = useBatch()

      const handleConcurrentUpdates = () => {
        // Simulate rapid concurrent updates
        batch(() => {
          for (let i = 0; i < 50; i++) {
            dispatch({
              counter: state.counter + i,
              sensitive: {
                token: `token-${i}`,
                refreshToken: `refresh-${i}`,
              },
              public: {
                userName: `user-${i}`,
                lastActivity: Date.now() + i,
              },
            })
          }
        })
      }

      return (
        <div style={cardStyle}>
          <h3>OmitPaths - Concurrent Updates</h3>
          <p>
            Counter: <span data-testid="counter">{state.counter}</span>
          </p>
          <p>
            Token: <span data-testid="token">{state.sensitive.token}</span>
          </p>
          <p>
            Username: <span data-testid="username">{state.public.userName}</span>
          </p>
          <button
            style={buttonStyle}
            data-testid="concurrent-updates"
            onClick={handleConcurrentUpdates}>
            Run Concurrent Updates
          </button>
        </div>
      )
    }

    const screen = render(
      <StoreProvider>
        <TestComponent />
      </StoreProvider>
    )

    await userEvent.click(screen.getByTestId('concurrent-updates'))

    // Wait for all updates to complete
    await waitFor(() => {
      expect(screen.getByTestId('counter')).toHaveTextContent('49')
    })

    // Verify final state consistency
    const stored = getLocalStorage<TestState>('concurrent-updates-test')
    expect(stored.data.counter).toBe(49)
    expect(stored.data.public.userName).toBe('user-49')
    expect(stored.data.sensitive).not.toHaveProperty('token')
    expect(stored.data.sensitive).not.toHaveProperty('refreshToken')
  })

  it('should handle array mutations and index shifting correctly', async () => {
    interface TestState {
      users: Array<{
        id: number
        name: string
        email: string
        password: string
        roles: string[]
      }>
    }

    const initialState: TestState = {
      users: [
        {
          id: 1,
          name: 'Alice',
          email: 'alice@test.com',
          password: 'secret1',
          roles: ['admin', 'user'],
        },
        {id: 2, name: 'Bob', email: 'bob@test.com', password: 'secret2', roles: ['user']},
        {id: 3, name: 'Carol', email: 'carol@test.com', password: 'secret3', roles: ['moderator']},
      ],
    }

    // Omit passwords from all users using wildcard pattern
    const omitPathsPlugin = createOmitPathsPlugin<TestState>([['users', '*', 'password']])

    const store = createStore(initialState, {
      persistKey: 'array-mutations-test',
      storageType: StorageType.Local,
      plugins: [omitPathsPlugin],
    })

    const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

    function TestComponent() {
      const state = useSelector(s => s)
      const dispatch = useDispatch()

      const handleArrayMutations = () => {
        // Remove middle user (Bob) - this shifts indices
        const newUsers = state.users.filter(user => user.id !== 2)
        // Add new user at end
        newUsers.push({
          id: 4,
          name: 'David',
          email: 'david@test.com',
          password: 'secret4',
          roles: ['user'],
        })
        // Update first user's password
        newUsers[0] = {...newUsers[0], password: 'new-secret1'}

        dispatch({users: newUsers})
      }

      return (
        <div style={cardStyle}>
          <h3>OmitPaths - Array Mutations</h3>
          <p>
            Users Count: <span data-testid="users-count">{state.users.length}</span>
          </p>
          <p>
            First User: <span data-testid="first-user">{state.users[0]?.name}</span>
          </p>
          <p>
            First Password: <span data-testid="first-password">{state.users[0]?.password}</span>
          </p>
          <p>
            Last User:{' '}
            <span data-testid="last-user">{state.users[state.users.length - 1]?.name}</span>
          </p>
          <button style={buttonStyle} data-testid="mutate-arrays" onClick={handleArrayMutations}>
            Mutate Arrays
          </button>
        </div>
      )
    }

    const screen = render(
      <StoreProvider>
        <TestComponent />
      </StoreProvider>
    )

    await userEvent.click(screen.getByTestId('mutate-arrays'))

    await waitFor(() => {
      expect(screen.getByTestId('users-count')).toHaveTextContent('3')
      expect(screen.getByTestId('first-user')).toHaveTextContent('Alice')
      expect(screen.getByTestId('last-user')).toHaveTextContent('David')
    })

    // Check persistence - all user passwords should be omitted due to wildcard
    const stored = getLocalStorage<TestState>('array-mutations-test')
    expect(stored.data.users).toHaveLength(3)
    expect(stored.data.users[0].name).toBe('Alice')
    expect(stored.data.users[1].name).toBe('Carol') // Bob was removed, Carol shifted down
    expect(stored.data.users[2].name).toBe('David')

    // All users should have passwords omitted due to wildcard pattern
    expect(stored.data.users[0]).not.toHaveProperty('password')
    expect(stored.data.users[1]).not.toHaveProperty('password')
    expect(stored.data.users[2]).not.toHaveProperty('password')
  })

  it('should handle malformed persisted data recovery', async () => {
    interface TestState {
      user: {name: string; settings: {theme: string; secret: string}}
      data: {items: number[]}
    }

    const initialState: TestState = {
      user: {name: 'Default', settings: {theme: 'light', secret: 'default-secret'}},
      data: {items: [1, 2, 3]},
    }

    // Manually inject malformed data into storage
    const malformedData = {
      data: {
        user: {name: 'Corrupted'}, // Missing settings object
        data: 'not-an-object', // Wrong type
      },
      meta: {
        lastUpdated: Date.now(),
        sessionId: 'test-session',
        storeName: 'TestStore',
      },
    }
    localStorage.setItem('malformed-recovery-test', JSON.stringify(malformedData))

    const omitPathsPlugin = createOmitPathsPlugin<TestState>(
      [['user', 'settings', 'secret']],
      'omitPathsPlugin',
      initialState // Pass the initial state to the plugin
    )

    const store = createStore(initialState, {
      persistKey: 'malformed-recovery-test',
      storageType: StorageType.Local,
      plugins: [omitPathsPlugin],
    })

    await store.waitForStateLoad()

    const {StoreProvider, useSelector} = createStoreContext(store)

    function TestComponent() {
      const state = useSelector(s => s)
      return (
        <div style={cardStyle}>
          <h3>OmitPaths - Malformed Data Recovery</h3>
          <p>
            Name: <span data-testid="name">{state.user.name}</span>
          </p>
          <p>
            Theme: <span data-testid="theme">{state.user.settings?.theme || 'default'}</span>
          </p>
          <p>
            Secret: <span data-testid="secret">{state.user.settings?.secret || 'default'}</span>
          </p>
          <p>
            Items:{' '}
            <span data-testid="items">
              {Array.isArray(state.data?.items) ? state.data.items.join(', ') : 'no items'}
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

    // Should gracefully fall back to initial state for malformed parts
    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('light')
      expect(screen.getByTestId('secret')).toHaveTextContent('default-secret')
      expect(screen.getByTestId('items')).toHaveTextContent('1, 2, 3')
    })
  })

  it('should handle storage quota exceeded scenarios', async () => {
    interface TestState {
      largeData: string
      metadata: {secret: string; timestamp: number}
    }

    const initialState: TestState = {
      largeData: 'initial',
      metadata: {secret: 'secret-key', timestamp: Date.now()},
    }

    const omitPathsPlugin = createOmitPathsPlugin<TestState>([['metadata', 'secret']])

    const store = createStore(initialState, {
      persistKey: 'quota-exceeded-test',
      storageType: StorageType.Local,
      plugins: [omitPathsPlugin],
      onError: vi.fn(), // Mock error handler
    })

    const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

    function TestComponent() {
      const state = useSelector(s => s)
      const dispatch = useDispatch()

      const handleLargeDataUpdate = () => {
        // Try to store very large data that might exceed quota
        const largeString = 'x'.repeat(10 * 1024 * 1024) // 10MB string
        dispatch({
          largeData: largeString,
          metadata: {secret: 'new-secret', timestamp: Date.now()},
        })
      }

      return (
        <div style={cardStyle}>
          <h3>OmitPaths - Storage Quota</h3>
          <p>
            Data Length: <span data-testid="data-length">{state.largeData.length}</span>
          </p>
          <p>
            Secret: <span data-testid="secret">{state.metadata.secret}</span>
          </p>
          <button style={buttonStyle} data-testid="large-update" onClick={handleLargeDataUpdate}>
            Update Large Data
          </button>
        </div>
      )
    }

    const screen = render(
      <StoreProvider>
        <TestComponent />
      </StoreProvider>
    )

    // This should not crash the app even if storage fails
    await userEvent.click(screen.getByTestId('large-update'))

    // State should still be updated in memory
    await waitFor(() => {
      expect(screen.getByTestId('secret')).toHaveTextContent('new-secret')
    })

    // App should continue working despite storage errors
    expect(screen.getByTestId('data-length')).toBeInTheDocument()
  })

  it('should handle cross-tab synchronization with omitted paths', async () => {
    interface TestState {
      shared: {count: number; message: string}
      private: {token: string; sessionData: any}
    }

    const initialState: TestState = {
      shared: {count: 0, message: 'initial'},
      private: {token: 'secret-token', sessionData: {userId: 123}},
    }

    const omitPathsPlugin = createOmitPathsPlugin<TestState>([
      ['private', 'token'],
      ['private', 'sessionData'],
    ])

    const store = createStore(initialState, {
      persistKey: 'cross-tab-sync-test',
      storageType: StorageType.Local,
      syncAcrossTabs: true,
      plugins: [omitPathsPlugin],
    })

    const {StoreProvider, useSelector} = createStoreContext(store)

    function TestComponent() {
      const state = useSelector(s => s)
      return (
        <div style={cardStyle}>
          <h3>OmitPaths - Cross-Tab Sync</h3>
          <p>
            Count: <span data-testid="count">{state.shared.count}</span>
          </p>
          <p>
            Message: <span data-testid="message">{state.shared.message}</span>
          </p>
          <p>
            Token: <span data-testid="token">{state.private.token}</span>
          </p>
        </div>
      )
    }

    const screen = render(
      <StoreProvider>
        <TestComponent />
      </StoreProvider>
    )

    await expect.element(screen.getByTestId('count')).toHaveTextContent('0')
    await expect.element(screen.getByTestId('token')).toHaveTextContent('secret-token')

    // Simulate external tab updating storage (without omitted paths)
    const externalUpdate = {
      data: {
        shared: {count: 42, message: 'external-update'},
        private: {}, // External update doesn't include omitted paths
      },
      meta: {lastUpdated: Date.now(), sessionId: 'external-tab', storeName: 'TestStore'},
    }
    setLocalStorage('cross-tab-sync-test', externalUpdate)

    // Trigger storage event
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'cross-tab-sync-test',
        newValue: JSON.stringify(externalUpdate),
      })
    )

    // Shared data should sync, private data should preserve original values
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('42')
      expect(screen.getByTestId('message')).toHaveTextContent('external-update')
      expect(screen.getByTestId('token')).toHaveTextContent('secret-token') // Should preserve original
    })
  })

  it('should handle plugin conflicts and precedence', async () => {
    interface TestState {
      user: {name: string; email: string; password: string}
      settings: {theme: string; secret: string}
    }

    const initialState: TestState = {
      user: {name: 'John', email: 'john@test.com', password: 'secret'},
      settings: {theme: 'dark', secret: 'api-key'},
    }

    // Two plugins trying to omit overlapping paths
    const plugin1 = createOmitPathsPlugin<TestState>([['user', 'password']], 'plugin1')
    const plugin2 = createOmitPathsPlugin<TestState>(
      [
        ['user', 'password'],
        ['settings', 'secret'],
      ],
      'plugin2'
    )

    const store = createStore(initialState, {
      persistKey: 'plugin-conflicts-test',
      storageType: StorageType.Local,
      plugins: [plugin1, plugin2], // plugin2 should take precedence for overlapping paths
    })

    const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

    function TestComponent() {
      const state = useSelector(s => s)
      const dispatch = useDispatch()

      return (
        <div style={cardStyle}>
          <h3>OmitPaths - Plugin Conflicts</h3>
          <p>
            Password: <span data-testid="password">{state.user.password}</span>
          </p>
          <p>
            Secret: <span data-testid="secret">{state.settings.secret}</span>
          </p>
          <button
            style={buttonStyle}
            data-testid="update-secrets"
            onClick={() =>
              dispatch({
                user: {...state.user, password: 'new-password'},
                settings: {...state.settings, secret: 'new-secret'},
              })
            }>
            Update Secrets
          </button>
        </div>
      )
    }

    const screen = render(
      <StoreProvider>
        <TestComponent />
      </StoreProvider>
    )

    await userEvent.click(screen.getByTestId('update-secrets'))

    await waitFor(() => {
      expect(screen.getByTestId('password')).toHaveTextContent('new-password')
      expect(screen.getByTestId('secret')).toHaveTextContent('new-secret')
    })

    // Both plugins should have processed the data
    const stored = getLocalStorage<TestState>('plugin-conflicts-test')
    expect(stored.data.user.name).toBe('John')
    expect(stored.data.user.email).toBe('john@test.com')
    expect(stored.data.settings.theme).toBe('dark')

    // Both paths should be omitted (plugin2 handles both)
    expect(stored.data.user).not.toHaveProperty('password')
    expect(stored.data.settings).not.toHaveProperty('secret')
  })

  it('should handle performance with large state objects', async () => {
    interface TestState {
      largeArray: Array<{id: number; data: string; secret?: string}>
      metadata: {created: number; sensitive: string}
    }

    // Create large initial state
    const largeArray = Array.from({length: 1000}, (_, i) => ({
      id: i,
      data: `data-${i}`,
      secret: `secret-${i}`,
    }))

    const initialState: TestState = {
      largeArray,
      metadata: {created: Date.now(), sensitive: 'sensitive-data'},
    }

    // Omit sensitive data from metadata only
    const omitPathsPlugin = createOmitPathsPlugin<TestState>([['metadata', 'sensitive']])

    const startTime = performance.now()

    const store = createStore(initialState, {
      persistKey: 'performance-test',
      storageType: StorageType.Local,
      plugins: [omitPathsPlugin],
    })

    const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

    function TestComponent() {
      const state = useSelector(s => s)
      const dispatch = useDispatch()

      const handleLargeUpdate = () => {
        const updateStart = performance.now()
        // Update a subset of the large array
        const newArray = state.largeArray.map(item =>
          item.id < 100 ? {...item, data: `updated-${item.id}`} : item
        )
        dispatch({
          largeArray: newArray,
          metadata: {...state.metadata, sensitive: 'new-sensitive'},
        })
        const updateEnd = performance.now()
        console.log(`Large update took: ${updateEnd - updateStart}ms`)
      }

      return (
        <div style={cardStyle}>
          <h3>OmitPaths - Performance Test</h3>
          <p>
            Array Length: <span data-testid="array-length">{state.largeArray.length}</span>
          </p>
          <p>
            First Item: <span data-testid="first-item">{state.largeArray[0]?.data}</span>
          </p>
          <p>
            Sensitive: <span data-testid="sensitive">{state.metadata.sensitive}</span>
          </p>
          <button style={buttonStyle} data-testid="large-update" onClick={handleLargeUpdate}>
            Update Large State
          </button>
        </div>
      )
    }

    const screen = render(
      <StoreProvider>
        <TestComponent />
      </StoreProvider>
    )

    const initTime = performance.now() - startTime
    expect(initTime).toBeLessThan(1000) // Initialization should be fast

    await userEvent.click(screen.getByTestId('large-update'))

    await waitFor(() => {
      expect(screen.getByTestId('first-item')).toHaveTextContent('updated-0')
      expect(screen.getByTestId('sensitive')).toHaveTextContent('new-sensitive')
    })

    // Verify large state is properly persisted with omissions
    const stored = getLocalStorage<TestState>('performance-test')
    expect(stored.data.largeArray).toHaveLength(1000)
    expect(stored.data.largeArray[0].data).toBe('updated-0')
    expect(stored.data.largeArray[999].data).toBe('data-999')
    expect(stored.data.metadata).not.toHaveProperty('sensitive')
  })

  it('should provide proper TypeScript path validation', async () => {
    interface TestState {
      user: {name: string; email: string}
      settings: {theme: string}
    }

    const initialState: TestState = {
      user: {name: 'John', email: 'john@test.com'},
      settings: {theme: 'dark'},
    }

    // These should be valid paths (no TS errors)
    const validPlugin = createOmitPathsPlugin<TestState>([
      ['user', 'name'],
      ['user', 'email'],
      ['settings', 'theme'],
    ])

    const store = createStore(initialState, {
      persistKey: 'typescript-validation-test',
      storageType: StorageType.Local,
      plugins: [validPlugin],
    })

    // Basic functionality test to ensure plugin works
    store.dispatch({user: {name: 'Jane', email: 'jane@test.com'}, settings: {theme: 'light'}})

    await new Promise(resolve => setTimeout(resolve, 100))

    const stored = getLocalStorage<TestState>('typescript-validation-test')
    expect(stored.data.settings).not.toHaveProperty('theme')
    expect(stored.data.user).not.toHaveProperty('name')
    expect(stored.data.user).not.toHaveProperty('email')
  })
})

describe('Browser: useAsyncThunk Stability Tests', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('should return stable references and prevent double execution', async () => {
    interface TestState {
      data: string[]
      loading: boolean
    }

    const initialState: TestState = {
      data: [],
      loading: false,
    }

    const store = createStore(initialState)
    const {StoreProvider, useAsyncThunk, useSelector} = createStoreContext(store)

    // Mock thunk that we'll track calls to
    const mockThunk = vi.fn(async (ctx: {getState: () => TestState; dispatch: any}) => {
      await new Promise(resolve => setTimeout(resolve, 50)) // Simulate async work
      const newData = ['item1', 'item2', 'item3']
      ctx.dispatch({data: newData})
      return newData
    }) as Thunk<TestState, Promise<string[]>>

    let executeCallCount = 0
    let renderCount = 0

    function TestComponent() {
      renderCount++
      const {execute, loading, error} = useAsyncThunk()
      const data = useSelector(state => state.data)

      // Track how many times execute function reference changes
      React.useEffect(() => {
        executeCallCount++
      }, [execute])

      // Execute thunk on mount
      React.useEffect(() => {
        execute(mockThunk)
      }, [execute])

      return (
        <div>
          <div data-testid="render-count">{renderCount}</div>
          <div data-testid="execute-count">{executeCallCount}</div>
          <div data-testid="loading">{loading.toString()}</div>
          <div data-testid="error">{error?.message || 'null'}</div>
          <div data-testid="data">{data.join(',')}</div>
        </div>
      )
    }

    function App() {
      return (
        <StoreProvider>
          <TestComponent />
        </StoreProvider>
      )
    }

    render(<App />)

    // Wait for async thunk to complete
    await waitFor(async () => {
      await expect.element(screen.getByTestId('data')).toHaveTextContent('item1,item2,item3')
    })

    // Verify the mock thunk was only called once
    expect(mockThunk).toHaveBeenCalledTimes(1)

    // Verify execute function reference was stable (should only change once on mount)
    await expect.element(screen.getByTestId('execute-count')).toHaveTextContent('1')

    // Component should render a reasonable number of times
    // (Not verifying exact count as React may batch updates differently)
  })

  it('should work correctly with useStoreHooks (no context)', async () => {
    interface TestState {
      value: number
    }

    const store = createStore<TestState>({value: 0})

    const mockThunk = vi.fn(async (ctx: {getState: () => TestState; dispatch: any}) => {
      await new Promise(resolve => setTimeout(resolve, 30))
      const state = ctx.getState()
      const newValue = state.value + 10
      ctx.dispatch({value: newValue})
      return newValue
    }) as Thunk<TestState, Promise<number>>

    let executeReferenceChanges = 0

    function TestComponent() {
      const {useAsyncThunk, useSelector} = useStoreHooks(store)
      const {execute, loading, error} = useAsyncThunk()
      const value = useSelector(state => state.value)

      // Track execute reference stability
      React.useEffect(() => {
        executeReferenceChanges++
      }, [execute])

      const handleClick = () => {
        execute(mockThunk)
      }

      return (
        <div>
          <div data-testid="value">{value}</div>
          <div data-testid="loading">{loading.toString()}</div>
          <div data-testid="execute-changes">{executeReferenceChanges}</div>
          <button data-testid="execute-btn" onClick={handleClick}>
            Execute
          </button>
        </div>
      )
    }

    render(<TestComponent />)

    // Initial state
    await expect.element(screen.getByTestId('value')).toHaveTextContent('0')
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false')

    // Click to execute thunk
    await userEvent.click(screen.getByTestId('execute-btn'))

    // Wait for completion
    await waitFor(async () => {
      await expect.element(screen.getByTestId('value')).toHaveTextContent('10')
      await expect.element(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    // Verify stable references (should only change once on mount)
    await expect.element(screen.getByTestId('execute-changes')).toHaveTextContent('1')
    expect(mockThunk).toHaveBeenCalledTimes(1)
  })

  it('should provide stable references in React.StrictMode (but allow intentional double execution)', async () => {
    interface TestState {
      callCount: number
      data: string[]
    }

    const initialState: TestState = {
      callCount: 0,
      data: [],
    }

    const store = createStore(initialState)
    const {StoreProvider, useAsyncThunk, useSelector} = createStoreContext(store)

    // Track mock calls separately
    let mockCallCount = 0

    // Mock thunk that increments a counter to track actual calls
    const mockThunk = vi.fn(async (ctx: {getState: () => TestState; dispatch: any}) => {
      mockCallCount++
      const state = ctx.getState()
      const newCallCount = state.callCount + 1
      const newData = [`call-${newCallCount}`]

      ctx.dispatch({
        callCount: newCallCount,
        data: [...state.data, ...newData],
      })

      return newData
    }) as Thunk<TestState, Promise<string[]>>

    let executeCallCount = 0

    function TestComponent() {
      const {execute, loading, error} = useAsyncThunk()
      const {callCount, data} = useSelector(state => state)

      // Track how many times execute function reference changes
      React.useEffect(() => {
        executeCallCount++
      }, [execute])

      // Execute thunk on mount (StrictMode will intentionally call this twice)
      React.useEffect(() => {
        execute(mockThunk)
      }, [execute])

      return (
        <div>
          <div data-testid="execute-ref-changes">{executeCallCount}</div>
          <div data-testid="store-call-count">{callCount}</div>
          <div data-testid="mock-call-count">{mockCallCount}</div>
          <div data-testid="data-length">{data.length}</div>
          <div data-testid="loading">{loading.toString()}</div>
          <div data-testid="error">{error?.message || 'null'}</div>
        </div>
      )
    }

    function App() {
      return (
        <React.StrictMode>
          <StoreProvider>
            <TestComponent />
          </StoreProvider>
        </React.StrictMode>
      )
    }

    render(<App />)

    // Wait for async thunk to complete (expecting 2 calls due to StrictMode)
    await waitFor(async () => {
      await expect.element(screen.getByTestId('store-call-count')).toHaveTextContent('2')
    })

    // StrictMode intentionally causes double execution - this is expected behavior
    await expect.element(screen.getByTestId('mock-call-count')).toHaveTextContent('2')
    await expect.element(screen.getByTestId('store-call-count')).toHaveTextContent('2')
    await expect.element(screen.getByTestId('data-length')).toHaveTextContent('2')

    // Our fix ensures execute function reference changes are minimized
    // In StrictMode, effects run twice, but our useAsyncThunk should still provide
    // stable references within each render cycle
    await expect.element(screen.getByTestId('execute-ref-changes')).toHaveTextContent('2')

    // The mock should be called exactly twice (once per StrictMode effect run)
    expect(mockThunk).toHaveBeenCalledTimes(2)
  })
})
