import type {ValidationError} from '../../../shared/errors'
import type {ActionPayload} from './types'

/**
 * Function that intercepts and potentially modifies state updates
 * @typeParam S - The type of the state
 */
export type Middleware<S extends object> = (
  action: ActionPayload<S>,
  prevState: S,
  dispatch: (action: ActionPayload<S>) => void,
  getState: () => S,
  reset: () => void
) => void | Promise<void>

/**
 * Interface for the validator function used in createValidatorMiddleware.
 *
 * @template S - The type of the state object
 * @param state - The proposed next state after applying the action
 * @param action - The action being applied
 * @param prevState - The previous state before the action
 * @returns True if the state is valid, false otherwise, or a Promise resolving to a boolean
 *
 * @example
 * ```typescript
 * const validator: ValidatorFn<AppState> = (state, action, prevState) => {
 *   return state.count >= 0;
 * };
 * ```
 */
export interface ValidatorFn<S extends object> {
  (state: S, action: ActionPayload<S>, prevState: S): boolean | Promise<boolean>
}

/**
 * Interface for the validation error handler used in createValidatorMiddleware.
 *
 * @template S - The type of the state object
 * @param error - The ValidationError instance
 * @param action - The action that caused the validation error
 *
 * @example
 * ```typescript
 * const errorHandler: ValidationErrorHandler<AppState> = (error, action) => {
 *   console.error(error.message, action);
 * };
 * ```
 */
export interface ValidationErrorHandler<S extends object> {
  (error: ValidationError, action: ActionPayload<S>): void
}
