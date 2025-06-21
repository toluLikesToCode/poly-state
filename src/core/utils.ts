import * as storage from "./storage";
import {
  ActionPayload,
  Middleware,
  ValidationError,
  PersistedState,
} from "./types";

// --- Helper for immutable path updates ---
export function getPath<T, V = any>(
  obj: T,
  path: (string | number)[]
): V | undefined {
  let current: any = obj;
  for (const key of path) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }

    // Handle Map objects
    if (current instanceof Map) {
      // Try the key as-is first, then try converting string to number or vice versa
      if (current.has(key)) {
        current = current.get(key);
      } else if (typeof key === "string" && !isNaN(Number(key))) {
        // Try converting string to number for Map access
        const numKey = Number(key);
        if (current.has(numKey)) {
          current = current.get(numKey);
        } else {
          return undefined;
        }
      } else if (typeof key === "number") {
        // Try converting number to string for Map access
        const strKey = String(key);
        if (current.has(strKey)) {
          current = current.get(strKey);
        } else {
          return undefined;
        }
      } else {
        return undefined;
      }
    } else {
      // Handle regular objects and arrays
      if (!(key in current)) {
        return undefined;
      }
      current = current[key];
    }
  }
  return current as V;
}

export function setPath<T extends object, V = any>(
  obj: T,
  path: (string | number)[],
  value: V
): T {
  if (path.length === 0) {
    return value as any; // Should not happen if used correctly, or T is V
  }

  const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
  let current: any = newObj;

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const nextKeyIsNumber = typeof path[i + 1] === "number";
    if (current[key] === null || typeof current[key] !== "object") {
      current[key] = nextKeyIsNumber ? [] : {};
    } else {
      current[key] = Array.isArray(current[key])
        ? [...current[key]]
        : { ...current[key] };
    }
    current = current[key];
  }

  current[path[path.length - 1]] = value;
  return newObj as T;
}

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

/**
 * Performs a deep equality comparison between two values of any JavaScript type.
 *
 * @typeParam T - The type of the values being compared.
 * @param a - The first value to compare.
 * @param b - The second value to compare.
 * @returns `true` if the two inputs are deeply equal, `false` otherwise.
 *
 * @remarks
 * This function handles all JavaScript data types including objects, arrays,
 * primitive values, dates, regular expressions, maps, sets, typed arrays,
 * and more. It also properly handles circular references.
 *
 * @example
 * ```typescript
 * deepEqual({ a: [1, 2, { b: 3 }] }, { a: [1, 2, { b: 3 }] }); // true
 * deepEqual(new Date(2023, 0, 1), new Date(2023, 0, 1)); // true
 * deepEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])); // true
 * ```
 */
