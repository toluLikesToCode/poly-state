# TODO: updatePath Overloads Refactor

## Proposed Implementation

```typescript
// Enhanced updatePath with multiple overloads for different type safety levels
storeInstance.updatePath = // Strict overload: only allow valid compile-time paths
  (<const P extends PathsOf<S>>(
    path: P,
    updater: PathValue<S, P> extends infer V
      ? V extends never
        ? never
        : EnhancedPathUpdater<V>
      : never
  ) => {
    if (isDestroyed) return
    // Do NOT check path.length for tuple types (strict overload)
    const baseState =
      batching && batchedActions.length > 0
        ? batchedActions.reduce((acc, curr) => assignState(acc as S, curr), state)
        : state
    const nextState = immer.produce(baseState, draft => {
      let current: any = draft
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i]
        if (current[key] === undefined) {
          const nextKey = path[i + 1]
          current[key] = typeof nextKey === 'number' ? [] : {}
        } else if (
          current[key] === null ||
          (typeof current[key] !== 'object' && typeof current[key] !== 'function')
        ) {
          handleError(
            new StoreError('Cannot navigate through non-object value in path', {
              operation: 'updatePath',
              path,
              pathIndex: i + 1,
              currentValue: current[key],
            })
          )
          return
        }
        current = current[key]
      }
      const finalKey = path[path.length - 1]
      const currentValue = current[finalKey]
      try {
        let newValue: any
        if (typeof updater === 'function') {
          newValue = (updater as Function)(currentValue)
        } else {
          newValue = updater
        }
        if (newValue === undefined) {
          if (Array.isArray(current)) {
            if (typeof finalKey === 'number' && finalKey >= 0 && finalKey < current.length) {
              current.splice(finalKey, 1)
            }
          } else {
            delete current[finalKey]
          }
        } else current[finalKey] = newValue
      } catch (error: any) {
        handleError(
          new StoreError('Updater function threw an error', {
            operation: 'updatePath',
            path,
            currentValue,
            error: {
              message: error?.message || 'Unknown error',
              stack: error?.stack || 'No stack trace available',
              context: error?.context || {},
            },
          })
        )
      }
    })
    if (nextState !== baseState) {
      const diff = buildMinimalDiff(nextState, path as unknown as (string | number)[])
      _internalDispatch(diff, false)
    }
  }) as any as typeof storeInstance.updatePath &
    // Flexible overload: allow any runtime path, fallback to less strict typing
    (<V = any>(path: FlexiblePath, updater: EnhancedPathUpdater<V>) => void) &
    ((path: (string | number)[], updater: EnhancedPathUpdater<any>) => void)

// Flexible overload implementation
const flexibleUpdatePath = (path: (string | number)[], updater: EnhancedPathUpdater<any>) => {
  if (isDestroyed) return
  // Validate path is not empty for flexible overloads
  if (!Array.isArray(path) || path.length === 0) {
    handleError(
      new StoreError('updatePath requires a non-empty path array', {
        operation: 'updatePath',
        path,
      })
    )
    return
  }
  const baseState =
    batching && batchedActions.length > 0
      ? batchedActions.reduce((acc, curr) => assignState(acc as S, curr), state)
      : state
  const nextState = immer.produce(baseState, draft => {
    let current: any = draft
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i]
      if (current[key] === undefined) {
        const nextKey = path[i + 1]
        current[key] = typeof nextKey === 'number' ? [] : {}
      } else if (
        current[key] === null ||
        (typeof current[key] !== 'object' && typeof current[key] !== 'function')
      ) {
        handleError(
          new StoreError('Cannot navigate through non-object value in path', {
            operation: 'updatePath',
            path,
            pathIndex: i + 1,
            currentValue: current[key],
          })
        )
        return
      }
      current = current[key]
    }
    const finalKey = path[path.length - 1]
    const currentValue = current[finalKey]
    try {
      let newValue: any
      if (typeof updater === 'function') {
        newValue = (updater as Function)(currentValue)
      } else {
        newValue = updater
      }
      if (newValue === undefined) {
        if (Array.isArray(current)) {
          if (typeof finalKey === 'number' && finalKey >= 0 && finalKey < current.length) {
            current.splice(finalKey, 1)
          }
        } else {
          delete current[finalKey]
        }
      } else current[finalKey] = newValue
    } catch (error: any) {
      handleError(
        new StoreError('Updater function threw an error', {
          operation: 'updatePath',
          path,
          currentValue,
          error: {
            message: error?.message || 'Unknown error',
            stack: error?.stack || 'No stack trace available',
            context: error?.context || {},
          },
        })
      )
    }
  })
  if (nextState !== baseState) {
    const diff = buildMinimalDiff(nextState, path)
    _internalDispatch(diff, false)
  }
}

// Attach flexible overloads to the main method
storeInstance.updatePath = Object.assign(storeInstance.updatePath, {
  flexible: flexibleUpdatePath,
})
```

### What changes

- If you use a path that is not valid for your state type and TypeScript can infer it, you will now
  get a compile-time error (better type safety).
- For dynamic or runtime paths, you can still use flexible overloads without type errors.

### Summary

- TypeScript users: get improved compile-time validation for valid paths.
- Runtime/dynamic usage: remains unchanged and flexible.

### Steps to implement

1. Refactor `updatePath` in `createStore.ts` as shown above.
2. Remove runtime path length checks from the strict overload.
3. Keep runtime path validation in the flexible overload implementation.
4. Test both static and dynamic usages to confirm type safety and runtime behavior.
5. Update documentation to reflect overloads and improved type safety.
