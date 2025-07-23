// frontend/src/App.jsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// --- COMPONENTES PRINCIPALES ---
import MainLayout from './components/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';

// --- PÁGINAS DE LA APLICACIÓN ---
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import DevicesPage from './pages/DevicesPage';
import PfxPage from './pages/PfxPage';
import CsrGeneratorPage from './pages/CsrGeneratorPage';
import DeployCenterPage from './pages/DeployCenterPage';

function App() {
  return (
    <Router>
      <Routes>
        {/* Ruta pública para el Login, fuera del layout principal */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Envolvemos TODAS las demás rutas en el ProtectedRoute y el MainLayout */}
        <Route
          path="/*" // Un comodín que captura cualquier otra ruta
          element={
            <ProtectedRoute>
              <MainLayout>
                {/* Aquí definimos el "mapa" de qué página mostrar para cada ruta */}
                <Routes>
                  {/* <Route path="/" element={<DashboardPage />} /> */}
                  <Route path="/dashboard" element={<DashboardPage />} /> {/* Ruta explícita para dashboard */}
                  <Route path="/certificates" element={<InventoryPage />} />
                  <Route path="/devices" element={<DevicesPage />} />
                  <Route path="/pfx-generator" element={<PfxPage />} />
                  <Route path="/generate-csr" element={<CsrGeneratorPage />} />
                  <Route path="/deploy" element={<DeployCenterPage />} />
                  
                  {/* Si no encuentra ninguna ruta, redirige al Dashboard */}
                  <Route path="*" element={<DashboardPage />} /> 
                  {/* Si alguien entra a la raíz '/', lo redirigimos a /dashboard */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </MainLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;