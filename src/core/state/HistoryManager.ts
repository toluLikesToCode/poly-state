import {PluginManager} from '../../plugins/pluginManager'
import {historyChangePluginOptions} from './state-types/types'
import {deepClone} from '../utils'

/**
 * Manages undo/redo history for state changes.
 */
export class HistoryManager<S extends object> {
  private _initialState: S
  private history: S[] = []
  private historyIndex = -1
  private isHistoryMutation = false
  private pluginManager: PluginManager<S>
  private historyLimit: number
  private preHistoryState: S | null = null // State that would be at index -1

  constructor(historyLimit: number, pluginManager: PluginManager<S>, initialState: S) {
    this.historyLimit = historyLimit
    this.pluginManager = pluginManager
    // Use simple deep copy instead of assignState to avoid potential issues
    this._initialState = deepClone(initialState)
  }

  /**
   * Add a new state to history
   */
  addToHistory(newState: S): void {
    if (this.historyLimit > 0 && !this.isHistoryMutation) {
      // If first time, skip storing initial in array
      if (this._initialState && this.history.length === 0) {
        // Just to confirm we start fresh
        this.historyIndex = -1
      }

      // cut off any "future" states if we're mid-undo
      if (this.historyIndex >= 0 && this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1)
      }

      this.history.push({...newState})
      this.historyIndex = this.history.length - 1
      this.applyTrimRule()
    }
  }

  /**
   * Perform undo operation
   */
  undo(options: historyChangePluginOptions<S>): S | false {
    if (!this.canUndo(options.steps)) return false
    const {persistFn, ...rest} = options

    if (this.historyPlugin.beforeChange(rest) === false) return false

    this.isHistoryMutation = true

    this.historyIndex -= options.steps

    // Get the state based on the target index
    let state: S
    if (this.historyIndex === -1 && this.preHistoryState !== null) {
      state = {...this.preHistoryState}
    } else if (this.historyIndex >= 0) {
      state = {...this.history[this.historyIndex]}
    } else {
      // This shouldn't happen due to canUndo check
      throw new Error('Invalid history index after undo')
    }

    this.applyTrimRule()

    if (persistFn) persistFn(state)

    this.isHistoryMutation = false
    this.historyPlugin.afterChange({...rest, newState: state})
    return state
  }

  /**
   * Perform redo operation
   */
  redo(options: historyChangePluginOptions<S>): S | false {
    if (!this.canRedo(options.steps)) return false
    const {persistFn, ...rest} = options

    if (this.historyPlugin.beforeChange(rest) === false) return false

    this.isHistoryMutation = true

    this.historyIndex += options.steps
    const state = {...this.history[this.historyIndex]}
    this.applyTrimRule()

    if (persistFn) persistFn(state)

    this.isHistoryMutation = false
    this.historyPlugin.afterChange({...rest, newState: state})
    return state
  }

  /**
   * Check if undo is possible
   */
  canUndo(steps: number = 1): boolean {
    const targetIndex = this.historyIndex - steps
    // Allow undo if we can go to a valid history index OR to index -1 if we have a preHistoryState
    return (
      this.historyLimit > 0 &&
      (targetIndex >= 0 || (targetIndex === -1 && this.preHistoryState !== null))
    )
  }

  /**
   * Check if redo is possible
   */
  canRedo(steps: number = 1): boolean {
    return this.historyLimit > 0 && this.historyIndex + steps < this.history.length
  }

  /**
   * Always keep the last `historyLimit` states in the array.
   */
  private applyTrimRule(): void {
    if (this.history.length > this.historyLimit) {
      const over = this.history.length - this.historyLimit
      // Store the state that will be at index -1 after trimming
      this.preHistoryState = {...this.history[over - 1]}
      this.history.splice(0, over)
      this.historyIndex -= over
      if (this.historyIndex < 0) this.historyIndex = 0
    }
  }

  /**
   * Expose references to plugin hooks
   */
  private historyPlugin = {
    beforeChange: (options: historyChangePluginOptions<S>): boolean | void => {
      return this.pluginManager.beforeHistoryChange(options) !== false
    },
    afterChange: (options: historyChangePluginOptions<S>): void => {
      this.pluginManager.onHistoryChanged(options)
    },
  }

  /**
   * Clear history
   * @param isReset - Wether or not to reset the history to the initial state
   */
  clear(isReset: boolean = false): void {
    this.history = []
    this.historyIndex = -1
    if (isReset) {
      this.addToHistory(this._initialState)
    }
  }

  /**
   * Get current history
   */
  getHistory(): {
    history: readonly S[]
    currentIndex: number
    initialState: Readonly<S> | null
  } {
    // return a frozen shallow copy of the history
    const history = Object.freeze(this.history.map(state => ({...state})))
    const frozenInitialState = Object.freeze(this._initialState)

    return {
      history,
      currentIndex: this.historyIndex,
      initialState: frozenInitialState,
    }
  }

  /**
   * Get the state at a specific number of steps back
   */
  getUndoState(steps: number = 1): S | null {
    if (!this.canUndo(steps)) return null
    return {...this.history[this.historyIndex - steps]}
  }

  /**
   * Get the state at a specific number of steps forward
   */
  getRedoState(steps: number = 1): S | null {
    if (!this.canRedo(steps)) return null
    return {...this.history[this.historyIndex + steps]}
  }

  /**
   * Get current history size
   */
  getHistorySize(): number {
    return this.history.length
  }

  /**
   * Get current history index
   */
  getCurrentIndex(): number {
    return this.historyIndex
  }
}
