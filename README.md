# Poly State

> **Development Notice**: This project is currently under active development and hasn't been
> published to npm yet. The API is stabilizing but may still change before the first release.

A lightweight, TypeScript-first state management solution that works seamlessly with both vanilla
JavaScript/TypeScript projects and React applications. Poly State is designed to be a powerful yet
simple alternative to other state management libraries, offering a rich feature set out of the box.

## Why Poly State?

**Universal Compatibility**: Write your state logic once and use it everywhere. Poly State's core is
framework-agnostic, allowing you to manage state in any JavaScript environment, from vanilla browser
scripts and server-side Node.js applications to complex React projects. This unified approach
simplifies your architecture and reduces cognitive load.

**Zero Dependencies for Core**: The core library is pure TypeScript with zero external dependencies,
resulting in a smaller bundle size and eliminating the risk of version conflicts from third-party
packages. React is treated as an optional peer dependency, so you only include it when you need it.

**Developer-Friendly**: Designed with the developer experience as a top priority. You get
exceptional TypeScript support with strong type inference for state, actions, and selectors, which
catches errors at compile time. The library also features robust, centralized error handling and a
rich set of utilities that simplify complex state management tasks.

**Lightweight & Performant**: Poly State is built for speed. It has a minimal footprint and supports
tree-shaking to keep your application lean. It's highly optimized, memoized selector system that
prevents expensive re-computations of derived data, while batched updates ensure that multiple state
changes result in a single, efficient UI re-render, a common performance bottleneck in other
libraries.

**Immutable by Default**: State updates are safe, predictable, and easy to debug. Poly State
enforces immutability, but with the power of Immer under the hood, you can write complex logic using
a familiar, mutable style API while the library handles the immutable updates safely and
efficiently.

**Feature-Rich Out of the Box**: Many features that require separate libraries in other ecosystems
are built-in and ready to use with simple configuration.

- **State Persistence**: Effortlessly persist state to localStorage, sessionStorage, or cookies with
  a single configuration flag. No extra packages needed.
- **Time Travel**: Undo/redo functionality is a first-class citizen, not just a developer tool. You
  can easily expose this powerful feature to your end-users in applications like document editors or
  design tools.
- **Atomic Transactions**: Group multiple state changes into a single, atomic update. This is
  crucial for complex operations, ensuring the UI never reflects an intermediate or invalid state.
- **Context-Free React Hooks**: A major differentiator that offers unparalleled flexibility. Use all
  of Poly State's powerful React hooks without needing to wrap your application in a
  `<StoreProvider>`, which is perfect for testing, component libraries, or micro-frontends.

**Extensible**: Tailor the store to your specific needs with a simple yet powerful plugin system.
Plugins can hook into the store's lifecycle to add custom functionality like advanced logging,
analytics, or even entirely new persistence layers.

## Installation

> **Note**: This package is not yet published to npm. For local development, please see the
> Contributing section.

When published, you can install it via npm:

```bash
# For Vanilla TypeScript/JavaScript projects
npm install poly-state

# For React projects
npm install poly-state react
```

## Getting Started

### For Vanilla TypeScript/JavaScript

```typescript
import {createStore} from 'poly-state'

// 1. Define your state shape
interface AppState {
  count: number
}

// 2. Create a store
const store = createStore<AppState>({count: 0})

// 3. Subscribe to changes
store.subscribe(state => console.log('State updated:', state))

// 4. Dispatch actions to update state
store.dispatch({count: 1}) // logs: State updated: { count: 1 }
```

### For React Applications

Poly State offers two flexible ways to integrate with React.

#### 1. Context-Free Hooks (Recommended for Simplicity & Testing)

Use all of Poly State's hooks without a `<StoreProvider>`. This is great for component libraries,
testing, or simpler applications.

```tsx
import {createStore} from 'poly-state'
import {useStoreHooks} from 'poly-state/react'

// Create a store instance (e.g., in store.ts)
const appStore = createStore({count: 0})

// Use it in any component
function Counter() {
  const {useSelector, useDispatch} = useStoreHooks(appStore)
  const count = useSelector(state => state.count)
  const dispatch = useDispatch()

  return <button onClick={() => dispatch({count: count + 1})}>Count: {count}</button>
}

// No provider needed in your App root!
function App() {
  return <Counter />
}
```

