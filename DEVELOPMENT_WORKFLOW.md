# Development Workflow Guide

This guide outlines the recommended workflows for using the Universal Store package in external
projects during development and testing phases, without publishing to npm.

## Table of Contents

- [Overview](#overview)
- [NPM Link - Development Workflow](#npm-link---development-workflow)
- [NPM Pack - Testing Workflow](#npm-pack---testing-workflow)
- [Workflow Comparison](#workflow-comparison)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Overview

The Universal Store package supports two main usage patterns:

- **Vanilla TypeScript**: Import from `open-store`
- **React Integration**: Import from `open-store/react`

During development, you have two primary options for testing your package in external projects:

1. **NPM Link**: For active development with real-time updates
2. **NPM Pack**: For testing production-like installations

---

## NPM Link - Development Workflow

**Best for**: Active development, rapid iteration, real-time updates

### What NPM Link Does

NPM Link creates symbolic links (symlinks) between your package and external projects. This means:

- Changes in your package source code are immediately available to linked projects
- No need to reinstall or copy files manually
- Perfect for development iteration cycles

### Initial Setup

#### 1. Prepare Your Package

```bash
# Navigate to your package directory
cd /Users/toluadegbehingbe/projects/myStore

# Build the package first
npm run build

# Create a global symlink for your package
npm link
```

**What this does:**

- Creates a symlink in your global npm directory pointing to your package
- Makes `open-store` available globally for linking

#### 2. Link in External Projects

```bash
# Navigate to your external project
cd /path/to/your/external/project

# Link the package
npm link open-store
```

**What this does:**

- Creates a symlink in `node_modules/open-store` pointing to your package
- The external project now uses your local development version

### Development Iteration Cycle

#### 1. Start Development Mode

```bash
# In your package directory
cd /Users/toluadegbehingbe/projects/myStore

# Start rollup in watch mode
npm run dev
```

**This command:**

- Watches for changes in `src/` directory
- Automatically rebuilds when files change
- Updates both vanilla and React bundles
- Generates source maps for debugging

#### 2. Work on Your External Project

```bash
# In your external project
cd /path/to/your/external/project

# Start your project's development server
npm start  # or npm run dev, yarn dev, etc.
```

#### 3. Make Changes and See Results

1. **Edit source files** in your package (`/Users/toluadegbehingbe/projects/myStore/src/`)
2. **Watch rollup rebuild** automatically in the terminal
3. **Refresh/restart** your external project to see changes

### Usage Examples in External Projects

#### Vanilla TypeScript Usage

```typescript
// In your external project
import { createStore, StoreConfig } from "open-store";

interface AppState {
  count: number;
  user: { name: string; email: string } | null;
}

const initialState: AppState = {
  count: 0,
  user: null,
};

const config: StoreConfig<AppState> = {
  enableHistory: true,
  maxHistorySize: 50,
};

const store = createStore(initialState, config);

// Subscribe to changes
store.subscribe((state, previousState) => {
  console.log("State changed:", state);
});

// Update state
store.setState({ count: store.getState().count + 1 });
```

#### React Usage

```tsx
// App.tsx - Root component
import React from "react";
import { StoreProvider } from "open-store/react";
import { store } from "./store";
import Counter from "./Counter";

function App() {
  return (
    <StoreProvider store={store}>
      <div className="app">
        <h1>My App</h1>
        <Counter />
      </div>
    </StoreProvider>
  );
}

export default App;
```

```tsx
// Counter.tsx - Component using the store
import React from "react";
import { useStore } from "open-store/react";

interface AppState {
  count: number;
}

function Counter() {
  const { state, setState } = useStore<AppState>();

  const increment = () => {
    setState({ count: state.count + 1 });
  };

  const decrement = () => {
    setState({ count: state.count - 1 });
  };

  return (
    <div>
      <h2>Count: {state.count}</h2>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  );
}

export default Counter;
```

### Cleanup NPM Link

When you're finished with development:

```bash
# In your external project
npm unlink open-store

# Reinstall regular dependencies
npm install

# Optional: Remove global link
npm unlink -g open-store
```

---

## NPM Pack - Testing Workflow

**Best for**: Testing production-like installations, final validation, sharing with team members

### What NPM Pack Does

NPM Pack creates a tarball (`.tgz` file) that simulates what would be published to npm:

- Contains only files specified in `package.json` `files` field
- Applies `.npmignore` rules
- Creates a production-ready package bundle
- Perfect for testing the actual installation experience

### Creating and Using Pack Files

#### 1. Build and Pack Your Package

```bash
# Navigate to your package directory
cd /Users/toluadegbehingbe/projects/myStore

# Clean previous builds
npm run clean

# Build the package
npm run build

# Create a tarball
npm pack
```

**This creates**: `tolulikescode-universal-store-1.0.0.tgz` in your package directory

#### 2. Install in External Projects

```bash
# Navigate to your external project
cd /path/to/your/external/project

# Install the tarball
npm install /Users/toluladegbehingbe/projects/myStore/tolulikescode-universal-store-1.0.0.tgz
```

### Testing Iteration Cycle

#### 1. Make Changes to Your Package

```bash
# In your package directory
cd /Users/toluadegbehingbe/projects/myStore

# Edit your source files
# ...make your changes...

# Rebuild
npm run build
```

#### 2. Create New Pack

```bash
# Update version (optional but recommended)
npm version patch  # or minor, major

# Create new pack
npm pack
```

#### 3. Update External Project

```bash
# In your external project
cd /path/to/your/external/project

# Remove old version
npm uninstall open-store

# Install new version
npm install /Users/toluladegbehingbe/projects/myStore/tolulikescode-universal-store-1.0.1.tgz
```

### Pack File Inspection

You can inspect what's included in your pack:

```bash
# View contents without extracting
tar -tzf tolulikescode-universal-store-1.0.0.tgz

# Extract to see actual structure
tar -xzf tolulikescode-universal-store-1.0.0.tgz
```

**Expected contents:**

```text
package/
├── dist/
│   ├── index.js
│   ├── index.esm.js
│   ├── index.d.ts
│   ├── react.js
│   ├── react.esm.js
│   ├── react.d.ts
│   └── ...
├── src/
├── package.json
└── README.md
```

---

## Workflow Comparison

| Aspect                  | NPM Link           | NPM Pack               |
| ----------------------- | ------------------ | ---------------------- |
| **Best For**            | Active development | Final testing          |
| **Update Speed**        | Real-time          | Manual                 |
| **Production Accuracy** | Lower              | Higher                 |
| **Setup Complexity**    | Medium             | Low                    |
| **Iteration Speed**     | Very Fast          | Slow                   |
| **TypeScript Support**  | Excellent          | Excellent              |
| **Source Maps**         | Yes                | Yes                    |
| **Debugging**           | Easy               | Moderate               |
| **Team Sharing**        | Requires setup     | Easy (just share .tgz) |

### When to Use NPM Link

- ✅ Active feature development
- ✅ Rapid prototyping
- ✅ Bug fixing and iteration
- ✅ Real-time feedback needed
- ✅ Working on multiple projects simultaneously

### When to Use NPM Pack

- ✅ Final testing before release
- ✅ Validating package contents
- ✅ Testing installation process
- ✅ Sharing with team members
- ✅ CI/CD pipeline testing
- ✅ Production-like environment testing

---

## Troubleshooting

### NPM Link Issues

#### Changes Not Reflected

```bash
# Check if link exists
ls -la node_modules/open-store
# Should show: ... -> /Users/toluadegbehingbe/projects/myStore

# Restart TypeScript server (VS Code)
# Cmd+Shift+P → "TypeScript: Restart TS Server"

# Check if dev mode is running
cd /Users/toluadegbehingbe/projects/myStore
npm run dev  # Should be watching for changes
```

#### Module Not Found

```bash
# Re-link the package
npm unlink open-store
npm link open-store

# Check global links
npm ls -g --depth=0 | grep universal-store
```

#### TypeScript Declaration Issues

```bash
# Rebuild with TypeScript
npm run build

# Check if .d.ts files exist
ls -la dist/*.d.ts
```

### NPM Pack Issues

#### Missing Files in Pack

Check your `package.json` `files` field:

```json
{
  "files": ["dist", "src", "README.md"]
}
```

#### Wrong Version in Filename

Update package version:

```bash
# Update version in package.json
npm version patch

# Create new pack
npm pack
```

### General Issues

#### React Version Conflicts

```bash
# Check React versions match
npm ls react

# In package.json, ensure React is peerDependency:
"peerDependencies": {
  "react": ">=16.8.0"
}
```

#### Build Failures

```bash
# Clean and rebuild
npm run clean
npm run build

# Check for TypeScript errors
npx tsc --noEmit
```

---

## Best Practices

### Development Phase (NPM Link)

1. **Always build before linking initially**

   ```bash
   npm run build && npm link
   ```

2. **Use watch mode during development**

   ```bash
   npm run dev  # Keep this running
   ```

3. **Test both vanilla and React usage**

   ```typescript
   // Test vanilla
   import { createStore } from "open-store";

   // Test React
   import { useStore } from "open-store/react";
   ```

4. **Keep external project's dev server running**
   - Most dev servers will detect changes automatically
   - Some may require manual refresh

### Testing Phase (NPM Pack)

1. **Clean build before packing**

   ```bash
   npm run clean && npm run build && npm pack
   ```

2. **Version your test builds**

   ```bash
   npm version prerelease --preid=test
   npm pack
   ```

3. **Test installation from scratch**

   ```bash
   # Create fresh test project
   mkdir test-project && cd test-project
   npm init -y
   npm install /path/to/your/package.tgz
   ```

4. **Validate package contents**

   ```bash
   tar -tzf package.tgz | head -20
   ```

### General Best Practices

1. **Maintain both entry points**

   - Test vanilla TypeScript usage: `import from 'open-store'`
   - Test React usage: `import from 'open-store/react'`

2. **Use proper TypeScript configuration**

   - Ensure `tsconfig.build.json` is properly configured
   - Generate declaration files (`"declaration": true`)

3. **Test in different environments**

   - CommonJS projects
   - ESM projects
   - TypeScript projects
   - JavaScript projects

4. **Document breaking changes**

   - Keep `CHANGELOG.md` updated
   - Use semantic versioning appropriately

5. **Regular cleanup**

   ```bash
   # Clean old pack files
   rm *.tgz

   # Clean build artifacts
   npm run clean
   ```

---

## Quick Reference Commands

### NPM Link Workflow

```bash
# Package setup (one time)
npm run build && npm link

# External project setup (one time)
npm link open-store

# Development (daily)
npm run dev  # In package directory

# Cleanup
npm unlink open-store  # In external project
```

### NPM Pack Workflow

```bash
# Create pack
npm run clean && npm run build && npm pack

# Install in external project
npm install /path/to/package.tgz

# Update after changes
npm version patch && npm pack
npm uninstall open-store
npm install /path/to/new-package.tgz
```

This workflow ensures you can efficiently develop and test your Universal Store package while
maintaining high quality and production readiness.
