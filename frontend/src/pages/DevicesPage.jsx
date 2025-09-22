// frontend/src/pages/DevicesPage.jsx
import React, { useState } from 'react';
import { Box, Typography, Button, Alert, TextField, InputAdornment, Paper } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { authProvider } from './LoginPage';
import apiClient from '../services/api';
import DeviceTable from '../components/DeviceTable';
import CredentialDialog from '../components/CredentialDialog';
import AddDeviceDialog from '../components/AddDeviceDialog';

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

  const forceTableRefresh = () => setRefreshKey((k) => k + 1);

  const handleScanCertificates = () => {
    apiClient
      .post('/f5/scan-all')
      .then((res) =>
        setNotification({
          open: true,
          message: res.data?.message || 'Certificate scan queued for all devices.',
          severity: 'success',
        })
      )
      .catch((err) =>
        setNotification({ open: true, message: `Failed: ${err.message}`, severity: 'error' })
      );
  };

  const handleScanInventory = () => {
    apiClient
      .post('/devices/refresh-facts-all')
      .then((res) =>
        setNotification({
          open: true,
          message: res.data?.message || 'Inventory (facts) refresh queued for all devices.',
          severity: 'success',
        })
      )
      .catch((err) =>
        setNotification({ open: true, message: `Failed: ${err.message}`, severity: 'error' })
      );
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

  const handleDeleteDevice = (id) => {
    apiClient
      .delete(`/devices/${id}`)
      .then(() => {
        setNotification({ open: true, message: 'Device deleted.', severity: 'success' });
        forceTableRefresh();
      })
      .catch((err) =>
        setNotification({ open: true, message: `Error: ${err.message}`, severity: 'error' })
      );
  };

  return (
    <Box>
      <Paper elevation={0} sx={glassmorphicStyle}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            Device Inventory
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search by Hostname, IP or Site"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            {userRole !== 'viewer' && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {userRole === 'admin' && (
                  <Button variant="contained" onClick={() => setAddModalOpen(true)}>
                    Add Device
                  </Button>
                )}
                <Button variant="contained" color="secondary" onClick={handleScanCertificates}>
                  Scan Certificates
                </Button>
                <Button variant="contained" color="info" onClick={handleScanInventory}>
                  Scan Inventory
                </Button>
              </Box>
            )}
          </Box>
        </Box>

        {notification.open && (
          <Alert severity={notification.severity}>{notification.message}</Alert>
        )}

        <DeviceTable
          onSetCredentials={(d) => {
            setSelectedDevice(d);
            setCredentialModalOpen(true);
          }}
          onDeleteDevice={handleDeleteDevice}
          refreshTrigger={refreshKey}
          searchTerm={searchTerm}
          userRole={userRole}
        />
      </Paper>

      <CredentialDialog
        open={credentialModalOpen}
        onClose={() => setCredentialModalOpen(false)}
        onSave={handleSaveCredentials}
        device={selectedDevice}
      />
      {userRole === 'admin' && (
        <AddDeviceDialog
          open={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          onAdd={handleAddDevice}
        />
      )}
    </Box>
  );
};

export default DevicesPage;