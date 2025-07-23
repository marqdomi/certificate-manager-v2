// frontend/src/pages/DashboardPage.jsx

import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import Dashboard from '../components/Dashboard'; // Asumimos que este componente existe
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';

function DashboardPage() {
  const [stats, setStats] = useState(null); // Inicia como null para manejar el estado de carga
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    apiClient.get('/certificates')
      .then(response => {
        const certs = response.data;
        const total = certs.length;
        const healthy = certs.filter(c => c.days_remaining > 30).length;
        const warning = certs.filter(c => c.days_remaining > 0 && c.days_remaining <= 30).length;
        const expired = certs.filter(c => c.days_remaining <= 0).length;
        setStats({ total, healthy, warning, expired });
      })
      .catch(error => console.error("Error fetching data for dashboard:", error))
      .finally(() => setLoading(false));
  }, []);

  const handleDashboardFilter = (filter) => {
    navigate('/certificates', { state: { initialFilter: filter, searchTerm: '' } });
  };

  // Un estado de carga más elegante y centrado
  if (loading || !stats) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 64px)' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    // Contenedor principal de la página con padding para dar "aire"
    <Box sx={{ p: { xs: 2, sm: 3 }, flexGrow: 1 }}>
      <Typography 
        variant="h4" 
        component="h1" 
        sx={{ 
          fontWeight: 'bold', 
          mb: 4, // Margen inferior para separar del contenido
          color: 'text.primary' // Usa el color de texto primario del tema
        }}
      >
        Dashboard Overview
      </Typography>

      {/* El componente Dashboard renderizará todos los widgets */}
      <Dashboard stats={stats} onFilterSelect={handleDashboardFilter} />

    </Box>
  );
}

export default DashboardPage;