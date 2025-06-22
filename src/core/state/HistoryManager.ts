import { PluginManager } from "../../plugins/pluginManager";
import { historyChangePluginOptions } from "./types";

/**
 * Manages undo/redo history for state changes.
 */
export class HistoryManager<S extends object> {
  private _initialState: S | null = null;
  private history: S[] = [];
  private historyIndex = -1;
  private isHistoryMutation = false;
  private pluginManager: PluginManager<S>;

  constructor(
    private historyLimit: number,
    pluginManager: PluginManager<S>,
    initialState?: S
  ) {
    this.pluginManager = pluginManager;

    // Keep the initial state separate
    if (initialState) {
      this._initialState = { ...initialState };
    }
  }

  /**
   * Add a new state to history
   */
  addToHistory(newState: S): void {
    if (this.historyLimit > 0 && !this.isHistoryMutation) {
      // If first time, skip storing initial in array
      if (this._initialState && this.history.length === 0) {
        // Just to confirm we start fresh
        this.historyIndex = -1;
      }

      // cut off any “future” states if we’re mid-undo
      if (
        this.historyIndex >= 0 &&
        this.historyIndex < this.history.length - 1
      ) {
        this.history = this.history.slice(0, this.historyIndex + 1);
      }

      this.history.push({ ...newState });
      this.historyIndex = this.history.length - 1;
      this.applyTrimRule();
    }
  }

  /**
   * Perform undo operation
   */
  undo(options: historyChangePluginOptions<S>): S | false {
    if (!this.canUndo(options.steps)) return false;
    const { persistFn, notifyFn, ...rest } = options;

    if (this.historyPlugin.beforeChange(rest) === false) return false;

    this.isHistoryMutation = true;
    const prevStateForNotification = { ...rest.oldState };

    this.historyIndex -= options.steps;
    const state = { ...this.history[this.historyIndex] };
    this.applyTrimRule();

    if (persistFn) persistFn(state);
    if (notifyFn) notifyFn(prevStateForNotification, null);

    this.isHistoryMutation = false;
    this.historyPlugin.afterChange({ ...rest, newState: state });
    return state;
  }

  /**
   * Perform redo operation
   */
  redo(options: historyChangePluginOptions<S>): S | false {
    if (!this.canRedo(options.steps)) return false;
    const { persistFn, notifyFn, ...rest } = options;

    if (this.historyPlugin.beforeChange(rest) === false) return false;

    this.isHistoryMutation = true;
    const prevStateForNotification = { ...rest.oldState };

    this.historyIndex += options.steps;
    const state = { ...this.history[this.historyIndex] };
    this.applyTrimRule();

    if (persistFn) persistFn(state);
    if (notifyFn) notifyFn(prevStateForNotification, null);

    this.isHistoryMutation = false;
    this.historyPlugin.afterChange({ ...rest, newState: state });
    return state;
  }

  /**
   * Check if undo is possible
   */
  canUndo(steps: number = 1): boolean {
    return this.historyLimit > 0 && this.historyIndex - steps >= 0;
  }

  /**
   * Check if redo is possible
   */
  canRedo(steps: number = 1): boolean {
    return (
      this.historyLimit > 0 && this.historyIndex + steps < this.history.length
    );
  }

  /**
   * Always keep the last `historyLimit` states in the array.
   */
  private applyTrimRule(): void {
    if (this.history.length > this.historyLimit) {
      const over = this.history.length - this.historyLimit;
      this.history.splice(0, over);
      this.historyIndex -= over;
      if (this.historyIndex < 0) this.historyIndex = 0;
    }
  }

  /**
   * Expose references to plugin hooks
   */
  private historyPlugin = {
    beforeChange: (options: historyChangePluginOptions<S>): boolean | void => {
      return this.pluginManager.beforeHistoryChange(options) !== false;
    },
    afterChange: (options: historyChangePluginOptions<S>): void => {
      this.pluginManager.onHistoryChanged(options);
    },
  };

  /**
   * Clear history
   */
  clear(): void {
    this.history = [];
    this.historyIndex = -1;
  }

  /**
   * Get current history
   */
  getHistory(): {
    history: readonly S[];
    currentIndex: number;
    initialState: Readonly<S> | null;
  } {
    // return a frozen shallow copy of the history
    const history = Object.freeze(this.history.map(state => ({ ...state })));
    return {
      history: history,
      currentIndex: this.historyIndex,
      initialState: Object.freeze(this._initialState),
    };
  }

  /**
   * Get the state at a specific number of steps back
   */
  getUndoState(steps: number = 1): S | null {
    if (!this.canUndo(steps)) return null;
    return { ...this.history[this.historyIndex - steps] };
  }

  /**
   * Get the state at a specific number of steps forward
   */
  getRedoState(steps: number = 1): S | null {
    if (!this.canRedo(steps)) return null;
    return { ...this.history[this.historyIndex + steps] };
  }

  /**
   * Get current history size
   */
  getHistorySize(): number {
    return this.history.length;
  }

  /**
   * Get current history index
   */
  getCurrentIndex(): number {
    return this.historyIndex;
  }
}
