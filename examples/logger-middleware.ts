/**
 * Example: Logger Middleware Usage
 *
 * This example demonstrates the enhanced logger middleware capabilities
 * with support for custom client loggers, Consola, console, and generic logging utilities.
 *
 * Features demonstrated:
 * - Multiple logger types (console, Consola, custom client logger)
 * - Correlation ID tracking
 * - Blacklisting sensitive data
 * - Custom action name formatting
 * - Grouping and formatting options
 */

import {createStore} from '../src/index.js'
import {
  createLoggerMiddleware,
  SupportedLogger,
  LoggerMiddlewareOptions,
} from '../src/core/state/utils.js'

// =============================================================================
// MOCK CUSTOM CLIENT LOGGER (based on your interface)
// =============================================================================

interface MockClientLogger {
  log: (...args: any[]) => void
  info: (...args: any[]) => void
  warn: (...args: any[]) => void
  error: (...args: any[]) => void
  debug: (...args: any[]) => void
  trace?: (...args: any[]) => void
  silly?: (...args: any[]) => void
  group?: (label?: string) => void
  groupCollapsed?: (label?: string) => void
  groupEnd?: () => void
  table?: (data: any, columns?: string[]) => void
  getCorrelationId?: () => string
  setCorrelationId?: (id: string) => void
  child?: (childContextSuffix: string, childDefaultMeta?: Record<string, any>) => MockClientLogger
}

function createMockClientLogger(context: string): MockClientLogger {
  let correlationId = ''
  const prefix = `[Mock:${context}]`

  return {
    log: (...args: any[]) =>
      console.log(`${prefix}${correlationId ? `[${correlationId}]` : ''}`, ...args),
    info: (...args: any[]) =>
      console.info(`${prefix}${correlationId ? `[${correlationId}]` : ''}`, ...args),
    warn: (...args: any[]) =>
      console.warn(`${prefix}${correlationId ? `[${correlationId}]` : ''}`, ...args),
    error: (...args: any[]) =>
      console.error(`${prefix}${correlationId ? `[${correlationId}]` : ''}`, ...args),
    debug: (...args: any[]) =>
      console.debug(`${prefix}${correlationId ? `[${correlationId}]` : ''}`, ...args),
    trace: (...args: any[]) =>
      console.trace(`${prefix}${correlationId ? `[${correlationId}]` : ''}`, ...args),
    silly: (...args: any[]) =>
      console.log(`${prefix}${correlationId ? `[${correlationId}]` : ''}[SILLY]`, ...args),
    group: (label?: string) => console.group(`${prefix} ${label || 'Group'}`),
    groupCollapsed: (label?: string) =>
      console.groupCollapsed(`${prefix} ${label || 'Collapsed Group'}`),
    groupEnd: () => console.groupEnd(),
    table: (data: any, columns?: string[]) => console.table(data, columns),
    getCorrelationId: () => correlationId,
    setCorrelationId: (id: string) => {
      correlationId = id
    },
    child: (suffix: string, meta?: Record<string, any>) =>
      createMockClientLogger(`${context}:${suffix}`),
  }
}

// =============================================================================
// MOCK CONSOLA LOGGER
// =============================================================================

const mockConsola = {
  log: (...args: any[]) => console.log('[Consola]', ...args),
  info: (...args: any[]) => console.info('[Consola]', ...args),
  success: (...args: any[]) => console.log('[Consola][SUCCESS]', ...args),
  warn: (...args: any[]) => console.warn('[Consola]', ...args),
  error: (...args: any[]) => console.error('[Consola]', ...args),
  debug: (...args: any[]) => console.debug('[Consola]', ...args),
  trace: (...args: any[]) => console.trace('[Consola]', ...args),
  box: (message: string) => {
    console.log('╭─────────────────────────────────────────╮')
    console.log(`│ ${message.padEnd(39)} │`)
    console.log('╰─────────────────────────────────────────╯')
  },
}

// =============================================================================
// STATE INTERFACE
// =============================================================================

interface AppState {
  user: {
    id: number | null
    name: string
    email: string
    password?: string // Sensitive data to blacklist
  }
  todos: Array<{
    id: number
    text: string
    completed: boolean
  }>
  settings: {
    theme: 'light' | 'dark'
    notifications: boolean
  }
  apiKeys: {
    secret: string // Sensitive data to blacklist
    public: string
  }
}

// =============================================================================
// EXAMPLE 1: Basic Console Logging
// =============================================================================

function basicConsoleExample() {
  console.log('\n=== Example 1: Basic Console Logging ===')

  const store = createStore<AppState>(
    {
      user: {id: null, name: '', email: ''},
      todos: [],
      settings: {theme: 'light', notifications: true},
      apiKeys: {secret: 'secret-key', public: 'public-key'},
    },
    {
      middleware: [createLoggerMiddleware(console, {enabled: true})],
    }
  )

  // Dispatch some actions
  store.dispatch({user: {id: 1, name: 'John Doe', email: 'john@example.com'}})
  store.dispatch({settings: {theme: 'dark', notifications: false}})
}

// =============================================================================
// EXAMPLE 2: Consola Logger with Box Formatting
// =============================================================================

function consolaExample() {
  console.log('\n=== Example 2: Consola Logger with Box Formatting ===')

  const store = createStore<AppState>(
    {
      user: {id: null, name: '', email: ''},
      todos: [],
      settings: {theme: 'light', notifications: true},
      apiKeys: {secret: 'secret-key', public: 'public-key'},
    },
    {
      middleware: [
        createLoggerMiddleware(mockConsola, {
          enabled: true,
          logLevel: 'info',
        }),
      ],
    }
  )

  store.dispatch({
    todos: [{id: 1, text: 'Learn Poly State', completed: false}],
  })
}

