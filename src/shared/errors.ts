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

/**
 * More specific storage error types
 */
export class StorageUnavailableError extends StorageError {
  constructor(storageType: string, originalError?: unknown) {
    super(
      `Storage type '${storageType}' is not available`,
      'checkAvailability',
      'storage',
      originalError
    )
    this.name = 'StorageUnavailableError'
  }
}

export class StorageQuotaExceededError extends StorageError {
  constructor(key: string, size?: number, originalError?: unknown) {
    super(
      `Storage quota exceeded for key '${key}'${size ? ` (${size} bytes)` : ''}`,
      'setItem',
      key,
      originalError
    )
    this.name = 'StorageQuotaExceededError'
  }
}

export class StorageSerializationError extends StorageError {
  constructor(key: string, originalError?: unknown) {
    super(`Failed to serialize data for key '${key}'`, 'serialize', key, originalError)
    this.name = 'StorageSerializationError'
  }
}

export class StorageDeserializationError extends StorageError {
  constructor(key: string, originalError?: unknown) {
    super(`Failed to deserialize data for key '${key}'`, 'deserialize', key, originalError)
    this.name = 'StorageDeserializationError'
  }
}

/**
 * Enhanced error recovery utility
 */
export interface ErrorRecoveryOptions {
  maxRetries?: number
  retryDelay?: number
  fallbackValue?: any
  onRetry?: (attempt: number, error: Error) => void
}

export async function withErrorRecovery<T>(
  operation: () => T | Promise<T>,
  options: ErrorRecoveryOptions = {}
): Promise<T> {
  const {maxRetries = 3, retryDelay = 100, fallbackValue, onRetry} = options
  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        onRetry?.(attempt + 1, lastError)
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)))
      }
    }
  }

  if (fallbackValue !== undefined) {
    return fallbackValue
  }

  throw lastError!
}
