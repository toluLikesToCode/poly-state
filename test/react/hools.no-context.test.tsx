/**
 * @fileoverview Tests for context-free React hooks
 *
 * This test file verifies that the useStoreHooks function provides
 * all the same functionality as createStoreContext but without
 * requiring a context provider.
 */

import {describe, it, expect, beforeEach} from 'vitest'
import {render, screen, fireEvent, waitFor} from '@testing-library/react'
import {createStore} from '../../src/index'
import {useStoreHooks} from '../../src/react'

interface TestState {
  count: number
  user: {
    name: string
    email: string
  }
  loading: boolean
}

describe('Context-Free React Integration', () => {
  let store: ReturnType<typeof createStore<TestState>>

  beforeEach(() => {
    store = createStore<TestState>(
      {
        count: 0,
        user: {
          name: '',
          email: '',
        },
        loading: false,
      },
      {
        historyLimit: 50,
      }
    )
  })

  it('should provide all hooks without context', () => {
    function TestComponent() {
      const hooks = useStoreHooks(store)

      // Verify all expected hooks are available
      expect(hooks.useSelector).toBeDefined()
      expect(hooks.useDispatch).toBeDefined()
      expect(hooks.useStoreState).toBeDefined()
      expect(hooks.useStoreValue).toBeDefined()
      expect(hooks.useTransaction).toBeDefined()
      expect(hooks.useBatch).toBeDefined()
      expect(hooks.useUpdatePath).toBeDefined()
      expect(hooks.useStoreHistory).toBeDefined()
      expect(hooks.useThunk).toBeDefined()
      expect(hooks.useAsyncThunk).toBeDefined()
      expect(hooks.useStoreEffect).toBeDefined()
      expect(hooks.useSubscribeTo).toBeDefined()
      expect(hooks.useSubscribeToPath).toBeDefined()
      expect(hooks.useCombinedSelector).toBeDefined()

      return <div data-testid="hooks-available">Hooks Available</div>
    }

    render(<TestComponent />)
    expect(screen.getByTestId('hooks-available')).toBeDefined()
  })

  it('should work with useSelector and useDispatch', () => {
    function Counter() {
      const {useSelector, useDispatch} = useStoreHooks(store)
      const count = useSelector(state => state.count)
      const dispatch = useDispatch()

      return (
        <div>
          <span data-testid="count">{count}</span>
          <button onClick={() => dispatch({count: count + 1})} data-testid="increment">
            +
          </button>
        </div>
      )
    }

    render(<Counter />)

    expect(screen.getByTestId('count').textContent).toBe('0')

    fireEvent.click(screen.getByTestId('increment'))
    expect(screen.getByTestId('count').textContent).toBe('1')

    fireEvent.click(screen.getByTestId('increment'))
    expect(screen.getByTestId('count').textContent).toBe('2')
  })

  it('should work with useStoreValue for path-based access', () => {
    function UserProfile() {
      const {useStoreValue, useTransaction} = useStoreHooks(store)
      const userName = useStoreValue<string>('user.name')
      const userEmail = useStoreValue<string>('user.email')
      const transaction = useTransaction()

      const updateUser = () => {
        transaction(draft => {
          draft.user.name = 'John Doe'
          draft.user.email = 'john@example.com'
        })
      }

      return (
        <div>
          <span data-testid="user-name">{userName || 'No name'}</span>
          <span data-testid="user-email">{userEmail || 'No email'}</span>
          <button onClick={updateUser} data-testid="update-user">
            Update User
          </button>
        </div>
      )
    }

    render(<UserProfile />)

    expect(screen.getByTestId('user-name').textContent).toBe('No name')
    expect(screen.getByTestId('user-email').textContent).toBe('No email')

    fireEvent.click(screen.getByTestId('update-user'))

    expect(screen.getByTestId('user-name').textContent).toBe('John Doe')
    expect(screen.getByTestId('user-email').textContent).toBe('john@example.com')
  })

  it('should work with useAsyncThunk', async () => {
    function AsyncComponent() {
      const {useAsyncThunk, useSelector} = useStoreHooks(store)
      const {execute, loading, error} = useAsyncThunk()
      const isLoading = useSelector(state => state.loading)

      const loadData = async () => {
        await execute(async ctx => {
          ctx.dispatch({loading: true})
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 10))
          ctx.dispatch({
            loading: false,
            user: {name: 'Async User', email: 'async@example.com'},
          })
        })
      }

      return (
        <div>
          <span data-testid="loading">{loading ? 'Hook Loading' : 'Hook Ready'}</span>
          <span data-testid="state-loading">{isLoading ? 'State Loading' : 'State Ready'}</span>
          <button onClick={loadData} data-testid="load-data">
            Load Data
          </button>
          {error && <span data-testid="error">{error.message}</span>}
        </div>
      )
    }

    render(<AsyncComponent />)

    expect(screen.getByTestId('loading').textContent).toBe('Hook Ready')
    expect(screen.getByTestId('state-loading').textContent).toBe('State Ready')

    fireEvent.click(screen.getByTestId('load-data'))

    // Should show loading state
    expect(screen.getByTestId('loading').textContent).toBe('Hook Loading')

    // Wait for async operation to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('Hook Ready')
      expect(screen.getByTestId('state-loading').textContent).toBe('State Ready')
    })
  })

  it('should cache hooks for the same store instance', () => {
    let hooksInstance1: any
    let hooksInstance2: any

    function Component1() {
      hooksInstance1 = useStoreHooks(store)
      return <div>Component 1</div>
    }

    function Component2() {
      hooksInstance2 = useStoreHooks(store)
      return <div>Component 2</div>
    }

    function App() {
      return (
        <div>
          <Component1 />
          <Component2 />
        </div>
      )
    }

    render(<App />)

    // Should return the same hooks instance for the same store
    expect(hooksInstance1).toBe(hooksInstance2)
    expect(hooksInstance1.useSelector).toBe(hooksInstance2.useSelector)
    expect(hooksInstance1.useDispatch).toBe(hooksInstance2.useDispatch)
  })

  it('should work with multiple different stores', () => {
    const store1 = createStore({value: 'store1'})
    const store2 = createStore({value: 'store2'})

    function MultiStoreComponent() {
      const {useSelector: useSelector1} = useStoreHooks(store1)
      const {useSelector: useSelector2} = useStoreHooks(store2)

      const value1 = useSelector1(state => state.value)
      const value2 = useSelector2(state => state.value)

      return (
        <div>
          <span data-testid="value1">{value1}</span>
          <span data-testid="value2">{value2}</span>
        </div>
      )
    }

    render(<MultiStoreComponent />)

    expect(screen.getByTestId('value1').textContent).toBe('store1')
    expect(screen.getByTestId('value2').textContent).toBe('store2')
  })

  it('should provide all features without context provider', async () => {
    function FullFeatureComponent() {
      const {useSelector, useStoreValue, useTransaction, useBatch, useUpdatePath} =
        useStoreHooks(store)

      const count = useSelector(state => state.count)
      const userName = useStoreValue<string>('user.name')
      const transaction = useTransaction()
      const batch = useBatch()
      const updatePath = useUpdatePath()

      const performComplexUpdate = () => {
        transaction(draft => {
          draft.count += 10
          draft.user.name = 'Batch User'
          draft.user.email = 'batch@example.com'
        })
      }

      const performBatchUpdate = () => {
        batch(() => {
          updatePath(['count'], (current: number) => current + 5)
          updatePath(['user', 'name'], () => 'Batched User')
        })
      }

      return (
        <div>
          <span data-testid="count">{count}</span>
          <span data-testid="user-name">{userName || 'No name'}</span>
          <button onClick={performComplexUpdate} data-testid="complex-update">
            Complex Update
          </button>
          <button onClick={performBatchUpdate} data-testid="batch-update">
            Batch Update
          </button>
        </div>
      )
    }

    // Note: No provider wrapper needed!
    render(<FullFeatureComponent />)

    expect(screen.getByTestId('count').textContent).toBe('0')
    expect(screen.getByTestId('user-name').textContent).toBe('No name')

    fireEvent.click(screen.getByTestId('complex-update'))

    // Wait for state to update
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('10')
      expect(screen.getByTestId('user-name').textContent).toBe('Batch User')
    })

    // Test batch update functionality
    fireEvent.click(screen.getByTestId('batch-update'))
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('15')
      expect(screen.getByTestId('user-name').textContent).toBe('Batched User')
    })
  })
})
