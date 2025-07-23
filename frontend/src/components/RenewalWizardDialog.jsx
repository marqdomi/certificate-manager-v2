// frontend/src/components/RenewalWizardDialog.jsx

import React, { useState, useEffect } from 'react';
import apiClient from '../services/api';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, Stepper, Step, StepLabel, Box,
    Typography, CircularProgress, Alert, Autocomplete, TextField, Paper, useTheme
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudUploadIcon from '@mui/icons-material/CloudUpload'; // Iconos para los pasos
import LibraryAddCheckIcon from '@mui/icons-material/LibraryAddCheck';
import TaskAltIcon from '@mui/icons-material/TaskAlt';

const steps = ['Upload to F5', 'Select New Certificate', 'Confirm & Update'];

// Componente para los iconos de los pasos del Stepper
const StepIcon = (props) => {
    const { active, completed, className, icon } = props;
    const icons = {
        1: <CloudUploadIcon />,
        2: <LibraryAddCheckIcon />,
        3: <TaskAltIcon />,
    };

    return (
        <Box
            className={className}
            sx={{
                color: active || completed ? 'primary.main' : 'text.disabled',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: (theme) => (active || completed ? theme.palette.primary.light + '33' : 'action.disabledBackground'),
            }}
        >
            {icons[String(icon)]}
        </Box>
    );
};

const RenewalWizardDialog = ({ open, onClose, certificate }) => {
    const theme = useTheme(); 
    const [activeStep, setActiveStep] = useState(0);
    const [f5Certs, setF5Certs] = useState([]);
    const [f5Chains, setF5Chains] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedNewCert, setSelectedNewCert] = useState(null);
    const [selectedChain, setSelectedChain] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (open) {
            setActiveStep(0); // Reinicia el wizard cada vez que se abre
            setSelectedNewCert(null);
            setSelectedChain(null);
            setError('');
        }
    }, [open]);

    const handleRefreshF5Data = () => {
        if (!certificate) return;
        setLoading(true);
        setError('');
        
        const deviceId = certificate.device_id;
        if (!deviceId) {
            setError("Device ID is missing for this certificate.");
            setLoading(false);
            return;
        }

        Promise.all([
            apiClient.get(`/devices/${deviceId}/certificates`),
            apiClient.get(`/devices/${deviceId}/chains`)
        ]).then(([certsResponse, chainsResponse]) => {
            setF5Certs(certsResponse.data.map(c => c.name));
            setF5Chains(chainsResponse.data.map(c => c.name)); // Usamos solo los nombres
            setSelectedChain("/Common/DigiCert_Global_G2_TLS_RSA_SHA256_2020_CA1"); // Ponemos el default
            setActiveStep(1); // Avanzamos al siguiente paso
        }).catch(err => {
            setError("Failed to fetch data from F5. Please check connectivity and credentials.");
            console.error(err);
        }).finally(() => {
            setLoading(false);
        });
    };

    const handleUpdateProfiles = () => {
        if (!selectedNewCert || !certificate) return;
        setLoading(true);
        setError('');

        const payload = {
            device_id: certificate.device_id,
            old_cert_name: certificate.name,
            new_cert_name: selectedNewCert,
            chain_name: selectedChain ? selectedChain.replace('/Common/', '') : null,
        };

        apiClient.post('/certificates/update-profiles', payload)
            .then(res => {
                setActiveStep(2); // Avanzamos al paso final de "Éxito"
            })
            .catch(err => {
                setError(`Failed to update profiles: ${err.response?.data?.detail || 'Unknown error'}`);
            })
            .finally(() => setLoading(false));
    };
    
    if (!open || !certificate) return null;

    const renderStepContent = () => {
        switch (activeStep) {
            case 0:
                return (
                    <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Step 1: Upload New Certificate</Typography>
                        <Typography color="text.secondary" sx={{ my: 2 }}>To ensure the certificate is imported correctly (as V3), please upload it to the F5 using its GUI.</Typography>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, my: 3 }}>
                          <Button variant="outlined" onClick={() => window.open('/pfx-generator', '_blank')}>Go to PFX Generator</Button>
                          <Button variant="contained" onClick={() => window.open(`https://${certificate.f5_device_hostname}/`, '_blank')}>Open F5 GUI</Button>
                        </Box>
                        
                        <Typography sx={{ mt: 3, fontStyle: 'italic', color: 'text.secondary' }}>After uploading the file, click below to continue.</Typography>
                        <Button onClick={handleRefreshF5Data} sx={{ mt: 1 }} disabled={loading} size="large">
                            {loading ? <CircularProgress size={24} /> : "I've Uploaded the File, Continue"}
                        </Button>
                    </Paper>
                );
            case 1:
                return (
                    <Paper variant="outlined" sx={{ p: 3 }}>
                        <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>Step 2: Select New Certificate</Typography>
                        <Autocomplete fullWidth options={f5Certs} value={selectedNewCert} onChange={(e, val) => setSelectedNewCert(val)} renderInput={(params) => <TextField {...params} label="Select the new certificate you uploaded" />} />
                        <Autocomplete fullWidth options={f5Chains} value={selectedChain} onChange={(e, val) => setSelectedChain(val)} renderInput={(params) => <TextField {...params} label="Confirm or select the certificate chain" sx={{ mt: 2 }} />} />
                    </Paper>
                );
            case 2:
                return (
                    <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderColor: 'success.main', borderWidth: 2 }}>
                        <CheckCircleIcon color="success" sx={{ fontSize: 60 }} />
                        <Typography variant="h4" sx={{ mt: 2, fontWeight: 'bold' }}>Update Complete!</Typography>
                        <Typography color="text.secondary">The SSL profiles have been successfully updated with the new certificate.</Typography>
                    </Paper>
                );
            default:
                return <Typography>Unknown step</Typography>;
        }
    }

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle sx={{ fontWeight: 'bold' }}>
                Renewal Wizard: {certificate.common_name}
            </DialogTitle>
            <DialogContent sx={{ backgroundColor: theme.palette.background.default, py: 3 }}>
                <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
                    {steps.map((label, index) => (
                        <Step key={label}>
                            <StepLabel StepIconComponent={StepIcon}>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>
                
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                
                {renderStepContent()}
            </DialogContent>
            
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose}>{activeStep === 2 ? "Finish" : "Cancel"}</Button>
                {activeStep === 1 && (
                    <Button variant="contained" onClick={handleUpdateProfiles} disabled={!selectedNewCert || loading}>
                        {loading ? <CircularProgress size={24} /> : "Confirm and Update Profiles"}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default RenewalWizardDialog;