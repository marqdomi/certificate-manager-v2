// frontend/src/components/ProtectedRoute.jsx
import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { authProvider } from '../pages/LoginPage';

/**
 * Decode a JWT token and check if it's expired.
 * Returns true if the token is valid and not expired.
 */
function isTokenValid(token) {
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return true; // No expiration claim — treat as valid
    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  } catch {
    return false;
  }
}

const ProtectedRoute = ({ children }) => {
  const [authState, setAuthState] = useState('loading'); // 'loading' | 'authenticated' | 'unauthenticated'
  const location = useLocation();

  useEffect(() => {
    const token = authProvider.getToken();
    if (isTokenValid(token)) {
      setAuthState('authenticated');
    } else {
      // Token missing or expired — clear storage and redirect
      if (token) {
        authProvider.logout?.();
      }
      setAuthState('unauthenticated');
    }
  }, []);

  // Re-check token validity periodically (every 60s)
  useEffect(() => {
    const interval = setInterval(() => {
      const token = authProvider.getToken();
      if (!isTokenValid(token)) {
        authProvider.logout?.();
        setAuthState('unauthenticated');
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (authState === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (authState === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;