#### 2. Traditional Context Provider

For larger applications, you can use the traditional provider pattern.

```tsx
import React from 'react'
import {createStore} from 'poly-state'
import {createStoreContext} from 'poly-state/react'

// 1. Create a store instance
const store = createStore({count: 0})

// 2. Create the context and hooks
const {StoreProvider, useSelector, useDispatch} = createStoreContext(store)

// 3. Use the hooks in your components
function Counter() {
  const count = useSelector(state => state.count)
  const dispatch = useDispatch()

  return <button onClick={() => dispatch({count: count + 1})}>Count: {count}</button>
}

// 4. Wrap your app with the provider
function App() {
  return (
    <StoreProvider>
      <Counter />
    </StoreProvider>
  )
}
```

## Core API Reference

### createStore(initialState, options?)

Creates a new store instance.

```typescript
const store = createStore(
  {user: null, settings: {theme: 'light'}},
  {
    name: 'MyStore',
    persistKey: 'my-app-state',
    storageType: 'local', // 'local', 'session', or 'cookie'
    historyLimit: 50, // Enable undo/redo
    syncAcrossTabs: true,
    plugins: [myPlugin],
    onError: error => console.error(error.message, error.context),
  }
)
```

| Option           | Type                               | Description                                                  |
| ---------------- | ---------------------------------- | ------------------------------------------------------------ |
| `name`           | `string`                           | Optional name for debugging and DevTools.                    |
| `persistKey`     | `string`                           | Key for persisting state in storage.                         |
| `storageType`    | `'local' \| 'session' \| 'cookie'` | The storage mechanism to use for persistence.                |
| `historyLimit`   | `number`                           | The maximum number of undo/redo steps to store.              |
| `syncAcrossTabs` | `boolean`                          | Enables automatic state synchronization across browser tabs. |
| `plugins`        | `Plugin<S>[]`                      | An array of plugins to extend store functionality.           |
| `middleware`     | `Middleware<S>[]`                  | An array of middleware for intercepting actions.             |
| `onError`        | `(error: StoreError) => void`      | A centralized error handler for the store.                   |

### Store Methods

#### Vanilla State Updates

**dispatch(action)**: The primary method for updating state. It accepts a partial state object or a
thunk for complex logic.

```typescript
// Simple update
store.dispatch({count: 1})

// Thunk for async logic
store.dispatch(async ({dispatch}) => {
  const user = await fetchUser()
  dispatch({user})
})
```

**transaction(recipe)**: Executes a series of mutations atomically using an Immer draft. If the
function throws an error, all changes are rolled back.

```typescript
store.transaction(draft => {
  draft.user.name = 'John Doe'
  draft.user.lastUpdated = Date.now()
  draft.todos.push({id: 1, text: 'Use transactions!', completed: false})
})
```

**batch(fn)**: Groups multiple dispatch calls into a single update, triggering only one re-render in
React.

```typescript
store.batch(() => {
  store.dispatch({count: 1})
  store.dispatch({status: 'updated'})
})
```

**updatePath(path, updater)**: Provides a way to apply a surgical update to a nested property in the
state.

```typescript
// Updates state.user.preferences.theme
store.updatePath(['user', 'preferences', 'theme'], currentTheme =>
  currentTheme === 'light' ? 'dark' : 'light'
)
```

#### State Access & Subscriptions

- **getState()**: Returns the current state object.
- **subscribe(listener)**: Subscribes to all state changes. Returns an unsubscribe function.
- **subscribeTo(selector, listener)**: Subscribes to changes in a specific slice of state, derived
  by the selector.
- **subscribeToPath(path, listener)**: Subscribes to changes at a specific nested path (e.g.,
  'user.name').

#### Selectors

**select(selector)**: Creates a memoized selector to compute derived data. The selector only
recomputes when its inputs change.

```typescript
// Simple selector
const selectCount = store.select(state => state.count)

// Selector with multiple inputs
const selectCartSummary = store.select(
  state => state.cart.items,
  state => state.cart.taxPercent,
  (items, taxPercent) => {
    const subtotal = items.reduce((sum, item) => sum + item.price, 0)
    const tax = subtotal * taxPercent
    return {subtotal, tax, total: subtotal + tax}
  }
)
```

