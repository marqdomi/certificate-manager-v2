// frontend/src/pages/admin/SystemHealth.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  LinearProgress,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import StorageIcon from '@mui/icons-material/Storage';
import MemoryIcon from '@mui/icons-material/Memory';
import WorkIcon from '@mui/icons-material/Work';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SpeedIcon from '@mui/icons-material/Speed';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CloudIcon from '@mui/icons-material/Cloud';

import { getSystemHealth } from '../../services/adminApi';
import { glassmorphicCard } from '../../constants/styleMixins';
import { TRANSITIONS } from '../../constants/designTokens';
import { SkeletonStatCard, PageHeader, PageTransition } from '../../components/shared';

const StatusIcon = ({ status, size = 'medium' }) => {
  switch (status) {
    case 'healthy':
      return <CheckCircleIcon color="success" fontSize={size} />;
    case 'degraded':
      return <WarningIcon color="warning" fontSize={size} />;
    case 'unhealthy':
      return <ErrorIcon color="error" fontSize={size} />;
    default:
      return <ErrorIcon color="disabled" fontSize={size} />;
  }
};

const StatusChip = ({ status }) => {
  const getColor = () => {
    switch (status) {
      case 'healthy': return 'success';
      case 'degraded': return 'warning';
      case 'unhealthy': return 'error';
      default: return 'default';
    }
  };

  return (
    <Chip
      icon={<StatusIcon status={status} size="small" />}
      label={status?.charAt(0).toUpperCase() + status?.slice(1) || 'Unknown'}
      color={getColor()}
      size="small"
      sx={{ fontWeight: 600 }}
    />
  );
};

