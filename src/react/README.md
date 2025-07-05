# Open Store React Integration Guide

Open Store provides a powerful and intuitive React integration that makes state management feel
natural and performant. This guide will walk you through everything you need to know, from basic
concepts to advanced patterns.

## Quick Start

Let's begin with a simple example to understand the core concepts:

```tsx
import {createStore} from 'open-store'
import {createStoreContext} from 'open-store/react'

// First, define your state shape
interface AppState {
  count: number
  user: {name: string; email: string}
}

// Create your store with initial state
const store = createStore<AppState>({
  count: 0,
  user: {name: '', email: ''},
})

// Create React integration hooks and components
const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

// Use in your components
function Counter() {
  const count = useSelector(state => state.count)
  const dispatch = useDispatch()

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => dispatch({count: count + 1})}>Increment</button>
    </div>
  )
}

// Wrap your app with the provider
function App() {
  return (
    <StoreProvider>
      <Counter />
    </StoreProvider>
  )
}
```

This example demonstrates the fundamental pattern: create a store, generate React hooks from it, and
use those hooks in your components. The `useSelector` hook subscribes to specific parts of state,
and `useDispatch` provides a way to update the state.

## Understanding the Architecture

Open Store's React integration is built around a few key concepts that work together to provide
efficient state management:

**Store Creation**: You start by creating a store instance that holds your application state. This
store exists outside of React and can be used independently.

**Context Generation**: The `createStoreContext` function generates a complete set of React hooks
and components tailored to your specific store. This approach provides excellent TypeScript
inference and prevents common mistakes.

**Selective Subscriptions**: Unlike many state management solutions, Open Store allows components to
subscribe only to the specific parts of state they need. This means components re-render only when
their relevant data changes.

**Immutable Updates**: All state updates preserve immutability while leveraging structural sharing
for performance. The library uses Immer under the hood for complex updates.

## Installation and Setup

```bash
npm install open-store
# or
yarn add open-store
# or
pnpm add open-store
```

Open Store requires React 16.8 or later for hook support. TypeScript is strongly recommended for the
best development experience, though not required.

## Core Hooks and Their Usage

### useSelector - Subscribing to State

The `useSelector` hook is your primary way to access state in components. It takes a selector
function that extracts the specific data you need:

```tsx
function UserProfile() {
  // Select just the user's name - component only re-renders when name changes
  const userName = useSelector(state => state.user.name)

  // Select derived data - memoized automatically
  const displayName = useSelector(state => state.user.name || 'Anonymous User')

  // Select complex derived state
  const userStats = useSelector(state => ({
    hasEmail: !!state.user.email,
    isComplete: state.user.name && state.user.email,
    nameLength: state.user.name.length,
  }))

  return (
    <div>
      <h1>Welcome, {displayName}!</h1>
      {userStats.isComplete ? (
        <span>Profile complete</span>
      ) : (
        <span>Please complete your profile</span>
      )}
    </div>
  )
}
```

The selector function receives the entire state but should return only the data the component needs.
Open Store automatically compares the returned values using deep equality, so your component won't
re-render unless the selected data actually changes.

### useDispatch - Updating State

The `useDispatch` hook provides a function to update your state. You can dispatch partial state
objects or thunk functions for more complex logic:

```tsx
function UserForm() {
  const user = useSelector(state => state.user)
  const dispatch = useDispatch()

  const updateUser = (field: keyof typeof user, value: string) => {
    dispatch({
      user: {...user, [field]: value},
    })
  }

  const saveUser = async () => {
    // Dispatch a thunk for async operations
    await dispatch(async (dispatch, getState) => {
      const currentUser = getState().user
      try {
        await saveToServer(currentUser)
        dispatch({saved: true, lastSaved: Date.now()})
      } catch (error) {
        dispatch({error: error.message})
      }
    })
  }

  return (
    <form>
      <input
        value={user.name}
        onChange={e => updateUser('name', e.target.value)}
        placeholder="Name"
      />
      <input
        value={user.email}
        onChange={e => updateUser('email', e.target.value)}
        placeholder="Email"
      />
      <button type="button" onClick={saveUser}>
        Save User
      </button>
    </form>
  )
}
```

