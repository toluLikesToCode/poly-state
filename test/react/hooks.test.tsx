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
    expect(context.useDispatch).toBeDefined();
    expect(context.useSelector).toBeDefined();
    expect(context.StoreContext).toBeDefined();
  });

  it("should create StoreProvider component", () => {
    const { StoreProvider } = createStoreContext(store);
    expect(typeof StoreProvider).toBe("function");
    expect(StoreProvider.displayName).toBeUndefined(); // React function components don't have displayName by default
  });

  it("should create useStore hook", () => {
    const { useStore } = createStoreContext(store);
    expect(typeof useStore).toBe("function");
  });

  it("should create useDispatch hook", () => {
    const { useDispatch } = createStoreContext(store);
    expect(typeof useDispatch).toBe("function");
  });

  it("should create useSelector hook", () => {
    const { useSelector } = createStoreContext(store);
    expect(typeof useSelector).toBe("function");
  });
});
