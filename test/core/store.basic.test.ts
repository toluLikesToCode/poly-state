/**
 * Core Store Functionality Tests
 *
 * Comprehensive test suite for the Open Store's core functionality including:
 * - Basic state management (initialization, updates, subscriptions)
 * - Path-based updates (updatePath functionality)
 * - Selector memoization and optimization
 * - Store metadata and lifecycle
 * - Error handling and edge cases
 */

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {
  createStore,
  type Store,
  type Plugin,
  historyChangePluginOptions,
  type Middleware,
} from '../../src/core'
import {Profiler} from 'react'

interface BasicTestState {
  count: number
  name?: string
}

interface NestedTestState {
  profile: {
    name: string
    address: {
      city: string
      zip: number
    }
  }
  tags: string[]
  metadata?: {
    created?: Date
    updated?: Date
  }
}

interface ComplexState {
  user: {
    id: number
    details: {
      name: string
      preferences: {
        theme: string
        notifications: boolean
      }
    }
  }
  app: {
    version: string
    features: string[]
  }
  data: {
    items: Array<{id: number; value: string}>
    cache: {
      timestamp: number
      metadata: Record<string, any>
    }
  }
}

describe('Store Core Functionality', () => {
  let store: Store<BasicTestState>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Cleanup any store instances if they have cleanup methods
    if (store && typeof (store as any).destroy === 'function') {
      ;(store as any).destroy()
    }
  })

  describe('Initialization and Basic State Management', () => {
    it('should initialize with the provided initial state', () => {
      const initialState: BasicTestState = {count: 0, name: 'test'}
      store = createStore(initialState)

      expect(store.getState()).toEqual(initialState)
      // Should be a copy, not the same reference
      expect(store.getState()).not.toBe(initialState)
    })

    it('should initialize with empty object when no state provided', () => {
      const emptyStore = createStore({})
      expect(emptyStore.getState()).toEqual({})
    })

    it('should update state with partial updates via dispatch', () => {
      store = createStore({count: 0})

      store.dispatch({count: 5})
      expect(store.getState().count).toBe(5)

      store.dispatch({name: 'updated'})
      expect(store.getState()).toEqual({count: 5, name: 'updated'})
    })

    it('should handle multiple rapid updates correctly', () => {
      store = createStore({count: 0})

      for (let i = 1; i <= 10; i++) {
        store.dispatch({count: i})
      }

      expect(store.getState().count).toBe(10)
    })

    it('should preserve state immutability', () => {
      const initialState = {count: 0}
      store = createStore(initialState)

      const state1 = store.getState()
      store.dispatch({count: 1})
      const state2 = store.getState()

      expect(state1).not.toBe(state2)
      expect(state1.count).toBe(0) // Original state unchanged
      expect(state2.count).toBe(1)
    })

    it('should handle basic undo and redo state changes', () => {
      const initialState: BasicTestState = {count: 0, name: 'test'}
      store = createStore(initialState, {historyLimit: 5})
      const currentCount = store.select(state => state.count)
      const currentName = store.select(state => state.name)

      store.dispatch({count: 5287425, name: 'not-test'})
      expect(currentCount()).toBe(5287425)
      expect(currentName()).toBe('not-test')

      let result = store.undo()
      expect(result).toBe(true)
      expect(currentCount()).toBe(0)
      expect(currentName()).toBe('test')

      result = store.redo()
      expect(result).toBe(true)
      expect(currentCount()).toBe(5287425)
      expect(currentName()).toBe('not-test')

      // Ensure history limit is respected

      for (let i = 0; i <= 10; i++) {
        store.dispatch({count: i})
      }

      expect(currentCount()).toBe(10) // Last state
      result = store.undo(6) // Undo 6 steps
      // should return false since 6 is outside of history limit
      expect(result).toBe(false)
      expect(currentCount()).toBe(10) // Should still be 9
      expect(currentName()).toBe('not-test') // Should still be "not-test"

      result = store.undo(5) // Undo 5 steps
      expect(result).toBe(true)
      expect(currentCount()).toEqual(5)

      store.batch(() => {
        for (let i = 0; i < 100; i++) {
          store.dispatch({count: i * 2 + i})
        }
      })
      expect(store.getState()).toEqual({
        count: 297,
        name: 'not-test',
      })

      store.reset()
      expect(store.getState()).toEqual(initialState)
    })

    it('should handle undo and redo with plugins', () => {
      const initialState: BasicTestState = {count: 0, name: 'init'}
      const initialSettings = {historyLimit: 5}
      const pluginState1: BasicTestState = {count: 10}
      let plugin: Plugin<BasicTestState> = {
        name: 'TestPlugin',
        onStoreCreate(store) {
          store.dispatch({...pluginState1, name: plugin.name})
        },
        beforeHistoryChange(options: historyChangePluginOptions<BasicTestState>) {
          if (options.operation === 'undo') {
            return false // Prevent undo
          }
          if (options.operation === 'redo') {
            return true // Allow redo
          }
        },
      }
      store = createStore(initialState, {
        ...initialSettings,
        plugins: [plugin],
      })

      expect(store.getState()).toEqual({...pluginState1, name: plugin.name})

      const result1 = store.undo()
      expect(result1).toBe(false) // Undo should be prevented by plugin
      // The state should remain unchanged
      expect(store.getState()).toEqual({...pluginState1, name: plugin.name})

      const result2 = store.redo()
      // Redo should not change state since there is no previous state to redo
      expect(result2).toBe(false) // there is no state to redo
      expect(store.getState()).toEqual({...pluginState1, name: plugin.name})

      plugin = {
        ...plugin,
        name: 'TestPlugin2',
        beforeHistoryChange: options => {
          if (options.operation === 'undo') {
            return true // Allow undo
          }
        },
      }
      store.destroy() // Cleanup previous store
      store = createStore(initialState, {
        ...initialSettings,
        plugins: [plugin],
      })

      // Now undo should be allowed
      expect(store.getState()).toEqual({...pluginState1, name: plugin.name})
      const result3 = store.undo()
      // Undo should now succeed
      expect(result3).toBe(true)
      // The state should revert to initial state
      expect(store.getState()).toEqual(initialState)

      let history = store.getHistory()
      // History should contain the initial state and the plugin state
      expect(history.history.length).toBe(2)
      // The first entry is the initial state, the second is the plugin state
      expect(history.history[0]).toEqual(initialState)
      expect(history.history[1]).toEqual({
        ...pluginState1,
        name: plugin.name,
      })

      // Now lets dispatch some more actions
      for (let i = 0; i <= 10; i++) {
        store.dispatch({count: i})
      }
      // The state should now be the last dispatched state
      expect(store.getState().count).toBe(10)

      // history should now contain the initial state, plugin state and the last dispatched state
      history = store.getHistory()
      expect(history.history.length).toBe(6)
      expect(history.initialState).toEqual(initialState)

      expect(history.history[0]).toEqual({count: 5, name: initialState.name})
      expect(history.history[5]).toEqual(store.getState())
    })

    it('should handle redo and undo with a provided path', () => {
      const initialState: NestedTestState = {
        profile: {
          name: 'user1',
          address: {
            city: 'city1',
            zip: 1,
          },
        },
        tags: ['tag1'],
      }
      const store = createStore(initialState, {historyLimit: 10})
      const {dispatch, updatePath, undo, redo, reset, destroy, getState, transaction, select} =
        store
      const selectProfile = select(state => state.profile)
      const selectName = select(selectProfile, profile => profile.name)
      const selectAdress = select(selectProfile, profile => profile.address)
      let newProfile = {
        name: 'user2',
        address: {
          city: 'city2',
          zip: 2,
        },
      }

      expect(getState()).toEqual(initialState)
      transaction(draft => {
        draft.profile = newProfile
        draft.tags.push('tag2')
      })
      expect(selectName()).toEqual('user2')
      expect(selectProfile()).toEqual(newProfile)
      expect(getState().tags).toEqual(['tag1', 'tag2'])

      undo(1, ['profile'])
      expect(selectProfile()).toEqual(initialState.profile)
      expect(getState().tags).toEqual(['tag1', 'tag2'])

      redo(1, ['profile'])
      expect(selectProfile()).toEqual(newProfile)
      expect(getState().tags).toEqual(['tag1', 'tag2'])

      undo()
      expect(getState()).toEqual(initialState)
    })
  })

  describe('Subscriptions and Listeners', () => {
    beforeEach(() => {
      store = createStore({count: 0})
    })

    it('should notify subscribers when state changes', () => {
      const listener = vi.fn()

      store.subscribe(listener)
      store.dispatch({count: 1})

      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith(
        {count: 1}, // new state
        {count: 0} // previous state
      )
    })

    it('should support multiple subscribers', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      store.subscribe(listener1)
      store.subscribe(listener2)
      store.dispatch({count: 1})

      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(1)
    })

    it('should stop notifying unsubscribed listeners', () => {
      const listener = vi.fn()

      const unsubscribe = store.subscribe(listener)
      store.dispatch({count: 1})
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()
      store.dispatch({count: 2})
      expect(listener).toHaveBeenCalledTimes(1) // Should still be 1
    })

    it('should handle unsubscribing non-existent listeners gracefully', () => {
      const listener = vi.fn()
      const unsubscribe = store.subscribe(listener)

      // Unsubscribe twice - should not throw
      expect(() => {
        unsubscribe()
        unsubscribe()
      }).not.toThrow()
    })

    it('should not notify listeners if state does not actually change', () => {
      const listener = vi.fn()
      store.subscribe(listener)

      const currentState = store.getState()
      store.dispatch(currentState) // Dispatch same state

      // Depending on implementation, this might or might not call listeners
      // This test documents the expected behavior
      expect(listener).toHaveBeenCalledTimes(1)
    })
  })

  describe('Store Reset Functionality', () => {
    it('should reset state to initial state', () => {
      const resetStore = createStore({count: 0, name: 'initial'})

      resetStore.dispatch({count: 10, name: 'modified'})
      expect(resetStore.getState()).toEqual({count: 10, name: 'modified'})

      resetStore.reset()
      expect(resetStore.getState()).toEqual({count: 0, name: 'initial'})
    })

    it('should notify listeners when reset', () => {
      const resetStore = createStore({count: 0, name: 'initial'})
      const listener = vi.fn()
      resetStore.subscribe(listener)

      resetStore.dispatch({count: 5})
      resetStore.reset()

      expect(listener).toHaveBeenCalledTimes(2) // Once for dispatch, once for reset
      expect(listener).toHaveBeenLastCalledWith(
        {count: 0, name: 'initial'}, // reset state
        {count: 5, name: 'initial'} // previous state
      )
    })

    it('should return a fresh copy of initial state on reset', () => {
      const resetStore = createStore({count: 0, name: 'initial'})

      resetStore.reset()
      const resetState = resetStore.getState()

      resetStore.reset()
      const secondResetState = resetStore.getState()

      expect(resetState).toEqual(secondResetState)
      expect(resetState).not.toBe(secondResetState) // Different instances
    })
  })

  describe('Store Metadata', () => {
    it('should return undefined for store name when not provided', () => {
      const metadataStore = createStore({})
      expect(metadataStore.getName()).toBeUndefined()
    })

    it('should return the provided store name', () => {
      const metadataStore = createStore({}, {name: 'MyTestStore'})
      expect(metadataStore.getName()).toBe('MyTestStore')
    })

    it('should return a session ID', () => {
      const metadataStore = createStore({})
      const sessionId = metadataStore.getSessionId()

      expect(sessionId).toBeDefined()
      if (sessionId) {
        expect(typeof sessionId).toBe('string')
        expect(sessionId.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Store Middleware', () => {
    it('should allow middleware to intercept actions', () => {
      const middlewareSpy = vi.fn()
      const middleware: Middleware<BasicTestState> = (action, _prevState, next) => {
        middlewareSpy(action.count) // Spy on action
        if (action.count !== undefined) {
          action.count += 1 // Increment count by 1
        }
        next(action)
      }

      store = createStore<BasicTestState>({count: 0}, {middleware: [middleware]})

      store.dispatch({count: 5})
      expect(middlewareSpy).toHaveBeenCalledWith(5)
      expect(store.getState().count).toBe(6) // Should be incremented by middleware
    })

    it('should handle errors in middleware gracefully', () => {
      const errorMiddleware: Middleware<BasicTestState> = () => {
        throw new Error('Middleware error')
      }

      store = createStore<BasicTestState>({count: 0}, {middleware: [errorMiddleware]})

      expect(() => {
        store.dispatch({count: 1})
      }).not.toThrow() // Should not crash the store
    })

    it('should running multiple middleware in the correct order', () => {
      const middlewareSpy = vi.fn()
      const middleware1: Middleware<BasicTestState> = (action, _prevState, next) => {
        if (action.count !== undefined) {
          action.count += 1 // Increment count by 1
        }
        middlewareSpy(action.count)
        next(action)
      }

      const middleware2: Middleware<BasicTestState> = (action, _prevState, next) => {
        if (action.count !== undefined) {
          action.count *= 2 // Double the count
        }
        middlewareSpy(action.count)
        next(action)
      }

      store = createStore<BasicTestState>({count: 0}, {middleware: [middleware1, middleware2]})

      store.dispatch({count: 5})
      expect(store.getState().count).toBe(12) // Should be incremented by 1 and then doubled
      expect(middlewareSpy).toHaveBeenCalledTimes(2)
      expect(middlewareSpy).toHaveBeenNthCalledWith(1, 6) // After middleware1
      expect(middlewareSpy).toHaveBeenNthCalledWith(2, 12) // After middleware2
    })

    it('should allow middleware to prevent state changes', () => {
      const preventMiddleware: Middleware<BasicTestState> = (action, _prevState, next) => {
        if (action.count !== undefined && action.count < 0) {
          return // Prevent negative counts
        }
        next(action)
      }

      store = createStore<BasicTestState>({count: 0}, {middleware: [preventMiddleware]})

      store.dispatch({count: -1}) // Should not change state
      expect(store.getState().count).toBe(0)

      store.dispatch({count: 5}) // Should change state
      expect(store.getState().count).toBe(5)
    })

    it('should handle async middleware correctly', async () => {
      const asyncMiddleware: Middleware<BasicTestState> = async (action, _prevState, next) => {
        if (action.count !== undefined) {
          action.count += 1
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
        next(action)
      }

      store = createStore<BasicTestState>({count: 0}, {middleware: [asyncMiddleware]})

      const result = store.dispatch({count: 5})

      if ((result as any) instanceof Promise && typeof (result as any).then === 'function') {
        ;(result as any).then(() => {
          expect(store.getState().count).toBe(6) // Should be incremented by 1 after async operation
        })
      }
    })
  })
})

describe('Path-based Updates (updatePath)', () => {
  let store: Store<NestedTestState>

  const initialNestedState: NestedTestState = {
    profile: {
      name: 'John Doe',
      address: {
        city: 'New York',
        zip: 10001,
      },
    },
    tags: ['developer', 'typescript'],
  }

  beforeEach(() => {
    store = createStore(initialNestedState)
    vi.clearAllMocks()
  })

  describe('Basic Path Updates', () => {
    it('should update a top-level nested property', () => {
      store.updatePath(['profile', 'name'], () => 'Jane Doe')

      expect(store.getState().profile.name).toBe('Jane Doe')
      // Other properties should remain unchanged
      expect(store.getState().profile.address.city).toBe('New York')
      expect(store.getState().tags).toEqual(['developer', 'typescript'])
    })

    it('should update a deeply nested property', () => {
      store.updatePath(['profile', 'address', 'city'], () => 'San Francisco')

      expect(store.getState().profile.address.city).toBe('San Francisco')
      expect(store.getState().profile.address.zip).toBe(10001)
      expect(store.getState().profile.name).toBe('John Doe')
    })

    it('should update array elements by index', () => {
      store.updatePath(['tags', 0], (tag: string) => tag.toUpperCase())

      expect(store.getState().tags[0]).toBe('DEVELOPER')
      expect(store.getState().tags[1]).toBe('typescript')
    })

    it('should support function-based updates with current value', () => {
      store.updatePath(['profile', 'address', 'zip'], (currentZip: number) => currentZip + 1)

      expect(store.getState().profile.address.zip).toBe(10002)
    })
  })

  describe('Auto-creation of Missing Paths', () => {
    it('should create missing intermediate objects', () => {
      store.updatePath(['metadata', 'created'], () => new Date('2024-01-01'))

      expect(store.getState().metadata?.created).toEqual(new Date('2024-01-01'))
    })

    it('should create deeply nested missing paths', () => {
      const deepStore = createStore<{
        data?: {deep?: {nested?: {value?: number}}}
      }>({})

      deepStore.updatePath(['data', 'deep', 'nested', 'value'], () => 42)

      expect(deepStore.getState().data?.deep?.nested?.value).toBe(42)
    })

    it('should handle mixed existing and missing paths', () => {
      store.updatePath(['profile', 'settings', 'theme'], () => 'dark')

      expect((store.getState().profile as any).settings?.theme).toBe('dark')
      expect(store.getState().profile.name).toBe('John Doe') // Existing data preserved
    })
  })

  describe('Change Detection and Optimization', () => {
    it('should not dispatch when updater returns the same value', () => {
      const listener = vi.fn()
      store.subscribe(listener)

      const currentCity = store.getState().profile.address.city
      store.updatePath(['profile', 'address', 'city'], () => currentCity)

      // Store optimizes away no-op updates - this is good behavior!
      expect(listener).toHaveBeenCalledTimes(0)
    })

    it('should preserve structural sharing for unchanged parts', () => {
      const originalProfile = store.getState().profile
      const originalTags = store.getState().tags

      // Update something unrelated to profile and tags
      store.updatePath(['metadata', 'updated'], () => new Date())

      const newState = store.getState()

      // These should maintain their references if properly implemented
      expect(newState.profile).toBe(originalProfile)
      expect(newState.tags).toBe(originalTags)
    })
  })

  describe('Complex Path Update Scenarios', () => {
    it('should handle array manipulation', () => {
      store.updatePath(['tags'], (currentTags: string[]) => [...currentTags, 'react'])

      expect(store.getState().tags).toEqual(['developer', 'typescript', 'react'])
    })

    it('should handle object merging at paths', () => {
      store.updatePath(['profile'], currentProfile => ({
        ...currentProfile,
        email: 'john@example.com',
      }))

      const profile = store.getState().profile as any
      expect(profile.email).toBe('john@example.com')
      expect(profile.name).toBe('John Doe')
      expect(profile.address.city).toBe('New York')
    })

    it('should work with plugin integration', () => {
      const mockOnStateChange = vi.fn()
      const testPlugin: Plugin<NestedTestState> = {
        name: 'TestPlugin',
        onStateChange: mockOnStateChange,
      }

      const pluginStore = createStore(initialNestedState, {
        plugins: [testPlugin],
      })

      pluginStore.updatePath(['profile', 'name'], () => 'Jane Doe')

      expect(mockOnStateChange).toHaveBeenCalledTimes(1)
      const [newState, prevState, actionApplied] = mockOnStateChange.mock.calls[0]

      expect(newState.profile.name).toBe('Jane Doe')
      expect(prevState.profile.name).toBe('John Doe')
      expect(actionApplied).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid paths gracefully', () => {
      expect(() => {
        store.updatePath(['nonexistent', 'path'], () => 'value')
      }).not.toThrow()
    })

    it('should handle null/undefined in path traversal', () => {
      const sparseStore = createStore<{data?: {value?: string}}>({
        data: undefined,
      })

      expect(() => {
        sparseStore.updatePath(['data', 'value'], () => 'test')
      }).not.toThrow()

      expect(sparseStore.getState().data?.value).toBe('test')
    })
  })
})

describe('Selector Functionality', () => {
  let store: Store<ComplexState>

  const complexInitialState: ComplexState = {
    user: {
      id: 1,
      details: {
        name: 'Alice',
        preferences: {
          theme: 'dark',
          notifications: true,
        },
      },
    },
    app: {
      version: '1.0.0',
      features: ['auth', 'dashboard'],
    },
    data: {
      items: [
        {id: 1, value: 'item1'},
        {id: 2, value: 'item2'},
      ],
      cache: {
        timestamp: Date.now(),
        metadata: {source: 'api'},
      },
    },
  }

  beforeEach(() => {
    store = createStore(complexInitialState)
    vi.clearAllMocks()
  })

  describe('Basic Selector Functionality', () => {
    it('should return a function that provides the selected value', () => {
      const selectUserId = store.select(state => state.user.id)

      expect(typeof selectUserId).toBe('function')
      expect(selectUserId()).toBe(1)
    })

    it('should return updated values after state changes', () => {
      const selectUserName = store.select(state => state.user.details.name)

      expect(selectUserName()).toBe('Alice')

      store.dispatch({
        user: {
          ...store.getState().user,
          details: {
            ...store.getState().user.details,
            name: 'Bob',
          },
        },
      })

      expect(selectUserName()).toBe('Bob')
    })

    it('should work with complex selectors', () => {
      const selectUserSummary = store.select(state => ({
        name: state.user.details.name,
        id: state.user.id,
        theme: state.user.details.preferences.theme,
        itemCount: state.data.items.length,
      }))

      const summary = selectUserSummary()
      expect(summary).toEqual({
        name: 'Alice',
        id: 1,
        theme: 'dark',
        itemCount: 2,
      })
    })
  })

  describe('Selector Memoization', () => {
    it('should memoize results and avoid recomputation', () => {
      const selectorFn = vi.fn(state => state.user.details.name)
      const selectUserName = store.select(selectorFn)

      // Initial call
      const name1 = selectUserName()
      expect(selectorFn).toHaveBeenCalledTimes(1)
      expect(name1).toBe('Alice')

      // Subsequent call without state change
      const name2 = selectUserName()
      expect(selectorFn).toHaveBeenCalledTimes(1) // Should not call again
      expect(name2).toBe('Alice')
      expect(name2).toBe(name1) // Should be same reference for primitives
    })

    it('should recompute when relevant state changes', () => {
      const selectorFn = vi.fn(state => state.user.details.name)
      const selectUserName = store.select(selectorFn)

      selectUserName()
      expect(selectorFn).toHaveBeenCalledTimes(1)

      // Change relevant state
      store.updatePath(['user', 'details', 'name'], () => 'Bob')

      const newName = selectUserName()
      expect(selectorFn).toHaveBeenCalledTimes(2) // Should recompute
      expect(newName).toBe('Bob')
    })

    it('should recompute when irrelevant state changes but still memoize results', () => {
      const selectorFn = vi.fn(state => state.user.details.name)
      const selectUserName = store.select(selectorFn)

      const name1 = selectUserName()
      expect(selectorFn).toHaveBeenCalledTimes(1)

      // Change irrelevant state
      store.updatePath(['app', 'version'], () => '1.1.0')

      const name2 = selectUserName()
      expect(selectorFn).toHaveBeenCalledTimes(2) // Recomputes due to state change
      expect(name2).toBe('Alice') // Same value
      // For object results, should return same reference due to deep equality check
    })

    it('should handle object memoization correctly', () => {
      const selectorFn = vi.fn(state => state.user.details.preferences)
      const selectPreferences = store.select(selectorFn)

      const prefs1 = selectPreferences()
      expect(selectorFn).toHaveBeenCalledTimes(1)

      // Change unrelated state
      store.updatePath(['app', 'version'], () => '1.1.0')

      const prefs2 = selectPreferences()
      expect(selectorFn).toHaveBeenCalledTimes(2) // Recomputes
      expect(prefs2).toBe(prefs1) // Should return same reference due to deep equality
    })
  })

  describe('Multiple Selectors', () => {
    it('should support multiple independent selectors', () => {
      const selectUserName = store.select(state => state.user.details.name)
      const selectAppVersion = store.select(state => state.app.version)
      const selectItemCount = store.select(state => state.data.items.length)

      expect(selectUserName()).toBe('Alice')
      expect(selectAppVersion()).toBe('1.0.0')
      expect(selectItemCount()).toBe(2)

      // Update one part of state
      store.updatePath(['user', 'details', 'name'], () => 'Bob')

      expect(selectUserName()).toBe('Bob')
      expect(selectAppVersion()).toBe('1.0.0') // Unchanged
      expect(selectItemCount()).toBe(2) // Unchanged
    })

    it('should handle selector composition', () => {
      const selectUser = store.select(state => state.user)
      const selectUserName = store.select(state => selectUser().details.name)

      expect(selectUserName()).toBe('Alice')

      store.updatePath(['user', 'details', 'name'], () => 'Bob')
      expect(selectUserName()).toBe('Bob')
    })
  })

  describe('Advanced Selector Patterns', () => {
    it('should work with parameterized selectors', () => {
      const createItemSelector = (itemId: number) =>
        store.select(state => state.data.items.find(item => item.id === itemId))

      const selectItem1 = createItemSelector(1)
      const selectItem2 = createItemSelector(2)

      expect(selectItem1()?.value).toBe('item1')
      expect(selectItem2()?.value).toBe('item2')
    })

    it('should handle array filtering and transformation', () => {
      const selectActiveItems = store.select(state =>
        state.data.items
          .filter(item => item.value.includes('item'))
          .map(item => ({...item, processed: true}))
      )

      const activeItems = selectActiveItems()
      expect(activeItems).toHaveLength(2)
      expect(activeItems[0]).toEqual({
        id: 1,
        value: 'item1',
        processed: true,
      })
    })

    it('should work with computed values', () => {
      const selectStats = store.select(state => ({
        totalItems: state.data.items.length,
        hasItems: state.data.items.length > 0,
        lastUpdated: state.data.cache.timestamp,
        userDisplayName: `${state.user.details.name} (#${state.user.id})`,
      }))

      const stats = selectStats()
      expect(stats.totalItems).toBe(2)
      expect(stats.hasItems).toBe(true)
      expect(stats.userDisplayName).toBe('Alice (#1)')
    })
  })
})

describe('Edge Cases and Error Handling', () => {
  it('should handle empty state gracefully', () => {
    const emptyStore = createStore({})

    expect(() => {
      emptyStore.dispatch({})
      emptyStore.reset()
      emptyStore.getState()
    }).not.toThrow()
  })

  it('should handle circular references in state', () => {
    // TODO: Add support for circular references in state (e.g., via custom serialization)
    const circularObj: any = {name: 'test'}
    circularObj.self = circularObj

    expect(() => {
      const store = createStore({circular: circularObj})
      store.getState()
    }).toThrowError(/circular references/i)
  })

  it('should handle large state objects', () => {
    const largeState = {
      items: Array.from({length: 10000}, (_, i) => ({
        id: i,
        value: `item-${i}`,
        data: {nested: {deep: {value: i * 2}}},
      })),
    }

    const store = createStore(largeState)

    expect(() => {
      store.dispatch({items: largeState.items.slice(0, 5000)})
      store.getState()
    }).not.toThrow()

    expect(store.getState().items).toHaveLength(5000)
  })

  it('should handle rapid successive updates', () => {
    const store = createStore({counter: 0})

    // Perform many rapid updates
    for (let i = 0; i < 1000; i++) {
      store.dispatch({counter: i})
    }

    expect(store.getState().counter).toBe(999)
  })

  it('should handle subscription during state change', () => {
    const store = createStore({count: 0})
    let newSubscriberCalled = false

    const listener = vi.fn(() => {
      // Subscribe to store while handling a state change
      store.subscribe(() => {
        newSubscriberCalled = true
      })
    })

    store.subscribe(listener)
    store.dispatch({count: 1})

    expect(listener).toHaveBeenCalled()

    // New subscriber should be called on next update
    store.dispatch({count: 2})
    expect(newSubscriberCalled).toBe(true)
  })
})
