// frontend/src/components/DeployDialog.jsx
import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, CircularProgress, Typography } from '@mui/material';

const DeployDialog = ({ open, onClose, onDeploy, loading }) => {
  const [certContent, setCertContent] = useState('');

  useEffect(() => {
    if (!open) setCertContent('');
  }, [open]);

  const handleDeploy = () => {
    if (certContent) {
      onDeploy(certContent);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Deploy Signed Certificate</DialogTitle>
      <DialogContent>
        <Typography variant="body2" gutterBottom>
          Paste the full content of the signed certificate (.crt) you received from your CA below.
        </Typography>
        <TextField
          label="Signed Certificate Content"
          multiline
          fullWidth
          rows={15}
          value={certContent}
          onChange={(e) => setCertContent(e.target.value)}
          margin="normal"
          autoComplete="off"
          spellCheck={false}
          placeholder={`-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----`}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button onClick={handleDeploy} variant="contained" disabled={!certContent || loading}>
          {loading ? <CircularProgress size={24} /> : 'Deploy'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeployDialog;