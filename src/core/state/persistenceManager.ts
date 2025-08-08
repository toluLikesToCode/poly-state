import {
  StorageType,
  PersistedState,
  CookieStorageOptions,
  StateMetadata,
  Store,
} from './state-types/types'
import {TypeRegistry} from './typeRegistry'
import {MiddlewareError, PersistenceError, StoreError, withErrorRecovery} from '../../shared/errors'
import {
  getLocalStorage,
  setLocalStorage,
  removeLocalStorage,
  getSessionStorage,
  setSessionStorage,
  removeSessionStorage,
  getCookie,
  setCookie,
  removeCookie,
  isLocalStorageAvailable,
  isSessionStorageAvailable,
  generateSessionId,
} from '../storage/index'
import {
  LocalStorageAdapter,
  SessionStorageAdapter,
  CookieStorageAdapter,
  type StorageAdapter,
} from '../storage/adapters'
import type {PluginManager} from '../../plugins/pluginManager'

/**
 * Manages state persistence across different storage types with unified adapter support
 */
export class PersistenceManager<S extends object> {
  private readonly storageType: StorageType
  private readonly typeRegistry: TypeRegistry
  private readonly cookieOptions: CookieStorageOptions
  private readonly cookiePrefix: string
  private readonly handleError: (error: StoreError) => void
  private readonly name: string
  private readonly sessionId: string
  private readonly adapter?: StorageAdapter<PersistedState<S>>

  constructor(
    storageType: StorageType,
    typeRegistry: TypeRegistry,
    handleError: (error: StoreError) => void,
    sessionId: string | null,
    cookieOptions?: CookieStorageOptions,
    cookiePrefix?: string,
    storeName?: string
  ) {
    this.storageType = storageType
    this.typeRegistry = typeRegistry
    this.handleError = handleError
    this.cookieOptions = cookieOptions || {}
    this.cookiePrefix = cookiePrefix || '__store_'
    this.name = storeName || 'PersistenceManager'
    if (!sessionId) {
      this.sessionId = generateSessionId()
    } else {
      this.sessionId = sessionId
    }

    // Optional: Initialize the appropriate adapter for unified interface
    // This allows gradual migration to the new adapter pattern
    try {
      switch (storageType) {
        case StorageType.Local:
          this.adapter = new LocalStorageAdapter()
          break
        case StorageType.Session:
          this.adapter = new SessionStorageAdapter()
          break
        case StorageType.Cookie:
          this.adapter = new CookieStorageAdapter(this.cookieOptions)
          break
        default:
          this.adapter = undefined
      }
    } catch (error) {
      // If adapter creation fails, fall back to existing implementation
      this.adapter = undefined
      console.warn('Failed to create storage adapter, using legacy implementation:', error)
    }
  }

  /**
   * Check if the configured storage type is available
   */
  public isStorageAvailable(): boolean {
    if (this.adapter) {
      return this.adapter.isAvailable()
    }

    // Fallback to existing implementation
    switch (this.storageType) {
      case StorageType.Local:
        return isLocalStorageAvailable()
      case StorageType.Session:
        return isSessionStorageAvailable()
      case StorageType.Cookie:
        return typeof document !== 'undefined'
      default:
        return true
    }
  }

  /**
   * Get the storage key with appropriate prefix
   */
  private getStorageKey(persistKey: string | undefined): string | null {
    if (!persistKey) return null
    return this.storageType === StorageType.Cookie
      ? `${this.cookiePrefix}${persistKey}`
      : persistKey
  }

