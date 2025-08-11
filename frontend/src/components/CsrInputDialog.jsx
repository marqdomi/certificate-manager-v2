import React, { useState, useCallback } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Alert, CircularProgress } from '@mui/material';

const CsrInputDialog = ({ open, onClose, onGenerate, cert, loading }) => {
  const [privateKeyInput, setPrivateKeyInput] = useState('');

  const handleClose = useCallback(() => {
    setPrivateKeyInput('');
    if (onClose) onClose();
  }, [onClose]);

  const handleGenerateClick = () => {
    // Solo llama a onGenerate si el campo no está vacío
    if (privateKeyInput.trim()) {
      onGenerate(cert, privateKeyInput);
    }
  };
  
  if (!cert) return null;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle>Initiate Renewal for: {cert.common_name}</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          To generate a new CSR, please export the existing private key from the F5 GUI and paste its full content below.
        </Alert>
        <TextField
          label="Private Key Content (Required)" // <-- Cambiamos el texto
          multiline fullWidth rows={10} value={privateKeyInput}
          onChange={(e) => setPrivateKeyInput(e.target.value)}
          placeholder="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----"
          required // <-- Lo hacemos requerido en el formulario
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button 
          onClick={handleGenerateClick} 
          variant="contained" 
          // El botón se deshabilita si no hay texto o si está cargando
          disabled={!privateKeyInput.trim() || loading}
        >
          {loading ? <CircularProgress size={24} /> : 'Generate CSR'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
export default CsrInputDialog;