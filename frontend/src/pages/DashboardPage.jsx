// frontend/src/pages/DashboardPage.jsx
// Phase 2: Auto-refresh, Skeleton Loading, Animations
// Phase 4: Export Dashboard, Widget Customization
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Paper, 
  IconButton, 
  Tooltip, 
  Chip,
  LinearProgress,
  alpha,
  useTheme,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Snackbar,
  Alert,
} from '@mui/material';
import { DashboardSkeleton, PageHeader, PageTransition } from '../components/shared';
import RefreshIcon from '@mui/icons-material/Refresh';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import SettingsIcon from '@mui/icons-material/Settings';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import Dashboard from '../components/Dashboard';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { TRANSITIONS } from '../constants/designTokens';

// Auto-refresh interval in milliseconds (60 seconds)
const AUTO_REFRESH_INTERVAL = 60000;

// ============================================
// PHASE 4 - Widget Configuration
// ============================================
const DEFAULT_WIDGET_CONFIG = {
  healthScore: { visible: true, label: 'Health Score Gauge' },
  expirationTrend: { visible: true, label: 'Expiration Forecast' },
  expirationTimeline: { visible: true, label: 'Expiration Timeline' },
  deviceStats: { visible: true, label: 'F5 Devices' },
  criticalCerts: { visible: true, label: 'Critical Expired' },
  activityTimeline: { visible: true, label: 'Recent Activity' },
  certificatesBySite: { visible: true, label: 'Certificates by Site' },
  certificateHealth: { visible: true, label: 'Certificate Health Pie' },
  quickActions: { visible: true, label: 'Quick Actions' },
  quickStats: { visible: true, label: 'Quick Stats Row' },
  deviceHaStatus: { visible: true, label: 'Device HA Status' },
};

