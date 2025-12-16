// frontend/src/pages/CertificateCleanupPage.jsx
/**
 * Certificate Cleanup Page - v2.5 Enterprise Edition
 * 
 * Provides tools to analyze and clean up expired certificates from F5 devices.
 * Features:
 * - Analysis of expired certificates by device
 * - Categorization: Safe to delete vs Blocked by SSL profiles
 * - Dry-run preview before operations
 * - Bulk deletion with snapshot/rollback support
 * - Audit trail for all operations
 */

import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  LinearProgress,
  Card,
  CardContent,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  FormControlLabel,
  Switch,
  alpha,
  Stack,
  Autocomplete,
  InputAdornment,
  Breadcrumbs,
  Link,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { useTheme } from '@mui/material/styles';

// Icons
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import PreviewIcon from '@mui/icons-material/Preview';
import UndoIcon from '@mui/icons-material/Undo';
import HistoryIcon from '@mui/icons-material/History';
import SecurityIcon from '@mui/icons-material/Security';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import InfoIcon from '@mui/icons-material/Info';
import StorageIcon from '@mui/icons-material/Storage';
import VerifiedIcon from '@mui/icons-material/Verified';
import BlockIcon from '@mui/icons-material/Block';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import HomeIcon from '@mui/icons-material/Home';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SearchIcon from '@mui/icons-material/Search';

import apiClient from '../services/api';

