import {describe, it, expect, beforeEach} from 'vitest'
import {createStore, StorageType, type Store} from '../../src/core'
import {
  createUpdatePathInitialState,
  type UpdatePathTestState,
} from './core-testing-utils/update-path-test-utils'

describe('updatePath - advanced usage with store param', () => {
  let store: Store<UpdatePathTestState>
  let updatePath: Store<UpdatePathTestState>['updatePath']

  beforeEach(() => {
    store = createStore<UpdatePathTestState>(createUpdatePathInitialState(), {
      name: 'StoreParamAdvanced',
      storageType: StorageType.None,
      historyLimit: 50,
    })
    updatePath = store.updatePath
  })

  it('exposes full root store typing at callsite and runtime', () => {
    // Use the store param to read a distant branch and decide the new value
    updatePath(['user', 'profile', 'name'], (current, s) => {
      expect(typeof current).toBe('string')
      // Should be able to access any root branch safely
      const theme = s.getState().user.profile.settings.theme
      expect(['light', 'dark', 'auto']).toContain(theme)
      return theme === 'dark' ? `${current} (night)` : `${current} (day)`
    })

    const newName = store.getState().user.profile.name
    expect(newName.endsWith('(night)') || newName.endsWith('(day)')).toBe(true)
  })

  it('can compute cross-path updates based on store state', () => {
    // Flip privacy setting based on whether notifications.push is enabled
    updatePath(['user', 'profile', 'settings', 'privacy', 'dataSharing'], (current, s) => {
      const push = s.getState().user.profile.settings.notifications.push
      return push ? true : current
    })

    const privacy = store.getState().user.profile.settings.privacy
    expect(typeof privacy.dataSharing).toBe('boolean')
    // initial push is false in test utils, so value should stay unchanged (false)
    expect(privacy.dataSharing).toBe(false)

    // Turn on push and verify the cross-path computation reacts
    updatePath(['user', 'profile', 'settings', 'notifications', 'push'], true)
    updatePath(['user', 'profile', 'settings', 'privacy', 'dataSharing'], (current, s) => {
      const push = s.getState().user.profile.settings.notifications.push
      return push ? true : current
    })
    expect(store.getState().user.profile.settings.privacy.dataSharing).toBe(true)
  })

  it('inside a batch, later updaters see earlier batched changes via store.getState()', () => {
    const initialNumber = store.getState().primitives.numberValue
    const initialString = store.getState().primitives.stringValue

    store.batch(() => {
      updatePath(['primitives', 'numberValue'], n => n + 1)
      updatePath(['primitives', 'stringValue'], (s, st) => {
        // Should observe the incremented number (batched virtual state)
        expect(st.getState().primitives.numberValue).toBe(initialNumber + 1)
        return `${s}#${st.getState().primitives.numberValue}`
      })
    })

    const after = store.getState().primitives
    expect(after.numberValue).toBe(initialNumber + 1)
    expect(after.stringValue).toBe(`${initialString}#${initialNumber + 1}`)
  })

  it('can define and use selectors inside the updater for derived reads', () => {
    updatePath(['primitives', 'stringValue'], (curr, s) => {
      const selectUserEmail = s.select(state => state.user.profile.email)
      const email = selectUserEmail()
      expect(email).toMatch(/@example.com$/)
      return `${curr} <${email}>`
    })

    expect(store.getState().primitives.stringValue).toMatch(/<.*@example\.com>$/)
  })

  it('can conditionally delete by returning undefined based on store state', () => {
    // metadata starts defined in initial state
    expect(store.getState().user.profile.metadata).toBeDefined()

    // initial loginCount is 157; first pass should keep metadata
    updatePath(['user', 'profile', 'metadata'], (meta, s) => {
      const logins = s.getState().user.profile.metadata?.loginCount ?? 0
      return logins > 1 ? meta : undefined
    })
    expect(store.getState().user.profile.metadata).toBeDefined()

    // drop loginCount to 0 and verify deletion occurs
    updatePath(['user', 'profile', 'metadata', 'loginCount'], 0)
    updatePath(['user', 'profile', 'metadata'], (meta, s) => {
      const logins = s.getState().user.profile.metadata?.loginCount ?? 0
      return logins > 1 ? meta : undefined
    })
    expect(store.getState().user.profile.metadata).toBeUndefined()
  })

  it('works with Maps/Sets by computing new structures using store reads', () => {
    const prevMap = store.getState().dataStructures.userMap
    updatePath(['dataStructures', 'userMap'], (map, s) => {
      const next = new Map(map)
      const userName = s.getState().user.profile.name
      next.set('computed', {name: userName, age: 99, active: true})
      return next
    })
    const newMap = store.getState().dataStructures.userMap
    expect(newMap).not.toBe(prevMap)
    expect(newMap.get('computed')?.name).toBe(store.getState().user.profile.name)
  })
})