### useStoreValue - Path-Based Access

For deeply nested state, `useStoreValue` provides a convenient way to access values using dot
notation:

```tsx
function UserSettings() {
  // Access nested values with string paths
  const theme = useStoreValue<'light' | 'dark'>('user.preferences.theme')
  const language = useStoreValue<string>('user.preferences.language')
  const notificationCount = useStoreValue<number>('notifications.unread.length')

  return (
    <div className={`theme-${theme}`}>
      <p>Language: {language}</p>
      <p>Unread notifications: {notificationCount}</p>
    </div>
  )
}
```

This approach is particularly useful for accessing deep properties without needing to write complex
selector functions. The component will automatically re-render when the specific path value changes.

## Advanced State Updates

### Transactions - Atomic Updates

For complex state updates that involve multiple changes, transactions ensure atomicity and better
performance:

```tsx
function TodoManager() {
  const todos = useSelector(state => state.todos)
  const transaction = useTransaction()

  const addTodoWithStats = (text: string) => {
    transaction(draft => {
      // Add the new todo
      draft.todos.push({
        id: Date.now(),
        text,
        completed: false,
        createdAt: new Date(),
      })

      // Update statistics in the same transaction
      draft.stats.totalTodos += 1
      draft.stats.activeTodos += 1
      draft.stats.lastActivity = Date.now()

      // Update user activity
      draft.user.lastAction = 'added_todo'
    })
  }

  const completeTodo = (todoId: number) => {
    transaction(draft => {
      const todo = draft.todos.find(t => t.id === todoId)
      if (todo && !todo.completed) {
        todo.completed = true
        todo.completedAt = new Date()

        // Update counters atomically
        draft.stats.activeTodos -= 1
        draft.stats.completedTodos += 1
      }
    })
  }

  return (
    <div>
      {todos.map(todo => (
        <div key={todo.id}>
          <span>{todo.text}</span>
          <button onClick={() => completeTodo(todo.id)}>Complete</button>
        </div>
      ))}
      <button onClick={() => addTodoWithStats('New todo')}>Add Todo</button>
    </div>
  )
}
```

Transactions use Immer's draft system, allowing you to write mutations that are automatically
converted to immutable updates. This makes complex state updates much more readable and less
error-prone.

### Batching - Performance Optimization

When you need to make multiple dispatch calls, batching ensures they're grouped into a single
re-render:

```tsx
function BulkOperations() {
  const batch = useBatch()
  const dispatch = useDispatch()

  const resetApplication = () => {
    batch(() => {
      dispatch({user: {name: '', email: ''}})
      dispatch({todos: []})
      dispatch({settings: {theme: 'light', language: 'en'}})
      dispatch({stats: {totalTodos: 0, completedTodos: 0}})
      dispatch({lastReset: Date.now()})
    })
    // All updates above trigger only one re-render
  }

  const loadUserData = async (userId: string) => {
    const userData = await fetchUserData(userId)

    batch(() => {
      dispatch({user: userData.user})
      dispatch({todos: userData.todos})
      dispatch({settings: userData.settings})
      dispatch({loaded: true, loading: false})
    })
  }

  return (
    <div>
      <button onClick={resetApplication}>Reset App</button>
      <button onClick={() => loadUserData('123')}>Load User Data</button>
    </div>
  )
}
```

### Path Updates - Surgical Precision

For updating specific nested values, `useUpdatePath` provides efficient updates with automatic
structural sharing:

