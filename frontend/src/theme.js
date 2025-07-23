// frontend/src/theme.js

import { createTheme } from '@mui/material/styles';

// --- 1. Paleta de Colores de Marca (Centralizada) ---
// Mantenemos tus colores base para consistencia de marca.
const soleraPurple = '#5A31A0';
const soleraTeal = '#13EDA6';

// --- 2. Función Generadora de Tema (Mejor Práctica) ---
// En lugar de dos temas separados, creamos una función que devuelve la configuración
// correcta según el modo ('light' o 'dark'). Esto evita repetir código.

export const getDesignTokens = (mode) => ({
  palette: {
    mode, // 'light' o 'dark'
    primary: {
      main: soleraPurple,
    },
    secondary: {
      main: soleraTeal,
    },
    // Usamos el operador ternario para definir las paletas específicas del modo.
    ...(mode === 'dark'
      ? {
          // ==================================================
          // =============== PALETA MODO OSCURO ===============
          // ==================================================
          // Objetivo: Alto contraste, profundidad y look profesional.
          background: {
            default: '#121826', // Un azul marino/gris muy oscuro en lugar de negro. Es más sofisticado.
            paper: '#1A2133',   // Un tono ligeramente más claro para las "superficies" como tarjetas y tablas. Esto crea profundidad.
          },
          text: {
            primary: '#E0E0E0',   // NUNCA blanco puro. Un gris muy claro reduce la fatiga visual.
            secondary: '#A0A0A0', // Un gris más suave para textos secundarios, con buen contraste.
          },
          // Colores de estado ajustados para el modo oscuro (menos "brillantes")
          success: {
            main: '#33b864', // Un verde más desaturado y agradable a la vista.
          },
          warning: {
            main: '#ffb74d', // Un naranja ligeramente más suave.
          },
          error: {
            main: '#e57373', // Un rojo menos agresivo.
          },
        }
      : {
          // =================================================
          // =============== PALETA MODO CLARO ===============
          // =================================================
          // Objetivo: Limpio, aireado y profesional.
          background: {
            default: '#f4f7fa', // Un fondo blanco roto/gris muy claro. Más suave que el gris que tenías.
            paper: '#ffffff',
          },
          text: {
            primary: '#1C2025',   // Un negro suave en lugar de #333 para un look más moderno.
            secondary: '#64748B', // Un gris azulado para texto secundario.
          },
          success: {
            main: '#2e7d32',
          },
          warning: {
            main: '#ed6c02',
          },
          error: {
            main: '#d32f2f',
          },
        }),
  },

  // --- 3. Personalizaciones Globales de Componentes ---
  // Aquí es donde añadimos la "personalidad" a la aplicación.
  shape: {
    borderRadius: 12, // Bordes más redondeados para un look más moderno en todo.
  },
  components: {
    // Sobrescribimos el estilo por defecto de la AppBar (barra superior)
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(26, 33, 51, 0.7)' : 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(10px)',
          boxShadow: 'none',
          borderBottom: '1px solid',
          borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          color: theme.palette.text.primary,
        }),
      },
    },
    // Estilo base para todas las tarjetas y superficies
    MuiPaper: {
      styleOverrides: {
        root: {
          // Por defecto, las tarjetas no tendrán el efecto de vidrio,
          // lo aplicaremos nosotros donde queramos para tener más control.
          // Pero sí tendrán el borde redondeado que definimos arriba.
        },
      },
    },
    // Un pequeño detalle para los botones
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none', // Botones con texto normal, no TODO MAYÚSCULAS.
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
  },
});

// --- 4. Exportamos los Temas para usarlos en la App ---
export const lightTheme = createTheme(getDesignTokens('light'));
export const darkTheme = createTheme(getDesignTokens('dark'));