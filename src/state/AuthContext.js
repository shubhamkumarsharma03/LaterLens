import { createContext, useContext, useState, useMemo } from 'react';

const AuthContext = createContext(null);

/**
 * AuthProvider — Mock implementation for dynamic user state.
 * Supports a guest mode and a logged-in mode with a configurable name.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const signIn = (userData) => {
    setUser(userData || { name: 'User', email: 'user@example.com' });
    setIsAuthenticated(true);
  };

  const signOut = () => {
    setUser(null);
    setIsAuthenticated(false);
  };

  const value = useMemo(
    () => ({
      user,
      isAuthenticated,
      signIn,
      signOut,
    }),
    [user, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
