/**
 * Example: Vanilla TypeScript Usage
 *
 * This example shows how to use the Universal Store in a vanilla TypeScript project.
 * Copy your store implementation to src/core/store.ts to make this work.
 */

import { createStore } from "../src/index.js";

// Example state interface
interface AppState {
  user: {
    id: number | null;
    name: string;
    email: string;
  };
  todos: Array<{
    id: number;
    text: string;
    completed: boolean;
  }>;
  settings: {
    theme: "light" | "dark";
  };
}

// Create store with initial state
const store = createStore<AppState>({
  user: {
    id: null,
    name: "",
    email: "",
  },
  todos: [],
  settings: {
    theme: "light",
  },
});

// Subscribe to changes
const unsubscribe = store.subscribe((state, prevState) => {
  console.log("State changed:", { newState: state, prevState });
});

// Dispatch actions
console.log("Initial state:", store.getState());

store.dispatch({
  user: {
    id: 1,
    name: "John Doe",
    email: "john@example.com",
  },
});

store.dispatch({
  todos: [
    { id: 1, text: "Learn Universal Store", completed: false },
    { id: 2, text: "Build awesome app", completed: false },
  ],
});

// Use selectors
const userSelector = store.select((state) => state.user);
const completedTodosSelector = store.select((state) =>
  state.todos.filter((todo) => todo.completed)
);

console.log("Current user:", userSelector());
console.log("Completed todos:", completedTodosSelector());

// Cleanup
// unsubscribe();
