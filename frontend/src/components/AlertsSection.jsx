// frontend/src/components/AlertsSection.jsx

import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  useTheme
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Schedule as ScheduleIcon,
  Security as SecurityIcon
} from '@mui/icons-material';

const AlertsSection = ({ systemStats, certificates = [] }) => {
  const theme = useTheme();

  // Generate alerts based on system data
  const generateAlerts = () => {
    const alerts = [];

    // Certificate-based alerts
    if (systemStats?.certificates) {
      const { expired, expiring_soon } = systemStats.certificates;
      
      if (expired > 0) {
        alerts.push({
          id: 'expired-certs',
          severity: 'error',
          icon: ErrorIcon,
          title: 'Expired Certificates',
          message: `${expired} certificate${expired > 1 ? 's have' : ' has'} expired and need immediate attention`,
          count: expired,
          action: 'View Expired'
        });
      }

      if (expiring_soon > 0) {
        alerts.push({
          id: 'expiring-certs',
          severity: 'warning',
          icon: WarningIcon,
          title: 'Certificates Expiring Soon',
          message: `${expiring_soon} certificate${expiring_soon > 1 ? 's are' : ' is'} expiring within 30 days`,
          count: expiring_soon,
          action: 'View Expiring'
        });
      }
    }

    // Device-based alerts
    if (systemStats?.devices) {
      const { inactive, by_scan_status } = systemStats.devices;
      
      if (inactive > 0) {
        alerts.push({
          id: 'inactive-devices',
          severity: 'warning',
          icon: InfoIcon,
          title: 'Inactive Devices',
          message: `${inactive} device${inactive > 1 ? 's are' : ' is'} currently inactive`,
          count: inactive,
          action: 'View Devices'
        });
      }

      // Check for failed scans
      const failedScans = by_scan_status?.failed || 0;
      if (failedScans > 0) {
        alerts.push({
          id: 'failed-scans',
          severity: 'error',
          icon: ErrorIcon,
          title: 'Failed Device Scans',
          message: `${failedScans} device${failedScans > 1 ? 's have' : ' has'} failed recent scans`,
          count: failedScans,
          action: 'View Failed Scans'
        });
      }
    }

    return alerts;
  };

  const alerts = generateAlerts();

  if (alerts.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(26, 33, 51, 0.6)' : 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(12px)',
          border: '1px solid',
          borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
          borderRadius: '16px',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <SecurityIcon sx={{ mr: 1, color: theme.palette.success.main }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            System Status
          </Typography>
        </Box>
        <Alert severity="success" sx={{ borderRadius: '12px' }}>
          <AlertTitle>All Systems Operational</AlertTitle>
          No critical alerts or warnings detected. All certificates and devices are functioning normally.
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(26, 33, 51, 0.6)' : 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(12px)',
        border: '1px solid',
        borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
        borderRadius: '16px',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <WarningIcon sx={{ mr: 1, color: theme.palette.warning.main }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Critical Alerts
        </Typography>
        <Chip 
          label={alerts.length} 
          size="small" 
          color="warning" 
          sx={{ ml: 1, fontWeight: 600 }}
        />
      </Box>
      
      <List disablePadding>
        {alerts.map((alert, index) => (
          <ListItem
            key={alert.id}
            divider={index < alerts.length - 1}
            sx={{
              px: 0,
              py: 1.5,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
                borderRadius: '8px',
                cursor: 'pointer'
              },
              transition: 'all 0.2s ease-in-out'
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <alert.icon 
                sx={{ 
                  color: theme.palette[alert.severity].main,
                  fontSize: '1.2rem'
                }} 
              />
            </ListItemIcon>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {alert.title}
                  </Typography>
                  <Chip 
                    label={alert.count} 
                    size="small" 
                    color={alert.severity}
                    sx={{ fontSize: '0.75rem', height: 20 }}
                  />
                </Box>
              }
              secondary={
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'text.secondary',
                    mt: 0.5 
                  }}
                >
                  {alert.message}
                </Typography>
              }
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

export default AlertsSection;