  /**
   * Persist state to the configured storage
   */
  public persistState(
    persistKey: string | undefined,
    state: S,
    plugins: PluginManager<S>,
    store: Store<S>
  ): boolean {
    const storageKey = this.getStorageKey(persistKey)
    if (!storageKey || !this.isStorageAvailable()) return false

    try {
      const serializedData = this.typeRegistry.serialize(state)
      const meta: StateMetadata = {
        lastUpdated: Date.now(),
        sessionId: this.sessionId,
        storeName: this.name,
      }
      const persistedState: PersistedState<S> = {
        data: serializedData,
        meta: meta,
      }
      try {
        // Apply any plugin transformations
        const beforePersistedState = plugins.beforePersist(
          persistedState.data,
          this.storageType,
          store
        )
        if (beforePersistedState) {
          persistedState.data = beforePersistedState
        }
      } catch (e: any) {
        this.handleError(
          new MiddlewareError('Plugin error during beforePersist', {
            operation: 'beforePersist',
            error: e,
            key: storageKey,
            sessionId: this.sessionId,
          })
        )
      }
      switch (this.storageType) {
        case StorageType.Local:
          setLocalStorage(storageKey, persistedState)
          break
        case StorageType.Session:
          setSessionStorage(storageKey, persistedState)
          break
        case StorageType.Cookie:
          setCookie(storageKey, JSON.stringify(persistedState), this.cookieOptions)
          break
      }
      // Notify plugins after successful persistence
      try {
        plugins.onPersisted(persistedState.data, this.storageType, store)
      } catch (error) {
        this.handleError(
          new MiddlewareError('Plugin error during onPersisted', {
            operation: 'onPersisted',
            error: error,
            key: storageKey,
            sessionId: this.sessionId,
          })
        )
      }

      return true
    } catch (e: any) {
      this.handleError(
        new PersistenceError('Failed to persist state', {
          operation: 'persistState',
          error: e,
          key: storageKey,
          sessionId: this.sessionId,
        })
      )
      return false
    }
  }

  /**
   * Persist state with error recovery
   */
  public async persistStateWithRecovery(
    persistKey: string | undefined,
    state: S,
    plugins: PluginManager<S>,
    store: Store<S>
  ): Promise<boolean> {
    return withErrorRecovery(
      async () => {
        const storageKey = this.getStorageKey(persistKey)
        if (!storageKey || !this.isStorageAvailable()) return false

        try {
          const serializedData = this.typeRegistry.serialize(state)
          const meta: StateMetadata = {
            lastUpdated: Date.now(),
            sessionId: this.sessionId,
            storeName: this.name,
          }
          const persistedState: PersistedState<S> = {
            data: serializedData,
            meta: meta,
          }
          try {
            // Apply any plugin transformations
            const beforePersistedState = plugins.beforePersist(
              persistedState.data,
              this.storageType,
              store
            )
            if (beforePersistedState) {
              persistedState.data = beforePersistedState
            }
          } catch (e: any) {
            this.handleError(
              new MiddlewareError('Plugin error during beforePersist', {
                operation: 'beforePersist',
                error: e,
                key: storageKey,
                sessionId: this.sessionId,
              })
            )
          }
          if (this.adapter) {
            const success = await this.adapter.set(storageKey, persistedState)
            if (!success) {
              throw new StoreError('Failed to persist state using adapter', {
                adapter: this.adapter?.constructor?.name ?? 'UnknownAdapter',
              })
            }
          } else {
            switch (this.storageType) {
              case StorageType.Local:
                setLocalStorage(storageKey, persistedState)
                break
              case StorageType.Session:
                setSessionStorage(storageKey, persistedState)
                break
              case StorageType.Cookie:
                setCookie(storageKey, JSON.stringify(persistedState), this.cookieOptions)
                break
            }
          }
          // Notify plugins after successful persistence
          try {
            plugins.onPersisted(persistedState.data, this.storageType, store)
          } catch (error) {
            this.handleError(
              new MiddlewareError('Plugin error during onPersisted', {
                operation: 'onPersisted',
                error: error,
                key: storageKey,
                sessionId: this.sessionId,
              })
            )
          }

          return true
        } catch (e: any) {
          throw new PersistenceError('Failed to persist state', {
            operation: 'persistState',
            error: e,
            key: storageKey,
            sessionId: this.sessionId,
          })
        }
      },
      {
        maxRetries: 2,
        retryDelay: 50,
        fallbackValue: false,
        onRetry: (attempt, error) => {
          console.warn(`[PersistenceManager] Retry ${attempt} for persist operation:`)
          this.handleError(error)
        },
      }
    )
  }

