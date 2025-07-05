import React from 'react'
import {describe, it, expect, beforeEach, vi} from 'vitest'
import {render, screen, fireEvent} from '@testing-library/react'
import {act} from 'react'
import {createStore, Selector, Thunk} from '../../src/core'
import {
  createStoreContext,
  UseAsyncThunkHook,
  UseBatchHook,
  UseDispatchHook,
  UseSelectorHook,
  UseStoreHistoryHook,
  UseStoreHook,
  UseStoreStateHook,
  UseStoreValueHook,
  UseSubscribeToPathHook,
  UseThunkHook,
  UseTransactionHook,
  UseUpdatePathHook,
} from '../../src/react/index'

describe('React Integration', () => {
  let store: ReturnType<typeof createStore<{count: number}>>

  beforeEach(() => {
    store = createStore({count: 0})
  })

  it('should create store context successfully', () => {
    const context = createStoreContext(store)

    expect(context.StoreProvider).toBeDefined()
    expect(context.useStore).toBeDefined()
    expect(context.useDispatch).toBeDefined()
    expect(context.useSelector).toBeDefined()
    expect(context.StoreContext).toBeDefined()
  })

  it('should create StoreProvider component', () => {
    const {StoreProvider} = createStoreContext(store)
    expect(typeof StoreProvider).toBe('function')
    expect(StoreProvider.displayName).toBe('StoreProvider')
  })

  it('should create useStore hook', () => {
    const {useStore} = createStoreContext(store)
    expect(typeof useStore).toBe('function')
  })

  it('should create useDispatch hook', () => {
    const {useDispatch} = createStoreContext(store)
    expect(typeof useDispatch).toBe('function')
  })

  it('should create useSelector hook', () => {
    const {useSelector} = createStoreContext(store)
    expect(typeof useSelector).toBe('function')
  })
})

describe('React Integration – UI', () => {
  let store: ReturnType<typeof createStore<{count: number}>>
  let StoreProvider: React.FC<{children: React.ReactNode}>
  let useStore: () => ReturnType<(typeof store)['asReadOnly']>
  let useDispatch: () => (typeof store)['dispatch']
  let useSelector: <R>(selector: (state: {count: number}) => R) => R

  beforeEach(() => {
    store = createStore({count: 0})
    const context = createStoreContext(store)
    StoreProvider = context.StoreProvider
    useStore = context.useStore
    useDispatch = context.useDispatch
    useSelector = context.useSelector
  })

  function Counter() {
    const count = useSelector(state => state.count)
    const dispatch = useDispatch()
    return (
      <div>
        <span data-testid="count">{count}</span>
        <button onClick={() => dispatch({count: count + 1})}>Increment</button>
      </div>
    )
  }

  it('should update UI when store state changes via dispatch', () => {
    render(
      <StoreProvider>
        <Counter />
      </StoreProvider>
    )
    const count = screen.getByTestId('count')
    expect(count.textContent).toBe('0')
    const result = fireEvent.click(screen.getByText('Increment'))
    expect(result).toBe(true)
    expect(count.textContent).toBe('1')
  })
})

