import React from 'react'
import {createStore} from '../core'
import {createStoreContext} from '../react'

// 1. Define your app state and create the store
interface AppState {
  user: {
    preferences: {
      theme: 'light' | 'dark'
    }
  }
}

const store = createStore<AppState>({
  user: {
    preferences: {
      theme: 'light',
    },
  },
})

// 2. Create the store context for React
const {StoreProvider, useSubscribeToPath, useDispatch, useStoreState} = createStoreContext(store)

// 3. Create a component that reacts to theme changes
function ThemeEffect() {
  useSubscribeToPath<'light' | 'dark'>(
    'user.preferences.theme',
    (newTheme, oldTheme) => {
      document.body.className = `theme-${newTheme}`
      console.log(`Theme changed from ${oldTheme} to ${newTheme}`)
    },
    {immediate: true} // Run effect immediately on mount
  )
  return null // This component only handles the side effect
}

// 4. Create a component to toggle the theme
function ThemeToggle() {
  const dispatch = useDispatch()
  const state = useStoreState()
  return (
    <button
      onClick={() =>
        dispatch({
          user: {
            preferences: {
              theme: state.user.preferences.theme === 'light' ? 'dark' : 'light',
            },
          },
        })
      }>
      Toggle Theme
    </button>
  )
}

// 5. Compose your app with the StoreProvider
function App() {
  return (
    <StoreProvider>
      <ThemeEffect />
      <ThemeToggle />
      {/* ...other components... */}
    </StoreProvider>
  )
}

export default App
