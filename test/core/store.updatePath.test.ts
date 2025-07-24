import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'
import {createStore, StorageType, type Store} from '../../src/core'
import {
  createUpdatePathInitialState,
  type UpdatePathTestState,
} from './core-testing-utils/update-path-test-utils'

describe('Advanced Path Update Operations', () => {
  let store: Store<UpdatePathTestState>
  let updatePath: Store<UpdatePathTestState>['updatePath']
  let selectDataStructures: () => UpdatePathTestState['dataStructures']
  let selectCounters: () => ReturnType<typeof selectDataStructures>['counters']
  let selectPageViews: () => ReturnType<typeof selectCounters>['pageViews']
  let selectCollections: () => UpdatePathTestState['collections']
  let selectmixedArray: () => ReturnType<typeof selectCollections>['mixedArray']
  let selectNestedArrays: () => ReturnType<typeof selectCollections>['nestedArrays']
  let selectObjectArray: () => ReturnType<typeof selectCollections>['objectArray']
  let selectsimpleArray: () => ReturnType<typeof selectCollections>['simpleArray']
  let selectEdgeCases: () => UpdatePathTestState['edgeCases']
  let selectDeeplyNested: () => ReturnType<typeof selectEdgeCases>['deepNesting']
  let selectDeeplyNestedValue: () => ReturnType<
    typeof selectDeeplyNested
  >['level1']['level2']['level3']['level4']['level5']['value']
  let selectDeeplyNestedData: () => ReturnType<
    typeof selectDeeplyNested
  >['level1']['level2']['level3']['level4']['level5']['data']

  beforeAll(() => {
    // Initialize the store with the initial state
    store = createStore<UpdatePathTestState>(createUpdatePathInitialState(), {
      name: 'AdvancedPathUpdateStore',
      storageType: StorageType.None,
      historyLimit: 100,
    })
    updatePath = store.updatePath
    selectDataStructures = store.select(state => state.dataStructures)
    selectCounters = store.select(selectDataStructures, data => data.counters)
    selectPageViews = store.select(selectCounters, counters => counters.pageViews)
    selectCollections = store.select(state => state.collections)
    selectmixedArray = store.select(selectCollections, collections => collections.mixedArray)
    selectNestedArrays = store.select(selectCollections, collections => collections.nestedArrays)
    selectObjectArray = store.select(selectCollections, collections => collections.objectArray)
    selectsimpleArray = store.select(selectCollections, collections => collections.simpleArray)
    selectEdgeCases = store.select(state => state.edgeCases)
    selectDeeplyNested = store.select(selectEdgeCases, edgeCases => edgeCases.deepNesting)
    selectDeeplyNestedValue = store.select(
      selectDeeplyNested,
      deep => deep.level1.level2.level3.level4.level5.value
    )
    selectDeeplyNestedData = store.select(
      selectDeeplyNested,
      deep => deep.level1.level2.level3.level4.level5.data
    )
  })

  afterAll(() => {
    // Cleanup the store after all tests
    store.destroy({
      removePersistedState: true,
      clearHistory: true,
      resetRegistry: true,
    })
    store = null as any
    updatePath = null as any
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Basic Path Updates - Primitive Values', () => {
    // beforeEach(() => {
    //   store.reset()
    // })

    afterEach(() => {
      store.reset()
    })

    it('should update string values using updater function', () => {
      updatePath(['primitives', 'stringValue'], current => {
        expect(current).toBe('initial-string')
        return current.toUpperCase()
      })

      expect(store.getState().primitives.stringValue).toBe('INITIAL-STRING')
    })

    it('should update string values using direct value assignment', () => {
      updatePath(['primitives', 'stringValue'], 'new-direct-value')
      expect(store.getState().primitives.stringValue).toBe('new-direct-value')
    })

    it('should update number values with mathematical operations', () => {
      updatePath(['primitives', 'numberValue'], current => current * 2)
      expect(store.getState().primitives.numberValue).toBe(84)
    })

    it('should update boolean values with logical operations', () => {
      updatePath(['primitives', 'booleanValue'], current => !current)

      expect(store.getState().primitives.booleanValue).toBe(false)
    })

    it('should handle nullable values correctly', () => {
      // Update null to string
      updatePath(['primitives', 'nullableString'], 'now-has-value')
      expect(store.getState().primitives.nullableString).toBe('now-has-value')

      // Update string back to null
      updatePath(['primitives', 'nullableString'], null)
      expect(store.getState().primitives.nullableString).toBe(null)
    })

    it('should handle optional/undefined values', () => {
      // Set undefined optional value
      updatePath(['primitives', 'optionalNumber'], 123)
      expect(store.getState().primitives.optionalNumber).toBe(123)

      // Clear optional value back to undefined
      updatePath(['primitives', 'optionalNumber'], undefined)
      expect(store.getState().primitives.optionalNumber).toBeUndefined()
    })

    it('should not trigger state change for identical values', () => {
      const initialState = store.getState()
      const listener = vi.fn()
      const unsubscribe = store.subscribe(listener)

      // Update with same value
      updatePath(['primitives', 'stringValue'], 'initial-string')

      expect(listener).not.toHaveBeenCalled()
      expect(store.getState()).toBe(initialState) // Reference equality
      unsubscribe()
    })
  })

  describe('Deep Nested Object Updates', () => {
    // beforeEach(() => {
    //   store.reset()
    // })

    afterEach(() => {
      store.reset()
    })

    it('should update deeply nested primitive values', () => {
      updatePath(['user', 'profile', 'name'], current => {
        expect(current).toBe('John Doe')
        return 'Jane Smith'
      })

      expect(store.getState().user.profile.name).toBe('Jane Smith')
    })

    it('should update nested object properties', () => {
      updatePath(['user', 'profile', 'settings', 'theme'], current => {
        expect(current).toBe('dark')
        return 'light'
      })

      expect(store.getState().user.profile.settings.theme).toBe('light')
    })

    it('should update deeply nested objects', () => {
      store.batch(() => {
        const notifications = ['user', 'profile', 'settings', 'notifications'] as const
        updatePath([...notifications, 'email'], false)
        updatePath([...notifications, 'push'], true)
      })

      const notifications = store.getState().user.profile.settings.notifications
      expect(notifications.email).toBe(false)
      expect(notifications.push).toBe(true)
      expect(notifications.sms).toBe(true) // Unchanged
    })

    it('should maintain structural sharing for unchanged paths', () => {
      const {user: initialUser, collections: initialCollections} = store.getState()

      // Update only user profile name
      updatePath(['user', 'profile', 'name'], 'Updated Name')

      const newState = store.getState()

      // Collections should maintain same reference (structural sharing)
      expect(newState.collections).toBe(initialCollections)

      // User object should be new, but other parts unchanged
      expect(newState.user).not.toBe(initialUser)
      expect(newState.user.permissions).toStrictEqual(initialUser.permissions)
      expect(newState.user.roles).toStrictEqual(initialUser.roles)
      // unchanged properties should maintain reference
      expect(newState.user.profile).not.toBe(initialUser.profile)
      expect(newState.user.profile.name).toBe('Updated Name')
      expect(newState.user.profile.settings).toBe(initialUser.profile.settings)
      expect(newState.user.profile.email).toBe(initialUser.profile.email)
      expect(newState.user.profile?.metadata).toBe(initialUser.profile?.metadata)
      //expect(newState.user.roles).toBe(initialUser.roles) <--- TODO: fix this, sets are not structurally shared
      expect(newState.user.id).toBe(initialUser.id)
      //expect(newState.user.permissions).toBe(initialUser.permissions) <--- TODO: fix this, Arrays are not structurally shared
    })

    it('should handle very deep nesting (5+ levels)', () => {
      const path = [
        'edgeCases',
        'deepNesting',
        'level1',
        'level2',
        'level3',
        'level4',
        'level5',
        'value',
      ] as const
      updatePath(path, current => {
        expect(current).toBe('deep-nested-string')
        return 'updated-deep-value'
      })

      expect(selectDeeplyNestedValue()).toBe('updated-deep-value')
    })
  })

  describe('Array Operations', () => {
    afterEach(() => {
      store.reset()
    })

    it('should update entire arrays', () => {
      updatePath(['collections', 'simpleArray'], current => {
        expect(current).toEqual(['apple', 'banana', 'cherry'])
        return [...current, 'date', 'elderberry']
      })

      expect(selectsimpleArray()).toEqual(['apple', 'banana', 'cherry', 'date', 'elderberry'])
    })

    it('should update specific array elements by index', () => {
      updatePath(['collections', 'simpleArray', 1], current => {
        expect(current).toBe('banana')
        return 'blueberry'
      })

      expect(selectsimpleArray()).toEqual(['apple', 'blueberry', 'cherry'])
    })

    it('should update array elements with complex objects', () => {
      updatePath(['collections', 'objectArray', 0, 'completed'], current => {
        expect(current).toBe(false)
        return true
      })

      expect(selectObjectArray()[0].completed).toBe(true)
    })

    it('should update nested properties in array objects', () => {
      const updateTime = Date.now()
      updatePath(['collections', 'objectArray', 0, 'metadata', 'updatedAt'], updateTime)

      const updatedTask = selectObjectArray()[0]
      expect(updatedTask.metadata?.updatedAt).toBeTypeOf('number')
      expect(updatedTask.metadata?.updatedAt).toBe(updateTime)
    })

    it('should add new properties to array objects', () => {
      const path = ['collections', 'objectArray', 1, 'metadata'] as const

      updatePath([...path, 'updatedAt'] as const, Date.now())
      updatePath([...path, 'version'] as const, 1)

      const task = selectObjectArray()[1]
      expect(task.metadata?.updatedAt).toBeTypeOf('number')
      expect((task.metadata as any)?.version).toBe(1)
    })

    it('should handle nested arrays', () => {
      updatePath(['collections', 'nestedArrays', 0], current => {
        expect(current).toEqual(['group1-item1', 'group1-item2'])
        return [...current, 'group1-item3']
      })

      expect(selectNestedArrays()[0]).toEqual(['group1-item1', 'group1-item2', 'group1-item3'])
    })

    it('should handle mixed type arrays', () => {
      updatePath(['collections', 'mixedArray', 2], current => {
        expect(current).toEqual({type: 'config', value: {enabled: true, timeout: 5000}})
        return {type: 'updated-config', value: {enabled: false, timeout: 3000}}
      })

      const mixedArray = selectmixedArray()
      expect(mixedArray[2]).toEqual({
        type: 'updated-config',
        value: {enabled: false, timeout: 3000},
      })
    })
  })

  describe('Map and Set Operations', () => {
    afterEach(() => {
      store.reset()
    })

    it('should update Map entries', () => {
      updatePath(['dataStructures', 'userMap'], currentMap => {
        expect(currentMap instanceof Map).toBe(true)
        const originalUser = currentMap.get('user-123')
        expect(originalUser?.name).toBe('Alice Smith')

        // // Create a new map and update the user's name
        const updatedUser = {...originalUser!, name: 'Alice Johnson'}
        // const newMap = new Map(currentMap)
        // newMap.set('user-123', updatedUser)
        // return newMap
        currentMap.set('user-123', updatedUser)
        return currentMap
      })

      const userMap = selectDataStructures().userMap
      expect(userMap.get('user-123')?.name).toBe('Alice Johnson')

      // Ensure other users are unchanged
      const initialMap = createUpdatePathInitialState().dataStructures.userMap
      // iterate over initial map to check
      for (const [key, value] of initialMap) {
        if (key !== 'user-123') {
          expect(userMap.get(key)).toEqual(value)
        }
      }
    })

    it('should add new Map entries', () => {
      updatePath(['dataStructures', 'userMap'], currentMap => {
        // const newMap = new Map(currentMap)
        // newMap.set('user-999', {name: 'New User', age: 25, active: true})
        // return newMap
        expect(currentMap.get('user-999')).toBeUndefined()
        currentMap.set('user-999', {name: 'New User', age: 25, active: true})
        return currentMap
      })

      const userMap = selectDataStructures().userMap
      expect(userMap.has('user-999')).toBe(true)
      expect(userMap.get('user-999')?.name).toBe('New User')
    })

    it('should update Set contents', () => {
      const init = selectDataStructures().tagSet
      updatePath(['dataStructures', 'tagSet'], currentSet => {
        expect(currentSet instanceof Set).toBe(true)
        expect(currentSet.has('javascript')).toBe(true)

        // const newSet = new Set(currentSet)
        // newSet.add('python')
        // newSet.delete('javascript')
        // return newSet
        currentSet.add('python')
        currentSet.delete('javascript')
        return currentSet
      })

      const tagSet = selectDataStructures().tagSet
      expect(tagSet.has('python')).toBe(true)
      expect(tagSet.has('javascript')).toBe(false)

      expect(tagSet).not.toBe(init) // Ensure the set reference has changed

      store.reset()
      const initialSet = selectDataStructures().tagSet

      updatePath(['dataStructures', 'tagSet'], current => current)
      const tagSetAfterReset = selectDataStructures().tagSet
      expect(tagSetAfterReset).toBe(initialSet)
    })

    it('should update Record/Object entries', () => {
      updatePath(['dataStructures', 'counters', 'pageViews'], current => {
        expect(current).toBe(1250)
        return current + 100
      })

      expect(selectPageViews()).toBe(1350)
    })

    it('should add new Record entries', () => {
      updatePath(['dataStructures', 'counters', 'newMetric'], 42)

      expect((selectCounters() as any).newMetric).toBe(42)
    })
  })

  describe('Path Auto-creation', () => {
    beforeEach(() => {
      store.reset()
    })

    afterEach(() => {
      store.reset()
    })

    it('should auto-create missing intermediate objects', () => {
      updatePath(['user', 'profile', 'newSection', 'newProperty'], 'created-value')

      const newSection = (store.getState().user.profile as any).newSection
      expect(newSection.newProperty).toBe('created-value')
    })

    it('should auto-create missing intermediate arrays', () => {
      updatePath(['collections', 'newArray', 0], 'first-item')

      const newArray = (store.getState().collections as any).newArray
      expect(Array.isArray(newArray)).toBe(true)
      expect(newArray[0]).toBe('first-item')
    })

    it('should handle mixed object/array auto-creation', () => {
      updatePath(['user', 'newArrayField', 1, 'newObjectProperty'], () => 'mixed-value')

      const newStructure = (store.getState().user as any).newArrayField
      expect(Array.isArray(newStructure)).toBe(true)
      expect(newStructure[1].newObjectProperty).toBe('mixed-value')
    })

    it('should preserve existing structure during auto-creation', () => {
      const originalPermissions = store.getState().user.permissions

      updatePath(['user', 'newField', 'subField'], () => 'new-value')

      // Original structure should be preserved
      expect(store.getState().user.permissions).toStrictEqual(originalPermissions)
      expect((store.getState().user as any).newField.subField).toBe('new-value')
    })
  })

  describe('Deletion Operations', () => {
    beforeEach(() => {
      store.reset()
    })

    afterEach(() => {
      store.reset()
    })

    it('should delete object properties by returning undefined', () => {
      updatePath(['primitives', 'stringValue'], () => undefined)

      expect('stringValue' in store.getState().primitives).toBe(false)
    })

    it('should delete nested object properties', () => {
      updatePath(['user', 'profile', 'metadata'], () => undefined)

      expect('metadata' in store.getState().user.profile).toBe(false)
      expect(store.getState().user.profile.name).toBe('John Doe') // Other properties preserved
    })

    it('should delete array elements by index', () => {
      const originalLength = store.getState().collections.simpleArray.length

      updatePath(['collections', 'simpleArray', 1], () => undefined)

      const updatedArray = store.getState().collections.simpleArray
      expect(updatedArray.length).toBe(originalLength - 1)
      expect(updatedArray).toEqual(['apple', 'cherry']) // 'banana' removed
    })

    it('should handle deletion of optional properties', () => {
      updatePath(['primitives', 'optionalNumber'], () => 999)
      expect(store.getState().primitives.optionalNumber).toBe(999)

      updatePath(['primitives', 'optionalNumber'], () => undefined)
      expect(store.getState().primitives.optionalNumber).toBeUndefined()
    })

    it('should handle deletion with direct undefined assignment', () => {
      updatePath(['user', 'profile', 'email'], undefined)

      expect('email' in store.getState().user.profile).toBe(false)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    beforeEach(() => {
      store.reset()
    })

    afterEach(() => {
      store.reset()
    })

    it('should handle empty path arrays', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      updatePath([], () => 'should-not-work')

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should handle invalid path navigation', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Try to navigate through a primitive value
      updatePath(['primitives', 'stringValue', 'nonExistentProperty'], () => 'should-fail')

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should handle updater function errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      updatePath(['primitives', 'stringValue'], () => {
        throw new Error('Updater error')
      })

      expect(consoleSpy).toHaveBeenCalled()
      expect(store.getState().primitives.stringValue).toBe('initial-string') // Should remain unchanged
      consoleSpy.mockRestore()
    })

    it('should handle null/undefined intermediate values during navigation', () => {
      // Set up a null intermediate value
      updatePath(['edgeCases', 'nullValue'], () => null)

      // Spy on the store's error handler instead of console
      const initialState = store.getState()

      // Try to navigate through null - this should fail gracefully
      updatePath(['edgeCases', 'nullValue', 'property'], () => 'should-fail')

      // State should remain unchanged when navigation fails
      expect(store.getState()).toStrictEqual(initialState)
    })

    it('should work with empty collections', () => {
      updatePath(['edgeCases', 'emptyObject'], current => ({
        ...current,
        newProperty: 'added-to-empty',
      }))

      expect((store.getState().edgeCases.emptyObject as any).newProperty).toBe('added-to-empty')
    })

    it('should work with empty arrays', () => {
      updatePath(['edgeCases', 'emptyArray'], current => [...current, 'first-item'])

      expect(store.getState().edgeCases.emptyArray).toEqual(['first-item'])
    })

    it('should handle complex nested updates without affecting siblings', () => {
      const initialUI = store.getState().ui
      const initialApplication = store.getState().application

      // Update deep nested value
      updatePath(['user', 'profile', 'settings', 'notifications', 'email'], () => false)

      const newState = store.getState()

      // These should remain unchanged (structural sharing)
      expect(newState.ui).toBe(initialUI)
      expect(newState.application).toBe(initialApplication)

      // Only the specific path should be updated
      expect(newState.user.profile.settings.notifications.email).toBe(false)
    })
  })

  describe('Type Safety and Runtime Behavior', () => {
    beforeEach(() => {
      store.reset()
    })

    afterEach(() => {
      store.reset()
    })

    it('should maintain type information in updater functions', () => {
      updatePath(['user', 'profile', 'settings', 'theme'], currentTheme => {
        // Runtime check that the value is correctly typed
        expect(['light', 'dark', 'auto'].includes(currentTheme)).toBe(true)
        return currentTheme === 'dark' ? 'light' : 'dark'
      })

      expect(store.getState().user.profile.settings.theme).toBe('light')
    })

    it('should handle union types correctly', () => {
      updatePath(['user', 'profile', 'settings', 'privacy', 'visibility'], current => {
        expect(['public', 'private', 'friends'].includes(current)).toBe(true)
        return current === 'public' ? 'private' : 'public'
      })

      expect(store.getState().user.profile.settings.privacy.visibility).toBe('private')
    })

    it('should work with array element types', () => {
      updatePath(['collections', 'objectArray', 0, 'priority'], current => {
        expect(['low', 'medium', 'high'].includes(current)).toBe(true)
        return current === 'high' ? 'medium' : 'high'
      })

      expect(store.getState().collections.objectArray[0].priority).toBe('medium')
    })

    it('should handle optional properties correctly', () => {
      // Update optional property that exists
      updatePath(['collections', 'objectArray', 0, 'metadata', 'updatedAt'], current => {
        expect(typeof current).toBe('number')
        return Date.now()
      })

      // Update optional property by replacing existing metadata
      updatePath(['collections', 'objectArray', 2, 'metadata'], current => {
        expect(current).toBeDefined() // It exists in our test data
        expect(current?.createdAt).toBeTypeOf('number')
        return {createdAt: current?.createdAt, version: 1}
      })

      const task2 = store.getState().collections.objectArray[2]
      expect(task2.metadata?.createdAt).toBeTypeOf('number')
      expect((task2.metadata as any)?.version).toBe(1)
    })
  })

  describe('Performance and State Management', () => {
    beforeEach(() => {
      store.reset()
    })

    afterEach(() => {
      store.reset()
    })

    it('should trigger listeners only when state actually changes', () => {
      const listener = vi.fn()
      const unsubscribe = store.subscribe(listener)

      // Make actual change
      updatePath(['primitives', 'numberValue'], current => current + 1)
      expect(listener).toHaveBeenCalledTimes(1)

      // Make no-op change (same value)
      updatePath(['primitives', 'numberValue'], current => current)
      expect(listener).toHaveBeenCalledTimes(1) // Should not be called again

      unsubscribe()
    })

    it('should maintain reference equality for unchanged parts', () => {
      const initialState = store.getState()

      updatePath(['primitives', 'stringValue'], () => 'new-value')

      const newState = store.getState()

      // Changed part should be different
      expect(newState.primitives).not.toBe(initialState.primitives)

      // Unchanged parts should maintain reference equality
      expect(newState.user).toBe(initialState.user)
      expect(newState.collections).toBe(initialState.collections)
      expect(newState.dataStructures).toBe(initialState.dataStructures)
    })

    it('should work efficiently with large data structures', () => {
      const startTime = performance.now()

      // Update multiple nested values
      updatePath(['application', 'projects', 0, 'tasks', 0, 'title'], () => 'Updated Task Title')
      updatePath(['application', 'projects', 0, 'metadata', 'version'], current => current + 1)
      updatePath(['dynamic', 'computed', 'totalTasks', 'isStale'], () => true)

      const endTime = performance.now()

      // Should complete quickly (under 10ms for these operations)
      expect(endTime - startTime).toBeLessThan(10)

      // Verify updates worked
      expect(store.getState().application.projects[0].tasks[0].title).toBe('Updated Task Title')
      expect(store.getState().application.projects[0].metadata.version).toBe(3)
      expect(store.getState().dynamic.computed.totalTasks.isStale).toBe(true)
    })

    it('should handle batch operations correctly', () => {
      const listener = vi.fn()
      const unsubscribe = store.subscribe(listener)
      function updaterFn() {
        updatePath(['primitives', 'stringValue'], () => 'batch-1')
        updatePath(['primitives', 'numberValue'], () => 999)
        updatePath(['primitives', 'booleanValue'], () => false)
        let path = ['collections', 'objectArray', 0, 'metadata', 'updatedAt']
        updatePath(path, 1234567)
        path = ['collections', 'objectArray', 1, 'metadata', 'updatedAt']
        updatePath(path, 7654321)
      }

      store.batch(updaterFn)

      // Should only trigger listener once for batched operations
      expect(listener).toHaveBeenCalledTimes(1)

      const state = store.getState()
      expect(state.primitives.stringValue).toBe('batch-1')
      expect(state.primitives.numberValue).toBe(999)
      expect(state.primitives.booleanValue).toBe(false)
      expect(state.collections.objectArray[0].metadata?.updatedAt).toBe(1234567)
      expect(state.collections.objectArray[1].metadata?.updatedAt).toBe(7654321)

      unsubscribe()
    })
  })

  describe('Integration with Store Features', () => {
    beforeEach(() => {
      store.reset()
    })

    afterEach(() => {
      store.reset()
    })

    it('should work with undo/redo functionality', () => {
      // Make some changes
      updatePath(['primitives', 'stringValue'], () => 'first-change')
      updatePath(['primitives', 'numberValue'], () => 100)
      updatePath(['user', 'profile', 'name'], () => 'Changed Name')

      // Verify changes
      let state = store.getState()
      expect(state.primitives.stringValue).toBe('first-change')
      expect(state.primitives.numberValue).toBe(100)
      expect(state.user.profile.name).toBe('Changed Name')

      // Undo last change
      store.undo()
      state = store.getState()
      expect(state.user.profile.name).toBe('John Doe') // Should be reverted
      expect(state.primitives.numberValue).toBe(100) // Should remain

      // Undo another change
      store.undo()
      state = store.getState()
      expect(state.primitives.numberValue).toBe(42) // Should be reverted

      // Redo
      store.redo()
      state = store.getState()
      expect(state.primitives.numberValue).toBe(100) // Should be restored
    })

    it('should work with transactions', () => {
      const success = store.transaction(draft => {
        // Use updatePath within transaction (should work on draft)
        // Note: This tests the integration, though updatePath is typically used outside transactions
        draft.primitives.stringValue = 'transaction-updated'
        draft.user.profile.name = 'Transaction User'
      })

      expect(success).toBe(true)

      const state = store.getState()
      expect(state.primitives.stringValue).toBe('transaction-updated')
      expect(state.user.profile.name).toBe('Transaction User')
    })

    it('should trigger selector subscriptions correctly', () => {
      const nameSelector = (state: UpdatePathTestState) => state.user.profile.name
      const nameListener = vi.fn()

      const unsubscribe = store.subscribeTo(nameSelector, nameListener)

      // Update the selected value
      updatePath(['user', 'profile', 'name'], () => 'Selector Test')
      expect(nameListener).toHaveBeenCalledWith('Selector Test', 'John Doe')

      // Update unrelated value
      updatePath(['primitives', 'numberValue'], () => 999)
      expect(nameListener).toHaveBeenCalledTimes(1) // Should not be called again

      unsubscribe()
    })

    it('should work with path subscriptions', () => {
      const pathListener = vi.fn()
      const unsubscribe = store.subscribeToPath(['user', 'profile', 'email'], pathListener)

      updatePath(['user', 'profile', 'email'], () => 'new.email@example.com')
      expect(pathListener).toHaveBeenCalledWith('new.email@example.com', 'john.doe@example.com')

      unsubscribe()
    })
  })

  describe('Record/Dictionary Operations', () => {
    beforeEach(() => {
      store.reset()
    })

    afterEach(() => {
      store.reset()
    })

    it('should update record values by key', () => {
      updatePath(['dataStructures', 'counters', 'pageViews'], current => current + 100)

      expect(store.getState().dataStructures.counters.pageViews).toBe(1350)
      expect(store.getState().dataStructures.counters.uniqueVisitors).toBe(340) // unchanged
    })

    it('should add new record entries', () => {
      updatePath(['dataStructures', 'counters', 'newMetric'], () => 999)

      expect((store.getState().dataStructures.counters as any).newMetric).toBe(999)
    })

    it('should update complex configuration objects', () => {
      updatePath(['dataStructures', 'configuration', 'apiTimeout', 'value'], () => 10000)

      expect(store.getState().dataStructures.configuration.apiTimeout.value).toBe(10000)
      expect(store.getState().dataStructures.configuration.apiTimeout.type).toBe('number') // unchanged
    })

    it('should handle deeply nested configuration updates', () => {
      updatePath(
        ['dataStructures', 'configuration', 'apiTimeout', 'validation', 'max'],
        () => 60000
      )

      const config = store.getState().dataStructures.configuration.apiTimeout
      expect(config.validation?.max).toBe(60000)
      expect(config.validation?.min).toBe(1000) // unchanged
    })
  })

  describe('UI State Operations', () => {
    beforeEach(() => {
      store.reset()
    })

    afterEach(() => {
      store.reset()
    })

    it('should update loading states', () => {
      updatePath(['ui', 'loading'], () => true)
      expect(store.getState().ui.loading).toBe(true)

      updatePath(['ui', 'loading'], current => !current)
      expect(store.getState().ui.loading).toBe(false)
    })

    it('should manage error arrays', () => {
      updatePath(['ui', 'errors'], errors => [...errors, 'New error message'])

      expect(store.getState().ui.errors).toEqual(['New error message'])

      updatePath(['ui', 'errors'], errors => [...errors, 'Another error'])
      expect(store.getState().ui.errors).toEqual(['New error message', 'Another error'])
    })

    it('should update modal states', () => {
      updatePath(['ui', 'modals', 'user-profile', 'isOpen'], () => true)

      expect(store.getState().ui.modals['user-profile'].isOpen).toBe(true)

      updatePath(['ui', 'modals', 'user-profile', 'position', 'x'], () => 250)
      expect(store.getState().ui.modals['user-profile'].position?.x).toBe(250)
    })

    it('should create new modals dynamically', () => {
      updatePath(['ui', 'modals', 'new-modal'], () => ({
        isOpen: true,
        data: {id: 'test-123'},
      }))

      expect((store.getState().ui.modals as any)['new-modal'].isOpen).toBe(true)
      expect((store.getState().ui.modals as any)['new-modal'].data.id).toBe('test-123')
    })

    it('should update form values and validation', () => {
      updatePath(['ui', 'forms', 'loginForm', 'values', 'email'], () => 'test@example.com')
      updatePath(['ui', 'forms', 'loginForm', 'touched', 'email'], () => true)

      const form = store.getState().ui.forms.loginForm
      expect(form.values.email).toBe('test@example.com')
      expect(form.touched.email).toBe(true)
    })

    it('should update navigation state', () => {
      updatePath(['ui', 'navigation', 'currentRoute'], () => '/settings')
      updatePath(['ui', 'navigation', 'history'], history => [...history, '/settings'])

      const nav = store.getState().ui.navigation
      expect(nav.currentRoute).toBe('/settings')
      expect(nav.history).toContain('/settings')
    })

    it('should update breadcrumbs', () => {
      updatePath(['ui', 'navigation', 'breadcrumbs', 1, 'isActive'], () => false)
      updatePath(['ui', 'navigation', 'breadcrumbs'], breadcrumbs => [
        ...breadcrumbs,
        {label: 'Settings', path: '/settings', isActive: true},
      ])

      const breadcrumbs = store.getState().ui.navigation.breadcrumbs
      expect(breadcrumbs[1].isActive).toBe(false)
      expect(breadcrumbs[2].label).toBe('Settings')
    })
  })

  describe('Application Data Operations', () => {
    beforeEach(() => {
      store.reset()
    })

    afterEach(() => {
      store.reset()
    })

    it('should update project status', () => {
      updatePath(['application', 'projects', 0, 'status'], () => 'completed')

      expect(store.getState().application.projects[0].status).toBe('completed')
    })

    it('should update team members', () => {
      updatePath(['application', 'projects', 0, 'team', 'members'], members => [
        ...members,
        'user-999',
      ])

      expect(store.getState().application.projects[0].team.members).toContain('user-999')
    })

    it('should update task status and assignee', () => {
      updatePath(['application', 'projects', 0, 'tasks', 0, 'status'], () => 'review')
      updatePath(['application', 'projects', 0, 'tasks', 0, 'assignee'], () => 'user-789')

      const task = store.getState().application.projects[0].tasks[0]
      expect(task.status).toBe('review')
      expect(task.assignee).toBe('user-789')
    })

    it('should add new tasks to projects', () => {
      updatePath(['application', 'projects', 0, 'tasks'], tasks => [
        ...tasks,
        {
          id: 'task-new',
          title: 'New task',
          status: 'todo' as const,
          dependencies: [],
          comments: [],
        },
      ])

      const tasks = store.getState().application.projects[0].tasks
      expect(tasks).toHaveLength(3)
      expect(tasks[2].id).toBe('task-new')
    })

    it('should update comment reactions (Map)', () => {
      const commentPath = ['application', 'projects', 0, 'tasks', 0, 'comments', 0, 'reactions']

      updatePath(commentPath, reactions => {
        const newReactions = new Map(reactions)
        newReactions.set('🚀', 1)
        return newReactions
      })

      const reactions = store.getState().application.projects[0].tasks[0].comments[0].reactions
      expect(reactions.get('🚀')).toBe(1)
      expect(reactions.get('👍')).toBe(2) // unchanged
    })

    it('should update project metadata settings', () => {
      updatePath(['application', 'projects', 0, 'metadata', 'settings', 'autoAssign'], () => false)
      updatePath(['application', 'projects', 0, 'metadata', 'version'], v => v + 1)

      const metadata = store.getState().application.projects[0].metadata
      expect(metadata.settings.autoAssign).toBe(false)
      expect(metadata.version).toBe(3)
    })
  })

  describe('Dynamic Data Operations', () => {
    beforeEach(() => {
      store.reset()
    })

    afterEach(() => {
      store.reset()
    })

    it('should update cache entries', () => {
      updatePath(['dynamic', 'cache'], cache => {
        const newCache = new Map(cache)
        newCache.set('new-key', {
          data: {test: 'data'},
          timestamp: Date.now(),
        })
        return newCache
      })

      expect(store.getState().dynamic.cache.has('new-key')).toBe(true)
    })

    it('should update cache entry properties', () => {
      updatePath(['dynamic', 'cache'], cache => {
        const newCache = new Map(cache)
        const existing = newCache.get('user-data-123')
        if (existing) {
          newCache.set('user-data-123', {
            ...existing,
            ttl: 7200000, // 2 hours
          })
        }
        return newCache
      })

      const cacheEntry = store.getState().dynamic.cache.get('user-data-123')
      expect(cacheEntry?.ttl).toBe(7200000)
    })

    it('should update subscription sets', () => {
      updatePath(['dynamic', 'subscriptions'], subs => {
        const newSubs = new Set(subs)
        newSubs.add('new-subscription')
        return newSubs
      })

      expect(store.getState().dynamic.subscriptions.has('new-subscription')).toBe(true)
    })

    it('should update event handlers', () => {
      updatePath(['dynamic', 'eventHandlers', 'user-login'], handlers => [
        ...handlers,
        {id: 'handler-new', handler: 'newFunction', priority: 3},
      ])

      const handlers = store.getState().dynamic.eventHandlers['user-login']
      expect(handlers).toHaveLength(3)
      expect(handlers[2].id).toBe('handler-new')
    })

    it('should update computed values', () => {
      updatePath(['dynamic', 'computed', 'totalTasks', 'value'], () => 5)
      updatePath(['dynamic', 'computed', 'totalTasks', 'isStale'], () => true)

      const computed = store.getState().dynamic.computed.totalTasks
      expect(computed.value).toBe(5)
      expect(computed.isStale).toBe(true)
    })

    it('should add new computed values', () => {
      updatePath(['dynamic', 'computed', 'newComputed'], () => ({
        value: 'computed-result',
        dependencies: ['some.path'],
        lastComputed: Date.now(),
        isStale: false,
      }))

      expect((store.getState().dynamic.computed as any).newComputed.value).toBe('computed-result')
    })
  })

  describe('Advanced Edge Cases', () => {
    beforeEach(() => {
      store.reset()
    })

    afterEach(() => {
      store.reset()
    })

    it('should handle updates to empty containers', () => {
      updatePath(['edgeCases', 'emptyObject', 'newProp'], () => 'added-to-empty')
      updatePath(['edgeCases', 'emptyArray', 0], () => 'first-item')

      expect((store.getState().edgeCases.emptyObject as any).newProp).toBe('added-to-empty')
      expect((store.getState().edgeCases.emptyArray as any)[0]).toBe('first-item')
    })

    it('should handle updates to null values', () => {
      updatePath(['edgeCases', 'nullValue'], () => 'no-longer-null')

      expect(store.getState().edgeCases.nullValue).toBe('no-longer-null')
    })

    it('should handle updates to undefined values', () => {
      updatePath(['edgeCases', 'undefinedValue'], () => 'now-defined')

      expect(store.getState().edgeCases.undefinedValue).toBe('now-defined')
    })

    it('should handle extremely deep nesting updates', () => {
      updatePath(
        ['edgeCases', 'deepNesting', 'level1', 'level2', 'level3', 'level4', 'level5', 'value'],
        () => 'updated-deep-value'
      )

      const deepValue =
        store.getState().edgeCases.deepNesting.level1.level2.level3.level4.level5.value
      expect(deepValue).toBe('updated-deep-value')
    })

    it('should handle updates to deep nested arrays', () => {
      updatePath(
        ['edgeCases', 'deepNesting', 'level1', 'level2', 'level3', 'level4', 'level5', 'data', 2],
        () => 999
      )

      const deepArray =
        store.getState().edgeCases.deepNesting.level1.level2.level3.level4.level5.data
      expect(deepArray[2]).toBe(999)
    })

    it('should handle mixed type operations in single path', () => {
      // Update mixed array with different types
      updatePath(['collections', 'mixedArray', 2], (item: any) => ({
        ...item,
        value: {...item.value, newProp: 'added'},
      }))

      const mixedItem = store.getState().collections.mixedArray[2] as any
      expect(mixedItem.value.newProp).toBe('added')
      expect(mixedItem.value.enabled).toBe(true) // preserved
    })

    it('should handle simultaneous updates to related paths', () => {
      // Test that multiple related updates work correctly
      updatePath(['user', 'profile', 'name'], () => 'Updated User')
      updatePath(['user', 'profile', 'email'], () => 'updated@example.com')
      updatePath(['user', 'profile', 'metadata', 'loginCount'], count => count + 1)

      const profile = store.getState().user.profile
      expect(profile.name).toBe('Updated User')
      expect(profile.email).toBe('updated@example.com')
      expect(profile.metadata?.loginCount).toBe(158)
    })
  })

  describe('Performance and Stress Testing', () => {
    beforeEach(() => {
      store.reset()
    })

    afterEach(() => {
      store.reset()
    })

    it('should handle many rapid updates efficiently', () => {
      const startTime = performance.now()

      // Perform 100 rapid updates
      for (let i = 0; i < 100; i++) {
        updatePath(['primitives', 'numberValue'], current => current + 1)
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(store.getState().primitives.numberValue).toBe(142) // 42 + 100
      expect(duration).toBeLessThan(100) // Should complete in less than 100ms
    })

    it('should handle large array operations efficiently', () => {
      const largeArray = new Array(1000).fill(0).map((_, i) => i)

      updatePath(['collections', 'numberArray'], () => largeArray)

      expect(store.getState().collections.numberArray).toHaveLength(1000)
      expect(store.getState().collections.numberArray[999]).toBe(999)
    })

    it('should handle complex nested updates without performance degradation', () => {
      const startTime = performance.now()

      // Complex nested updates
      for (let i = 0; i < 50; i++) {
        updatePath(
          ['application', 'projects', 0, 'metadata', 'settings', 'autoAssign'],
          current => !current
        )
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(50) // Should be efficient even for deep paths
    })
  })
})
