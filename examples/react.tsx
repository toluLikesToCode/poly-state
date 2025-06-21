/**
 * Example: React Usage
 *
 * This example shows how to use the Universal Store in a React application.
 * Copy your store implementation to src/core/store.ts to make this work.
 */

import React from "react";
import { createStore } from "../src/index.js";
import { createStoreContext } from "../src/react/index.js";

// Example state interface
interface AppState {
  count: number;
  user: {
    name: string;
    email: string;
  };
}

// Create store
const store = createStore<AppState>({
  count: 0,
  user: {
    name: "",
    email: "",
  },
});

// Create React context and hooks
const { StoreProvider, useSelector, useDispatch } = createStoreContext(store);

// Counter component
const Counter: React.FC = () => {
  const count = useSelector((state) => state.count);
  const dispatch = useDispatch();

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => dispatch({ count: count + 1 })}>Increment</button>
      <button onClick={() => dispatch({ count: count - 1 })}>Decrement</button>
    </div>
  );
};

// User profile component
const UserProfile: React.FC = () => {
  const user = useSelector((state) => state.user);
  const dispatch = useDispatch();

  const handleUpdateUser = () => {
    dispatch({
      user: {
        name: "John Doe",
        email: "john@example.com",
      },
    });
  };

  return (
    <div>
      <h3>User Profile</h3>
      <p>Name: {user.name || "No name"}</p>
      <p>Email: {user.email || "No email"}</p>
      <button onClick={handleUpdateUser}>Update User</button>
    </div>
  );
};

// Main app component
const App: React.FC = () => {
  return (
    <StoreProvider>
      <div>
        <h1>Universal Store React Example</h1>
        <Counter />
        <UserProfile />
      </div>
    </StoreProvider>
  );
};

export default App;
