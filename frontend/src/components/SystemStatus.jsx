// frontend/src/components/SystemStatus.jsx

import React, { useState, useEffect } from 'react';
import {
  Box,
  Chip,
  IconButton,
  Popover,
  Typography,
  Stack,
  Divider,
  CircularProgress,
  Card,
  CardContent
} from '@mui/material';
import {
  CheckCircle as HealthyIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Cloud as CloudIcon,
  Storage as DatabaseIcon,
  Security as SecurityIcon,
  Speed as PerformanceIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

const SystemStatus = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [systemHealth, setSystemHealth] = useState({
    overall: 'healthy', // 'healthy', 'warning', 'error', 'loading'
    services: {
      api: { status: 'healthy', latency: '45ms', lastCheck: new Date() },
      database: { status: 'healthy', connections: 12, lastCheck: new Date() },
      cache: { status: 'warning', hitRate: '87%', lastCheck: new Date() },
      storage: { status: 'healthy', usage: '23%', lastCheck: new Date() },
      security: { status: 'healthy', alerts: 0, lastCheck: new Date() }
    }
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
        return <HealthyIcon sx={{ fontSize: 16 }} />;
      case 'warning':
        return <WarningIcon sx={{ fontSize: 16 }} />;
      case 'error':
        return <ErrorIcon sx={{ fontSize: 16 }} />;
      default:
        return <InfoIcon sx={{ fontSize: 16 }} />;
    }
  };

  const getOverallStatus = () => {
    const statuses = Object.values(systemHealth.services).map(service => service.status);
    if (statuses.includes('error')) return 'error';
    if (statuses.includes('warning')) return 'warning';
    return 'healthy';
  };

  const refreshSystemStatus = async () => {
    setIsRefreshing(true);
    
    // Simulate API call to check system health
    setTimeout(() => {
      // In a real app, this would be an actual API call
      setSystemHealth(prev => ({
        ...prev,
        services: {
          ...prev.services,
          api: { ...prev.services.api, lastCheck: new Date() },
          database: { ...prev.services.database, lastCheck: new Date() },
          cache: { ...prev.services.cache, lastCheck: new Date() },
          storage: { ...prev.services.storage, lastCheck: new Date() },
          security: { ...prev.services.security, lastCheck: new Date() }
        }
      }));
      setIsRefreshing(false);
    }, 1500);
  };

  useEffect(() => {
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      if (!isRefreshing) {
        refreshSystemStatus();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isRefreshing]);

  const formatLastCheck = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    return `${minutes} minutes ago`;
  };

  const currentStatus = getOverallStatus();

  return (
    <>
      <Chip
        icon={getStatusIcon(currentStatus)}
        label="System"
        color={getStatusColor(currentStatus)}
        variant="outlined"
        onClick={handleClick}
        sx={{
          height: 32,
          cursor: 'pointer',
          transition: 'all 0.2s',
          borderWidth: 1.5,
          fontWeight: 500,
          '&:hover': {
            backgroundColor: theme => theme.palette[getStatusColor(currentStatus)].light,
            transform: 'translateY(-1px)',
            boxShadow: 2
          }
        }}
      />

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          elevation: 8,
          sx: {
            minWidth: 320,
            mt: 1,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            background: theme => theme.palette.mode === 'dark' 
              ? 'linear-gradient(135deg, rgba(18, 18, 18, 0.95) 0%, rgba(32, 32, 32, 0.95) 100%)'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(250, 250, 250, 0.95) 100%)',
            backdropFilter: 'blur(10px)',
          }
        }}
      >
        <Box sx={{ p: 2 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              {getStatusIcon(currentStatus)}
              System Health
            </Typography>
            <IconButton 
              size="small" 
              onClick={refreshSystemStatus}
              disabled={isRefreshing}
              sx={{ 
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' }
                }
              }}
            >
              {isRefreshing ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </Box>

          <Stack spacing={1.5}>
            {/* API Service */}
            <Card variant="outlined" sx={{ borderRadius: 1.5 }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CloudIcon color="primary" sx={{ fontSize: 20 }} />
                    <Typography variant="body2" fontWeight={500}>API Service</Typography>
                  </Box>
                  <Chip
                    size="small"
                    icon={getStatusIcon(systemHealth.services.api.status)}
                    label={systemHealth.services.api.status}
                    color={getStatusColor(systemHealth.services.api.status)}
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 3 }}>
                  Latency: {systemHealth.services.api.latency} • {formatLastCheck(systemHealth.services.api.lastCheck)}
                </Typography>
              </CardContent>
            </Card>

            {/* Database */}
            <Card variant="outlined" sx={{ borderRadius: 1.5 }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DatabaseIcon color="primary" sx={{ fontSize: 20 }} />
                    <Typography variant="body2" fontWeight={500}>Database</Typography>
                  </Box>
                  <Chip
                    size="small"
                    icon={getStatusIcon(systemHealth.services.database.status)}
                    label={systemHealth.services.database.status}
                    color={getStatusColor(systemHealth.services.database.status)}
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 3 }}>
                  Connections: {systemHealth.services.database.connections} • {formatLastCheck(systemHealth.services.database.lastCheck)}
                </Typography>
              </CardContent>
            </Card>

            {/* Cache */}
            <Card variant="outlined" sx={{ borderRadius: 1.5 }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PerformanceIcon color="primary" sx={{ fontSize: 20 }} />
                    <Typography variant="body2" fontWeight={500}>Cache</Typography>
                  </Box>
                  <Chip
                    size="small"
                    icon={getStatusIcon(systemHealth.services.cache.status)}
                    label={systemHealth.services.cache.status}
                    color={getStatusColor(systemHealth.services.cache.status)}
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 3 }}>
                  Hit Rate: {systemHealth.services.cache.hitRate} • {formatLastCheck(systemHealth.services.cache.lastCheck)}
                </Typography>
              </CardContent>
            </Card>

            {/* Security */}
            <Card variant="outlined" sx={{ borderRadius: 1.5 }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SecurityIcon color="primary" sx={{ fontSize: 20 }} />
                    <Typography variant="body2" fontWeight={500}>Security</Typography>
                  </Box>
                  <Chip
                    size="small"
                    icon={getStatusIcon(systemHealth.services.security.status)}
                    label={systemHealth.services.security.status}
                    color={getStatusColor(systemHealth.services.security.status)}
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 3 }}>
                  Alerts: {systemHealth.services.security.alerts} • {formatLastCheck(systemHealth.services.security.lastCheck)}
                </Typography>
              </CardContent>
            </Card>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
            Auto-refreshes every 30 seconds
          </Typography>
        </Box>
      </Popover>
    </>
  );
};

export default SystemStatus;