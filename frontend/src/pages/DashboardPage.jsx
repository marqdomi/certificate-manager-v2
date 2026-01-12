// frontend/src/pages/DashboardPage.jsx
// Phase 2: Auto-refresh, Skeleton Loading, Animations
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Skeleton, 
  Grid, 
  Paper, 
  IconButton, 
  Tooltip, 
  Chip,
  LinearProgress,
  alpha,
  useTheme
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Dashboard from '../components/Dashboard';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';

// Auto-refresh interval in milliseconds (60 seconds)
const AUTO_REFRESH_INTERVAL = 60000;

// Skeleton components for loading state
const SkeletonStatCard = () => (
  <Paper 
    elevation={0}
    sx={{ 
      p: 2.5,
      height: 120,
      borderRadius: '16px',
      backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(26, 33, 51, 0.6)' : 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(12px)',
      border: '1px solid',
      borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    <Skeleton variant="circular" width={32} height={32} sx={{ mb: 1 }} />
    <Skeleton variant="text" width={80} height={20} />
    <Skeleton variant="text" width={60} height={40} />
  </Paper>
);

const SkeletonChart = ({ height = 300 }) => (
  <Paper 
    elevation={0}
    sx={{ 
      p: 2.5,
      height,
      borderRadius: '16px',
      backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(26, 33, 51, 0.6)' : 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(12px)',
      border: '1px solid',
      borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
    }}
  >
    <Skeleton variant="text" width={150} height={30} sx={{ mb: 2 }} />
    <Skeleton variant="rectangular" width="100%" height={height - 80} sx={{ borderRadius: 2 }} />
  </Paper>
);

const DashboardSkeleton = () => (
  <Grid container spacing={3}>
    {/* Top Stats Row */}
    {[1, 2, 3, 4].map(i => (
      <Grid item xs={6} sm={6} md={3} key={i}>
        <SkeletonStatCard />
      </Grid>
    ))}
    
    {/* Health Score + Trend */}
    <Grid item xs={12} md={4}>
      <SkeletonChart height={280} />
    </Grid>
    <Grid item xs={12} md={8}>
      <SkeletonChart height={280} />
    </Grid>
    
    {/* Timeline + Devices */}
    <Grid item xs={12} md={8}>
      <SkeletonChart height={300} />
    </Grid>
    <Grid item xs={12} md={4}>
      <SkeletonChart height={300} />
    </Grid>
    
    {/* Critical + Activity */}
    <Grid item xs={12} md={6}>
      <SkeletonChart height={350} />
    </Grid>
    <Grid item xs={12} md={6}>
      <SkeletonChart height={350} />
    </Grid>
  </Grid>
);

function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [nextRefreshIn, setNextRefreshIn] = useState(AUTO_REFRESH_INTERVAL / 1000);
  const navigate = useNavigate();
  const theme = useTheme();
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    
    try {
      // Fetch all data in parallel
      const [certsRes, devicesRes, csrRes, auditRes] = await Promise.all([
        apiClient.get('/certificates/'),
        apiClient.get('/devices/'),
        apiClient.get('/csr/pending').catch(() => ({ data: { pending_requests: [] } })),
        apiClient.get('/audit/stats?days=7').catch(() => ({ data: null })),
      ]);

      const certs = certsRes.data || [];
      const devices = devicesRes.data || [];
      const pendingCSRs = csrRes.data?.pending_requests || [];
      const auditStats = auditRes.data;

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

      // Device summary
      const deviceStats = {
        total: devices.length,
        withCreds: devices.filter(d => d?.has_credential || d?.username).length,
        withoutCreds: devices.filter(d => !d?.has_credential && !d?.username).length,
        active: devices.filter(d => d?.ha_state === 'ACTIVE').length,
        standby: devices.filter(d => d?.ha_state === 'STANDBY').length,
      };

      // Pending renewals summary
      const pendingRenewals = {
        total: pendingCSRs.length,
        items: pendingCSRs.slice(0, 5).map(csr => ({
          id: csr.id,
          commonName: csr.common_name,
          status: csr.status,
          createdAt: csr.created_at,
        })),
      };

      setStats({ 
        total, 
        healthy, 
        warning, 
        expired,
        expirationBands,
        topDevices,
        deviceStats,
        pendingRenewals,
        auditStats,
        certificates: certs,
        devices: devices, // Phase 3: pass devices for site grouping
      });
      setLastRefresh(new Date());
      setNextRefreshIn(AUTO_REFRESH_INTERVAL / 1000);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error fetching data for dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        loadData();
      }, AUTO_REFRESH_INTERVAL);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, loadData]);

  // Countdown timer effect
  useEffect(() => {
    if (autoRefresh) {
      countdownRef.current = setInterval(() => {
        setNextRefreshIn(prev => {
          if (prev <= 1) return AUTO_REFRESH_INTERVAL / 1000;
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [autoRefresh]);

  const handleManualRefresh = () => {
    loadData(true);
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(prev => !prev);
  };

  const handleDashboardFilter = (filter) => {
    navigate('/certificates', { state: { initialFilter: filter, searchTerm: '' } });
  };

  const formatLastRefresh = () => {
    const now = new Date();
    const diff = Math.floor((now - lastRefresh) / 1000);
    if (diff < 5) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return lastRefresh.toLocaleTimeString();
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, flexGrow: 1 }}>
      {/* Header with refresh controls */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
          Dashboard Overview
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Last refresh indicator */}
          <Chip
            size="small"
            label={`Updated ${formatLastRefresh()}`}
            sx={{ 
              bgcolor: alpha(theme.palette.info.main, 0.1),
              color: 'text.secondary',
              fontSize: '0.75rem'
            }}
          />
          
          {/* Auto-refresh countdown */}
          {autoRefresh && (
            <Tooltip title="Next auto-refresh">
              <Chip
                size="small"
                label={`${nextRefreshIn}s`}
                color="primary"
                variant="outlined"
                sx={{ minWidth: 50, fontSize: '0.75rem' }}
              />
            </Tooltip>
          )}
          
          {/* Toggle auto-refresh */}
          <Tooltip title={autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}>
            <IconButton 
              size="small" 
              onClick={toggleAutoRefresh}
              sx={{ 
                bgcolor: alpha(autoRefresh ? theme.palette.success.main : theme.palette.grey[500], 0.1),
                '&:hover': {
                  bgcolor: alpha(autoRefresh ? theme.palette.success.main : theme.palette.grey[500], 0.2),
                }
              }}
            >
              {autoRefresh ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          
          {/* Manual refresh button */}
          <Tooltip title="Refresh now">
            <IconButton 
              size="small" 
              onClick={handleManualRefresh}
              disabled={refreshing}
              sx={{ 
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.2),
                }
              }}
            >
              <RefreshIcon 
                fontSize="small" 
                sx={{ 
                  animation: refreshing ? 'spin 1s linear infinite' : 'none',
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                  }
                }} 
              />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Loading progress bar during refresh */}
      {refreshing && (
        <LinearProgress 
          sx={{ 
            mb: 2, 
            borderRadius: 1,
            height: 3,
          }} 
        />
      )}

      {/* Main content */}
      {loading ? (
        <DashboardSkeleton />
      ) : (
        <Dashboard stats={stats} onFilterSelect={handleDashboardFilter} />
      )}
    </Box>
  );
}

export default DashboardPage;