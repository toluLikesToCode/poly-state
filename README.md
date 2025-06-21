# Universal Store

A lightweight, feature-rich state management library for TypeScript and React applications.

## 🚀 Features

- **Zero dependencies** (React is optional peer dependency)
- **Small bundle size** with tree-shaking support
- **Immutable updates** with automatic state freezing in development
- **Built-in persistence** (localStorage, sessionStorage, cookies)
- **Cross-tab synchronization**
- **Undo/Redo functionality**
- **Plugin system** for extensibility
- **TypeScript first** with full type safety
- **React integration** with hooks and context

## 📦 Installation

```bash
npm install @tolulikescode/universal-store
# For React support
npm install @tolulikescode/universal-store react
```

## 🎯 Quick Start

### Vanilla TypeScript

```typescript
import { createStore } from "@tolulikescode/universal-store";

const store = createStore({ count: 0 });

// Subscribe to changes
store.subscribe(state => console.log("State:", state));

// Update state
store.dispatch({ count: 1 });
```

### React

```typescript
import { createStore } from "@tolulikescode/universal-store";
import { createStoreContext } from "@tolulikescode/universal-store/react";

const store = createStore({ count: 0 });
const { StoreProvider, useSelector, useDispatch } = createStoreContext(store);

function Counter() {
  const count = useSelector(state => state.count);
  const dispatch = useDispatch();

  return <button onClick={() => dispatch({ count: count + 1 })}>Count: {count}</button>;
}

function App() {
  return (
    <StoreProvider>
      <Counter />
    </StoreProvider>
  );
}
```

## 📚 API Documentation

### Core API

#### `createStore<T>(initialState: T, options?: StoreOptions): Store<T>`

Creates a new store instance with the given initial state.

```typescript
const store = createStore(
  {
    user: { name: "", email: "" },
    settings: { theme: "light" },
  },
  {
    persistKey: "my-app-state",
    storageType: StorageType.Local,
  }
);
```

#### Store Methods

- `getState()` - Get current state
- `dispatch(action)` - Update state
- `subscribe(listener)` - Subscribe to changes
- `select(selector)` - Create memoized selector
- `asReadOnly()` - Get read-only interface

### React API

#### `createStoreContext<T>(store: Store<T>): StoreContextResult<T>`

Creates React context and hooks for a store.

```typescript
const { StoreProvider, useSelector, useDispatch, useStore } = createStoreContext(store);
```

#### Hooks

- `useSelector<R>(selector: (state: T) => R): R` - Select and subscribe to state
- `useDispatch(): Store<T>['dispatch']` - Get dispatch function
- `useStore(): ReadOnlyStore<T>` - Get store instance

## 🔧 Development Setup

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd universal-store

# Install dependencies
npm install

# Build the package
npm run build
```

### Scripts

- `npm run build` - Build for production
- `npm run dev` - Build in watch mode
- `npm run test` - Run tests
- `npm run lint` - Lint code
- `npm run clean` - Clean build artifacts

## 🏗️ Building Your Store

### 1. Copy Your Store Implementation

Replace the placeholder content in these files with your actual implementation:

- `src/core/store.ts` - Your main store logic
- `src/core/types.ts` - Your type definitions
- `src/core/utils.ts` - Your utility functions
- `src/plugins/index.ts` - Your plugin implementations

### 2. Build the Package

```bash
npm run build
```

### 3. Test in Your Projects

#### Vanilla TypeScript\Javascript

```typescript
import { createStore } from "@tolulikescode/universal-store";

const appStore = createStore({
  user: { id: null, name: "", email: "" },
  todos: [],
});

appStore.dispatch({ user: { id: 1, name: "John", email: "john@example.com" } });
```

#### React Application

```typescript
import { createStore } from "@tolulikescode/universal-store";
import { createStoreContext } from "@tolulikescode/universal-store/react";

const store = createStore({ count: 0 });
const { StoreProvider, useSelector, useDispatch } = createStoreContext(store);

// Use in your React components
```

## 📝 Publishing

1. Update version in `package.json`
2. Build the package: `npm run build`
3. Publish to npm: `npm publish`

## 📄 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

---

**Next Steps:**

1. Copy your existing store implementation to the appropriate files
2. Test the build process
3. Verify both vanilla TypeScript and React usage
4. Publish to npm when ready
