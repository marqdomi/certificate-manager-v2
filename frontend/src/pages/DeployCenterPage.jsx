import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Alert, Tabs, Tab, Button, Snackbar, Collapse, List, ListItem, ListItemText } from '@mui/material';
import { CheckCircleOutline, ErrorOutline } from '@mui/icons-material';
import apiClient, { verifyInstalledCert } from '../services/api';
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

    const [verification, setVerification] = useState(null);
    const [showVerification, setShowVerification] = useState(false);
    const [verifyLoading, setVerifyLoading] = useState(false);

    // --- LÓGICA DE ACCIONES (VERSIÓN FINAL Y COMPLETA) ---

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    const handleDeployPfx = (deployData) => {
        const { pfxFile, pfxPassword, installChainFromPfx } = deployData;

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
        // Optional: let the backend know whether to install the chain extracted from the PFX
        if (typeof installChainFromPfx === 'boolean') {
          formData.append('install_chain_from_pfx', installChainFromPfx);
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

                // Capture verification when available (renewal flow returns single object)
                if (res.data && res.data.details && res.data.details.verification) {
                  setVerification(res.data.details.verification);
                  setShowVerification(true);
                }
                // For new deployments to multiple devices, try to surface the first verification returned per device if present
                if (res.data && res.data.deployment_results) {
                  const firstWithVerification = res.data.deployment_results.find(r => r.details && r.details.verification);
                  if (firstWithVerification) {
                    setVerification(firstWithVerification.details.verification);
                    setShowVerification(true);
                  }
                }

                setNotification({ open: true, message, severity });
            })
            .catch(err => {
                setVerification(null);
                setShowVerification(false);
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

    const handleVerifyNow = async () => {
      const objectName = verification?.object_name;
      let deviceId = null;

      if (isRenewalMode) {
        deviceId = certificateToRenew?.device_id || certificateToRenew?.f5_device_id || null;
      } else if (targetDevices && targetDevices.length === 1) {
        deviceId = targetDevices[0].id;
      }

      if (!objectName || !deviceId) {
        setNotification({ open: true, message: 'Cannot verify: missing device or object name. If this was a multi-device deploy, select a single device to verify.', severity: 'warning' });
        return;
      }

      try {
        setVerifyLoading(true);
        const data = await verifyInstalledCert(deviceId, objectName);
        setVerification(data);
        setShowVerification(true);
        setNotification({ open: true, message: 'Verification refreshed from device.', severity: 'success' });
      } catch (e) {
        setNotification({ open: true, message: e?.response?.data?.detail || 'Verification failed.', severity: 'error' });
      } finally {
        setVerifyLoading(false);
      }
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
                    You are in <strong>New Deployment</strong> mode. Upload a certificate and select the target devices below.
                </Alert>
            )}

            {showVerification && verification && (
              <Paper elevation={3} sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                  {String(verification.version) === '3' && (verification.san?.length || 0) > 0 ? (
                    <CheckCircleOutline color="success" />
                  ) : (
                    <ErrorOutline color="error" />
                  )}
                  <Typography variant="h6" sx={{ m: 0 }}>Post‑install verification</Typography>
                </Box>
                <Alert severity={(String(verification.version) === '3' && (verification.san?.length || 0) > 0) ? 'success' : 'error'} sx={{ mb: 2 }}>
                  Version detected: <strong>{verification.version || 'N/A'}</strong> · SAN entries: <strong>{verification.san ? verification.san.length : 0}</strong>
                </Alert>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Note: some F5 GUIs display "Version 2" while the certificate is actually X.509 v3 (ASN.1 index 0x2). Use this verification as the source of truth.
                  </Typography>
                  <Button variant="outlined" size="small" onClick={handleVerifyNow} disabled={verifyLoading}>
                    {verifyLoading ? 'Verifying…' : 'Verify now'}
                  </Button>
                </Box>
                <Collapse in={true}>
                  <List dense>
                    <ListItem><ListItemText primary="Subject" secondary={verification.subject || '—'} /></ListItem>
                    <ListItem><ListItemText primary="Issuer" secondary={verification.issuer || '—'} /></ListItem>
                    <ListItem><ListItemText primary="Serial" secondary={verification.serial || '—'} /></ListItem>
                    <ListItem><ListItemText primary="Not After" secondary={verification.not_after || '—'} /></ListItem>
                    <ListItem>
                      <ListItemText primary={`SAN (${verification.san ? verification.san.length : 0})`} secondary={verification.san && verification.san.length ? verification.san.join(', ') : '—'} />
                    </ListItem>
                  </List>
                </Collapse>
              </Paper>
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

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3, gap: 1 }}>
              <Button variant="text" onClick={() => navigate(-1)}>Back</Button>
              <Button variant="contained" onClick={() => navigate('/certificates')}>Go to Inventory</Button>
            </Box>
        </Box>
    );
}

export default DeployCenterPage;