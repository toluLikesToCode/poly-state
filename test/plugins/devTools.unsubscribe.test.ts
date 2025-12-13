import {describe, it, expect, vi, afterEach, beforeEach} from 'vitest'
import {createSimpleDevToolsPlugin} from '../../src/plugins/devTools'
import type {Store} from '../../src/core/state/state-types/types'

describe('SimpleDevToolsPlugin teardown', () => {
  const originalWindow = globalThis.window
  let unsubscribe: ReturnType<typeof vi.fn>
  let mockStore: Store<{count: number}>

  beforeEach(() => {
    unsubscribe = vi.fn()

    // Minimal store implementation for plugin hooks
    mockStore = {
      getState: vi.fn(() => ({count: 0})),
      _setStateForDevTools: vi.fn(),
    } as unknown as Store<{count: number}>

    // Mock Redux DevTools extension API
    const connect = vi.fn(() => ({
      init: vi.fn(),
      subscribe: vi.fn(() => unsubscribe),
      send: vi.fn(),
    }))

    globalThis.window = {
      __REDUX_DEVTOOLS_EXTENSION__: {connect},
    } as unknown as Window & typeof globalThis
  })

  afterEach(() => {
    globalThis.window = originalWindow
    vi.restoreAllMocks()
  })

  it('unsubscribes from DevTools messages on destroy', () => {
    const plugin = createSimpleDevToolsPlugin<{count: number}>({name: 'TestStore'})

    plugin.onStoreCreate?.(mockStore)
    plugin.onDestroy?.(mockStore)

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
