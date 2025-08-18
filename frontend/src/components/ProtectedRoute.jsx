// frontend/src/components/ProtectedRoute.jsx
import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authProvider } from '../pages/LoginPage';

const ProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const token = authProvider.getToken();

    // Placeholder for JWT decoding and expiration check
    // For example: decode token and check exp field
    const isTokenValid = token /* && tokenNotExpired(token) */;

    setIsAuthenticated(!!isTokenValid);
  }, []);

  if (isAuthenticated === null) {
    // Placeholder for loading spinner while async auth check runs
    return null; // or a <Spinner /> component
  }

  if (!isAuthenticated) {
    // Si no hay token o token inválido, redirige al login, guardando la página que intentaba visitar.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;