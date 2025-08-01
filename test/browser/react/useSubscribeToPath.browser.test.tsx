/// <reference types="@vitest/browser/matchers" />
/// <reference types="@testing-library/jest-dom" />

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {cleanup, waitFor} from '@testing-library/react'
import {userEvent} from '@vitest/browser/context'
import {render} from 'vitest-browser-react'
import React from 'react'
import {createStore} from '../../../src/core'
import {createStoreContext} from '../../../src/react'

const cardStyle: React.CSSProperties = {
  padding: '16px',
  borderRadius: '8px',
  backgroundColor: '#fff',
  marginBottom: '16px',
  border: '1px solid #ddd',
}

describe('useSubscribeToPath React Hook', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(() => {
    cleanup()
  })

  it('should call listener on path change (basic string path)', async () => {
    interface State {
      user: {name: string; age: number}
    }
    const store = createStore<State>({user: {name: 'Alice', age: 20}})
    const {StoreProvider, useSubscribeToPath, useDispatch, useStoreValue} =
      createStoreContext(store)
    const listener = vi.fn()

    function ListenerComponent() {
      useSubscribeToPath(['user', 'name'], listener, {immediate: true})
      return null
    }
    function UpdateComponent() {
      const dispatch = useDispatch()
      return (
        <button data-testid="update" onClick={() => dispatch({user: {name: 'Bob', age: 21}})}>
          Update
        </button>
      )
    }
    function Display() {
      const name = useStoreValue<string>('user.name')
      return <span data-testid="name">{name}</span>
    }

    const screen = render(
      <StoreProvider>
        <ListenerComponent />
        <UpdateComponent />
        <Display />
      </StoreProvider>
    )

    // Immediate call on mount
    expect(listener).toBeCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('Alice', 'Alice')
    await userEvent.click(screen.getByTestId('update'))
    await waitFor(() => {
      expect(screen.getByTestId('name')).toHaveTextContent('Bob')
    })
    // Listener should be called again with new and old value
    expect(listener).toHaveBeenCalledWith('Bob', 'Alice')
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('should support array path and react to deep changes', async () => {
    interface State {
      todos: Array<{id: number; text: string; completed: boolean}>
    }
    const store = createStore<State>({
      todos: [
        {id: 1, text: 'A', completed: false},
        {id: 2, text: 'B', completed: false},
      ],
    })
    const {StoreProvider, useSubscribeToPath, useDispatch, useStoreValue} =
      createStoreContext(store)
    const listener = vi.fn()

    function ListenerComponent() {
      useSubscribeToPath(['todos', 1, 'completed'], listener)
      return null
    }
    function UpdateComponent() {
      const dispatch = useDispatch()
      return (
        <button
          data-testid="complete"
          onClick={() =>
            dispatch({
              todos: [
                {id: 1, text: 'A', completed: false},
                {id: 2, text: 'B', completed: true},
              ],
            })
          }>
          Complete
        </button>
      )
    }
    function Display() {
      const completed = useStoreValue<boolean>('todos.1.completed')
      return <span data-testid="completed">{String(completed)}</span>
    }

    const screen = render(
      <StoreProvider>
        <ListenerComponent />
        <UpdateComponent />
        <Display />
      </StoreProvider>
    )

    expect(screen.getByTestId('completed')).toHaveTextContent('false')
    await userEvent.click(screen.getByTestId('complete'))
    await waitFor(() => {
      expect(screen.getByTestId('completed')).toHaveTextContent('true')
    })
    expect(listener).toHaveBeenCalledWith(true, false)
  })

  it('should unsubscribe on unmount', async () => {
    interface State {
      value: number
    }
    const store = createStore<State>({value: 1})
    const {StoreProvider, useSubscribeToPath, useDispatch} = createStoreContext(store)
    const listener = vi.fn()

    function ListenerComponent() {
      useSubscribeToPath(['value'], listener)
      return null
    }
    function UpdateComponent() {
      const dispatch = useDispatch()
      return (
        <button
          data-testid="inc-unmount"
          onClick={() => dispatch({value: store.getState().value + 1})}>
          Inc
        </button>
      )
    }

    function Parent() {
      const [show, setShow] = React.useState(true)
      return (
        <StoreProvider>
          {show && <ListenerComponent />}
          <UpdateComponent />
          <button data-testid="toggle-unmount" onClick={() => setShow(s => !s)}>
            Toggle
          </button>
        </StoreProvider>
      )
    }

    const screen = render(<Parent />)
    await userEvent.click(screen.getByTestId('inc-unmount'))
    expect(listener).toHaveBeenCalledWith(2, 1)
    // Unmount listener by toggling
    await userEvent.click(screen.getByTestId('toggle-unmount'))
    await userEvent.click(screen.getByTestId('inc-unmount'))
    // Listener should not be called again
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('should support multiple listeners on the same path', async () => {
    interface State {
      count: number
    }
    const store = createStore<State>({count: 0})
    const {StoreProvider, useSubscribeToPath, useDispatch} = createStoreContext(store)
    const listenerA = vi.fn()
    const listenerB = vi.fn()

    function ListenerA() {
      useSubscribeToPath('count', listenerA)
      return null
    }
    function ListenerB() {
      useSubscribeToPath('count', listenerB)
      return null
    }
    function UpdateComponent() {
      const dispatch = useDispatch()
      return (
        <button
          data-testid="inc-multi-listener"
          onClick={() => dispatch({count: store.getState().count + 1})}>
          Inc
        </button>
      )
    }

    const screen = render(
      <StoreProvider>
        <ListenerA />
        <ListenerB />
        <UpdateComponent />
      </StoreProvider>
    )

    await userEvent.click(screen.getByTestId('inc-multi-listener'))
    expect(listenerA).toHaveBeenCalledWith(1, 0)
    expect(listenerB).toHaveBeenCalledWith(1, 0)
  })

  it('should work with immediate option', async () => {
    interface State {
      foo: string
    }
    const store = createStore<State>({foo: 'bar'})
    const {StoreProvider, useSubscribeToPath} = createStoreContext(store)
    const listener = vi.fn()

    function ListenerComponent() {
      useSubscribeToPath('foo', listener, {immediate: true})
      return null
    }

    render(
      <StoreProvider>
        <ListenerComponent />
      </StoreProvider>
    )
    expect(listener).toHaveBeenCalledWith('bar', 'bar')
  })

  it('should work with dynamic paths and react to changes', async () => {
    interface State {
      settings: Record<string, {enabled: boolean}>
    }
    const store = createStore<State>({
      settings: {
        featureA: {enabled: false},
        featureB: {enabled: true},
      },
    })
    const {StoreProvider, useSubscribeToPath, useDispatch, useStoreValue} =
      createStoreContext(store)
    const listener = vi.fn()
    function ListenerComponent({feature}: {feature: string}) {
      useSubscribeToPath(['settings', feature, 'enabled'], listener)
      return null
    }
    function UpdateComponent() {
      const dispatch = useDispatch()
      return (
        <button
          data-testid="toggle"
          onClick={() =>
            dispatch({
              settings: {
                featureA: {enabled: true},
                featureB: {enabled: false},
              },
            })
          }>
          Toggle
        </button>
      )
    }
    function Display({feature}: {feature: string}) {
      const enabled = useStoreValue<boolean>(`settings.${feature}.enabled`)
      return <span data-testid="enabled">{String(enabled)}</span>
    }

    const screen = render(
      <StoreProvider>
        <ListenerComponent feature="featureA" />
        <UpdateComponent />
        <Display feature="featureA" />
      </StoreProvider>
    )

    expect(screen.getByTestId('enabled')).toHaveTextContent('false')
    await userEvent.click(screen.getByTestId('toggle'))
    await waitFor(() => {
      expect(screen.getByTestId('enabled')).toHaveTextContent('true')
    })
    expect(listener).toHaveBeenCalledWith(true, false)
  })

  it('should not call listener if value does not change', async () => {
    interface State {
      value: number
    }
    const store = createStore<State>({value: 1})
    const {StoreProvider, useSubscribeToPath, useDispatch} = createStoreContext(store)
    const listener = vi.fn()

    function ListenerComponent() {
      useSubscribeToPath('value', listener)
      return null
    }
    function UpdateComponent() {
      const dispatch = useDispatch()
      return (
        <button data-testid="noop" onClick={() => dispatch({value: 1})}>
          Noop
        </button>
      )
    }

    const screen = render(
      <StoreProvider>
        <ListenerComponent />
        <UpdateComponent />
      </StoreProvider>
    )

    await userEvent.click(screen.getByTestId('noop'))
    expect(listener).not.toHaveBeenCalled()
  })

  it('should work with multiple StoreProviders (React compatibility)', async () => {
    interface State {
      value: string
    }
    const store1 = createStore<State>({value: 'A'})
    const store2 = createStore<State>({value: 'B'})
    const ctx1 = createStoreContext(store1)
    const ctx2 = createStoreContext(store2)
    const listener1 = vi.fn()
    const listener2 = vi.fn()

    function Listener1() {
      ctx1.useSubscribeToPath('value', listener1)
      return null
    }
    function Listener2() {
      ctx2.useSubscribeToPath('value', listener2)
      return null
    }
    function Update1() {
      const dispatch = ctx1.useDispatch()
      return (
        <button data-testid="inc1" onClick={() => dispatch({value: 'A1'})}>
          Inc1
        </button>
      )
    }
    function Update2() {
      const dispatch = ctx2.useDispatch()
      return (
        <button data-testid="inc2" onClick={() => dispatch({value: 'B1'})}>
          Inc2
        </button>
      )
    }

    const screen = render(
      <div>
        <ctx1.StoreProvider>
          <Listener1 />
          <Update1 />
        </ctx1.StoreProvider>
        <ctx2.StoreProvider>
          <Listener2 />
          <Update2 />
        </ctx2.StoreProvider>
      </div>
    )

    await userEvent.click(screen.getByTestId('inc1'))
    expect(listener1).toHaveBeenCalledWith('A1', 'A')
    expect(listener2).not.toHaveBeenCalled()
    await userEvent.click(screen.getByTestId('inc2'))
    expect(listener2).toHaveBeenCalledWith('B1', 'B')
  })

  it('should support cleanup and not leak listeners', async () => {
    interface State {
      value: number
    }
    const store = createStore<State>({value: 0})
    const {StoreProvider, useSubscribeToPath, useDispatch} = createStoreContext(store)
    const listener = vi.fn()

    function ListenerComponent() {
      useSubscribeToPath('value', listener)
      return null
    }
    function UpdateComponent() {
      const dispatch = useDispatch()
      return (
        <button
          data-testid="inc-cleanup"
          onClick={() => dispatch({value: store.getState().value + 1})}>
          Inc
        </button>
      )
    }
    function Parent() {
      const [show, setShow] = React.useState(true)
      return (
        <StoreProvider>
          {show && <ListenerComponent />}
          <UpdateComponent />
          <button data-testid="toggle-cleanup" onClick={() => setShow(s => !s)}>
            Toggle
          </button>
        </StoreProvider>
      )
    }

    const screen = render(<Parent />)
    await userEvent.click(screen.getByTestId('inc-cleanup'))
    expect(listener).toHaveBeenCalledWith(1, 0)
    await userEvent.click(screen.getByTestId('toggle-cleanup'))
    await userEvent.click(screen.getByTestId('inc-cleanup'))
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
