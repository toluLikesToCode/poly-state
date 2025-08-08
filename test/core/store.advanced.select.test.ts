/**
 * Advanced Selector Tests for Poly State
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

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {createStore, Dispatch, type Store} from '../../src/core'

// Test state interfaces
interface UserProfile {
  id: number
  name: string
  email: string
  avatar?: string
  preferences: {
    theme: 'light' | 'dark'
    notifications: boolean
    language: string
  }
  metadata: {
    lastLogin: number
    createdAt: number
    isVerified: boolean
  }
}

interface Product {
  id: number
  name: string
  price: number
  category: string
  inStock: boolean
  tags: string[]
  ratings: {
    average: number
    count: number
    reviews: Array<{
      id: number
      rating: number
      comment: string
      userId: number
    }>
  }
}

interface AppState {
  users: {
    byId: Map<number, UserProfile>
    activeUserId: number | null
    searchQuery: string
  }
  products: {
    items: Product[]
    categories: string[]
    filters: {
      category: string | null
      priceRange: [number, number]
      inStockOnly: boolean
      searchTerm: string
    }
    pagination: {
      page: number
      limit: number
      total: number
    }
  }
  ui: {
    loading: boolean
    errors: string[]
    modals: {
      [key: string]: boolean
    }
    notifications: Array<{
      id: string
      type: 'info' | 'warning' | 'error' | 'success'
      message: string
      timestamp: number
    }>
  }
  settings: {
    apiUrl: string
    debugMode: boolean
    features: {
      [feature: string]: boolean
    }
  }
}

interface SmallState {
  data: number[]
  tracking: {
    updated: number
  }
}

describe('Non-Negotiable Selector Tests', () => {
  let store: Store<SmallState>
  let initialState: SmallState

  beforeEach(() => {
    // Reset mock timers for each test
    vi.clearAllMocks()
    vi.clearAllTimers()

    initialState = {
      data: [1, 2, 3, 4, 5],
      tracking: {
        updated: 1,
      },
    }

    store = createStore(initialState)
  })

  afterEach(() => {
    vi.clearAllTimers()
    store.destroy()
  })

  describe('Never return stale data', () => {
    it('should not return stale data', () => {
      const {select, dispatch, updatePath} = store

      const trackingSpy = vi.fn()
      const updatedSpy = vi.fn()

      const selectTracking = select(state => {
        trackingSpy()
        return state.tracking
      })

      const selectUpdated = select(selectTracking, tracking => {
        updatedSpy()
        return tracking.updated
      })

      const initialValue = selectUpdated()
      expect(initialValue).toBe(1)
      expect(trackingSpy).toHaveBeenCalledTimes(1)
      expect(updatedSpy).toHaveBeenCalledTimes(1)

      // Reset spies
      trackingSpy.mockClear()
      updatedSpy.mockClear()

      // Simulate a state change
      updatePath(['tracking', 'updated'], 2)

      // Should return the new value and trigger recomputation
      let updatedValue = selectUpdated()
      expect(updatedValue).toBe(2)
      expect(trackingSpy).toHaveBeenCalledTimes(1) // Should recompute base selector
      expect(updatedSpy).toHaveBeenCalledTimes(1) // Should recompute derived selector

      trackingSpy.mockClear()
      updatedSpy.mockClear()

      // dispatch an unrelated action
      dispatch({data: [6, 7, 8, 9, 10]})

      // Should not recompute, still return the last value
      const lastUpdatedValue = selectUpdated()
      expect(lastUpdatedValue).toBe(2)
      expect(trackingSpy).toHaveBeenCalledTimes(1) // global state change will trigger base selector
      expect(updatedSpy).toHaveBeenCalledTimes(0) // Should not recompute derived selector

      updatePath(['data', 2], value => value + 10)
      expect(store.getState().data[2]).toBe(18)
      const selectData = select(state => state.data)
      expect(selectData()).toEqual([6, 7, 18, 9, 10])

      // Should not recompute, still return the last value
      expect(trackingSpy).toHaveBeenCalledTimes(1)
      expect(updatedSpy).toHaveBeenCalledTimes(0) // Should not recompute derived selector

      // add new value field to tracking
      updatePath(['tracking', 'newField'], new Set(['newValue1', 'newValue2', 'newValue3']))

      expect(store.getState().tracking).toEqual({
        updated: 2,
        newField: new Set(['newValue1', 'newValue2', 'newValue3']),
      })

      updatedValue = selectUpdated()

      expect(updatedValue).toBe(2)
      //expect(trackingSpy).toHaveBeenCalledTimes(1); // global state change will trigger base selector
      //expect(updatedSpy).toHaveBeenCalledTimes(0); // Should not recompute derived selector

      updatePath<Set<string>>(['tracking', 'newField'], newField => {
        newField.delete('newValue2')
        return newField
      })

      expect(store.getState().tracking).toEqual({
        updated: 2,
        newField: new Set(['newValue1', 'newValue3']),
      })
    })
  })
})

describe('Advanced Selector Operations', () => {
  let store: Store<AppState>
  let initialState: AppState
  let dispatch: Dispatch<AppState>
  let batch: Store<AppState>['batch']
  let select: Store<AppState>['select']
  let updatePath: Store<AppState>['updatePath']
  let getState: Store<AppState>['getState']
  let selectWith: Store<AppState>['selectWith']
  let transaction: Store<AppState>['transaction']
  let subscribeTo: Store<AppState>['subscribeTo']
  let subscribe: Store<AppState>['subscribe']
  let subscribeToMultiple: Store<AppState>['subscribeToMultiple']
  let subscribeToPath: Store<AppState>['subscribeToPath']

  beforeEach(() => {
    // Reset mock timers for each test
    vi.clearAllMocks()
    vi.clearAllTimers()

    initialState = {
      users: {
        byId: new Map([
          [
            1,
            {
              id: 1,
              name: 'John Doe',
              email: 'john@example.com',
              preferences: {
                theme: 'dark',
                notifications: true,
                language: 'en',
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
              name: 'Jane Smith',
              email: 'jane@example.com',
              preferences: {
                theme: 'light',
                notifications: false,
                language: 'es',
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
        searchQuery: '',
      },
      products: {
        items: [
          {
            id: 1,
            name: 'Gaming Laptop',
            price: 1299.99,
            category: 'electronics',
            inStock: true,
            tags: ['gaming', 'laptop', 'high-performance'],
            ratings: {
              average: 4.5,
              count: 128,
              reviews: [
                {
                  id: 1,
                  rating: 5,
                  comment: 'Excellent performance!',
                  userId: 1,
                },
                {
                  id: 2,
                  rating: 4,
                  comment: 'Good value for money',
                  userId: 2,
                },
              ],
            },
          },
          {
            id: 2,
            name: 'Wireless Headphones',
            price: 199.99,
            category: 'audio',
            inStock: false,
            tags: ['wireless', 'headphones', 'noise-canceling'],
            ratings: {
              average: 4.2,
              count: 89,
              reviews: [{id: 3, rating: 4, comment: 'Great sound quality', userId: 1}],
            },
          },
          {
            id: 3,
            name: 'Mechanical Keyboard',
            price: 149.99,
            category: 'accessories',
            inStock: true,
            tags: ['mechanical', 'keyboard', 'gaming'],
            ratings: {
              average: 4.7,
              count: 56,
              reviews: [],
            },
          },
        ],
        categories: ['electronics', 'audio', 'accessories', 'mommy'],
        filters: {
          category: null,
          priceRange: [0, 2000],
          inStockOnly: false,
          searchTerm: '',
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
        apiUrl: 'https://api.example.com',
        debugMode: false,
        features: {
          darkMode: true,
          notifications: true,
          analytics: false,
        },
      },
    }

    store = createStore(initialState)
    ;({
      dispatch,
      select,
      updatePath,
      getState,
      selectWith,
      transaction,
      subscribeTo,
      subscribe,
      subscribeToMultiple,
      subscribeToPath,
      batch,
    } = store)
  })

  afterEach(() => {
    vi.clearAllTimers()
    store.destroy({resetRegistry: true})
  })

  describe('Basic Memoized Selectors', () => {
    it('should create and cache simple selectors', () => {
      const selectUsers = select(state => state.users)
      const selectActiveUserId = select(selectUsers, users => users.activeUserId)
      const selectLoadingState = select(state => state.ui.loading)

      // First calls
      const userId1 = selectActiveUserId()
      const loading1 = selectLoadingState()

      // Second calls should return same references for memoization
      const userId2 = selectActiveUserId()
      const loading2 = selectLoadingState()

      expect(userId1).toBe(userId2)
      expect(loading1).toBe(loading2)
      expect(userId1).toBe(1)
      expect(loading1).toBe(false)
    })

    it('should recompute when state changes', () => {
      const selectActiveUserId = select(state => state.users.activeUserId)

      const initialUserId = selectActiveUserId()
      expect(initialUserId).toBe(1)

      // Change the state
      updatePath(['users', 'activeUserId'], 2)

      const newUserId = selectActiveUserId()
      expect(newUserId).toBe(2)
    })

    it('should handle complex state transformations', () => {
      const baseSelectorSpy = vi.fn()
      const activeUserSelectorSpy = vi.fn()
      const selectUsers = select(state => {
        baseSelectorSpy()
        return state.users
      })
      const selectActiveUser = select(selectUsers, users => {
        activeUserSelectorSpy()
        const {activeUserId, byId} = users
        return activeUserId ? byId.get(activeUserId) || null : null
      })

      const activeUser = selectActiveUser()
      expect(activeUser).toEqual(initialState.users.byId.get(1))
      expect(activeUser?.name).toBe('John Doe')
      expect(baseSelectorSpy).toHaveBeenCalledTimes(1)
      expect(activeUserSelectorSpy).toHaveBeenCalledTimes(1)

      // Call again, should return cached value
      const activeUser2 = selectActiveUser()
      expect(activeUser2).toEqual(initialState.users.byId.get(1))
      expect(activeUser2?.name).toBe('John Doe')
      expect(activeUser2).toBe(activeUser) // Should return same reference
      expect(baseSelectorSpy).toHaveBeenCalledTimes(1)
      expect(activeUserSelectorSpy).toHaveBeenCalledTimes(1)
    })

    it('should maintain type safety with selectors', () => {
      const selectUserCount = store.select(state => state.users.byId.size)
      const selectFirstProduct = store.select(state => state.products.items[0])

      const userCount: number = selectUserCount()
      const firstProduct: Product = selectFirstProduct()

      expect(userCount).toBe(2)
      expect(firstProduct.name).toBe('Gaming Laptop')
    })
  })

  describe('Multi-Input Selectors', () => {
    it('should combine multiple selectors into computed values', () => {
      const baseUserSelector = select(state => state.users)
      const selectUsers = select(baseUserSelector, users => users.byId)
      const selectActiveUserId = select(baseUserSelector, users => users.activeUserId)

      const selectActiveUserWithStatus = select(
        selectUsers,
        selectActiveUserId,
        (users, activeUserId) => {
          const user = activeUserId ? users.get(activeUserId) : null
          return user
            ? {
                ...user,
                status: user.metadata.isVerified ? 'verified' : 'unverified',
                isRecent: Date.now() - user.metadata.lastLogin < 7200000, // 2 hours
              }
            : null
        }
      )

      const activeUserWithStatus = selectActiveUserWithStatus()
      expect(activeUserWithStatus).toBeTruthy()
      expect(activeUserWithStatus?.status).toBe('verified')
      expect(activeUserWithStatus?.isRecent).toBe(false) // More than 2 hours ago
    })

    it('should handle complex multi-selector computations', () => {
      const selectProducts = select(state => state.products)
      // Selectors for items, filters, and categories
      const selectItemProps = select(selectProducts, products => products.items) // props for items
      const selectItems = select(selectItemProps, items => items) // items selector

      const selectFilterProps = select(selectProducts, products => products.filters) // props for filters
      const selectFilters = select(selectFilterProps, filters => filters) // filters selector

      const selectCategoriesProps = select(selectProducts, products => products.categories) // props for categories
      const selectCategories = select(selectCategoriesProps, categories => categories) // categories selector

      const selectFilteredProductsWithStats = select(
        selectItems,
        selectFilters,
        selectCategories,
        (products, filters, categories) => {
          let filtered = products

          // Apply category filter
          if (filters.category) {
            filtered = filtered.filter(p => p.category === filters.category)
          }

          // Apply price range filter
          filtered = filtered.filter(
            p => p.price >= filters.priceRange[0] && p.price <= filters.priceRange[1]
          )

          // Apply stock filter
          if (filters.inStockOnly) {
            filtered = filtered.filter(p => p.inStock)
          }

          // Apply search filter
          if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase()
            filtered = filtered.filter(
              p =>
                p.name.toLowerCase().includes(term) ||
                p.tags.some(tag => tag.toLowerCase().includes(term))
            )
          }

          // Calculate statistics
          const stats = {
            total: filtered.length,
            averagePrice:
              filtered.length > 0
                ? filtered.reduce((sum, p) => sum + p.price, 0) / filtered.length
                : 0,
            inStockCount: filtered.filter(p => p.inStock).length,
            categoryCounts: categories.reduce(
              (acc, cat) => {
                acc[cat] = filtered.filter(p => p.category === cat).length
                return acc
              },
              {} as Record<string, number>
            ),
          }

          return {products: filtered, stats}
        }
      )

      const result = selectFilteredProductsWithStats()
      expect(result.products).toHaveLength(3)
      expect(result.stats.total).toBe(3)
      expect(result.stats.averagePrice).toBeCloseTo(549.99, 2)
      expect(result.stats.inStockCount).toBe(2)
    })

    it('should only recompute when dependencies change', () => {
      const productSpy = vi.fn()
      const itemsSpy = vi.fn()
      const filtersSpy = vi.fn()
      const selectProducts = select(state => {
        productSpy()
        return state.products
      })
      const selectItemsProps = select(selectProducts, products => products.items)
      const selectFilterProps = select(selectProducts, products => products.filters)
      const selectItems = select(selectItemsProps, items => {
        itemsSpy()
        return items
      })
      const selectFilters = select(selectFilterProps, filters => {
        filtersSpy()
        return filters
      })

      const computationSpy = vi.fn()
      const selectFilteredProducts = select(selectItems, selectFilters, (items, filters) => {
        computationSpy()
        return items.filter(p => !filters.category || p.category === filters.category)
      })

      // First computation
      const firstValue = selectFilteredProducts()
      expect(computationSpy).toHaveBeenCalledTimes(1)
      expect(productSpy).toHaveBeenCalledTimes(1)
      expect(itemsSpy).toHaveBeenCalledTimes(1)
      expect(filtersSpy).toHaveBeenCalledTimes(1)

      // Calling again without state change shouldn't recompute
      let nextValue = selectFilteredProducts()
      expect(computationSpy).toHaveBeenCalledTimes(1)
      expect(productSpy).toHaveBeenCalledTimes(1)
      expect(itemsSpy).toHaveBeenCalledTimes(1)
      expect(filtersSpy).toHaveBeenCalledTimes(1)
      expect(nextValue).toEqual(firstValue)

      // Change unrelated state shouldn't trigger recomputation
      updatePath(['ui', 'loading'], true)

      nextValue = selectFilteredProducts()

      expect(computationSpy).toHaveBeenCalledTimes(1)
      expect(productSpy).toHaveBeenCalledTimes(2) // global state change will trigger base selector
      expect(itemsSpy).toHaveBeenCalledTimes(1)
      expect(filtersSpy).toHaveBeenCalledTimes(1)
      expect(nextValue).toBe(firstValue) // Should return same items

      // Change relevant state should trigger recomputation

      updatePath(['products', 'filters', 'category'], 'electronics')
      nextValue = selectFilteredProducts()
      expect(computationSpy).toHaveBeenCalledTimes(2)
      expect(productSpy).toHaveBeenCalledTimes(3) // base selector should recompute
      expect(itemsSpy).toHaveBeenCalledTimes(1) // Should not recompute derived selector
      expect(filtersSpy).toHaveBeenCalledTimes(2) // filters selector should recompute
      expect(nextValue).toEqual(
        initialState.products.items.filter(p => p.category === 'electronics')
      ) // Should return filtered items

      const itemValues1 = selectItems()

      // update products pagination but not items or filters
      updatePath(['products', 'pagination', 'page'], 2)
      selectFilteredProducts()
      expect(computationSpy).toHaveBeenCalledTimes(2) // Should not recompute
      expect(productSpy).toHaveBeenCalledTimes(4) // base selector should recompute
      let nextItemValue = selectItems()
      expect(itemValues1).toEqual(nextItemValue) // Should return same items
      expect(itemsSpy).toHaveBeenCalledTimes(1) // Should not recompute
      expect(filtersSpy).toHaveBeenCalledTimes(2) // filters selector should recompute
    })
  })

  describe('Parameterized Selectors', () => {
    it('should create selectors that accept runtime parameters', () => {
      const selectUserById = store.selectWith(
        [state => state.users.byId],
        (userId: number) => users => users.get(userId) || null
      )

      const getUser1 = selectUserById(1)
      const getUser2 = selectUserById(2)

      const user1 = getUser1()
      const user2 = getUser2()

      expect(user1?.name).toBe('John Doe')
      expect(user2?.name).toBe('Jane Smith')
    })

    it('should cache selectors per parameter combination', () => {
      const computationSpy = vi.fn()

      const selectProducts = select(state => state.products)
      const selectItemProps = select(selectProducts, products => products.items)
      const selectItems = select(selectItemProps, items => items)

      const selectProductsByCategory = selectWith([selectItems], (category: string) => items => {
        computationSpy(category)
        return items.filter(p => p.category === category)
      })

      const getElectronics = selectProductsByCategory('electronics')
      const getAudio = selectProductsByCategory('audio')

      // First calls
      getElectronics()
      getAudio()
      expect(computationSpy).toHaveBeenCalledTimes(2)

      // Second calls should use cached results
      getElectronics()
      getAudio()
      expect(computationSpy).toHaveBeenCalledTimes(2)

      // New category should trigger computation
      const getAccessories = selectProductsByCategory('accessories')
      getAccessories()
      expect(computationSpy).toHaveBeenCalledTimes(3)

      updatePath(['products', 'items', 2, 'category'], 'mommy')
      getElectronics()
      expect(computationSpy).toHaveBeenCalledTimes(4)
      const getMommy = selectProductsByCategory('mommy')
      const mommyItems = getMommy()
      expect(getState().products.items[2].category).toBe('mommy')
      expect(mommyItems.length).toBe(1)

      expect(getState().users.byId.get(1)?.metadata.isVerified).toBe(true)

      updatePath(['users', 'byId'], users => {
        const user = users.get(1)
        if (user) {
          user.metadata.isVerified = false
          users.set(1, user)
        }
        return users
      })
      expect(getState().users.byId.get(1)?.metadata.isVerified).toBe(false)
    })

    it('should handle complex parameterized transformations', () => {
      interface ProductSearchParams {
        category?: string
        minPrice?: number
        maxPrice?: number
        tags?: string[]
        inStockOnly?: boolean
      }

      const selectProductsWithParams = store.selectWith(
        [state => state.products.items],
        (params: ProductSearchParams) => products => {
          let filtered = products

          if (params.category) {
            filtered = filtered.filter(p => p.category === params.category)
          }

          if (params.minPrice !== undefined) {
            filtered = filtered.filter(p => p.price >= params.minPrice!)
          }

          if (params.maxPrice !== undefined) {
            filtered = filtered.filter(p => p.price <= params.maxPrice!)
          }

          if (params.tags?.length) {
            filtered = filtered.filter(p => params.tags!.some(tag => p.tags.includes(tag)))
          }

          if (params.inStockOnly) {
            filtered = filtered.filter(p => p.inStock)
          }

          return {
            products: filtered,
            count: filtered.length,
            totalValue: filtered.reduce((sum, p) => sum + p.price, 0),
          }
        }
      )

      const gamingProducts = selectProductsWithParams({
        tags: ['gaming'],
        inStockOnly: true,
      })()

      const affordableElectronics = selectProductsWithParams({
        category: 'electronics',
        maxPrice: 1500,
      })()

      expect(gamingProducts.count).toBe(2) // Gaming laptop and keyboard (both in stock)
      expect(affordableElectronics.count).toBe(1) // Only gaming laptop under $1500
    })

    it('should support nested parameterized selectors', () => {
      const selectUsersByPreference = store.selectWith(
        [state => state.users.byId],
        (preference: keyof UserProfile['preferences']) => users => {
          return Array.from(users.values()).reduce(
            (acc, user) => {
              const value = String(user.preferences[preference])
              if (!acc[value]) acc[value] = []
              acc[value].push(user)
              return acc
            },
            {} as Record<string, UserProfile[]>
          )
        }
      )

      const usersByTheme = selectUsersByPreference('theme')()
      const usersByLanguage = selectUsersByPreference('language')()

      expect(usersByTheme.dark).toHaveLength(1)
      expect(usersByTheme.light).toHaveLength(1)
      expect(usersByLanguage.en).toHaveLength(1)
      expect(usersByLanguage.es).toHaveLength(1)
    })
  })

  describe('Dependency Subscriptions', () => {
    it('should subscribe to specific selector changes', async () => {
      const listener = vi.fn()
      const baseSelectorSpy = vi.fn()
      const activeUserSelectorSpy = vi.fn()
      const selectUsers = select(state => {
        baseSelectorSpy()
        return state.users
      })
      const selectActiveUserId = select(selectUsers, users => {
        activeUserSelectorSpy()
        return users.activeUserId
      })

      const unsubscribe = subscribeTo(selectActiveUserId, listener)

      // Initial state, no call yet
      expect(listener).not.toHaveBeenCalled()
      expect(baseSelectorSpy).toHaveBeenCalledTimes(1)
      expect(activeUserSelectorSpy).toHaveBeenCalledTimes(1)

      // Change the active user
      updatePath(['users', 'activeUserId'], 2)

      expect(listener).toHaveBeenCalledWith(2, 1)
      expect(baseSelectorSpy).toHaveBeenCalledTimes(2)
      expect(activeUserSelectorSpy).toHaveBeenCalledTimes(2)

      // update unrelated state
      updatePath(['ui', 'loading'], true)

      expect(listener).toHaveBeenCalledTimes(1) // Should not trigger listener
      expect(baseSelectorSpy).toHaveBeenCalledTimes(3) // base selector should recompute
      expect(activeUserSelectorSpy).toHaveBeenCalledTimes(2) // Should not recompute derived selector

      // Change the active user again
      updatePath(['users', 'activeUserId'], 5000)

      expect(listener).toHaveBeenCalledWith(5000, 2)
      expect(baseSelectorSpy).toHaveBeenCalledTimes(4)
      expect(activeUserSelectorSpy).toHaveBeenCalledTimes(3)

      unsubscribe()
    })

    it('should support immediate subscription callbacks', () => {
      const listener = vi.fn()

      store.subscribeTo(state => state.users.activeUserId, listener, {
        immediate: true,
      })

      expect(listener).toHaveBeenCalledWith(1, 1)
    })

    it('should support custom equality functions', () => {
      const listener = vi.fn()

      // Custom equality that only cares about user count changes
      store.subscribeTo(state => state.users.byId, listener, {
        equalityFn: (a, b) =>
          (a as Map<number, UserProfile>).size === (b as Map<number, UserProfile>).size, // Only notify on size changes
      })

      // Update existing user (same size)
      const updatedUser = {
        ...initialState.users.byId.get(1)!,
        name: 'John Updated',
      }

      transaction(draft => {
        draft.users.byId.set(1, updatedUser)
      })

      expect(listener).not.toHaveBeenCalled()

      // Add new user (different size)
      const newUser: UserProfile = {
        id: 3,
        name: 'New User',
        email: 'new@example.com',
        preferences: {theme: 'light', notifications: true, language: 'en'},
        metadata: {
          lastLogin: Date.now(),
          createdAt: Date.now(),
          isVerified: false,
        },
      }

      transaction(draft => {
        draft.users.byId.set(3, newUser)
      })

      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('should support debounced subscriptions', async () => {
      vi.useFakeTimers()
      const listener = vi.fn()

      store.subscribeTo(state => state.products.filters.searchTerm, listener, {
        debounceMs: 100,
      })

      // Rapid changes

      transaction(draft => {
        draft.products.filters.searchTerm = 'g'
      })

      transaction(draft => {
        draft.products.filters.searchTerm = 'ga'
      })

      transaction(draft => {
        draft.products.filters.searchTerm = 'gam'
      })

      transaction(draft => {
        draft.products.filters.searchTerm = 'game'
      })

      // Should not have been called yet
      expect(listener).not.toHaveBeenCalled()

      // Fast forward time
      vi.advanceTimersByTime(150)

      // Should be called once with the final value
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith('game', '')

      vi.useRealTimers()
    })

    it('should handle multiple dependency subscriptions', () => {
      const userListener = vi.fn()
      const productListener = vi.fn()
      const uiListener = vi.fn()

      const unsubscribeUser = store.subscribeTo(state => state.users.activeUserId, userListener)

      const unsubscribeProduct = store.subscribeTo(
        state => state.products.filters.category,
        productListener
      )

      const unsubscribeUI = store.subscribeTo(state => state.ui.loading, uiListener)

      // Make changes to each
      transaction(draft => {
        draft.users.activeUserId = 2
        draft.products.filters.category = 'electronics'
        draft.ui.loading = true
      })
      expect(userListener).toHaveBeenCalledWith(2, 1)
      expect(productListener).toHaveBeenCalledWith('electronics', null)
      expect(uiListener).toHaveBeenCalledWith(true, false)

      // Cleanup
      unsubscribeUser()
      unsubscribeProduct()
      unsubscribeUI()
    })

    it('should handled debounced multiple dependency subscriptions correctly', () => {
      vi.useFakeTimers()
      const listener = vi.fn(([newValues, oldValues]) => {})

      // create multiple selector subscriptions
      const unsubscribe = subscribeToMultiple(
        [
          state => state.users.activeUserId,
          state => state.products.filters.category,
          state => state.ui.loading,
        ] as const,
        listener,
        {debounceMs: 100}
      )

      // Rapid changes
      for (let i = 0; i < 5; i++) {
        batch(() => {
          updatePath(['users', 'activeUserId'], i)
          updatePath(['products', 'filters', 'category'], `category-${i}`)
          updatePath(['ui', 'loading'], i % 2 === 0)
        })
      }

      expect(listener).not.toHaveBeenCalled()

      // Fast forward time
      vi.advanceTimersByTime(150)

      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith(
        [4, 'category-4', true], // new values
        [
          initialState.users.activeUserId,
          initialState.products.filters.category,
          initialState.ui.loading,
        ] // old values
      )
      unsubscribe()
      vi.useRealTimers()
    })
  })

  describe('Multiple Selector Subscriptions', () => {
    it('should subscribe to changes in multiple selectors simultaneously', () => {
      const listener = vi.fn()

      const unsubscribe = store.subscribeToMultiple(
        [
          state => state.users.activeUserId,
          state => state.products.filters.category,
          state => state.ui.loading,
        ] as const,
        listener
      )

      // Change one of the watched values

      transaction(draft => {
        draft.users.activeUserId = 2
      })

      expect(listener).toHaveBeenCalledWith(
        [2, null, false], // new values
        [1, null, false] // old values
      )

      // Change multiple values at once

      transaction(draft => {
        draft.users.activeUserId = 1
        draft.ui.loading = true
      })

      expect(listener).toHaveBeenCalledWith(
        [1, null, true], // new values
        [2, null, false] // old values
      )

      unsubscribe()
    })

    it('should work with complex selector combinations', () => {
      const listener = vi.fn()

      const unsubscribe = subscribeToMultiple(
        [
          state => state.users.byId.size,
          state => state.products.items.length,
          state => state.products.items.filter(p => p.inStock).length,
        ] as const,
        listener
      )

      // Add a new product
      updatePath(['products', 'items'], items => [
        ...items,
        {
          id: 4,
          name: 'USB Mouse',
          price: 29.99,
          category: 'accessories',
          inStock: true,
          tags: ['mouse', 'usb'],
          ratings: {average: 4.0, count: 15, reviews: []},
        },
      ])

      expect(listener).toHaveBeenCalledWith(
        [2, 4, 3], // 2 users, 4 products, 3 in stock
        [2, 3, 2] // 2 users, 3 products, 2 in stock
      )
      unsubscribe()
    })
  })

  describe('Path-based Subscriptions', () => {
    it('should subscribe to changes in nested paths', () => {
      const listener = vi.fn()

      const unsubscribe = subscribeToPath('users.activeUserId', listener)

      updatePath(['users', 'activeUserId'], 2)

      expect(listener).toHaveBeenCalledWith(2, 1)
      unsubscribe()
    })

    it('should handle deep nested paths', () => {
      const themeListener = vi.fn()
      const notificationListener = vi.fn()

      store.subscribeToPath('users.byId.1.preferences.theme', themeListener)
      store.subscribeToPath('users.byId.1.preferences.notifications', notificationListener)

      // Update user preferences
      const updatedUser = {
        ...initialState.users.byId.get(1)!,
        preferences: {
          ...initialState.users.byId.get(1)!.preferences,
          theme: 'light' as const,
        },
      }

      store.dispatch({
        users: {
          ...store.getState().users,
          byId: new Map(store.getState().users.byId).set(1, updatedUser),
        },
      })
      expect(themeListener).toHaveBeenCalledWith('light', 'dark')
      expect(notificationListener).not.toHaveBeenCalled() // Notifications didn't change
    })

    it('should handle array indices in paths', () => {
      const listener = vi.fn()

      store.subscribeToPath('products.items.0.price', listener)

      // Update first product price
      const updatedProducts = [...store.getState().products.items]
      updatedProducts[0] = {...updatedProducts[0], price: 1199.99}

      store.dispatch({
        products: {
          ...store.getState().products,
          items: updatedProducts,
        },
      })

      expect(listener).toHaveBeenCalledWith(1199.99, 1299.99)
    })
  })

  describe('Selector Performance and Optimization', () => {
    it('should handle frequent state updates efficiently', () => {
      const computationSpy = vi.fn()
      const productSelectorSpy = vi.fn()
      const itemsSelectorSpy = vi.fn()
      const selectProducts = select(state => {
        productSelectorSpy()
        return state.products
      })
      const selectItems = select(selectProducts, products => {
        itemsSelectorSpy()
        return products.items
      })

      const selectExpensiveComputation = select(selectItems, items => {
        computationSpy()
        return items
          .filter(p => p.inStock)
          .sort((a, b) => b.ratings.average - a.ratings.average)
          .map(p => ({
            ...p,
            score: p.ratings.average * p.ratings.count * (p.inStock ? 1.2 : 0.8),
          }))
      })

      // First computation
      const firstResult = selectExpensiveComputation()
      expect(computationSpy).toHaveBeenCalledTimes(1)
      expect(productSelectorSpy).toHaveBeenCalledTimes(1)
      expect(itemsSelectorSpy).toHaveBeenCalledTimes(1)

      let lastResult: ReturnType<typeof selectExpensiveComputation>

      // Multiple calls without state change
      for (let i = 0; i < 10; i++) {
        lastResult = selectExpensiveComputation()
        expect(lastResult).toEqual(firstResult) // Should return same result
      }
      expect(computationSpy).toHaveBeenCalledTimes(1)
      expect(productSelectorSpy).toHaveBeenCalledTimes(1)
      expect(itemsSelectorSpy).toHaveBeenCalledTimes(1)

      // Change unrelated state
      store.dispatch({ui: {...store.getState().ui, loading: true}})
      lastResult = selectExpensiveComputation()
      expect(lastResult).toEqual(firstResult) // Should still return same result
      expect(computationSpy).toHaveBeenCalledTimes(1)
      expect(productSelectorSpy).toHaveBeenCalledTimes(2) // global state change will trigger base selector
      expect(itemsSelectorSpy).toHaveBeenCalledTimes(1) // Should not recompute derived selector

      // Change related state
      updatePath(['products', 'items', 0, 'inStock'], false)
      lastResult = selectExpensiveComputation()
      expect(lastResult).not.toEqual(firstResult) // Should recompute due to inStock change
      expect(computationSpy).toHaveBeenCalledTimes(2)
    })

    it('should handle large datasets efficiently', () => {
      // Create a large dataset
      const largeUserSet = new Map<number, UserProfile>()
      for (let i = 1; i <= 1000; i++) {
        largeUserSet.set(i, {
          id: i,
          name: `User ${i}`,
          email: `user${i}@example.com`,
          preferences: {
            theme: i % 2 === 0 ? 'dark' : 'light',
            notifications: i % 3 === 0,
            language: ['en', 'es', 'fr'][i % 3],
          },
          metadata: {
            lastLogin: Date.now() - i * 1000,
            createdAt: Date.now() - i * 86400000,
            isVerified: i % 5 === 0,
          },
        })
      }

      updatePath(['users', 'byId'], largeUserSet)

      const selectActiveUsers = select(state =>
        Array.from(state.users.byId.values())
          .filter(user => Date.now() - user.metadata.lastLogin < 3600000) // Active in last hour
          .sort((a, b) => b.metadata.lastLogin - a.metadata.lastLogin)
      )

      const startTime = performance.now()
      const activeUsers = selectActiveUsers()
      const endTime = performance.now()

      expect(activeUsers.length).toBeGreaterThan(0)
      expect(endTime - startTime).toBeLessThan(50) // Should be fast

      // Second call should be even faster (cached)
      const startTime2 = performance.now()
      selectActiveUsers()
      const endTime2 = performance.now()

      expect(endTime2 - startTime2).toBeLessThan(5) // Should be very fast
    })

    it('should handle complex selector compositions', () => {
      const selectUsers = select(state => state.users.byId)
      const selectProducts = select(state => state.products.items)
      const selectActiveUserId = select(state => state.users.activeUserId)

      const selectUserProductRecommendations = select(
        selectUsers,
        selectProducts,
        selectActiveUserId,
        (users, products, activeUserId) => {
          const activeUser = activeUserId ? users.get(activeUserId) : null
          if (!activeUser) return []

          // Simple recommendation algorithm based on user preferences
          return products
            .filter(p => p.inStock)
            .map(p => ({
              product: p,
              // Prefer cheaper items
              score:
                (activeUser.preferences.theme === 'dark' && p.tags.includes('gaming') ? 20 : 0) +
                p.ratings.average * 10 +
                (p.ratings.count > 50 ? 10 : 0) +
                (2000 - p.price) / 100,
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(item => item.product)
        }
      )

      const recommendations = selectUserProductRecommendations()
      expect(recommendations).toHaveLength(2) // Only in-stock items
      expect(recommendations[0].inStock).toBe(true)
    })
  })

  describe('Selector Error Handling', () => {
    it('should handle selector errors gracefully', () => {
      const errorSelector = select(state => {
        if (!state.users.byId) {
          throw new Error('Users not available')
        }
        return state.users.byId.size
      })

      // Should work normally
      expect(errorSelector()).toBe(2)

      // Break the state structure
      dispatch({
        users: {...getState().users, byId: null as any},
      })

      // Should throw when selector encounters error
      expect(() => errorSelector()).toThrow('Users not available')
    })

    it('should handle parameterized selector errors', () => {
      const selectUserWithValidation = selectWith(
        [state => state.users.byId],
        (userId: number) => users => {
          if (userId <= 0) {
            throw new Error('Invalid user ID')
          }
          return users.get(userId) || null
        }
      )

      const getValidUser = selectUserWithValidation(1)
      const getInvalidUser = selectUserWithValidation(-1)

      expect(getValidUser()).toBeTruthy()
      expect(() => getInvalidUser()).toThrow('Invalid user ID')
    })
  })

  describe('Selector Cleanup and Memory Management', () => {
    it('should support manual selector cleanup', () => {
      // Create many selectors
      const selectors: Array<() => number> = []
      for (let i = 0; i < 100; i++) {
        selectors.push(select(state => state.users.byId.size + i))
      }

      // Call all selectors to initialize them
      selectors.forEach(s => s())

      // Cleanup should work without errors
      const cleanedCount = (store as any).cleanupSelectors()
      expect(cleanedCount).toBeGreaterThanOrEqual(0)
    })

    it('should handle subscription cleanup', () => {
      const subscriptions: Array<() => void> = []

      // Create many subscriptions
      for (let i = 0; i < 50; i++) {
        subscriptions.push(
          store.subscribeTo(
            state => state.ui.loading,
            () => {}
          )
        )
      }

      // Cleanup all subscriptions
      subscriptions.forEach(unsub => unsub())

      // Should not leak memory or cause errors
      expect(() => {
        store.dispatch({ui: {...store.getState().ui, loading: true}})
      }).not.toThrow()
    })
  })

  describe('Advanced Selector Integration Scenarios', () => {
    it('should handle real-world e-commerce filtering scenario', () => {
      const selectProducts = select(state => state.products)
      const selectItems = select(selectProducts, products => products.items)
      const selectFilters = select(selectProducts, products => products.filters)
      const selectPagination = select(selectProducts, products => products.pagination)
      const selectFilteredProductsWithPagination = select(
        selectItems,
        selectFilters,
        selectPagination,
        (products, filters, pagination) => {
          // Apply filters
          let filtered = products

          if (filters.category) {
            filtered = filtered.filter(p => p.category === filters.category)
          }

          if (filters.inStockOnly) {
            filtered = filtered.filter(p => p.inStock)
          }

          if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase()
            filtered = filtered.filter(
              p =>
                p.name.toLowerCase().includes(term) ||
                p.tags.some(tag => tag.toLowerCase().includes(term))
            )
          }

          // Apply price range
          filtered = filtered.filter(
            p => p.price >= filters.priceRange[0] && p.price <= filters.priceRange[1]
          )

          // Sort by rating
          filtered = filtered.sort((a, b) => b.ratings.average - a.ratings.average)

          // Apply pagination
          const startIndex = (pagination.page - 1) * pagination.limit
          const endIndex = startIndex + pagination.limit
          const paginatedProducts = filtered.slice(startIndex, endIndex)

          return {
            products: paginatedProducts,
            total: filtered.length,
            hasMore: endIndex < filtered.length,
            page: pagination.page,
            totalPages: Math.ceil(filtered.length / pagination.limit),
          }
        }
      )

      const categoryPath = ['products', 'filters', 'category']
      const inStockPath = ['products', 'filters', 'inStockOnly']
      // Test initial state
      const result1 = selectFilteredProductsWithPagination()
      expect(result1.products).toHaveLength(3)
      expect(result1.total).toBe(3)

      // Apply filters
      updatePath(categoryPath, 'electronics')
      updatePath(inStockPath, true)

      const result2 = selectFilteredProductsWithPagination()
      expect(result2.products).toHaveLength(1) // Only gaming laptop
      expect(result2.total).toBe(1)
    })

    it('should handle dynamic dashboard data aggregation', () => {
      const selectDashboardData = store.select(
        state => state.users.byId,
        state => state.products.items,
        state => state.ui.notifications,
        (users, products, notifications) => {
          const userArray = Array.from(users.values()) as UserProfile[]
          const userStats = {
            total: users.size,
            verified: userArray.filter(u => u.metadata.isVerified).length,
            recent: userArray.filter(
              u => Date.now() - u.metadata.lastLogin < 86400000 // Last 24 hours
            ).length,
            byTheme: userArray.reduce(
              (acc: Record<string, number>, user: UserProfile) => {
                acc[user.preferences.theme] = (acc[user.preferences.theme] || 0) + 1
                return acc
              },
              {} as Record<string, number>
            ),
          }

          const productStats = {
            total: products.length,
            inStock: products.filter(p => p.inStock).length,
            averagePrice: products.reduce((sum, p) => sum + p.price, 0) / products.length,
            byCategory: products.reduce(
              (acc, product) => {
                acc[product.category] = (acc[product.category] || 0) + 1
                return acc
              },
              {} as Record<string, number>
            ),
            topRated: products
              .filter(p => p.ratings.count > 0)
              .sort((a, b) => b.ratings.average - a.ratings.average)
              .slice(0, 3)
              .map(p => ({name: p.name, rating: p.ratings.average})),
          }

          const systemStats = {
            notifications: {
              total: notifications.length,
              byType: notifications.reduce(
                (acc, notif) => {
                  acc[notif.type] = (acc[notif.type] || 0) + 1
                  return acc
                },
                {} as Record<string, number>
              ),
            },
          }

          return {userStats, productStats, systemStats}
        }
      )

      const dashboard = selectDashboardData()

      expect(dashboard.userStats.total).toBe(2)
      expect(dashboard.userStats.verified).toBe(1)
      expect(dashboard.productStats.total).toBe(3)
      expect(dashboard.productStats.inStock).toBe(2)
      expect(dashboard.productStats.topRated).toHaveLength(3)
    })
  })
})
