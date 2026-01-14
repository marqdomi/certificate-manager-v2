// frontend/src/services/azureAuthConfig.js
/**
 * Azure AD (Microsoft Entra ID) Authentication Configuration
 * 
 * This file contains the MSAL configuration for Azure AD authentication.
 * The configuration values are loaded from environment variables.
 */

// Configuration object
const getAzureConfig = () => {
  // These will be fetched from the backend /auth/config endpoint
  return {
    clientId: import.meta.env.VITE_AZURE_AD_CLIENT_ID || '',
    tenantId: import.meta.env.VITE_AZURE_AD_TENANT_ID || '',
    redirectUri: import.meta.env.VITE_AZURE_AD_REDIRECT_URI || window.location.origin,
  };
};

// MSAL configuration builder
export const getMsalConfig = (config) => ({
  auth: {
    clientId: config.clientId,
    authority: `https://login.microsoftonline.com/${config.tenantId}`,
    redirectUri: config.redirectUri,
    postLogoutRedirectUri: config.redirectUri,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'sessionStorage', // Use sessionStorage for security
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return;
        }
        switch (level) {
          case 0: // Error
            console.error(message);
            break;
          case 1: // Warning
            console.warn(message);
            break;
          case 2: // Info
            console.info(message);
            break;
          case 3: // Verbose
            console.debug(message);
            break;
          default:
            break;
        }
      },
      logLevel: import.meta.env.DEV ? 3 : 0, // Verbose in dev, Error only in prod
    },
  },
});

// Login request scopes
export const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
};

// API request scopes (for protected API calls)
export const apiRequest = (config) => ({
  scopes: [`api://${config.clientId}/access_as_user`],
});

export default getAzureConfig;