export function deepEqual<T>(a: T, b: T): boolean {
  // WeakMap to track already compared object pairs and avoid circular references
  const seen = new WeakMap<object, object>();

  function isEqual(x: any, y: any): boolean {
    // Fast reference or primitive check
    if (x === y) return true;

    // Handle null / undefined
    if (x == null || y == null) return x === y;

    // Type check - must be the same type
    if (typeof x !== typeof y) return false;

    // Handle primitive types that aren't caught by === (like NaN)
    if (typeof x !== "object" && typeof x !== "function") {
      // Special case for NaN
      if (Number.isNaN(x) && Number.isNaN(y)) return true;
      // Otherwise primitives must be strictly equal
      return x === y;
    }

    // Handle Date objects
    if (x instanceof Date && y instanceof Date) {
      return x.getTime() === y.getTime();
    }

    // Handle RegExp
    if (x instanceof RegExp && y instanceof RegExp) {
      return x.source === y.source && x.flags === y.flags;
    }

    // Handle Error objects
    if (x instanceof Error && y instanceof Error) {
      return (
        x.name === y.name &&
        x.message === y.message &&
        isEqual(x.stack, y.stack)
      );
    }

    // Avoid revisiting the same pair to handle circular references
    if (seen.get(x) === y) {
      return true;
    }
    seen.set(x, y);

    // Handle ArrayBuffer
    if (x instanceof ArrayBuffer && y instanceof ArrayBuffer) {
      if (x.byteLength !== y.byteLength) return false;
      const viewX = new Uint8Array(x);
      const viewY = new Uint8Array(y);
      for (let i = 0; i < viewX.length; i++) {
        if (viewX[i] !== viewY[i]) return false;
      }
      return true;
    }

    // Handle TypedArrays (Int8Array, Uint8Array, etc.)
    if (
      ArrayBuffer.isView(x) &&
      ArrayBuffer.isView(y) &&
      !(x instanceof DataView) &&
      !(y instanceof DataView)
    ) {
      if (x.byteLength !== y.byteLength) return false;
      const typedX = x as any;
      const typedY = y as any;
      for (let i = 0; i < x.byteLength; i++) {
        if (typedX[i] !== typedY[i]) return false;
      }
      return true;
    }

    // Handle DataView
    if (x instanceof DataView && y instanceof DataView) {
      if (x.byteLength !== y.byteLength) return false;
      for (let i = 0; i < x.byteLength; i++) {
        if (x.getUint8(i) !== y.getUint8(i)) return false;
      }
      return true;
    }

    // Handle Map
    if (x instanceof Map && y instanceof Map) {
      if (x.size !== y.size) return false;
      for (const [key, valX] of x.entries()) {
        // For object keys, we need to search for an equivalent key
        if (typeof key === "object" && key !== null) {
          let found = false;
          for (const [keyY] of y.entries()) {
            if (isEqual(key, keyY)) {
              found = isEqual(valX, y.get(keyY));
              if (found) break;
            }
          }
          if (!found) return false;
        } else {
          // For primitive keys, we can directly check
          if (!y.has(key) || !isEqual(valX, y.get(key))) {
            return false;
          }
        }
      }
      return true;
    }

    // Handle Set
    if (x instanceof Set && y instanceof Set) {
      if (x.size !== y.size) return false;

      // Convert sets to arrays for easier comparison
      const arrX = Array.from(x);
      const arrY = Array.from(y);

      // For each item in x, find it in y
      for (const itemX of arrX) {
        const found = arrY.some((itemY) => isEqual(itemX, itemY));
        if (!found) return false;
      }
      return true;
    }

    // Handle DOM nodes (if in a browser environment)
    if (typeof window !== "undefined" && window.Node) {
      if (x instanceof Node && y instanceof Node) {
        return x.isEqualNode(y);
      }
    }

    // Handle boxed primitives
    if (
      (x instanceof String && y instanceof String) ||
      (x instanceof Number && y instanceof Number) ||
      (x instanceof Boolean && y instanceof Boolean)
    ) {
      return x.valueOf() === y.valueOf();
    }

    // Handle Array
    if (Array.isArray(x) && Array.isArray(y)) {
      if (x.length !== y.length) return false;
      for (let i = 0; i < x.length; i++) {
        if (!isEqual(x[i], y[i])) return false;
      }
      return true;
    }

    // Handle plain objects (including class instances)
    const protoX = Object.getPrototypeOf(x);
    const protoY = Object.getPrototypeOf(y);

    // If the prototypes don't match, they're different types
    if (protoX !== protoY) {
      return false;
    }

    const keysX = Object.keys(x);
    const keysY = Object.keys(y);

    if (keysX.length !== keysY.length) {
      return false;
    }

    // Check property symbols too
    const symbolsX = Object.getOwnPropertySymbols(x);
    const symbolsY = Object.getOwnPropertySymbols(y);

    if (symbolsX.length !== symbolsY.length) {
      return false;
    }

    // Check all string keys
    for (const key of keysX) {
      if (!Object.prototype.hasOwnProperty.call(y, key)) {
        return false;
      }
      if (!isEqual(x[key], y[key])) {
        return false;
      }
    }

    // Check all symbol keys
    for (const sym of symbolsX) {
      if (!Object.prototype.hasOwnProperty.call(y, sym)) {
        return false;
      }
      if (!isEqual(x[sym], y[sym])) {
        return false;
      }
    }

    return true;
  }

  return isEqual(a, b);
}

/**
 * Performs a deep clone of an object, preserving its structure and values.
 *
 * @typeParam S - The type of the object being cloned.
 * @param obj - The object to clone.
 * @returns A new object that is a deep copy of the input.
 *
 * @remarks
 * This function uses structured cloning techniques to ensure that all nested objects,
 * arrays, and primitive values are copied correctly without references to the original.
 * It handles circular references and complex types like Date, Map, Set, etc.
 *
 * @example
 * ```typescript
 * const original = { a: 1, b: { c: 2 } };
 * const clone = deepClone(original);
 * console.log(clone); // { a: 1, b: { c: 2 } }
 * ```
 */
export function deepClone<S extends object>(obj: S): S {
  const seen = new WeakMap();

  function clone<T>(value: T): T {
    // Handle primitives and functions
    if (value === null || typeof value !== "object") {
      return value;
    }

    // Handle circular references
    if (seen.has(value)) {
      return seen.get(value);
    }

    // Handle Date
    if (value instanceof Date) {
      return new Date(value.getTime()) as any;
    }

    // Handle RegExp
    if (value instanceof RegExp) {
      return new RegExp(value.source, value.flags) as any;
    }

    // Handle Map
    if (value instanceof Map) {
      const result = new Map();
      seen.set(value, result);
      value.forEach((v, k) => {
        result.set(clone(k), clone(v));
      });
      return result as any;
    }

    // Handle Set
    if (value instanceof Set) {
      const result = new Set();
      seen.set(value, result);
      value.forEach((v) => {
        result.add(clone(v));
      });
      return result as any;
    }

    // Handle Array
    if (Array.isArray(value)) {
      const result: any[] = [];
      seen.set(value, result);
      for (let i = 0; i < value.length; i++) {
        result[i] = clone(value[i]);
      }
      return result as any;
    }

    // Handle plain objects (including class instances)
    const proto = Object.getPrototypeOf(value);
    const result = Object.create(proto);
    seen.set(value, result);
    for (const key of Object.keys(value)) {
      result[key] = clone((value as any)[key]);
    }
    return result;
  }

  return clone(obj);
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

export function isDevMode() {
  const isDevMode: boolean = storage.getLocalStorage(
    "APP_CLIENT_DEV_MODE",
    true
  );
  return isDevMode;
}