```tsx
function NestedDataEditor() {
  const updatePath = useUpdatePath()
  const userProfile = useSelector(state => state.user.profile)

  const updateAddress = (field: string, value: string) => {
    updatePath(['user', 'profile', 'address', field], () => value)
  }

  const incrementLoginCount = () => {
    updatePath(['user', 'stats', 'loginCount'], (current: number) => current + 1)
  }

  const toggleNotification = (notificationId: string) => {
    updatePath(['user', 'notifications', notificationId, 'read'], (current: boolean) => !current)
  }

  return (
    <div>
      <input
        value={userProfile.address?.street || ''}
        onChange={e => updateAddress('street', e.target.value)}
        placeholder="Street Address"
      />
      <input
        value={userProfile.address?.city || ''}
        onChange={e => updateAddress('city', e.target.value)}
        placeholder="City"
      />
      <button onClick={incrementLoginCount}>Simulate Login</button>
    </div>
  )
}
```

## Subscriptions and Side Effects

### useSubscribeTo - React to State Changes

Sometimes you need to perform side effects when specific state changes occur:

```tsx
function NotificationManager() {
  const notifications = useSelector(state => state.notifications)

  // Subscribe to notification changes and show browser notifications
  useSubscribeTo(
    state => state.notifications.unread.length,
    (newCount, oldCount) => {
      if (newCount > oldCount) {
        // New notification arrived
        new Notification(`You have ${newCount} unread notifications`)
      }
    },
    {immediate: false} // Don't trigger on initial render
  )

  // Subscribe to theme changes and update CSS variables
  useSubscribeTo(
    state => state.user.preferences.theme,
    newTheme => {
      document.documentElement.setAttribute('data-theme', newTheme)
    },
    {immediate: true} // Apply theme immediately
  )

  return <div>Notification system active</div>
}
```

### useSubscribeToPath - Path-Based Side Effects

For deeply nested values, path-based subscriptions provide a more convenient syntax:

```tsx
function UserActivityTracker() {
  // Track when user completes their profile
  useSubscribeToPath(
    'user.profile.completeness',
    (completeness: number, previousCompleteness: number) => {
      if (completeness === 100 && previousCompleteness < 100) {
        // Profile just became complete
        analytics.track('profile_completed')
        showCelebrationAnimation()
      }
    }
  )

  // Auto-save user preferences
  useSubscribeToPath(
    'user.preferences',
    preferences => {
      // Debounced auto-save
      debouncedSave(preferences)
    },
    {debounceMs: 1000} // Wait 1 second before saving
  )

  return null // This component only handles side effects
}
```

### useStoreEffect - Effect Hook Pattern

For more complex effect scenarios, `useStoreEffect` combines state selection with React's effect
pattern:

