// frontend/src/components/PfxGenerator.jsx

import React, { useState } from 'react';
import { Box, Typography, Button, TextField, CircularProgress, Alert, Divider, Paper, IconButton } from '@mui/material';
import apiClient from '../services/api';
import { X509Certificate } from '@peculiar/x509';

import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';

// Componente interno para la UX de subida de archivos (con el cambio para 'optional')
const FileUploadInput = ({ title, file, onFileChange, onFileClear, accept, required, optional }) => (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'action.hover',
        mb: 2,
      }}
    >
      {file ? (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
            <CheckCircleIcon color="success" sx={{ mr: 1.5, flexShrink: 0 }} />
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                {title} {required && '*'}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {file.name}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onFileClear} size="small"><CloseIcon /></IconButton>
        </>
      ) : (
        <>
            <Typography variant="body1" color="text.secondary">
                {title} {required && '*'}{/* ✅ CAMBIO: Mostramos la etiqueta 'optional' */} {optional && '(Optional)'}
            </Typography>
            <Button component="label" variant="contained" startIcon={<UploadFileIcon />}>
                Upload
                <input type="file" hidden onChange={onFileChange} accept={accept} />
            </Button>
        </>
      )}
    </Paper>
);


const PfxGenerator = () => {
    const [certFile, setCertFile] = useState(null);
    const [keyFile, setKeyFile] = useState(null);
    const [chainFile, setChainFile] = useState(null);
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [outputName, setOutputName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // ✅ CORRECCIÓN: Reintroducimos la lógica de manejo del formulario
    
    const handleCertFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setCertFile(file);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const certText = event.target.result;
                const parsedCert = new X509Certificate(certText);
                const cn = (parsedCert.subject.split(',').find(s => s.trim().startsWith('CN=')) || '=')
                           .split('=')[1]
                           .replace('*.', 'star_')
                           .replace(/\./g, '_');
                const expDate = parsedCert.notAfter.toISOString().split('T')[0];
                setOutputName(`${cn}_${expDate}`);
            } catch (err) {
                console.error("Failed to parse certificate:", err);
                setError("Could not read certificate data. Is it a valid PEM file?");
                setOutputName('');
            }
        };
        reader.readAsText(file);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        if (!certFile || !keyFile) {
            setError('Certificate and Private Key files are required.');
            setLoading(false);
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            setLoading(false);
            return;
        }
        if (!outputName) {
            setError('Output file name is required.');
            setLoading(false);
            return;
        }
        
        const formData = new FormData();
        formData.append('certificate', certFile);
        formData.append('private_key', keyFile);
        if (chainFile) {
          formData.append('chain', chainFile);
        }
        if (password) {
          formData.append('password', password);
        }
        formData.append('output_name', outputName);

        try {
            const response = await apiClient.post('/pfx/generate', formData, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${outputName}.pfx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            setSuccess(`Successfully generated and downloaded ${outputName}.pfx`);
        } catch (err) {
            if (err.response && err.response.data) {
                const errorBlob = err.response.data;
                errorBlob.text().then(text => {
                    try {
                        const errorJson = JSON.parse(text);
                        setError(errorJson.detail || 'An unknown error occurred.');
                    } catch (jsonError) {
                        setError('Failed to parse error response from server.');
                    }
                });
            } else {
                setError('An unexpected network error occurred.');
            }
            console.error(err);
        } finally {
            setLoading(false);
        }
    };
    // --- (Fin de la lógica reintroducida) ---

    return (
        <Box component="form" onSubmit={handleSubmit} noValidate>
            
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>1. Upload Required Files</Typography>
            <Divider sx={{ my: 2 }} />
            
            <FileUploadInput title="Certificate" file={certFile} onFileChange={handleCertFileChange} onFileClear={() => setCertFile(null)} accept=".crt,.cer,.pem" required />
            <FileUploadInput title="Private Key" file={keyFile} onFileChange={(e) => setKeyFile(e.target.files[0])} onFileClear={() => setKeyFile(null)} accept=".key" required />
            {/* ✅ CAMBIO: Añadimos la prop 'optional' a nuestro componente */}
            <FileUploadInput title="Chain File" file={chainFile} onFileChange={(e) => setChainFile(e.target.files[0])} onFileClear={() => setChainFile(null)} optional />
            
            <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 4 }}>2. Configure Output</Typography>
            <Divider sx={{ my: 2 }} />

            <TextField fullWidth required label="Output PFX File Name (without .pfx)" value={outputName} onChange={(e) => setOutputName(e.target.value)} margin="normal" />
            <TextField fullWidth type="password" label="PFX Password (recommended)" value={password} onChange={(e) => setPassword(e.target.value)} margin="normal" />
            <TextField fullWidth type="password" label="Confirm PFX Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} margin="normal" error={password !== confirmPassword && confirmPassword !== ''} helperText={password !== confirmPassword && confirmPassword !== '' ? "Passwords do not match" : ""} />

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}

            <Button 
                type="submit" 
                variant="contained" 
                color="primary" 
                disabled={loading || !certFile || !keyFile || !outputName} 
                fullWidth 
                size="large"
                sx={{ mt: 3, py: 1.5 }}
            >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Generate PFX'}
            </Button>
        </Box>
    );
};

export default PfxGenerator;