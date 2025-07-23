// frontend/src/components/InitiateRenewalDialog.jsx
import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, Box, CircularProgress } from '@mui/material';

const InitiateRenewalDialog = ({ open, onClose, onInitiate, loading, cert }) => {
  const [privateKey, setPrivateKey] = useState('');

  const handleInitiate = () => {
    if (privateKey) {
      onInitiate(privateKey);
    }
  };

  if (!cert) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Initiate Renewal for: {cert.common_name}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" gutterBottom>
          To start the renewal, please export the private key for this certificate from the F5 GUI and paste its full content below.
        </Typography>
        <TextField
          label="Private Key Content"
          multiline
          fullWidth
          rows={15}
          value={privateKey}
          onChange={(e) => setPrivateKey(e.target.value)}
          margin="normal"
          placeholder="-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button onClick={handleInitiate} variant="contained" disabled={!privateKey || loading}>
          {loading ? <CircularProgress size={24} /> : 'Generate CSR'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InitiateRenewalDialog;