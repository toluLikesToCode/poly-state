/**
 * Plugins for Poly State
 *
 * @remarks
 * This module exports plugin implementations for extending store functionality.
 * The plugin system allows for custom middleware, validation, logging, and other
 * store enhancements.
 *
 * @packageDocumentation
 */

// import {Plugin} from '../core'

// TODO: Add built in plugins here

export * from './devTools'
export * from './omitPathsPlugin'

// // Example plugin structure for now
// export interface BasePlugin<S extends object> {
//   name: string
//   plugin: Plugin<S>
// }