const ServiceCard = ({ title, icon, status, details, latency }) => {
  const theme = useTheme();
  
  const getBgColor = () => {
    switch (status) {
      case 'healthy': return alpha(theme.palette.success.main, 0.05);
      case 'degraded': return alpha(theme.palette.warning.main, 0.05);
      case 'unhealthy': return alpha(theme.palette.error.main, 0.05);
      default: return theme.palette.background.paper;
    }
  };

  const getBorderColor = () => {
    switch (status) {
      case 'healthy': return theme.palette.success.main;
      case 'degraded': return theme.palette.warning.main;
      case 'unhealthy': return theme.palette.error.main;
      default: return theme.palette.divider;
    }
  };

  // Filter out undefined values from details
  const filteredDetails = details 
    ? Object.entries(details).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null && value !== 'unknown') {
          acc[key] = value;
        }
        return acc;
      }, {})
    : {};

  return (
    <Paper
      elevation={0}
      sx={{
        ...glassmorphicCard(theme),
        height: '100%',
        bgcolor: getBgColor(),
        borderColor: getBorderColor(),
      }}
    >
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                p: 1,
                borderRadius: 1.5,
                bgcolor: alpha(getBorderColor(), 0.1),
                color: getBorderColor(),
              }}
            >
              {icon}
            </Box>
            <Typography variant="h6" fontWeight={600}>
              {title}
            </Typography>
          </Box>
          <StatusChip status={status} />
        </Box>

        {latency !== undefined && latency !== null && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <AccessTimeIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                Latency
              </Typography>
            </Box>
            <Typography variant="h5" fontWeight={700}>
              {latency}ms
            </Typography>
          </Box>
        )}

        {Object.keys(filteredDetails).length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 1.5 }} />
            {Object.entries(filteredDetails).map(([key, value]) => (
              <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                  {key.replace(/_/g, ' ')}
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Paper>
  );
};

const OverallHealthCard = ({ health, loading }) => {
  const theme = useTheme();

  if (loading) {
    return (
      <Paper elevation={0} sx={{ ...glassmorphicCard(theme), p: 4 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          {[...Array(4)].map((_, i) => <SkeletonStatCard key={i} />)}
        </Box>
      </Paper>
    );
  }

  const getStatusColor = () => {
    switch (health?.status) {
      case 'healthy': return theme.palette.success.main;
      case 'degraded': return theme.palette.warning.main;
      case 'unhealthy': return theme.palette.error.main;
      default: return theme.palette.grey[500];
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        ...glassmorphicCard(theme),
        p: 4,
        border: `2px solid ${getStatusColor()}`,
        bgcolor: alpha(getStatusColor(), 0.05),
        textAlign: 'center',
      }}
    >
      <StatusIcon status={health?.status} size="large" />
      <Typography variant="h4" fontWeight={700} sx={{ mt: 2, textTransform: 'capitalize' }}>
        System {health?.status ? health.status.charAt(0).toUpperCase() + health.status.slice(1) : 'Unknown'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Last checked: {health?.timestamp ? new Date(health.timestamp).toLocaleString() : 'Never'}
      </Typography>
      {health?.environment && (
        <Chip
          icon={<CloudIcon fontSize="small" />}
          label={`Environment: ${health.environment}`}
          size="small"
          sx={{ mt: 2 }}
        />
      )}
      {health?.uptime_seconds !== undefined && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Uptime: {Math.floor(health.uptime_seconds / 60)} minutes
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

const SystemHealth = () => {
  const theme = useTheme();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSystemHealth();
      
      // Map components array to individual objects
      const mappedHealth = {
        status: data.status,
        timestamp: data.timestamp,
        environment: data.environment,
        version: data.version,
        uptime_seconds: data.uptime_seconds,
      };
      
      // Map components to named objects
      data.components?.forEach(component => {
        if (component.name === 'PostgreSQL') {
          mappedHealth.database = {
            status: component.status,
            latency_ms: component.latency_ms,
            version: component.details?.version || 'unknown',
            pool_size: component.details?.pool_size || 'unknown',
            message: component.message,
          };
        } else if (component.name === 'Redis') {
          mappedHealth.redis = {
            status: component.status,
            latency_ms: component.latency_ms,
            version: component.details?.version || 'unknown',
            connected_clients: component.details?.connected_clients || 'unknown',
            used_memory: component.details?.used_memory || 'unknown',
            message: component.message,
          };
        } else if (component.name === 'Celery Workers') {
          mappedHealth.celery = {
            status: component.status,
            latency_ms: component.latency_ms,
            active_workers: component.details?.workers?.length || 0,
            queued_tasks: component.details?.active_tasks || 0,
            message: component.message,
          };
        } else if (component.name === 'Celery Beat') {
          mappedHealth.celery_beat = {
            status: component.status,
            scheduled_tasks: component.details?.scheduled_tasks || 0,
            last_heartbeat: new Date().toISOString(),
            message: component.message,
          };
        }
      });
      
      setHealth(mappedHealth);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const services = [
    {
      title: 'Database',
      icon: <StorageIcon />,
      status: health?.database?.status,
      latency: health?.database?.latency_ms,
      details: {
        version: health?.database?.version,
        connection_pool: health?.database?.pool_size,
      },
    },
    {
      title: 'Redis Cache',
      icon: <MemoryIcon />,
      status: health?.redis?.status,
      latency: health?.redis?.latency_ms,
      details: {
        version: health?.redis?.version,
        connected_clients: health?.redis?.connected_clients,
        used_memory: health?.redis?.used_memory,
      },
    },
    {
      title: 'Celery Worker',
      icon: <WorkIcon />,
      status: health?.celery?.status,
      latency: health?.celery?.latency_ms,
      details: {
        active_workers: health?.celery?.active_workers,
        queued_tasks: health?.celery?.queued_tasks,
      },
    },
    {
      title: 'Celery Beat',
      icon: <ScheduleIcon />,
      status: health?.celery_beat?.status,
      details: {
        last_heartbeat: health?.celery_beat?.last_heartbeat
          ? new Date(health.celery_beat.last_heartbeat).toLocaleTimeString()
          : 'N/A',
        scheduled_tasks: health?.celery_beat?.scheduled_tasks,
      },
    },
  ];

  return (
    <PageTransition>
      <PageHeader
        title="System Health"
        subtitle="Monitor the health and performance of all system components"
        icon={<SpeedIcon />}
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {lastRefresh && (
              <Typography variant="caption" color="text.secondary">
                Last refresh: {lastRefresh.toLocaleTimeString()}
              </Typography>
            )}
            <Tooltip title="Refresh">
              <IconButton onClick={fetchHealth} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to fetch system health: {error}
        </Alert>
      )}

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <OverallHealthCard health={health} loading={loading && !health} />
        </Grid>
        <Grid item xs={12} md={8}>
          <Paper
            elevation={0}
            sx={{
              ...glassmorphicCard(theme),
              p: 3,
              height: '100%',
            }}
          >
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Performance Metrics
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    <SpeedIcon color="primary" fontSize="small" />
                    <Typography variant="h4" fontWeight={700} color="primary">
                      {health?.database?.latency_ms ? health.database.latency_ms.toFixed(1) : '-'}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    DB Latency (ms)
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    <SpeedIcon color="secondary" fontSize="small" />
                    <Typography variant="h4" fontWeight={700} color="secondary">
                      {health?.redis?.latency_ms ? health.redis.latency_ms.toFixed(1) : '-'}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Redis Latency (ms)
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" fontWeight={700}>
                    {health?.celery?.active_workers ?? '-'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Active Workers
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" fontWeight={700}>
                    {health?.celery?.queued_tasks ?? '-'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Queued Tasks
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      <Typography variant="h6" fontWeight={600} sx={{ mt: 4, mb: 2 }}>
        Service Details
      </Typography>
      <Grid container spacing={3}>
        {services.map((service) => (
          <Grid item xs={12} sm={6} lg={3} key={service.title}>
            <ServiceCard {...service} />
          </Grid>
        ))}
      </Grid>
    </PageTransition>
  );
};

export default SystemHealth;
