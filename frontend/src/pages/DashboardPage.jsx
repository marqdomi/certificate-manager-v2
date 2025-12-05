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
        // Fetch certificates and devices in parallel
        const [certsRes, devicesRes] = await Promise.all([
          apiClient.get('/certificates/'),
          apiClient.get('/devices/')
        ]);
        if (!active) return;

        const certs = certsRes.data || [];
        const devices = devicesRes.data || [];

        // Basic stats
        const total = certs.length;
        const healthy = certs.filter(c => (c?.days_remaining ?? 0) > 30).length;
        const warning = certs.filter(c => (c?.days_remaining ?? 0) > 0 && (c?.days_remaining ?? 0) <= 30).length;
        const expired = certs.filter(c => (c?.days_remaining ?? 0) <= 0).length;

        // Expiration bands (more granular)
        const expirationBands = {
          expired: certs.filter(c => (c?.days_remaining ?? 0) <= 0).length,
          critical: certs.filter(c => (c?.days_remaining ?? 0) > 0 && (c?.days_remaining ?? 0) <= 7).length,
          urgent: certs.filter(c => (c?.days_remaining ?? 0) > 7 && (c?.days_remaining ?? 0) <= 30).length,
          soon: certs.filter(c => (c?.days_remaining ?? 0) > 30 && (c?.days_remaining ?? 0) <= 60).length,
          ok: certs.filter(c => (c?.days_remaining ?? 0) > 60 && (c?.days_remaining ?? 0) <= 90).length,
          healthy: certs.filter(c => (c?.days_remaining ?? 0) > 90).length,
        };

        // Certificates per device
        const certsPerDevice = {};
        certs.forEach(cert => {
          const deviceName = cert.f5_device_hostname || 'Unknown';
          certsPerDevice[deviceName] = (certsPerDevice[deviceName] || 0) + 1;
        });

        // Top 10 devices by cert count
        const topDevices = Object.entries(certsPerDevice)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, count]) => ({ name, count }));

        // Usage state distribution (if available)
        const usageStates = {
          active: certs.filter(c => c?.usage_state === 'active').length,
          noProfiles: certs.filter(c => c?.usage_state === 'no-profiles').length,
          profilesNoVips: certs.filter(c => c?.usage_state === 'profiles-no-vips').length,
          unknown: certs.filter(c => !c?.usage_state || c?.usage_state === 'unknown').length,
        };

        // Device summary
        const deviceStats = {
          total: devices.length,
          withCreds: devices.filter(d => d?.has_credential).length,
          withoutCreds: devices.filter(d => !d?.has_credential).length,
        };

        setStats({ 
          total, 
          healthy, 
          warning, 
          expired,
          expirationBands,
          topDevices,
          usageStates,
          deviceStats,
          certificates: certs, // For renewal history calculation
        });
      } catch (err) {
        if (import.meta.env.DEV) console.error('Error fetching data for dashboard:', err);
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