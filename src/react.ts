/**
 * # Universal Store - React Integration
 *
 * Complete React integration for Universal Store, providing idiomatic React hooks
 * and context providers for state management with full TypeScript support.
 *
 * ## Features
 * - 🎣 **React Hooks**: Full hook support for all store operations
 * - 🔄 **Automatic Re-renders**: Components update only when relevant state changes
 * - 🎯 **Path-based Access**: Direct access to nested state with dot notation
 * - ⚡ **Performance Optimized**: Efficient subscriptions and batched updates
 * - 🛡️ **Type Safe**: Complete TypeScript IntelliSense and type checking
 * - 🔧 **Transaction Support**: Atomic state updates with Immer integration
 * - 📡 **Async Operations**: Built-in loading and error state management
 *
 * @example
 * **Basic Setup and Usage**
 * ```tsx
 * import { createStore } from '@tolulikescode/universal-store';
 * import { createStoreContext } from '@tolulikescode/universal-store/react';
 *
 * // Define your state shape
 * interface AppState {
 *   count: number;
 *   user: { name: string; email: string };
 *   todos: Array<{ id: number; text: string; completed: boolean }>;
 * }
 *
 * // Create store
 * const store = createStore<AppState>({
 *   count: 0,
 *   user: { name: '', email: '' },
 *   todos: []
 * });
 *
 * // Create React integration
 * const {
 *   StoreProvider,
 *   useSelector,
 *   useDispatch,
 *   useStoreValue,
 *   useTransaction
 * } = createStoreContext(store);
 *
 * // Use in components
 * function Counter() {
 *   const count = useSelector(state => state.count);
 *   const dispatch = useDispatch();
 *
 *   return (
 *     <div>
 *       <span>{count}</span>
 *       <button onClick={() => dispatch({ count: count + 1 })}>
 *         Increment
 *       </button>
 *     </div>
 *   );
 * }
 *
 * function UserProfile() {
 *   // Direct path access with type safety
 *   const userName = useStoreValue<string>('user.name');
 *   const transaction = useTransaction();
 *
 *   const updateUser = () => {
 *     transaction(draft => {
 *       draft.user.name = 'John Doe';
 *       draft.user.email = 'john@example.com';
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       <h2>{userName}</h2>
 *       <button onClick={updateUser}>Update User</button>
 *     </div>
 *   );
 * }
 *
 * // App root with provider
 * function App() {
 *   return (
 *     <StoreProvider>
 *       <Counter />
 *       <UserProfile />
 *     </StoreProvider>
 *   );
 * }
 * ```
 *
 * @example
 * **Advanced Features - Async Operations with Loading States**
 * ```tsx
 * function DataComponent() {
 *   const { execute, loading, error } = useAsyncThunk();
 *   const data = useSelector(state => state.data);
 *
 *   const fetchData = async () => {
 *     await execute(async (dispatch) => {
 *       const response = await fetch('/api/data');
 *       const result = await response.json();
 *       dispatch({ data: result });
 *     });
 *   };
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       <button onClick={fetchData}>Load Data</button>
 *       {data && <DataDisplay data={data} />}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * **Path-based Subscriptions and Effects**
 * ```tsx
 * function ThemeAwareComponent() {
 *   const theme = useStoreValue<'light' | 'dark'>('settings.theme');
 *
 *   // Subscribe to theme changes with side effects
 *   useSubscribeToPath(
 *     'settings.theme',
 *     (newTheme, oldTheme) => {
 *       document.body.className = `theme-${newTheme}`;
 *       console.log(`Theme changed from ${oldTheme} to ${newTheme}`);
 *     }
 *   );
 *
 *   return <div className={`component theme-${theme}`}>Content</div>;
 * }
 * ```
 *
 * ## Main Exports
 *
 * ### Core Functions
 * - {@link createStoreContext} - Main function to create React integration
 * - {@link withStore} - HOC for providing store to components
 *
 * ### Types
 * - {@link StoreContextResult} - Complete result from createStoreContext
 * - {@link StoreContextValue} - Context value interface
 *
 * @packageDocumentation
 */

// Core storage utilities (localStorage, sessionStorage, cookies)
export * from './core/storage/index'

// Complete React integration
export * from './react/index'
