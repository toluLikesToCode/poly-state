# Poly State React Integration Guide

Poly State provides a powerful and intuitive React integration that makes state management feel
natural and performant. This guide covers both traditional context-based integration and the new
context-free approach, giving you flexibility to choose the best pattern for your use case.

## Table of Contents

- [Quick Start](#quick-start)
- [Context-Free Integration](#context-free-integration---deep-dive)
- [Traditional Context Integration](#traditional-context-integration)
- [Core Hooks and Usage](#core-hooks-and-usage)
- [Advanced State Updates](#advanced-state-updates)
- [Subscriptions and Side Effects](#subscriptions-and-side-effects)
- [Async Operations](#async-operations-and-loading-states)
- [History and Time Travel](#history-and-time-travel)
- [Advanced Patterns](#advanced-patterns-and-best-practices)
- [TypeScript Integration](#typescript-integration)
- [Testing Patterns](#testing-patterns)

## Quick Start

Poly State offers two approaches for React integration. Choose the one that fits your needs:

### Context-Free Approach (Recommended for Simple Cases)

Perfect for simple components, testing, and gradual migration:

```tsx
import {createStore} from 'poly-state'
import {useStoreHooks} from 'poly-state/react'

// Create your store
const appStore = createStore({
  count: 0,
  user: {name: '', email: ''},
  todos: [],
})

// Use in components - no provider needed!
function Counter() {
  const {useSelector, useDispatch} = useStoreHooks(appStore)
  const count = useSelector(state => state.count)
  const dispatch = useDispatch()

  return <button onClick={() => dispatch({count: count + 1})}>Count: {count}</button>
}

// No provider wrapper required
function App() {
  return <Counter />
}
```

### Traditional Context Approach (Recommended for Large Apps)

Ideal for applications with many components and centralized state management:

```tsx
import {createStore} from 'poly-state'
import {createStoreContext} from 'poly-state/react'

// Define your state shape
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

## Context-Free Integration - Deep Dive

The `useStoreHooks` function provides a clean, optional way to use Poly State with React components
without requiring any context setup. This approach is useful for:

- **Simple components** that need direct store access
- **Testing scenarios** where you want isolated store instances
- **Gradual migration** from other state management libraries
- **Library components** that shouldn't depend on providers

### Basic Context-Free Usage

```tsx
import {createStore} from 'poly-state'
import {useStoreHooks} from 'poly-state/react'

// Create your store
const appStore = createStore({
  count: 0,
  user: {name: '', email: ''},
  todos: [],
})

// Use in components - no provider needed!
function Counter() {
  const {useSelector, useDispatch} = useStoreHooks(appStore)
  const count = useSelector(state => state.count)
  const dispatch = useDispatch()

  return <button onClick={() => dispatch({count: count + 1})}>Count: {count}</button>
}

// No provider wrapper required
function App() {
  return <Counter />
}
```

### Advanced Context-Free Features

All store features work exactly the same as with context-based integration:

```tsx
function AdvancedComponent() {
  const {
    useSelector,
    useStoreValue, // Path-based access
    useTransaction, // Atomic updates
    useAsyncThunk, // Async operations
    useBatch, // Batched updates
    useUpdatePath, // Enhanced type-safe path updates
  } = useStoreHooks(appStore)

  const userName = useStoreValue<string>('user.name')
  const transaction = useTransaction()
  const {execute, loading, error} = useAsyncThunk()

  const updateUser = () => {
    transaction(draft => {
      draft.user.name = 'John Doe'
      draft.user.email = 'john@example.com'
    })
  }

  const loadData = async () => {
    await execute(async ctx => {
      const response = await fetch('/api/data')
      const data = await response.json()
      ctx.dispatch({user: data.user})
    })
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      <h2>{userName || 'No user'}</h2>
      <button onClick={updateUser}>Update User</button>
      <button onClick={loadData}>Load Data</button>
    </div>
  )
}
```

### Perfect for Testing

Context-free hooks make testing much simpler:

```tsx
import {render, screen, fireEvent} from '@testing-library/react'
import {createStore} from 'poly-state'
import {useStoreHooks} from 'poly-state/react'

function TestComponent() {
  const testStore = createStore({count: 5})
  const {useSelector, useDispatch} = useStoreHooks(testStore)
  const count = useSelector(state => state.count)
  const dispatch = useDispatch()

  return (
    <div>
      <span data-testid="count">{count}</span>
      <button onClick={() => dispatch({count: count + 1})}>Increment</button>
    </div>
  )
}

test('component works with isolated store', () => {
  render(<TestComponent />)
  expect(screen.getByTestId('count')).toHaveTextContent('5')

  fireEvent.click(screen.getByText('Increment'))
  expect(screen.getByTestId('count')).toHaveTextContent('6')
})
```

### Multiple Stores with Context-Free

You can easily work with multiple stores:

```tsx
const userStore = createStore({name: '', email: ''})
const settingsStore = createStore({theme: 'light', language: 'en'})

function MultiStoreComponent() {
  const {useSelector: useUserSelector} = useStoreHooks(userStore)
  const {useSelector: useSettingsSelector} = useStoreHooks(settingsStore)

  const userName = useUserSelector(state => state.name)
  const theme = useSettingsSelector(state => state.theme)

  return <div className={`theme-${theme}`}>Hello, {userName}!</div>
}
```

### Context-Free Performance

- **Efficient caching**: Hooks are created once per store and reused across components
- **Optimal re-renders**: Only components using changed state values re-render
- **Memory friendly**: WeakMap ensures hooks are garbage collected with stores

## Traditional Context Integration

For larger applications, the traditional context-based approach provides centralized state
management:

### Understanding the Architecture

Poly State's React integration is built around a few key concepts that work together to provide
efficient state management:

**Store Creation**: You start by creating a store instance that holds your application state. This
store exists outside of React and can be used independently.

**Context Generation**: The `createStoreContext` function generates a complete set of React hooks
and components tailored to your specific store. This approach provides excellent TypeScript
inference and prevents common mistakes.

**Selective Subscriptions**: Unlike many state management solutions, Poly State allows components to
subscribe only to the specific parts of state they need. This means components re-render only when
their relevant data changes.

**Immutable Updates**: All state updates preserve immutability while leveraging structural sharing
for performance. The library uses Immer under the hood for complex updates.

### Installation and Setup

```bash
# Note: This package is still in development thus its not yet available on npm.

# To install first download the source code. Then install yalc:
npm install -g yalc

# Then publish the package locally
cd path/to/poly-state
yalc publish

# Now you can add it to your project
cd path/to/your/project
yalc add poly-state


# When available on npm, you can install it directly:
npm install poly-state
# or
yarn add poly-state
# or
pnpm add poly-state
```

Poly State requires React 16.8 or later for hook support. TypeScript is strongly recommended for the
best development experience, though not required.

## Core Hooks and Usage

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
Poly State automatically compares the returned values using deep equality, so your component won't
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

### Path Updates - Enhanced Type Safety and Flexibility

The `useUpdatePath` hook provides a powerful, type-safe way to update nested state values with
multiple approaches for different use cases:

```tsx
function NestedDataEditor() {
  const updatePath = useUpdatePath()
  const userProfile = useSelector(state => state.user.profile)

  // Type-safe path updates with compile-time validation
  const updateUserName = (name: string) => {
    updatePath(['user', 'profile', 'name'], (current: string) => name.toUpperCase())
  }

  // Direct value assignment (no function needed)
  const markAsVerified = () => {
    updatePath(['user', 'profile', 'verified'], true)
  }

  // Delete properties by returning undefined
  const clearTemporaryData = () => {
    updatePath(['user', 'temporaryFlag'], () => undefined)
  }

  // Complex array operations with proper typing
  const addNotification = (notification: Notification) => {
    updatePath(['user', 'notifications'], (current: Notification[]) => [
      ...current,
      notification
    ])
  }

  // Increment counters with explicit typing
  const incrementLoginCount = () => {
    updatePath<number>(['user', 'stats', 'loginCount'], (current) => current + 1)
  }

  // Toggle boolean values with type inference
  const toggleNotificationSetting = (settingName: string) => {
    updatePath(['user', 'settings', settingName], (current: boolean) => !current)
  }

  return (
    <div>
      <input
        value={userProfile.name}
        onChange={(e) => updateUserName(e.target.value)}
      />
      <button onClick={markAsVerified}>Mark as Verified</button>
      <button onClick={clearTemporaryData}>Clear Temp Data</button>
      <button onClick={incrementLoginCount}>Track Login</button>
    </div>
  )
}

  // Delete properties by returning undefined
  const removeTemporaryFlag = () => {
    updatePath(['user', 'temporaryData'], () => undefined)
  }

  // Flexible runtime paths with direct value assignment
  const updateAddress = (field: string, value: string) => {
    updatePath<string>(['user', 'profile', 'address', field], value)
  }

  // Complex updates with full type safety
  const incrementLoginCount = () => {
    updatePath(['user', 'stats', 'loginCount'], (current: number) => current + 1)
  }

  // Array operations with proper typing
  const addTodo = (newTodo: Todo) => {
    updatePath(['todos'], (todos: Todo[]) => [...todos, newTodo])
  }

  // Toggle boolean values
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
      <button onClick={() => markAsVerified()}>
        Mark as Verified
      </button>
      <button onClick={() => removeTemporaryFlag()}>
        Clear Temporary Data
      </button>
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

#### updatePath Type Safety Levels

The `useUpdatePath` hook provides three levels of type safety to accommodate different use cases:

```tsx
function UpdatePathExamples() {
  const updatePath = useUpdatePath()

  // 1. Compile-time type safety (recommended)
  // TypeScript validates both path existence and value types
  const updateUserName = () => {
    updatePath(['user', 'profile', 'name'], (current: string) => current.trim())
    //         ^^^^^^^^^^^^^^^^^^^^^^^^^^ - Path validated at compile time
    //                                    ^^^^^^^^^^^^^^^^^^^^^^ - Value type inferred as string
  }

  // 2. Runtime flexibility with explicit typing
  // Use when paths are dynamic but you know the value type
  const updateDynamicField = (fieldName: string, value: any) => {
    updatePath<string>(['user', 'profile', fieldName], () => value)
    //        ^^^^^^^^ - Explicit type annotation for value
  }

  // 3. Maximum flexibility for complex scenarios
  // Use when dealing with completely dynamic structures
  const updateAnyPath = (path: (string | number)[], updater: any) => {
    updatePath(path, updater)
  }

  // Value assignment patterns
  const demonstrateValuePatterns = () => {
    // Function updaters (most common)
    updatePath(['count'], (current: number) => current + 1)

    // Direct value assignment
    updatePath(['user', 'isActive'], true)

    // Deletion by returning undefined
    updatePath(['user', 'temporaryToken'], () => undefined)

    // Complex updates with side effects
    updatePath(['user', 'lastLogin'], () => {
      console.log('User logged in')
      return new Date().toISOString()
    })
  }

  return <div>Path update examples...</div>
}
```

## Subscriptions and Side Effects

### useSubscribeTo - React to State Changes

Sometimes you need to perform side effects when specific state changes occur:

```tsx
function NotificationManager() {
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

  // Path arrays are also supported
  useSubscribeToPath(
    ['user', 'profile', 'completeness'], // Same result as above
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

Poly State provides built-in patterns for handling async operations with loading and error states:

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

Poly State includes built-in undo/redo functionality that integrates seamlessly with React:

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

// Option 1: Create separate contexts (traditional approach)
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

// Option 2: Use context-free hooks (simpler approach)
function UserProfile() {
  const {useSelector, useDispatch} = useStoreHooks(userStore)
  const profile = useSelector(state => state.profile)
  const dispatch = useDispatch()

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

// Using custom hooks in components
function TodoApp() {
  const {user, isLoggedIn} = useUser()

  if (!isLoggedIn) {
    return <LoginForm />
  }

  return (
    <div>
      <h1>Welcome, {user.profile.name}!</h1>
      <TodoList />
    </div>
  )
}
```

### Performance Optimization Patterns

Poly State includes several patterns for optimizing performance in React applications:

```tsx
// Selector optimization - avoid creating new objects in selectors
function TodoList() {
  // ❌ Poor - creates new array on every render
  const incompleteTodos = useSelector(state => state.todos.filter(todo => !todo.completed))

  // ✅ Better - use memoized selector
  const incompleteTodos = useSelector(state => state.todos).filter(todo => !todo.completed)

  // ✅ Best - use store's built-in selector memoization
  const incompleteTodos = useSelector(state => state.todos.filter(todo => !todo.completed))
  // Poly State automatically memoizes this selector

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

Poly State provides excellent TypeScript support with full type inference:

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

// All hooks are fully typed for both approaches
const {useSelector, useDispatch, useStoreValue, useTransaction} = createStoreContext(store)
// OR
const {useSelector, useDispatch, useStoreValue, useTransaction} = useStoreHooks(store)

// TypeScript provides full intellisense and type checking
function TypedComponent() {
  // Selector is typed - IDE shows available properties
  const userName = useSelector(state => state.user.profile.name) // string
  const todoCount = useSelector(state => state.todos.length) // number
  const theme = useSelector(state => state.user.preferences.theme) // 'light' | 'dark'

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
        priority,
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
    </div>
  )
}
```

## Testing Patterns

Poly State integrates well with React testing patterns for both approaches:

### Testing Context-Based Components

```tsx
import {render, screen, fireEvent, waitFor} from '@testing-library/react'
import {createStore} from 'poly-state'
import {createStoreContext} from 'poly-state/react'

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
})
```

### Testing Context-Free Components

```tsx
import {render, screen, fireEvent} from '@testing-library/react'
import {createStore} from 'poly-state'
import {useStoreHooks} from 'poly-state/react'

function TestComponent() {
  const testStore = createStore({count: 5})
  const {useSelector, useDispatch} = useStoreHooks(testStore)
  const count = useSelector(state => state.count)
  const dispatch = useDispatch()

  return (
    <div>
      <span data-testid="count">{count}</span>
      <button onClick={() => dispatch({count: count + 1})}>Increment</button>
    </div>
  )
}

test('context-free component works with isolated store', () => {
  render(<TestComponent />)
  expect(screen.getByTestId('count')).toHaveTextContent('5')

  fireEvent.click(screen.getByText('Increment'))
  expect(screen.getByTestId('count')).toHaveTextContent('6')
})

// Test async operations
describe('Async Data Loading', () => {
  test('handles loading states', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({name: 'John', email: 'john@example.com'}),
      })
    ) as jest.Mock

    render(<UserLoader />)

    fireEvent.click(screen.getByText('Load User'))

    expect(screen.getByText('Loading...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument()
    })

    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })
})
```

## When to Use Each Approach

### Use Context-Free (`useStoreHooks`) When

- Building simple components or demos
- Writing tests with isolated store instances
- Migrating from other state libraries gradually
- Creating library components that shouldn't depend on providers
- Working with multiple independent stores
- Prototyping or building small applications

### Use Context-Based (`createStoreContext`) When

- Building larger applications with many components
- You want centralized provider setup
- Components are deeply nested and need store access
- You prefer the explicit provider pattern
- You need centralized error boundaries or middleware setup
- Working with a single primary application store

Both approaches provide the exact same functionality and performance characteristics - choose what
works best for your use case! You can even mix both approaches in the same application as needed.
