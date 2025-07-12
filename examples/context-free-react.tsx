/**
 * @fileoverview Example demonstrating context-free React integration
 *
 * This example shows how to use Poly State with React without any context setup,
 * making it perfect for simple components, testing, or when you prefer direct
 * store passing over context providers.
 */

import React from 'react'
import {createStore} from '../src/index'
import {useStoreHooks} from '../src/react'

// Define state interface
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
}

// Create store
const appStore = createStore<AppState>({
  count: 0,
  user: {
    name: '',
    email: '',
  },
  todos: [],
})

// Simple counter component - no provider needed!
function Counter() {
  const {useSelector, useDispatch, useTransaction} = useStoreHooks(appStore)
  const count = useSelector(state => state.count)
  const dispatch = useDispatch()
  const transaction = useTransaction()

  const increment = () =>
    transaction(draft => {
      draft.count += 1
    })

  const decrement = () => dispatch({count: count - 1})

  return (
    <div>
      <h2>Counter: {count}</h2>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  )
}

// User profile component with advanced features
function UserProfile() {
  const {useStoreValue, useTransaction, useAsyncThunk, useStoreHistory} = useStoreHooks(appStore)

  const userName = useStoreValue<string>('user.name')
  const userEmail = useStoreValue<string>('user.email')
  const transaction = useTransaction()
  const {execute, loading, error} = useAsyncThunk()
  const {undo, redo, canUndo, canRedo} = useStoreHistory()

  const updateUser = () => {
    transaction(draft => {
      draft.user.name = 'John Doe'
      draft.user.email = 'john@example.com'
    })
  }

  const loadUserFromAPI = async () => {
    await execute(async ({dispatch}) => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      const userData = {name: 'Jane Smith', email: 'jane@example.com'}
      dispatch({user: userData})
      return userData // Return the data from the thunk
    })
  }

  return (
    <div>
      <h2>User Profile</h2>
      <p>Name: {userName || 'Not set'}</p>
      <p>Email: {userEmail || 'Not set'}</p>

      <button onClick={updateUser}>Set User to John</button>
      <button onClick={loadUserFromAPI} disabled={loading}>
        {loading ? 'Loading...' : 'Load Jane from API'}
      </button>

      {error && <p style={{color: 'red'}}>Error: {error.message}</p>}

      <div>
        <button onClick={() => undo()} disabled={!canUndo}>
          Undo
        </button>
        <button onClick={() => redo()} disabled={!canRedo}>
          Redo
        </button>
      </div>
    </div>
  )
}

// Todo list component
function TodoList() {
  const {useSelector, useTransaction} = useStoreHooks(appStore)
  const todos = useSelector(state => state.todos)
  const transaction = useTransaction()

  const addTodo = () => {
    const text = prompt('Enter todo text:')
    if (text) {
      transaction(draft => {
        draft.todos.push({
          id: Date.now(),
          text,
          completed: false,
        })
      })
    }
  }

  const toggleTodo = (id: number) => {
    transaction(draft => {
      const todo = draft.todos.find(t => t.id === id)
      if (todo) {
        todo.completed = !todo.completed
      }
    })
  }

  return (
    <div>
      <h2>Todos ({todos.length})</h2>
      <button onClick={addTodo}>Add Todo</button>
      <ul>
        {todos.map(todo => (
          <li key={todo.id}>
            <label>
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
              />
              <span
                style={{
                  textDecoration: todo.completed ? 'line-through' : 'none',
                }}>
                {todo.text}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Main app - no provider needed!
export default function App() {
  return (
    <div style={{padding: '20px'}}>
      <h1>Poly State Context-Free Demo</h1>
      <p>This demo shows using Poly State with React without any context setup!</p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '20px',
          marginTop: '20px',
        }}>
        <Counter />
        <UserProfile />
        <TodoList />
      </div>
    </div>
  )
}

// Example for testing - perfect for unit tests
export function TestComponent() {
  const testStore = createStore({value: 42})
  const {useSelector, useDispatch} = useStoreHooks(testStore)
  const value = useSelector(state => state.value)
  const dispatch = useDispatch()

  return (
    <div>
      <span data-testid="value">{value}</span>
      <button onClick={() => dispatch({value: value + 1})}>Increment</button>
    </div>
  )
}