```tsx
function ConnectionManager() {
  const dispatch = useDispatch()

  // Manage WebSocket connection based on user authentication
  useStoreEffect(
    state => ({
      isAuthenticated: !!state.user.token,
      userId: state.user.id,
    }),
    ({isAuthenticated, userId}, previous) => {
      if (isAuthenticated && userId) {
        // User just logged in or component mounted with authenticated user
        const socket = new WebSocket(`ws://api.example.com/user/${userId}`)

        socket.onmessage = event => {
          const data = JSON.parse(event.data)
          dispatch({realTimeData: data})
        }

        socket.onopen = () => {
          dispatch({connectionStatus: 'connected'})
        }

        socket.onclose = () => {
          dispatch({connectionStatus: 'disconnected'})
        }

        // Cleanup function
        return () => {
          socket.close()
        }
      } else if (previous?.isAuthenticated) {
        // User just logged out
        dispatch({realTimeData: null, connectionStatus: 'disconnected'})
      }
    }
  )

  return null
}
```

## Async Operations and Loading States

### useAsyncThunk - Centralized Async State

Open Store provides built-in patterns for handling async operations with loading and error states:

```tsx
function DataLoader() {
  const {execute, loading, error} = useAsyncThunk()
  const data = useSelector(state => state.apiData)

  const loadUserData = async () => {
    try {
      await execute(async dispatch => {
        // Set loading state
        dispatch({loading: true, error: null})

        // Fetch data
        const response = await fetch('/api/user/profile')
        if (!response.ok) throw new Error('Failed to fetch')

        const userData = await response.json()

        // Update state with results
        dispatch({
          apiData: userData,
          loading: false,
          lastFetch: Date.now(),
        })
      })
    } catch (err) {
      // Error is automatically captured in the error state
      console.error('Failed to load user data:', err)
    }
  }

  const saveUserData = async (userData: any) => {
    await execute(async (dispatch, getState) => {
      const currentState = getState()

      // Optimistic update
      dispatch({apiData: userData, saving: true})

      try {
        await fetch('/api/user/profile', {
          method: 'PUT',
          body: JSON.stringify(userData),
        })

        dispatch({saving: false, lastSaved: Date.now()})
      } catch (err) {
        // Revert optimistic update
        dispatch({apiData: currentState.apiData, saving: false})
        throw err // Re-throw so error state is set
      }
    })
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (error) {
    return (
      <div>
        <p>Error: {error.message}</p>
        <button onClick={loadUserData}>Retry</button>
      </div>
    )
  }

  return (
    <div>
      <pre>{JSON.stringify(data, null, 2)}</pre>
      <button onClick={loadUserData}>Refresh Data</button>
    </div>
  )
}
```

## History and Time Travel

Open Store includes built-in undo/redo functionality that integrates seamlessly with React:

```tsx
function HistoryControls() {
  const {history, currentIndex, canUndo, canRedo, undo, redo} = useStoreHistory()

  return (
    <div className="history-controls">
      <button disabled={!canUndo} onClick={() => undo()} title="Undo last action">
        ← Undo
      </button>

      <button disabled={!canRedo} onClick={() => redo()} title="Redo next action">
        Redo →
      </button>

      <span className="history-info">
        Step {currentIndex + 1} of {history.length}
      </span>

      {/* Advanced controls */}
      <button onClick={() => undo(5)}>Undo 5 steps</button>

      <button onClick={() => redo(3)}>Redo 3 steps</button>
    </div>
  )
}

function DrawingApp() {
  const drawing = useSelector(state => state.drawing)
  const transaction = useTransaction()

  const addStroke = (stroke: DrawingStroke) => {
    transaction(draft => {
      draft.drawing.strokes.push(stroke)
      draft.drawing.lastModified = Date.now()
    })
  }

  return (
    <div>
      <HistoryControls />
      <Canvas strokes={drawing.strokes} onStroke={addStroke} />
    </div>
  )
}
```

## Advanced Patterns and Best Practices

### Multiple Store Pattern

For large applications, you might want to split state into multiple stores:

```tsx
// User store
const userStore = createStore({
  profile: {name: '', email: ''},
  preferences: {theme: 'light', language: 'en'},
  authentication: {token: null, isLoggedIn: false},
})

// Application store
const appStore = createStore({
  ui: {sidebarOpen: false, currentPage: 'home'},
  data: {todos: [], projects: []},
  cache: new Map(),
})

// Create separate contexts
const UserContext = createStoreContext(userStore)
const AppContext = createStoreContext(appStore)

function App() {
  return (
    <UserContext.StoreProvider>
      <AppContext.StoreProvider>
        <MainApplication />
      </AppContext.StoreProvider>
    </UserContext.StoreProvider>
  )
}

function UserProfile() {
  // Use user store
  const {useSelector: useUserSelector, useDispatch: useUserDispatch} = UserContext
  const profile = useUserSelector(state => state.profile)
  const dispatch = useUserDispatch()

  return (
    <div>
      <h1>{profile.name}</h1>
      <button onClick={() => dispatch({profile: {...profile, name: 'Updated'}})}>
        Update Name
      </button>
    </div>
  )
}
```

### Custom Hook Patterns

Create reusable custom hooks for common state operations:

```tsx
// Custom hook for user operations
function useUser() {
  const user = useSelector(state => state.user)
  const dispatch = useDispatch()
  const transaction = useTransaction()

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      try {
        const response = await authService.login(credentials)
        transaction(draft => {
          draft.user.profile = response.user
          draft.user.token = response.token
          draft.user.isLoggedIn = true
          draft.user.lastLogin = Date.now()
        })
        return response
      } catch (error) {
        dispatch({user: {...user, loginError: error.message}})
        throw error
      }
    },
    [dispatch, transaction, user]
  )

  const logout = useCallback(() => {
    transaction(draft => {
      draft.user = {
        profile: {name: '', email: ''},
        token: null,
        isLoggedIn: false,
        loginError: null,
      }
    })
    authService.logout()
  }, [transaction])

  const updateProfile = useCallback(
    (updates: Partial<UserProfile>) => {
      dispatch({
        user: {
          ...user,
          profile: {...user.profile, ...updates},
        },
      })
    },
    [dispatch, user]
  )

  return {
    user,
    isLoggedIn: user.isLoggedIn,
    login,
    logout,
    updateProfile,
  }
}

