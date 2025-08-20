// frontend/src/pages/DashboardPage.jsx
import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import Dashboard from '../components/Dashboard';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';

function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        // OJO: slash final para evitar redirect 307
        const { data: certs } = await apiClient.get('/certificates/');
        if (!active) return;

        const total = certs.length ?? 0;
        const healthy = certs.filter(c => (c?.days_remaining ?? 0) > 30).length;
        const warning = certs.filter(c => (c?.days_remaining ?? 0) > 0 && (c?.days_remaining ?? 0) <= 30).length;
        const expired = certs.filter(c => (c?.days_remaining ?? 0) <= 0).length;

        setStats({ total, healthy, warning, expired });
      } catch (err) {
        console.error('Error fetching data for dashboard:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, []);

  const handleDashboardFilter = (filter) => {
    navigate('/certificates', { state: { initialFilter: filter, searchTerm: '' } });
  };

  if (loading || !stats) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 64px)' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, flexGrow: 1 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 4, color: 'text.primary' }}>
        Dashboard Overview
      </Typography>
      <Dashboard stats={stats} onFilterSelect={handleDashboardFilter} />
    </Box>
  );
}

export default DashboardPage;