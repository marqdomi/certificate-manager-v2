// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// --- COMPONENTES PRINCIPALES ---
import MainLayout from './components/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

// --- PÁGINAS DE LA APLICACIÓN ---
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import DevicesPage from './pages/DevicesPage';
import PfxPage from './pages/PfxPage';
import CsrGeneratorPage from './pages/CsrGeneratorPage';
import DeployCenterPage from './pages/DeployCenterPage';
import DiscoveryPage from './pages/DiscoveryPage';
import AuditLogPage from './pages/AuditLogPage';
import BatchRenewalPage from './pages/BatchRenewalPage';
import NotificationsPage from './pages/NotificationsPage';
import CertificateCleanupPage from './pages/CertificateCleanupPage';
import HostSearchPage from './pages/HostSearchPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import CredentialTemplatesPage from './pages/CredentialTemplatesPage';
import CertMasterPage from './pages/CertMasterPage';
import AuthCallback from './pages/AuthCallback';

// --- PÁGINAS DE ADMINISTRACIÓN ---
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import SystemHealth from './pages/admin/SystemHealth';

// --- CONTEXT PROVIDERS ---
import { AuthProvider } from './context/AuthContext';

function App() {
  const basename = import.meta.env.VITE_ROUTER_BASENAME || '/';

  return (
    <ErrorBoundary>
    <Router basename={basename}>
      <AuthProvider>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

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
                    <Route path="/batch-renewal" element={<BatchRenewalPage />} />
                    <Route path="/certificate-cleanup" element={<CertificateCleanupPage />} />
                    <Route path="/host-search" element={<HostSearchPage />} />
                    <Route path="/audit-log" element={<AuditLogPage />} />
                    <Route path="/notifications" element={<NotificationsPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/cert-master" element={<CertMasterPage />} />
                    
                    {/* Admin Routes */}
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/users" element={<UserManagement />} />
                    <Route path="/admin/health" element={<SystemHealth />} />
                    <Route path="/admin/credentials" element={<CredentialTemplatesPage />} />
                    
                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </MainLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
    </ErrorBoundary>
  );
}

export default App;