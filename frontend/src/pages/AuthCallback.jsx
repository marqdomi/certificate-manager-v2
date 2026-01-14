// frontend/src/pages/AuthCallback.jsx
/**
 * Azure AD Authentication Callback Page
 * 
 * This page handles the redirect/popup callback from Azure AD after login.
 * It parses the URL fragment, extracts the token, and completes the authentication.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  CircularProgress, 
  Typography, 
  Alert,
  Paper
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import azureAuthService from '../services/azureAuthService';
import api from '../services/api';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const result = azureAuthService.handleCallback();
        
        // If this is a popup, the parent window handles everything
        if (result.isPopup) {
          // Just close after sending the message
          setTimeout(() => window.close(), 100);
          return;
        }

        // Handle full page redirect
        if (result.error) {
          setError(`${result.error}: ${result.error_description}`);
          setProcessing(false);
          return;
        }

        if (result.id_token) {
          // Exchange the ID token for our app token
          const response = await api.post('/auth/azure-ad/token', {
            id_token: result.id_token
          });

          // Store the token and user info
          const { access_token, user } = response.data;
          login(access_token, user);

          // Clear the stored return URL
          sessionStorage.removeItem('azure_ad_return_url');

          // Navigate to the original page or dashboard
          navigate(result.return_url || '/', { replace: true });
        } else {
          setError('No token received from Azure AD');
          setProcessing(false);
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err.response?.data?.detail || err.message || 'Authentication failed');
        setProcessing(false);
      }
    };

    handleCallback();
  }, [login, navigate]);

  if (processing) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 3 }}>
          Completing sign in...
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Please wait while we verify your credentials
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
          p: 3,
        }}
      >
        <Paper sx={{ p: 4, maxWidth: 500, textAlign: 'center' }}>
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            There was a problem signing you in with Microsoft.
          </Typography>
          <Typography 
            variant="body2" 
            color="primary"
            sx={{ cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => navigate('/login')}
          >
            Return to login page
          </Typography>
        </Paper>
      </Box>
    );
  }

  return null;
};

export default AuthCallback;
