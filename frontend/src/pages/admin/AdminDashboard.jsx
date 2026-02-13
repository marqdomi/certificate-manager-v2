// frontend/src/pages/admin/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Paper,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PeopleIcon from '@mui/icons-material/People';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import HistoryIcon from '@mui/icons-material/History';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SecurityIcon from '@mui/icons-material/Security';
import StorageIcon from '@mui/icons-material/Storage';
import MemoryIcon from '@mui/icons-material/Memory';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';

import { getSystemHealth, getUsers } from '../../services/adminApi';
import { TRANSITIONS } from '../../constants/designTokens';
import { SkeletonStatCard } from '../../components/shared/SkeletonLoaders';

const StatusChip = ({ status }) => {
  const getStatusProps = () => {
    switch (status) {
      case 'healthy':
        return { color: 'success', icon: <CheckCircleIcon fontSize="small" />, label: 'Healthy' };
      case 'degraded':
        return { color: 'warning', icon: <WarningIcon fontSize="small" />, label: 'Degraded' };
      case 'unhealthy':
        return { color: 'error', icon: <ErrorIcon fontSize="small" />, label: 'Unhealthy' };
      default:
        return { color: 'default', label: 'Unknown' };
    }
  };

  const props = getStatusProps();
  return (
    <Chip
      size="small"
      icon={props.icon}
      label={props.label}
      color={props.color}
      sx={{ fontWeight: 600 }}
    />
  );
};

const AdminCard = ({ title, description, icon, path, stats, status }) => {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        transition: TRANSITIONS.fast,
        '&:hover': {
          borderColor: theme.palette.primary.main,
          boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.15)}`,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardActionArea onClick={() => navigate(path)} sx={{ height: '100%' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main,
              }}
            >
              {icon}
            </Box>
            {status && <StatusChip status={status} />}
          </Box>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {description}
          </Typography>
          {stats && (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {stats.map((stat, idx) => (
                <Box key={idx}>
                  <Typography variant="h5" fontWeight={700} color="primary.main">
                    {stat.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stat.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

const HealthOverviewCard = ({ health, loading }) => {
  const theme = useTheme();

  if (loading) {
    return (
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
          {[...Array(3)].map((_, i) => <SkeletonStatCard key={i} />)}
        </Box>
      </Paper>
    );
  }

  // Helper to find component by name from the components array
  const getComponentStatus = (componentName) => {
    if (!health?.components) return null;
    const component = health.components.find(c => 
      c.name?.toLowerCase().includes(componentName.toLowerCase())
    );
    return component?.status || null;
  };

  const services = health ? [
    { name: 'Database', status: getComponentStatus('PostgreSQL') || getComponentStatus('database'), icon: <StorageIcon /> },
    { name: 'Redis', status: getComponentStatus('Redis'), icon: <MemoryIcon /> },
    { name: 'Celery Worker', status: getComponentStatus('Workers') || getComponentStatus('celery'), icon: <SecurityIcon /> },
    { name: 'Celery Beat', status: getComponentStatus('Beat'), icon: <SecurityIcon /> },
  ] : [];

  return (
    <Paper sx={{ p: 3, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }} elevation={0}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          System Health Overview
        </Typography>
        {health && <StatusChip status={health.status} />}
      </Box>
      <Divider sx={{ mb: 2 }} />
      <Grid container spacing={2}>
        {services.map((service) => (
          <Grid item xs={6} sm={3} key={service.name}>
            <Box
              sx={{
                p: 2,
                borderRadius: 1,
                bgcolor: alpha(
                  service.status === 'healthy'
                    ? theme.palette.success.main
                    : service.status === 'degraded'
                    ? theme.palette.warning.main
                    : theme.palette.error.main,
                  0.1
                ),
                textAlign: 'center',
              }}
            >
              <Box sx={{ color: service.status === 'healthy' ? 'success.main' : service.status === 'degraded' ? 'warning.main' : 'error.main', mb: 1 }}>
                {service.icon}
              </Box>
              <Typography variant="body2" fontWeight={500}>
                {service.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                {service.status || 'Unknown'}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
};

const AdminDashboard = () => {
  const [health, setHealth] = useState(null);
  const [userStats, setUserStats] = useState({ total: 0, active: 0, admins: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [healthData, usersData] = await Promise.all([
          getSystemHealth().catch(() => null),
          getUsers({ limit: 1000 }).catch(() => ({ items: [] })),
        ]);
        
        setHealth(healthData);
        
        const users = usersData.items || [];
        setUserStats({
          total: usersData.total || users.length,
          active: users.filter(u => u.is_active).length,
          admins: users.filter(u => u.role === 'admin').length,
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Refresh health every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const adminCards = [
    {
      title: 'User Management',
      description: 'Manage users, roles, and permissions. Create, edit, or deactivate user accounts.',
      icon: <PeopleIcon fontSize="large" />,
      path: '/admin/users',
      stats: [
        { value: userStats.total, label: 'Total Users' },
        { value: userStats.active, label: 'Active' },
        { value: userStats.admins, label: 'Admins' },
      ],
    },
    {
      title: 'System Health',
      description: 'Monitor system components, services status, and performance metrics.',
      icon: <MonitorHeartIcon fontSize="large" />,
      path: '/admin/health',
      status: health?.status,
    },
    {
      title: 'Audit Log',
      description: 'View and export detailed audit logs of all system activities and user actions.',
      icon: <HistoryIcon fontSize="large" />,
      path: '/audit-log',
    },
    {
      title: 'Notifications',
      description: 'Configure system notifications, alerts, and broadcast messages to users.',
      icon: <NotificationsIcon fontSize="large" />,
      path: '/admin/notifications',
    },
  ];

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Admin Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your Certificate Management Tool system settings and users.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 4 }}>
        <HealthOverviewCard health={health} loading={loading} />
      </Box>

      <Grid container spacing={3}>
        {adminCards.map((card) => (
          <Grid item xs={12} sm={6} lg={3} key={card.title}>
            <AdminCard {...card} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default AdminDashboard;
