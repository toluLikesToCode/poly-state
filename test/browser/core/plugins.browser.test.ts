import {describe, it, expect, beforeEach} from 'vitest'
import {createStore} from '../../../src/core/state/createStore'
import {StorageType, type Plugin} from '../../../src/core/state/types'

describe('Plugin System Browser Tests', () => {
  beforeEach(() => {
    // Clear real storage before each test
    localStorage.clear()
    sessionStorage.clear()
  })

  it('should execute plugins with real storage operations', () => {
    const pluginCalls: string[] = []

    const testPlugin: Plugin<any> = {
      name: 'browser-test-plugin',
      beforePersist: (state, storageType, store) => {
        pluginCalls.push(`beforePersist-${storageType}`)
        return state
      },
      onPersisted: (state, storageType, store) => {
        pluginCalls.push(`onPersisted-${storageType}`)
      },
      onStateLoaded: (state, storageType, store) => {
        pluginCalls.push(`onStateLoaded-${storageType}`)
        return state
      },
    }

    const store = createStore(
      {test: 'value'},
      {
        persistKey: 'plugin-test',
        storageType: StorageType.Local,
        plugins: [testPlugin],
      }
    )

    // Trigger persistence
    store.dispatch({test: 'updated'})

    // Verify plugin hooks were called with real storage
    expect(pluginCalls).toContain(`beforePersist-${StorageType.Local}`)
    expect(pluginCalls).toContain(`onPersisted-${StorageType.Local}`)

    // Verify real localStorage was updated
    expect(localStorage.getItem('plugin-test')).toBeTruthy()
  })

  it('should handle plugin errors gracefully during real storage operations', () => {
    const errorPlugin: Plugin<any> = {
      name: 'error-plugin',
      beforePersist: () => {
        throw new Error('Plugin error during beforePersist')
      },
    }

    const store = createStore(
      {test: 'value'},
      {
        persistKey: 'error-plugin-test',
        storageType: StorageType.Local,
        plugins: [errorPlugin],
      }
    )

    // Should not throw even with plugin error
    expect(() => {
      store.dispatch({test: 'updated'})
    }).not.toThrow()

    // Storage should still work despite plugin error
    const stored = localStorage.getItem('error-plugin-test')
    expect(stored).toBeTruthy()
  })

  it('should handle cross-tab sync with plugins', async () => {
    const syncCalls: string[] = []

    const syncPlugin: Plugin<any> = {
      name: 'sync-plugin',
      onCrossTabSync: (state, fromSessionId, store) => {
        syncCalls.push(`onCrossTabSync-${fromSessionId}`)
        return state
      },
    }

    const store = createStore(
      {shared: 0},
      {
        persistKey: 'sync-plugin-test',
        storageType: StorageType.Local,
        syncAcrossTabs: true,
        plugins: [syncPlugin],
      }
    )

    // Simulate another tab updating storage
    const externalData = {
      data: {shared: 999},
      meta: {
        lastUpdated: Date.now(),
        sessionId: 'external-session',
        storeName: 'TestStore',
      },
    }
    localStorage.setItem('sync-plugin-test', JSON.stringify(externalData))

    // Trigger storage event
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'sync-plugin-test',
        newValue: localStorage.getItem('sync-plugin-test'),
        oldValue: null,
        storageArea: localStorage,
      })
    )

    // Wait for event processing
    await new Promise(resolve => setTimeout(resolve, 100))

    // Plugin should have been called
    expect(syncCalls).toContain('onCrossTabSync-external-session')
  })

  it('should handle state transformation in plugins with real storage', () => {
    const transformPlugin: Plugin<any> = {
      name: 'transform-plugin',
      beforePersist: state => {
        // Transform state before persistence
        return {...state, transformed: true}
      },
      onStateLoaded: state => {
        // Transform state after loading
        return {...state, loaded: true}
      },
    }

    // Create store and trigger persistence
    const store = createStore(
      {original: 'value'},
      {
        persistKey: 'transform-test',
        storageType: StorageType.Local,
        plugins: [transformPlugin],
      }
    )

    store.dispatch({original: 'updated'})

    // Check that transformed data was persisted
    const stored = localStorage.getItem('transform-test')
    expect(stored).toBeTruthy()

    const parsedData = JSON.parse(stored!)
    expect(parsedData.data).toMatchObject({
      original: 'updated',
      transformed: true,
    })

    // Create new store to test loading transformation
    const newStore = createStore(
      {original: 'initial'},
      {
        persistKey: 'transform-test',
        storageType: StorageType.Local,
        plugins: [transformPlugin],
      }
    )

    // Should have both transformed and loaded flags
    expect(newStore.getState()).toMatchObject({
      original: 'updated',
      transformed: true,
      loaded: true,
    })
  })
})