// =============================================================================
// EXAMPLE 3: Custom Client Logger with Correlation ID
// =============================================================================

function customClientLoggerExample() {
  console.log('\n=== Example 3: Custom Client Logger with Correlation ID ===')

  const clientLogger = createMockClientLogger('StateManager')

  const store = createStore<AppState>(
    {
      user: {id: null, name: '', email: ''},
      todos: [],
      settings: {theme: 'light', notifications: true},
      apiKeys: {secret: 'secret-key', public: 'public-key'},
    },
    {
      middleware: [
        createLoggerMiddleware(clientLogger, {
          enabled: true,
          logLevel: 'debug',
          correlationId: 'user-session-abc123',
        }),
      ],
    }
  )

  store.dispatch({
    user: {id: 2, name: 'Jane Smith', email: 'jane@example.com'},
  })

  store.dispatch({
    todos: [
      {id: 1, text: 'Setup logging', completed: true},
      {id: 2, text: 'Test correlation ID', completed: false},
    ],
  })
}

// =============================================================================
// EXAMPLE 4: Advanced Configuration with Blacklisting
// =============================================================================

function advancedConfigurationExample() {
  console.log('\n=== Example 4: Advanced Configuration with Blacklisting ===')

  const store = createStore<AppState>(
    {
      user: {id: null, name: '', email: '', password: 'secret123'},
      todos: [],
      settings: {theme: 'light', notifications: true},
      apiKeys: {secret: 'secret-api-key', public: 'public-api-key'},
    },
    {
      middleware: [
        createLoggerMiddleware(console, {
          enabled: true,
          logLevel: 'info',
          // Blacklist sensitive data
          blacklist: [
            ['user', 'password'], // Remove user.password
            ['apiKeys', 'secret'], // Remove apiKeys.secret
          ],
          useGrouping: true,
          includeTimestamp: true,
          // Custom action name formatter
          actionNameFormatter: action => {
            if (typeof action === 'function') return '[async-thunk]'
            const keys = Object.keys(action)
            if (keys.includes('user')) return '👤 USER_UPDATE'
            if (keys.includes('todos')) return '📋 TODOS_UPDATE'
            if (keys.includes('settings')) return '⚙️ SETTINGS_UPDATE'
            return keys.join('+') || '[empty]'
          },
        }),
      ],
    }
  )

  // This will log but sensitive data will be removed
  store.dispatch({
    user: {
      id: 3,
      name: 'Alice Johnson',
      email: 'alice@example.com',
      password: 'should-not-appear-in-logs',
    },
  })

  store.dispatch({
    apiKeys: {
      secret: 'should-not-appear-in-logs',
      public: 'this-will-appear',
    },
  })
}

// =============================================================================
// EXAMPLE 5: Custom Analytics Logger
// =============================================================================

function analyticsLoggerExample() {
  console.log('\n=== Example 5: Custom Analytics Logger ===')

  // Mock analytics function
  const analyticsLogger = (message: string, ...data: any[]) => {
    console.log('📊 [Analytics]', {
      event: 'state_change',
      message,
      data,
      timestamp: new Date().toISOString(),
    })
  }

  const store = createStore<AppState>(
    {
      user: {id: null, name: '', email: ''},
      todos: [],
      settings: {theme: 'light', notifications: true},
      apiKeys: {secret: 'secret-key', public: 'public-key'},
    },
    {
      middleware: [
        createLoggerMiddleware(analyticsLogger, {
          enabled: true,
          useGrouping: false, // Analytics logger doesn't support grouping
        }),
      ],
    }
  )

  store.dispatch({
    settings: {theme: 'dark', notifications: true},
  })
}

// =============================================================================
// EXAMPLE 6: Environment-Aware Logging
// =============================================================================

function environmentAwareExample() {
  console.log('\n=== Example 6: Environment-Aware Logging ===')

  const conditionalLogger = (...args: any[]) => {
    // In a real app, this would check actual environment
    const isDev = true // process.env.NODE_ENV === 'development'

    if (isDev) {
      console.log('🚧 [DEV]', ...args)
    } else {
      // In production, might send to a logging service
      console.log('🚀 [PROD]', ...args)
    }
  }

  const store = createStore<AppState>(
    {
      user: {id: null, name: '', email: ''},
      todos: [],
      settings: {theme: 'light', notifications: true},
      apiKeys: {secret: 'secret-key', public: 'public-key'},
    },
    {
      middleware: [
        createLoggerMiddleware(conditionalLogger, {
          enabled: true,
          actionNameFormatter: action => {
            // Add environment info to action names
            return `[ENV:DEV] ${Object.keys(action).join(', ') || '[empty]'}`
          },
        }),
      ],
    }
  )

  store.dispatch({
    user: {id: 4, name: 'Bob Wilson', email: 'bob@example.com'},
  })
}

// =============================================================================
// RUN ALL EXAMPLES
// =============================================================================

function runAllExamples() {
  console.log('🚀 Running Logger Middleware Examples\n')

  try {
    basicConsoleExample()
    consolaExample()
    customClientLoggerExample()
    advancedConfigurationExample()
    analyticsLoggerExample()
    environmentAwareExample()

    console.log('\n✅ All examples completed successfully!')
  } catch (error) {
    console.error('\n❌ Error running examples:', error)
  }
}

// Run examples if this file is executed directly
if (typeof window === 'undefined' && typeof process !== 'undefined') {
  runAllExamples()
}

export {
  runAllExamples,
  basicConsoleExample,
  consolaExample,
  customClientLoggerExample,
  advancedConfigurationExample,
  analyticsLoggerExample,
  environmentAwareExample,
}
