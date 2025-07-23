// frontend/src/components/DeployFromFiles.jsx
import React, { useState } from 'react';
import { Box, Button, TextField, CircularProgress, Typography } from '@mui/material';

const DeployFromFiles = ({ onDeploy, isLoading }) => {
    const [certContent, setCertContent] = useState('');
    const [keyContent, setKeyContent] = useState('');

    return (
        <Box>
            <Typography variant="body1" sx={{ mb: 2 }}>Use this method if you have the certificate and private key as separate text files.</Typography>
            <TextField label="Signed Certificate Content (.crt)" multiline rows={8} fullWidth variant="outlined" value={certContent} onChange={(e) => setCertContent(e.target.value)} sx={{ mb: 2 }} placeholder="-----BEGIN CERTIFICATE----- ..."/>
            <TextField label="Private Key Content (.key)" multiline rows={8} fullWidth variant="outlined" value={keyContent} onChange={(e) => setKeyContent(e.target.value)} sx={{ mb: 2 }} placeholder="-----BEGIN PRIVATE KEY----- ..."/>
            <Button onClick={() => onDeploy(certContent, keyContent)} variant="contained" disabled={isLoading || !certContent || !keyContent} fullWidth size="large">
                {isLoading ? <CircularProgress size={24} /> : 'Deploy from Files'}
            </Button>
        </Box>
    );
};
export default DeployFromFiles;