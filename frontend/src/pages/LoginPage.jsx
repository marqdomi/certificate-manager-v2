// frontend/src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, TextField, Button, Typography, Paper, Alert } from '@mui/material';
import axios from 'axios';
import CircularProgress from '@mui/material/CircularProgress';
import { jwtDecode } from 'jwt-decode';

// --- 1. Importamos la imagen de fondo y el logo ---
import loginBg from '../assets/login-background.png'; 
import soleraLogo from '../assets/solera_logo.svg';

// El servicio de autenticación ahora maneja el token
export const authProvider = {
    login: async (username, password) => {
        const params = new URLSearchParams();
        params.append('username', username);
        params.append('password', password);

        const response = await axios.post('http://localhost:8000/api/v1/auth/token', params);
        
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
    logout: () => {
        localStorage.removeItem('user_token');
        localStorage.removeItem('user_role'); // No olvides borrarlo al cerrar sesión
    },
    getRole: () => {
        return localStorage.getItem('user_role');
    },
    getToken: () => {
        return localStorage.getItem('user_token');
    },
    isAuthenticated: () => {
        return !!localStorage.getItem('user_token');
    }
};

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // Añadimos estado de carga
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true); // Activamos el spinner
    try {
      const success = await authProvider.login(username, password);
      if (success) {
        navigate(from, { replace: true });
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError('Incorrect username or password.');
    } finally {
        setLoading(false); // Desactivamos el spinner
    }
  };

  return (
    // Contenedor principal con el fondo
    <Box
      sx={{
        minHeight: '100vh',
        backgroundImage: `url(${loginBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        alignItems: 'center',
        // --- ✅ CORRECCIÓN APLICADA AQUÍ ---
        // Centramos el contenido horizontalmente en TODOS los tamaños de pantalla.
        justifyContent: 'center',
        px: { xs: 2, sm: 4 }, // Padding horizontal para que no se pegue a los bordes en móvil
      }}
    >
      {/* La tarjeta de login, ahora con un diseño más limpio y moderno */}
      <Paper 
        elevation={12} 
        sx={{ 
          p: { xs: 3, sm: 4 }, 
          width: '100%', 
          maxWidth: '420px',
          // Mantenemos el efecto de vidrio esmerilado que tenías
          backgroundColor: (theme) => 
            theme.palette.mode === 'dark' 
              ? 'rgba(30, 30, 30, 0.75)'   // Fondo oscuro para modo oscuro
              : 'rgba(255, 255, 255, 0.7)', // Fondo claro para modo claro
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
      </Paper>
    </Box>
  );
};

export default LoginPage;