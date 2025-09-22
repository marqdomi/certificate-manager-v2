// frontend/src/services/auth.js

import apiClient from './api';

export const authService = {
  async login(credentials) {
    try {
      const formData = new URLSearchParams();
      formData.append('username', credentials.username);
      formData.append('password', credentials.password);

      const response = await apiClient.post('/auth/token', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token, token_type, user } = response.data;
      
      // Store token
      localStorage.setItem('user_token', access_token);
      
      return {
        token: access_token,
        tokenType: token_type,
        user
      };
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Login failed');
    }
  },

  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      localStorage.removeItem('user_token');
      localStorage.removeItem('user_role');
    }
  },

  async getCurrentUser() {
    try {
      const response = await apiClient.get('/auth/users/me');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to get current user');
    }
  },

  async changePassword(passwordData) {
    try {
      const response = await apiClient.post('/auth/users/me/password', passwordData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to change password');
    }
  },

  async getAuthProviders() {
    try {
      const response = await apiClient.get('/auth/providers');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to get auth providers');
    }
  },

  async getAzureAdLoginUrl(redirectUri, state) {
    try {
      const response = await apiClient.get('/auth/azure-ad/login-url', {
        params: { redirect_uri: redirectUri, state }
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to get Azure AD login URL');
    }
  },

  async handleAzureAdCallback(authCode, redirectUri) {
    try {
      const response = await apiClient.post('/auth/azure-ad/callback', {
        authorization_code: authCode,
        redirect_uri: redirectUri
      });

      const { access_token, token_type, user } = response.data;
      
      // Store token
      localStorage.setItem('token', access_token);
      
      return {
        token: access_token,
        tokenType: token_type,
        user
      };
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Azure AD authentication failed');
    }
  },

  getToken() {
    return localStorage.getItem('token');
  },

  isAuthenticated() {
    return Boolean(this.getToken());
  }
};