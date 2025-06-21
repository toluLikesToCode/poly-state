/**
 * Advanced Selector Tests for Universal Store
 *
 * Comprehensive test suite covering advanced selector functionality including:
 * - Memoized selectors with performance optimization
 * - Multi-input selectors with dependency tracking
 * - Parameterized selectors for dynamic state selection
 * - Dependency subscriptions with custom equality and debouncing
 * - Path-based subscriptions for nested state monitoring
 * - Selector caching and cleanup mechanisms
 * - Performance optimization scenarios
 * - Complex state transformations and computations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createStore, type Store } from "../../src/core";

// Test state interfaces
interface UserProfile {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  preferences: {
    theme: "light" | "dark";
    notifications: boolean;
    language: string;
  };
  metadata: {
    lastLogin: number;
    createdAt: number;
    isVerified: boolean;
  };
}

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
  tags: string[];
  ratings: {
    average: number;
    count: number;
    reviews: Array<{
      id: number;
      rating: number;
      comment: string;
      userId: number;
    }>;
  };
}

interface AppState {
  users: {
    byId: Map<number, UserProfile>;
    activeUserId: number | null;
    searchQuery: string;
  };
  products: {
    items: Product[];
    categories: string[];
    filters: {
      category: string | null;
      priceRange: [number, number];
      inStockOnly: boolean;
      searchTerm: string;
    };
    pagination: {
      page: number;
      limit: number;
      total: number;
    };
  };
  ui: {
    loading: boolean;
    errors: string[];
    modals: {
      [key: string]: boolean;
    };
    notifications: Array<{
      id: string;
      type: "info" | "warning" | "error" | "success";
      message: string;
      timestamp: number;
    }>;
  };
  settings: {
    apiUrl: string;
    debugMode: boolean;
    features: {
      [feature: string]: boolean;
    };
  };
}

describe("Advanced Selector Operations", () => {
  let store: Store<AppState>;
  let initialState: AppState;

  beforeEach(() => {
    // Reset mock timers for each test
    vi.clearAllMocks();
    vi.clearAllTimers();

    initialState = {
      users: {
        byId: new Map([
          [
            1,
            {
              id: 1,
              name: "John Doe",
              email: "john@example.com",
              preferences: {
                theme: "dark",
                notifications: true,
                language: "en",
              },
              metadata: {
                lastLogin: Date.now() - 86400000, // 1 day ago
                createdAt: Date.now() - 2592000000, // 30 days ago
                isVerified: true,
              },
            },
          ],
          [
            2,
            {
              id: 2,
              name: "Jane Smith",
              email: "jane@example.com",
              preferences: {
                theme: "light",
                notifications: false,
                language: "es",
              },
              metadata: {
                lastLogin: Date.now() - 3600000, // 1 hour ago
                createdAt: Date.now() - 1296000000, // 15 days ago
                isVerified: false,
              },
            },
          ],
        ]),
        activeUserId: 1,
        searchQuery: "",
      },
      products: {
        items: [
          {
            id: 1,
            name: "Gaming Laptop",
            price: 1299.99,
            category: "electronics",
            inStock: true,
            tags: ["gaming", "laptop", "high-performance"],
            ratings: {
              average: 4.5,
              count: 128,
              reviews: [
                {
                  id: 1,
                  rating: 5,
                  comment: "Excellent performance!",
                  userId: 1,
                },
                {
                  id: 2,
                  rating: 4,
                  comment: "Good value for money",
                  userId: 2,
                },
              ],
            },
          },
          {
            id: 2,
            name: "Wireless Headphones",
            price: 199.99,
            category: "audio",
            inStock: false,
            tags: ["wireless", "headphones", "noise-canceling"],
            ratings: {
              average: 4.2,
              count: 89,
              reviews: [
                { id: 3, rating: 4, comment: "Great sound quality", userId: 1 },
              ],
            },
          },
          {
            id: 3,
            name: "Mechanical Keyboard",
            price: 149.99,
            category: "accessories",
            inStock: true,
            tags: ["mechanical", "keyboard", "gaming"],
            ratings: {
              average: 4.7,
              count: 56,
              reviews: [],
            },
          },
        ],
        categories: ["electronics", "audio", "accessories"],
        filters: {
          category: null,
          priceRange: [0, 2000],
          inStockOnly: false,
          searchTerm: "",
        },
        pagination: {
          page: 1,
          limit: 10,
          total: 3,
        },
      },
      ui: {
        loading: false,
        errors: [],
        modals: {},
        notifications: [],
      },
      settings: {
        apiUrl: "https://api.example.com",
        debugMode: false,
        features: {
          darkMode: true,
          notifications: true,
          analytics: false,
        },
      },
    };

    store = createStore(initialState);
  });

  afterEach(() => {
    vi.clearAllTimers();
    store.destroy();
  });

  describe("Basic Memoized Selectors", () => {
    it("should create and cache simple selectors", () => {
      const selectActiveUserId = store.select(
        state => state.users.activeUserId
      );
      const selectLoadingState = store.select(state => state.ui.loading);

      // First calls
      const userId1 = selectActiveUserId();
      const loading1 = selectLoadingState();

      // Second calls should return same references for memoization
      const userId2 = selectActiveUserId();
      const loading2 = selectLoadingState();

      expect(userId1).toBe(userId2);
      expect(loading1).toBe(loading2);
      expect(userId1).toBe(1);
      expect(loading1).toBe(false);
    });

    it("should recompute when state changes", () => {
      const selectActiveUserId = store.select(
        state => state.users.activeUserId
      );

      const initialUserId = selectActiveUserId();
      expect(initialUserId).toBe(1);

      // Change the state
      store.dispatch({ users: { ...store.getState().users, activeUserId: 2 } });

      const newUserId = selectActiveUserId();
      expect(newUserId).toBe(2);
    });

    it("should handle complex state transformations", () => {
      const selectActiveUser = store.select(state => {
        const { activeUserId, byId } = state.users;
        return activeUserId ? byId.get(activeUserId) || null : null;
      });

      const activeUser = selectActiveUser();
      expect(activeUser).toEqual(initialState.users.byId.get(1));
      expect(activeUser?.name).toBe("John Doe");
    });

    it("should maintain type safety with selectors", () => {
      const selectUserCount = store.select(state => state.users.byId.size);
      const selectFirstProduct = store.select(state => state.products.items[0]);

      const userCount: number = selectUserCount();
      const firstProduct: Product = selectFirstProduct();

      expect(userCount).toBe(2);
      expect(firstProduct.name).toBe("Gaming Laptop");
    });
  });

  describe("Multi-Input Selectors", () => {
    it("should combine multiple selectors into computed values", () => {
      const selectUsers = store.select(state => state.users.byId);
      const selectActiveUserId = store.select(
        state => state.users.activeUserId
      );

      const selectActiveUserWithStatus = store.select(
        selectUsers,
        selectActiveUserId,
        (users, activeUserId) => {
          const user = activeUserId ? users.get(activeUserId) : null;
          return user
            ? {
                ...user,
                status: user.metadata.isVerified ? "verified" : "unverified",
                isRecent: Date.now() - user.metadata.lastLogin < 7200000, // 2 hours
              }
            : null;
        }
      );

      const activeUserWithStatus = selectActiveUserWithStatus();
      expect(activeUserWithStatus).toBeTruthy();
      expect(activeUserWithStatus?.status).toBe("verified");
      expect(activeUserWithStatus?.isRecent).toBe(false); // More than 2 hours ago
    });

    it("should handle complex multi-selector computations", () => {
      const selectProducts = store.select(state => state.products.items);
      const selectFilters = store.select(state => state.products.filters);
      const selectCategories = store.select(state => state.products.categories);

      const selectFilteredProductsWithStats = store.select(
        selectProducts,
        selectFilters,
        selectCategories,
        (products, filters, categories) => {
          let filtered = products;

          // Apply category filter
          if (filters.category) {
            filtered = filtered.filter(p => p.category === filters.category);
          }

          // Apply price range filter
          filtered = filtered.filter(
            p =>
              p.price >= filters.priceRange[0] &&
              p.price <= filters.priceRange[1]
          );

          // Apply stock filter
          if (filters.inStockOnly) {
            filtered = filtered.filter(p => p.inStock);
          }

          // Apply search filter
          if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            filtered = filtered.filter(
              p =>
                p.name.toLowerCase().includes(term) ||
                p.tags.some(tag => tag.toLowerCase().includes(term))
            );
          }

          // Calculate statistics
          const stats = {
            total: filtered.length,
            averagePrice:
              filtered.length > 0
                ? filtered.reduce((sum, p) => sum + p.price, 0) /
                  filtered.length
                : 0,
            inStockCount: filtered.filter(p => p.inStock).length,
            categoryCounts: categories.reduce((acc, cat) => {
              acc[cat] = filtered.filter(p => p.category === cat).length;
              return acc;
            }, {} as Record<string, number>),
          };

          return { products: filtered, stats };
        }
      );

      const result = selectFilteredProductsWithStats();
      expect(result.products).toHaveLength(3);
      expect(result.stats.total).toBe(3);
      expect(result.stats.averagePrice).toBeCloseTo(549.99, 2);
      expect(result.stats.inStockCount).toBe(2);
    });

    it.skip("should only recompute when dependencies change", () => {
      const selectProducts = store.select(state => state.products.items);
      const selectFilters = store.select(state => state.products.filters);

      const computationSpy = vi.fn();
      const selectFilteredProducts = store.select(
        selectProducts,
        selectFilters,
        (products, filters) => {
          computationSpy();
          return products.filter(
            p => !filters.category || p.category === filters.category
          );
        }
      );

      // First computation
      selectFilteredProducts();
      expect(computationSpy).toHaveBeenCalledTimes(1);

      // Calling again without state change shouldn't recompute
      selectFilteredProducts();
      expect(computationSpy).toHaveBeenCalledTimes(1);

      // Change unrelated state shouldn't trigger recomputation
      store.dispatch({ ui: { ...store.getState().ui, loading: true } });
      selectFilteredProducts();
      expect(computationSpy).toHaveBeenCalledTimes(1);

      // Change relevant state should trigger recomputation
      store.dispatch({
        products: {
          ...store.getState().products,
          filters: {
            ...store.getState().products.filters,
            category: "electronics",
          },
        },
      });
      selectFilteredProducts();
      expect(computationSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("Parameterized Selectors", () => {
    it("should create selectors that accept runtime parameters", () => {
      const selectUserById = store.selectWith(
        [state => state.users.byId] as const,
        (userId: number) => users => users.get(userId) || null
      );

      const getUser1 = selectUserById(1);
      const getUser2 = selectUserById(2);

      const user1 = getUser1();
      const user2 = getUser2();

      expect(user1?.name).toBe("John Doe");
      expect(user2?.name).toBe("Jane Smith");
    });

    it("should cache selectors per parameter combination", () => {
      const computationSpy = vi.fn();

      const selectProductsByCategory = store.selectWith(
        [state => state.products.items] as const,
        (category: string) => products => {
          computationSpy(category);
          return products.filter(p => p.category === category);
        }
      );

      const getElectronics = selectProductsByCategory("electronics");
      const getAudio = selectProductsByCategory("audio");

      // First calls
      getElectronics();
      getAudio();
      expect(computationSpy).toHaveBeenCalledTimes(2);

      // Second calls should use cached results
      getElectronics();
      getAudio();
      expect(computationSpy).toHaveBeenCalledTimes(2);

      // New category should trigger computation
      const getAccessories = selectProductsByCategory("accessories");
      getAccessories();
      expect(computationSpy).toHaveBeenCalledTimes(3);
    });

    it("should handle complex parameterized transformations", () => {
      interface ProductSearchParams {
        category?: string;
        minPrice?: number;
        maxPrice?: number;
        tags?: string[];
        inStockOnly?: boolean;
      }

      const selectProductsWithParams = store.selectWith(
        [state => state.products.items] as const,
        (params: ProductSearchParams) => products => {
          let filtered = products;

          if (params.category) {
            filtered = filtered.filter(p => p.category === params.category);
          }

          if (params.minPrice !== undefined) {
            filtered = filtered.filter(p => p.price >= params.minPrice!);
          }

          if (params.maxPrice !== undefined) {
            filtered = filtered.filter(p => p.price <= params.maxPrice!);
          }

          if (params.tags?.length) {
            filtered = filtered.filter(p =>
              params.tags!.some(tag => p.tags.includes(tag))
            );
          }

          if (params.inStockOnly) {
            filtered = filtered.filter(p => p.inStock);
          }

          return {
            products: filtered,
            count: filtered.length,
            totalValue: filtered.reduce((sum, p) => sum + p.price, 0),
          };
        }
      );

      const gamingProducts = selectProductsWithParams({
        tags: ["gaming"],
        inStockOnly: true,
      })();

      const affordableElectronics = selectProductsWithParams({
        category: "electronics",
        maxPrice: 1500,
      })();

      expect(gamingProducts.count).toBe(2); // Gaming laptop and keyboard (both in stock)
      expect(affordableElectronics.count).toBe(1); // Only gaming laptop under $1500
    });

    it("should support nested parameterized selectors", () => {
      const selectUsersByPreference = store.selectWith(
        [state => state.users.byId] as const,
        (preference: keyof UserProfile["preferences"]) => users => {
          return Array.from(users.values()).reduce((acc, user) => {
            const value = String(user.preferences[preference]);
            if (!acc[value]) acc[value] = [];
            acc[value].push(user);
            return acc;
          }, {} as Record<string, UserProfile[]>);
        }
      );

      const usersByTheme = selectUsersByPreference("theme")();
      const usersByLanguage = selectUsersByPreference("language")();

      expect(usersByTheme.dark).toHaveLength(1);
      expect(usersByTheme.light).toHaveLength(1);
      expect(usersByLanguage.en).toHaveLength(1);
      expect(usersByLanguage.es).toHaveLength(1);
    });
  });

  describe("Dependency Subscriptions", () => {
    it("should subscribe to specific selector changes", async () => {
      const listener = vi.fn();
      const selectActiveUserId = store.select(
        state => state.users.activeUserId
      );

      const unsubscribe = store.subscribeTo(
        state => state.users.activeUserId,
        listener
      );

      // Initial state, no call yet
      expect(listener).not.toHaveBeenCalled();

      // Change the active user
      store.dispatch({
        users: { ...store.getState().users, activeUserId: 2 },
      });

      expect(listener).toHaveBeenCalledWith(2, 1);

      unsubscribe();
    });

    it("should support immediate subscription callbacks", () => {
      const listener = vi.fn();

      store.subscribeTo(state => state.users.activeUserId, listener, {
        immediate: true,
      });

      expect(listener).toHaveBeenCalledWith(1, 1);
    });

    it("should support custom equality functions", () => {
      const listener = vi.fn();

      // Custom equality that only cares about user count changes
      store.subscribeTo(state => state.users.byId, listener, {
        equalityFn: (a, b) =>
          (a as Map<number, UserProfile>).size ===
          (b as Map<number, UserProfile>).size, // Only notify on size changes
      });

      // Update existing user (same size)
      const updatedUser = {
        ...initialState.users.byId.get(1)!,
        name: "John Updated",
      };
      store.dispatch({
        users: {
          ...store.getState().users,
          byId: new Map(store.getState().users.byId).set(1, updatedUser),
        },
      });

      expect(listener).not.toHaveBeenCalled();

      // Add new user (different size)
      const newUser: UserProfile = {
        id: 3,
        name: "New User",
        email: "new@example.com",
        preferences: { theme: "light", notifications: true, language: "en" },
        metadata: {
          lastLogin: Date.now(),
          createdAt: Date.now(),
          isVerified: false,
        },
      };

      store.dispatch({
        users: {
          ...store.getState().users,
          byId: new Map(store.getState().users.byId).set(3, newUser),
        },
      });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should support debounced subscriptions", async () => {
      vi.useFakeTimers();
      const listener = vi.fn();

      store.subscribeTo(state => state.products.filters.searchTerm, listener, {
        debounceMs: 100,
      });

      // Rapid changes
      store.dispatch({
        products: {
          ...store.getState().products,
          filters: { ...store.getState().products.filters, searchTerm: "g" },
        },
      });

      store.dispatch({
        products: {
          ...store.getState().products,
          filters: { ...store.getState().products.filters, searchTerm: "ga" },
        },
      });

      store.dispatch({
        products: {
          ...store.getState().products,
          filters: { ...store.getState().products.filters, searchTerm: "gam" },
        },
      });

      // Should not have been called yet
      expect(listener).not.toHaveBeenCalled();

      // Fast forward time
      vi.advanceTimersByTime(150);

      // Should be called once with the final value
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith("gam", "");

      vi.useRealTimers();
    });

    it("should handle multiple dependency subscriptions", () => {
      const userListener = vi.fn();
      const productListener = vi.fn();
      const uiListener = vi.fn();

      const unsubscribeUser = store.subscribeTo(
        state => state.users.activeUserId,
        userListener
      );

      const unsubscribeProduct = store.subscribeTo(
        state => state.products.filters.category,
        productListener
      );

      const unsubscribeUI = store.subscribeTo(
        state => state.ui.loading,
        uiListener
      );

      // Make changes to each
      store.dispatch({
        users: { ...store.getState().users, activeUserId: 2 },
      });

      store.dispatch({
        products: {
          ...store.getState().products,
          filters: {
            ...store.getState().products.filters,
            category: "electronics",
          },
        },
      });

      store.dispatch({
        ui: { ...store.getState().ui, loading: true },
      });

      expect(userListener).toHaveBeenCalledWith(2, 1);
      expect(productListener).toHaveBeenCalledWith("electronics", null);
      expect(uiListener).toHaveBeenCalledWith(true, false);

      // Cleanup
      unsubscribeUser();
      unsubscribeProduct();
      unsubscribeUI();
    });
  });

  describe("Multiple Selector Subscriptions", () => {
    it("should subscribe to changes in multiple selectors simultaneously", () => {
      const listener = vi.fn();

      const unsubscribe = store.subscribeToMultiple(
        [
          state => state.users.activeUserId,
          state => state.products.filters.category,
          state => state.ui.loading,
        ] as const,
        listener
      );

      // Change one of the watched values
      store.dispatch({
        users: { ...store.getState().users, activeUserId: 2 },
      });

      expect(listener).toHaveBeenCalledWith(
        [2, null, false], // new values
        [1, null, false] // old values
      );

      // Change multiple values at once
      store.dispatch({
        users: { ...store.getState().users, activeUserId: 1 },
        ui: { ...store.getState().ui, loading: true },
      });

      expect(listener).toHaveBeenCalledWith(
        [1, null, true], // new values
        [2, null, false] // old values
      );

      unsubscribe();
    });

    it("should work with complex selector combinations", () => {
      const listener = vi.fn();

      store.subscribeToMultiple(
        [
          state => state.users.byId.size,
          state => state.products.items.length,
          state => state.products.items.filter(p => p.inStock).length,
        ] as const,
        listener
      );

      // Add a new product
      const newProduct: Product = {
        id: 4,
        name: "USB Mouse",
        price: 29.99,
        category: "accessories",
        inStock: true,
        tags: ["mouse", "usb"],
        ratings: { average: 4.0, count: 15, reviews: [] },
      };

      store.dispatch({
        products: {
          ...store.getState().products,
          items: [...store.getState().products.items, newProduct],
        },
      });

      expect(listener).toHaveBeenCalledWith(
        [2, 4, 3], // 2 users, 4 products, 3 in stock
        [2, 3, 2] // 2 users, 3 products, 2 in stock
      );
    });
  });

  describe("Path-based Subscriptions", () => {
    it("should subscribe to changes in nested paths", () => {
      const listener = vi.fn();

      store.subscribeToPath("users.activeUserId", listener);

      store.dispatch({
        users: { ...store.getState().users, activeUserId: 2 },
      });

      expect(listener).toHaveBeenCalledWith(2, 1);
    });

    it("should handle deep nested paths", () => {
      const themeListener = vi.fn();
      const notificationListener = vi.fn();

      store.subscribeToPath("users.byId.1.preferences.theme", themeListener);
      store.subscribeToPath(
        "users.byId.1.preferences.notifications",
        notificationListener
      );

      // Update user preferences
      const updatedUser = {
        ...initialState.users.byId.get(1)!,
        preferences: {
          ...initialState.users.byId.get(1)!.preferences,
          theme: "light" as const,
        },
      };

      store.dispatch({
        users: {
          ...store.getState().users,
          byId: new Map(store.getState().users.byId).set(1, updatedUser),
        },
      });
      expect(themeListener).toHaveBeenCalledWith("light", "dark");
      expect(notificationListener).not.toHaveBeenCalled(); // Notifications didn't change
    });

    it("should handle array indices in paths", () => {
      const listener = vi.fn();

      store.subscribeToPath("products.items.0.price", listener);

      // Update first product price
      const updatedProducts = [...store.getState().products.items];
      updatedProducts[0] = { ...updatedProducts[0], price: 1199.99 };

      store.dispatch({
        products: {
          ...store.getState().products,
          items: updatedProducts,
        },
      });

      expect(listener).toHaveBeenCalledWith(1199.99, 1299.99);
    });
  });

  describe("Selector Performance and Optimization", () => {
    it.skip("should handle frequent state updates efficiently", () => {
      const computationSpy = vi.fn();

      const selectExpensiveComputation = store.select(state => {
        computationSpy();
        return state.products.items
          .filter(p => p.inStock)
          .sort((a, b) => b.ratings.average - a.ratings.average)
          .map(p => ({
            ...p,
            score:
              p.ratings.average * p.ratings.count * (p.inStock ? 1.2 : 0.8),
          }));
      });

      // First computation
      selectExpensiveComputation();
      expect(computationSpy).toHaveBeenCalledTimes(1);

      // Multiple calls without state change
      for (let i = 0; i < 10; i++) {
        selectExpensiveComputation();
      }
      expect(computationSpy).toHaveBeenCalledTimes(1);

      // Change unrelated state
      store.dispatch({ ui: { ...store.getState().ui, loading: true } });
      selectExpensiveComputation();
      expect(computationSpy).toHaveBeenCalledTimes(1);

      // Change related state
      store.dispatch({
        products: {
          ...store.getState().products,
          items: store
            .getState()
            .products.items.map(p =>
              p.id === 1 ? { ...p, inStock: false } : p
            ),
        },
      });
      selectExpensiveComputation();
      expect(computationSpy).toHaveBeenCalledTimes(2);
    });

    it("should handle large datasets efficiently", () => {
      // Create a large dataset
      const largeUserSet = new Map<number, UserProfile>();
      for (let i = 1; i <= 1000; i++) {
        largeUserSet.set(i, {
          id: i,
          name: `User ${i}`,
          email: `user${i}@example.com`,
          preferences: {
            theme: i % 2 === 0 ? "dark" : "light",
            notifications: i % 3 === 0,
            language: ["en", "es", "fr"][i % 3],
          },
          metadata: {
            lastLogin: Date.now() - i * 1000,
            createdAt: Date.now() - i * 86400000,
            isVerified: i % 5 === 0,
          },
        });
      }

      store.dispatch({
        users: { ...store.getState().users, byId: largeUserSet },
      });

      const selectActiveUsers = store.select(state =>
        Array.from(state.users.byId.values())
          .filter(user => Date.now() - user.metadata.lastLogin < 3600000) // Active in last hour
          .sort((a, b) => b.metadata.lastLogin - a.metadata.lastLogin)
      );

      const startTime = performance.now();
      const activeUsers = selectActiveUsers();
      const endTime = performance.now();

      expect(activeUsers.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(50); // Should be fast

      // Second call should be even faster (cached)
      const startTime2 = performance.now();
      selectActiveUsers();
      const endTime2 = performance.now();

      expect(endTime2 - startTime2).toBeLessThan(5); // Should be very fast
    });

    it("should handle complex selector compositions", () => {
      const selectUsers = store.select(state => state.users.byId);
      const selectProducts = store.select(state => state.products.items);
      const selectActiveUserId = store.select(
        state => state.users.activeUserId
      );

      const selectUserProductRecommendations = store.select(
        selectUsers,
        selectProducts,
        selectActiveUserId,
        (users, products, activeUserId) => {
          const activeUser = activeUserId ? users.get(activeUserId) : null;
          if (!activeUser) return [];

          // Simple recommendation algorithm based on user preferences
          return products
            .filter(p => p.inStock)
            .map(p => ({
              product: p,
              // Prefer cheaper items
              score:
                (activeUser.preferences.theme === "dark" &&
                p.tags.includes("gaming")
                  ? 20
                  : 0) +
                p.ratings.average * 10 +
                (p.ratings.count > 50 ? 10 : 0) +
                (2000 - p.price) / 100,
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(item => item.product);
        }
      );

      const recommendations = selectUserProductRecommendations();
      expect(recommendations).toHaveLength(2); // Only in-stock items
      expect(recommendations[0].inStock).toBe(true);
    });
  });

  describe("Selector Error Handling", () => {
    it("should handle selector errors gracefully", () => {
      const errorSelector = store.select(state => {
        if (!state.users.byId) {
          throw new Error("Users not available");
        }
        return state.users.byId.size;
      });

      // Should work normally
      expect(errorSelector()).toBe(2);

      // Break the state structure
      store.dispatch({
        users: { ...store.getState().users, byId: null as any },
      });

      // Should throw when selector encounters error
      expect(() => errorSelector()).toThrow("Users not available");
    });

    it("should handle parameterized selector errors", () => {
      const selectUserWithValidation = store.selectWith(
        [state => state.users.byId] as const,
        (userId: number) => users => {
          if (userId <= 0) {
            throw new Error("Invalid user ID");
          }
          return users.get(userId) || null;
        }
      );

      const getValidUser = selectUserWithValidation(1);
      const getInvalidUser = selectUserWithValidation(-1);

      expect(getValidUser()).toBeTruthy();
      expect(() => getInvalidUser()).toThrow("Invalid user ID");
    });
  });

  describe("Selector Cleanup and Memory Management", () => {
    it("should support manual selector cleanup", () => {
      // Create many selectors
      const selectors: Array<() => number> = [];
      for (let i = 0; i < 100; i++) {
        selectors.push(store.select(state => state.users.byId.size + i));
      }

      // Call all selectors to initialize them
      selectors.forEach(s => s());

      // Cleanup should work without errors
      const cleanedCount = (store as any).cleanupSelectors();
      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });

    it("should handle subscription cleanup", () => {
      const subscriptions: Array<() => void> = [];

      // Create many subscriptions
      for (let i = 0; i < 50; i++) {
        subscriptions.push(
          store.subscribeTo(
            state => state.ui.loading,
            () => {}
          )
        );
      }

      // Cleanup all subscriptions
      subscriptions.forEach(unsub => unsub());

      // Should not leak memory or cause errors
      expect(() => {
        store.dispatch({ ui: { ...store.getState().ui, loading: true } });
      }).not.toThrow();
    });
  });

  describe("Advanced Selector Integration Scenarios", () => {
    it("should handle real-world e-commerce filtering scenario", () => {
      const selectFilteredProductsWithPagination = store.select(
        state => state.products.items,
        state => state.products.filters,
        state => state.products.pagination,
        (products, filters, pagination) => {
          // Apply filters
          let filtered = products;

          if (filters.category) {
            filtered = filtered.filter(p => p.category === filters.category);
          }

          if (filters.inStockOnly) {
            filtered = filtered.filter(p => p.inStock);
          }

          if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            filtered = filtered.filter(
              p =>
                p.name.toLowerCase().includes(term) ||
                p.tags.some(tag => tag.toLowerCase().includes(term))
            );
          }

          // Apply price range
          filtered = filtered.filter(
            p =>
              p.price >= filters.priceRange[0] &&
              p.price <= filters.priceRange[1]
          );

          // Sort by rating
          filtered = filtered.sort(
            (a, b) => b.ratings.average - a.ratings.average
          );

          // Apply pagination
          const startIndex = (pagination.page - 1) * pagination.limit;
          const endIndex = startIndex + pagination.limit;
          const paginatedProducts = filtered.slice(startIndex, endIndex);

          return {
            products: paginatedProducts,
            total: filtered.length,
            hasMore: endIndex < filtered.length,
            page: pagination.page,
            totalPages: Math.ceil(filtered.length / pagination.limit),
          };
        }
      );

      // Test initial state
      const result1 = selectFilteredProductsWithPagination();
      expect(result1.products).toHaveLength(3);
      expect(result1.total).toBe(3);

      // Apply filters
      store.dispatch({
        products: {
          ...store.getState().products,
          filters: {
            ...store.getState().products.filters,
            category: "electronics",
            inStockOnly: true,
          },
        },
      });

      const result2 = selectFilteredProductsWithPagination();
      expect(result2.products).toHaveLength(1); // Only gaming laptop
      expect(result2.total).toBe(1);
    });

    it("should handle dynamic dashboard data aggregation", () => {
      const selectDashboardData = store.select(
        state => state.users.byId,
        state => state.products.items,
        state => state.ui.notifications,
        (users, products, notifications) => {
          const userArray = Array.from(users.values()) as UserProfile[];
          const userStats = {
            total: users.size,
            verified: userArray.filter(u => u.metadata.isVerified).length,
            recent: userArray.filter(
              u => Date.now() - u.metadata.lastLogin < 86400000 // Last 24 hours
            ).length,
            byTheme: userArray.reduce(
              (acc: Record<string, number>, user: UserProfile) => {
                acc[user.preferences.theme] =
                  (acc[user.preferences.theme] || 0) + 1;
                return acc;
              },
              {} as Record<string, number>
            ),
          };

          const productStats = {
            total: products.length,
            inStock: products.filter(p => p.inStock).length,
            averagePrice:
              products.reduce((sum, p) => sum + p.price, 0) / products.length,
            byCategory: products.reduce((acc, product) => {
              acc[product.category] = (acc[product.category] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
            topRated: products
              .filter(p => p.ratings.count > 0)
              .sort((a, b) => b.ratings.average - a.ratings.average)
              .slice(0, 3)
              .map(p => ({ name: p.name, rating: p.ratings.average })),
          };

          const systemStats = {
            notifications: {
              total: notifications.length,
              byType: notifications.reduce((acc, notif) => {
                acc[notif.type] = (acc[notif.type] || 0) + 1;
                return acc;
              }, {} as Record<string, number>),
            },
          };

          return { userStats, productStats, systemStats };
        }
      );

      const dashboard = selectDashboardData();

      expect(dashboard.userStats.total).toBe(2);
      expect(dashboard.userStats.verified).toBe(1);
      expect(dashboard.productStats.total).toBe(3);
      expect(dashboard.productStats.inStock).toBe(2);
      expect(dashboard.productStats.topRated).toHaveLength(3);
    });
  });
});
