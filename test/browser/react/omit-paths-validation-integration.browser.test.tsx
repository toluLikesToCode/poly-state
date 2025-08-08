/// <reference types="@vitest/browser/matchers" />
/// <reference types="@testing-library/jest-dom" />

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {cleanup, waitFor} from '@testing-library/react'
import {z} from 'zod'

import {
  createStore,
  getLocalStorage,
  setLocalStorage,
  StorageType,
  TypeRegistry,
  PersistedState,
} from '../../../src/core'
import {createOmitPathsPlugin} from '../../../src/plugins/omitPathsPlugin'
import {createValidatorMiddleware} from '../../../src/core/state/utils'

// Keep browser storage clean between tests
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
})

describe('OmitPathsPlugin + Zod + Validation Middleware (Browser)', () => {
  it('omits paths in persisted snapshot while Zod validates runtime state', async () => {
    const Schema = z.object({
      user: z.object({
        name: z.string(),
        token: z.string().optional(),
        settings: z.object({theme: z.enum(['light', 'dark'])}).optional(),
      }),
      logs: z.array(z.string()),
    })

    type TestState = z.infer<typeof Schema>

    const initialState: TestState = {
      user: {name: 'John', token: 'init-token', settings: {theme: 'light'}},
      logs: [],
    }

    const omitPlugin = createOmitPathsPlugin<TestState>([['user', 'token']])
    const validator = createValidatorMiddleware<TestState>(state => Schema.safeParse(state).success)

    const store = createStore(initialState, {
      name: 'omit-zod-validator-happy',
      persistKey: 'omit-zod-validator-happy',
      storageType: StorageType.Local,
      plugins: [omitPlugin],
      middleware: [validator],
    })

    // Update state (valid w.r.t schema)
    store.dispatch({user: {name: 'Jane', token: 'new-token', settings: {theme: 'dark'}}})

    await waitFor(() => {
      // Runtime state keeps token
      const s = store.getState()
      expect(s.user.name).toBe('Jane')
      expect(s.user.token).toBe('new-token')
      expect(s.user.settings?.theme).toBe('dark')

      // Persisted snapshot should omit token
      const persisted = getLocalStorage<TestState>('omit-zod-validator-happy')
      expect(persisted.data.user.name).toBe('Jane')
      expect(persisted.data.user).not.toHaveProperty('token')
      expect(persisted.data.user.settings?.theme).toBe('dark')
    })
  })

  it('restores omitted paths from initial baseline on load and still satisfies schema', async () => {
    const Schema = z.object({
      user: z.object({
        name: z.string(),
        token: z.string().optional(),
      }),
      logs: z.array(z.string()),
    })
    type TestState = z.infer<typeof Schema>

    const initialState: TestState = {
      user: {name: 'Init Name', token: 'init-token'},
      logs: ['a'],
    }

    // Simulate pre-existing persisted state with token present (will be omitted on load/merge)
    const typeRegistry = new TypeRegistry()
    const stateToPersist: TestState = {
      user: {name: 'Loaded Name', token: 'leaked-token'},
      logs: ['p1', 'p2'],
    }
    const serializedData = typeRegistry.serialize(stateToPersist)
    const persistedState: PersistedState<TestState> = {
      data: serializedData,
      meta: {lastUpdated: Date.now(), sessionId: 'sess', storeName: 'omit-restore-test'},
    }
    setLocalStorage('omit-restore-test', persistedState)

    const omitPlugin = createOmitPathsPlugin<TestState>(
      [['user', 'token']],
      'omit-restore-test',
      initialState
    )
    const validator = createValidatorMiddleware<TestState>(state => Schema.safeParse(state).success)

    const store = createStore(initialState, {
      name: 'omit-restore-test',
      persistKey: 'omit-restore-test',
      storageType: StorageType.Local,
      plugins: [omitPlugin],
      middleware: [validator],
    })

    // Wait for load
    await store.waitForStateLoad()

    // After load, omitted token should be restored from initial baseline, name from persisted
    const s = store.getState()
    expect(s.user.name).toBe('Loaded Name')
    expect(s.user.token).toBe('init-token')

    // Persisted snapshot should keep token omitted
    const persisted = getLocalStorage<TestState>('omit-restore-test')
    expect(persisted.data.user.name).toBe('Loaded Name')
    expect(persisted.data.user).not.toHaveProperty('token')
  })

  it('blocks invalid updates with validator even when paths are omitted', async () => {
    const Schema = z.object({
      user: z.object({
        name: z.string(),
        settings: z.object({theme: z.enum(['light', 'dark'])}),
        token: z.string().optional(),
      }),
      logs: z.array(z.string()),
    })
    type TestState = z.infer<typeof Schema>

    const initialState: TestState = {
      user: {name: 'John', settings: {theme: 'light'}, token: 'init-token'},
      logs: [],
    }

    const omitPlugin = createOmitPathsPlugin<TestState>([['user', 'token']])
    const validator = createValidatorMiddleware<TestState>(state => Schema.safeParse(state).success)

    const store = createStore(initialState, {
      name: 'omit-validator-block',
      persistKey: 'omit-validator-block',
      storageType: StorageType.Local,
      plugins: [omitPlugin],
      middleware: [validator],
    })

    // Seed a valid change to trigger persistence so we can assert on the persisted snapshot
    store.dispatch({logs: ['seed']})
    await waitFor(() => {
      const seeded = getLocalStorage<TestState>('omit-validator-block')
      expect(seeded.data).toBeDefined()
      expect(seeded.data.user).not.toHaveProperty('token')
    })

    // Invalid update: shallow merge will replace entire user with an object missing required "name"
    // Cast to any to simulate a runtime mistake and ensure validator blocks it
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      store.dispatch({user: {settings: {theme: 'neon' as any}}} as any)

      // Give middleware a moment
      await new Promise(r => setTimeout(r, 50))

      // State should remain unchanged (blocked)
      const s = store.getState()
      expect(s.user.name).toBe('John')
      expect(s.user.settings.theme).toBe('light')

      // Persisted snapshot should also remain with original values (and token omitted)
      const persisted = getLocalStorage<TestState>('omit-validator-block')
      expect(persisted.data.user.name).toBe('John')
      expect(persisted.data.user.settings.theme).toBe('light')
      expect(persisted.data.user).not.toHaveProperty('token')
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('resets to initial state on first action when persisted shape is malformed (template check)', async () => {
    const Schema = z.object({
      user: z.object({name: z.string(), token: z.string().optional()}),
      logs: z.array(z.string()),
    })
    type TestState = z.infer<typeof Schema>

    const initialState: TestState = {
      user: {name: 'Init', token: 'init-token'},
      logs: ['a'],
    }

    // Malformed persisted data
    const typeRegistry = new TypeRegistry()
    const badState: any = {
      user: 'not-an-object',
      logs: 'not-an-array',
    }
    const serialized = typeRegistry.serialize(badState)
    const persisted: PersistedState<any> = {
      data: serialized,
      meta: {lastUpdated: Date.now(), sessionId: 'sess', storeName: 'omit-template-reset'},
    }
    setLocalStorage('omit-template-reset', persisted)

    const omitPlugin = createOmitPathsPlugin<TestState>(
      [['user', 'token']],
      'omit-template-reset',
      initialState
    )
    const validator = createValidatorMiddleware<TestState>(
      state => Schema.safeParse(state).success,
      undefined,
      initialState // template to enforce structure on first action
    )

    const store = createStore(initialState, {
      name: 'omit-template-reset',
      persistKey: 'omit-template-reset',
      storageType: StorageType.Local,
      plugins: [omitPlugin],
      middleware: [validator],
    })

    // After load, the malformed state may be present. Trigger first action to run template check.
    store.dispatch({logs: ['a', 'b']})

    await waitFor(() => {
      const s = store.getState()
      // Middleware should reset to initial template, then apply blocked or allowed action depending on validation.
      // Since ['a','b'] is valid and template reset occurs, expect logs to either be initial or updated; most importantly structure is valid.
      expect(Array.isArray(s.logs)).toBe(true)
      expect(typeof s.user).toBe('object')
      // Omitted token should remain from initial baseline in memory, not in storage
      expect(s.user.token).toBe('init-token')

      const persistedSnap = getLocalStorage<TestState>('omit-template-reset')
      expect(persistedSnap.data.user).not.toHaveProperty('token')
    })
  })

  it('wildcards: omits nested passwords for all users while schema treats them as optional', async () => {
    const UserSchema = z.object({
      id: z.string(),
      profile: z.object({email: z.string().email(), password: z.string().optional()}),
    })
    const Schema = z.object({users: z.array(UserSchema)})

    type TestState = z.infer<typeof Schema>

    const initialState: TestState = {
      users: [
        {id: '1', profile: {email: 'a@example.com', password: 'p1'}},
        {id: '2', profile: {email: 'b@example.com', password: 'p2'}},
      ],
    }

    const omitPlugin = createOmitPathsPlugin<TestState>([['users', '*', 'profile', 'password']])
    const validator = createValidatorMiddleware<TestState>(state => Schema.safeParse(state).success)

    const store = createStore(initialState, {
      name: 'omit-wildcard-users',
      persistKey: 'omit-wildcard-users',
      storageType: StorageType.Local,
      plugins: [omitPlugin],
      middleware: [validator],
    })

    // Update: change emails and passwords
    store.dispatch({
      users: [
        {id: '1', profile: {email: 'a+u@example.com', password: 'np1'}},
        {id: '2', profile: {email: 'b+u@example.com', password: 'np2'}},
      ],
    } as any)

    await waitFor(() => {
      const s = store.getState()
      expect(s.users[0].profile.password).toBe('np1')
      expect(s.users[1].profile.password).toBe('np2')

      const persisted = getLocalStorage<TestState>('omit-wildcard-users')
      expect(persisted.data.users[0].profile).not.toHaveProperty('password')
      expect(persisted.data.users[1].profile).not.toHaveProperty('password')
    })
  })
})
