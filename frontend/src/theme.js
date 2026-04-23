// frontend/src/theme.js
import { createTheme } from '@mui/material/styles';

// --- Paleta de marca ---
const soleraPurple = '#5A31A0';
const soleraTeal = '#0dc6e7';   // 6 dígitos (compatibilidad)
const soleraTealDark = '#0bc0d1';

// --- Función generadora de tema ---
export const getDesignTokens = (mode) => ({
  palette: {
    mode,
    primary: { main: soleraPurple },
    secondary: { main: soleraTeal },
    ...(mode === 'dark'
      ? {
          background: { default: '#121826', paper: '#1A2133' },
          text: { primary: '#E0E0E0', secondary: '#A0A0A0' },
          success: { main: '#33b864' },
          warning: { main: '#ffb74d' },
          error: { main: '#e57373' },
        }
      : {
          background: { default: '#F8F9FA', paper: '#FFFFFF' },
          text: { primary: '#1C2025', secondary: '#64748B' },
          success: { main: '#2e7d32' },
          warning: { main: '#ed6c02' },
          error: { main: '#d32f2f' },
        }),
  },
  shape: { borderRadius: 12 },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          // Simplified styling to avoid theme issues
          backdropFilter: 'blur(12px)',
          boxShadow: 'none',
          background: 'transparent',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { 
          textTransform: 'none', 
          fontWeight: 'bold',
          borderRadius: 8,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': { 
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            transform: 'translateY(-1px)'
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 12,
          border: '1px solid rgba(0,0,0,0.12)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

// --- Temas exportados ---
export const lightTheme = createTheme(getDesignTokens('light'));
export const darkTheme = createTheme(getDesignTokens('dark'));