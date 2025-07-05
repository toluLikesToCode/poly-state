import React from 'react'
import {describe, it, expect, beforeEach, vi} from 'vitest'
import {render, screen, fireEvent, waitFor} from '@testing-library/react'
import {createStore} from '../../src/core'
import {createStoreContext, useStoreHooks} from '../../src/react/index'

interface TestState {
  count: number
  user: {
    name: string
    email: string
  }
  nested: {
    deep: {
      value: string
    }
  }
}

describe('useSyncExternalStore Integration Functionality', () => {
  let store: ReturnType<typeof createStore<TestState>>

  beforeEach(() => {
    store = createStore<TestState>({
      count: 0,
      user: {
        name: 'John',
        email: 'john@example.com',
      },
      nested: {
        deep: {
          value: 'test',
        },
      },
    })
  })

  describe('Basic functionality with improved performance', () => {
    it('useSelector works correctly with context', async () => {
      const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

      function TestComponent() {
        const count = useSelector(state => state.count)
        const dispatch = useDispatch()

        return (
          <div>
            <div data-testid="count">{count}</div>
            <button onClick={() => dispatch({count: count + 1})}>Increment</button>
          </div>
        )
      }

      render(
        <StoreProvider>
          <TestComponent />
        </StoreProvider>
      )

      expect(screen.getByTestId('count').textContent).toBe('0')

      fireEvent.click(screen.getByText('Increment'))

      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('1')
      })
    })

    it('useSelector works correctly with context-free hooks', async () => {
      function TestComponent() {
        const {useSelector, useDispatch} = useStoreHooks(store)
        const count = useSelector(state => state.count)
        const dispatch = useDispatch()

        return (
          <div>
            <div data-testid="count">{count}</div>
            <button onClick={() => dispatch({count: count + 1})}>Increment</button>
          </div>
        )
      }

      render(<TestComponent />)

      expect(screen.getByTestId('count').textContent).toBe('0')

      fireEvent.click(screen.getByText('Increment'))

      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('1')
      })
    })

    it('useStoreValue works correctly with path-based access', async () => {
      const {StoreProvider, useStoreValue, useDispatch} = createStoreContext(store)

      function TestComponent() {
        const name = useStoreValue<string>('user.name')
        const dispatch = useDispatch()

        return (
          <div>
            <div data-testid="name">{name}</div>
            <button
              onClick={() =>
                dispatch({
                  user: {
                    ...store.getState().user,
                    name: 'Jane',
                  },
                })
              }>
              Update Name
            </button>
          </div>
        )
      }

      render(
        <StoreProvider>
          <TestComponent />
        </StoreProvider>
      )

      expect(screen.getByTestId('name').textContent).toBe('John')

      fireEvent.click(screen.getByText('Update Name'))

      await waitFor(() => {
        expect(screen.getByTestId('name').textContent).toBe('Jane')
      })
    })

    it('useStoreState works correctly', async () => {
      const {StoreProvider, useStoreState, useDispatch} = createStoreContext(store)

      function TestComponent() {
        const state = useStoreState()
        const dispatch = useDispatch()

        return (
          <div>
            <div data-testid="count">{state.count}</div>
            <div data-testid="name">{state.user.name}</div>
            <button onClick={() => dispatch({count: state.count + 1})}>Increment</button>
          </div>
        )
      }

      render(
        <StoreProvider>
          <TestComponent />
        </StoreProvider>
      )

      expect(screen.getByTestId('count').textContent).toBe('0')
      expect(screen.getByTestId('name').textContent).toBe('John')

      fireEvent.click(screen.getByText('Increment'))

      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('1')
      })
    })

    it('useCombinedSelector works correctly', async () => {
      const {StoreProvider, useCombinedSelector, useDispatch} = createStoreContext(store)

      function TestComponent() {
        const result = useCombinedSelector(
          (state: TestState) => state.count,
          (state: TestState) => state.user.name,
          (count, name) => `${name}: ${count}`
        )
        const dispatch = useDispatch()

        return (
          <div>
            <div data-testid="combined">{result}</div>
            <button onClick={() => dispatch({count: 1})}>Update</button>
          </div>
        )
      }

      render(
        <StoreProvider>
          <TestComponent />
        </StoreProvider>
      )

      expect(screen.getByTestId('combined').textContent).toBe('John: 0')

      fireEvent.click(screen.getByText('Update'))

      await waitFor(() => {
        expect(screen.getByTestId('combined').textContent).toBe('John: 1')
      })
    })
  })

  describe('Performance characteristics', () => {
    it('should not cause excessive re-renders', async () => {
      const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)
      let renderCount = 0

      function TestComponent() {
        renderCount++
        const count = useSelector(state => state.count)
        const dispatch = useDispatch()

        return (
          <div>
            <div data-testid="count">{count}</div>
            <div data-testid="renders">{renderCount}</div>
            <button onClick={() => dispatch({count: count + 1})}>Increment</button>
          </div>
        )
      }

      render(
        <StoreProvider>
          <TestComponent />
        </StoreProvider>
      )

      expect(screen.getByTestId('renders').textContent).toBe('1')

      // Multiple updates should not cause excessive renders
      fireEvent.click(screen.getByText('Increment'))
      fireEvent.click(screen.getByText('Increment'))

      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('2')
      })

      // Should have rendered once initially + once per state change = 3 renders total
      expect(Number(screen.getByTestId('renders').textContent)).toBeLessThanOrEqual(3)
    })

    it('should handle rapid state changes without issues', async () => {
      const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

      function TestComponent() {
        const count = useSelector(state => state.count)
        const dispatch = useDispatch()

        return (
          <div>
            <div data-testid="count">{count}</div>
            <button
              onClick={() => {
                // Rapid updates
                for (let i = 1; i <= 5; i++) {
                  dispatch({count: i})
                }
              }}>
              Rapid Update
            </button>
          </div>
        )
      }

      render(
        <StoreProvider>
          <TestComponent />
        </StoreProvider>
      )

      fireEvent.click(screen.getByText('Rapid Update'))

      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('5')
      })
    })

    it('should handle path-based subscriptions efficiently', async () => {
      const {StoreProvider, useStoreValue, useDispatch} = createStoreContext(store)
      let nameRenderCount = 0
      let emailRenderCount = 0

      function NameComponent() {
        nameRenderCount++
        const name = useStoreValue<string>('user.name')
        return <div data-testid="name">{name}</div>
      }

      function EmailComponent() {
        emailRenderCount++
        const email = useStoreValue<string>('user.email')
        return <div data-testid="email">{email}</div>
      }

      function ControlComponent() {
        const dispatch = useDispatch()
        return (
          <button
            onClick={() =>
              dispatch({
                user: {
                  ...store.getState().user,
                  name: 'Jane',
                },
              })
            }>
            Update Name Only
          </button>
        )
      }

      render(
        <StoreProvider>
          <NameComponent />
          <EmailComponent />
          <ControlComponent />
        </StoreProvider>
      )

      expect(nameRenderCount).toBe(1)
      expect(emailRenderCount).toBe(1)

      fireEvent.click(screen.getByText('Update Name Only'))

      await waitFor(() => {
        expect(screen.getByTestId('name').textContent).toBe('Jane')
      })

      // Name component should re-render, but email should not
      expect(nameRenderCount).toBe(2)
      expect(emailRenderCount).toBe(1) // Should not have re-rendered
    })
  })

  describe('Context-free hooks', () => {
    it('should work with multiple stores', async () => {
      const store1 = createStore({count: 1})
      const store2 = createStore({count: 10})

      function TestComponent() {
        const {useSelector: useSelector1, useDispatch: useDispatch1} = useStoreHooks(store1)
        const {useSelector: useSelector2, useDispatch: useDispatch2} = useStoreHooks(store2)

        const count1 = useSelector1(state => state.count)
        const count2 = useSelector2(state => state.count)
        const dispatch1 = useDispatch1()
        const dispatch2 = useDispatch2()

        return (
          <div>
            <div data-testid="count1">{count1}</div>
            <div data-testid="count2">{count2}</div>
            <button onClick={() => dispatch1({count: count1 + 1})}>Increment Store 1</button>
            <button onClick={() => dispatch2({count: count2 + 1})}>Increment Store 2</button>
          </div>
        )
      }

      render(<TestComponent />)

      expect(screen.getByTestId('count1').textContent).toBe('1')
      expect(screen.getByTestId('count2').textContent).toBe('10')

      fireEvent.click(screen.getByText('Increment Store 1'))

      await waitFor(() => {
        expect(screen.getByTestId('count1').textContent).toBe('2')
      })

      // Store 2 should be unchanged
      expect(screen.getByTestId('count2').textContent).toBe('10')

      fireEvent.click(screen.getByText('Increment Store 2'))

      await waitFor(() => {
        expect(screen.getByTestId('count2').textContent).toBe('11')
      })
    })

    it('should cache hooks per store instance', () => {
      function TestComponent1() {
        const hooks1 = useStoreHooks(store)
        const hooks2 = useStoreHooks(store)

        // Same store should return same hook instances
        expect(hooks1.useSelector).toBe(hooks2.useSelector)
        expect(hooks1.useDispatch).toBe(hooks2.useDispatch)

        return <div data-testid="test">OK</div>
      }

      render(<TestComponent1 />)
      expect(screen.getByTestId('test').textContent).toBe('OK')
    })
  })

  describe('Integration with existing hooks', () => {
    it('should work with useTransaction', async () => {
      const {StoreProvider, useSelector, useTransaction} = createStoreContext(store)

      function TestComponent() {
        const count = useSelector(state => state.count)
        const name = useSelector(state => state.user.name)
        const transaction = useTransaction()

        const updateBoth = () => {
          transaction(draft => {
            draft.count = count + 1
            draft.user.name = 'Updated'
          })
        }

        return (
          <div>
            <div data-testid="count">{count}</div>
            <div data-testid="name">{name}</div>
            <button onClick={updateBoth}>Update Both</button>
          </div>
        )
      }

      render(
        <StoreProvider>
          <TestComponent />
        </StoreProvider>
      )

      fireEvent.click(screen.getByText('Update Both'))

      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('1')
        expect(screen.getByTestId('name').textContent).toBe('Updated')
      })
    })

    it('should work with useBatch', async () => {
      const {StoreProvider, useSelector, useDispatch, useBatch} = createStoreContext(store)
      let renderCount = 0

      function TestComponent() {
        renderCount++
        const count = useSelector(state => state.count)
        const name = useSelector(state => state.user.name)
        const dispatch = useDispatch()
        const batch = useBatch()

        const updateBoth = () => {
          batch(() => {
            dispatch({count: count + 1})
            dispatch({
              user: {
                ...store.getState().user,
                name: 'Batched',
              },
            })
          })
        }

        return (
          <div>
            <div data-testid="count">{count}</div>
            <div data-testid="name">{name}</div>
            <div data-testid="renders">{renderCount}</div>
            <button onClick={updateBoth}>Batch Update</button>
          </div>
        )
      }

      render(
        <StoreProvider>
          <TestComponent />
        </StoreProvider>
      )

      const initialRenders = renderCount

      fireEvent.click(screen.getByText('Batch Update'))

      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('1')
        expect(screen.getByTestId('name').textContent).toBe('Batched')
      })

      // Should only render once more despite two state updates
      expect(renderCount).toBe(initialRenders + 1)
    })
  })
})
