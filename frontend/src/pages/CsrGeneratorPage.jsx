// frontend/src/pages/CsrGeneratorPage.jsx

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
    Box, Typography, Paper, Alert, TextField, Button, 
    CircularProgress, Snackbar 
} from '@mui/material';
import apiClient from '../services/api';

// Importamos el diálogo para mostrar el resultado
import CsrResultDialog from '../components/CsrResultDialog';

function CsrGeneratorPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const certificateToRenew = location.state?.certificateToRenew;
    
    // Estados locales de esta página
    const [privateKey, setPrivateKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const [resultData, setResultData] = useState(null);
    const [resultDialogOpen, setResultDialogOpen] = useState(false);
    const [notification, setNotification] = useState({ open: false, message: ''});


    // Si alguien llega a esta página sin un certificado seleccionado, le mostramos un error
    if (!certificateToRenew) {
        return (
            <Alert severity="error">
                No certificate selected for renewal. Please go back to the 
                <Button component="a" href="/certificates">Inventory</Button> 
                and start the process again.
            </Alert>
        );
    }

    const handleGenerateCsr = () => {
        if (!privateKey.trim()) {
            setError('Private key content is required.');
            return;
        }
        setError('');
        setLoading(true);

        const payload = { private_key_content: privateKey };

        apiClient.post(`/certificates/${certificateToRenew.id}/initiate-renewal`, payload)
            .then(res => {
                setResultData(res.data);
                setResultDialogOpen(true); // Abrimos el diálogo con el CSR
            })
            .catch(err => {
                setNotification({ open: true, message: `Error: ${err.response?.data?.detail || 'An unknown error occurred.'}`});
            })
            .finally(() => setLoading(false));
    };

    const handleCloseResultDialog = () => {
        setResultDialogOpen(false);
        // Después de ver el CSR, lo mandamos de vuelta al inventario
        navigate('/certificates'); 
    };

    return (
        <Box>
            <Typography variant="h4" component="h1" gutterBottom>
                CSR Generator
            </Typography>

            <Alert severity="info" sx={{ mb: 4 }}>
                <Typography>
                    Initiating renewal for: <strong>{certificateToRenew.common_name}</strong>
                </Typography>
                <Typography variant="caption">
                    (This will create a new renewal request or update an existing one)
                </Typography>
            </Alert>

            {notification.open && <Alert severity="error" sx={{ mb: 2 }}>{notification.message}</Alert>}

            <Paper elevation={3} sx={{ p: 3, maxWidth: '900px' }}>
                <Typography variant="h6" gutterBottom>1. Provide Existing Private Key</Typography>
                <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                    To generate a CSR, you must provide the private key that corresponds to the certificate you are renewing. 
                    Please export the key from the F5 GUI and paste its full content below.
                </Typography>
                <TextField 
                    label="Private Key Content (Required)" 
                    multiline 
                    rows={15} 
                    fullWidth 
                    value={privateKey} 
                    onChange={e => setPrivateKey(e.target.value)} 
                    required 
                    error={!!error} 
                    helperText={error}
                    placeholder="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----"
                />
                <Button 
                    onClick={handleGenerateCsr} 
                    variant="contained" 
                    sx={{ mt: 2 }} 
                    disabled={loading} 
                    fullWidth 
                    size="large"
                >
                    {loading ? <CircularProgress size={24} /> : "Generate & Save CSR"}
                </Button>
            </Paper>

            <CsrResultDialog 
                open={resultDialogOpen} 
                onClose={handleCloseResultDialog} 
                data={resultData} 
            />
        </Box>
    );
}

export default CsrGeneratorPage;