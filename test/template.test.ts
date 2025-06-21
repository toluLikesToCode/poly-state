/**
 * Test Template for Universal Store
 *
 * Use this template when creating new test files or migrating existing tests.
 * Replace the placeholder content with your actual test cases.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createStore, type Store } from "../src/core/store.js";
// For React tests, also import:
// import { createStoreContext } from '../src/react/index.js'

interface ExampleState {
  count: number;
  name: string;
}

describe("Feature Name", () => {
  let store: Store<ExampleState>;

  beforeEach(() => {
    // Setup before each test
    store = createStore({
      count: 0,
      name: "test",
    });
  });

  afterEach(() => {
    // Cleanup after each test if needed
    vi.clearAllMocks();
  });

  describe("Basic functionality", () => {
    it("should initialize with correct state", () => {
      expect(store.getState()).toEqual({
        count: 0,
        name: "test",
      });
    });

    it("should update state correctly", () => {
      store.dispatch({ count: 1 });
      expect(store.getState()).toEqual({
        count: 1,
        name: "test",
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle edge case scenarios", () => {
      // Test edge cases - example:
      store.dispatch({ count: -1 });
      expect(store.getState().count).toBe(-1);
    });
  });

  describe("Error handling", () => {
    it("should handle invalid operations gracefully", () => {
      // Example of testing error scenarios
      const initialState = store.getState();

      // This should not crash the store
      store.dispatch({});

      // State should remain consistent
      expect(store.getState()).toEqual(initialState);
    });
  });
});

/**
 * Migration Checklist for Existing Tests:
 *
 * 1. Update imports:
 *    - Change from Jest to Vitest imports
 *    - Update store imports to use new paths
 *
 * 2. Update mocking:
 *    - Change jest.fn() to vi.fn()
 *    - Change jest.mock() to vi.mock()
 *
 * 3. Update store usage:
 *    - Use createStore() instead of new Store()
 *    - Use dispatch() instead of setState()
 *
 * 4. Update React tests:
 *    - Use createStoreContext() pattern
 *    - Import React Testing Library correctly
 *
 * 5. Update assertions:
 *    - Most Jest assertions work the same in Vitest
 *    - Check for any custom matchers that need updating
 */
