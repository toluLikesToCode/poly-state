# Contributing to Poly State

Thank you for your interest in contributing to Poly State! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 18.x or higher
- npm 8.x or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/toluLikesToCode/poly-state.git
cd poly-state

# Install dependencies
npm install

# Install Playwright browsers for browser testing
npx playwright install chromium
```

## Testing Strategy

Poly State uses a comprehensive testing approach with two distinct test environments:

### 🧪 Unit Tests (Fast Feedback)

Unit tests run in a `jsdom` environment for fast feedback:

```bash
# Run unit tests
npm run test:run

# Run with coverage
npm run test:coverage

# Watch mode
npm test

# Test specific modules
npm run test:core     # Core functionality only
npm run test:react    # React integration only
```

**Location**: `test/core/`, `test/react/`  
**Environment**: jsdom (simulated DOM)  
**Purpose**: Fast validation of core logic, React hooks, and business logic

### 🌐 Browser Tests (Real Integration)

Browser tests run in real Chromium for authentic validation:

```bash
# Run browser tests
npm run test:browser:run

# Watch mode
npm run test:browser
```

**Location**: `test/browser/`  
**Environment**: Real Chromium browser via Playwright  
**Purpose**: Validate real browser APIs, storage systems, cross-tab sync

### 🚀 Comprehensive Testing

```bash
# Run all tests (recommended for PRs)
npm run test:all
```

## Test Structure

```
test/
├── setup.ts                    # Unit test setup
├── template.test.ts            # Test template
├── core/                       # Unit tests for core functionality
│   ├── store.basic.test.ts
│   ├── store.advanced.*.test.ts
│   └── store.*.test.ts
├── react/                      # Unit tests for React integration
│   ├── hooks.test.tsx
│   └── *.test.tsx
└── browser/                    # Browser integration tests
    ├── setup.ts               # Browser test setup
    ├── storage.browser.test.ts # Real storage testing
    ├── plugins.browser.test.ts # Plugin system testing
    └── react.browser.test.tsx  # React in real browser
```

## Writing Tests

### Unit Tests

Use standard Vitest patterns with jsdom environment:

```typescript
import {describe, it, expect} from 'vitest'
import {createStore} from '../src/core/state/createStore'

describe('Feature Name', () => {
  it('should work correctly', () => {
    const store = createStore({count: 0})
    // Test logic here
  })
})
```

### Browser Tests

Browser tests validate real browser behavior:

```typescript
import {describe, it, expect, beforeEach} from 'vitest'
import {createStore} from '../../src/core/state/createStore'

describe('Browser Feature Tests', () => {
  beforeEach(() => {
    // Real storage is cleaned in setup.ts
    // No manual cleanup needed
  })

  it('should persist to real localStorage', () => {
    const store = createStore(
      {data: 'test'},
      {persistKey: 'test-key', storageType: StorageType.Local}
    )

    // Verify real localStorage
    const stored = localStorage.getItem('test-key')
    expect(stored).toBeTruthy()
  })
})
```

## CI/CD Pipeline

Our GitHub Actions workflows ensure code quality:

### 🔄 Pull Request Validation

Every PR triggers:

- ✅ Linting and type checking
- ✅ Unit tests with coverage
- ✅ Browser tests in real Chromium
- ✅ Build verification
- ✅ Security scanning

### 🧪 Matrix Testing

Weekly comprehensive testing across:

- **Node.js**: 18.x, 20.x, 22.x
- **OS**: Ubuntu, macOS, Windows\*
- **Browsers**: Chromium (real browser testing)

\*Windows runs unit tests only due to Playwright complexity

### 🚀 Release Process

Releases include:

- Full test suite validation
- Browser compatibility testing
- Automated publishing to GitHub Packages

## Development Workflow

### 1. Setup Development Environment

```bash
# Install dependencies
npm install

# Install browsers
npx playwright install chromium

# Verify setup
npm run test:all
```

### 2. Making Changes

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes
# Add tests (both unit and browser if needed)

# Run tests locally
npm run test:all

# Lint and format
npm run lint:fix
npm run format
```

### 3. Testing Your Changes

```bash
# Quick feedback loop
npm test                    # Unit tests in watch mode

# Full validation
npm run test:all           # All tests
npm run test:coverage      # Coverage report
npm run build              # Ensure builds work
```

### 4. Submitting Changes

- Ensure all tests pass
- Add tests for new features
- Update documentation if needed
- Submit PR with clear description

## Code Quality Standards

### TypeScript

- Full type safety required
- Use TSDoc comments for public APIs
- Follow existing patterns

### Testing

- **Unit tests**: For logic and React hooks
- **Browser tests**: For storage, cross-tab sync, real browser behavior
- **Coverage**: Aim for >80% overall coverage

### Code Style

- ESLint + Prettier configuration
- Consistent naming conventions
- Follow architectural patterns

## Project Architecture

```
src/
├── index.ts              # Main export (vanilla TS)
├── react.ts              # React-specific exports
├── core/                 # Core functionality
│   ├── state/           # Store creation and management
│   ├── selectors/       # Selector system
│   ├── storage/         # Persistence layer
│   └── utils/           # Core utilities
├── react/               # React integration
├── plugins/             # Plugin system
└── shared/              # Shared utilities
```

### Key Principles

- **Dual Export**: Vanilla TypeScript + React
- **Type Safety**: Comprehensive TypeScript coverage
- **Modular**: Clean separation of concerns
- **Extensible**: Plugin system for custom functionality
- **Tested**: Both unit and browser testing

## Getting Help

- 📖 Check existing documentation
- 🔍 Search existing issues
- 💬 Create a discussion for questions
- 🐛 Report bugs with our issue template

## Release Process

1. **Development**: Feature branches → `develop`
2. **Testing**: Comprehensive CI validation
3. **Release**: `develop` → `main` → tagged release
4. **Publishing**: Automated GitHub Packages release

Thank you for contributing to Poly State! 🚀
