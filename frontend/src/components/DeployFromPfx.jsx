// frontend/src/components/DeployFromPfx.jsx
import React, { useState } from 'react';
import { Box, Button, TextField, CircularProgress, Typography, Alert } from '@mui/material';

// Recibe la función 'onDeploy' y el estado 'isLoading' de su padre
const DeployFromPfx = ({ onDeploy, isLoading }) => {
    const [pfxFile, setPfxFile] = useState(null);
    const [pfxPassword, setPfxPassword] = useState('');
    const [error, setError] = useState('');

    const handleDeployClick = () => {
        if (!pfxFile) {
            setError('A PFX file is required.');
            return;
        }
        setError('');
        // No hace la llamada a la API. Solo pasa los datos al padre.
        onDeploy({ pfxFile, pfxPassword });
    };

    return (
        <Box>
            <Typography variant="body1" sx={{ mb: 2 }}>
                This is the recommended method. Upload the PFX file you generated or received.
            </Typography>
            <Box sx={{ mb: 2 }}>
                <Button variant="outlined" component="label" fullWidth>
                    Upload PFX File (.pfx)
                    <input type="file" hidden onChange={(e) => setPfxFile(e.target.files[0])} accept=".pfx" />
                </Button>
                {pfxFile && <Typography variant="caption" sx={{ display: 'block', mt: 1, fontStyle: 'italic', color: 'text.secondary' }}>Selected: {pfxFile.name}</Typography>}
            </Box>
            <TextField
                label="PFX Password"
                type="password"
                fullWidth
                variant="outlined"
                value={pfxPassword}
                onChange={(e) => setPfxPassword(e.target.value)}
                sx={{ mb: 2 }}
            />
            {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
            <Button onClick={handleDeployClick} variant="contained" disabled={isLoading} fullWidth size="large">
                {isLoading ? <CircularProgress size={24} /> : 'Deploy from PFX'}
            </Button>
        </Box>
    );
};

export default DeployFromPfx;