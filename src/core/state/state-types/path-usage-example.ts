/**
 * Example usage of the enhanced PathUpdater types
 * This file demonstrates the type-safe path updates enabled by the new system
 */

import type {Store} from './types'
import type {PathValue, PathsOf} from './path-types'

// Example state interface
interface ExampleState {
  user: {
    profile: {
      name: string
      age: number
      settings: {
        theme: 'light' | 'dark'
        notifications: boolean
      }
    }
    preferences: string[]
  }
  todos: Array<{
    id: number
    text: string
    completed: boolean
  }>
  counters: Record<string, number>
}

/**
 * Example usage of the enhanced updatePath method
 */
export function demonstrateEnhancedUpdatePath(store: Store<ExampleState>) {
  // 1. Compile-time type safety - currentName is automatically typed as string
  store.updatePath(['user', 'profile', 'name'], currentName => {
    // TypeScript knows currentName is string
    return currentName.toUpperCase()
  })

  // 2. Explicit type annotation for deeply nested paths
  store.updatePath<'light' | 'dark'>(['user', 'profile', 'settings', 'theme'], currentTheme => {
    // currentTheme is typed as 'light' | 'dark'
    return currentTheme === 'light' ? 'dark' : 'light'
  })

  // 3. Array element updates with explicit typing
  store.updatePath<boolean>(['todos', 0, 'completed'], completed => {
    // completed is typed as boolean
    return !completed
  })

  // 4. Array operations with proper typing
  store.updatePath(['todos'], todos => {
    // todos is properly typed as Array<{id: number, text: string, completed: boolean}>
    return [...todos, {id: Date.now(), text: 'New todo', completed: false}]
  })

  // 5. Record/Map operations
  store.updatePath(['counters', 'visits'], visits => {
    // visits is typed as number
    return visits + 1
  })

  // 6. Deletion by returning undefined
  store.updatePath(['counters', 'temporaryCounter'], () => undefined)

  // 7. Runtime path with explicit typing
  store.updatePath<number>(['user', 'profile', 'age'], currentAge => {
    return currentAge + 1
  })

  // 8. Dynamic paths (less type safety but more flexible)
  const dynamicField = 'name' as keyof ExampleState['user']['profile']
  const dynamicPath = ['user', 'profile', dynamicField] as const
  store.updatePath(dynamicPath, (currentValue: any) => {
    if (typeof currentValue === 'string') {
      return currentValue.trim()
    }
    return currentValue
  })
}

/**
 * Type demonstrations - these show the compile-time type checking
 */
export type TypeDemonstrations = {
  // PathValue extracts the correct type at a given path
  userName: PathValue<ExampleState, ['user', 'profile', 'name']> // string
  userAge: PathValue<ExampleState, ['user', 'profile', 'age']> // number
  theme: PathValue<ExampleState, ['user', 'profile', 'settings', 'theme']> // 'light' | 'dark'
  firstTodo: PathValue<ExampleState, ['todos', 0]> // {id: number, text: string, completed: boolean}
  todoCompleted: PathValue<ExampleState, ['todos', 0, 'completed']> // boolean

  // PathsOf generates all valid paths
  validPaths: PathsOf<ExampleState>
  // This will be a union type like:
  // ['user'] | ['user', 'profile'] | ['user', 'profile', 'name'] |
  // ['user', 'profile', 'age'] | ['user', 'profile', 'settings'] | etc.
}

/**
 * Compile-time validation examples
 * These would produce TypeScript errors if uncommented:
 */
export function compileTimeValidationExamples(store: Store<ExampleState>) {
  // ✅ Valid paths - these work fine
  store.updatePath(['user', 'profile', 'name'], name => name.toUpperCase())
  store.updatePath<boolean>(['todos', 0, 'completed'], completed => !completed)

  // ❌ Invalid paths - these would cause TypeScript errors:
  // store.updatePath(['user', 'invalid', 'path'], (value) => value) // Error: invalid path
  // store.updatePath(['user', 'profile', 'nonexistent'], (value) => value) // Error: property doesn't exist

  // ❌ Type mismatches - these would cause TypeScript errors:
  // store.updatePath(['user', 'profile', 'age'], (age) => age.toUpperCase()) // Error: number doesn't have toUpperCase
  // store.updatePath(['user', 'profile', 'name'], (name) => name + 42) // Error: can't add number to string
}