**selectWith(selectors, projector)**: Creates a parameterized selector for dynamic queries.

```typescript
const selectProductById = store.selectWith(
  [state => state.products],
  (productId: string) => products => products.find(p => p.id === productId)
)

const getProduct123 = selectProductById('123')
const product = getProduct123() // Memoized for this ID
```

#### History

**undo(steps?, path?)**: Reverts the state to a previous point in history. The optional path
parameter allows for a "surgical undo," reverting only a specific part of the state while leaving
other concurrent changes intact.

**redo(steps?, path?)**: Moves forward to a state that was undone. Also supports the optional path
parameter for partial redos.

**getHistory()**: Returns an object with the history array and current index.

```typescript
// Example of path-specific undo
const store = createStore(
  {
    user: {name: 'John', status: 'active'},
    cart: {items: 1},
  },
  {historyLimit: 10}
)

// Change both user and cart in one transaction
store.transaction(draft => {
  draft.user.name = 'Jane'
  draft.cart.items = 2
})
// State is now: { user: { name: 'Jane' }, cart: { items: 2 } }

// Now, undo only the user name change
store.undo(1, ['user', 'name'])

// The user's name is reverted, but the cart remains updated
console.log(store.getState())
// Logs: { user: { name: 'John' }, cart: { items: 2 } }
```

## React Hooks API Reference

### State Access

**useSelector(selector)**: Subscribes a component to a slice of state. The component will only
re-render if the selected value changes.

```typescript
const userName = useSelector(state => state.user.name)
```

**useStoreState()**: Subscribes a component to the entire state object. Use with caution, as any
state change will cause a re-render.

**useStoreValue(path)**: A convenient hook to subscribe to a nested value using a string path.

```typescript
const theme = useStoreValue('user.preferences.theme')
```

### State Updates

- **useDispatch()**: Returns the dispatch function to update state.
- **useTransaction()**: Returns the transaction function for atomic updates in components.
- **useBatch()**: Returns the batch function to group updates.
- **useUpdatePath()**: Returns the updatePath function for surgical nested updates.

### Async Operations

**useThunk()**: Returns a function to execute synchronous thunks.

**useAsyncThunk()**: A powerful hook for managing async operations with built-in loading and error
states.

```typescript
function UserProfile() {
  const { execute, loading, error } = useAsyncThunk();

  const handleFetchUser = () => {
    execute(async ({ dispatch }) => {
      const user = await fetchUser();
      dispatch({ user });
    });
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return <button onClick={handleFetchUser}>Fetch User</button>;
}
```

### Side Effects

**useStoreEffect(selector, effect)**: Runs a side effect when a selected piece of state changes,
similar to React's useEffect.

```typescript
useStoreEffect(
  state => state.settings.theme,
  theme => {
    document.body.className = `theme-${theme}`
  }
)
```

**useSubscribeTo(selector, listener)**: A lower-level hook to subscribe a listener function to state
changes.

**useSubscribeToPath(path, listener)**: Subscribes a listener to a specific nested path.

### React History

**useStoreHistory()**: Provides access to the store's history, including undo, redo, canUndo, and
canRedo.

```typescript
function HistoryControls() {
  const { undo, redo, canUndo, canRedo } = useStoreHistory();

  return (
    <>
      <button onClick={() => undo()} disabled={!canUndo}>Undo</button>
      <button onClick={() => redo()} disabled={!canRedo}>Redo</button>
    </>
  );
}
```

## Plugins

### Omit Paths Plugin (redact fields before persistence)

Redacts configured paths from persisted snapshots while keeping in-memory state intact. Useful for
tokens, secrets, ephemeral queues, or any data that should not be written to storage or synced
across tabs.

- Works with objects and arrays
- Supports wildcards '\*' at any level
  - Intermediate '\*' applies to all keys/indices at that level
  - Trailing '\*' clears the entire collection (array -> [], object -> {})
- Missing keys and out-of-bounds indices are ignored with dev-time warnings
- Sanitizes undefined values to avoid serialization issues

Basic usage