  /**
   * Load state from the configured storage
   */
  public loadState(
    persistKey: string | undefined,
    staleAge: number,
    plugins: PluginManager<S>,
    store: Store<S>
  ): Partial<S> | null {
    const storageKey = this.getStorageKey(persistKey)
    if (!storageKey || !this.isStorageAvailable()) return null

    try {
      let wrappedState: PersistedState<S> | null = null

      switch (this.storageType) {
        case StorageType.Local:
          wrappedState = getLocalStorage<S>(storageKey)
          break
        case StorageType.Session:
          wrappedState = getSessionStorage<S>(storageKey)
          break
        case StorageType.Cookie:
          const cookieValue = getCookie(storageKey)
          if (cookieValue) wrappedState = JSON.parse(cookieValue)
          break
      }

      if (wrappedState && wrappedState.meta) {
        if (Date.now() - wrappedState.meta.lastUpdated > staleAge) {
          console.warn(`Discarding stale state for ${storageKey}`)
          this.removeState(persistKey)
          return null
        } else {
          const data = this.typeRegistry.deserialize(wrappedState.data) as Partial<S>
          // Notify plugins after loading state
          try {
            const loadedState = plugins.onStateLoaded(data, this.storageType, store)
            if (loadedState) {
              return loadedState
            } else {
              return data
            }
          } catch (e: any) {
            this.handleError(
              new MiddlewareError('Plugin error during onStateLoaded', {
                operation: 'onStateLoaded',
                error: e,
                key: storageKey,
                sessionId: this.sessionId,
              })
            )
          }
          return data
        }
      }

      return null
    } catch (e: any) {
      this.handleError(
        new PersistenceError('Failed to load persisted state', {
          operation: 'loadState',
          error: e,
          key: storageKey,
        })
      )
      return null
    }
  }

  /**
   * Load state with error recovery
   */
  public async loadStateAsync(
    persistKey: string | undefined,
    staleAge: number,
    plugins: PluginManager<S>,
    store: Store<S>
  ): Promise<Partial<S> | null> {
    return withErrorRecovery(
      async () => {
        const storageKey = this.getStorageKey(persistKey)
        if (!storageKey || !this.isStorageAvailable()) return null

        try {
          let wrappedState: PersistedState<S> | null = null
          if (this.adapter) {
            wrappedState = await this.adapter.get(storageKey)
          } else {
            switch (this.storageType) {
              case StorageType.Local:
                wrappedState = getLocalStorage<S>(storageKey)
                break
              case StorageType.Session:
                wrappedState = getSessionStorage<S>(storageKey)
                break
              case StorageType.Cookie:
                const cookieValue = getCookie(storageKey)
                if (cookieValue) wrappedState = JSON.parse(cookieValue)
                break
            }
          }

          if (wrappedState && wrappedState.meta) {
            if (Date.now() - wrappedState.meta.lastUpdated > staleAge) {
              console.warn(`Discarding stale state for ${storageKey}`)
              this.removeState(persistKey)
              return null
            } else {
              const data = this.typeRegistry.deserialize(wrappedState.data) as Partial<S>
              // Notify plugins after loading state
              try {
                const loadedState = plugins.onStateLoaded(data, this.storageType, store)
                if (loadedState) {
                  return loadedState
                } else {
                  return data
                }
              } catch (e: any) {
                this.handleError(
                  new MiddlewareError('Plugin error during onStateLoaded', {
                    operation: 'onStateLoaded',
                    error: e,
                    key: storageKey,
                    sessionId: this.sessionId,
                  })
                )
              }
              return data
            }
          }

          return null
        } catch (e: any) {
          throw new PersistenceError('Failed to load persisted state', {
            operation: 'loadState',
            error: {message: e.message || 'Unknown error', errObj: JSON.stringify(e)},
            key: storageKey,
          })
        }
      },
      {
        maxRetries: 2,
        retryDelay: 50,
        fallbackValue: null,
        onRetry: (attempt, error) => {
          console.warn(`[PersistenceManager] Retry ${attempt} for load operation:`)
          this.handleError(error)
        },
      }
    )
  }

  /**
   * Remove state from the configured storage
   */
  public removeState(persistKey: string | undefined): boolean {
    const storageKey = this.getStorageKey(persistKey)
    if (!storageKey || !this.isStorageAvailable()) return false

    try {
      switch (this.storageType) {
        case StorageType.Local:
          removeLocalStorage(storageKey)
          break
        case StorageType.Session:
          removeSessionStorage(storageKey)
          break
        case StorageType.Cookie:
          removeCookie(storageKey)
          break
      }
      return true
    } catch (e: any) {
      this.handleError(
        new PersistenceError('Failed to remove persisted state', {
          operation: 'removeState',
          error: e,
          key: storageKey,
        })
      )
      return false
    }
  }
}
