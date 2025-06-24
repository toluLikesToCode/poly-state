# Development Workflow Guide

This guide outlines the recommended workflows for testing the Open Store package in external
projects during active development, before npm publication.

> **🚧 Development Status**: This package is currently under active development and has not been
> published to npm yet. This guide shows you how to test and use it locally while development
> continues.

## Table of Contents

- [Overview](#overview)
- [NPM Link - Active Development](#npm-link---active-development)
- [NPM Pack - Testing Builds](#npm-pack---testing-builds)
- [Workflow Comparison](#workflow-comparison)
- [Troubleshooting](#troubleshooting)

## Overview

Open Store is being built to support two main usage patterns:

- **Vanilla TypeScript/JavaScript**: Import from `open-store`
- **React Integration**: Import from `open-store/react`

Since the package isn't published yet, you have two ways to test it in your projects:

1. **NPM Link**: For real-time development and testing
2. **NPM Pack**: For production-like testing and validation

---

## NPM Link - Active Development

**Perfect for**: Actively developing features, fixing bugs, rapid iteration

### How It Works

NPM Link creates symbolic links between your local package and test projects. This means:

- Changes you make to Open Store are immediately available in linked projects
- No need to rebuild or reinstall manually
- Great for testing features as you build them

### Setting Up NPM Link

#### 1. Prepare Open Store

```bash
# Navigate to the Open Store directory
cd /Users/toluadegbehingbe/projects/open-store

# Build the current state
npm run build

# Create a global link
npm link
```

This makes `open-store` available globally for linking to other projects.

#### 2. Link to Your Test Project

```bash
# Go to your test project
cd /path/to/your/test/project

# Link Open Store
npm link open-store
```

Now your test project will use your local development version of Open Store.

### Development Loop

#### 1. Start Watch Mode

```bash
# In the Open Store directory
cd /Users/toluadegbehingbe/projects/open-store

# Start building automatically on changes
npm run dev
```

This watches your source files and rebuilds automatically when you make changes.

#### 2. Work on Your Test Project

```bash
# In your test project
cd /path/to/your/test/project

# Start your development server
npm start
# or npm run dev, yarn dev, etc.
```

#### 3. Edit and See Changes

1. **Make changes** to Open Store source code (`src/` folder)
2. **Watch the build** complete automatically
3. **Refresh your test project** to see the changes

---

## NPM Pack - Testing Builds

**Perfect for**: Testing the final package, validating installation, sharing with others

### Vanilla TypeScript Usage

```typescript
// In your test project
import {createStore} from 'open-store'

interface AppState {
  count: number
  user: {name: string; email: string} | null
}

const store = createStore({
  count: 0,
  user: null,
})

// Listen for changes
store.subscribe((state, prevState) => {
  console.log('State changed:', state)
})

// Update state
store.dispatch({count: store.getState().count + 1})
```

### React Usage

```tsx
// App.tsx - Set up the provider
import React from 'react'
import {createStore} from 'open-store'
import {createStoreContext} from 'open-store/react'
import Counter from './Counter'

const store = createStore({count: 0})
const {StoreProvider} = createStoreContext(store)

function App() {
  return (
    <StoreProvider>
      <div className="app">
        <h1>Testing Open Store</h1>
        <Counter />
      </div>
    </StoreProvider>
  )
}

export default App
```

```tsx
// Counter.tsx - Use the store in components
import React from 'react'
import {createStoreContext} from 'open-store/react'

// You'll need to export this context from your store setup
const {useSelector, useDispatch} = createStoreContext(store)

function Counter() {
  const count = useSelector(state => state.count)
  const dispatch = useDispatch()

  return (
    <div>
      <h2>Count: {count}</h2>
      <button onClick={() => dispatch({count: count + 1})}>+</button>
      <button onClick={() => dispatch({count: count - 1})}>-</button>
    </div>
  )
}

export default Counter
```

---

## Workflow Comparison (Summary Table)

| Aspect              | NPM Link    | NPM Pack         |
| ------------------- | ----------- | ---------------- |
| **Best For**        | Development | Final testing    |
| **Update Speed**    | Instant     | Manual           |
| **Setup**           | Medium      | Simple           |
| **Production-like** | No          | Yes              |
| **Debugging**       | Excellent   | Good             |
| **Team Sharing**    | Complex     | Easy (.tgz file) |

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
cd /Users/toluadegbehingbe/projects/open-store

# Clean previous builds
npm run clean

# Build the package
npm run build

# Create a tarball
npm pack
```

**This creates**: `tolulikescode-open-store-1.0.0.tgz` in your package directory

#### 2. Install in External Projects

```bash
# Navigate to your external project
cd /path/to/your/external/project

# Install the tarball
npm install /Users/toluladegbehingbe/projects/open-store/tolulikescode-open-store-1.0.0.tgz
```

### Testing Iteration Cycle

#### 1. Make Changes to Your Package

```bash
# In your package directory
cd /Users/toluadegbehingbe/projects/open-store

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
npm install /Users/toluladegbehingbe/projects/open-store/tolulikescode-open-store-1.0.1.tgz
```

### Pack File Inspection

You can inspect what's included in your pack:

```bash
# View contents without extracting
tar -tzf tolulikescode-open-store-1.0.0.tgz

# Extract to see actual structure
tar -xzf tolulikescode-open-store-1.0.0.tgz
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
# Should show: ... -> /Users/toluadegbehingbe/projects/open-store

# Restart TypeScript server (VS Code)
# Cmd+Shift+P → "TypeScript: Restart TS Server"

# Check if dev mode is running
cd /Users/toluadegbehingbe/projects/open-store
npm run dev  # Should be watching for changes
```

#### Module Not Found

```bash
# Re-link the package
npm unlink open-store
npm link open-store

# Check global links
npm ls -g --depth=0 | grep open-store
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
   import {createStore} from 'open-store'

   // Test React
   import {useStore} from 'open-store/react'
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

This workflow ensures you can efficiently develop and test your Open Store package while maintaining
high quality and production readiness.
