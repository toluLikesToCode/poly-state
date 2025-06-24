<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Universal Store Package Development Instructions

This is a TypeScript package that provides universal state management for both vanilla TypeScript
and React applications.

## Key Architecture Points

- **Dual Export System**: The package exports both a core module for vanilla TypeScript and a
  React-specific module
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Build System**: Uses Rollup for bundling with support for CJS and ESM formats
- **Plugin System**: Extensible architecture for adding custom functionality

## Development Guidelines

- Keep core store logic in `src/core/` separate from React integration in `src/react/`
- Maintain backward compatibility when making changes
- Ensure React is treated as an optional peer dependency
- Use proper JSDoc comments for all public APIs
- Follow immutable state update patterns using Immer
- Test both vanilla TypeScript and React usage scenarios
- Use Vitest for testing with comprehensive coverage
- Follow the modular architecture - state, selectors, storage, and utilities are separate concerns
- Plugins should be implemented in `src/plugins/` and exported through the plugin manager
- Shared utilities and errors go in `src/shared/`
- All exports should flow through appropriate index files for clean API surface

## TypeScript Project Guidelines

### Documentation: TSDoc

- Use `/** */` blocks with summary for all functions/classes/interfaces
- **Required tags**: `@param` (with description), `@returns` (for non-void)
- **Optional tags**: `@remarks`, `@example`, `@see`, `@defaultValue`
- **Links**:
  - Classes: `{@link ClassName}`
  - Static methods: `{@link Class.staticMethod}`
  - Instance methods: `{@link Class#instanceMethod}`
  - With labels: `{@link Class | description}`
- **Examples**: Include code blocks in `@example` tags
- **Structure**: Summary → remarks → params → returns → examples → see also

### Code Style

- Use `const`/`let`, arrow functions, `async/await`
- `interface` for objects, `type` for aliases, `enum` for constants
- Access modifiers: `public`/`private`/`protected`
- Optional: `?`, assertions: `!`/`as`
- ES6 modules

## File Structure

### Core Module (`src/core/`)

- `src/core/state/` - Store creation and management
  - `createStore.ts` - Main store factory function
  - `types.ts` - Core store type definitions
  - `storeRegistry.ts` - Store instance management
  - `typeRegistry.ts` - Type system management
  - `utils.ts` - Store utility functions
  - `storeCreationHelpers.ts` - Helper functions for store creation
  - `ensureProperType.ts` - Type validation utilities
- `src/core/selectors/` - Selector system
  - `manager.ts` - Selector manager implementation
  - `types.ts` - Selector type definitions
  - `utils.ts` - Selector utility functions
- `src/core/storage/` - Persistence layer
  - `local.ts` - localStorage integration
  - `session.ts` - sessionStorage integration
  - `cookie.ts` - Cookie storage integration
- `src/core/utils/` - Core utilities
  - `clone.ts` - Deep cloning utilities
  - `equality.ts` - Equality checking functions
  - `path.ts` - Object path manipulation
  - `devMode.ts` - Development mode utilities

### React Integration (`src/react/`)

- `src/react/index.ts` - React hooks and context providers

### Plugin System (`src/plugins/`)

- `src/plugins/index.ts` - Plugin exports
- `src/plugins/pluginManager.ts` - Plugin management system

### Entry Points

- `src/index.ts` - Main entry point for vanilla TypeScript usage
- `src/react.ts` - Entry point for React-specific features

### Shared (`src/shared/`)

- `src/shared/errors.ts` - Common error definitions

## Build Commands

- `npm run build` - Build for production
- `npm run dev` - Build in watch mode for development
- `npm run clean` - Clean build artifacts
- `npm run test` - Run all tests in watch mode
- `npm run test:run` - Run tests once
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:core` - Run only core module tests
- `npm run test:react` - Run only React integration tests
- `npm run lint` - Run ESLint on source code

When implementing features, ensure they work for both usage patterns:

1. Vanilla TypeScript projects
2. React applications with hooks and context
