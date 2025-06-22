import {
  ActionPayload,
  type Plugin,
  StorageType,
  Store,
  historyChangePluginOptions,
} from "../core/state/types";
import { ErrorContext, MiddlewareError, StoreError } from "../shared/errors";

/**
 * Plugin lifecycle manager to handle plugin hooks consistently
 */
export class PluginManager<S extends object> implements Plugin<S> {
  public name: string;
  private plugins: Plugin<S>[] = [];
  private handleError: (error: StoreError) => void;
  constructor(
    plugins: Plugin<S>[],
    handleError: (error: StoreError) => void,
    StoreName: string = "PluginManager"
  ) {
    this.name = StoreName;
    this.plugins = plugins;
    this.handleError = handleError;
  }

  /**
   * Safely execute a plugin hook for all plugins
   */
  private executeHook<T extends any[], R = void>(
    hookName: keyof Plugin<S>,
    args: T,
    options?: {
      continueOnError?: boolean;
      collectResults?: boolean;
      abortOnFalse?: boolean;
    }
  ): R[] | boolean {
    const results: R[] = [];
    const {
      continueOnError = true,
      collectResults = false,
      abortOnFalse = false,
    } = options || {};

    for (const plugin of this.plugins) {
      try {
        const hook = plugin[hookName] as any;
        if (hook && typeof hook === "function") {
          const result = hook(...args);

          if (abortOnFalse && result === false) {
            return false;
          }

          if (collectResults && result !== undefined) {
            results.push(result);
          }
        }
      } catch (e: any) {
        this.handleError(
          new MiddlewareError(
            `Plugin ${plugin.name}.${String(hookName)} failed`,
            {
              error: e,
              pluginName: plugin.name,
              operation: String(hookName),
            }
          )
        );

        if (!continueOnError) {
          throw e;
        }
      }
    }

    return collectResults ? results : true;
  }

  public onStoreCreate(store: Store<S>): void {
    this.executeHook("onStoreCreate", [store], { continueOnError: false });
  }

  public onDestroy(store: Store<S>): void {
    this.executeHook("onDestroy", [store]);
  }

  public onError(e: StoreError, c: ErrorContext, s: Store<S>): void {
    // Call plugin onError hooks without using executeHook to prevent infinite recursion
    for (const plugin of this.plugins) {
      try {
        if (plugin.onError && typeof plugin.onError === "function") {
          plugin.onError(e, c, s);
        }
      } catch (pErr: any) {
        // Log plugin onError failures directly without calling handleError to prevent infinite recursion
        console.error(`[PluginManager] Plugin ${plugin.name}.onError failed:`, {
          originalError: e.message,
          pluginError: pErr.message,
          pluginName: plugin.name,
        });
      }
    }
  }

  public beforeStateChange(
    action: ActionPayload<S>,
    prevState: S,
    store: Store<S>
  ): ActionPayload<S> | void {
    let currentAction = action;

    for (const plugin of this.plugins) {
      try {
        const hook = plugin.beforeStateChange;
        if (hook && typeof hook === "function") {
          const result = hook(currentAction, prevState, store);
          if (result !== undefined) {
            currentAction = result;
          }
        }
      } catch (e: any) {
        this.handleError(
          new MiddlewareError(
            `Plugin ${plugin.name}.beforeStateChange failed`,
            {
              error: e,
              pluginName: plugin.name,
              operation: "beforeStateChange",
            }
          )
        );
        // Continue with other plugins
      }
    }

    return currentAction;
  }

  public onStateChange(
    newState: S,
    prevState: S,
    action: ActionPayload<S> | null,
    store: Store<S>
  ): void {
    this.executeHook("onStateChange", [newState, prevState, action, store]);
  }

  public beforePersist(
    state: S,
    storageType: StorageType,
    store: Store<S>
  ): S | void {
    let currentState = state;

    for (const plugin of this.plugins) {
      try {
        const hook = plugin.beforePersist;
        if (hook && typeof hook === "function") {
          const result = hook(currentState, storageType, store);
          if (result !== undefined) {
            currentState = result;
          }
        }
      } catch (e: any) {
        this.handleError(
          new MiddlewareError(`Plugin ${plugin.name}.beforePersist failed`, {
            error: e,
            pluginName: plugin.name,
            operation: "beforePersist",
          })
        );
        // Continue with other plugins
      }
    }

    return currentState;
  }

  public onPersisted(
    state: S,
    storageType: StorageType,
    store: Store<S>
  ): void {
    this.executeHook("onPersisted", [state, storageType, store]);
  }

  public onStateLoaded(
    loadedState: Partial<S>,
    storageType: StorageType,
    store: Store<S>
  ): Partial<S> | void {
    let currentState = loadedState;

    for (const plugin of this.plugins) {
      try {
        const hook = plugin.onStateLoaded;
        if (hook && typeof hook === "function") {
          const result = hook(currentState, storageType, store);
          if (result !== undefined) {
            currentState = result;
          }
        }
      } catch (e: any) {
        this.handleError(
          new MiddlewareError(`Plugin ${plugin.name}.onStateLoaded failed`, {
            error: e,
            pluginName: plugin.name,
            operation: "onStateLoaded",
          })
        );
        // Continue with other plugins
      }
    }

    return currentState;
  }

  public onCrossTabSync(
    syncedState: S,
    sourceSessionId: string,
    store: Store<S>
  ): S | void {
    let currentState = syncedState;

    for (const plugin of this.plugins) {
      try {
        const hook = plugin.onCrossTabSync;
        if (hook && typeof hook === "function") {
          const result = hook(currentState, sourceSessionId, store);
          if (result !== undefined) {
            currentState = result;
          }
        }
      } catch (e: any) {
        this.handleError(
          new MiddlewareError(`Plugin ${plugin.name}.onCrossTabSync failed`, {
            error: e,
            pluginName: plugin.name,
            operation: "onCrossTabSync",
          })
        );
        // Continue with other plugins
      }
    }

    return currentState;
  }

  public beforeHistoryChange(
    options: historyChangePluginOptions<S>
  ): boolean | void {
    const result = this.executeHook("beforeHistoryChange", [options], {
      abortOnFalse: true,
    });
    return result !== false;
  }

  public onHistoryChanged(options: historyChangePluginOptions<S>): void {
    this.executeHook("onHistoryChanged", [options]);
  }

  public onBatchStart(store: Store<S>): void {
    this.executeHook("onBatchStart", [store]);
  }

  public onBatchEnd(
    actions: ActionPayload<S>[],
    finalState: S,
    store: Store<S>
  ): void {
    this.executeHook("onBatchEnd", [actions, finalState, store]);
  }

  public onTransactionStart(store: Store<S>): void {
    this.executeHook("onTransactionStart", [store]);
  }

  public onTransactionEnd(
    success: boolean,
    store: Store<S>,
    changes?: Partial<S>,
    error?: Error
  ): void {
    this.executeHook("onTransactionEnd", [success, store, changes, error]);
  }
}
