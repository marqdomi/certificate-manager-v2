// frontend/src/components/DeployPfxDialog.jsx
import React, { useState } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, Button, 
    TextField, Box, Typography, CircularProgress, Alert 
} from '@mui/material';

const DeployPfxDialog = ({ open, onClose, onDeploy, loading, certToRenew }) => {
  const [pfxFile, setPfxFile] = useState(null);
  const [pfxPassword, setPfxPassword] = useState('');
  const [error, setError] = useState('');

  const handleDeployClick = () => {
    if (!pfxFile) {
      setError('A PFX file is required.');
      return;
    }
    setError('');
    onDeploy(pfxFile, pfxPassword);
  };
  
  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Deploy New Certificate for: {certToRenew?.common_name}</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 3 }}>
          Upload the PFX file for the new certificate. This will replace the old certificate on the F5.
        </Alert>
        <Box sx={{ mb: 2 }}>
            <Button variant="contained" component="label" fullWidth>
                Upload PFX File
                <input type="file" hidden onChange={(e) => setPfxFile(e.target.files[0])} accept=".pfx" />
            </Button>
            {pfxFile && <Typography variant="caption" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>Selected: {pfxFile.name}</Typography>}
        </Box>
        <TextField
          label="PFX Password"
          type="password"
          fullWidth
          variant="outlined"
          value={pfxPassword}
          onChange={(e) => setPfxPassword(e.target.value)}
        />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button onClick={handleDeployClick} variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={24} /> : 'Deploy from PFX'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeployPfxDialog;