<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Universal Store Package Development Instructions

This is a TypeScript package that provides universal state management for both vanilla TypeScript and React applications.

## Key Architecture Points

- **Dual Export System**: The package exports both a core module for vanilla TypeScript and a React-specific module
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Build System**: Uses Rollup for bundling with support for CJS and ESM formats
- **Plugin System**: Extensible architecture for adding custom functionality

## Development Guidelines

- Keep core store logic in `src/core/` separate from React integration in `src/react/`
- Maintain backward compatibility when making changes
- Ensure React is treated as an optional peer dependency
- Use proper JSDoc comments for all public APIs
- Follow immutable state update patterns
- Test both vanilla TypeScript and React usage scenarios

## File Structure

- `src/core/store.ts` - Main store implementation
- `src/core/types.ts` - Core type definitions
- `src/core/selector-manager-types.ts` - Selector Manager type definitions
- `src/core/utils.ts` - Utility functions
- `src/core/storeage.ts` - Storage abstraction
- `src/react/index.ts` - React integration hooks and components
- `src/index.ts` - Main entry point for vanilla usage
- `src/react.ts` - Entry point for React usage
- `src/plugins/` - Plugin implementations

## Build Commands

- `npm run build` - Build for production
- `npm run dev` - Build in watch mode
- `npm run clean` - Clean build artifacts

When implementing features, ensure they work for both usage patterns:

1. Vanilla TypeScript projects
2. React applications with hooks and context
