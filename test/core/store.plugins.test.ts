import {describe, it, expect, beforeEach, vi} from 'vitest'
import {PluginManager} from '../../src/plugins/pluginManager'
import {Plugin, ActionPayload, StorageType, Store, historyChangePluginOptions} from '../../src/core/state/types'
import {MiddlewareError, StoreError} from '../../src/shared/errors'
import {Draft} from 'immer'

interface TestState {
  count: number
  name: string
  items: string[]
}

describe('PluginManager', () => {
  let pluginManager: PluginManager<TestState>
  let mockHandleError: ReturnType<typeof vi.fn>
  let mockStore: Store<TestState>
  let testState: TestState

  beforeEach(() => {
    mockHandleError = vi.fn()
    testState = {count: 0, name: 'test', items: []}

    // Mock store instance with all required Store interface methods
    mockStore = {
      // ReadOnlyStore methods
      getState: vi.fn(() => testState),
      subscribe: vi.fn(),
      subscribeTo: vi.fn(),
      subscribeToMultiple: vi.fn(),
      subscribeToPath: vi.fn(),
      select: vi.fn(),
      getName: vi.fn(() => 'TestStore'),
      getSessionId: vi.fn(() => 'test-session-123'),

      // Store methods
      dispatch: vi.fn(),
      setState: vi.fn(),
      reset: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      destroy: vi.fn(),
      updatePath: vi.fn(),
      batch: vi.fn(),
      transaction: vi.fn(),
      asReadOnly: vi.fn(),
      selectWith: vi.fn(),
      _setStateForDevTools: vi.fn(),
    } as unknown as Store<TestState>
  })

  describe('Constructor and Initialization', () => {
    it('should initialize with empty plugins array', () => {
      pluginManager = new PluginManager([], mockHandleError, 'TestStore')
      expect(pluginManager.name).toBe('TestStore')
    })

    it('should initialize with provided plugins', () => {
      const plugin: Plugin<TestState> = {name: 'test-plugin'}
      pluginManager = new PluginManager([plugin], mockHandleError, 'TestStore')
      expect(pluginManager.name).toBe('TestStore')
    })

    it('should use default name when not provided', () => {
      pluginManager = new PluginManager([], mockHandleError)
      expect(pluginManager.name).toBe('PluginManager')
    })
  })

  describe('onStoreCreate', () => {
    it('should call onStoreCreate on all plugins', () => {
      const plugin1 = {name: 'plugin1', onStoreCreate: vi.fn()}
      const plugin2 = {name: 'plugin2', onStoreCreate: vi.fn()}

      pluginManager = new PluginManager([plugin1, plugin2], mockHandleError)
      pluginManager.onStoreCreate(mockStore)

      expect(plugin1.onStoreCreate).toHaveBeenCalledWith(mockStore)
      expect(plugin2.onStoreCreate).toHaveBeenCalledWith(mockStore)
    })

    it('should fail fast on error in onStoreCreate', () => {
      const error = new Error('Plugin creation failed')
      const plugin = {
        name: 'failing-plugin',
        onStoreCreate: vi.fn(() => {
          throw error
        }),
      }

      pluginManager = new PluginManager([plugin], mockHandleError)

      expect(() => pluginManager.onStoreCreate(mockStore)).toThrow(error)
      expect(mockHandleError).toHaveBeenCalledWith(expect.any(MiddlewareError))
    })

    it('should skip plugins without onStoreCreate hook', () => {
      const plugin = {name: 'no-hook-plugin'}
      pluginManager = new PluginManager([plugin], mockHandleError)

      expect(() => pluginManager.onStoreCreate(mockStore)).not.toThrow()
    })
  })

  describe('onDestroy', () => {
    it('should call onDestroy on all plugins', () => {
      const plugin1 = {name: 'plugin1', onDestroy: vi.fn()}
      const plugin2 = {name: 'plugin2', onDestroy: vi.fn()}

      pluginManager = new PluginManager([plugin1, plugin2], mockHandleError)
      pluginManager.onDestroy(mockStore)

      expect(plugin1.onDestroy).toHaveBeenCalledWith(mockStore)
      expect(plugin2.onDestroy).toHaveBeenCalledWith(mockStore)
    })

    it('should continue on error in onDestroy', () => {
      const plugin1 = {
        name: 'failing-plugin',
        onDestroy: vi.fn(() => {
          throw new Error('Destroy failed')
        }),
      }
      const plugin2 = {name: 'working-plugin', onDestroy: vi.fn()}

      pluginManager = new PluginManager([plugin1, plugin2], mockHandleError)
      pluginManager.onDestroy(mockStore)

      expect(mockHandleError).toHaveBeenCalled()
      expect(plugin2.onDestroy).toHaveBeenCalledWith(mockStore)
    })
  })

  describe('onError', () => {
    it('should call onError on all plugins without using executeHook', () => {
      const plugin1 = {name: 'plugin1', onError: vi.fn()}
      const plugin2 = {name: 'plugin2', onError: vi.fn()}

      pluginManager = new PluginManager([plugin1, plugin2], mockHandleError)

      const testError = new StoreError('Test error')
      const context = {operation: 'test'}

      pluginManager.onError(testError, context, mockStore)

      expect(plugin1.onError).toHaveBeenCalledWith(testError, context, mockStore)
      expect(plugin2.onError).toHaveBeenCalledWith(testError, context, mockStore)
    })

    it('should prevent infinite recursion by not calling handleError', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const plugin = {
        name: 'failing-plugin',
        onError: vi.fn(() => {
          throw new Error('onError failed')
        }),
      }

      pluginManager = new PluginManager([plugin], mockHandleError)

      const testError = new StoreError('Test error')
      pluginManager.onError(testError, {operation: 'test'}, mockStore)

      expect(mockHandleError).not.toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[PluginManager] Plugin failing-plugin.onError failed:'),
        expect.objectContaining({
          originalError: 'Test error',
          pluginError: 'onError failed',
          pluginName: 'failing-plugin',
        })
      )

      consoleSpy.mockRestore()
    })
  })

  describe('beforeStateChange', () => {
    it('should transform action through plugins', () => {
      const plugin1 = {
        name: 'plugin1',
        beforeStateChange: vi.fn((action: ActionPayload<TestState>) => ({
          ...action,
          count: action.count! + 1,
        })),
      }
      const plugin2 = {
        name: 'plugin2',
        beforeStateChange: vi.fn((action: ActionPayload<TestState>) => ({
          ...action,
          count: action.count! * 2,
        })),
      }

      pluginManager = new PluginManager([plugin1, plugin2], mockHandleError)

      const action: ActionPayload<TestState> = {count: 5}
      const result = pluginManager.beforeStateChange(action, testState, mockStore)

      expect(plugin1.beforeStateChange).toHaveBeenCalledWith(action, testState, mockStore)
      expect(plugin2.beforeStateChange).toHaveBeenCalledWith(
        {count: 6}, // plugin2 receives the transformed action from plugin1
        testState,
        mockStore
      )

      // The action should be transformed by both plugins in the order they were added
      // plugin1 adds 1, then plugin2 multiplies by 2
      expect(result).toEqual({count: 12}) // 5 + 1 = 6, 6 * 2 = 12
    })

    it('should return original action if no transformations', () => {
      const plugin = {name: 'plugin1', beforeStateChange: vi.fn(() => {})}
      pluginManager = new PluginManager([plugin], mockHandleError)

      const action: ActionPayload<TestState> = {count: 5}
      const result = pluginManager.beforeStateChange(action, testState, mockStore)

      expect(result).toEqual(action)
    })

    it('should handle errors and continue with other plugins', () => {
      const plugin1 = {
        name: 'failing-plugin',
        beforeStateChange: vi.fn(() => {
          throw new Error('Transform failed')
        }),
      }
      const plugin2 = {
        name: 'working-plugin',
        beforeStateChange: vi.fn((action: ActionPayload<TestState>) => ({
          ...action,
          name: 'transformed',
        })),
      }

      pluginManager = new PluginManager([plugin1, plugin2], mockHandleError)

      const action: ActionPayload<TestState> = {count: 5}
      const result = pluginManager.beforeStateChange(action, testState, mockStore)

      expect(mockHandleError).toHaveBeenCalledWith(expect.any(MiddlewareError))
      expect(result).toEqual({count: 5, name: 'transformed'})
    })
  })

  describe('onStateChange', () => {
    it('should notify all plugins of state change', () => {
      const plugin1 = {name: 'plugin1', onStateChange: vi.fn()}
      const plugin2 = {name: 'plugin2', onStateChange: vi.fn()}

      pluginManager = new PluginManager([plugin1, plugin2], mockHandleError)

      const newState = {...testState, count: 1}
      const action: ActionPayload<TestState> = {count: 1}

      pluginManager.onStateChange(newState, testState, action, mockStore)

      expect(plugin1.onStateChange).toHaveBeenCalledWith(newState, testState, action, mockStore)
      expect(plugin2.onStateChange).toHaveBeenCalledWith(newState, testState, action, mockStore)
    })

    it('should handle null action', () => {
      const plugin = {name: 'plugin1', onStateChange: vi.fn()}
      pluginManager = new PluginManager([plugin], mockHandleError)

      const newState = {...testState, count: 1}
      pluginManager.onStateChange(newState, testState, null, mockStore)

      expect(plugin.onStateChange).toHaveBeenCalledWith(newState, testState, null, mockStore)
    })
  })

  describe('beforePersist', () => {
    it('should transform state before persistence', () => {
      const plugin1 = {
        name: 'plugin1',
        beforePersist: vi.fn((state: TestState) => ({
          ...state,
          count: state.count + 10,
        })),
      }
      const plugin2 = {
        name: 'plugin2',
        beforePersist: vi.fn((state: TestState) => ({
          ...state,
          name: 'persisted',
        })),
      }

      pluginManager = new PluginManager([plugin1, plugin2], mockHandleError)

      const result = pluginManager.beforePersist(testState, StorageType.Local, mockStore)

      // The state should be transformed by both plugins in the order they were added

      // plugin1 adds 10 to count
      expect(plugin1.beforePersist).toHaveBeenCalledWith(testState, StorageType.Local, mockStore)

      // plugin2 changes name to "persisted"
      expect(plugin2.beforePersist).toHaveBeenCalledWith(
        {count: 10, name: 'test', items: []},
        StorageType.Local,
        mockStore
      )

      expect(result).toEqual({count: 10, name: 'persisted', items: []})
    })

    it('should return original state if no transformations', () => {
      pluginManager = new PluginManager([], mockHandleError)

      const result = pluginManager.beforePersist(testState, StorageType.Local, mockStore)
      expect(result).toEqual(testState)
    })
  })

  describe('onPersisted', () => {
    it('should notify all plugins after persistence', () => {
      const plugin1 = {name: 'plugin1', onPersisted: vi.fn()}
      const plugin2 = {name: 'plugin2', onPersisted: vi.fn()}

      pluginManager = new PluginManager([plugin1, plugin2], mockHandleError)
      pluginManager.onPersisted(testState, StorageType.Session, mockStore)

      expect(plugin1.onPersisted).toHaveBeenCalledWith(testState, StorageType.Session, mockStore)
      expect(plugin2.onPersisted).toHaveBeenCalledWith(testState, StorageType.Session, mockStore)
    })
  })

  describe('onStateLoaded', () => {
    it('should transform loaded state', () => {
      const partialState: Partial<TestState> = {count: 5}
      const plugin = {
        name: 'plugin1',
        onStateLoaded: vi.fn((state: Partial<TestState>) => ({
          ...state,
          name: 'loaded',
        })),
      }

      pluginManager = new PluginManager([plugin], mockHandleError)

      const result = pluginManager.onStateLoaded(partialState, StorageType.Local, mockStore)
      expect(result).toEqual({count: 5, name: 'loaded'})
    })

    it('should transform the loaded state with multiple plugins', () => {
      const partialState: Partial<TestState> = {count: 5}
      const plugin1 = {
        name: 'plugin1',
        onStateLoaded: vi.fn((state: Partial<TestState>) => ({
          ...state,
          count: state.count! + 10,
        })),
      }
      const plugin2 = {
        name: 'plugin2',
        onStateLoaded: vi.fn((state: Partial<TestState>) => ({
          ...state,
          name: 'loaded',
        })),
      }

      pluginManager = new PluginManager([plugin1, plugin2], mockHandleError)

      const result = pluginManager.onStateLoaded(partialState, StorageType.Local, mockStore)
      expect(result).toEqual({count: 15, name: 'loaded'})
    })
  })

  describe('onCrossTabSync', () => {
    it('should transform synced state', () => {
      const syncedState = {...testState, count: 100}
      const plugin = {
        name: 'plugin1',
        onCrossTabSync: vi.fn((state: TestState) => ({
          ...state,
          name: 'synced',
        })),
      }

      pluginManager = new PluginManager([plugin], mockHandleError)

      const result = pluginManager.onCrossTabSync(syncedState, 'session123', mockStore)
      expect(result).toEqual({count: 100, name: 'synced', items: []})
    })

    it('should handle multiple plugins transforming synced state', () => {
      const syncedState = {...testState, count: 100}
      const plugin1 = {
        name: 'plugin1',
        onCrossTabSync: vi.fn((state: TestState) => ({
          ...state,
          count: state.count + 50,
        })),
      }
      const plugin2 = {
        name: 'plugin2',
        onCrossTabSync: vi.fn((state: TestState) => ({
          ...state,
          name: 'synced',
        })),
      }

      pluginManager = new PluginManager([plugin1, plugin2], mockHandleError)

      const result = pluginManager.onCrossTabSync(syncedState, 'session123', mockStore)
      expect(result).toEqual({count: 150, name: 'synced', items: []})
    })
  })

  describe('beforeHistoryChange', () => {
    it('should allow history change when all plugins return true', () => {
      const plugin1 = {
        name: 'plugin1',
        beforeHistoryChange: vi.fn(() => true),
      }
      const plugin2 = {
        name: 'plugin2',
        beforeHistoryChange: vi.fn(() => undefined),
      }

      pluginManager = new PluginManager([plugin1, plugin2], mockHandleError)

      const options: historyChangePluginOptions<TestState> = {
        operation: 'undo',
        steps: 1,
        store: mockStore,
        oldState: testState,
        newState: {...testState, count: 1},
      }

      const result = pluginManager.beforeHistoryChange(options)
      expect(result).toBe(true)
    })

    it('should prevent history change when any plugin returns false', () => {
      const plugin1 = {
        name: 'plugin1',
        beforeHistoryChange: vi.fn(() => true),
      }
      const plugin2 = {
        name: 'plugin2',
        beforeHistoryChange: vi.fn(() => false),
      }
      const plugin3 = {
        name: 'plugin3',
        beforeHistoryChange: vi.fn(() => true),
      }

      pluginManager = new PluginManager([plugin1, plugin2, plugin3], mockHandleError)

      const options: historyChangePluginOptions<TestState> = {
        operation: 'redo',
        steps: 2,
        store: mockStore,
        oldState: testState,
        newState: {...testState, count: 2},
      }

      const result = pluginManager.beforeHistoryChange(options)
      expect(result).toBe(false)
      expect(plugin3.beforeHistoryChange).not.toHaveBeenCalled() // Should abort early
    })

    it('should handle errors and continue', () => {
      const plugin1 = {
        name: 'failing-plugin',
        beforeHistoryChange: vi.fn(() => {
          throw new Error('History check failed')
        }),
      }
      const plugin2 = {
        name: 'working-plugin',
        beforeHistoryChange: vi.fn(() => true),
      }

      pluginManager = new PluginManager([plugin1, plugin2], mockHandleError)

      const options: historyChangePluginOptions<TestState> = {
        operation: 'undo',
        steps: 1,
        store: mockStore,
        oldState: testState,
        newState: {...testState, count: 1},
      }

      const result = pluginManager.beforeHistoryChange(options)

      expect(mockHandleError).toHaveBeenCalledWith(expect.any(MiddlewareError))
      expect(result).toBe(true)
      expect(plugin2.beforeHistoryChange).toHaveBeenCalledWith(options)
    })
  })

  describe('onHistoryChanged', () => {
    it('should notify all plugins of history change', () => {
      const plugin1 = {name: 'plugin1', onHistoryChanged: vi.fn()}
      const plugin2 = {name: 'plugin2', onHistoryChanged: vi.fn()}

      pluginManager = new PluginManager([plugin1, plugin2], mockHandleError)

      const options: historyChangePluginOptions<TestState> = {
        operation: 'undo',
        steps: 1,
        store: mockStore,
        oldState: testState,
        newState: {...testState, count: 1},
      }

      pluginManager.onHistoryChanged(options)

      expect(plugin1.onHistoryChanged).toHaveBeenCalledWith(options)
      expect(plugin2.onHistoryChanged).toHaveBeenCalledWith(options)
    })
  })

  describe('Batch Operations', () => {
    describe('onBatchStart', () => {
      it('should notify all plugins when batch starts', () => {
        const plugin1 = {name: 'plugin1', onBatchStart: vi.fn()}
        const plugin2 = {name: 'plugin2', onBatchStart: vi.fn()}

        pluginManager = new PluginManager([plugin1, plugin2], mockHandleError)
        pluginManager.onBatchStart(mockStore)

        expect(plugin1.onBatchStart).toHaveBeenCalledWith(mockStore)
        expect(plugin2.onBatchStart).toHaveBeenCalledWith(mockStore)
      })
    })

    describe('onBatchEnd', () => {
      it('should notify all plugins when batch ends', () => {
        const plugin1 = {name: 'plugin1', onBatchEnd: vi.fn()}
        const plugin2 = {name: 'plugin2', onBatchEnd: vi.fn()}

        pluginManager = new PluginManager([plugin1, plugin2], mockHandleError)

        const actions: ActionPayload<TestState>[] = [{count: 1}, {count: 2}]
        const finalState = {...testState, count: 2}

        pluginManager.onBatchEnd(actions, finalState, mockStore)

        expect(plugin1.onBatchEnd).toHaveBeenCalledWith(actions, finalState, mockStore)
        expect(plugin2.onBatchEnd).toHaveBeenCalledWith(actions, finalState, mockStore)
      })
    })
  })

  describe('Transaction Operations', () => {
    describe('onTransactionStart', () => {
      it('should notify all plugins when transaction starts', () => {
        const plugin1 = {name: 'plugin1', onTransactionStart: vi.fn()}
        const plugin2 = {name: 'plugin2', onTransactionStart: vi.fn()}

        pluginManager = new PluginManager([plugin1, plugin2], mockHandleError)
        pluginManager.onTransactionStart(mockStore)

        expect(plugin1.onTransactionStart).toHaveBeenCalledWith(mockStore)
        expect(plugin2.onTransactionStart).toHaveBeenCalledWith(mockStore)
      })
    })

    describe('onTransactionEnd', () => {
      it('should notify all plugins when transaction succeeds', () => {
        const plugin1 = {name: 'plugin1', onTransactionEnd: vi.fn()}
        const plugin2 = {name: 'plugin2', onTransactionEnd: vi.fn()}

        pluginManager = new PluginManager([plugin1, plugin2], mockHandleError)

        const changes: Partial<TestState> = {count: 5}
        pluginManager.onTransactionEnd(true, mockStore, changes)

        expect(plugin1.onTransactionEnd).toHaveBeenCalledWith(true, mockStore, changes, undefined)
        expect(plugin2.onTransactionEnd).toHaveBeenCalledWith(true, mockStore, changes, undefined)
      })

      it('should notify all plugins when transaction fails', () => {
        const plugin1 = {name: 'plugin1', onTransactionEnd: vi.fn()}
        const plugin2 = {name: 'plugin2', onTransactionEnd: vi.fn()}

        pluginManager = new PluginManager([plugin1, plugin2], mockHandleError)

        const error = new Error('Transaction failed')
        pluginManager.onTransactionEnd(false, mockStore, undefined, error)

        expect(plugin1.onTransactionEnd).toHaveBeenCalledWith(false, mockStore, undefined, error)
        expect(plugin2.onTransactionEnd).toHaveBeenCalledWith(false, mockStore, undefined, error)
      })
    })
  })

  describe('Error Handling', () => {
    it('should create MiddlewareError with correct context', () => {
      const plugin = {
        name: 'test-plugin',
        onStateChange: vi.fn(() => {
          throw new Error('State change failed')
        }),
      }

      pluginManager = new PluginManager([plugin], mockHandleError)
      pluginManager.onStateChange(testState, testState, {count: 1}, mockStore)

      expect(mockHandleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Plugin test-plugin.onStateChange failed',
          context: expect.objectContaining({
            pluginName: 'test-plugin',
            operation: 'onStateChange',
          }),
        })
      )
    })

    it('should continue execution after plugin error by default', () => {
      const plugin1 = {
        name: 'failing-plugin',
        onStateChange: vi.fn(() => {
          throw new Error('Plugin failed')
        }),
      }
      const plugin2 = {name: 'working-plugin', onStateChange: vi.fn()}

      pluginManager = new PluginManager([plugin1, plugin2], mockHandleError)
      pluginManager.onStateChange(testState, testState, {count: 1}, mockStore)

      expect(mockHandleError).toHaveBeenCalled()
      expect(plugin2.onStateChange).toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('should handle plugins with no hooks gracefully', () => {
      const plugin = {name: 'empty-plugin'}
      pluginManager = new PluginManager([plugin], mockHandleError)

      expect(() => {
        pluginManager.onStoreCreate(mockStore)
        pluginManager.onStateChange(testState, testState, {count: 1}, mockStore)
        pluginManager.onDestroy(mockStore)
      }).not.toThrow()
    })

    it('should handle empty plugins array', () => {
      pluginManager = new PluginManager([], mockHandleError)

      expect(() => {
        pluginManager.onStoreCreate(mockStore)
        pluginManager.onStateChange(testState, testState, {count: 1}, mockStore)
        pluginManager.beforeStateChange({count: 1}, testState, mockStore)
        pluginManager.onDestroy(mockStore)
      }).not.toThrow()
    })

    it('should handle plugins with non-function hook properties', () => {
      const plugin = {
        name: 'invalid-plugin',
        onStateChange: 'not a function' as any,
      }

      pluginManager = new PluginManager([plugin], mockHandleError)

      expect(() => {
        pluginManager.onStateChange(testState, testState, {count: 1}, mockStore)
      }).not.toThrow()
    })

    it('should handle plugins with hooks that return undefined', () => {
      const plugin = {
        name: 'undefined-return-plugin',
        beforeStateChange: vi.fn(() => undefined),
      }

      pluginManager = new PluginManager([plugin], mockHandleError)

      const action: ActionPayload<TestState> = {count: 1}
      const result = pluginManager.beforeStateChange(action, testState, mockStore)

      // undefined return should mean "no transformation", so original action is returned
      expect(result).toEqual({count: 1})
      expect(plugin.beforeStateChange).toHaveBeenCalledWith(action, testState, mockStore)
    })
  })
})