describe('React Integration – Complete Basic Usage', () => {
  interface AppState {
    user: {
      id: number | null
      name: string
      email: string
    }
    todos: Array<{
      id: number
      text: string
      completed: boolean
    }>
    settings: {
      theme: 'light' | 'dark'
      notifications: boolean
    }
    counter: number
  }

  let store: ReturnType<typeof createStore<AppState>>
  let StoreProvider: React.FC<{children: React.ReactNode}>
  let useStore: UseStoreHook<AppState>
  let useDispatch: UseDispatchHook<AppState>
  let useSelector: UseSelectorHook<AppState>

  let selectorSpy = vi.fn()

  beforeEach(() => {
    store = createStore<AppState>({
      user: {
        id: null,
        name: '',
        email: '',
      },
      todos: [],
      settings: {
        theme: 'light',
        notifications: true,
      },
      counter: 0,
    })

    const context = createStoreContext(store)
    StoreProvider = context.StoreProvider
    useStore = context.useStore
    useDispatch = context.useDispatch
    useSelector = context.useSelector
  })

  // Component that demonstrates basic counter functionality
  function Counter() {
    const count = useSelector(state => state.counter)
    const dispatch = useDispatch()

    return (
      <div>
        <span data-testid="counter">{count}</span>
        <button data-testid="increment" onClick={() => dispatch({counter: count + 1})}>
          +
        </button>
        <button data-testid="decrement" onClick={() => dispatch({counter: count - 1})}>
          -
        </button>
        <button data-testid="reset" onClick={() => dispatch({counter: 0})}>
          Reset
        </button>
      </div>
    )
  }

  // Component that demonstrates user management
  function UserProfile() {
    const user = useSelector(
      (state: AppState) => state.user,
      user => {
        selectorSpy()
        return {
          ...user,
          hasEmail: user.email.length > 0,
        }
      }
    )
    const dispatch = useDispatch()

    const updateUser = () => {
      dispatch({
        user: {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
        },
      })
    }

    const clearUser = () => {
      dispatch({
        user: {
          id: null,
          name: '',
          email: '',
        },
      })
    }

    return (
      <div>
        <div data-testid="user-id">{user.id || 'No ID'}</div>
        <div data-testid="user-name">{user.name || 'No Name'}</div>
        <div data-testid="user-email">{user.email || 'No Email'}</div>
        <button data-testid="update-user" onClick={updateUser}>
          Update User
        </button>
        <button data-testid="clear-user" onClick={clearUser}>
          Clear User
        </button>
      </div>
    )
  }

  // Component that demonstrates todo list functionality
  function TodoList() {
    const todos = useSelector(state => state.todos)
    const dispatch = useDispatch()

    const addTodo = () => {
      const newTodo = {
        id: Date.now(),
        text: `Todo ${todos.length + 1}`,
        completed: false,
      }
      dispatch({
        todos: [...todos, newTodo],
      })
    }

    const toggleTodo = (id: number) => {
      dispatch({
        todos: todos.map(todo => (todo.id === id ? {...todo, completed: !todo.completed} : todo)),
      })
    }

    const removeTodo = (id: number) => {
      dispatch({
        todos: todos.filter(todo => todo.id !== id),
      })
    }

    return (
      <div>
        <div data-testid="todo-count">{todos.length}</div>
        <button data-testid="add-todo" onClick={addTodo}>
          Add Todo
        </button>
        {todos.map(todo => (
          <div key={todo.id} data-testid={`todo-${todo.id}`}>
            <span data-testid={`todo-text-${todo.id}`}>{todo.text}</span>
            <span data-testid={`todo-completed-${todo.id}`}>{todo.completed ? '✓' : '○'}</span>
            <button data-testid={`toggle-todo-${todo.id}`} onClick={() => toggleTodo(todo.id)}>
              Toggle
            </button>
            <button data-testid={`remove-todo-${todo.id}`} onClick={() => removeTodo(todo.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>
    )
  }

  // Component that demonstrates settings management
  function Settings() {
    const settings = useSelector(state => state.settings)
    const dispatch = useDispatch()

    const toggleTheme = () => {
      dispatch({
        settings: {
          ...settings,
          theme: settings.theme === 'light' ? 'dark' : 'light',
        },
      })
    }

    const toggleNotifications = () => {
      dispatch({
        settings: {
          ...settings,
          notifications: !settings.notifications,
        },
      })
    }

    return (
      <div>
        <div data-testid="theme">{settings.theme}</div>
        <div data-testid="notifications">{settings.notifications.toString()}</div>
        <button data-testid="toggle-theme" onClick={toggleTheme}>
          Toggle Theme
        </button>
        <button data-testid="toggle-notifications" onClick={toggleNotifications}>
          Toggle Notifications
        </button>
      </div>
    )
  }

  // Component that uses multiple selectors
  function Dashboard() {
    const userCount = useSelector(state => (state.user.id ? 1 : 0))
    const todoCount = useSelector(state => state.todos.length)
    const completedTodos = useSelector(state => state.todos.filter(todo => todo.completed).length)
    const isDarkMode = useSelector(state => state.settings.theme === 'dark')

    return (
      <div>
        <div data-testid="dashboard-users">{userCount}</div>
        <div data-testid="dashboard-todos">{todoCount}</div>
        <div data-testid="dashboard-completed">{completedTodos}</div>
        <div data-testid="dashboard-theme">{isDarkMode ? 'dark' : 'light'}</div>
      </div>
    )
  }

  // Main app component that combines all functionality
  function App() {
    return (
      <StoreProvider>
        <div>
          <Counter />
          <UserProfile />
          <TodoList />
          <Settings />
          <Dashboard />
        </div>
      </StoreProvider>
    )
  }

  it('should handle basic counter operations', () => {
    render(<App />)

    const counter = screen.getByTestId('counter')
    const incrementBtn = screen.getByTestId('increment')
    const decrementBtn = screen.getByTestId('decrement')
    const resetBtn = screen.getByTestId('reset')

    // Initial state
    expect(counter.textContent).toBe('0')

    // Increment
    fireEvent.click(incrementBtn)
    expect(counter.textContent).toBe('1')

    // Increment again
    fireEvent.click(incrementBtn)
    expect(counter.textContent).toBe('2')

    // Decrement
    fireEvent.click(decrementBtn)
    expect(counter.textContent).toBe('1')

    // Reset
    fireEvent.click(resetBtn)
    expect(counter.textContent).toBe('0')
  })

  it('should handle user profile management', () => {
    render(<App />)

    const userId = screen.getByTestId('user-id')
    const userName = screen.getByTestId('user-name')
    const userEmail = screen.getByTestId('user-email')
    const updateBtn = screen.getByTestId('update-user')
    const clearBtn = screen.getByTestId('clear-user')

    // Initial state
    expect(userId.textContent).toBe('No ID')
    expect(userName.textContent).toBe('No Name')
    expect(userEmail.textContent).toBe('No Email')

    // Update user
    act(() => {
      fireEvent.click(updateBtn)
    })
    expect(userId.textContent).toBe('1')
    expect(userName.textContent).toBe('John Doe')
    expect(userEmail.textContent).toBe('john@example.com')

    // Clear user
    act(() => {
      fireEvent.click(clearBtn)
    })
    expect(userId.textContent).toBe('No ID')
    expect(userName.textContent).toBe('No Name')
    expect(userEmail.textContent).toBe('No Email')
  })

  it('should handle todo list operations', () => {
    render(<App />)

    const todoCount = screen.getByTestId('todo-count')
    const addBtn = screen.getByTestId('add-todo')

    // Initial state
    expect(todoCount.textContent).toBe('0')

    // Add first todo
    act(() => {
      fireEvent.click(addBtn)
    })
    expect(todoCount.textContent).toBe('1')

    // Get all todo elements (we can't predict the exact IDs since they use Date.now())
    let todoElements = screen.getAllByText(/^Todo \d+$/)
    expect(todoElements).toHaveLength(1)
    expect(todoElements[0].textContent).toBe('Todo 1')

    // Add second todo
    act(() => {
      fireEvent.click(addBtn)
    })
    expect(todoCount.textContent).toBe('2')

    // Should now have 2 todos
    todoElements = screen.getAllByText(/^Todo \d+$/)
    expect(todoElements).toHaveLength(2)
    expect(todoElements[1].textContent).toBe('Todo 2')
  })

  it('should handle settings management', () => {
    render(<App />)

    const theme = screen.getByTestId('theme')
    const notifications = screen.getByTestId('notifications')
    const themeBtn = screen.getByTestId('toggle-theme')
    const notificationsBtn = screen.getByTestId('toggle-notifications')

    // Initial state
    expect(theme.textContent).toBe('light')
    expect(notifications.textContent).toBe('true')

    // Toggle theme
    fireEvent.click(themeBtn)
    expect(theme.textContent).toBe('dark')

    // Toggle theme back
    fireEvent.click(themeBtn)
    expect(theme.textContent).toBe('light')

    // Toggle notifications
    fireEvent.click(notificationsBtn)
    expect(notifications.textContent).toBe('false')

    // Toggle notifications back
    fireEvent.click(notificationsBtn)
    expect(notifications.textContent).toBe('true')
  })

  it('should handle complex selectors and derived state', () => {
    render(<App />)

    const dashboardUsers = screen.getByTestId('dashboard-users')
    const dashboardTodos = screen.getByTestId('dashboard-todos')
    const dashboardCompleted = screen.getByTestId('dashboard-completed')
    const dashboardTheme = screen.getByTestId('dashboard-theme')

    // Initial state
    expect(dashboardUsers.textContent).toBe('0')
    expect(dashboardTodos.textContent).toBe('0')
    expect(dashboardCompleted.textContent).toBe('0')
    expect(dashboardTheme.textContent).toBe('light')

    // Update user - should reflect in dashboard
    fireEvent.click(screen.getByTestId('update-user'))
    expect(dashboardUsers.textContent).toBe('1')

    // Add todos - should reflect in dashboard
    fireEvent.click(screen.getByTestId('add-todo'))
    fireEvent.click(screen.getByTestId('add-todo'))
    expect(dashboardTodos.textContent).toBe('2')

    // Toggle theme - should reflect in dashboard
    fireEvent.click(screen.getByTestId('toggle-theme'))
    expect(dashboardTheme.textContent).toBe('dark')
  })

  it('should handle multiple simultaneous state updates', () => {
    render(<App />)

    const counter = screen.getByTestId('counter')
    const userId = screen.getByTestId('user-id')
    const todoCount = screen.getByTestId('todo-count')
    const theme = screen.getByTestId('theme')

    // Perform multiple updates
    fireEvent.click(screen.getByTestId('increment'))
    fireEvent.click(screen.getByTestId('increment'))
    fireEvent.click(screen.getByTestId('update-user'))
    fireEvent.click(screen.getByTestId('add-todo'))
    fireEvent.click(screen.getByTestId('toggle-theme'))

    // All updates should be reflected
    expect(counter.textContent).toBe('2')
    expect(userId.textContent).toBe('1')
    expect(todoCount.textContent).toBe('1')
    expect(theme.textContent).toBe('dark')
  })

  it('should maintain component isolation with selective updates', () => {
    render(<App />)

    const counter = screen.getByTestId('counter')
    const userName = screen.getByTestId('user-name')

    // Update counter - should not affect user name
    fireEvent.click(screen.getByTestId('increment'))
    expect(counter.textContent).toBe('1')
    expect(userName.textContent).toBe('No Name')

    // Update user - should not affect counter
    fireEvent.click(screen.getByTestId('update-user'))
    expect(counter.textContent).toBe('1')
    expect(userName.textContent).toBe('John Doe')
  })

  it('should handle error boundaries correctly', () => {
    // Test that useSelector and useDispatch throw appropriate errors outside provider
    const TestComponent = () => {
      try {
        useSelector(state => state.counter)
        return <div>Should not reach here</div>
      } catch (error) {
        return <div data-testid="error">Error caught</div>
      }
    }

    render(<TestComponent />)
    expect(screen.getByTestId('error')).toBeDefined()
  })

  it('should handle multiple selectors with projector function', () => {
    function TestComponent() {
      // Test multiple selectors with projector
      const userSummary = useSelector(
        state => state.user.name,
        state => state.user.email,
        state => state.counter,
        (name, email, counter) => {
          return {
            displayName: name || 'Anonymous',
            hasContact: email.length > 0,
            activityScore: counter,
            summary: `${name || 'Anonymous'} (${counter} actions)`,
          }
        }
      )

      return (
        <div>
          <div data-testid="display-name">{userSummary.displayName}</div>
          <div data-testid="has-contact">{userSummary.hasContact.toString()}</div>
          <div data-testid="activity-score">{userSummary.activityScore}</div>
          <div data-testid="summary">{userSummary.summary}</div>
        </div>
      )
    }

    render(
      <StoreProvider>
        <TestComponent />
      </StoreProvider>
    )

    // Initial state
    expect(screen.getByTestId('display-name').textContent).toBe('Anonymous')
    expect(screen.getByTestId('has-contact').textContent).toBe('false')
    expect(screen.getByTestId('activity-score').textContent).toBe('0')
    expect(screen.getByTestId('summary').textContent).toBe('Anonymous (0 actions)')

    // Update user and counter
    act(() => {
      store.dispatch({
        user: {id: 1, name: 'John Doe', email: 'john@example.com'},
        counter: 5,
      })
    })

    expect(screen.getByTestId('display-name').textContent).toBe('John Doe')
    expect(screen.getByTestId('has-contact').textContent).toBe('true')
    expect(screen.getByTestId('activity-score').textContent).toBe('5')
    expect(screen.getByTestId('summary').textContent).toBe('John Doe (5 actions)')
  })
})

describe('React Integration – Advanced Features', () => {
  interface TestState {
    count: number
    user: {
      name: string
      age: number
    }
    todos: Array<{
      id: number
      text: string
      completed: boolean
    }>
  }

  let store: ReturnType<typeof createStore<TestState>>
  let StoreProvider: React.FC<{children: React.ReactNode}>
  let useStoreState: UseStoreStateHook<TestState>
  let useTransaction: UseTransactionHook<TestState>
  let useBatch: UseBatchHook
  let useUpdatePath: UseUpdatePathHook
  let useStoreValue: UseStoreValueHook
  let useSubscribeToPath: UseSubscribeToPathHook
  let useThunk: UseThunkHook<TestState>
  let useAsyncThunk: UseAsyncThunkHook<TestState>
  let useSelector: UseSelectorHook<TestState>

  beforeEach(() => {
    store = createStore<TestState>({
      count: 0,
      user: {
        name: 'John',
        age: 25,
      },
      todos: [],
    })

    const context = createStoreContext(store)
    StoreProvider = context.StoreProvider
    useStoreState = context.useStoreState
    useTransaction = context.useTransaction
    useBatch = context.useBatch
    useUpdatePath = context.useUpdatePath
    useStoreValue = context.useStoreValue
    useSubscribeToPath = context.useSubscribeToPath
    useThunk = context.useThunk as any
    useAsyncThunk = context.useAsyncThunk
    useSelector = context.useSelector
  })

  it('should provide access to full store state with useStoreState', () => {
    function TestComponent() {
      const state = useStoreState()
      return (
        <div>
          <div data-testid="count">{state.count}</div>
          <div data-testid="user-name">{state.user.name}</div>
          <div data-testid="user-age">{state.user.age}</div>
          <div data-testid="todos-length">{state.todos.length}</div>
        </div>
      )
    }

    render(
      <StoreProvider>
        <TestComponent />
      </StoreProvider>
    )

    expect(screen.getByTestId('count').textContent).toBe('0')
    expect(screen.getByTestId('user-name').textContent).toBe('John')
    expect(screen.getByTestId('user-age').textContent).toBe('25')
    expect(screen.getByTestId('todos-length').textContent).toBe('0')
  })

  it('should support transactions with useTransaction', () => {
    function TestComponent() {
      const state = useStoreState()
      const transaction = useTransaction()

      const performTransaction = () => {
        const success = transaction(draft => {
          draft.count = 10
          draft.user.name = 'Jane'
          draft.user.age = 30
          draft.todos.push({id: 1, text: 'Test todo', completed: false})
        })
        return success
      }

      return (
        <div>
          <div data-testid="count">{state.count}</div>
          <div data-testid="user-name">{state.user.name}</div>
          <div data-testid="todos-length">{state.todos.length}</div>
          <button data-testid="transaction-btn" onClick={performTransaction}>
            Transaction
          </button>
        </div>
      )
    }

    render(
      <StoreProvider>
        <TestComponent />
      </StoreProvider>
    )

    // Initial state
    expect(screen.getByTestId('count').textContent).toBe('0')
    expect(screen.getByTestId('user-name').textContent).toBe('John')
    expect(screen.getByTestId('todos-length').textContent).toBe('0')

    // Perform transaction
    fireEvent.click(screen.getByTestId('transaction-btn'))

    // All changes should be applied atomically
    expect(screen.getByTestId('count').textContent).toBe('10')
    expect(screen.getByTestId('user-name').textContent).toBe('Jane')
    expect(screen.getByTestId('todos-length').textContent).toBe('1')
  })

  it('should support path-based updates with useUpdatePath', () => {
    function TestComponent() {
      const state = useStoreState()
      const updatePath = useUpdatePath()

      const updateUserAge = () => {
        updatePath(['user', 'age'], (currentAge: number) => currentAge + 1)
      }

      const updateCount = () => {
        updatePath(['count'], (currentCount: number) => currentCount + 5)
      }

      return (
        <div>
          <div data-testid="count">{state.count}</div>
          <div data-testid="user-age">{state.user.age}</div>
          <button data-testid="update-age" onClick={updateUserAge}>
            Update Age
          </button>
          <button data-testid="update-count" onClick={updateCount}>
            Update Count
          </button>
        </div>
      )
    }

    render(
      <StoreProvider>
        <TestComponent />
      </StoreProvider>
    )

    // Initial state
    expect(screen.getByTestId('count').textContent).toBe('0')
    expect(screen.getByTestId('user-age').textContent).toBe('25')

    // Update age
    fireEvent.click(screen.getByTestId('update-age'))
    expect(screen.getByTestId('user-age').textContent).toBe('26')

    // Update count
    fireEvent.click(screen.getByTestId('update-count'))
    expect(screen.getByTestId('count').textContent).toBe('5')
  })

  it('should support path-based value access with useStoreValue', () => {
    function TestComponent() {
      const userName = useStoreValue<string>('user.name')
      const userAge = useStoreValue<number>('user.age')
      const count = useStoreValue<number>('count')

      return (
        <div>
          <div data-testid="user-name">{userName}</div>
          <div data-testid="user-age">{userAge}</div>
          <div data-testid="count">{count}</div>
        </div>
      )
    }

    render(
      <StoreProvider>
        <TestComponent />
      </StoreProvider>
    )

    expect(screen.getByTestId('user-name').textContent).toBe('John')
    expect(screen.getByTestId('user-age').textContent).toBe('25')
    expect(screen.getByTestId('count').textContent).toBe('0')

    // Update the store and verify the values update
    act(() => {
      store.dispatch({user: {name: 'Jane', age: 30}, count: 42})
    })

    expect(screen.getByTestId('user-name').textContent).toBe('Jane')
    expect(screen.getByTestId('user-age').textContent).toBe('30')
    expect(screen.getByTestId('count').textContent).toBe('42')
  })

  it('should support thunks with useThunk', () => {
    function TestComponent() {
      const state = useStoreState()
      const count = useSelector(state => state.count)
      const executeThunk = useThunk()

      const performThunk = () => {
        executeThunk(({dispatch, getState}) => {
          const currentState = getState()
          dispatch({count: currentState.count + 10})
        })
      }

      const increment = () => {
        executeThunk(({transaction}) => {
          transaction(draft => {
            draft.count += 1
          })
        })
      }

      const decrement = () => {
        executeThunk(({transaction}) => {
          transaction(draft => {
            draft.count -= 1
          })
        })
      }

      return (
        <div>
          <div data-testid="count">{state.count}</div>
          <button data-testid="thunk-btn" onClick={performThunk}>
            Execute Thunk
          </button>
          <button data-testid="inc-thunk" onClick={increment}>
            Incriment Thunk
          </button>
          <button data-testid="dec-thunk" onClick={decrement}>
            Decriment Thunk
          </button>
        </div>
      )
    }

    render(
      <StoreProvider>
        <TestComponent />
      </StoreProvider>
    )

    expect(screen.getByTestId('count').textContent).toBe('0')

    fireEvent.click(screen.getByTestId('thunk-btn'))

    expect(screen.getByTestId('count').textContent).toBe('10')

    fireEvent.click(screen.getByTestId('inc-thunk'))

    expect(screen.getByTestId('count').textContent).toBe('11')

    fireEvent.click(screen.getByTestId('inc-thunk'))

    expect(screen.getByTestId('count').textContent).toBe('12')

    fireEvent.click(screen.getByTestId('inc-thunk'))

    expect(screen.getByTestId('count').textContent).toBe('13')

    fireEvent.click(screen.getByTestId('dec-thunk'))

    expect(screen.getByTestId('count').textContent).toBe('12')

    fireEvent.click(screen.getByTestId('dec-thunk'))

    expect(screen.getByTestId('count').textContent).toBe('11')
  })

  it('should support async thunks with useAsyncThunk', async () => {
    function TestComponent() {
      const state = useStoreState()
      const {execute, loading, error} = useAsyncThunk()

      const performAsyncThunk = async () => {
        try {
          await execute(async ({dispatch}) => {
            // Simulate async operation
            await new Promise(resolve => setTimeout(resolve, 10))
            dispatch({count: 42})
            return 42
          })
        } catch (err) {
          // Handle error
        }
      }

      return (
        <div>
          <div data-testid="count">{state.count}</div>
          <div data-testid="loading">{loading.toString()}</div>
          <div data-testid="error">{error?.message || 'no error'}</div>
          <button data-testid="async-thunk-btn" onClick={performAsyncThunk}>
            Execute Async Thunk
          </button>
        </div>
      )
    }

    render(
      <StoreProvider>
        <TestComponent />
      </StoreProvider>
    )

    expect(screen.getByTestId('count').textContent).toBe('0')
    expect(screen.getByTestId('loading').textContent).toBe('false')

    await act(async () => {
      fireEvent.click(screen.getByTestId('async-thunk-btn'))
      // Wait for async operation to complete
      await new Promise(resolve => setTimeout(resolve, 20))
    })

    expect(screen.getByTestId('count').textContent).toBe('42')
    expect(screen.getByTestId('loading').textContent).toBe('false')
    expect(screen.getByTestId('error').textContent).toBe('no error')
  })
})
