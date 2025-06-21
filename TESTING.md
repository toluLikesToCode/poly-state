# Testing Guide for Universal Store

This project uses [Vitest](https://vitest.dev) as the test runner. Vitest provides a fast, modern testing experience with TypeScript support and React Testing Library integration.

## Running Tests

### Basic Commands

```bash
# Run tests in watch mode (default)
npm test

# Run tests once and exit
npm run test:run

# Run tests with UI dashboard
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

### Test Structure

The test files are organized in the `test/` directory:

```text
test/
├── setup.ts          # Global test setup and mocks
├── core/
│   └── store.test.ts  # Core store functionality tests
└── react/
    └── hooks.test.tsx # React integration tests
```

## Test Environment Setup

The testing environment is configured in `vitest.config.ts` with:

- **Environment**: jsdom (for DOM and React testing)
- **Setup**: Global mocks for localStorage/sessionStorage
- **Coverage**: V8 provider with 80% thresholds
- **Testing Library**: React Testing Library for component testing

## Writing Tests

### Core Store Tests

For testing the core store functionality:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createStore, type Store } from "../../src/core/store.js";

describe("Store Feature", () => {
  let store: Store<{ count: number }>;

  beforeEach(() => {
    store = createStore({ count: 0 });
  });

  it("should test store behavior", () => {
    store.dispatch({ count: 1 });
    expect(store.getState().count).toBe(1);
  });
});
```

### React Integration Tests

For testing React components and hooks:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "../../src/core/store.js";
import { createStoreContext } from "../../src/react/index.js";

describe("React Integration", () => {
  let store: ReturnType<typeof createStore<{ count: number }>>;

  beforeEach(() => {
    store = createStore({ count: 0 });
  });

  it("should create store context successfully", () => {
    const context = createStoreContext(store);
    expect(context.StoreProvider).toBeDefined();
    expect(context.useStore).toBeDefined();
  });
});
```

## Coverage Reports

Coverage reports are generated in the `coverage/` directory when running `npm run test:coverage`. The project maintains 80% coverage thresholds for:

- Branches
- Functions
- Lines
- Statements

## Mocks and Test Utilities

The `test/setup.ts` file provides:

- localStorage and sessionStorage mocks
- Global test utilities
- React Testing Library setup
- Automatic mock cleanup between tests

## Debugging Tests

To debug tests in VS Code:

1. Set breakpoints in your test files
2. Run the "Debug Tests" task (or use the Test Explorer)
3. Tests will pause at breakpoints for inspection

For command line debugging:

```bash
# Run specific test file
npm test test/core/store.test.ts

# Run tests matching pattern
npm test -- --grep="specific test name"
```

## CI/CD Integration

The test configuration is ready for CI/CD environments with:

- No watch mode in CI
- Coverage reporting
- JUnit XML output (if needed)
- Proper exit codes

Add to your CI pipeline:

```yaml
- name: Run Tests
  run: npm run test:run

- name: Generate Coverage
  run: npm run test:coverage
```
