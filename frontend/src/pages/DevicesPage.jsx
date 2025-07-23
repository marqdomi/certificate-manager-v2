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
    
    // --- ESTILO REUTILIZABLE PARA EL EFECTO DE VIDRIO ---
const glassmorphicStyle = {
  p: { xs: 2, sm: 3 },
  backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(26, 33, 51, 0.6)' : 'rgba(255, 255, 255, 0.7)',
  backdropFilter: 'blur(12px)',
  border: '1px solid',
  borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
  borderRadius: '20px', // Un radio de borde más grande y sutil para este contenedor principal
};

    // --- ESTADOS ---
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
    const [refreshKey, setRefreshKey] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [credentialModalOpen, setCredentialModalOpen] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState(null);

    // --- LÓGICA DE ACCIONES ---

    const forceTableRefresh = () => {
        setRefreshKey(oldKey => oldKey + 1);
    };

    const handleScanAll = () => {
        setNotification({ open: true, message: 'Queueing scan tasks for all devices...', severity: 'info' });
        apiClient.post('/f5/scan-all')
            .then(res => setNotification({ open: true, message: res.data.message, severity: 'success' }))
            .catch(err => setNotification({ open: true, message: 'Failed to queue scan tasks.', severity: 'error' }));
    };

    const openCredentialModal = (device) => {
        setSelectedDevice(device);
        setCredentialModalOpen(true);
    };

    const handleSaveCredentials = (credentials) => {
        if (!selectedDevice) return;
        apiClient.put(`/devices/${selectedDevice.id}/credentials`, credentials)
            .then(res => {
                setNotification({ open: true, message: `Credentials for ${res.data.hostname} updated successfully.`, severity: 'success' });
                setCredentialModalOpen(false);
                forceTableRefresh();
            })
            .catch(err => setNotification({ open: true, message: `Failed to update credentials: ${err.response?.data?.detail || err.message}`, severity: 'error' }));
    };

    const handleAddDevice = (deviceData) => {
        apiClient.post('/devices', deviceData)
            .then(() => {
                setNotification({ open: true, message: 'Device added successfully!', severity: 'success' });
                setAddModalOpen(false);
                forceTableRefresh();
            })
            .catch(err => setNotification({ open: true, message: `Failed to add device: ${err.response?.data?.detail || 'Check console for details'}.`, severity: 'error' }));
    };
        
    const handleDeleteDevice = (deviceId) => {
        if (window.confirm('Are you sure you want to delete this device and all its associated certificates? This action cannot be undone.')) {
            apiClient.delete(`/devices/${deviceId}`)
                .then(() => {
                    setNotification({ open: true, message: 'Device deleted successfully.', severity: 'success' });
                    forceTableRefresh();
                })
                .catch(err => setNotification({ open: true, message: `Failed to delete device: ${err.response?.data?.detail || 'Check console for details'}.`, severity: 'error' }));
        }
    };

    // --- RENDERIZADO (REDISEÑADO) ---

    return (
        <Box>
            {/* ✅ CAMBIO 1: Envolvemos toda la vista en nuestro Paper "de vidrio" */}
            <Paper elevation={0} sx={glassmorphicStyle}>

                {/* ✅ CAMBIO 2: Encabezado integrado y reorganizado */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                    {/* Título a la izquierda */}
                    <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
                        Device Inventory
                    </Typography>
                    
                    {/* Controles (búsqueda y botones) a la derecha */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <TextField
                            variant="outlined"
                            size="small"
                            placeholder="Search by Hostname or IP"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            sx={{ minWidth: '300px' }}
                            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }}
                        />
                        
                        {userRole !== 'viewer' && (
                            <Box>
                                {userRole === 'admin' && (
                                    <Button variant="contained" onClick={() => setAddModalOpen(true)} sx={{ mr: 1 }}>
                                        Add Device
                                    </Button>
                                )}
                                <Button variant="contained" color="secondary" onClick={handleScanAll}>
                                    Scan All Devices
                                </Button>
                            </Box>
                        )}
                    </Box>
                </Box>

                {/* La notificación ahora vive dentro del Paper, se ve más integrada */}
                {notification.open && <Alert severity={notification.severity} onClose={() => setNotification({ ...notification, open: false })} sx={{ mb: 2 }}>{notification.message}</Alert>}
                
                {/* La tabla de dispositivos. El siguiente paso será estilizarla internamente */}
                <DeviceTable 
                    onSetCredentials={openCredentialModal}
                    onDeleteDevice={handleDeleteDevice}
                    refreshTrigger={refreshKey}
                    searchTerm={searchTerm}
                    userRole={userRole}
                />

            </Paper>

            {/* --- Los diálogos modales permanecen fuera del Paper, lo cual es correcto --- */}
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