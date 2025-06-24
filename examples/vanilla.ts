/**
 * Example: Vanilla TypeScript Usage
 *
 * This example demonstrates the complete vanilla TypeScript usage
 * of the Open Store, showcasing all core features and capabilities.
 *
 * Note: The import below uses a relative path for development purposes.
 * In a real application, you would import from the published package:
 *
 * import { createStore } from "open-store";
 */

import {createStore} from '../src/index.js'

// Example state interface
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
  }
}

// Create store with initial state
const store = createStore<AppState>(
  {
    user: {
      id: null,
      name: '',
      email: '',
    },
    todos: [],
    settings: {
      theme: 'light',
    },
  },
  {
    // Optional: Enable persistence
    persistKey: 'vanilla-app-state',
    // Enable history for undo/redo
    historyLimit: 50,
  }
)

// Subscribe to changes
const unsubscribe = store.subscribe((state, prevState) => {
  console.log('State changed:', {newState: state, prevState})
})

// Dispatch actions
console.log('Initial state:', store.getState())

// Simple state update
store.dispatch({
  user: {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
  },
})

// Add todos
store.dispatch({
  todos: [
    {id: 1, text: 'Learn Open Store', completed: false},
    {id: 2, text: 'Build awesome app', completed: false},
  ],
})

// Using thunk for complex logic
store.dispatch(async (dispatch, getState, updatePath, transaction, batch) => {
  console.log('Running async thunk...')

  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000))

  const currentState = getState()
  dispatch({
    todos: [...currentState.todos, {id: 3, text: 'Async todo', completed: false}],
  })

  console.log('Async thunk completed')
})

// Using transactions for multiple updates
store.transaction(draft => {
  draft.user.name = 'Jane Smith'
  draft.settings.theme = 'dark'
  // All changes committed together
})

// Using path updates
store.updatePath(['user', 'email'], () => 'jane@example.com')

// Using batch updates
store.batch(() => {
  store.dispatch({user: {...store.getState().user, name: 'Batched Name'}})
  store.dispatch({settings: {theme: 'light'}})
  // All updates batched together, only one notification
})

// Use selectors
const userSelector = store.select(state => state.user)
const completedTodosSelector = store.select(state => state.todos.filter(todo => todo.completed))

console.log('Current user:', userSelector())
console.log('Completed todos:', completedTodosSelector())

// History management
const history = store.getHistory()
console.log('History state:', history)

// Undo/redo operations

if (store.undo()) {
  console.log('Undoing last action...')
} else {
  console.log('Unable to undo, no previous state available. or history is empty or disabled.')
}

if (store.redo()) {
  console.log('Redoing last action...')
} else {
  console.log('Unable to redo, no next state available. or history is empty or disabled.')
}

// Read-only store interface
const readOnlyStore = store.asReadOnly()
console.log('Read-only state:', readOnlyStore.getState())
// readOnlyStore.dispatch(...); // This would cause TypeScript error

//Cleanup
unsubscribe()

export default store