// Tab panel helper
function TabPanel({ children, value, index, ...other }) {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const StatsCard = ({ icon, title, value, subtitle, color = 'primary' }) => {
  const theme = useTheme();
  
  return (
    <Card 
      elevation={0} 
      sx={{ 
        height: '100%',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '4px',
          height: '100%',
          backgroundColor: theme.palette[color]?.main || color,
        }
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={500} gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight={700} color={`${color}.main`}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box 
            sx={{ 
              p: 1.5, 
              borderRadius: 2, 
              bgcolor: alpha(theme.palette[color]?.main || theme.palette.primary.main, 0.1),
              color: `${color}.main`
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const CertificateCleanupPage = () => {
  const theme = useTheme();

  // State
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [daysThreshold, setDaysThreshold] = useState(30);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Analysis results
  const [analysisResult, setAnalysisResult] = useState(null);
  const [selectedCerts, setSelectedCerts] = useState([]);

  // Tabs
  const [activeTab, setActiveTab] = useState(0);

  // Dialogs
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: '', data: null });
  const [previewDialog, setPreviewDialog] = useState({ open: false, data: null });
  const [snapshotsDialog, setSnapshotsDialog] = useState({ open: false });

  // Snapshots
  const [snapshots, setSnapshots] = useState([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);

  // Options
  const [createSnapshots, setCreateSnapshots] = useState(true);

  // Load devices on mount
  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const response = await apiClient.get('/devices/');
      const devicesWithCreds = response.data.filter(d => d.has_credentials);
      setDevices(devicesWithCreds);
    } catch (err) {
      console.error('Failed to load devices:', err);
      setError('Failed to load devices');
    }
  };

  const runAnalysis = async () => {
    if (!selectedDeviceId) {
      setError('Please select a device');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setSuccess(null);
    setAnalysisResult(null);
    setSelectedCerts([]);

    try {
      const response = await apiClient.get(`/cleanup/devices/${selectedDeviceId}/cleanup-analysis`, {
        params: { days_threshold: daysThreshold }
      });
      setAnalysisResult(response.data);
      
      if (response.data.total_expired === 0) {
        setSuccess('No expired certificates found matching the criteria');
      }
    } catch (err) {
      console.error('Analysis failed:', err);
      setError(err.response?.data?.detail || 'Failed to analyze device');
    } finally {
      setAnalyzing(false);
    }
  };

  const loadSnapshots = async () => {
    setLoadingSnapshots(true);
    try {
      const response = await apiClient.get('/cleanup/snapshots', {
        params: { device_id: selectedDeviceId || undefined }
      });
      setSnapshots(response.data);
    } catch (err) {
      console.error('Failed to load snapshots:', err);
    } finally {
      setLoadingSnapshots(false);
    }
  };

  const handleDeleteSingle = async (cert, strategy) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.delete(`/cleanup/${cert.id}/assisted`, {
        data: {
          cert_id: cert.id,
          strategy: strategy,
          dry_run: false,
          create_snapshot: createSnapshots
        }
      });
      
      if (response.data.success) {
        setSuccess(`Successfully deleted certificate: ${cert.name}`);
        runAnalysis();
      } else {
        setError(response.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Deletion failed');
    } finally {
      setLoading(false);
      setConfirmDialog({ open: false, type: '', data: null });
    }
  };

  const handleBulkDelete = async (strategy) => {
    if (selectedCerts.length === 0) {
      setError('No certificates selected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/cleanup/bulk-cleanup', {
        cert_ids: selectedCerts,
        strategy: strategy,
        dry_run: false,
        create_snapshots: createSnapshots
      });

      if (response.data.success) {
        setSuccess(`Bulk cleanup completed: ${response.data.successful} deleted, ${response.data.failed} failed`);
      } else {
        setSuccess(`Bulk cleanup partial: ${response.data.successful} deleted, ${response.data.failed} failed`);
      }
      
      runAnalysis();
      setSelectedCerts([]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Bulk cleanup failed');
    } finally {
      setLoading(false);
      setConfirmDialog({ open: false, type: '', data: null });
    }
  };

  const handlePreview = async () => {
    if (selectedCerts.length === 0) {
      setError('No certificates selected');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/cleanup/bulk-cleanup/preview', {
        cert_ids: selectedCerts,
        strategy: 'dissociate',
        dry_run: true
      });
      setPreviewDialog({ open: true, data: response.data });
    } catch (err) {
      setError(err.response?.data?.detail || 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (snapshotId) => {
    setLoading(true);
    try {
      const response = await apiClient.post(`/cleanup/snapshots/${snapshotId}/rollback`, {
        snapshot_id: snapshotId,
        confirm: true
      });
      
      if (response.data.success) {
        setSuccess('Rollback completed successfully');
        loadSnapshots();
      } else {
        setError(response.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Rollback failed');
    } finally {
      setLoading(false);
    }
  };

  // DataGrid columns
  const columns = [
    {
      field: 'name',
      headerName: 'Certificate Name',
      flex: 1,
      minWidth: 250,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>{params.value}</Typography>
          {params.row.common_name && (
            <Typography variant="caption" color="text.secondary">
              CN: {params.row.common_name}
            </Typography>
          )}
        </Box>
      )
    },
    {
      field: 'days_expired',
      headerName: 'Days Expired',
      width: 130,
      renderCell: (params) => (
        <Chip
          size="small"
          label={`${params.value} days`}
          color={params.value > 90 ? 'error' : params.value > 30 ? 'warning' : 'default'}
          sx={{ fontWeight: 600 }}
        />
      )
    },
    {
      field: 'category',
      headerName: 'Status',
      width: 160,
      renderCell: (params) => {
        const isSafe = params.value === 'safe_to_delete';
        return (
          <Chip
            size="small"
            icon={isSafe ? <VerifiedIcon /> : <BlockIcon />}
            label={isSafe ? 'Safe' : 'Blocked'}
            color={isSafe ? 'success' : 'warning'}
            variant="filled"
            sx={{ fontWeight: 600 }}
          />
        );
      }
    },
    {
      field: 'ssl_profiles_count',
      headerName: 'Profiles',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Chip
          size="small"
          icon={<SecurityIcon sx={{ fontSize: 16 }} />}
          label={params.value}
          color={params.value > 0 ? 'warning' : 'default'}
          variant="outlined"
        />
      )
    },
    {
      field: 'partition',
      headerName: 'Partition',
      width: 120,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {params.value || 'Common'}
        </Typography>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 140,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5}>
          {params.row.can_delete_safely ? (
            <Tooltip title="Delete Certificate" arrow>
              <IconButton
                size="small"
                color="error"
                onClick={() => setConfirmDialog({
                  open: true,
                  type: 'single_force',
                  data: params.row
                })}
                disabled={loading}
                sx={{ 
                  bgcolor: alpha(theme.palette.error.main, 0.1),
                  '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) }
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Dissociate & Delete" arrow>
              <IconButton
                size="small"
                color="warning"
                onClick={() => setConfirmDialog({
                  open: true,
                  type: 'single_dissociate',
                  data: params.row
                })}
                disabled={loading}
                sx={{ 
                  bgcolor: alpha(theme.palette.warning.main, 0.1),
                  '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.2) }
                }}
              >
                <LinkOffIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {params.row.ssl_profiles?.length > 0 && (
            <Tooltip title={`Profiles: ${params.row.ssl_profiles.join(', ')}`} arrow>
              <IconButton size="small" color="info">
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      )
    }
  ];

  const safeCerts = analysisResult?.certificates?.filter(c => c.can_delete_safely) || [];
  const blockedCerts = analysisResult?.certificates?.filter(c => !c.can_delete_safely) || [];
  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  return (
    <Box>
      {/* Breadcrumb Navigation */}
      <Breadcrumbs 
        separator={<NavigateNextIcon fontSize="small" />}
        sx={{ mb: 2 }}
      >
        <Link
          component={RouterLink}
          to="/"
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 0.5,
            textDecoration: 'none',
            color: 'text.secondary',
            '&:hover': { color: 'primary.main' }
          }}
        >
          <HomeIcon fontSize="small" />
          Home
        </Link>
        <Link
          component={RouterLink}
          to="/dashboard"
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 0.5,
            textDecoration: 'none',
            color: 'text.secondary',
            '&:hover': { color: 'primary.main' }
          }}
        >
          <DashboardIcon fontSize="small" />
          Dashboard
        </Link>
        <Typography 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 0.5,
            color: 'primary.main',
            fontWeight: 500
          }}
        >
          <CleaningServicesIcon fontSize="small" />
          Certificate Cleanup
        </Typography>
      </Breadcrumbs>

      {/* Page Header */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          mb: 3, 
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.background.paper, 1)} 100%)`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box 
              sx={{ 
                p: 1.5, 
                borderRadius: 2, 
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main'
              }}
            >
              <CleaningServicesIcon sx={{ fontSize: 32 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={700}>
                Certificate Cleanup
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Analyze and remove expired certificates from F5 devices with rollback support
              </Typography>
            </Box>
          </Box>
          <Tooltip title="View Operation Snapshots" arrow>
            <Button
              variant="outlined"
              startIcon={<HistoryIcon />}
              onClick={() => {
                loadSnapshots();
                setSnapshotsDialog({ open: true });
              }}
              sx={{ borderRadius: 2, textTransform: 'none' }}
            >
              Snapshots
            </Button>
          </Tooltip>
        </Box>
      </Paper>

      {/* Alerts */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2, borderRadius: 2 }} 
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}
      {success && (
        <Alert 
          severity="success" 
          sx={{ mb: 2, borderRadius: 2 }} 
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}

      {/* Analysis Controls */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          mb: 3, 
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
          Analysis Configuration
        </Typography>
        <Grid container spacing={3} alignItems="flex-start">
          <Grid item xs={12} md={4}>
            <Autocomplete
              options={devices}
              getOptionLabel={(option) => option ? `${option.hostname} (${option.ip_address})` : ''}
              value={devices.find(d => d.id === selectedDeviceId) || null}
              onChange={(_, newValue) => setSelectedDeviceId(newValue?.id || '')}
              isOptionEqualToValue={(option, value) => option?.id === value?.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search & Select Device"
                  placeholder="Type to search devices..."
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" color="action" />
                        </InputAdornment>
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    }
                  }}
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <StorageIcon fontSize="small" color="action" />
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {option.hostname}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.ip_address}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}
              noOptionsText="No devices found"
              size="medium"
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              type="number"
              label="Days Expired Threshold"
              value={daysThreshold}
              onChange={(e) => setDaysThreshold(parseInt(e.target.value) || 0)}
              InputProps={{ inputProps: { min: 0 } }}
              helperText="Filter: expired more than N days"
              size="medium"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                }
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={createSnapshots}
                  onChange={(e) => setCreateSnapshots(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={500}>Snapshots</Typography>
                  <Typography variant="caption" color="text.secondary">Enable rollback</Typography>
                </Box>
              }
              sx={{ mt: 0.5 }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              variant="contained"
              size="large"
              fullWidth
              startIcon={analyzing ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
              onClick={runAnalysis}
              disabled={!selectedDeviceId || analyzing}
              sx={{ 
                py: 1.5, 
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              {analyzing ? 'Analyzing...' : 'Run Analysis'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Info Banner */}
      {!analysisResult && !analyzing && (
        <Paper 
          elevation={0} 
          sx={{ 
            p: 4, 
            textAlign: 'center',
            borderRadius: 2,
            border: `1px dashed ${theme.palette.divider}`,
            bgcolor: alpha(theme.palette.info.main, 0.02),
          }}
        >
          <TipsAndUpdatesIcon sx={{ fontSize: 48, color: 'info.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Select a Device to Begin
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 500, mx: 'auto' }}>
            Choose an F5 device and click "Run Analysis" to scan for expired certificates. 
            The tool will categorize them as safe to delete or blocked by SSL profiles.
          </Typography>
        </Paper>
      )}

      {/* Results */}
      {analysisResult && (
        <>
          {/* Summary Stats */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <StatsCard
                icon={<SecurityIcon />}
                title="Total Expired"
                value={analysisResult.total_expired}
                subtitle={selectedDevice?.hostname}
                color="primary"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatsCard
                icon={<VerifiedIcon />}
                title="Safe to Delete"
                value={analysisResult.safe_to_delete}
                subtitle="No profile associations"
                color="success"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatsCard
                icon={<BlockIcon />}
                title="Blocked by Profiles"
                value={analysisResult.blocked_by_profiles}
                subtitle="Requires dissociation"
                color="warning"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatsCard
                icon={<ScheduleIcon />}
                title="Threshold"
                value={`${daysThreshold}+`}
                subtitle="Days expired"
                color="info"
              />
            </Grid>
          </Grid>

          {/* Results Tabs */}
          <Paper 
            elevation={0} 
            sx={{ 
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
              overflow: 'hidden',
            }}
          >
            <Tabs 
              value={activeTab} 
              onChange={(e, v) => setActiveTab(v)}
              sx={{ 
                px: 2, 
                borderBottom: `1px solid ${theme.palette.divider}`,
                bgcolor: alpha(theme.palette.background.default, 0.5),
              }}
            >
              <Tab 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <VerifiedIcon fontSize="small" color="success" />
                    Safe to Delete
                    <Chip size="small" label={safeCerts.length} color="success" sx={{ ml: 0.5 }} />
                  </Box>
                }
              />
              <Tab 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BlockIcon fontSize="small" color="warning" />
                    Blocked by Profiles
                    <Chip size="small" label={blockedCerts.length} color="warning" sx={{ ml: 0.5 }} />
                  </Box>
                }
              />
              <Tab 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SecurityIcon fontSize="small" />
                    All Certificates
                    <Chip size="small" label={analysisResult.certificates?.length || 0} sx={{ ml: 0.5 }} />
                  </Box>
                }
              />
            </Tabs>

            <Box sx={{ p: 2 }}>
              <TabPanel value={activeTab} index={0}>
                {safeCerts.length > 0 ? (
                  <>
                    <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Alert severity="success" sx={{ flex: 1, mr: 2, borderRadius: 2 }}>
                        These certificates have no SSL profile associations and can be safely deleted.
                      </Alert>
                      <Button
                        variant="contained"
                        color="error"
                        startIcon={<DeleteForeverIcon />}
                        onClick={() => setConfirmDialog({
                          open: true,
                          type: 'bulk_safe',
                          data: safeCerts
                        })}
                        disabled={loading}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                      >
                        Delete All ({safeCerts.length})
                      </Button>
                    </Box>
                    <DataGrid
                      rows={safeCerts}
                      columns={columns}
                      autoHeight
                      pageSize={10}
                      rowsPerPageOptions={[10, 25, 50]}
                      disableSelectionOnClick
                      getRowId={(row) => row.id || row.name}
                      sx={{
                        border: 'none',
                        '& .MuiDataGrid-cell': { borderBottom: `1px solid ${theme.palette.divider}` },
                        '& .MuiDataGrid-columnHeaders': { bgcolor: alpha(theme.palette.background.default, 0.5) },
                      }}
                    />
                  </>
                ) : (
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    No certificates safe to delete. All expired certificates are associated with SSL profiles.
                  </Alert>
                )}
              </TabPanel>

              <TabPanel value={activeTab} index={1}>
                {blockedCerts.length > 0 ? (
                  <>
                    <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Alert severity="warning" sx={{ flex: 1, mr: 2, borderRadius: 2 }}>
                        These certificates are associated with SSL profiles. Deleting will dissociate them first.
                      </Alert>
                      <Button
                        variant="contained"
                        color="warning"
                        startIcon={<LinkOffIcon />}
                        onClick={() => setConfirmDialog({
                          open: true,
                          type: 'bulk_dissociate',
                          data: blockedCerts
                        })}
                        disabled={loading}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, color: 'white' }}
                      >
                        Dissociate & Delete All ({blockedCerts.length})
                      </Button>
                    </Box>
                    <DataGrid
                      rows={blockedCerts}
                      columns={columns}
                      autoHeight
                      pageSize={10}
                      rowsPerPageOptions={[10, 25, 50]}
                      disableSelectionOnClick
                      getRowId={(row) => row.id || row.name}
                      sx={{
                        border: 'none',
                        '& .MuiDataGrid-cell': { borderBottom: `1px solid ${theme.palette.divider}` },
                        '& .MuiDataGrid-columnHeaders': { bgcolor: alpha(theme.palette.background.default, 0.5) },
                      }}
                    />
                  </>
                ) : (
                  <Alert severity="success" sx={{ borderRadius: 2 }}>
                    No certificates blocked by SSL profiles.
                  </Alert>
                )}
              </TabPanel>

              <TabPanel value={activeTab} index={2}>
                <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>
                    Selected: {selectedCerts.length}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<PreviewIcon />}
                    onClick={handlePreview}
                    disabled={selectedCerts.length === 0 || loading}
                    sx={{ borderRadius: 2, textTransform: 'none' }}
                  >
                    Preview
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => setConfirmDialog({
                      open: true,
                      type: 'bulk_selected',
                      data: selectedCerts
                    })}
                    disabled={selectedCerts.length === 0 || loading}
                    sx={{ borderRadius: 2, textTransform: 'none' }}
                  >
                    Delete Selected
                  </Button>
                </Box>
                <DataGrid
                  rows={analysisResult.certificates}
                  columns={columns}
                  autoHeight
                  pageSize={10}
                  rowsPerPageOptions={[10, 25, 50]}
                  checkboxSelection
                  onSelectionModelChange={(ids) => setSelectedCerts(ids)}
                  selectionModel={selectedCerts}
                  getRowId={(row) => row.id || row.name}
                  sx={{
                    border: 'none',
                    '& .MuiDataGrid-cell': { borderBottom: `1px solid ${theme.palette.divider}` },
                    '& .MuiDataGrid-columnHeaders': { bgcolor: alpha(theme.palette.background.default, 0.5) },
                  }}
                />
              </TabPanel>
            </Box>
          </Paper>
        </>
      )}

      {/* Confirmation Dialog */}
      <Dialog 
        open={confirmDialog.open} 
        onClose={() => setConfirmDialog({ open: false, type: '', data: null })}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {confirmDialog.type.includes('dissociate') ? <LinkOffIcon color="warning" /> : <DeleteForeverIcon color="error" />}
            {confirmDialog.type.includes('dissociate') ? 'Confirm Dissociate & Delete' : 'Confirm Delete'}
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            {confirmDialog.type === 'single_force' && (
              <Typography>
                Are you sure you want to delete certificate <strong>{confirmDialog.data?.name}</strong>?
              </Typography>
            )}
            {confirmDialog.type === 'single_dissociate' && (
              <>
                <Typography gutterBottom>
                  This will dissociate certificate <strong>{confirmDialog.data?.name}</strong> from{' '}
                  <strong>{confirmDialog.data?.ssl_profiles_count}</strong> SSL profile(s) and then delete it.
                </Typography>
                <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                  Affected profiles: {confirmDialog.data?.ssl_profiles?.join(', ')}
                </Alert>
              </>
            )}
            {confirmDialog.type === 'bulk_safe' && (
              <Typography>
                Are you sure you want to delete <strong>{confirmDialog.data?.length}</strong> certificates?
                These certificates have no SSL profile associations.
              </Typography>
            )}
            {confirmDialog.type === 'bulk_dissociate' && (
              <>
                <Typography gutterBottom>
                  Are you sure you want to dissociate and delete <strong>{confirmDialog.data?.length}</strong> certificates?
                </Typography>
                <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                  This will modify SSL profiles to remove certificate associations before deletion.
                </Alert>
              </>
            )}
            {confirmDialog.type === 'bulk_selected' && (
              <Typography>
                Are you sure you want to delete <strong>{confirmDialog.data?.length}</strong> selected certificates?
              </Typography>
            )}
            {createSnapshots && (
              <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
                A snapshot will be created for potential rollback.
              </Alert>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => setConfirmDialog({ open: false, type: '', data: null })}
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (confirmDialog.type === 'single_force') {
                handleDeleteSingle(confirmDialog.data, 'force');
              } else if (confirmDialog.type === 'single_dissociate') {
                handleDeleteSingle(confirmDialog.data, 'dissociate');
              } else if (confirmDialog.type === 'bulk_safe') {
                const ids = confirmDialog.data.map(c => c.id).filter(id => id > 0);
                setSelectedCerts(ids);
                handleBulkDelete('force');
              } else if (confirmDialog.type === 'bulk_dissociate' || confirmDialog.type === 'bulk_selected') {
                const ids = Array.isArray(confirmDialog.data) 
                  ? confirmDialog.data.map(c => typeof c === 'object' ? c.id : c).filter(id => id > 0)
                  : confirmDialog.data;
                setSelectedCerts(ids);
                handleBulkDelete('dissociate');
              }
            }}
            disabled={loading}
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            {loading ? <CircularProgress size={20} /> : 'Confirm Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog 
        open={previewDialog.open} 
        onClose={() => setPreviewDialog({ open: false, data: null })}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PreviewIcon color="info" />
            Operation Preview (Dry Run)
          </Box>
        </DialogTitle>
        <DialogContent>
          {previewDialog.data && (
            <>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={4}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: alpha(theme.palette.background.default, 0.5), borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">Total</Typography>
                    <Typography variant="h5" fontWeight={600}>{previewDialog.data.total_certificates}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={4}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: alpha(theme.palette.success.main, 0.1), borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">Can Proceed</Typography>
                    <Typography variant="h5" fontWeight={600} color="success.main">{previewDialog.data.can_proceed}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={4}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: alpha(theme.palette.error.main, 0.1), borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">Blocked</Typography>
                    <Typography variant="h5" fontWeight={600} color="error.main">{previewDialog.data.blocked}</Typography>
                  </Paper>
                </Grid>
              </Grid>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" gutterBottom>
                <strong>Profiles to modify:</strong> {previewDialog.data.total_profiles_affected}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Estimated duration:</strong> ~{previewDialog.data.estimated_duration_seconds}s
              </Typography>
              <Divider sx={{ my: 2 }} />
              <List dense>
                {previewDialog.data.results?.slice(0, 10).map((result, idx) => (
                  <ListItem key={idx}>
                    <ListItemIcon>
                      {result.can_proceed ? <CheckCircleIcon color="success" /> : <ErrorIcon color="error" />}
                    </ListItemIcon>
                    <ListItemText
                      primary={result.cert_name}
                      secondary={
                        result.can_proceed
                          ? `Action: ${result.action}${result.profiles_to_dissociate?.length > 0 ? ` (${result.profiles_to_dissociate.length} profiles)` : ''}`
                          : result.blockers?.join(', ')
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => setPreviewDialog({ open: false, data: null })}
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            Close
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setPreviewDialog({ open: false, data: null });
              handleBulkDelete('dissociate');
            }}
            disabled={loading || (previewDialog.data?.can_proceed === 0)}
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            Execute Cleanup
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snapshots Dialog */}
      <Dialog
        open={snapshotsDialog.open}
        onClose={() => setSnapshotsDialog({ open: false })}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon color="primary" />
              Operation Snapshots
            </Box>
            <IconButton onClick={loadSnapshots} disabled={loadingSnapshots} size="small">
              <RefreshIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {loadingSnapshots ? (
            <LinearProgress sx={{ borderRadius: 1 }} />
          ) : snapshots.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              No snapshots available. Snapshots are created when you delete certificates with the "Create Snapshots" option enabled.
            </Alert>
          ) : (
            <List>
              {snapshots.map((snapshot) => (
                <ListItem
                  key={snapshot.id}
                  sx={{ 
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 2,
                    mb: 1,
                  }}
                  secondaryAction={
                    snapshot.can_rollback && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<UndoIcon />}
                        onClick={() => handleRollback(snapshot.id)}
                        disabled={loading}
                        sx={{ borderRadius: 2, textTransform: 'none' }}
                      >
                        Rollback
                      </Button>
                    )
                  }
                >
                  <ListItemIcon>
                    {snapshot.status === 'applied' ? (
                      <CheckCircleIcon color="success" />
                    ) : snapshot.status === 'rolled_back' ? (
                      <UndoIcon color="info" />
                    ) : (
                      <WarningIcon color="warning" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={600}>{snapshot.cert_name}</Typography>
                        <Chip size="small" label={snapshot.operation_type} color="primary" variant="outlined" />
                        <Chip size="small" label={snapshot.status} variant="outlined" />
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        Device: {snapshot.device_hostname} | 
                        Created: {new Date(snapshot.created_at).toLocaleString()} |
                        By: {snapshot.created_by || 'system'}
                        {snapshot.affected_profiles?.length > 0 && (
                          <> | Profiles: {snapshot.affected_profiles.length}</>
                        )}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => setSnapshotsDialog({ open: false })}
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CertificateCleanupPage;
