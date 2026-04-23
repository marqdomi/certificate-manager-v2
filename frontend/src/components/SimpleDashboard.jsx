// frontend/src/components/SimpleDashboard.jsx

import React from 'react';
import { 
  Grid, 
  Paper, 
  Typography, 
  Box, 
  useTheme,
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import DnsIcon from '@mui/icons-material/Dns';

const SimpleDashboard = ({ stats, systemStats, lastUpdated, onRefresh }) => {
  const theme = useTheme();

  const MetricCard = ({ title, value, icon, color = 'primary' }) => (
    <Paper sx={{ p: 3, textAlign: 'center', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
        {icon}
        <Typography variant="h6" sx={{ ml: 1 }}>
          {title}
        </Typography>
      </Box>
      <Typography variant="h3" color={color} sx={{ fontWeight: 'bold' }}>
        {value || 0}
      </Typography>
    </Paper>
  );

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      {lastUpdated && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Last updated: {lastUpdated.toLocaleString()}
        </Typography>
      )}

      <Grid container spacing={3}>
        {/* Certificate Metrics */}
        <Grid item xs={12} md={3}>
          <MetricCard
            title="Total Certificates"
            value={stats?.total}
            icon={<SecurityIcon color="primary" />}
            color="primary.main"
          />
        </Grid>
        
        <Grid item xs={12} md={3}>
          <MetricCard
            title="Healthy"
            value={stats?.healthy}
            icon={<CheckCircleIcon color="success" />}
            color="success.main"
          />
        </Grid>
        
        <Grid item xs={12} md={3}>
          <MetricCard
            title="Warning"
            value={stats?.warning}
            icon={<WarningIcon color="warning" />}
            color="warning.main"
          />
        </Grid>
        
        <Grid item xs={12} md={3}>
          <MetricCard
            title="Expired"
            value={stats?.expired}
            icon={<ErrorIcon color="error" />}
            color="error.main"
          />
        </Grid>

        {/* Device Metrics */}
        {systemStats?.devices && (
          <>
            <Grid item xs={12} md={4}>
              <MetricCard
                title="Total Devices"
                value={systemStats.devices.total}
                icon={<DnsIcon color="primary" />}
                color="primary.main"
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <MetricCard
                title="Active Devices"
                value={systemStats.devices.active}
                icon={<CheckCircleIcon color="success" />}
                color="success.main"
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <MetricCard
                title="Inactive Devices"
                value={systemStats.devices.inactive}
                icon={<ErrorIcon color="error" />}
                color="error.main"
              />
            </Grid>
          </>
        )}

        {/* Summary Information */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              System Summary
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body1">
                  <strong>Certificate Management:</strong> Monitor and manage SSL/TLS certificates across your infrastructure.
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body1">
                  <strong>Device Monitoring:</strong> Track device health and connectivity status.
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SimpleDashboard;