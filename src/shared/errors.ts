export class StoreError extends Error {
  constructor(
    message: string,
    public context?: any
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

export class ValidationError extends StoreError {}
export class PersistenceError extends StoreError {}
export class SyncError extends StoreError {}
export class MiddlewareError extends StoreError {}
export class TransactionError extends StoreError {}

/**
 * Context information for error handling
 */
export interface ErrorContext {
  operation: string
  pluginName?: string
  actionPayload?: any
  additionalInfo?: Record<string, any>
}

/**
 * Storage operation error with context
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public operation: string,
    public key?: string,
    public originalError?: unknown
  ) {
    super(message)
    this.name = 'StorageError'
  }
}
