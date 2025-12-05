// frontend/src/pages/DevicesPage.jsx
import React, { useState } from 'react';
import { Box, Typography, Button, Alert, TextField, InputAdornment, Paper } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import { authProvider } from './LoginPage';
import apiClient from '../services/api';
import DeviceTable from '../components/DeviceTable';
import DeviceDetailDrawer from '../components/DeviceDetailDrawer';
import EditDeviceDialog from '../components/EditDeviceDialog';
import CredentialDialog from '../components/CredentialDialog';
import AddDeviceDialog from '../components/AddDeviceDialog';
import FilterChipsBar from '../components/FilterChipsBar';
import BulkActionsBar from '../components/BulkActionsBar';
import BulkCredentialsDialog from '../components/BulkCredentialsDialog';

const DevicesPage = () => {
  const userRole = authProvider.getRole();
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
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [drawerDevice, setDrawerDevice] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editDevice, setEditDevice] = useState(null);

  const [selectedIds, setSelectedIds] = useState([]);
  const [limitCertsInput, setLimitCertsInput] = useState('');
  const [clearSelectionKey, setClearSelectionKey] = useState(0);
  const [filters, setFilters] = useState({});
  const [allDevices, setAllDevices] = useState([]);
  const [bulkCredentialsOpen, setBulkCredentialsOpen] = useState(false);

  const forceTableRefresh = () => setRefreshKey((k) => k + 1);

  // Export devices to CSV
  const handleExportCSV = () => {
    if (!allDevices || allDevices.length === 0) {
      setNotification({ open: true, message: 'No devices to export.', severity: 'warning' });
      return;
    }

    // Define CSV columns
    const columns = [
      'id', 'hostname', 'ip_address', 'site', 'cluster_key', 'is_primary_preferred',
      'version', 'ha_state', 'sync_status', 'last_sync_color',
      'last_scan_status', 'last_scan_message', 'last_facts_refresh',
      'active', 'username', 'created_at', 'updated_at'
    ];

    // Create CSV header
    const header = columns.join(',');

    // Create CSV rows
    const rows = allDevices.map(device => {
      return columns.map(col => {
        let value = device[col];
        if (value === null || value === undefined) value = '';
        if (typeof value === 'boolean') value = value ? 'Yes' : 'No';
        // Escape quotes and wrap in quotes if contains comma or newline
        value = String(value).replace(/"/g, '""');
        if (value.includes(',') || value.includes('\n') || value.includes('"')) {
          value = `"${value}"`;
        }
        return value;
      }).join(',');
    });

    // Combine header and rows
    const csv = [header, ...rows].join('\n');

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().slice(0, 10);
    link.download = `device_inventory_${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setNotification({ open: true, message: `Exported ${allDevices.length} devices to CSV.`, severity: 'success' });
  };

  const handleScanAll = () => {
    apiClient.post('/f5/scan-all')
      .then((res) => setNotification({ open: true, message: res.data?.message || 'Scan queued.', severity: 'success' }))
      .catch((err) => setNotification({ open: true, message: `Failed: ${err.message}`, severity: 'error' }));
  };

  const handleSaveCredentials = (credentials) => {
    if (!selectedDevice) return;
    apiClient.put(`/devices/${selectedDevice.id}/credentials`, credentials)
      .then((res) => {
        setNotification({ open: true, message: `Credentials updated.`, severity: 'success' });
        setCredentialModalOpen(false);
        forceTableRefresh();
      })
      .catch((err) => setNotification({ open: true, message: `Error: ${err.message}`, severity: 'error' }));
  };

  const handleAddDevice = (deviceData) => {
    apiClient.post('/devices', deviceData)
      .then(() => {
        setNotification({ open: true, message: 'Device added.', severity: 'success' });
        setAddModalOpen(false);
        forceTableRefresh();
      })
      .catch((err) => setNotification({ open: true, message: `Error: ${err.message}`, severity: 'error' }));
  };

  const handleDeleteDevice = (id) => {
    apiClient.delete(`/devices/${id}`)
      .then(() => {
        setNotification({ open: true, message: 'Device deleted.', severity: 'success' });
        setSelectedIds((prev) => prev.filter((x) => x !== id));
        forceTableRefresh();
      })
      .catch((err) => setNotification({ open: true, message: `Error: ${err.message}`, severity: 'error' }));
  };

  const bulkRefreshFacts = async () => {
    await Promise.all(selectedIds.map((id) => apiClient.post(`/devices/${id}/refresh-facts`)));
    setNotification({ open: true, message: `Queued facts refresh for ${selectedIds.length}.`, severity: 'success' });
  };

  const bulkRefreshCache = async () => {
    const qs = limitCertsInput.trim() ? `?limit_certs=${encodeURIComponent(limitCertsInput.trim())}` : '';
    await Promise.all(selectedIds.map((id) => apiClient.post(`/devices/${id}/refresh-cache${qs}`)));
    setNotification({ open: true, message: `Queued cache refresh for ${selectedIds.length}.`, severity: 'success' });
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setClearSelectionKey((k) => k + 1);
  };

  const handleBulkCredentialsComplete = () => {
    setBulkCredentialsOpen(false);
    forceTableRefresh();
  };

  // Device detail drawer handlers
  const handleRowClick = (device) => {
    setDrawerDevice(device);
    setDetailDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDetailDrawerOpen(false);
  };

  const handleScanDevice = (device) => {
    apiClient.post('/f5/scan-all', { device_ids: [device.id] })
      .then((res) => {
        setNotification({ open: true, message: `Scan queued for ${device.hostname}`, severity: 'success' });
        forceTableRefresh();
      })
      .catch((err) => setNotification({ open: true, message: `Failed: ${err.message}`, severity: 'error' }));
  };

  const handleEditDevice = (device) => {
    setEditDevice(device);
    setEditModalOpen(true);
    setDetailDrawerOpen(false); // Cerrar drawer al abrir edit
  };

  const handleSaveDevice = (updatedDevice) => {
    setNotification({ open: true, message: `Device ${updatedDevice.hostname} updated successfully.`, severity: 'success' });
    forceTableRefresh();
    // Actualizar drawer si está abierto
    if (drawerDevice && drawerDevice.id === updatedDevice.id) {
      setDrawerDevice(updatedDevice);
    }
  };

  return (
    <Box>
      <Paper elevation={0} sx={glassmorphicStyle}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Device Inventory</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search by Hostname, IP or Site"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }}
            />
            {userRole !== 'viewer' && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {userRole === 'admin' && <Button variant="contained" onClick={() => setAddModalOpen(true)}>Add Device</Button>}
                <Button variant="contained" color="secondary" onClick={handleScanAll}>Scan All Devices</Button>
                <Button 
                  variant="outlined" 
                  startIcon={<DownloadIcon />} 
                  onClick={handleExportCSV}
                  disabled={allDevices.length === 0}
                >
                  Export CSV
                </Button>
              </Box>
            )}
          </Box>
        </Box>

        {notification.open && <Alert severity={notification.severity}>{notification.message}</Alert>}

        {/* Filter Chips */}
        <FilterChipsBar
          devices={allDevices}
          filters={filters}
          onFiltersChange={setFilters}
        />

        {selectedIds.length > 0 && (
          <BulkActionsBar
            selectionCount={selectedIds.length}
            onRefreshFacts={bulkRefreshFacts}
            onRefreshCache={bulkRefreshCache}
            onScanAll={handleScanAll}
            onClearSelection={clearSelection}
            onBulkSetCredentials={() => setBulkCredentialsOpen(true)}
            limitCertsInput={limitCertsInput}
            setLimitCertsInput={setLimitCertsInput}
            userRole={userRole}
          />
        )}

        <DeviceTable
          onSetCredentials={(d) => { setSelectedDevice(d); setCredentialModalOpen(true); }}
          onDeleteDevice={handleDeleteDevice}
          onRowClick={handleRowClick}
          refreshTrigger={refreshKey}
          searchTerm={searchTerm}
          userRole={userRole}
          onSelectionChange={setSelectedIds}
          clearSelectionKey={clearSelectionKey}
          filters={filters}
          onDevicesLoaded={setAllDevices}
        />
      </Paper>

      {/* Device Detail Drawer */}
      <DeviceDetailDrawer
        open={detailDrawerOpen}
        onClose={handleDrawerClose}
        device={drawerDevice}
        onSetCredentials={(d) => {
          setSelectedDevice(d);
          setCredentialModalOpen(true);
          setDetailDrawerOpen(false);
        }}
        onEdit={handleEditDevice}
        onScan={handleScanDevice}
      />

      <CredentialDialog open={credentialModalOpen} onClose={() => setCredentialModalOpen(false)} onSave={handleSaveCredentials} device={selectedDevice} />
      <EditDeviceDialog 
        open={editModalOpen} 
        onClose={() => setEditModalOpen(false)} 
        device={editDevice} 
        onSave={handleSaveDevice} 
      />
      <BulkCredentialsDialog
        open={bulkCredentialsOpen}
        onClose={() => setBulkCredentialsOpen(false)}
        selectedIds={selectedIds}
        devices={allDevices}
        onComplete={handleBulkCredentialsComplete}
      />
      {userRole === 'admin' && <AddDeviceDialog open={addModalOpen} onClose={() => setAddModalOpen(false)} onAdd={handleAddDevice} />}
    </Box>
  );
};

export default DevicesPage;