```ts
import {createStore, StorageType, createOmitPathsPlugin} from 'poly-state'

interface AppState {
  user: {name: string; token?: string}
  logs: string[]
}

const initialState: AppState = {user: {name: 'John', token: 'secret'}, logs: ['a', 'b']}

const omitPlugin = createOmitPathsPlugin<AppState>([
  ['user', 'token'], // remove user.token from persistence
])

const store = createStore(initialState, {
  persistKey: 'app-state',
  storageType: StorageType.Local,
  plugins: [omitPlugin],
})
```

Wildcards and deep paths

```ts
// Redact password for every account entry
const redactPasswords = createOmitPathsPlugin<{
  accounts: Array<{id: string; profile: {password?: string; email: string}}>
}>([['accounts', '*', 'profile', 'password']])

// Clear entire logs array in persisted snapshot (kept in memory)
const clearLogs = createOmitPathsPlugin<{logs: string[]}>([['logs', '*']])

// Target nested private field of the first item only
const redactFirstOnly = createOmitPathsPlugin<{
  nested: {items: Array<{meta: {public: string; private?: string}}>}
}>([['nested', 'items', 0, 'meta', 'private']])
```

Restoring omitted fields on load

```ts
// Provide an initial baseline used to restore omitted paths after loading from storage
const withBaseline = createOmitPathsPlugin(initialState /* paths: */ [
  ['user', 'token'],
], /* name */ 'omitSecrets', /* initialStateParam */ initialState)
```

Edge cases and behavior

- Missing keys / out-of-bounds indices: safely ignored, dev warnings in non-production
- Trailing '\*' at final segment clears arrays/objects ([], {}) in the persisted snapshot
- Null/undefined values are sanitized; undefined keys are dropped during persistence
- Cross-tab sync merges remote state with current state while preserving omitted paths from memory
- If the plugin cannot capture initial state at store creation and no baseline is provided, the
  loaded state is returned (sanitized) and a dev warning is emitted

Gotchas (read this before using)

- Persistence vs runtime: redaction only affects what is written to storage/sync. In-memory state
  still contains those fields. Do not assume they are removed at runtime.
- Array indices are positional: using 0 targets only the first item at persistence time. If order
  changes, you may affect a different item. Prefer '\*' when you mean "all items".
- Restoration baseline: if onStoreCreate cannot capture the initial state and you do not pass
  initialStateParam, omitted paths cannot be restored on load. The sanitized loaded snapshot will be
  used as-is with a dev warning.
- Not a security boundary: secrets remain in memory and can be logged or exposed by your app. This
  plugin prevents writing them to storage/sync only.
- Parent branches are not created: the plugin only removes existing values. Define default branches
  in your initial state if consumers expect them.
- Clearing vs removing key: a trailing '_' clears the collection to [] or {} but keeps the parent
  key. If you need to remove the parent property, target that property directly (without '_').
- Schemas/validators: if your validation requires a field that you omit, make it optional or provide
  defaults in the initial state to avoid load-time validation failures.

## Development & Contributing

This project is built with TypeScript and uses Rollup for bundling. We welcome contributions!

### Local Setup

Requirements: Node.js 18+ and npm.

```bash
# Clone the repository
git clone https://github.com/ToluLikesToCode/poly-state.git
cd poly-state

# Install dependencies
npm install

# Run the development build (with watch mode)
npm run dev
```

### Key Scripts

- `npm run build`: Create a production build in the dist/ folder.
- `npm run dev`: Start the development server with watch mode.
- `npm run test`: Run the unit test suite in watch mode.
- `npm run test:run`: Run unit tests once.
- `npm run test:browser`: Run browser integration tests.
- `npm run test:all`: Run comprehensive test suite (unit + browser tests).
- `npm run test:coverage`: Generate test coverage report.
- `npm run lint`: Check the code for linting errors.
- `npm run format`: Format the code with Prettier.
- `npm run clean`: Remove all build artifacts.

### Testing Strategy

Poly State uses a dual testing approach for comprehensive validation:

- **🧪 Unit Tests**: Fast feedback with jsdom environment for core logic and React hooks
- **🌐 Browser Tests**: Real browser integration testing with Playwright for storage systems,
  cross-tab synchronization, and authentic browser behavior

This ensures both rapid development iteration and real-world compatibility.

For more detailed information, please see our [Contributing Guide](.github/CONTRIBUTING.md).

## License

MIT - feel free to use this in your projects.
