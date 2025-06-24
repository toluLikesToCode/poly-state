# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **⚠️ Development Status**: This package is currently in active development and has not been
> published to npm yet. All versions listed below represent development milestones and local builds
> only.

## [Unreleased] - In Active Development

### Added

- Enhanced React example with comprehensive hook demonstrations
- Vanilla TypeScript example with complete feature showcase
- Additional npm scripts for better development workflow:
  - `lint:fix` - ESLint with automatic fixes
  - `format` - Format all files with Prettier
  - `format:check` - Check formatting without making changes
- Prettier configuration optimized for code conciseness
- TypeScript-specific Prettier overrides for maximum conciseness

### Changed

- Package name finalized as `open-store` (pending npm publication)
- Updated README.md with comprehensive React examples showing advanced hooks
- Enhanced React example (`examples/react.tsx`) with:
  - Counter component with undo/redo functionality
  - User profile with transactions and path updates
  - Todo list with async thunks and loading states
  - Settings with theme switching and store effects
- Improved vanilla TypeScript example (`examples/vanilla.ts`) with:
  - Async thunk demonstrations
  - Transaction examples
  - Path updates and batch operations
  - History management (undo/redo)
  - Complete API coverage
- Prettier configuration updated for maximum code conciseness:
  - Removed semicolons (`"semi": false`)
  - Reduced trailing commas (`"trailingComma": "es5"`)
  - Increased line width to 120 characters
  - Removed bracket spacing
  - Removed arrow function parentheses for single parameters
- ESLint configuration simplified to resolve compatibility issues
- Enhanced documentation with complete hooks reference

### Fixed

- ESLint configuration errors by simplifying extends configuration
- TypeScript compilation errors in example files
- Inconsistent import paths in documentation and examples
- Missing Prettier dependency in package.json

### Documentation

- Added comprehensive React hooks documentation covering all 16 available hooks
- Enhanced quick start examples with more realistic use cases
- Improved development setup documentation with example file descriptions
- Updated all code examples to reflect new concise formatting style

## [1.0.0-dev] - 2025-06-21 - Initial Development Build

### Core Implementation

- Core store implementation with TypeScript support
- React integration with hooks and context
- Plugin system for extensible functionality
- Dual export system (vanilla TypeScript and React)
- Comprehensive type definitions
- Immutable state management with Immer
- Storage abstraction for persistence
- Selector management system
- Complete test suite with Vitest
- Build system with Rollup
- Development workflow documentation
- Examples for both vanilla and React usage

### Key Features Implemented

- **Universal Compatibility**: Works with both vanilla TypeScript and React applications
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Immutable Updates**: Built-in immutability using Immer
- **Persistence**: Configurable storage adapters for state persistence
- **Performance**: Optimized selectors and efficient re-rendering
- **Extensibility**: Plugin system for custom functionality
- **Developer Experience**: Excellent tooling and debugging support

---

## 🚀 Release Roadmap

### Pre-Release Checklist

- [ ] Complete comprehensive testing across different environments
- [ ] Finalize API documentation
- [ ] Performance benchmarking
- [ ] Security audit
- [ ] License and legal review
- [ ] npm package preparation

### Planned Releases

- **v1.0.0-beta.1**: First beta release for community testing
- **v1.0.0-rc.1**: Release candidate with final API
- **v1.0.0**: Official stable release to npm

[Unreleased]: https://github.com/yourusername/open-store/compare/v1.0.0-dev...HEAD
[1.0.0-dev]: https://github.com/yourusername/open-store/tree/v1.0.0-dev
