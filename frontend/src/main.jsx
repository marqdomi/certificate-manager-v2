// frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { CustomThemeProvider } from './context/ThemeContext'; // <-- Importar

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Envolver la aplicación completa */}
    <CustomThemeProvider>
      <App />
    </CustomThemeProvider>
  </React.StrictMode>
);