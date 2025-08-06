// frontend/src/theme.js

import { createTheme } from '@mui/material/styles';

// --- 1. Paleta de Colores de Marca (Centralizada) ---
const soleraPurple = '#5A31A0';
const soleraTeal = '#0dc6e7ff';

// --- 2. Función Generadora de Tema (Mejor Práctica) ---
export const getDesignTokens = (mode) => ({
  palette: {
    mode,
    primary: {
      main: soleraPurple,
    },
    secondary: {
      main: soleraTeal,
    },
    ...(mode === 'dark'
      ? {
          // --- PALETA MODO OSCURO (Sin cambios, ya era perfecta) ---
          background: {
            default: '#121826',
            paper: '#1A2133',
          },
          text: {
            primary: '#E0E0E0',
            secondary: '#A0A0A0',
          },
          success: { main: '#33b864' },
          warning: { main: '#ffb74d' },
          error: { main: '#e57373' },
        }
      : {
          // --- PALETA MODO CLARO (Ajustada para la nueva identidad) ---
          background: {
            default: '#F8F9FA', // Un blanco roto muy sutil que combina con todo
            paper: '#ffffff',
          },
          text: {
            primary: '#1C2025',
            secondary: '#64748B',
          },
          success: { main: '#2e7d32' },
          warning: { main: '#ed6c02' },
          error: { main: '#d32f2f' },
        }),
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    // ✅ --- ¡AQUÍ ESTÁ LA MODIFICACIÓN PRINCIPAL! --- ✅
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }) => ({
          backdropFilter: 'blur(10px)',
          boxShadow: 'none',
          
          // Usamos una lógica condicional para el estilo de la AppBar
          ...(theme.palette.mode === 'dark'
            ? { // Estilo para MODO OSCURO
                backgroundColor: 'rgba(26, 33, 51, 0.7)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                color: theme.palette.text.primary,
              }
            : { // Estilo para MODO CLARO
                background: `linear-gradient(90deg, ${soleraPurple} 0%, #0bc0d1ff 100%)`, // Usamos un Teal más oscuro para mejor contraste
                borderBottom: 'none', // Sin borde inferior cuando hay degradado
                color: '#ffffff', // El texto debe ser blanco para ser legible sobre el degradado
              }
          ),
        }),
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 'bold',
        },
        contained: {
            boxShadow: 'none',
            '&:hover': {
                boxShadow: 'none',
            }
        }
      },
    },
    // No necesitamos tocar MuiPaper aquí, ya que el estilo de vidrio se aplica localmente
  },
});

// --- 4. Exportamos los Temas para usarlos en la App ---
export const lightTheme = createTheme(getDesignTokens('light'));
export const darkTheme = createTheme(getDesignTokens('dark'));