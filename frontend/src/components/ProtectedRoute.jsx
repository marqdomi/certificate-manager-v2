// frontend/src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authProvider } from '../pages/LoginPage';

const ProtectedRoute = ({ children }) => {
  const token = authProvider.getToken();
  const location = useLocation();

  if (!token) {
    // Si no hay token, redirige al login, guardando la página que intentaba visitar.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;