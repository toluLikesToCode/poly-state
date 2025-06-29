# Open Store

> **Development Notice**: This project is currently under active development and hasn't been
> published to npm yet. The API is stabilizing but may still change before the first release.
>
> Project name is also subject to change before release.

A lightweight, TypeScript-first state management solution that works seamlessly with both vanilla
JavaScript/TypeScript projects and React applications.

## Why Open Store?

- **Universal compatibility** - One store, multiple environments
- **Zero dependencies** - React is optional, everything else is built-in
- **Developer friendly** - Great TypeScript support and debugging experience
- **Lightweight** - Small bundle with tree-shaking support
- **Immutable by default** - Safe state updates with automatic freezing in dev mode
- **Persistent state** - Built-in localStorage, sessionStorage, and cookie support
- **Time travel** - Undo/redo functionality out of the box
- **Extensible** - Plugin system for custom functionality

## Installation

> **Note**: Package not yet published to npm. For now, you can clone and build locally.

```bash
# When published:
npm install open-store

# For React projects:
npm install open-store react
```

## Getting Started

### For Vanilla TypeScript/JavaScript

```typescript
import {createStore} from 'open-store'

const store = createStore({count: 0})

// Listen for changes
store.subscribe(state => console.log('State updated:', state))

// Update state
store.dispatch({count: 1})
```

### For React Applications

```tsx
import React from 'react'
import {createStore} from 'open-store'
import {createStoreContext} from 'open-store/react'

const store = createStore({
  count: 0,
  user: {name: '', email: ''},
  todos: [],
})

const {StoreProvider, useSelector, useDispatch, useStoreHistory, useTransaction, useAsyncThunk} =
  createStoreContext(store)

function Counter() {
  const count = useSelector(state => state.count)
  const dispatch = useDispatch()
  const {undo, redo, canUndo, canRedo} = useStoreHistory()

  return (
    <div>
      <button onClick={() => dispatch({count: count + 1})}>Count: {count}</button>
      <button onClick={() => undo()} disabled={!canUndo}>
        Undo
      </button>
      <button onClick={() => redo()} disabled={!canRedo}>
        Redo
      </button>
    </div>
  )
}

function UserForm() {
  const user = useSelector(state => state.user)
  const transaction = useTransaction()

  const handleSave = () => {
    transaction(draft => {
      draft.user.name = 'John Doe'
      draft.user.email = 'john@example.com'
    })
  }

  return (
    <div>
      <p>User: {user.name || 'No name'}</p>
      <button onClick={handleSave}>Save User</button>
    </div>
  )
}

function App() {
  return (
    <StoreProvider>
      <Counter />
      <UserForm />
    </StoreProvider>
  )
}
```

## API Reference

### Core Store API

#### Creating a Store

```typescript
const store = createStore(initialState, options?)
```

The main function to create a store instance. Pass your initial state and optional configuration.

```typescript
const store = createStore(
  {
    user: {name: '', email: ''},
    settings: {theme: 'light'},
  },
  {
    persistKey: 'my-app-state', // Key for persisting state in storage
    storageType: StorageType.Local, // Storage type: Local, Session, Cookie, or None
    cookieOptions: {path: '/', secure: true}, // Cookie storage options (if using cookies)
    cookiePrefix: 'os_', // Prefix for cookie keys (for cleanup)
    syncAcrossTabs: true, // Enable cross-tab state sync
    middleware: [myMiddleware], // Array of middleware functions
    historyLimit: 50, // Max undo/redo steps to keep
    name: 'MyStore', // Optional store name (for debugging/tools)
    staleAge: 3600_000, // State is considered stale after this many ms
    cleanupStaleStatesOnLoad: true, // Remove old states on load
    cleanupOptions: {removePersistedState: true, clearHistory: true}, // Cleanup behavior on destroy/reset
    plugins: [myPlugin], // Array of store plugins
    onError: error => {
      /* handle errors */
    }, // Centralized error handler
  }
)
```

**Store Options:**

