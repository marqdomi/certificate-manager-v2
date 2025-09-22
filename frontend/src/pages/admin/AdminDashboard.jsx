// frontend/src/pages/admin/AdminDashboard.jsx

import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  LinearProgress,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button
} from '@mui/material';
import {
  People as PeopleIcon,
  Security as SecurityIcon,
  Assessment as AssessmentIcon,
  AccountTree as AccountTreeIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { adminService } from '../../services/admin';
import { useAuth } from '../../context/AuthContext';

const StatCard = ({ title, value, icon, color = 'primary', subtitle }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography color="textSecondary" gutterBottom variant="h6">
            {title}
          </Typography>
          <Typography variant="h4" component="h2" color={color}>
            {value}
          </Typography>
          {subtitle && (
            <Typography color="textSecondary" variant="body2">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box color={`${color}.main`}>
          {React.cloneElement(icon, { fontSize: 'large' })}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const AdminDashboard = () => {
  const { user, hasPermission } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsResponse, activityResponse] = await Promise.all([
        adminService.getSystemStats(),
        adminService.getUserActivity({ limit: 10 })
      ]);

      setStats(statsResponse.data);
      setRecentActivity(activityResponse.data.items || []);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatActivityTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getActivityColor = (action) => {
    switch (action.toLowerCase()) {
      case 'login':
        return 'success';
      case 'logout':
        return 'info';
      case 'failed_login':
        return 'error';
      case 'user_created':
      case 'user_updated':
        return 'primary';
      case 'user_deleted':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (!hasPermission('admin_read')) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          You don't have permission to access the admin dashboard.
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ width: '100%' }}>
          <LinearProgress />
        </Box>
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading dashboard...
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={loadDashboardData}>
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Admin Dashboard
      </Typography>
      
      <Typography variant="body1" color="textSecondary" paragraph>
        Welcome back, {user?.full_name || user?.username}. Here's an overview of your system.
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Users"
            value={stats?.total_users || 0}
            icon={<PeopleIcon />}
            color="primary"
            subtitle={`${stats?.active_users || 0} active`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Sessions"
            value={stats?.active_sessions || 0}
            icon={<SecurityIcon />}
            color="success"
            subtitle="Currently logged in"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Auth Providers"
            value={stats?.auth_types?.length || 0}
            icon={<AccountTreeIcon />}
            color="info"
            subtitle="Authentication methods"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Failed Logins"
            value={stats?.failed_logins_24h || 0}
            icon={<WarningIcon />}
            color="warning"
            subtitle="Last 24 hours"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* User Distribution by Role */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Users by Role
              </Typography>
              {stats?.users_by_role && Object.keys(stats.users_by_role).length > 0 ? (
                <Box>
                  {Object.entries(stats.users_by_role).map(([role, count]) => (
                    <Box key={role} sx={{ mb: 2 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">
                          {adminService.formatRole(role)}
                        </Typography>
                        <Chip 
                          label={count} 
                          size="small" 
                          color="primary" 
                          variant="outlined"
                        />
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(count / (stats.total_users || 1)) * 100}
                        sx={{ mt: 0.5 }}
                      />
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography color="textSecondary">No user data available</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Authentication Types */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Authentication Methods
              </Typography>
              {stats?.users_by_auth_type && Object.keys(stats.users_by_auth_type).length > 0 ? (
                <Box>
                  {Object.entries(stats.users_by_auth_type).map(([authType, count]) => (
                    <Box key={authType} sx={{ mb: 2 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">
                          {adminService.formatAuthType(authType)}
                        </Typography>
                        <Chip 
                          label={count} 
                          size="small" 
                          color="secondary" 
                          variant="outlined"
                        />
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(count / (stats.total_users || 1)) * 100}
                        sx={{ mt: 0.5 }}
                        color="secondary"
                      />
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography color="textSecondary">No authentication data available</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent User Activity
              </Typography>
              {recentActivity.length > 0 ? (
                <Paper variant="outlined">
                  <List>
                    {recentActivity.map((activity, index) => (
                      <React.Fragment key={activity.id}>
                        <ListItem>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="body2">
                                  <strong>{activity.username}</strong> - {activity.action}
                                </Typography>
                                <Chip
                                  label={activity.action}
                                  size="small"
                                  color={getActivityColor(activity.action)}
                                  variant="outlined"
                                />
                              </Box>
                            }
                            secondary={
                              <Box>
                                <Typography variant="caption" color="textSecondary">
                                  {formatActivityTime(activity.timestamp)}
                                </Typography>
                                {activity.ip_address && (
                                  <Typography variant="caption" color="textSecondary" sx={{ ml: 2 }}>
                                    IP: {activity.ip_address}
                                  </Typography>
                                )}
                                {activity.details && (
                                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                                    {activity.details}
                                  </Typography>
                                )}
                              </Box>
                            }
                          />
                        </ListItem>
                        {index < recentActivity.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                </Paper>
              ) : (
                <Typography color="textSecondary">No recent activity found</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default AdminDashboard;