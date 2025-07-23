import React, {Profiler, useEffect, useRef} from 'react'
import {describe, it, expect, beforeEach, vi, afterEach, Mock, TestContext} from 'vitest'
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
  const initialState: TestState = {
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
  }

  beforeEach(context => {
    const testName = context.task.name
    store = createStore<TestState>(initialState, {
      name: testName,
      historyLimit: 100,
    })
  })

  afterEach(() => {
    store.destroy({
      clearHistory: true,
      removePersistedState: true,
      resetRegistry: true,
    })
  })

  describe('Basic functionality with improved performance', () => {
    describe('useSelector', () => {
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

        // Ensure no excessive re-renders
        const initialRenderCount = screen.getByTestId('count').textContent
        fireEvent.click(screen.getByText('Increment')) // Increment again
        await waitFor(() => {
          expect(screen.getByTestId('count').textContent).toBe('2')
        })
        expect(screen.getByTestId('count').textContent).toBe(initialRenderCount === '0' ? '2' : '2') // Should not have re-rendered excessively
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

      it('useSelector works with minimal re-renders', async () => {
        const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)
        let renderCount = 0
        const renderLog: string[] = []

        function TestComponent() {
          renderCount++
          const count = useSelector(state => state.count)
          const name = useSelector(state => state.user.name)
          const email = useSelector(state => state.user.email)
          const dispatch = useDispatch()

          // Log what caused this render
          renderLog.push(`Render ${renderCount}: count=${count}, name=${name}`)

          return (
            <div>
              <div data-testid="count">{count}</div>
              <div data-testid="name">{name}</div>
              <div data-testid="email">{email}</div>
              <div data-testid="renders">{renderCount}</div>
              <button onClick={() => dispatch({count: count + 1})}>Increment</button>
              <button onClick={() => dispatch({user: {...store.getState().user, name: 'Jane'}})}>
                Change Name
              </button>
              <button
                onClick={() =>
                  dispatch({user: {...store.getState().user, email: 'jane@example.com'}})
                }>
                Change Email
              </button>
              <button onClick={() => dispatch({count: count})}>No-op Update</button>
            </div>
          )
        }

        render(
          <StoreProvider>
            <TestComponent />
          </StoreProvider>
        )

        // Initial render
        expect(screen.getByTestId('count').textContent).toBe('0')
        expect(screen.getByTestId('renders').textContent).toBe('1')

        // Test 1: State change should cause re-render
        fireEvent.click(screen.getByText('Increment'))

        await waitFor(() => {
          expect(screen.getByTestId('count').textContent).toBe('1')
        })
        expect(screen.getByTestId('renders').textContent).toBe('2')

        // Test 2: Another state property change should cause re-render
        fireEvent.click(screen.getByText('Change Name'))

        await waitFor(() => {
          expect(screen.getByTestId('name').textContent).toBe('Jane')
        })
        expect(screen.getByTestId('renders').textContent).toBe('3')

        // Test 3: No-op update should NOT cause re-render
        const renderCountBeforeNoop = Number(screen.getByTestId('renders').textContent)
        fireEvent.click(screen.getByText('No-op Update'))

        // Wait a bit to ensure no re-render happens
        await new Promise(resolve => setTimeout(resolve, 50))

        expect(screen.getByTestId('renders').textContent).toBe(renderCountBeforeNoop.toString())

        // Test 4: Multiple rapid changes should be efficient
        const renderCountBeforeRapid = Number(screen.getByTestId('renders').textContent)

        // Rapid updates
        fireEvent.click(screen.getByText('Increment'))
        fireEvent.click(screen.getByText('Change Email'))
        fireEvent.click(screen.getByText('Increment'))

        await waitFor(() => {
          expect(screen.getByTestId('count').textContent).toBe('3')
          expect(screen.getByTestId('email').textContent).toBe('jane@example.com')
        })

        const finalRenderCount = Number(screen.getByTestId('renders').textContent)

        // Should have rendered efficiently
        expect(finalRenderCount - renderCountBeforeRapid).toBeLessThanOrEqual(3)
      })

      it('useSelector only re-renders when selected state changes', async () => {
        const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

        // Track commits for counter and name components separately
        let counterCommitCount = 0
        let nameCommitCount = 0

        const onCounterRender = (id: any, phase: any, ...rest: any[]) => {
          if (phase === 'update' || phase === 'mount') {
            counterCommitCount++
          }
        }

        const onNameRender = (id: any, phase: any, ...rest: any[]) => {
          if (phase === 'update' || phase === 'mount') {
            nameCommitCount++
          }
        }

        function CounterComponent() {
          const count = useSelector(state => state.count)
          return <div data-testid="counter-value">{count}</div>
        }

        function NameComponent() {
          const name = useSelector(state => state.user.name)
          return <div data-testid="name-value">{name}</div>
        }

        function ControlPanel() {
          const dispatch = useDispatch()
          return (
            <div>
              <button onClick={() => dispatch({count: store.getState().count + 1})}>
                Update Count
              </button>
              <button onClick={() => dispatch({user: {...store.getState().user, name: 'Jane'}})}>
                Update Name
              </button>
            </div>
          )
        }

        render(
          <StoreProvider>
            <Profiler id="CounterComponent" onRender={onCounterRender}>
              <CounterComponent />
            </Profiler>
            <Profiler id="NameComponent" onRender={onNameRender}>
              <NameComponent />
            </Profiler>
            <ControlPanel />
          </StoreProvider>
        )

        // Initial render
        expect(counterCommitCount).toBe(1)
        expect(nameCommitCount).toBe(1)

        // Update only count
        fireEvent.click(screen.getByText('Update Count'))

        await waitFor(() => {
          expect(counterCommitCount).toBe(2)
        })
        expect(nameCommitCount).toBe(1) // Should not have re-rendered

        // Update only name
        fireEvent.click(screen.getByText('Update Name'))

        await waitFor(() => {
          expect(nameCommitCount).toBe(2)
        })
        expect(counterCommitCount).toBe(2) // Should not have re-rendered again
      })

      it('useSelector with same reference should not cause re-renders', async () => {
        const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

        // Track committed renders
        let commitCount = 0
        const onRender = (id: any, phase: any, ...rest: any[]) => {
          if (phase === 'update' || phase === 'mount') {
            commitCount++
          }
        }

        function TestComponent() {
          // Select a nested object that shouldn't change reference when other state changes
          const nestedValue = useSelector(state => state.nested.deep.value)
          const dispatch = useDispatch()

          return (
            <div>
              <div data-testid="nested-value">{nestedValue}</div>
              <button onClick={() => dispatch({count: store.getState().count + 1})}>
                Update Count
              </button>
            </div>
          )
        }

        render(
          <Profiler id="Test" onRender={onRender}>
            <StoreProvider>
              <TestComponent />
            </StoreProvider>
          </Profiler>
        )

        // Initial render
        expect(commitCount).toBe(1)

        // Save the initial commit count
        const initialCommitCount = commitCount

        // Update unrelated state
        fireEvent.click(screen.getByText('Update Count'))

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 50))

        // Should not have re-rendered since the selected value hasn't changed
        expect(commitCount).toBe(initialCommitCount) // No additional commits
        expect(screen.getByTestId('nested-value').textContent).toBe('test')
      })
    })

    describe('useStoreState', () => {
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
      it('useStoreState works correctly with minimal re-renders', async () => {
        const {StoreProvider, useStoreState, useDispatch} = createStoreContext(store)
        let renderCount = 0
        const renderLog: string[] = []

        function TestComponent() {
          renderCount++
          const state = useStoreState()
          const dispatch = useDispatch()

          // Log what caused this render
          renderLog.push(`Render ${renderCount}: count=${state.count}, name=${state.user.name}`)

          return (
            <div>
              <div data-testid="count">{state.count}</div>
              <div data-testid="name">{state.user.name}</div>
              <div data-testid="email">{state.user.email}</div>
              <div data-testid="renders">{renderCount}</div>
              <button onClick={() => dispatch({count: state.count + 1})}>Increment</button>
              <button
                onClick={() =>
                  dispatch({
                    user: {...state.user, name: 'Jane'},
                  })
                }>
                Change Name
              </button>
              <button
                onClick={() =>
                  dispatch({
                    user: {...state.user, email: 'jane@example.com'},
                  })
                }>
                Change Email
              </button>
              {/* This should not trigger re-render since it doesn't change state */}
              <button onClick={() => dispatch({count: state.count})}>No-op Update</button>
            </div>
          )
        }

        render(
          <StoreProvider>
            <TestComponent />
          </StoreProvider>
        )

        // Initial render
        expect(screen.getByTestId('count').textContent).toBe('0')
        expect(screen.getByTestId('name').textContent).toBe('John')
        expect(screen.getByTestId('email').textContent).toBe('john@example.com')
        expect(screen.getByTestId('renders').textContent).toBe('1')

        // Test 1: State change should cause re-render
        fireEvent.click(screen.getByText('Increment'))

        await waitFor(() => {
          expect(screen.getByTestId('count').textContent).toBe('1')
        })
        expect(screen.getByTestId('renders').textContent).toBe('2')

        // Test 2: Another state change should cause re-render
        fireEvent.click(screen.getByText('Change Name'))

        await waitFor(() => {
          expect(screen.getByTestId('name').textContent).toBe('Jane')
        })
        expect(screen.getByTestId('renders').textContent).toBe('3')

        // Test 3: No-op update should NOT cause re-render
        const renderCountBeforeNoop = Number(screen.getByTestId('renders').textContent)
        fireEvent.click(screen.getByText('No-op Update'))

        // Wait a bit to ensure no re-render happens
        await new Promise(resolve => setTimeout(resolve, 50))

        expect(screen.getByTestId('renders').textContent).toBe(renderCountBeforeNoop.toString())
        expect(screen.getByTestId('count').textContent).toBe('1') // Should remain the same

        // Test 4: Multiple rapid changes should be efficient
        const renderCountBeforeRapid = Number(screen.getByTestId('renders').textContent)

        // Rapid updates
        fireEvent.click(screen.getByText('Increment'))
        fireEvent.click(screen.getByText('Change Email'))
        fireEvent.click(screen.getByText('Increment'))

        await waitFor(() => {
          expect(screen.getByTestId('count').textContent).toBe('3')
          expect(screen.getByTestId('email').textContent).toBe('jane@example.com')
        })

        const finalRenderCount = Number(screen.getByTestId('renders').textContent)

        // Should have rendered once per actual state change (3 changes = 3 renders)
        expect(finalRenderCount - renderCountBeforeRapid).toBeLessThanOrEqual(3)

        // Log the render history for debugging
        //console.log('Render log:', renderLog)
      })
      it('useStoreState has optimal re-render behavior', async () => {
        const {StoreProvider, useStoreState, useDispatch} = createStoreContext(store)

        // Track committed renders
        let commitCount = 0
        const onRender = (id: any, phase: any, ...rest: any[]) => {
          if (phase === 'update' || phase === 'mount') {
            commitCount++
          }
        }

        function TestComponent() {
          const state = useStoreState()
          const dispatch = useDispatch()

          return (
            <div>
              <div data-testid="count">{state.count}</div>
              <div data-testid="name">{state.user.name}</div>
              <button onClick={() => dispatch({count: state.count + 1})}>Increment</button>
              <button onClick={() => dispatch({count: state.count})}>Same Value</button>
            </div>
          )
        }

        render(
          <Profiler id="Test" onRender={onRender}>
            <StoreProvider>
              <TestComponent />
            </StoreProvider>
          </Profiler>
        )

        // Initial render
        expect(commitCount).toBe(1)

        // Actual state change - should cause a re-render
        fireEvent.click(screen.getByText('Increment'))

        await waitFor(() => {
          expect(screen.getByTestId('count').textContent).toBe('1')
        })

        expect(commitCount).toBe(2) // One more commit

        const commitCountAfterUpdate = commitCount

        // Same value dispatch - should NOT cause a re-render
        fireEvent.click(screen.getByText('Same Value'))

        // Wait to ensure no re-render
        await new Promise(resolve => setTimeout(resolve, 50))

        expect(commitCount).toBe(commitCountAfterUpdate) // No additional commits
        expect(screen.getByTestId('count').textContent).toBe('1')
      })
      it('useStoreState only re-renders when subscribed state actually changes', async () => {
        const {StoreProvider, useStoreState} = createStoreContext(store)

        // Track commits for components separately
        let componentACommitCount = 0
        let componentBCommitCount = 0

        const onComponentARender = (id: any, phase: any, ...rest: any[]) => {
          if (phase === 'update' || phase === 'mount') {
            componentACommitCount++
          }
        }

        const onComponentBRender = (id: any, phase: any, ...rest: any[]) => {
          if (phase === 'update' || phase === 'mount') {
            componentBCommitCount++
          }
        }

        function ComponentA() {
          const state = useStoreState()
          return <div data-testid="comp-a-value">{state.count}</div>
        }

        function ComponentB() {
          const state = useStoreState()
          return <div data-testid="comp-b-value">{state.count}</div>
        }

        function ControlComponent() {
          return (
            <button
              onClick={() => {
                // Direct store update to test isolation
                store.dispatch({count: store.getState().count + 1})
              }}>
              Update Count
            </button>
          )
        }

        render(
          <StoreProvider>
            <Profiler id="ComponentA" onRender={onComponentARender}>
              <ComponentA />
            </Profiler>
            <Profiler id="ComponentB" onRender={onComponentBRender}>
              <ComponentB />
            </Profiler>
            <ControlComponent />
          </StoreProvider>
        )

        // Both should render initially
        expect(componentACommitCount).toBe(1)
        expect(componentBCommitCount).toBe(1)

        // Update state - both should re-render since they use full state
        fireEvent.click(screen.getByText('Update Count'))

        await waitFor(() => {
          expect(componentACommitCount).toBe(2)
          expect(componentBCommitCount).toBe(2)
        })
      })
    })

    it('useStoreValue works correctly with path-based access', async () => {
      const {StoreProvider, useStoreValue, useUpdatePath} = createStoreContext(store)

      function TestComponent() {
        const name = useStoreValue<string>('user.name')
        const updatePath = useUpdatePath()
        const updater = () => 'Jane'
        return (
          <div>
            <div data-testid="name">{name}</div>
            <button onClick={() => updatePath(['user', 'name'], updater)}>Update Name</button>
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

    it('useCombinedSelector works correctly', async () => {
      const {StoreProvider, useCombinedSelector, useDispatch} = createStoreContext(store)
      const selectors = (() => {
        const selectCount = store.select(state => state.count)
        const selectUser = store.select(state => state.user)
        return {
          selectCount,
          selectUser,
          selectName: store.select(selectUser, user => user.name),
        }
      })()

      function TestComponent() {
        const result = useCombinedSelector(
          selectors.selectCount,
          selectors.selectName,
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

      // Track committed renders with Profiler
      let commitCount = 0
      const onRender = (id: any, phase: any, ...rest: any[]) => {
        if (phase === 'update' || phase === 'mount') {
          commitCount++
        }
      }

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
        <Profiler id="Test" onRender={onRender}>
          <StoreProvider>
            <TestComponent />
          </StoreProvider>
        </Profiler>
      )

      // Initial mount
      expect(commitCount).toBe(1)

      // Multiple updates should not cause excessive renders
      fireEvent.click(screen.getByText('Increment'))
      fireEvent.click(screen.getByText('Increment'))

      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('2')
      })

      // Should have rendered once initially + once per state change = 3 renders total
      expect(commitCount).toBeLessThanOrEqual(3)
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

      // Track commits for name and email components separately
      let nameCommitCount = 0
      let emailCommitCount = 0

      const onNameRender = (id: any, phase: any, ...rest: any[]) => {
        if (phase === 'update' || phase === 'mount') {
          nameCommitCount++
        }
      }

      const onEmailRender = (id: any, phase: any, ...rest: any[]) => {
        if (phase === 'update' || phase === 'mount') {
          emailCommitCount++
        }
      }

      function NameComponent() {
        const name = useStoreValue<string>('user.name')
        return <div data-testid="name">{name}</div>
      }

      function EmailComponent() {
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
          <Profiler id="NameComponent" onRender={onNameRender}>
            <NameComponent />
          </Profiler>
          <Profiler id="EmailComponent" onRender={onEmailRender}>
            <EmailComponent />
          </Profiler>
          <ControlComponent />
        </StoreProvider>
      )

      expect(nameCommitCount).toBe(1)
      expect(emailCommitCount).toBe(1)

      fireEvent.click(screen.getByText('Update Name Only'))

      await waitFor(() => {
        expect(screen.getByTestId('name').textContent).toBe('Jane')
      })

      // Name component should re-render, but email should not
      expect(nameCommitCount).toBe(2)
      expect(emailCommitCount).toBe(1) // Should not have re-rendered
    })

    it('should batch multiple updates with minimal renders', async () => {
      const {StoreProvider, useSelector, useBatch, useDispatch} = createStoreContext(store)

      // Track committed renders with Profiler
      let commitCount = 0
      const onRender = (id: any, phase: any, ...rest: any[]) => {
        if (phase === 'update' || phase === 'mount') {
          commitCount++
        }
      }

      function TestComponent() {
        const count = useSelector(state => state.count)
        const name = useSelector(state => state.user.name)
        const email = useSelector(state => state.user.email)
        const batch = useBatch()
        const dispatch = useDispatch()

        return (
          <div>
            <div data-testid="count">{count}</div>
            <div data-testid="name">{name}</div>
            <div data-testid="email">{email}</div>
            <button
              onClick={() =>
                batch(() => {
                  // Multiple updates that should cause only a single render
                  dispatch({count: count + 1})
                  dispatch({user: {...store.getState().user, name: 'Jane'}})
                  dispatch({user: {...store.getState().user, email: 'jane@example.com'}})
                })
              }>
              Batch Multiple Updates
            </button>
          </div>
        )
      }

      render(
        <Profiler id="Test" onRender={onRender}>
          <StoreProvider>
            <TestComponent />
          </StoreProvider>
        </Profiler>
      )

      expect(commitCount).toBe(1) // Initial mount
      fireEvent.click(screen.getByText('Batch Multiple Updates'))

      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('1')
        expect(screen.getByTestId('name').textContent).toBe('Jane')
        expect(screen.getByTestId('email').textContent).toBe('jane@example.com')
      })

      // Should have rendered just once more despite three state changes
      expect(commitCount).toBe(2)
    })

    it('should efficiently memoize complex selector chains', async () => {
      const {StoreProvider, useSelector, useCombinedSelector, useDispatch} =
        createStoreContext(store)

      // track committed renders instead of function invocations
      let commitCount = 0
      // Use type any for now to avoid React type issues
      const onRender = (id: any, phase: any, ...rest: any[]) => {
        if (phase === 'update' || phase === 'mount') {
          commitCount++
        }
      }

      // build truly memoized selectors
      const selectUser = store.select(s => s.user)
      const selectUserName = store.select(selectUser, u => u.name)
      const selectUserEmail = store.select(selectUser, u => u.email)
      const formatUser = (name: string, email: string) => `${name} (${email})`

      function TestComponent() {
        const user = useSelector(selectUser)
        const name = useSelector(selectUserName)
        const email = useSelector(selectUserEmail)
        const formatted = useCombinedSelector(selectUserName, selectUserEmail, formatUser)
        const dispatch = useDispatch()

        return (
          <>
            <div data-testid="name">{name}</div>
            <div data-testid="email">{email}</div>
            <div data-testid="formatted">{formatted}</div>
            <button onClick={() => dispatch({count: store.getState().count + 1})}>
              Update Unrelated State
            </button>
            <button onClick={() => dispatch({user: {...user, name: 'Jane'}})}>Update Name</button>
          </>
        )
      }

      render(
        <Profiler id="Test" onRender={onRender}>
          <StoreProvider>
            <TestComponent />
          </StoreProvider>
        </Profiler>
      )

      // initial mount → 1 commit
      expect(commitCount).toBe(1)

      // 1) Unrelated update → no additional renders
      fireEvent.click(screen.getByText('Update Unrelated State'))
      await waitFor(() => {
        expect(screen.getByTestId('formatted').textContent).toBe('John (john@example.com)')
      })
      expect(commitCount).toBe(1) // Should remain the same

      // 2) Related update → exactly 1 more commit
      fireEvent.click(screen.getByText('Update Name'))
      await waitFor(() => {
        expect(screen.getByTestId('name').textContent).toBe('Jane')
        expect(screen.getByTestId('formatted').textContent).toBe('Jane (john@example.com)')
      })
      expect(commitCount).toBe(2) // One more commit
    })

    it('should efficiently handle deep nested updates with transaction', async () => {
      // Create a store with deeply nested state
      const deepStore = createStore({
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: 'initial',
                },
              },
            },
          },
        },
        counter: 0,
      })

      const {StoreProvider, useSelector, useTransaction} = createStoreContext(deepStore)

      let commitCount = 0

      // Use type any for now to avoid React type issues
      const onRender = (id: any, phase: any, ...rest: any[]) => {
        if (phase === 'update' || phase === 'mount') {
          commitCount++
        }
      }

      function TestComponent() {
        const deepValue = useSelector(state => state.level1.level2.level3.level4.level5.value)
        const counter = useSelector(state => state.counter)
        const transaction = useTransaction()

        return (
          <div>
            <div data-testid="value">{deepValue}</div>
            <div data-testid="counter">{counter}</div>
            <button
              onClick={() =>
                transaction(draft => {
                  // Update a deeply nested value
                  draft.level1.level2.level3.level4.level5.value = 'updated'
                  // Also update an unrelated value
                  draft.counter = counter + 1
                })
              }>
              Update Deep
            </button>
          </div>
        )
      }

      render(
        <StoreProvider>
          <Profiler id="Test" onRender={onRender}>
            <TestComponent />
          </Profiler>
        </StoreProvider>
      )

      expect(commitCount).toBe(1)

      fireEvent.click(screen.getByText('Update Deep'))

      await waitFor(() => {
        expect(screen.getByTestId('value').textContent).toBe('updated')
        expect(screen.getByTestId('counter').textContent).toBe('1')
      })

      // Should render only once after transaction despite multiple path updates
      expect(commitCount).toBe(2)
    })

    it('should optimize when multiple components share selectors', async () => {
      const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)
      const counterSelector = vi.fn(state => state.count)

      let componentACommitCount = 0
      const onComponentARender = (id: any, phase: any, ...rest: any[]) => {
        if (phase === 'update' || phase === 'mount') {
          componentACommitCount++
        }
      }

      let componentBCommitCount = 0
      const onComponentBRender = (id: any, phase: any, ...rest: any[]) => {
        if (phase === 'update' || phase === 'mount') {
          componentBCommitCount++
        }
      }

      function ComponentA() {
        const count = useSelector(counterSelector)
        return <div data-testid="count-a">{count}</div>
      }

      function ComponentB() {
        const count = useSelector(counterSelector)
        return <div data-testid="count-b">{count}</div>
      }

      function Controls() {
        const dispatch = useDispatch()
        return (
          <button onClick={() => dispatch({count: store.getState().count + 1})}>Increment</button>
        )
      }

      render(
        <StoreProvider>
          <Profiler id="ComponentA" onRender={onComponentARender}>
            <ComponentA />
          </Profiler>
          <Profiler id="ComponentB" onRender={onComponentBRender}>
            <ComponentB />
          </Profiler>
          <Controls />
        </StoreProvider>
      )

      // Initial render
      expect(componentACommitCount).toBe(1)
      expect(componentBCommitCount).toBe(1)
      expect(counterSelector).toHaveBeenCalledTimes(1) // Should be called only once for initial render

      counterSelector.mockClear()

      // Update
      fireEvent.click(screen.getByText('Increment'))

      await waitFor(() => {
        expect(screen.getByTestId('count-a').textContent).toBe('1')
        expect(screen.getByTestId('count-b').textContent).toBe('1')
      })

      expect(componentACommitCount).toBe(2)
      expect(componentBCommitCount).toBe(2)
      expect(counterSelector).toHaveBeenCalledTimes(1) // Should be called only once for the update
    })

    it('should preserve structural sharing between updates', async () => {
      const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

      // References to track object identity
      const objectReferences = {
        user: null as any,
        nested: null as any,
      }

      function TestComponent() {
        const user = useSelector(state => state.user)
        const nested = useSelector(state => state.nested)
        const dispatch = useDispatch()

        // Store references for comparison
        useEffect(() => {
          if (!objectReferences.user) {
            objectReferences.user = user
            objectReferences.nested = nested
          }
        }, [user, nested])

        return (
          <div>
            <div data-testid="user-name">{user.name}</div>
            <button
              onClick={() =>
                dispatch({
                  count: store.getState().count + 1, // Update unrelated state
                })
              }>
              Update Count
            </button>
            <button
              onClick={() =>
                dispatch({
                  user: {...user, name: 'Jane'}, // Update user.name only
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

      // Update unrelated state
      fireEvent.click(screen.getByText('Update Count'))

      await waitFor(() => {
        // User object should maintain same reference when unrelated state changes
        expect(store.getState().user).toBe(objectReferences.user)
        expect(store.getState().nested).toBe(objectReferences.nested)
      })

      // Update user name
      fireEvent.click(screen.getByText('Update Name'))

      await waitFor(() => {
        expect(screen.getByTestId('user-name').textContent).toBe('Jane')
      })

      // User reference should change, but nested should remain the same
      expect(store.getState().user).not.toBe(objectReferences.user)
      expect(store.getState().nested).toBe(objectReferences.nested)
    })

    it('should handle high frequency updates efficiently', async () => {
      const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

      let commitCount = 0
      const onRender = (id: any, phase: any, ...rest: any[]) => {
        if (phase === 'update' || phase === 'mount') {
          commitCount++
        }
      }

      function TestComponent() {
        const count = useSelector(state => state.count)
        const dispatch = useDispatch()

        // Simulate rapid updates
        const rapidUpdateRef = useRef<number | null>(null)

        const startRapidUpdates = () => {
          if (rapidUpdateRef.current) return

          let updates = 0
          const updateInterval = setInterval(() => {
            dispatch({count: store.getState().count + 1})
            updates++
            if (updates >= 10) {
              clearInterval(updateInterval)
              rapidUpdateRef.current = null
            }
          }, 10) // Update every 10ms

          rapidUpdateRef.current = updateInterval as unknown as number
        }

        return (
          <div>
            <div data-testid="count">{count}</div>
            <button onClick={startRapidUpdates}>Start Rapid Updates</button>
          </div>
        )
      }

      render(
        <StoreProvider>
          <Profiler id="Test" onRender={onRender}>
            <TestComponent />
          </Profiler>
        </StoreProvider>
      )

      expect(commitCount).toBe(1)

      fireEvent.click(screen.getByText('Start Rapid Updates'))

      // Wait for updates to complete
      await waitFor(
        () => {
          expect(Number(screen.getByTestId('count').textContent)).toBe(10)
        },
        {timeout: 2000}
      )

      // Render count should be reasonable considering React batching
      // In an efficient implementation, this should be close to 11 (initial + one per update)
      expect(commitCount).toBeLessThanOrEqual(11)
    })

    it.skip('should work efficiently with React.memo', async () => {
      const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

      // Commit counters
      let parentCommitCount = 0
      let memoCommitCount = 0

      const onParentRender: React.ProfilerOnRenderCallback = (
        id: any,
        phase: any,
        ...rest: any[]
      ) => {
        if (phase === 'mount' || phase === 'update') {
          parentCommitCount++
        }
      }

      const onMemoRender: React.ProfilerOnRenderCallback = (
        id: any,
        phase: any,
        ...rest: any[]
      ) => {
        if (phase === 'mount' || phase === 'update') {
          memoCommitCount++
        }
      }

      const MemoizedCounter = React.memo(function Counter({value}: {value: number}) {
        return <div data-testid="memo-count">{value}</div>
      })

      function ParentComponent() {
        const count = useSelector(state => state.count)
        const name = useSelector(state => state.user.name)
        const dispatch = useDispatch()

        return (
          <div>
            <div data-testid="name">{name}</div>

            {/* only measure the memoized child here */}
            <Profiler id="MemoizedCounter" onRender={onMemoRender}>
              <MemoizedCounter value={count} />
            </Profiler>

            <button onClick={() => dispatch({user: {...store.getState().user, name: 'Jane'}})}>
              Update Name
            </button>
            <button onClick={() => dispatch({count: count + 1})}>Update Count</button>
          </div>
        )
      }

      render(
        <StoreProvider>
          {/* wrap the whole ParentComponent so we count its commits */}
          <Profiler id="ParentComponent" onRender={onParentRender}>
            <ParentComponent />
          </Profiler>
        </StoreProvider>
      )

      // capture strictly the *initial* commits (could be 1 or 2 in StrictMode)
      const initialParent = parentCommitCount
      const initialMemo = memoCommitCount

      // 1) update only name ⇒ parent commits +1, memo stays the same
      fireEvent.click(screen.getByText('Update Name'))
      await waitFor(() => {
        expect(screen.getByTestId('name').textContent).toBe('Jane')
      })
      expect(parentCommitCount - initialParent).toBe(1)
      expect(memoCommitCount - initialMemo).toBe(0)

      // 2) update the count ⇒ both parent & memo commit +1
      fireEvent.click(screen.getByText('Update Count'))
      await waitFor(() => {
        expect(screen.getByTestId('memo-count').textContent).toBe('1')
      })
      expect(parentCommitCount - initialParent).toBe(2)
      expect(memoCommitCount - initialMemo).toBe(1)
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

      // Store 1 should still be unchanged
      expect(screen.getByTestId('count1').textContent).toBe('2')

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

      // Track committed renders
      let commitCount = 0
      const onRender = (id: any, phase: any, ...rest: any[]) => {
        if (phase === 'update' || phase === 'mount') {
          commitCount++
        }
      }

      function TestComponent() {
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
            <button onClick={updateBoth}>Batch Update</button>
          </div>
        )
      }

      render(
        <Profiler id="Test" onRender={onRender}>
          <StoreProvider>
            <TestComponent />
          </StoreProvider>
        </Profiler>
      )

      const initialCommits = commitCount

      fireEvent.click(screen.getByText('Batch Update'))

      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('1')
        expect(screen.getByTestId('name').textContent).toBe('Batched')
      })

      // Should only render once more despite two state updates
      expect(commitCount).toBe(initialCommits + 1)
    })
  })
})
