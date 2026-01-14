// frontend/src/services/azureAuthService.js
/**
 * Azure AD Authentication Service
 * 
 * Provides Azure AD login functionality using MSAL.js
 * This is a simplified implementation that works without adding MSAL as a dependency.
 * It uses the popup flow via window.open and postMessage communication.
 */

import api from './api';

class AzureAuthService {
  constructor() {
    this.config = null;
    this.initialized = false;
    this.popupWindow = null;
  }

  /**
   * Initialize the service by fetching config from backend
   */
  async init() {
    if (this.initialized) return this.config;
    
    try {
      const response = await api.get('/auth/config');
      this.config = response.data;
      this.initialized = true;
      return this.config;
    } catch (error) {
      console.error('Failed to fetch auth config:', error);
      throw error;
    }
  }

  /**
   * Check if Azure AD is enabled
   */
  async isAzureADEnabled() {
    if (!this.initialized) {
      await this.init();
    }
    return this.config?.azure_ad_enabled || false;
  }

  /**
   * Check if local auth is enabled
   */
  async isLocalAuthEnabled() {
    if (!this.initialized) {
      await this.init();
    }
    return this.config?.local_auth_enabled !== false;
  }

  /**
   * Get auth mode
   */
  async getAuthMode() {
    if (!this.initialized) {
      await this.init();
    }
    return this.config?.auth_mode || 'local';
  }

  /**
   * Login with Azure AD using popup
   * Returns a promise that resolves with the user info after successful login
   */
  async loginWithPopup() {
    if (!this.initialized) {
      await this.init();
    }

    if (!this.config?.azure_ad_enabled) {
      throw new Error('Azure AD authentication is not enabled');
    }

    const { azure_ad_tenant_id, azure_ad_client_id } = this.config;
    const redirectUri = `${window.location.origin}/auth/callback`;
    
    // Build the Microsoft login URL
    const authUrl = new URL(`https://login.microsoftonline.com/${azure_ad_tenant_id}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set('client_id', azure_ad_client_id);
    authUrl.searchParams.set('response_type', 'id_token');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('response_mode', 'fragment');
    authUrl.searchParams.set('nonce', this._generateNonce());
    authUrl.searchParams.set('prompt', 'select_account');

    return new Promise((resolve, reject) => {
      // Open popup
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      this.popupWindow = window.open(
        authUrl.toString(),
        'Azure AD Login',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );

      if (!this.popupWindow) {
        reject(new Error('Popup was blocked. Please allow popups for this site.'));
        return;
      }

      // Listen for callback message
      const messageHandler = async (event) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data?.type === 'AZURE_AD_CALLBACK') {
          window.removeEventListener('message', messageHandler);
          
          if (this.popupWindow) {
            this.popupWindow.close();
            this.popupWindow = null;
          }

          if (event.data.error) {
            reject(new Error(event.data.error));
            return;
          }

          if (event.data.id_token) {
            try {
              // Exchange the ID token for our app token
              const response = await api.post('/auth/azure-ad/token', {
                id_token: event.data.id_token
              });
              resolve(response.data);
            } catch (error) {
              reject(new Error(error.response?.data?.detail || 'Token exchange failed'));
            }
          }
        }
      };

      window.addEventListener('message', messageHandler);

      // Check if popup was closed
      const checkPopupClosed = setInterval(() => {
        if (this.popupWindow?.closed) {
          clearInterval(checkPopupClosed);
          window.removeEventListener('message', messageHandler);
          reject(new Error('Login cancelled'));
        }
      }, 500);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(checkPopupClosed);
        window.removeEventListener('message', messageHandler);
        if (this.popupWindow && !this.popupWindow.closed) {
          this.popupWindow.close();
        }
        reject(new Error('Login timeout'));
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Login with redirect (alternative to popup)
   */
  async loginWithRedirect() {
    if (!this.initialized) {
      await this.init();
    }

    if (!this.config?.azure_ad_enabled) {
      throw new Error('Azure AD authentication is not enabled');
    }

    const { azure_ad_tenant_id, azure_ad_client_id } = this.config;
    const redirectUri = `${window.location.origin}/auth/callback`;
    
    // Store current URL to redirect back after login
    sessionStorage.setItem('azure_ad_return_url', window.location.pathname);
    
    // Build the Microsoft login URL
    const authUrl = new URL(`https://login.microsoftonline.com/${azure_ad_tenant_id}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set('client_id', azure_ad_client_id);
    authUrl.searchParams.set('response_type', 'id_token');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('response_mode', 'fragment');
    authUrl.searchParams.set('nonce', this._generateNonce());
    authUrl.searchParams.set('prompt', 'select_account');

    window.location.href = authUrl.toString();
  }

  /**
   * Handle the callback from Azure AD
   * This should be called from the /auth/callback route
   */
  handleCallback() {
    // Check if this is a popup
    if (window.opener) {
      // Parse the hash fragment
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      
      const idToken = params.get('id_token');
      const error = params.get('error');
      const errorDescription = params.get('error_description');

      // Send message to parent window
      window.opener.postMessage({
        type: 'AZURE_AD_CALLBACK',
        id_token: idToken,
        error: error ? `${error}: ${errorDescription}` : null
      }, window.location.origin);

      return { isPopup: true };
    }

    // Full page redirect - parse and return the token
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    
    return {
      isPopup: false,
      id_token: params.get('id_token'),
      error: params.get('error'),
      error_description: params.get('error_description'),
      return_url: sessionStorage.getItem('azure_ad_return_url') || '/'
    };
  }

  /**
   * Logout from Azure AD
   */
  logout() {
    if (!this.config?.azure_ad_enabled) return;

    const { azure_ad_tenant_id } = this.config;
    const logoutUrl = new URL(`https://login.microsoftonline.com/${azure_ad_tenant_id}/oauth2/v2.0/logout`);
    logoutUrl.searchParams.set('post_logout_redirect_uri', window.location.origin);
    
    window.location.href = logoutUrl.toString();
  }

  /**
   * Generate a random nonce for OIDC
   */
  _generateNonce() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}

// Singleton instance
const azureAuthService = new AzureAuthService();
export default azureAuthService;
