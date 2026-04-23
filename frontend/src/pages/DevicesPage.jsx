// frontend/src/pages/DevicesPage.jsx
import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Alert, 
  TextField, 
  InputAdornment, 
  Paper, 
  CircularProgress,
  Stack,
  Card,
  CardContent,
  Divider,
  Chip,
  useTheme,
  Snackbar,
  FormControlLabel,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import ScannerIcon from '@mui/icons-material/Scanner';
import InventoryIcon from '@mui/icons-material/Inventory';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import FilterListIcon from '@mui/icons-material/FilterList';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { authProvider } from './LoginPage';
import apiClient from '../services/api';
import DeviceTable from '../components/DeviceTable';
import CredentialDialog from '../components/CredentialDialog';
import AddDeviceDialog from '../components/AddDeviceDialog';
import DeleteDeviceDialog from '../components/DeleteDeviceDialog';

const DevicesPage = () => {
  const userRole = authProvider.getRole();
  
  // Helper function to check if user has admin privileges
  const isAdmin = () => {
    return userRole === 'admin' || userRole === 'super_admin';
  };
  const glassmorphicStyle = {
    p: { xs: 2, sm: 3 },
    backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(26, 33, 51, 0.6)' : 'rgba(255, 255, 255, 0.7)'),
    backdropFilter: 'blur(12px)',
    border: '1px solid',
    borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'),
    borderRadius: '20px',
  };

  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [deviceToDelete, setDeviceToDelete] = useState(null);
  const [scanningCerts, setScanningCerts] = useState(false);
  const [scanningInventory, setScanningInventory] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [discoveringClusters, setDiscoveringClusters] = useState(false);
  const [unifiedDiscovery, setUnifiedDiscovery] = useState(false);

  // New cluster-related state
  const [viewMode, setViewMode] = useState('condensed'); // 'condensed' | 'expanded'
  const [clusterFilters, setClusterFilters] = useState({
    showOnlyPrimaries: false,
    showOnlyClusters: false,
    showOnlyStandalone: false
  });
  const [showFilters, setShowFilters] = useState(false);

  const forceTableRefresh = () => setRefreshKey((k) => k + 1);

  // Handle cluster filter changes
  const handleClusterFilterChange = (filterName, value) => {
    setClusterFilters(prev => {
      const newFilters = { ...prev, [filterName]: value };
      
      // Ensure mutually exclusive filters
      if (value && filterName === 'showOnlyPrimaries') {
        newFilters.showOnlyClusters = false;
        newFilters.showOnlyStandalone = false;
      } else if (value && filterName === 'showOnlyClusters') {
        newFilters.showOnlyPrimaries = false;
        newFilters.showOnlyStandalone = false;
      } else if (value && filterName === 'showOnlyStandalone') {
        newFilters.showOnlyPrimaries = false;
        newFilters.showOnlyClusters = false;
      }
      
      return newFilters;
    });
  };

  // Handle view mode change
  const handleViewModeChange = (event, newMode) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };

  const handleScanCertificates = () => {
    setScanningCerts(true);
    apiClient
      .post('/f5/scan-all')
      .then((res) => {
        setNotification({
          open: true,
          message: res.data?.message || 'Certificate scan queued for all devices. Results will appear shortly.',
          severity: 'success',
        });
        // Auto-refresh table after 10 seconds to show scan results
        setTimeout(() => {
          forceTableRefresh();
          setScanningCerts(false);
        }, 10000);
      })
      .catch((err) => {
        setNotification({ open: true, message: `Failed: ${err.message}`, severity: 'error' });
        setScanningCerts(false);
      });
  };

    const handleScanInventory = async () => {
    if (scanningInventory) return;
    
    setScanningInventory(true);
    try {
      const response = await apiClient.post('/devices/refresh-facts-all');
      
      setNotification({
        open: true,
        message: `Inventory scan initiated successfully for all devices!`,
        severity: 'success'
      });
      
      // Force a complete refresh of the table data
      forceTableRefresh();
      
      // Auto-refresh after a delay to show updated facts
      setTimeout(() => {
        forceTableRefresh();
      }, 5000);
      
      // Additional refresh after longer delay for slower devices
      setTimeout(() => {
        forceTableRefresh();
      }, 15000);
      
    } catch (error) {
      console.error('Error scanning inventory:', error);
      setNotification({
        open: true,
        message: `Error scanning inventory: ${error.response?.data?.detail || error.message}`,
        severity: 'error'
      });
    } finally {
      setScanningInventory(false);
    }
  };

  const handleClusterDiscovery = async () => {
    if (discoveringClusters) return;
    
    setDiscoveringClusters(true);
    try {
      const response = await apiClient.post('/devices/cluster/discover');
      
      const { discovered_clusters, standalone_devices, failed_devices, total_processed } = response.data;
      
      setNotification({
        open: true,
        message: `Cluster discovery completed! Found ${discovered_clusters.length} clusters, ${standalone_devices.length} standalone devices. Processed ${total_processed} devices with ${failed_devices.length} failures.`,
        severity: 'success'
      });
      
      // Force a complete refresh of the table data to show new cluster assignments
      forceTableRefresh();
      
      // Additional refresh after delay to show updated cluster info
      setTimeout(() => {
        forceTableRefresh();
      }, 3000);
      
    } catch (error) {
      console.error('Error discovering clusters:', error);
      setNotification({
        open: true,
        message: `Error discovering clusters: ${error.response?.data?.detail || error.message}`,
        severity: 'error'
      });
    } finally {
      setDiscoveringClusters(false);
    }
  };

  // Nueva función de Discovery Unificado siguiendo mejores prácticas de Microsoft
  const handleUnifiedDiscovery = async (discoveryType = 'full') => {
    if (unifiedDiscovery) return;
    
    // Debug: Verificar token y rol antes de la llamada
    const token = localStorage.getItem('user_token');
    const role = localStorage.getItem('user_role');
    console.log('Debug - Token exists:', !!token);
    console.log('Debug - User role:', role);
    
    if (!token) {
      setNotification({
        open: true,
        message: 'No hay token de autenticación. Por favor, vuelve a iniciar sesión.',
        severity: 'error'
      });
      return;
    }
    
    if (role !== 'admin' && role !== 'super_admin') {
      setNotification({
        open: true,
        message: `Permisos insuficientes. Rol actual: ${role}. Se requiere: admin o super_admin`,
        severity: 'error'
      });
      return;
    }
    
    setUnifiedDiscovery(true);
    try {
      console.log('Enviando request de Discovery Unificado...');
      const response = await apiClient.post('/devices/unified-discovery', {
        discovery_type: discoveryType,
        include_performance: false,
        max_concurrent: 5
      });
      
      const { total_devices, successful, failed, success_rate, duration } = response.data;
      
      setNotification({
        open: true,
        message: `Unified Discovery completed successfully! Processed ${successful}/${total_devices} devices (${success_rate.toFixed(1)}% success) in ${duration.toFixed(1)}s. Combined facts scanning and cluster discovery in an optimized operation.`,
        severity: success_rate === 100 ? 'success' : 'warning'
      });
      
      // Force a complete refresh of the table data
      forceTableRefresh();
      
      // Auto-refresh after delay to show updated data
      setTimeout(() => {
        forceTableRefresh();
      }, 3000);
      
    } catch (error) {
      console.error('Error in unified discovery:', error);
      setNotification({
        open: true,
        message: `Unified Discovery error: ${error.response?.data?.message || error.message}`,
        severity: 'error'
      });
    } finally {
      setUnifiedDiscovery(false);
    }
  };

  const handleSaveCredentials = (credentials) => {
    if (!selectedDevice) return;
    apiClient
      .put(`/devices/${selectedDevice.id}/credentials`, credentials)
      .then(() => {
        setNotification({ open: true, message: `Credentials updated.`, severity: 'success' });
        setCredentialModalOpen(false);
        forceTableRefresh();
      })
      .catch((err) =>
        setNotification({ open: true, message: `Error: ${err.message}`, severity: 'error' })
      );
  };

  const handleAddDevice = (deviceData) => {
    apiClient
      .post('/devices', deviceData)
      .then(() => {
        setNotification({ open: true, message: 'Device added.', severity: 'success' });
        setAddModalOpen(false);
        forceTableRefresh();
      })
      .catch((err) =>
        setNotification({ open: true, message: `Error: ${err.message}`, severity: 'error' })
      );
  };

  const handleDeleteDevice = (device) => {
    setDeviceToDelete(device);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (device) => {
    const deviceName = device?.hostname || `Device ID ${device?.id}`;
    setIsDeleting(true);
    
    try {
      await apiClient.delete(`/devices/${device.id}`);
      setNotification({ 
        open: true, 
        message: `Device "${deviceName}" deleted successfully.`, 
        severity: 'success' 
      });
      setDeleteModalOpen(false);
      setDeviceToDelete(null);
      forceTableRefresh();
    } catch (err) {
      setNotification({ 
        open: true, 
        message: `Error deleting device: ${err.response?.data?.detail || err.message}`, 
        severity: 'error' 
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    if (!isDeleting) {
      setDeleteModalOpen(false);
      setDeviceToDelete(null);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Modern Header Card */}
      <Card 
        elevation={3} 
        sx={{ 
          mb: 3, 
          borderRadius: 3,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                Device Inventory
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                Manage F5 devices, scan certificates, and monitor infrastructure health
              </Typography>
            </Box>
            
            {userRole !== 'viewer' && (
              <Stack direction="row" spacing={2}>
                {isAdmin() && (
                  <Button 
                    variant="contained" 
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={() => setAddModalOpen(true)}
                    sx={{ 
                      bgcolor: 'rgba(255,255,255,0.2)', 
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                      backdropFilter: 'blur(10px)'
                    }}
                  >
                    Add Device
                  </Button>
                )}
                <Button 
                  variant="contained" 
                  startIcon={scanningCerts ? <CircularProgress size={16} color="inherit" /> : <ScannerIcon />}
                  onClick={handleScanCertificates}
                  disabled={scanningCerts}
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.2)', 
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  {scanningCerts ? 'Scanning...' : 'Scan Certificates'}
                </Button>
                {isAdmin() && (
                  <Tooltip title="Operación unificada: combina facts scanning y cluster discovery siguiendo mejores prácticas de Microsoft">
                    <Button 
                      variant="contained" 
                      startIcon={unifiedDiscovery ? <CircularProgress size={16} color="inherit" /> : <AutorenewIcon />}
                      onClick={() => handleUnifiedDiscovery('full')}
                      disabled={unifiedDiscovery}
                      sx={{ 
                        bgcolor: 'rgba(76, 175, 80, 0.2)', 
                        '&:hover': { bgcolor: 'rgba(76, 175, 80, 0.3)' },
                        backdropFilter: 'blur(10px)',
                        color: 'success.main',
                        fontWeight: 'bold'
                      }}
                    >
                      {unifiedDiscovery ? 'Running Discovery...' : 'Unified Discovery'}
                    </Button>
                  </Tooltip>
                )}
                <Button 
                  variant="outlined" 
                  startIcon={scanningInventory ? <CircularProgress size={16} color="inherit" /> : <InventoryIcon />}
                  onClick={handleScanInventory}
                  disabled={scanningInventory || unifiedDiscovery}
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.1)', 
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                    backdropFilter: 'blur(10px)',
                    borderColor: 'rgba(255,255,255,0.3)'
                  }}
                >
                  {scanningInventory ? 'Updating...' : 'Solo Facts'}
                </Button>
                {isAdmin() && (
                  <Button 
                    variant="outlined" 
                    startIcon={discoveringClusters ? <CircularProgress size={16} color="inherit" /> : <GroupWorkIcon />}
                    onClick={handleClusterDiscovery}
                    disabled={discoveringClusters || unifiedDiscovery}
                    sx={{ 
                      bgcolor: 'rgba(255,255,255,0.1)', 
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                      backdropFilter: 'blur(10px)',
                      borderColor: 'rgba(255,255,255,0.3)'
                    }}
                  >
                    {discoveringClusters ? 'Discovering...' : 'Solo Clusters'}
                  </Button>
                )}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Search and Filters Card */}
      <Card elevation={1} sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            {/* Primary row with search and controls */}
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                size="small"
                placeholder="Search devices by hostname, IP address, site, or cluster..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{ flexGrow: 1, maxWidth: 500 }}
              />
              
              <Divider orientation="vertical" flexItem />
              
              {/* View Mode Toggle */}
              <Tooltip title="Switch between condensed and expanded view">
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={handleViewModeChange}
                  size="small"
                >
                  <ToggleButton value="condensed" aria-label="condensed view">
                    <ViewListIcon />
                  </ToggleButton>
                  <ToggleButton value="expanded" aria-label="expanded view">
                    <ViewModuleIcon />
                  </ToggleButton>
                </ToggleButtonGroup>
              </Tooltip>

              {/* Filter Toggle Button */}
              <Button
                variant={showFilters ? "contained" : "outlined"}
                startIcon={<FilterListIcon />}
                onClick={() => setShowFilters(!showFilters)}
                size="small"
              >
                Filters
              </Button>
            </Stack>

            {/* Cluster Filters (collapsible) */}
            {showFilters && (
              <Box sx={{ 
                pt: 2, 
                borderTop: `1px solid ${(theme) => theme.palette.divider}`,
              }}>
                <Stack direction="row" spacing={3} flexWrap="wrap">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={clusterFilters.showOnlyPrimaries}
                        onChange={(e) => handleClusterFilterChange('showOnlyPrimaries', e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">Show Only Primaries</Typography>
                        <Chip label="Primary + Standalone" size="small" variant="outlined" />
                      </Stack>
                    }
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={clusterFilters.showOnlyClusters}
                        onChange={(e) => handleClusterFilterChange('showOnlyClusters', e.target.checked)}
                        color="secondary"
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">Show Only Clusters</Typography>
                        <Chip label="Clustered devices" size="small" variant="outlined" />
                      </Stack>
                    }
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={clusterFilters.showOnlyStandalone}
                        onChange={(e) => handleClusterFilterChange('showOnlyStandalone', e.target.checked)}
                        color="info"
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">Show Only Standalone</Typography>
                        <Chip label="Single devices" size="small" variant="outlined" />
                      </Stack>
                    }
                  />
                </Stack>
                
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Current view: {viewMode === 'condensed' ? 'Condensed (showing cluster primaries only)' : 'Expanded (showing all devices)'}
                    {Object.values(clusterFilters).some(Boolean) && ' • Filters applied'}
                  </Typography>
                </Box>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Notifications */}
      {notification.open && (
        <Alert severity={notification.severity} sx={{ mb: 2 }}>
          {notification.message}
        </Alert>
      )}



      {/* Device Table */}
      <DeviceTable
        onSetCredentials={(d) => {
          setSelectedDevice(d);
          setCredentialModalOpen(true);
        }}
        onDeleteDevice={handleDeleteDevice}
        refreshTrigger={refreshKey}
        searchTerm={searchTerm}
        userRole={userRole}
        clusterFilters={clusterFilters}
        onClusterFilterChange={handleClusterFilterChange}
        viewMode={viewMode}
      />

      {/* Dialogs */}
      <CredentialDialog
        open={credentialModalOpen}
        onClose={() => setCredentialModalOpen(false)}
        onSave={handleSaveCredentials}
        device={selectedDevice}
      />
      
      {isAdmin() && (
        <AddDeviceDialog
          open={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          onAdd={handleAddDevice}
        />
      )}

      {isAdmin() && (
        <DeleteDeviceDialog
          open={deleteModalOpen}
          onClose={handleCancelDelete}
          onConfirm={handleConfirmDelete}
          device={deviceToDelete}
          isDeleting={isDeleting}
        />
      )}

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setNotification({ ...notification, open: false })} 
          severity={notification.severity}
          sx={{ borderRadius: '12px' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DevicesPage;