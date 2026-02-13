// frontend/src/pages/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Paper, 
  Alert,
  Divider,
  CircularProgress
} from '@mui/material';
import MicrosoftIcon from '@mui/icons-material/Microsoft';
import apiClient from '../services/api';
import { jwtDecode } from 'jwt-decode';
import azureAuthService from '../services/azureAuthService';
import { AZURE_BRAND } from '../constants/designTokens';

// --- 1. Importamos la imagen de fondo y el logo ---
import loginBg from '../assets/login-background.png'; 
import soleraLogo from '../assets/solera_logo.svg';

// El servicio de autenticación ahora maneja el token
export const authProvider = {
    login: async (username, password) => {
        const params = new URLSearchParams();
        params.append('username', username);
        params.append('password', password);

        const response = await apiClient.post('/auth/token', params);
        
        if (response.data.access_token) {
            const token = response.data.access_token;
            const decodedToken = jwtDecode(token); // Decodificamos el token

            localStorage.setItem('user_token', token);
            // ¡Guardamos el rol del usuario!
            localStorage.setItem('user_role', decodedToken.role); 
            return true;
        }
        return false;
    },
    loginWithAzureToken: (token, user) => {
        const decodedToken = jwtDecode(token);
        localStorage.setItem('user_token', token);
        localStorage.setItem('user_role', decodedToken.role);
        localStorage.setItem('auth_provider', 'azure_ad');
        return true;
    },
    logout: () => {
        localStorage.removeItem('user_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('auth_provider');
    },
    getRole: () => {
        return localStorage.getItem('user_role');
    },
    getToken: () => {
        return localStorage.getItem('user_token');
    },
    getAuthProvider: () => {
        return localStorage.getItem('auth_provider') || 'local';
    },
    isAuthenticated: () => {
        return !!localStorage.getItem('user_token');
    }
};

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [azureLoading, setAzureLoading] = useState(false);
  const [authConfig, setAuthConfig] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/";

  // Load auth configuration on mount
  useEffect(() => {
    const loadAuthConfig = async () => {
      try {
        const config = await azureAuthService.init();
        setAuthConfig(config);
      } catch (err) {
        console.log('Could not load auth config, using local auth only');
        setAuthConfig({ local_auth_enabled: true, azure_ad_enabled: false });
      }
    };
    loadAuthConfig();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const success = await authProvider.login(username, password);
      if (success) {
        navigate(from, { replace: true });
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Incorrect username or password.');
    } finally {
        setLoading(false);
    }
  };

  const handleAzureLogin = async () => {
    setError('');
    setAzureLoading(true);
    try {
      const result = await azureAuthService.loginWithPopup();
      if (result.access_token) {
        authProvider.loginWithAzureToken(result.access_token, result.user);
        navigate(from, { replace: true });
      }
    } catch (err) {
      if (err.message !== 'Login cancelled') {
        setError(err.message || 'Azure AD login failed');
      }
    } finally {
      setAzureLoading(false);
    }
  };

  const showLocalAuth = authConfig?.local_auth_enabled !== false;
  const showAzureAuth = authConfig?.azure_ad_enabled === true;
  const showDivider = showLocalAuth && showAzureAuth;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundImage: `url(${loginBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: { xs: 2, sm: 4 },
      }}
    >
      <Paper 
        elevation={12} 
        sx={{ 
          p: { xs: 3, sm: 4 }, 
          width: '100%', 
          maxWidth: '420px',
          backgroundColor: (theme) => 
            theme.palette.mode === 'dark' 
              ? 'rgba(30, 30, 30, 0.75)'
              : 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 2 }}>
          <img src={soleraLogo} alt="Solera Logo" style={{ height: '30px' }} />
        </Box>
        
        <Typography variant="h6" component="h1" align="center" gutterBottom color="text.primary">
          Certificate Management Tool
        </Typography>

        {/* Azure AD Login Button */}
        {showAzureAuth && (
          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              fullWidth
              onClick={handleAzureLogin}
              disabled={azureLoading}
              startIcon={azureLoading ? <CircularProgress size={20} /> : <MicrosoftIcon />}
              sx={{
                py: 1.5,
                borderColor: AZURE_BRAND.primary,
                color: AZURE_BRAND.primary,
                '&:hover': {
                  borderColor: AZURE_BRAND.hover,
                  backgroundColor: `${AZURE_BRAND.primary}14`,
                },
              }}
            >
              {azureLoading ? 'Signing in...' : 'Sign in with Microsoft'}
            </Button>
          </Box>
        )}

        {/* Divider */}
        {showDivider && (
          <Divider sx={{ my: 3 }}>
            <Typography variant="body2" color="text.secondary">
              or
            </Typography>
          </Divider>
        )}

        {/* Local Login Form */}
        {showLocalAuth && (
          <form onSubmit={handleSubmit}>
            <TextField
              label="Username"
              variant="outlined"
              fullWidth
              margin="normal"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <TextField
              label="Password"
              type="password"
              variant="outlined"
              fullWidth
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <Alert severity="error" sx={{ mt: 2, mb: 1 }}>{error}</Alert>}
            <Button 
              type="submit" 
              variant="contained" 
              fullWidth 
              disabled={loading}
              sx={{ 
                mt: 3, 
                py: 1.5, 
                fontSize: '1rem',
                bgcolor: 'primary.main',
                '&:hover': {
                  bgcolor: 'primary.dark',
                }
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Login'}
            </Button>
          </form>
        )}

        {/* Error display for Azure-only mode */}
        {!showLocalAuth && error && (
          <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
        )}
      </Paper>
      
      {/* App name and version footer */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 12,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: 0.85,
        }}
      >
        <Typography variant="caption">
          {typeof __APP_NAME__ !== 'undefined' ? __APP_NAME__ : 'CMT'}
          {typeof __APP_VERSION__ !== 'undefined' ? ` v${__APP_VERSION__}` : ''}
        </Typography>
      </Box>
    </Box>
  );
};

export default LoginPage;