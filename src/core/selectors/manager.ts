import {
  DependencySubscription,
  ISelectorManager,
  MemoizedSelector,
  DependencyListener,
  DependencySubscriptionOptions,
  Selector,
} from "./types";
import { getPath } from "../utils/index";
import { StoreError } from "../../shared/errors";
import type { Store } from "../state/index";
import * as utils from "./utils";

export class SelectorManager<S extends object> implements ISelectorManager<S> {
  private storeInstance: Store<S> = {} as Store<S>;
  private selectorCache = new WeakMap<
    Function,
    WeakMap<any, MemoizedSelector<any>>
  >();
  private activeSelectors = new Set<MemoizedSelector<any>>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private dependencySubscriptions = new Set<DependencySubscription<any>>();

  private readonly CLEANUP_INTERVAL = 1 * 1000;
  private readonly INACTIVE_THRESHOLD = 2 * 60 * 1000;

  constructor(store: Store<S>) {
    this.storeInstance = store;
  }

  private ensureCleanupRunning() {
    if (this.cleanupInterval || this.activeSelectors.size === 0) return;

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const toRemove: MemoizedSelector<any>[] = [];

      this.activeSelectors.forEach(selector => {
        if (
          selector._lastAccessed &&
          now - selector._lastAccessed > this.INACTIVE_THRESHOLD
        ) {
          toRemove.push(selector);
        }
      });

      toRemove.forEach(selector => {
        this.cleanupSelector(selector);
      });

      if (this.activeSelectors.size === 0 && this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
    }, this.CLEANUP_INTERVAL);
  }

  private cleanupSelector(selector: MemoizedSelector<any>) {
    if (selector._cleanup) {
      selector._cleanup();
    }
    selector._isActive = false;
    this.activeSelectors.delete(selector);
    // Clear props cache if it exists
    const parameterizedSelector = selector as any;
    if (parameterizedSelector._propsCache) {
      parameterizedSelector._propsCache.clear();
    }
  }

  createSelector<R, P extends Selector<S, any>[]>(
    ...args:
      | [
          ...P,
          (
            ...results: {
              [K in keyof P]: P[K] extends Selector<S, infer RT> ? RT : never;
            }
          ) => R
        ]
      | [Selector<S, R>]
  ): () => R {
    const cacheKey = args.length === 1 ? args[0] : args[args.length - 1];

    let selectorMap = this.selectorCache.get(cacheKey);
    if (!selectorMap) {
      selectorMap = new WeakMap();
      this.selectorCache.set(cacheKey, selectorMap);
    }

    const secondaryKey =
      args.length === 1 ? this.storeInstance : args.slice(0, -1);

    const cached = selectorMap.get(secondaryKey);
    if (cached && cached._isActive) {
      cached._lastAccessed = Date.now();
      return cached;
    }

    let memoizedSelector: MemoizedSelector<R>;

    if (args.length === 1 && typeof args[0] === "function") {
      memoizedSelector = this.createSingleSelector(args[0] as Selector<S, R>);
    } else {
      memoizedSelector = this.createMultiSelector(
        args.slice(0, -1) as P,
        args[args.length - 1] as (...results: any[]) => R
      );
    }

    memoizedSelector._lastAccessed = Date.now();
    memoizedSelector._isActive = true;

    selectorMap.set(secondaryKey, memoizedSelector);
    this.activeSelectors.add(memoizedSelector);
    this.ensureCleanupRunning();

    return memoizedSelector;
  }

  private createSingleSelector<R>(
    selectorFn: Selector<S, R>
  ): MemoizedSelector<R> {
    let cachedResult: R | undefined;
    let cachedState: S | undefined;
    let isInitialized = false;
    let unsubscribe: (() => void) | null = null;

    const memoizedSelector = (() => {
      memoizedSelector._lastAccessed = Date.now();

      const currentState = this.storeInstance.getState();

      // Fast path: if state reference hasn't changed (Immer structural sharing)
      if (isInitialized && Object.is(currentState, cachedState)) {
        memoizedSelector.lastValue = cachedResult as R;
        return memoizedSelector.lastValue;
      }

      // Recompute when state reference has changed or not initialized
      const newResult = selectorFn(currentState);

      // Update cache
      cachedResult = newResult;
      cachedState = currentState;
      isInitialized = true;

      memoizedSelector.lastValue = newResult;
      return newResult;
    }) as MemoizedSelector<R>;

    memoizedSelector._cleanup = () => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };

    return memoizedSelector;
  }

  private createMultiSelector<R, P extends Selector<S, any>[]>(
    inputSelectors: P,
    projector: (...results: any[]) => R
  ): MemoizedSelector<R> {
    let cachedInputResults: any[] | undefined;
    let cachedResult: R | undefined;
    let cachedState: S | undefined;
    let isInitialized = false;
    let unsubscribe: (() => void) | null = null;

    const ensureSubscribed = () => {
      if (!unsubscribe) {
        unsubscribe = this.storeInstance.subscribe(() => {
          // Reset cached state on any store change
          cachedState = undefined;
        });
      }
    };

    const memoizedSelector = (() => {
      ensureSubscribed();
      memoizedSelector._lastAccessed = Date.now();

      const currentState = this.storeInstance.getState();

      // Fast path: if state reference hasn't changed (Immer structural sharing)
      if (isInitialized && Object.is(currentState, cachedState)) {
        memoizedSelector.lastValue = cachedResult as R;
        return memoizedSelector.lastValue;
      }

      // Compute current input results
      const currentInputResults = inputSelectors.map(sel => sel(currentState));

      // Check if inputs have changed using enhanced equality
      const inputsChanged = utils.haveInputsChanged(
        cachedInputResults,
        currentInputResults
      );

      if (inputsChanged || !isInitialized) {
        // Recompute the result
        cachedResult = projector(...currentInputResults);
        cachedInputResults = currentInputResults;
      }

      // Always update state cache for reference comparison
      cachedState = currentState;
      isInitialized = true;

      memoizedSelector.lastValue = cachedResult as R;
      return memoizedSelector.lastValue;
    }) as MemoizedSelector<R>;

    memoizedSelector._cleanup = () => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };

    return memoizedSelector;
  }

  createParameterizedSelector<Props, R, P extends Selector<S, any>[]>(
    inputSelectors: readonly [...P],
    projector: (params: Props) => (
      ...results: {
        [K in keyof P]: P[K] extends Selector<S, infer RT> ? RT : never;
      }
    ) => R
  ): (params: Props) => (() => R) & { lastValue?: R } {
    // Enhanced cache with TTL-based cleanup for better memory management
    const parameterCache = new Map<
      string,
      {
        selector: MemoizedSelector<R>;
        lastAccessed: number;
        params: Props;
      }
    >();

    // Cleanup configuration
    let cleanupStopper: (() => void) | null = null;
    const CLEANUP_INTERVAL = 30 * 1000; // 30 seconds
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    // Use extracted utility for parameter serialization
    const { serializeParams } = utils;

    // Use extracted utility for TTL cache cleanup
    const ensureCleanupRunning = () => {
      if (!cleanupStopper) {
        cleanupStopper = utils.startTTLCacheCleanup(
          parameterCache,
          CACHE_TTL,
          (key, entry) => {
            if (entry.selector._cleanup) entry.selector._cleanup();
          }
        );
      }
    };

    return (params: Props) => {
      const paramsKey = serializeParams(params);
      const now = Date.now();

      // Check if we already have a selector for these parameters
      let cacheEntry = parameterCache.get(paramsKey);

      if (!cacheEntry || !cacheEntry.selector._isActive) {
        // Create a new selector for these specific parameters
        const combinerFn = projector(params);
        const memoizedSelector = this.createMultiSelectorWithCombiner(
          inputSelectors,
          combinerFn
        );

        // Store the original cleanup function
        const originalCleanup = memoizedSelector._cleanup;

        // Enhanced cleanup that also removes from parameter cache
        memoizedSelector._cleanup = () => {
          if (originalCleanup) {
            originalCleanup();
          }
          parameterCache.delete(paramsKey);
          if (parameterCache.size === 0 && cleanupStopper) {
            cleanupStopper();
            cleanupStopper = null;
          }
        };

        cacheEntry = {
          selector: memoizedSelector,
          lastAccessed: now,
          params: params,
        };

        parameterCache.set(paramsKey, cacheEntry);
        this.activeSelectors.add(memoizedSelector);
        this.ensureCleanupRunning();
        ensureCleanupRunning();
      }

      // Update access time for TTL-based cleanup
      cacheEntry.lastAccessed = now;
      cacheEntry.selector._lastAccessed = now;

      return cacheEntry.selector;
    };
  }

  private createMultiSelectorWithCombiner<R, P extends Selector<S, any>[]>(
    inputSelectors: readonly [...P],
    combiner: (...results: any[]) => R
  ): MemoizedSelector<R> {
    let cachedInputResults: any[] | undefined;
    let cachedResult: R | undefined;
    let cachedState: S | undefined;
    let isInitialized = false;
    let unsubscribe: (() => void) | null = null;

    const ensureSubscribed = () => {
      if (!unsubscribe) {
        unsubscribe = this.storeInstance.subscribe(() => {
          // Reset cached state on any store change for lazy recomputation
          cachedState = undefined;
        });
      }
    };

    const memoizedSelector = (() => {
      ensureSubscribed();
      memoizedSelector._lastAccessed = Date.now();

      const currentState = this.storeInstance.getState();

      // Fast path: if state reference hasn't changed (Immer structural sharing)
      if (isInitialized && Object.is(currentState, cachedState)) {
        memoizedSelector.lastValue = cachedResult as R;
        return memoizedSelector.lastValue;
      }

      // Compute current input results
      const currentInputResults = inputSelectors.map(sel => sel(currentState));

      // Check if inputs have changed using enhanced equality detection
      const inputsChanged = utils.haveInputsChanged(
        cachedInputResults,
        currentInputResults
      );

      if (inputsChanged || !isInitialized) {
        // Recompute the result only when inputs actually changed
        cachedResult = combiner(...currentInputResults);
        cachedInputResults = currentInputResults;
      }

      // Always update state cache for reference comparison
      cachedState = currentState;
      isInitialized = true;

      memoizedSelector.lastValue = cachedResult as R;
      return memoizedSelector.lastValue;
    }) as MemoizedSelector<R>;

    memoizedSelector._cleanup = () => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };

    return memoizedSelector;
  }

  createDependencySubscription<T>(
    selector: Selector<S, T>,
    listener: DependencyListener<T>,
    options: DependencySubscriptionOptions = {}
  ): () => void {
    const {
      immediate = false,
      equalityFn = utils.smartEqual.bind(this), // Use enhanced equality by default
      debounceMs = 0,
    } = options;

    // Create a memoized selector for this subscription
    const memoizedSelector = this.createSingleSelector(selector);

    // Get initial value
    const initialValue = memoizedSelector();

    // Generate unique ID for this subscription
    const subscriptionId = `dep_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    const subscription: DependencySubscription<T> = {
      id: subscriptionId,
      selector: memoizedSelector,
      listener,
      equalityFn,
      debounceMs,
      lastValue: initialValue,
      isActive: true,
      storeUnsubscribe: null,
      cleanup: () => {}, // Will be set below
    };

    // Create the change detection logic
    const checkForChanges = () => {
      if (!subscription.isActive) return;

      try {
        const currentValue = subscription.selector();

        // Use the enhanced equality function for better change detection
        const hasChanged = !subscription.equalityFn(
          subscription.lastValue as T,
          currentValue
        );

        if (hasChanged) {
          const oldValue = subscription.lastValue as T;

          if (subscription.debounceMs > 0) {
            // Clear existing timeout
            if (subscription.debounceTimeoutId) {
              clearTimeout(subscription.debounceTimeoutId);
            }

            // Set new debounced timeout
            subscription.debounceTimeoutId = setTimeout(() => {
              if (subscription.isActive) {
                try {
                  subscription.lastValue = currentValue;
                  subscription.listener(currentValue, oldValue);
                } catch (error: any) {
                  throw new StoreError("Dependency listener execution failed", {
                    operation: "dependencyListener",
                    error,
                    subscriptionId: subscription.id,
                  });
                }
              }
            }, subscription.debounceMs);
          } else {
            // Call immediately and update lastValue
            try {
              subscription.lastValue = currentValue;
              subscription.listener(currentValue, oldValue);
            } catch (error: any) {
              throw new StoreError("Dependency listener execution failed", {
                operation: "dependencyListener",
                error,
                subscriptionId: subscription.id,
              });
            }
          }
        }
      } catch (error: any) {
        throw new StoreError(
          "Dependency subscription change detection failed",
          {
            operation: "dependencyChangeDetection",
            error,
            subscriptionId: subscription.id,
          }
        );
      }
    };

    // Subscribe to store changes
    subscription.storeUnsubscribe = this.storeInstance.subscribe(() => {
      checkForChanges();
    });

    // Setup cleanup function
    subscription.cleanup = () => {
      subscription.isActive = false;

      // Clear debounce timeout
      if (subscription.debounceTimeoutId) {
        clearTimeout(subscription.debounceTimeoutId);
        subscription.debounceTimeoutId = undefined;
      }

      // Unsubscribe from store
      if (subscription.storeUnsubscribe) {
        subscription.storeUnsubscribe();
        subscription.storeUnsubscribe = null;
      }

      // Clean up the memoized selector
      if (subscription.selector._cleanup) {
        subscription.selector._cleanup();
      }

      // Remove from active subscriptions immediately
      this.dependencySubscriptions.delete(subscription);
    };

    // Add to active subscriptions
    this.dependencySubscriptions.add(subscription);

    // Call immediately if requested
    if (immediate) {
      try {
        subscription.listener(initialValue, initialValue);
      } catch (error: any) {
        throw new StoreError("Immediate dependency listener execution failed", {
          operation: "immediateDependencyListener",
          error,
          subscriptionId: subscription.id,
        });
      }
    }

    // Return unsubscribe function
    return subscription.cleanup;
  }

  createMultiDependencySubscription<P extends Selector<S, any>[]>(
    selectors: readonly [...P],
    listener: (
      newValues: {
        [K in keyof P]: P[K] extends Selector<S, infer RT> ? RT : never;
      },
      oldValues: {
        [K in keyof P]: P[K] extends Selector<S, infer RT> ? RT : never;
      }
    ) => void,
    options: DependencySubscriptionOptions = {}
  ): () => void {
    const {
      immediate = false,
      equalityFn = utils.smartEqual.bind(this),
      debounceMs = 0,
    } = options;

    // Create memoized selectors for each input
    const memoizedSelectors = selectors.map(sel =>
      this.createSingleSelector(sel)
    );

    // Get initial values
    const getValues = () => memoizedSelectors.map(sel => sel()) as any;
    let lastValues = getValues();

    let debounceTimeoutId: NodeJS.Timeout | undefined;

    // Generate unique ID for this subscription
    const subscriptionId = `multi_dep_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    // Create subscription object for tracking
    const subscription: DependencySubscription<any> = {
      id: subscriptionId,
      selector: () => getValues(), // Use a combined selector function
      listener: listener,
      equalityFn,
      debounceMs,
      lastValue: lastValues,
      isActive: true,
      storeUnsubscribe: null,
      cleanup: () => {}, // Will be set below
    };

    const checkForChanges = () => {
      if (!subscription.isActive) return;

      try {
        const currentValues = getValues();
        let hasAnyChange = false;

        // Check if any value changed
        for (let i = 0; i < currentValues.length; i++) {
          if (!equalityFn(lastValues[i], currentValues[i])) {
            hasAnyChange = true;
            break;
          }
        }

        if (hasAnyChange) {
          const oldValues = lastValues;

          if (debounceMs > 0) {
            // Clear existing timeout
            if (debounceTimeoutId) {
              clearTimeout(debounceTimeoutId);
            }

            // Set new debounced timeout
            debounceTimeoutId = setTimeout(() => {
              if (subscription.isActive) {
                try {
                  // Update lastValues only when the debounced listener is actually called
                  lastValues = currentValues;
                  listener(currentValues, oldValues);
                } catch (error: any) {
                  throw new StoreError(
                    "Multi-dependency listener execution failed",
                    {
                      operation: "multiDependencyListener",
                      error,
                      subscriptionId,
                    }
                  );
                }
              }
            }, debounceMs);
          } else {
            // Call immediately and update lastValues
            try {
              lastValues = currentValues;
              listener(currentValues, oldValues);
            } catch (error: any) {
              throw new StoreError(
                "Multi-dependency listener execution failed",
                {
                  operation: "multiDependencyListener",
                  error,
                  subscriptionId,
                }
              );
            }
          }
        }
      } catch (error: any) {
        throw new StoreError(
          "Multi-dependency subscription change detection failed",
          {
            operation: "multiDependencyChangeDetection",
            error,
            subscriptionId,
          }
        );
      }
    };

    // Subscribe to store changes
    subscription.storeUnsubscribe = this.storeInstance.subscribe(() => {
      checkForChanges();
    });

    // Setup cleanup function
    subscription.cleanup = () => {
      subscription.isActive = false;

      // Clear debounce timeout
      if (debounceTimeoutId) {
        clearTimeout(debounceTimeoutId);
        debounceTimeoutId = undefined;
      }

      // Unsubscribe from store
      if (subscription.storeUnsubscribe) {
        subscription.storeUnsubscribe();
        subscription.storeUnsubscribe = null;
      }

      // Clean up memoized selectors
      memoizedSelectors.forEach(sel => {
        if (sel._cleanup) {
          sel._cleanup();
        }
      });

      // Remove from active subscriptions immediately
      this.dependencySubscriptions.delete(subscription);
    };

    // Add to active subscriptions
    this.dependencySubscriptions.add(subscription);

    // Call immediately if requested
    if (immediate) {
      try {
        listener(lastValues, lastValues);
      } catch (error: any) {
        throw new StoreError(
          "Immediate multi-dependency listener execution failed",
          {
            operation: "immediateMultiDependencyListener",
            error,
            subscriptionId,
          }
        );
      }
    }

    return subscription.cleanup;
  }

  createPathSubscription<T = any>(
    path: string,
    listener: DependencyListener<T>,
    options: DependencySubscriptionOptions = {}
  ): () => void {
    // Convert path to selector
    const pathSelector: Selector<S, T> = state => {
      const pathArray = path.split(".");
      const result = getPath<S, T>(state, pathArray);
      return result as T; // Type assertion since we expect the path to exist
    };

    return this.createDependencySubscription(pathSelector, listener, options);
  }

  cleanupSelectors(): number {
    const now = Date.now();
    const toRemove: MemoizedSelector<any>[] = [];

    this.activeSelectors.forEach(selector => {
      if (selector._lastAccessed && now - selector._lastAccessed > 1000) {
        toRemove.push(selector);
      }
    });

    toRemove.forEach(selector => {
      this.cleanupSelector(selector);
    });

    return toRemove.length;
  }

  destroyAll() {
    // Clean up dependency subscriptions
    const subscriptionsToClean = Array.from(this.dependencySubscriptions);
    subscriptionsToClean.forEach(sub => {
      if (sub.cleanup) {
        sub.cleanup();
      }
    });
    this.dependencySubscriptions.clear();

    // Clean up regular selectors
    const toClean = Array.from(this.activeSelectors);
    toClean.forEach(selector => {
      this.cleanupSelector(selector);
    });

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  getDependencySubscriptionCount(): number {
    return this.dependencySubscriptions.size;
  }

  cleanupDependencySubscriptions(): number {
    const inactiveSubscriptions = Array.from(
      this.dependencySubscriptions
    ).filter(sub => !sub.isActive);

    // Remove inactive subscriptions from the Set
    inactiveSubscriptions.forEach(sub => {
      this.dependencySubscriptions.delete(sub);
    });

    return inactiveSubscriptions.length;
  }
}
