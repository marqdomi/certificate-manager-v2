// frontend/src/pages/DeployCenterPage.jsx

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Alert, Tabs, Tab, Button, Snackbar } from '@mui/material';
import apiClient from '../services/api';
import DeviceSelector from '../components/DeviceSelector'; 
// Importamos los componentes de cada pestaña
import DeployFromPfx from '../components/DeployFromPfx';
import DeployFromFiles from '../components/DeployFromFiles';

// Componente helper para mostrar el contenido de la pestaña activa
function TabPanel(props) {
    const { children, value, index, ...other } = props;
    return (
        <div role="tabpanel" hidden={value !== index} {...other}>
            {value === index && <Box sx={{ p: 3, pt: 4 }}>{children}</Box>}
        </div>
    );
}

function DeployCenterPage() {
    const location = useLocation();
    const navigate = useNavigate();
    
    // Leemos el certificado que nos llega desde la página de inventario
    const certificateToRenew = location.state?.certificateToRenew;
    
    // Determinamos si estamos en modo "Renovación" o "Nuevo Despliegue"
    const isRenewalMode = !!certificateToRenew;

    // --- ESTADOS ---
    const [activeTab, setActiveTab] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
    const [targetDevices, setTargetDevices] = useState([]);

    // --- LÓGICA DE ACCIONES (VERSIÓN FINAL Y COMPLETA) ---

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    const handleDeployPfx = (deployData) => {
        const { pfxFile, pfxPassword } = deployData;

        if (!pfxFile) {
            setNotification({ open: true, message: 'Please upload a PFX file to continue.', severity: 'warning' });
            return;
        }

        setIsLoading(true);
        const formData = new FormData();
        formData.append('pfx_file', pfxFile);
        if (pfxPassword) {
            formData.append('pfx_password', pfxPassword);
        }

        let apiUrl = '';
        
        if (isRenewalMode) {
            // --- MODO RENOVACIÓN ---
            apiUrl = `/certificates/${certificateToRenew.id}/deploy-pfx`;
        } else {
            // --- MODO NUEVO DESPLIEGUE ---
            if (targetDevices.length === 0) {
                setNotification({ open: true, message: 'Please select at least one target device.', severity: 'warning' });
                setIsLoading(false);
                return;
            }
            targetDevices.forEach(device => {
                formData.append('target_device_ids', device.id);
            });
            apiUrl = '/deployments/new-pfx';
        }

        apiClient.post(apiUrl, formData, {
            headers: {
                // Es una buena práctica ser explícito con el content-type cuando se usa FormData,
                // aunque axios suele hacerlo automáticamente.
                'Content-Type': 'multipart/form-data',
            },
        })
            .then(res => {
                let message = "Deployment process finished successfully!";
                let severity = 'success';
                
                // Si la respuesta contiene 'deployment_results', es un nuevo despliegue
                if (res.data && res.data.deployment_results) {
                    const results = res.data.deployment_results;
                    const successCount = results.filter(r => r.status === 'success').length;
                    const totalCount = results.length;

                    message = `Deployment finished. ${successCount} of ${totalCount} devices were successful.`;
                    
                    if (successCount < totalCount) {
                        severity = 'warning';
                        // --- ¡AQUÍ ESTÁ LA MEJORA DEL LOG! ---
                        const failedDeployments = results.filter(r => r.status !== 'success');
                        console.error("Failed deployment details:", failedDeployments);
                    }
                } else if (res.data && res.data.message) {
                    // Si es una renovación, usamos el mensaje que viene de la API
                    message = res.data.message;
                }

                setNotification({ open: true, message, severity });
                // Redirigimos al inventario para ver los resultados
                setTimeout(() => navigate('/certificates'), 4000); // Damos un poco más de tiempo para leer
            })
            .catch(err => {
                setNotification({ open: true, message: `Deployment failed: ${err.response?.data?.detail || 'An unexpected error occurred.'}`, severity: 'error' });
            })
            .finally(() => {
                setIsLoading(false);
            });
    };
    
    // Placeholder para el despliegue desde archivos
    const handleDeployFromFiles = (certContent, keyContent) => {
        setIsLoading(true);
        setTimeout(() => {
            setNotification({ open: true, message: 'Deployment from files is not yet implemented.', severity: 'warning' });
            setIsLoading(false);
        }, 1000);
    };

    // --- RENDERIZADO ---
    return (
        <Box>
            <Typography variant="h4" component="h1" gutterBottom>
                Deployment Center
            </Typography>
            
            {/* Banner contextual que cambia según el modo */}
            {isRenewalMode ? (
                <Alert severity="info" sx={{ mb: 4 }}>
                    <Typography>
                        Renewing certificate: <strong>{certificateToRenew.common_name}</strong>
                    </Typography>
                    <Typography variant="caption">
                        (ID: {certificateToRenew.id} | On F5: {certificateToRenew.f5_device_hostname})
                    </Typography>
                </Alert>
            ) : (
                <Alert severity="info" sx={{ mb: 4 }}>
                    You are in **New Deployment** mode. Upload a certificate and select the target devices below.
                </Alert>
            )}

            <Paper elevation={3}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs value={activeTab} onChange={handleTabChange} aria-label="deployment methods" variant="fullWidth">
                        <Tab label="Deploy from PFX (Recommended)" id="tab-0" />
                        <Tab label="Deploy from Files" id="tab-1" />
                    </Tabs>
                </Box>
                <TabPanel value={activeTab} index={0}>
                    <DeployFromPfx onDeploy={handleDeployPfx} isLoading={isLoading} />
                </TabPanel>
                <TabPanel value={activeTab} index={1}>
                    <DeployFromFiles onDeploy={handleDeployFromFiles} isLoading={isLoading} />
                </TabPanel>
            </Paper>

            {!isRenewalMode && (
                <Paper elevation={3} sx={{ p: 3, mt: 4 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>2. Select Target Devices</Typography>
                    <DeviceSelector 
                        selectedDevices={targetDevices}
                        setSelectedDevices={setTargetDevices}
                    />
                </Paper>
            )}

            {/* Usamos Snackbar para notificaciones menos intrusivas */}
            <Snackbar
                open={notification.open}
                autoHideDuration={6000}
                onClose={() => setNotification({ ...notification, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setNotification({ ...notification, open: false })} severity={notification.severity} sx={{ width: '100%' }}>
                    {notification.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}

export default DeployCenterPage;