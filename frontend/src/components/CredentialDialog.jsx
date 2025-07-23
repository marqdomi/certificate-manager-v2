// frontend/src/components/CredentialDialog.jsx
import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box } from '@mui/material';

const CredentialDialog = ({ open, onClose, onSave, device }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');

  // Cada vez que el modal se abre para un nuevo dispositivo, actualizamos el username
  useEffect(() => {
    if (device) {
      setUsername(device.username || 'admin');
      setPassword(''); // Limpiamos la contraseña por seguridad
    }
  }, [device]);

  const handleSave = () => {
    onSave({ username, password });
  };

  if (!open || !device) return null;

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Set Credentials for {device.hostname}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          id="username"
          label="Username"
          type="text"
          fullWidth
          variant="standard"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <TextField
          margin="dense"
          id="password"
          label="Password"
          type="password"
          fullWidth
          variant="standard"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};

export default CredentialDialog;