// Load widget config from localStorage
const loadWidgetConfig = () => {
  try {
    const saved = localStorage.getItem('dashboard-widget-config');
    if (saved) {
      return { ...DEFAULT_WIDGET_CONFIG, ...JSON.parse(saved) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_WIDGET_CONFIG;
};

// Save widget config to localStorage
const saveWidgetConfig = (config) => {
  try {
    localStorage.setItem('dashboard-widget-config', JSON.stringify(config));
  } catch {
    // ignore
  }
};

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
  const dashboardRef = useRef(null);
  
  // Phase 4: Export and Widget Config states
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [widgetConfigOpen, setWidgetConfigOpen] = useState(false);
  const [widgetConfig, setWidgetConfig] = useState(loadWidgetConfig);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Phase 4: Export functions
  const handleExportMenuOpen = (event) => {
    setExportMenuAnchor(event.currentTarget);
  };

  const handleExportMenuClose = () => {
    setExportMenuAnchor(null);
  };

  const exportToPNG = async () => {
    handleExportMenuClose();
    if (!dashboardRef.current) return;
    
    setExporting(true);
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: theme.palette.background.default,
        logging: false,
      });
      
      const link = document.createElement('a');
      link.download = `CMT-Dashboard-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      setSnackbar({ open: true, message: 'Dashboard exported as PNG', severity: 'success' });
    } catch (error) {
      console.error('Export to PNG failed:', error);
      setSnackbar({ open: true, message: 'Export failed', severity: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = async () => {
    handleExportMenuClose();
    if (!dashboardRef.current) return;
    
    setExporting(true);
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: theme.palette.background.default,
        logging: false,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`CMT-Dashboard-${new Date().toISOString().split('T')[0]}.pdf`);
      
      setSnackbar({ open: true, message: 'Dashboard exported as PDF', severity: 'success' });
    } catch (error) {
      console.error('Export to PDF failed:', error);
      setSnackbar({ open: true, message: 'Export failed', severity: 'error' });
    } finally {
      setExporting(false);
    }
  };

  // Phase 4: Widget config functions
  const handleWidgetToggle = (widgetKey) => {
    setWidgetConfig(prev => {
      const newConfig = {
        ...prev,
        [widgetKey]: { ...prev[widgetKey], visible: !prev[widgetKey].visible }
      };
      saveWidgetConfig(newConfig);
      return newConfig;
    });
  };

  const handleResetWidgets = () => {
    setWidgetConfig(DEFAULT_WIDGET_CONFIG);
    saveWidgetConfig(DEFAULT_WIDGET_CONFIG);
    setSnackbar({ open: true, message: 'Widget layout reset to default', severity: 'info' });
  };

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    
    try {
      // Fetch all data in parallel
      const [certsRes, devicesRes, csrRes, auditRes] = await Promise.all([
        apiClient.get('/certificates/?primaries_only=1&dedupe=1'),
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
    <PageTransition>
      {/* Header with refresh controls */}
      <PageHeader
        title="Dashboard Overview"
        subtitle={`Updated ${formatLastRefresh()}`}
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
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

            {/* Phase 4: Export button */}
            <Tooltip title="Export Dashboard">
              <IconButton 
                size="small" 
                onClick={handleExportMenuOpen}
                disabled={exporting || loading}
                sx={{ 
                  bgcolor: alpha(theme.palette.secondary.main, 0.1),
                  '&:hover': {
                    bgcolor: alpha(theme.palette.secondary.main, 0.2),
                  }
                }}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* Phase 4: Widget config button */}
            <Tooltip title="Configure Widgets">
              <IconButton 
                size="small" 
                onClick={() => setWidgetConfigOpen(true)}
                sx={{ 
                  bgcolor: alpha(theme.palette.grey[500], 0.1),
                  '&:hover': {
                    bgcolor: alpha(theme.palette.grey[500], 0.2),
                  }
                }}
              >
                <ViewModuleIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        }
      />

      {/* Export Menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={handleExportMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={exportToPNG} disabled={exporting}>
          <ListItemIcon>
            <ImageIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Export as PNG" secondary="High-resolution image" />
        </MenuItem>
        <MenuItem onClick={exportToPDF} disabled={exporting}>
          <ListItemIcon>
            <PictureAsPdfIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Export as PDF" secondary="Printable document" />
        </MenuItem>
      </Menu>

      {/* Widget Configuration Dialog */}
      <Dialog 
        open={widgetConfigOpen} 
        onClose={() => setWidgetConfigOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ViewModuleIcon color="primary" />
          Configure Dashboard Widgets
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Toggle widgets on or off to customize your dashboard view. Changes are saved automatically.
          </Typography>
          <Grid container spacing={1}>
            {Object.entries(widgetConfig).map(([key, config]) => (
              <Grid item xs={12} sm={6} key={key}>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: 1.5, 
                    borderRadius: 2,
                    borderColor: config.visible ? 'primary.main' : 'divider',
                    bgcolor: config.visible ? alpha(theme.palette.primary.main, 0.05) : 'transparent',
                    transition: TRANSITIONS.fast,
                  }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.visible}
                        onChange={() => handleWidgetToggle(key)}
                        color="primary"
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2" fontWeight={config.visible ? 500 : 400}>
                        {config.label}
                      </Typography>
                    }
                    sx={{ width: '100%', m: 0 }}
                  />
                </Paper>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleResetWidgets} color="warning" size="small">
            Reset to Default
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setWidgetConfigOpen(false)} variant="contained">
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Loading progress bar during refresh or export */}
      {(refreshing || exporting) && (
        <LinearProgress 
          sx={{ 
            mb: 2, 
            borderRadius: 1,
            height: 3,
          }} 
        />
      )}

      {/* Main content */}
      <Box ref={dashboardRef}>
        {loading ? (
          <DashboardSkeleton />
        ) : (
          <Dashboard stats={stats} onFilterSelect={handleDashboardFilter} widgetConfig={widgetConfig} />
        )}
      </Box>
    </PageTransition>
  );
}

export default DashboardPage;