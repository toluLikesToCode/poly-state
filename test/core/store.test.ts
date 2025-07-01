import {describe, it, expect, beforeEach} from 'vitest'
import {createStore, type Store} from '../../src/core'

describe('Store Core Functionality', () => {
  let store: Store<{count: number; name: string}>

  beforeEach(() => {
    store = createStore({
      count: 0,
      name: 'test',
    })
  })

  it('should create a store with initial state', () => {
    expect(store.getState()).toEqual({
      count: 0,
      name: 'test',
    })
  })

  it('should update state with dispatch', () => {
    store.dispatch({count: 1})
    expect(store.getState().count).toBe(1)
    expect(store.getState().name).toBe('test')
  })

  it('should subscribe to state changes', () => {
    let callCount = 0
    let lastState: any = null

    const unsubscribe = store.subscribe(state => {
      callCount++
      lastState = state
    })

    store.dispatch({count: 5})

    expect(callCount).toBe(1)
    expect(lastState).toEqual({
      count: 5,
      name: 'test',
    })

    unsubscribe()
  })

  it('should not notify subscribers after unsubscribe', () => {
    let callCount = 0

    const unsubscribe = store.subscribe(() => {
      callCount++
    })

    store.dispatch({count: 1})
    expect(callCount).toBe(1)

    unsubscribe()
    store.dispatch({count: 2})
    expect(callCount).toBe(1) // Should still be 1
  })

  it('should work with thunk-based state updates', () => {
    store.dispatch(({dispatch, getState}) => {
      const currentState = getState()
      dispatch({
        count: currentState.count + 10,
      })
    })

    expect(store.getState().count).toBe(10)
  })
})
