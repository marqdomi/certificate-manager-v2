// frontend/src/components/RenewalDetailDialog.jsx

import React, { useState, useEffect } from 'react';
import apiClient from '../services/api';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, Button, 
    TextField, Box, Typography, CircularProgress, IconButton 
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const RenewalDetailDialog = ({ open, onClose, renewalId }) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Solo hacemos la llamada a la API si el diálogo está abierto y tenemos un ID
    if (open && renewalId) {
      setLoading(true);
      setError('');
      setDetails(null); // Limpiamos los detalles anteriores

      apiClient.get(`/certificates/renewals/${renewalId}/details`)
        .then(response => {
          setDetails(response.data);
        })
        .catch(err => {
          console.error("Error fetching renewal details:", err);
          setError(`Failed to load details: ${err.response?.data?.detail || 'Server error'}`);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, renewalId]); // Se ejecuta cada vez que el diálogo se abre con un nuevo ID

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        Renewal Details
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading && <Box sx={{ textAlign: 'center', p: 4 }}><CircularProgress /></Box>}
        
        {error && <Typography color="error" sx={{ p: 2 }}>{error}</Typography>}

        {!loading && !error && details && (
          <>
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>Certificate Signing Request (CSR)</Typography>
              <TextField multiline fullWidth rows={10} value={details.csr} InputProps={{ readOnly: true }} />
              <Button onClick={() => handleCopy(details.csr)} sx={{ mt: 1 }}>Copy CSR</Button>
            </Box>
            <Box sx={{ mt: 4 }}>
              <Typography variant="subtitle1" gutterBottom>Associated Private Key</Typography>
              <TextField multiline fullWidth rows={10} value={details.private_key} InputProps={{ readOnly: true }} />
              <Button onClick={() => handleCopy(details.private_key)} sx={{ mt: 1 }}>Copy Private Key</Button>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default RenewalDetailDialog;