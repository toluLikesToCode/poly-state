/**
 * Example: Vanilla TypeScript Usage
 *
 * This example demonstrates the complete vanilla TypeScript usage
 * of the Poly State, showcasing all core features and capabilities.
 *
 * Note: The import below uses a relative path for development purposes.
 * In a real application, you would import from the published package:
 *
 * import { createStore } from "poly-state";
 */

import {createStore, Thunk} from '../src/index.js'

interface ToDo {
  id: number
  text: string
  completed: boolean
}

// Example state interface
interface AppState {
  user: {
    id: number | null
    name: string
    email: string
  }
  todos: ToDo[]
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
    {id: 1, text: 'Learn Poly State', completed: false},
    {id: 2, text: 'Build awesome app', completed: false},
  ],
})

// update a specific todo
store.updatePath(['todos', 0, 'completed'], () => true)

// Using thunk for complex logic
// Thunk type definition, must match the store's state type
// This thunk can access the store's state, dispatch actions, and perform async operations
// Thunks can be defined anywhere, but its reccomended to define them in a separate file for better organization
const asyncThunk: Thunk<AppState> = async ({
  dispatch,
  getState,
  updatePath,
  transaction,
  batch,
}) => {
  console.log('Running async thunk...')

  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000))

  const currentState = getState()
  dispatch({
    todos: [...currentState.todos, {id: 3, text: 'Async todo', completed: false}],
  })

  console.log('Async thunk completed')
}
// Dispatch the thunk
// Note: Thunks can be dispatched like regular actions, they can also return promises or values
store.dispatch(asyncThunk)

// Defining a thunbk that returns a value
// This can be usefule to combine multiple actions or perform complex logic, such as fetching data
// and updating the state all at once, this is more efficient that calling getState and dispatch multiple times
// including the Thunk type in the function signature allows TypeScript to infer the state type
// and provides better type safety, though it is not strictly necessary
const loadTodosThunk: Thunk<AppState, Promise<ToDo>> = async ({dispatch}) => {
  console.log('Loading todos...')
  // Simulate fetching todos from an API
  await new Promise(resolve => setTimeout(resolve, 1000))
  const todos = [
    {id: 1, text: 'Learn Poly State', completed: true},
    {id: 2, text: 'Build awesome app', completed: false},
    {id: 3, text: 'Write documentation', completed: false},
  ]
  // Dispatch action to update todos
  dispatch({
    todos,
  })
  console.log('Todos loaded:', todos)
  // return the most recent todo
  return todos[todos.length - 1]
}

// Dispatch the thunk and handle the returned value
const currentTodo = await store.dispatch(loadTodosThunk)
console.log('Todo loaded, current todo:', currentTodo)
// Output: Todo loaded, current todo: { id: 3, text: 'Write documentation', completed: false }

// Thunks are a powerful way to encapsulate complex logic
// Thunks always have acess to the following methods:
// - `dispatch`: to dispatch actions
// - `getState`: to get the current state of the store
// - `updatePath`: to update a specific path in the state
// - `transaction`: to perform multiple updates in a single transaction
// - `batch`: to batch multiple updates together
const exampleThunk: Thunk<AppState> = ({dispatch, getState, updatePath, transaction, batch}) => {
  console.log('Running example thunk...')
  const state = getState()
  console.log('Current state:', state)

  // Batch multiple updates
  batch(() => {
    // Update user name
    updatePath(['user', 'name'], () => 'Updated Name')
    // Dispatch an action to update settings
    dispatch({settings: {theme: 'dark'}})
    // Perform a transaction to update todos
    transaction(draft => {
      draft.todos.push({id: 4, text: 'New todo', completed: false})
      draft.todos[0].completed = true // Mark first todo as completed
    })
  })
}

// Dispatch the example thunk
store.dispatch(exampleThunk)

// Using transactions for multiple updates
// Transactions return a boolean indicating success or failure
// On failure, no changes are applied
const success = store.transaction(draft => {
  draft.user.name = 'Jane Smith'
  draft.settings.theme = 'dark'
  void draft.todos.pop() // Remove last todo
  // All changes committed together
})

if (!success) console.error('Transaction failed, no changes applied.')
// Internally an error is thrown and logged if the transaction fails. This will not crash your application
// You can configure the store to handle errors differently by passing an error handler in the store options
// This applied to all errors, including those thrown by thunks, transactions, and other operations

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
// Output: Current user: { id: 1, name: 'Batched Name', email: 'jane@example.com' }
console.log('Completed todos:', completedTodosSelector())
// Output: Completed todos: [ { id: 1, text: 'Learn Poly State', completed: true } ]

// subscribe to specific state slice
const selectUser = (state: AppState) => state.user // Selector function to get user state
// Subscribe to user state changes
const unsubscribeUser = store.subscribeTo(selectUser, (oldValue, NewValue) => {
  console.log('User state changed:', {oldValue, NewValue})
})

// Subscribe to a specific user by ID

// First create a parameterized selector
const selectUserById = store.selectWith(
  [selectUser], // This selector takes a userId and returns a function that selects the user by ID
  (userId: number) => users => {
    return users[userId]
  }
)

// Then subscribe to the specific user
const userId = 1 // Example user ID
const unsubscribeSpecificUser = store.subscribeTo(selectUserById(userId), (oldValue, newValue) => {
  console.log(`User ${userId} state changed:`, {oldValue, newValue})
})

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
unsubscribeUser()
unsubscribeSpecificUser()

export default store
