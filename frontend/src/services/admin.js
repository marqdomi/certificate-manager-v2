// frontend/src/services/admin.js

import apiClient from './api';

export const adminService = {
  // User management
  async getUsers(params = {}) {
    try {
      const response = await apiClient.get('/admin/users', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch users');
    }
  },

  async getUser(userId) {
    try {
      const response = await apiClient.get(`/admin/users/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch user');
    }
  },

  async createUser(userData) {
    try {
      const response = await apiClient.post('/admin/users', userData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to create user');
    }
  },

  async updateUser(userId, userData) {
    try {
      const response = await apiClient.put(`/admin/users/${userId}`, userData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to update user');
    }
  },

  async deleteUser(userId) {
    try {
      const response = await apiClient.delete(`/admin/users/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to delete user');
    }
  },

  async updateUserPassword(userId, passwordData) {
    try {
      const response = await apiClient.post(`/admin/users/${userId}/password`, passwordData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to update password');
    }
  },

  async unlockUser(userId) {
    try {
      const response = await apiClient.post(`/admin/users/${userId}/unlock`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to unlock user');
    }
  },

  async getUserActivity(userId, params = {}) {
    try {
      const response = await apiClient.get(`/admin/users/${userId}/activity`, { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch user activity');
    }
  },

  // System statistics and monitoring
  async getSystemStats() {
    try {
      const response = await apiClient.get('/admin/system/stats');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch system stats');
    }
  },

  async getSystemActivity(params = {}) {
    try {
      const response = await apiClient.get('/admin/system/activity', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch system activity');
    }
  },

  // System configuration
  async getSystemConfig(category) {
    try {
      const response = await apiClient.get(`/admin/system/config/${category}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch system config');
    }
  },

  async updateSystemConfig(category, key, configData) {
    try {
      const response = await apiClient.put(`/admin/system/config/${category}/${key}`, configData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to update system config');
    }
  },

  // LDAP operations
  async testLdapConnection() {
    try {
      const response = await apiClient.post('/admin/ldap/test-connection');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'LDAP connection test failed');
    }
  },

  async syncLdapUsers() {
    try {
      const response = await apiClient.post('/admin/ldap/sync-users');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'LDAP user sync failed');
    }
  },

  // Azure AD operations
  async testAzureAdConnection() {
    try {
      const response = await apiClient.post('/admin/azure-ad/test-connection');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Azure AD connection test failed');
    }
  },

  async syncAzureAdUsers() {
    try {
      const response = await apiClient.post('/admin/azure-ad/sync-users');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Azure AD user sync failed');
    }
  },

  // Utility functions
  getRoleDisplayName(role) {
    const roleNames = {
      'SUPER_ADMIN': 'Super Administrator',
      'ADMIN': 'Administrator',
      'CERTIFICATE_MANAGER': 'Certificate Manager',
      'F5_OPERATOR': 'F5 Operator',
      'AUDITOR': 'Auditor',
      'OPERATOR': 'Operator',
      'VIEWER': 'Viewer'
    };
    return roleNames[role] || role;
  },

  getAuthTypeDisplayName(authType) {
    const authTypes = {
      'LOCAL': 'Local Account',
      'LDAP': 'LDAP/Active Directory',
      'AZURE_AD': 'Azure AD/Microsoft 365',
      'SAML': 'SAML SSO'
    };
    return authTypes[authType] || authType;
  },

  getRoleColor(role) {
    const roleColors = {
      'SUPER_ADMIN': 'error',
      'ADMIN': 'warning',
      'CERTIFICATE_MANAGER': 'info',
      'F5_OPERATOR': 'primary',
      'AUDITOR': 'secondary',
      'OPERATOR': 'default',
      'VIEWER': 'default'
    };
    return roleColors[role] || 'default';
  },

  getAuthTypeColor(authType) {
    const authTypeColors = {
      'LOCAL': 'default',
      'LDAP': 'primary',
      'AZURE_AD': 'info',
      'SAML': 'secondary'
    };
    return authTypeColors[authType] || 'default';
  }
};