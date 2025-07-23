/// <reference types="@vitest/browser/matchers" />
/// <reference types="@testing-library/jest-dom" />
import {afterEach, beforeEach, describe, expect, it, vi, beforeAll, afterAll} from 'vitest'
import {cleanup} from '@testing-library/react'
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
    const stored = getLocalStorage('react-browser-test', {} as PersistedState<{count: number}>)
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
    const finalStored = getLocalStorage('react-provider-test', {} as PersistedState<State>)
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

interface TestState {
  count: number
  user: {name: string; email: string}
  nested: {deep: {value: string}}
}

describe('Browser: useSyncExternalStore Integration Functionality', () => {
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
