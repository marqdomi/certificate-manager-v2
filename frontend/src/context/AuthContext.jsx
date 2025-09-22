// frontend/src/context/AuthContext.jsx

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { authService } from '../services/auth';

const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: () => {},
  logout: () => {},
  updateUser: () => {},
  hasRole: () => false,
  hasPermission: () => false,
  isAdmin: false,
  isSuperAdmin: false
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Role hierarchy for permission checking
  const roleHierarchy = {
    'SUPER_ADMIN': 7,
    'ADMIN': 6,
    'CERTIFICATE_MANAGER': 5,
    'F5_OPERATOR': 4,
    'AUDITOR': 3,
    'OPERATOR': 2,
    'VIEWER': 1
  };

  // Load user from token on app start
  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = localStorage.getItem('user_token'); // Changed from 'token' to 'user_token'
        if (token) {
          const userData = await authService.getCurrentUser();
          console.log('👤 User loaded:', userData);
          setUser(userData);
        }
      } catch (error) {
        // Token might be expired or invalid
        localStorage.removeItem('user_token'); // Changed from 'token' to 'user_token'
        localStorage.removeItem('user_role');
        console.warn('Failed to load user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = useCallback(async (credentials) => {
    try {
      const result = await authService.login(credentials);
      setUser(result.user);
      return result;
    } catch (error) {
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.warn('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('user_token');
      localStorage.removeItem('user_role');
    }
  }, []);

  const updateUser = useCallback((updatedUser) => {
    setUser(prev => ({ ...prev, ...updatedUser }));
  }, []);

  const hasRole = useCallback((requiredRole) => {
    if (!user || !user.role) return false;
    
    const userRoleLevel = roleHierarchy[user.role] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;
    
    return userRoleLevel >= requiredRoleLevel;
  }, [user]);

  const hasPermission = useCallback((resource, action) => {
    console.log('🔍 hasPermission check:', { user, resource, action });
    
    if (!user) {
      console.log('❌ No user found');
      return false;
    }

    // Super admin has all permissions
    if (user.role === 'SUPER_ADMIN') {
      console.log('✅ Super admin access granted');
      return true;
    }

    // Handle single-argument permission checks (like 'admin_read')
    if (typeof action === 'undefined' && typeof resource === 'string') {
      const [permissionResource, permissionAction] = resource.split('_');
      console.log('🔍 Single permission check:', { permissionResource, permissionAction, userRole: user.role });
      
      if (permissionResource === 'admin') {
        // Admin permissions - both ADMIN and SUPER_ADMIN have access
        const hasAccess = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
        console.log('🔐 Admin permission result:', { userRole: user.role, hasAccess });
        return hasAccess;
      }
      
      // For other single-argument permissions, use the resource as action
      return hasPermission(permissionResource, permissionAction || 'read');
    }

    // Admin has most permissions except super admin functions
    if (user.role === 'ADMIN' && resource !== 'system' && action !== 'super_admin') {
      console.log('✅ Admin access granted for:', { resource, action });
      return true;
    }

    // Role-based permissions
    const permissions = {
      'ADMIN': {
        'admin': ['read', 'write', 'execute'],
        'users': ['read', 'write', 'delete'],
        'system': ['read', 'write'],
        'certificates': ['read', 'write', 'delete', 'execute'],
        'devices': ['read', 'write', 'delete', 'execute'],
        'deployments': ['read', 'write', 'execute'],
        'audit': ['read']
      },
      'CERTIFICATE_MANAGER': {
        'certificates': ['read', 'write', 'delete', 'execute'],
        'devices': ['read'],
        'deployments': ['read', 'write', 'execute']
      },
      'F5_OPERATOR': {
        'devices': ['read', 'write', 'execute'],
        'f5_operations': ['read', 'write', 'execute'],
        'certificates': ['read']
      },
      'AUDITOR': {
        'certificates': ['read'],
        'devices': ['read'],
        'deployments': ['read'],
        'users': ['read'],
        'audit': ['read']
      },
      'OPERATOR': {
        'certificates': ['read'],
        'devices': ['read'],
        'deployments': ['read']
      },
      'VIEWER': {
        'certificates': ['read'],
        'devices': ['read']
      }
    };

    const userPermissions = permissions[user.role] || {};
    const allowedActions = userPermissions[resource] || [];
    const hasAccess = allowedActions.includes(action);
    
    console.log('🔍 Role-based permission check:', { 
      userRole: user.role, 
      resource, 
      action, 
      userPermissions: userPermissions[resource],
      hasAccess 
    });
    
    return hasAccess;
  }, [user]);

  const isAuthenticated = Boolean(user);
  const isAdmin = hasRole('ADMIN');
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    updateUser,
    hasRole,
    hasPermission,
    isAdmin,
    isSuperAdmin
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};