// Custom hook for todo operations
function useTodos() {
  const todos = useSelector(state => state.todos)
  const transaction = useTransaction()

  const addTodo = useCallback(
    (text: string) => {
      transaction(draft => {
        draft.todos.push({
          id: Date.now(),
          text,
          completed: false,
          createdAt: new Date(),
        })
        draft.stats.totalTodos += 1
      })
    },
    [transaction]
  )

  const toggleTodo = useCallback(
    (id: number) => {
      transaction(draft => {
        const todo = draft.todos.find(t => t.id === id)
        if (todo) {
          todo.completed = !todo.completed
          if (todo.completed) {
            draft.stats.completedTodos += 1
          } else {
            draft.stats.completedTodos -= 1
          }
        }
      })
    },
    [transaction]
  )

  const deleteTodo = useCallback(
    (id: number) => {
      transaction(draft => {
        const index = draft.todos.findIndex(t => t.id === id)
        if (index !== -1) {
          const todo = draft.todos[index]
          draft.todos.splice(index, 1)
          draft.stats.totalTodos -= 1
          if (todo.completed) {
            draft.stats.completedTodos -= 1
          }
        }
      })
    },
    [transaction]
  )

  return {
    todos,
    addTodo,
    toggleTodo,
    deleteTodo,
    activeTodos: todos.filter(t => !t.completed),
    completedTodos: todos.filter(t => t.completed),
  }
}

