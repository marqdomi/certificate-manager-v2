// frontend/src/context/ThemeContext.jsx
import React, { createContext, useState, useMemo, useContext, useCallback, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { lightTheme, darkTheme } from '../theme';

// Proporciona un valor por defecto claro para evitar undefined si alguien usa el contexto fuera del provider
const ThemeContext = createContext({
  mode: 'light',
  toggleTheme: () => {},
});

export const CustomThemeProvider = ({ children }) => {
  // Detecta preferencia del sistema al primer render (solo en cliente)
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Inicializa el modo desde localStorage si existe, si no respeta la preferencia del sistema
  const [mode, setMode] = useState(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem('cm-theme-mode') : null;
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // ignore storage errors
    }
    return prefersDark ? 'dark' : 'light';
  });

  // Persiste el modo en localStorage cuando cambie
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('cm-theme-mode', mode);
      }
    } catch {
      // ignore storage errors
    }
  }, [mode]);

  // Evita recrear la función en cada render
  const toggleTheme = useCallback(() => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  }, []);

  // useMemo evita recalcular el tema en cada render
  const theme = useMemo(() => (mode === 'light' ? lightTheme : darkTheme), [mode]);

  const contextValue = useMemo(() => ({ mode, toggleTheme }), [mode, toggleTheme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>
        {/* CssBaseline resetea estilos y aplica el fondo del tema */}
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

// Hook para consumir el contexto
export const useThemeContext = () => useContext(ThemeContext);
export { ThemeContext };