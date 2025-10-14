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
        root: ({ theme }) => ({
          backdropFilter: 'blur(10px)',
          boxShadow: 'none',
          ...(theme.palette.mode === 'dark'
            ? {
                backgroundColor: 'rgba(26, 33, 51, 0.7)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                color: theme.palette.text.primary,
              }
            : {
                background: `linear-gradient(90deg, ${soleraPurple} 0%, ${soleraTealDark} 100%)`,
                borderBottom: 'none',
                color: '#ffffff',
              }),
        }),
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 'bold' },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
      },
    },
  },
});

// --- Temas exportados ---
export const lightTheme = createTheme(getDesignTokens('light'));
export const darkTheme = createTheme(getDesignTokens('dark'));