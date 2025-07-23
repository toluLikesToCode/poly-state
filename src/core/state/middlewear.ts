import {StoreError, MiddlewareError} from '../../shared'
import {ActionPayload, Middleware} from './types/types'

/**
 * Middleware chain executor
 */
export class MiddlewareExecutor<S extends object> {
  constructor(
    private middleware: Middleware<S>[],
    private handleError: (error: StoreError) => void
  ) {}

  /**
   * Execute middleware chain
   */
  async execute(
    action: ActionPayload<S>,
    prevState: S,
    getState: () => S,
    onComplete: (action: ActionPayload<S>, fromSync?: boolean) => void,
    reset: () => void
  ): Promise<void> {
    if (this.middleware.length === 0) {
      onComplete(action, false)
      return
    }

    let middlewareIndex = 0

    const nextMiddleware = async (currentPayload: ActionPayload<S>) => {
      if (middlewareIndex < this.middleware.length) {
        const currentMiddleware = this.middleware[middlewareIndex++]
        try {
          const result = currentMiddleware(
            currentPayload,
            prevState,
            nextMiddleware,
            getState,
            reset
          )
          // If the middleware returns a promise, await it
          if (result && typeof result.then === 'function') {
            await result
          }
        } catch (e: any) {
          this.handleError(
            new MiddlewareError('Middleware execution failed', {
              operation: 'middlewareExecution',
              error: e,
              middlewareName: currentMiddleware.name || 'anonymous',
            })
          )
        }
      } else {
        // Middleware chain complete
        onComplete(currentPayload, false)
      }
    }

    await nextMiddleware(action)
  }
}