| Option                     | Type                          | Description                                                                                |
| -------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------ |
| `persistKey`               | `string`                      | Key for persisting state in storage (local/session/cookie)                                 |
| `storageType`              | `StorageType`                 | Where to persist state: `Local`, `Session`, `Cookie`, or `None`                            |
| `cookieOptions`            | `CookieStorageOptions`        | Cookie config: `{ expires, path, domain, secure, sameSite }`                               |
| `cookiePrefix`             | `string`                      | Prefix for cookie keys (for easier cleanup)                                                |
| `syncAcrossTabs`           | `boolean`                     | Enable cross-tab state sync (default: false)                                               |
| `middleware`               | `Middleware<S>[]`             | Array of middleware functions for intercepting actions                                     |
| `historyLimit`             | `number`                      | Max undo/redo steps to keep in history                                                     |
| `name`                     | `string`                      | Optional store name (for debugging/dev tools)                                              |
| `staleAge`                 | `number`                      | State is considered stale after this many ms                                               |
| `cleanupStaleStatesOnLoad` | `boolean`                     | Remove old/stale states on load                                                            |
| `cleanupOptions`           | `CleanupOptions`              | Cleanup behavior on destroy/reset: `{ removePersistedState, clearHistory, resetRegistry }` |
| `plugins`                  | `Plugin<S>[]`                 | Array of store plugins for extensibility                                                   |
| `onError`                  | `(error: StoreError) => void` | Centralized error handler for store/plugin errors                                          |

See `src/core/state/types.ts` for full type definitions and advanced options.

#### Store Methods

- `getState()` - Get the current state
- `dispatch(action)` - Update state or execute thunks
- `updatePath(path,updater)` - Update a nested property in the state using a function that takes the
  old value and returns the new one
- `batch(fn: () => void)` - Takes a function that can call dispatch multiple times
- `subscribe(listener)` - Listen for state changes
- `select(selector)` - Create a memoized selector
- `asReadOnly()` - Get a read-only version of the store

There are many more store methods detailed in `src/core/state/types.ts`. These will be documented
here at a later date.

### React Integration

#### Setting Up Context

```typescript
const {StoreProvider, useSelector, useDispatch, useStore} = createStoreContext(store)
```

This creates all the React hooks and components you need to integrate with your store.

#### Available Hooks

The hooks let you interact with your store in different ways:

**Basic hooks:**

- `useSelector(selector)` - Subscribe to specific parts of state
- `useDispatch()` - Get the dispatch function
- `useStore()` - Access the store directly
- `useStoreState()` - Get the entire state (auto-subscribes)

**Advanced hooks:**

- `useSubscribeTo(selector, listener, options?)` - Custom state subscriptions
- `useSubscribeToPath(path, listener, options?)` - Listen to specific paths
- `useStoreValue(selector, deps?)` - Memoized selectors with custom deps
- `useTransaction()` - Batch multiple updates atomically
- `useBatch()` - Group dispatches together
- `useUpdatePath()` - Update nested state directly
- `useStoreHistory()` - Undo/redo functionality
- `useThunk()` - Execute sync thunks
- `useAsyncThunk()` - Execute async thunks with loading states
- `useStoreEffect(effect, deps?)` - Side effects on state changes

## Development & Contributing

### Getting Set Up Locally

**Requirements:** Node.js 16+ and npm/yarn

```bash
# Get the code
git clone <your-repo-url>
cd open-store

# Install dependencies and build
npm install
npm run build
```

### Exploring the Examples

Check out the `examples/` folder to see Open Store in action:

- `examples/vanilla.ts` - Complete vanilla TypeScript/JavaScript usage
- `examples/react.tsx` - React integration with all hooks demonstrated

The examples use relative imports since the package isn't published yet, but they show you exactly
how to use Open Store in your projects.

### Available Scripts

- `npm run build` - Create production build
- `npm run dev` - Build in watch mode for development
- `npm run test` - Run tests with Vitest
- `npm run lint` - Check code with ESLint
- `npm run format` - Format code with Prettier
- `npm run clean` - Remove build artifacts

## Project Status

This project is actively being developed. The core functionality is working well, but we're still
polishing things before the first npm release.

**What's working:**

- Core store functionality with TypeScript support
- React integration with comprehensive hooks
- State persistence and undo/redo
- Plugin system architecture
- Test coverage of the basic functionality

**What's next:**

- Performance optimizations
- More comprehensive documentation
- Additional storage adapters
- Complete test coverage

## Contributing

Interested in contributing? Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/cool-new-thing`)
3. Make your changes
4. Add tests if needed
5. Run `npm test` and `npm run lint`
6. Submit a pull request

## License

MIT - feel free to use this in your projects.
