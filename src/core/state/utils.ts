import { ValidationError } from "../../shared/errors";
import * as storage from "../storage/index";
import { ActionPayload, Middleware, PersistedState } from "./index";
/**
 * Clean up stale persisted states across all storage types
 */
export function cleanupStaleStates(
  maxAge: number = 30 * 24 * 60 * 60 * 1000,
  cookiePrefix: string = "__store_" // Default prefix
): {
  local: number;
  session: number;
  cookie: number;
} {
  const now = Date.now();
  const result = { local: 0, session: 0, cookie: 0 };
  const handleError = (e: any, type: string, key: string) => {
    // In a real app, this might use a global error logger
    console.warn("Error cleaning stale state", type, key, e);
  };

  // Clean localStorage
  if (storage.isLocalStorageAvailable()) {
    /* iterate backwards so index shifts don’t skip keys */
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key) {
        try {
          const item = storage.getLocalStorage<PersistedState<any>>(
            key,
            {} as PersistedState<any>
          );
          if (item && item.meta && now - item.meta.lastUpdated > maxAge) {
            storage.removeLocalStorage(key);
            result.local++;
          }
        } catch (e) {
          handleError(e, "localStorage", key);
        }
      }
    }
  }

  // Clean sessionStorage
  if (storage.isSessionStorageAvailable()) {
    /* iterate backwards so index shifts don’t skip keys */
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key) {
        try {
          const rawData = sessionStorage.getItem(key);
          if (rawData) {
            const item = JSON.parse(rawData) as PersistedState<any>;
            if (item && item.meta && now - item.meta.lastUpdated > maxAge) {
              sessionStorage.removeItem(key);
              result.session++;
            }
          }
        } catch (e) {
          handleError(e, "sessionStorage", key);
        }
      }
    }
  }

  // Clean cookies using prefix
  if (typeof document !== "undefined" && document.cookie) {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [namePart] = cookie.split("=");
      const name = namePart.trim();
      if (name.startsWith(cookiePrefix)) {
        try {
          const cookieValue = storage.getCookie(name);
          if (cookieValue) {
            const item = JSON.parse(cookieValue) as PersistedState<any>;
            if (item && item.meta && now - item.meta.lastUpdated > maxAge) {
              storage.removeCookie(name); // Assuming removeCookie uses appropriate path/domain or this cookie was set with defaults
              result.cookie++;
            }
          }
        } catch (e) {
          handleError(e, "cookie", name);
        }
      }
    }
  }
  return result;
}

// --- Built-in Middleware Creators (createLoggerMiddleware, createValidatorMiddleware) ---
export function createLoggerMiddleware<S extends object>(
  logger: (...args: any[]) => void = console.log
): Middleware<S> {
  return (action, prevState, dispatchNext, getState) => {
    logger("State Update: ", {
      action,
      prevState: { ...prevState }, // Log copy
      nextPotentialState: { ...prevState, ...action }, // What it would be if applied directly
    });
    dispatchNext(action); // Pass the action to the next middleware or applyState
    logger("State Update Applied. New state:", { ...getState() });
  };
}

export function createValidatorMiddleware<S extends object>(
  validator: (
    state: S,
    action: ActionPayload<S>,
    prevState: S
  ) => boolean | Promise<boolean>, // Validator can be async
  validationErrorHandler?: (
    error: ValidationError,
    action: ActionPayload<S>
  ) => void
): Middleware<S> {
  return (action, prevState, dispatchNext, getState) => {
    const tempNextState = { ...prevState, ...action };

    try {
      const validationResult = validator(tempNextState, action, prevState);

      // Handle synchronous validator
      if (typeof validationResult === "boolean") {
        if (validationResult) {
          dispatchNext(action);
        } else {
          const validationError = new ValidationError(
            "State validation failed",
            {
              action,
              stateAttempted: tempNextState,
            }
          );
          if (validationErrorHandler)
            validationErrorHandler(validationError, action);
          else console.error(validationError.message, validationError.context);
        }
        return;
      }

      // Handle asynchronous validator
      if (validationResult && typeof validationResult.then === "function") {
        return validationResult
          .then((isValid: boolean) => {
            if (isValid) {
              dispatchNext(action);
            } else {
              const validationError = new ValidationError(
                "State validation failed",
                {
                  action,
                  stateAttempted: tempNextState,
                }
              );
              if (validationErrorHandler)
                validationErrorHandler(validationError, action);
              else
                console.error(validationError.message, validationError.context);
            }
          })
          .catch((e: any) => {
            const validationError = new ValidationError(
              e.message || "State validation threw an error",
              { error: e, action, stateAttempted: tempNextState }
            );
            if (validationErrorHandler)
              validationErrorHandler(validationError, action);
            else
              console.error(validationError.message, validationError.context);
          });
      }
    } catch (e: any) {
      const validationError = new ValidationError(
        e.message || "State validation threw an error",
        { error: e, action, stateAttempted: tempNextState }
      );
      if (validationErrorHandler)
        validationErrorHandler(validationError, action);
      else console.error(validationError.message, validationError.context);
    }
  };
}
