import {describe, it, expect, beforeEach} from 'vitest'
import {createStore, type Store} from '@tolulikestocode/poly-state'
import {A} from 'vitest/dist/chunks/environment.d.cL3nLXbE.js'

interface ActiveMediaData {
  mode: 'focus' | 'multiview'
  lastActivated: number
  index?: number
}
type ActiveMediaMap = Record<string, ActiveMediaData>

interface TestState {
  activeMediaMap: ActiveMediaMap
}

describe('ActiveMediaMap updatePath bug reproduction', () => {
  let store: Store<TestState>

  const initialState: TestState = {
    activeMediaMap: {
      'media-1': {mode: 'multiview', lastActivated: 1000},
      'media-2': {mode: 'multiview', lastActivated: 1001},
      'media-3': {mode: 'multiview', lastActivated: 1002},
    },
  }

  beforeEach(() => {
    store = createStore(initialState)
  })

  it('should reproduce the bug: updatePath only appends instead of replacing obsolete keys', () => {
    // Simulate the updater logic
    const visibleItems = ['media-2', 'media-4']
    const currentMode = 'multiview'
    const currentTimestamp = 2000

    store.updatePath(['activeMediaMap'], currentActiveMedia => {
      // Remove obsolete keys
      for (const key of Object.keys(currentActiveMedia)) {
        if (!visibleItems.includes(key)) {
          delete currentActiveMedia[key]
        }
      }
      // Add/update visible items
      for (const mediaId of visibleItems) {
        const existingEntry = currentActiveMedia[mediaId]
        const lastActivated = existingEntry?.lastActivated || currentTimestamp
        currentActiveMedia[mediaId] = {
          mode: currentMode as 'focus' | 'multiview',
          lastActivated,
        }
      }
      return currentActiveMedia
    })

    // The bug: old keys ("media-1", "media-3") are still present
    const result = store.getState().activeMediaMap
    expect(result).toHaveProperty('media-1') // Should NOT be present if replaced correctly
    expect(result).toHaveProperty('media-3') // Should NOT be present if replaced correctly
    expect(result).toHaveProperty('media-2') // Should be present
    expect(result).toHaveProperty('media-4') // Should be present

    // For demonstration, print the result
    // console.log(result);

    // The correct behavior: only visibleItems should be present
    // expect(Object.keys(result).sort()).toEqual(visibleItems.sort());
  })

  it.skip('should pass if updatePath truly modifies the object', () => {
    // The new value should modify the existing state
    const visibleItems = ['media-2', 'media-4']
    const currentMode = 'multiview'
    const currentTimestamp = 2000

    store.updatePath(['activeMediaMap'], currentActiveMedia => {
      // Remove obsolete keys
      for (const key of Object.keys(currentActiveMedia)) {
        if (!visibleItems.includes(key)) {
          delete currentActiveMedia[key]
        }
      }
      // Add/update visible items
      for (const mediaId of visibleItems) {
        const existingEntry = currentActiveMedia[mediaId]
        const lastActivated = existingEntry?.lastActivated || currentTimestamp
        currentActiveMedia[mediaId] = {
          mode: currentMode as 'focus' | 'multiview',
          lastActivated,
        }
      }
      return currentActiveMedia
    })

    // This should pass when the bug is fixed
    // The result should only contain the visible items

    const result = store.getState().activeMediaMap
    expect(Object.keys(result).sort()).toEqual(visibleItems.sort())
    expect(result).not.toHaveProperty('media-1')
    expect(result).not.toHaveProperty('media-3')
  })

  it('should work with a different data structure', () => {
    type ActiveMediaMap2 = [string, ActiveMediaData][]
    interface TestState2 {
      activeMediaMap: ActiveMediaMap2
    }
    let store2: Store<TestState2>
    const initialState2: TestState2 = {
      activeMediaMap: [
        ['media-1', {mode: 'multiview', lastActivated: 1000}],
        ['media-2', {mode: 'multiview', lastActivated: 1001}],
        ['media-3', {mode: 'multiview', lastActivated: 1002}],
      ],
    }
    store2 = createStore(initialState2)
    const visibleItems2 = ['media-2', 'media-4']
    const currentMode2 = 'multiview'
    const currentTimestamp2 = 2000
    store2.updatePath(['activeMediaMap'], currentActiveMedia => {
      // Remove obsolete keys
      for (const [key] of currentActiveMedia) {
        if (!visibleItems2.includes(key)) {
          const index = currentActiveMedia.findIndex(([k]) => k === key)
          if (index !== -1) {
            currentActiveMedia.splice(index, 1)
          }
        }
      }
      // Add/update visible items
      for (const mediaId of visibleItems2) {
        const existingEntry = currentActiveMedia.find(([k]) => k === mediaId)
        const lastActivated = existingEntry ? existingEntry[1].lastActivated : currentTimestamp2
        if (existingEntry) {
          existingEntry[1] = {
            mode: currentMode2 as 'focus' | 'multiview',
            lastActivated,
          }
        } else {
          currentActiveMedia.push([
            mediaId,
            {mode: currentMode2 as 'focus' | 'multiview', lastActivated},
          ])
        }
      }
      return currentActiveMedia
    })

    // The result should only contain the visible items
    const result2 = store2.getState().activeMediaMap
    const expectedResult2 = [
      ['media-2', {mode: 'multiview', lastActivated: 1001}],
      ['media-4', {mode: 'multiview', lastActivated: currentTimestamp2}],
    ]
    expect(result2).toEqual(expect.arrayContaining(expectedResult2))
    expect(result2.length).toBe(2)
    expect(result2.some(([key]) => key === 'media-1')).toBe(false)
    expect(result2.some(([key]) => key === 'media-3')).toBe(false)
  })
})
