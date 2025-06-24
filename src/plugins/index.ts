/**
 * Plugins for Universal Store
 *
 * @remarks
 * This module exports plugin implementations for extending store functionality.
 * The plugin system allows for custom middleware, validation, logging, and other
 * store enhancements.
 *
 * @packageDocumentation
 */

import {Plugin} from '../core'

// TODO: Add built in plugins here

// Example plugin structure for now
export interface BasePlugin<S extends object> {
  name: string
  plugin: Plugin<S>
}
