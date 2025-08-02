import React, {useEffect, useCallback, useRef} from 'react'
import {render, screen} from '@testing-library/react'
import {createStore} from './src/core'
import {createStoreContext} from './src/react'

// Test to verify useAsyncThunk returns stable references
function TestStability() {
  const store = createStore({count: 0})
  const {StoreProvider, useAsyncThunk} = createStoreContext(store)

  function Component() {
    const {execute, loading, error} = useAsyncThunk()
    const executeRef = useRef(execute)
    const renderCount = useRef(0)
    const executeChangeCount = useRef(0)

    renderCount.current++

    // Check if execute function reference has changed
    if (executeRef.current !== execute) {
      executeChangeCount.current++
      executeRef.current = execute
    }

    const memoizedCallback = useCallback(() => {
      // This callback should only recreate when execute changes
      return execute
    }, [execute])

    useEffect(() => {
      // This effect should only run when execute changes
      console.log('Execute function changed')
    }, [execute])

    return (
      <div>
        <div data-testid="render-count">{renderCount.current}</div>
        <div data-testid="execute-change-count">{executeChangeCount.current}</div>
        <div data-testid="loading">{loading.toString()}</div>
        <div data-testid="error">{error?.message || 'none'}</div>
      </div>
    )
  }

  return (
    <StoreProvider>
      <Component />
    </StoreProvider>
  )
}

// Render the component multiple times to see if execute function changes
render(<TestStability />)

console.log('Render count:', screen.getByTestId('render-count').textContent)
console.log('Execute change count:', screen.getByTestId('execute-change-count').textContent)
console.log('Loading:', screen.getByTestId('loading').textContent)
console.log('Error:', screen.getByTestId('error').textContent)

// Force a re-render
render(<TestStability />)

console.log('After re-render:')
console.log('Execute change count should still be low if our fix works')
