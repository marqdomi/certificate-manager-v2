// frontend/src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useCallback, useEffect, useMemo } from 'react';
import { authProvider } from '../pages/LoginPage';

const AuthContext = createContext({
  user: null,
  isAdmin: false,
  isOperator: false,
  isAuthenticated: false,
  login: async () => {},
  logout: () => {},
  refreshUser: () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Parse user from token on mount
  const refreshUser = useCallback(() => {
    const token = authProvider.getToken?.();
    if (token) {
      try {
        // Decode JWT payload (base64)
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({
          id: payload.sub,
          username: payload.username,
          role: payload.role || 'viewer',
          email: payload.email,
          full_name: payload.full_name,
        });
        setIsAuthenticated(true);
      } catch (e) {
        console.error('Failed to parse token:', e);
        setUser(null);
        setIsAuthenticated(false);
      }
    } else {
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (username, password) => {
    const result = await authProvider.login(username, password);
    if (result.success) {
      refreshUser();
    }
    return result;
  }, [refreshUser]);

  const logout = useCallback(() => {
    authProvider.logout();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const isAdmin = useMemo(() => user?.role === 'admin', [user]);
  const isOperator = useMemo(() => user?.role === 'operator' || user?.role === 'admin', [user]);

  const contextValue = useMemo(() => ({
    user,
    isAdmin,
    isOperator,
    isAuthenticated,
    login,
    logout,
    refreshUser,
  }), [user, isAdmin, isOperator, isAuthenticated, login, logout, refreshUser]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export { AuthContext };
