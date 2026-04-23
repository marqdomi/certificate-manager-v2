// frontend/src/pages/DashboardPage.jsx
import React, { useState, useEffect } from 'react';
import { Box, Typography, Skeleton, Grid, Paper } from '@mui/material';
import RobustDashboard from '../components/RobustDashboard';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';

function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [systemStats, setSystemStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        // Load certificates data
        const { data: certs } = await apiClient.get('/certificates/');
        if (!active) return;

        const total = certs.length ?? 0;
        const healthy = certs.filter(c => (c?.days_remaining ?? 0) > 30).length;
        const warning = certs.filter(c => (c?.days_remaining ?? 0) > 0 && (c?.days_remaining ?? 0) <= 30).length;
        const expired = certs.filter(c => (c?.days_remaining ?? 0) <= 0).length;

        setStats({ total, healthy, warning, expired });

        // Load system statistics for device metrics
        try {
          const { data: sysStats } = await apiClient.get('/admin/system/stats');
          if (active) setSystemStats(sysStats);
        } catch (sysErr) {
          console.warn('Could not load system stats (may need admin permissions):', sysErr);
          // Set fallback device data if system stats fail
          setSystemStats({ devices: { total: 0, active: 0, inactive: 0 } });
        }

        setLastUpdated(new Date());
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

  // Skeleton Loading Component
  const DashboardSkeleton = () => (
    <Box sx={{ p: { xs: 2, sm: 3 }, flexGrow: 1 }}>
      <Skeleton variant="text" width={300} height={48} sx={{ mb: 4 }} />
      <Grid container spacing={3}>
        {[...Array(4)].map((_, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Paper 
              elevation={0}
              sx={{ 
                p: { xs: 2, sm: 2.5 },
                height: 120,
                backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(26, 33, 51, 0.6)' : 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(12px)',
                border: '1px solid',
                borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Skeleton variant="text" width={120} height={24} sx={{ mb: 1 }} />
              <Skeleton variant="text" width={60} height={40} />
            </Paper>
          </Grid>
        ))}
        <Grid item xs={12}>
          <Paper 
            elevation={0}
            sx={{ 
              p: { xs: 2, sm: 2.5 },
              height: 400,
              backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(26, 33, 51, 0.6)' : 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(12px)',
              border: '1px solid',
              borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Skeleton variant="text" width={250} height={32} sx={{ mb: 2 }} />
            <Skeleton variant="circular" width={200} height={200} />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );

  if (loading || !stats) {
    return <DashboardSkeleton />;
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, flexGrow: 1 }}>
      <RobustDashboard 
        stats={stats} 
        systemStats={systemStats}
        lastUpdated={lastUpdated} 
      />
    </Box>
  );
}

export default DashboardPage;