// Using custom hooks in components
function TodoApp() {
  const {todos, addTodo, toggleTodo, deleteTodo, activeTodos} = useTodos()
  const {user, isLoggedIn} = useUser()

  if (!isLoggedIn) {
    return <LoginForm />
  }

  return (
    <div>
      <h1>Welcome, {user.profile.name}!</h1>
      <p>You have {activeTodos.length} active todos</p>
      <TodoList todos={todos} onToggle={toggleTodo} onDelete={deleteTodo} />
      <AddTodoForm onAdd={addTodo} />
    </div>
  )
}
```

### Performance Optimization Patterns

Open Store includes several patterns for optimizing performance in React applications:

```tsx
// Selector optimization - avoid creating new objects in selectors
function TodoList() {
  // ❌ Poor - creates new array on every render
  const incompleteTodos = useSelector(state => state.todos.filter(todo => !todo.completed))

  // ✅ Better - use memoized selector
  const incompleteTodos = useSelector(state => state.todos).filter(todo => !todo.completed)

  // ✅ Best - use store's built-in selector memoization
  const incompleteTodos = useSelector(state => state.todos.filter(todo => !todo.completed))
  // Open Store automatically memoizes this selector

  return (
    <div>
      {incompleteTodos.map(todo => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </div>
  )
}

// Component-level memoization
const TodoItem = React.memo(function TodoItem({todo}: {todo: Todo}) {
  const dispatch = useDispatch()

  const toggleComplete = useCallback(() => {
    dispatch({
      todos: todos.map(t => (t.id === todo.id ? {...t, completed: !t.completed} : t)),
    })
  }, [todo.id, dispatch])

  return (
    <div>
      <span>{todo.text}</span>
      <button onClick={toggleComplete}>{todo.completed ? 'Undo' : 'Complete'}</button>
    </div>
  )
})

// Subscription optimization
function UserProfileDisplay() {
  // ❌ Poor - subscribes to entire user object
  const user = useSelector(state => state.user)

  // ✅ Better - subscribe only to needed fields
  const displayName = useSelector(state => state.user.profile.name || 'Anonymous')
  const avatarUrl = useSelector(state => state.user.profile.avatar)

  // ✅ Best - use path-based subscription for deep values
  const theme = useStoreValue<'light' | 'dark'>('user.preferences.theme')

  return (
    <div className={`profile theme-${theme}`}>
      <img src={avatarUrl} alt="Avatar" />
      <h2>{displayName}</h2>
    </div>
  )
}
```

## TypeScript Integration

Open Store provides excellent TypeScript support with full type inference:

```tsx
// Define your state shape with TypeScript
interface AppState {
  user: {
    profile: {
      name: string
      email: string
      avatar?: string
    }
    preferences: {
      theme: 'light' | 'dark'
      language: string
      notifications: boolean
    }
    authentication: {
      token: string | null
      isLoggedIn: boolean
      lastLogin?: number
    }
  }
  todos: Array<{
    id: number
    text: string
    completed: boolean
    priority: 'low' | 'medium' | 'high'
    dueDate?: Date
    tags: string[]
  }>
  ui: {
    sidebarOpen: boolean
    currentView: 'list' | 'grid' | 'calendar'
    loading: boolean
    error: string | null
  }
}

// Create typed store
const store = createStore<AppState>({
  user: {
    profile: {name: '', email: ''},
    preferences: {theme: 'light', language: 'en', notifications: true},
    authentication: {token: null, isLoggedIn: false},
  },
  todos: [],
  ui: {sidebarOpen: false, currentView: 'list', loading: false, error: null},
})

// All hooks are fully typed
const {useSelector, useDispatch, useStoreValue, useTransaction} = createStoreContext(store)

// TypeScript provides full intellisense and type checking
function TypedComponent() {
  // Selector is typed - IDE shows available properties
  const userName = useSelector(state => state.user.profile.name) // string
  const todoCount = useSelector(state => state.todos.length) // number
  const theme = useSelector(state => state.user.preferences.theme) // 'light' | 'dark'

  // Dispatch is typed - only valid state shapes are allowed
  const dispatch = useDispatch()

  const updateTheme = (newTheme: 'light' | 'dark') => {
    dispatch({
      user: {
        ...store.getState().user,
        preferences: {
          ...store.getState().user.preferences,
          theme: newTheme, // TypeScript ensures this is correct type
        },
      },
    })
  }

  // Path-based access with type annotations
  const currentView = useStoreValue<'list' | 'grid' | 'calendar'>('ui.currentView')
  const userEmail = useStoreValue<string>('user.profile.email')

  // Transactions are fully typed with Immer's Draft types
  const transaction = useTransaction()

  const addTodo = (text: string, priority: 'low' | 'medium' | 'high') => {
    transaction(draft => {
      // draft is typed as Draft<AppState>
      draft.todos.push({
        id: Date.now(),
        text,
        completed: false,
        priority, // TypeScript ensures this matches the union type
        tags: [],
      })

      // TypeScript catches typos and wrong types
      draft.ui.loading = false // ✅ boolean is correct
      // draft.ui.loading = 'false' // ❌ TypeScript error
    })
  }

  return (
    <div className={`app theme-${theme}`}>
      <h1>Hello, {userName}!</h1>
      <p>You have {todoCount} todos</p>
      <button onClick={() => updateTheme(theme === 'light' ? 'dark' : 'light')}>
        Toggle Theme
      </button>
    </div>
  )
}

// Custom hooks with TypeScript
function useTypedUser() {
  const user = useSelector(state => state.user)
  const dispatch = useDispatch()

  const updateProfile = useCallback(
    (updates: Partial<AppState['user']['profile']>) => {
      dispatch({
        user: {
          ...user,
          profile: {...user.profile, ...updates},
        },
      })
    },
    [user, dispatch]
  )

  return {
    user,
    isLoggedIn: user.authentication.isLoggedIn,
    updateProfile,
  }
}
```

## Testing Patterns

Open Store integrates well with React testing patterns:

```tsx
import {render, screen, fireEvent, waitFor} from '@testing-library/react'
import {createStore} from 'open-store'
import {createStoreContext} from 'open-store/react'

// Create test utilities
function createTestStore(initialState?: Partial<AppState>) {
  return createStore<AppState>({
    count: 0,
    user: {name: '', email: ''},
    todos: [],
    ...initialState,
  })
}

function renderWithStore(component: React.ReactElement, initialState?: Partial<AppState>) {
  const store = createTestStore(initialState)
  const {StoreProvider} = createStoreContext(store)

  return {
    ...render(<StoreProvider>{component}</StoreProvider>),
    store, // Return store for direct testing if needed
  }
}

// Test components
describe('Counter Component', () => {
  test('displays initial count', () => {
    renderWithStore(<Counter />, {count: 5})
    expect(screen.getByText('Count: 5')).toBeInTheDocument()
  })

  test('increments count when button clicked', () => {
    renderWithStore(<Counter />, {count: 0})

    fireEvent.click(screen.getByText('Increment'))
    expect(screen.getByText('Count: 1')).toBeInTheDocument()
  })

  test('updates multiple times', () => {
    renderWithStore(<Counter />, {count: 0})

    const button = screen.getByText('Increment')
    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.click(button)

    expect(screen.getByText('Count: 3')).toBeInTheDocument()
  })
})

// Test async operations
describe('Async Data Loading', () => {
  test('handles loading states', async () => {
    // Mock fetch
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({name: 'John', email: 'john@example.com'}),
      })
    ) as jest.Mock

    renderWithStore(<UserLoader />)

    fireEvent.click(screen.getByText('Load User'))

    // Check loading state
    expect(screen.getByText('Loading...')).toBeInTheDocument()

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument()
    })

    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  test('handles error states', async () => {
    // Mock fetch to fail
    global.fetch = jest.fn(() => Promise.reject(new Error('Network error'))) as jest.Mock

    renderWithStore(<UserLoader />)

    fireEvent.click(screen.getByText('Load User'))

    await waitFor(() => {
      expect(screen.getByText(/Error: Network error/)).toBeInTheDocument()
    })
  })
})

// Test store directly
describe('Store Operations', () => {
  test('store updates correctly', () => {
    const store = createTestStore()

    // Test initial state
    expect(store.getState().count).toBe(0)

    // Test dispatch
    store.dispatch({count: 5})
    expect(store.getState().count).toBe(5)

    // Test transactions
    store.transaction(draft => {
      draft.count += 10
      draft.user.name = 'Test User'
    })

    expect(store.getState().count).toBe(15)
    expect(store.getState().user.name).toBe('Test User')
  })

  test('subscriptions work correctly', () => {
    const store = createTestStore()
    const listener = jest.fn()

    const unsubscribe = store.subscribe(listener)

    store.dispatch({count: 1})
    expect(listener).toHaveBeenCalledTimes(1)

    store.dispatch({count: 2})
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    store.dispatch({count: 3})
    expect(listener).toHaveBeenCalledTimes(2) // Not called after unsubscribe
  })
})
```
