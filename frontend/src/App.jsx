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
import DiscoveryPage from './pages/DiscoveryPage';

function App() {
  const basename = import.meta.env.VITE_ROUTER_BASENAME || '/';

  return (
    <Router basename={basename}>
      <Routes>
        {/* Ruta pública para Login */}
        <Route path="/login" element={<LoginPage />} />

        {/* Todo lo demás, detrás de auth y dentro del layout */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/certificates" element={<InventoryPage />} />
                  <Route path="/devices" element={<DevicesPage />} />
                  <Route path="/discovery" element={<DiscoveryPage />} />
                  <Route path="/pfx-generator" element={<PfxPage />} />
                  <Route path="/generate-csr" element={<CsrGeneratorPage />} />
                  <Route path="/deploy" element={<DeployCenterPage />} />
                  {/* Fallback */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
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