// frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { CustomThemeProvider } from './context/ThemeContext'; // <-- Importar

// Set document title with app name and version injected by Vite
try {
  const appName = typeof __APP_NAME__ !== 'undefined' ? __APP_NAME__ : 'CMT';
  const appVer  = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
  document.title = appVer ? `${appName} • v${appVer}` : appName;
} catch (_) {
  // no-op
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Envolver la aplicación completa */}
    <CustomThemeProvider>
      <App />
    </CustomThemeProvider>
  </React.StrictMode>
);