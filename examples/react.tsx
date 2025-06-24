/**
 * Example: React Usage
 *
 * This example demonstrates the complete React integration capabilities
 * of the Universal Store, including all available hooks and features.
 *
 * Note: The imports below use relative paths for development purposes.
 * In a real application, you would import from the published package:
 *
 * import { createStore } from "open-store";
 * import { createStoreContext } from "open-store/react";
 */

import React, {useState} from 'react'
import {createStore} from '../src/index.js'
import {createStoreContext} from '../src/react.js'

// Example state interface
interface AppState {
  count: number
  user: {
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
  }
}

// Create store
const store = createStore<AppState>({
  count: 0,
  user: {
    name: '',
    email: '',
  },
  todos: [],
  settings: {
    theme: 'light',
  },
})

// Create React context and hooks
const {
  StoreProvider,
  useSelector,
  useDispatch,
  useStoreHistory,
  useTransaction,
  useBatch,
  useAsyncThunk,
  useStoreEffect,
  useUpdatePath,
} = createStoreContext(store)

// Counter component with undo/redo
const Counter: React.FC = () => {
  const count = useSelector(state => state.count)
  const dispatch = useDispatch()
  const {undo, redo, canUndo, canRedo} = useStoreHistory()

  return (
    <div>
      <h3>Counter with History</h3>
      <p>Count: {count}</p>
      <button onClick={() => dispatch({count: count + 1})}>Increment</button>
      <button onClick={() => dispatch({count: count - 1})}>Decrement</button>
      <button onClick={() => undo()} disabled={!canUndo}>
        Undo
      </button>
      <button onClick={() => redo()} disabled={!canRedo}>
        Redo
      </button>
    </div>
  )
}

// User profile component with transactions
const UserProfile: React.FC = () => {
  const user = useSelector(state => state.user)
  const transaction = useTransaction()
  const updatePath = useUpdatePath()

  const handleUpdateUser = () => {
    transaction(draft => {
      draft.user.name = 'John Doe'
      draft.user.email = 'john@example.com'
    })
  }

  const handleUpdateName = () => {
    updatePath(['user', 'name'], () => 'Jane Smith')
  }

  return (
    <div>
      <h3>User Profile</h3>
      <p>Name: {user.name || 'No name'}</p>
      <p>Email: {user.email || 'No email'}</p>
      <button onClick={handleUpdateUser}>Update User</button>
      <button onClick={handleUpdateName}>Update Name Only</button>
    </div>
  )
}

// Todo list component with async actions
const TodoList: React.FC = () => {
  const todos = useSelector(state => state.todos)
  const dispatch = useDispatch()
  const {execute: addTodoAsync, loading} = useAsyncThunk()
  const [newTodoText, setNewTodoText] = useState('')

  const addTodo = () => {
    if (newTodoText.trim()) {
      dispatch({
        todos: [
          ...todos,
          {
            id: Date.now(),
            text: newTodoText,
            completed: false,
          },
        ],
      })
      setNewTodoText('')
    }
  }

  const addTodoWithDelay = () => {
    if (newTodoText.trim()) {
      addTodoAsync(async (dispatch, getState) => {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000))
        const currentState = getState()
        dispatch({
          todos: [
            ...currentState.todos,
            {
              id: Date.now(),
              text: newTodoText + ' (async)',
              completed: false,
            },
          ],
        })
      })
      setNewTodoText('')
    }
  }

  const toggleTodo = (id: number) => {
    dispatch({
      todos: todos.map(todo => (todo.id === id ? {...todo, completed: !todo.completed} : todo)),
    })
  }

  return (
    <div>
      <h3>Todo List</h3>
      <div>
        <input
          type="text"
          value={newTodoText}
          onChange={e => setNewTodoText(e.target.value)}
          placeholder="Enter todo text"
        />
        <button onClick={addTodo}>Add Todo</button>
        <button onClick={addTodoWithDelay} disabled={loading}>
          {loading ? 'Adding...' : 'Add Todo (Async)'}
        </button>
      </div>
      <ul>
        {todos.map(todo => (
          <li key={todo.id}>
            <span
              style={{
                textDecoration: todo.completed ? 'line-through' : 'none',
                cursor: 'pointer',
              }}
              onClick={() => toggleTodo(todo.id)}>
              {todo.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Settings component with theme switching
const Settings: React.FC = () => {
  const theme = useSelector(state => state.settings.theme)
  const dispatch = useDispatch()

  const toggleTheme = () => {
    dispatch({
      settings: {
        theme: theme === 'light' ? 'dark' : 'light',
      },
    })
  }

  // Use effect to demonstrate useStoreEffect
  useStoreEffect(
    state => state.settings.theme,
    (theme, prevTheme) => {
      console.log('Theme changed from', prevTheme, 'to', theme)
    }
  )

  return (
    <div>
      <h3>Settings</h3>
      <p>Current theme: {theme}</p>
      <button onClick={toggleTheme}>Toggle Theme</button>
    </div>
  )
}

// Main app component
const App: React.FC = () => {
  const theme = useSelector(state => state.settings.theme)

  return (
    <StoreProvider>
      <div
        style={{
          backgroundColor: theme === 'dark' ? '#333' : '#fff',
          color: theme === 'dark' ? '#fff' : '#333',
          padding: '20px',
          minHeight: '100vh',
        }}>
        <h1>Universal Store React Example</h1>
        <Counter />
        <hr />
        <UserProfile />
        <hr />
        <TodoList />
        <hr />
        <Settings />
      </div>
    </StoreProvider>
  )
}

export default App
