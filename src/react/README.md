# Poly State React Integration Guide

Poly State provides a powerful and intuitive React integration for scalable, maintainable state
management in React apps. This guide focuses on optimal usage patterns: custom hooks for domain
logic, thunks/selectors defined outside context, and modular architecture. Both context-based and
context-free approaches are supported, but we recommend custom hooks and modular patterns for most
real-world applications.

## Table of Contents

- [Quick Start](#quick-start)
- [Recommended Modular Patterns](#recommended-modular-patterns)
- [Custom Hooks for Domain Logic](#custom-hooks-for-domain-logic)
- [Selectors and Thunks Best Practices](#selectors-and-thunks-best-practices)
- [Advanced State Updates](#advanced-state-updates)
- [Subscriptions and Side Effects](#subscriptions-and-side-effects)
- [Async Operations](#async-operations-and-loading-states)
- [History and Time Travel](#history-and-time-travel)
- [TypeScript Integration](#typescript-integration)
- [Testing Patterns](#testing-patterns)

## Quick Start

Poly State supports both context-based and context-free integration. For optimal scalability and
maintainability, we recommend:

- **Define selectors and thunks outside React context** (in shared modules)
- **Create custom hooks for each domain/feature** that consume Poly State hooks and expose
  specialized state/actions
- **Use context-based integration for large apps, context-free for tests or isolated features**

### Example: Modular Custom Hook Pattern (Recommended)

```tsx
// store/galleryStore.ts
import {createStore} from 'poly-state'
import {createStoreContext} from 'poly-state/react'
export const galleryStore = createStore({
  mode: 'grid',
  activeItemIndex: 0,
  items: [],
})

// Export context utilities for use in app
const {StoreProvider, StoreContext, ...StoreHooks} = createStoreContext(galleryStore)
export {StoreContext, StoreHooks, StoreProvider}

// selectors/gallerySelectors.ts
import {galleryStore} from '../store/galleryStore'
export const selectActiveItem = galleryStore.select(state => state.items[state.activeItemIndex])
export const selectSeenItems = galleryStore.select(state => state.items.filter(item => item.seen))

// thunks/galleryThunks.ts
export const markItemSeen = ({dispatch, getState}, itemId) => {
  const items = getState().items.map(item => (item.id === itemId ? {...item, seen: true} : item))
  dispatch({items})
}

// hooks/useGallery.ts
import {useSelector, useThunk} from 'poly-state/react'
import {selectActiveItem, selectSeenItems} from '../selectors/gallerySelectors'
import {markItemSeen} from '../thunks/galleryThunks'

export function useGallery() {
  const activeItem = useSelector(selectActiveItem)
  const seenItems = useSelector(selectSeenItems)
  const runThunk = useThunk()
  const markSeen = id => runThunk(markItemSeen, id)
  return {activeItem, seenItems, markSeen}
}

// components/GalleryView.tsx
import {useGallery} from '../hooks/useGallery'
function GalleryView() {
  const {activeItem, seenItems, markSeen} = useGallery()
  // ...render UI
}

// App.tsx
import {createStoreContext} from 'poly-state/react'
import {galleryStore} from './store/galleryStore'
import {GalleryView} from './components/GalleryView'
const {StoreProvider} = createStoreContext(galleryStore)
export function App() {
  return (
    <StoreProvider>
      <GalleryView />
    </StoreProvider>
  )
}
```

## Recommended Modular Patterns

### Why Modular Custom Hooks?

- **Encapsulation:** Bundle selectors, thunks, and state logic for a specific domain (e.g., gallery,
  user, todos)
- **Reusability:** Components use hooks without knowing store internals
- **Type Safety:** Strongly type returned values and actions
- **Testability:** Hooks are easy to test in isolation
- **Maintainability:** Centralizes business logic, making refactoring and scaling easier

### Example: Custom Hook for Gallery Domain

```tsx
// hooks/useGallery.ts
import {useSelector, useThunk} from 'poly-state/react'
import {selectActiveItem, selectSeenItems} from '../selectors/gallerySelectors'
import {markItemSeen} from '../thunks/galleryThunks'

export function useGallery() {
  const activeItem = useSelector(selectActiveItem)
  const seenItems = useSelector(selectSeenItems)
  const runThunk = useThunk()
  const markSeen = id => runThunk(markItemSeen, id)
  return {activeItem, seenItems, markSeen}
}
```

### Usage in Components

```tsx
import {useGallery} from '../hooks/useGallery'
function GalleryView() {
  const {activeItem, seenItems, markSeen} = useGallery()
  // ...render UI
}
```

### Context Setup for Large Apps

```tsx
import {createStoreContext} from 'poly-state/react'
import {galleryStore} from './store/galleryStore'
import {GalleryView} from './components/GalleryView'
const {StoreProvider} = createStoreContext(galleryStore)
export function App() {
  return (
    <StoreProvider>
      <GalleryView />
    </StoreProvider>
  )
}
```

their relevant data changes.

## Selectors and Thunks Best Practices

- **Define selectors and thunks outside React context** for reusability and testability
- **Use custom hooks to consume selectors/thunks and expose specialized logic**
- **Dispatch thunks via hooks for async/multi-step actions**

### Example: Async Thunk Pattern

```tsx
// thunks/userThunks.ts
export const fetchUser: Thunk<AppState, User> = async ({dispatch}) => {
  const res = await fetch('/api/user')
  const user = await res.json()
  dispatch({user})
  return user
} // Thunk<AppState, User> annotation ensures type safety and infers the thunks methods like dispatch, transaction, etc.

// hooks/useUser.ts
import {useSelector, useAsyncThunk} from 'poly-state/react'
import {fetchUser} from '../thunks/userThunks'
export function useUser() {
  const user = useSelector(state => state.user)
  const {execute, loading, error} = useAsyncThunk()
  const loadUser = () => execute(fetchUser)
  return {user, loadUser, loading, error}
}
```

## Custom Hooks for Domain Logic

Custom hooks should encapsulate all state logic for a domain/feature. This keeps components clean
and focused on UI.

### Example: User Domain

```tsx
// store/userStore.ts
import {createStore} from 'poly-state'
export const userStore = createStore({
  profile: {name: '', email: ''},
  preferences: {theme: 'light', language: 'en'},
  authentication: {token: null, isLoggedIn: false},
})

// selectors/userSelectors.ts
export const selectUser = userStore.select(state => state.profile)

// hooks/useUser.ts
import {useSelector, useDispatch, useAsyncThunk} from 'poly-state/react'
import {selectUser} from '../selectors/userSelectors'
import {fetchUser} from '../thunks/userThunks'

export function useUser() {
  const user = useSelector(selectUser)
  const dispatch = useDispatch()
  const {execute, loading, error} = useAsyncThunk()
  const updateUser = updates => dispatch({profile: {...user, ...updates}})
  const loadUser = () => execute(fetchUser)
  return {user, updateUser, loadUser, loading, error}
}

// Usage in component
function UserProfile() {
  const {user, updateUser, loadUser, loading, error} = useUser()
  // ...render UI
}
```

## Advanced State Updates

- Use transactions (`useTransaction`) for atomic multi-field updates
- Use batching (`useBatch`) for performance when updating multiple slices
- Use path-based access (`useStoreValue`, `useUpdatePath`) for deep/nested state

### Example: Transaction Pattern

```tsx
import {useSelector, useTransaction} from 'poly-state/react'
function TodoManager() {
  const todos = useSelector(state => state.todos)
  const transaction = useTransaction()
  const addTodo = text => {
    transaction(draft => {
      draft.todos.push({id: Date.now(), text, completed: false})
      draft.stats.totalTodos += 1
    })
  }
  // ...render UI
}
```

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

## Subscriptions and Side Effects

- Use `useSubscribeTo` and `useSubscribeToPath` for reacting to state changes
- Use `useStoreEffect` for complex effect scenarios

### Example: Notification Side Effect

```tsx
import {useSubscribeTo} from 'poly-state/react'
function NotificationManager() {
  useSubscribeTo(
    state => state.notifications.unread.length,
    (newCount, oldCount) => {
      if (newCount > oldCount) {
        new Notification(`You have ${newCount} unread notifications`)
      }
    },
    {immediate: false}
  )
  return null
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
    updatePath(['user', 'profile', 'name'], current => current.trim())
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

- Use `useAsyncThunk` for async actions with loading/error state

### Example: Async Data Loading

```tsx
import {useAsyncThunk, useSelector} from 'poly-state/react'
function DataLoader() {
  const {execute, loading, error} = useAsyncThunk()
  const data = useSelector(state => state.apiData)
  const loadUserData = async () => {
    await execute(async dispatch => {
      dispatch({loading: true, error: null})
      const response = await fetch('/api/user/profile')
      if (!response.ok) throw new Error('Failed to fetch')
      const userData = await response.json()
      dispatch({apiData: userData, lastFetch: Date.now()})
    })
  }
  // ...render UI
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
      await execute(async {dispatch} => {
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

- Use `useStoreHistory` for undo/redo and time travel debugging

### Example: Undo/Redo Controls

```tsx
import {useStoreHistory} from 'poly-state/react'
function HistoryControls() {
  const {canUndo, canRedo, undo, redo} = useStoreHistory()
  return (
    <div>
      <button disabled={!canUndo} onClick={undo}>
        Undo
      </button>
      <button disabled={!canRedo} onClick={redo}>
        Redo
      </button>
    </div>
  )
}
```

## Advanced Patterns and Best Practices

- **Split state into multiple stores for large apps**
- **Create custom hooks for each domain**
- **Use context-based integration for centralized state, context-free for isolated features/tests**

### Example: Multiple Store Setup

```tsx
// store/userStore.ts
export const userStore = createStore({
  profile: {name: '', email: ''},
  preferences: {theme: 'light', language: 'en'},
  authentication: {token: null, isLoggedIn: false},
})

// store/appStore.ts
export const appStore = createStore({
  ui: {sidebarOpen: false, currentPage: 'home'},
  data: {todos: [], projects: []},
})

// context setup
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
```

### Custom Hook Patterns

- **Create a custom hook for each domain/feature**
- **Expose only the state/actions needed by components**

### Example: useTodos Hook

```tsx
// store/appStore.ts
import {createStore} from 'poly-state'
export const appStore = createStore({
  ui: {sidebarOpen: false, currentPage: 'home'},
  data: {todos: [], projects: []},
})

// selectors/todoSelectors.ts
export const selectTodos = appStore.select(state => state.data.todos)

// hooks/useTodos.ts
import {useSelector, useTransaction} from 'poly-state/react'
import {selectTodos} from '../selectors/todoSelectors'

export function useTodos() {
  const todos = useSelector(selectTodos)
  const transaction = useTransaction()
  const addTodo = text => {
    transaction(draft => {
      draft.data.todos.push({id: Date.now(), text, completed: false})
    })
  }
  return {todos, addTodo}
}
```

### Performance Optimization Patterns

- **Use memoized selectors and path-based subscriptions for optimal re-renders**
- **Memoize components with React.memo when possible**

### Example: Optimized Todo List

```tsx
// selectors/todoSelectors.ts
export const selectIncompleteTodos = appStore.select(selectTodos, todos =>
  todos.filter(todo => !todo.completed)
)

function TodoList() {
  // Use memoized selector
  const incompleteTodos = useSelector(selectIncompleteTodos)
  return (
    <div>
      {incompleteTodos.map(todo => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </div>
  )
}

const TodoItem = React.memo(function TodoItem({todo}) {
  const dispatch = useDispatch()
  const toggleComplete = () => {
    dispatch({completed: !todo.completed})
  }
  return (
    <div>
      <span>{todo.text}</span>
      <button onClick={toggleComplete}>{todo.completed ? 'Undo' : 'Complete'}</button>
    </div>
  )
})
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

- **Use context-based integration and custom hooks for large, modular apps**
- **Use context-free hooks for tests, isolated features, or library components**
- **Mix both approaches as needed—Poly State supports both seamlessly**

Both approaches provide the same performance and features. For most real-world apps, prefer modular
custom hooks and context-based integration for maintainability and scalability.
