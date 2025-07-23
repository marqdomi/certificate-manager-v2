// frontend/src/components/AddDeviceDialog.jsx
import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';

const AddDeviceDialog = ({ open, onClose, onAdd }) => {
  const [hostname, setHostname] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [site, setSite] = useState('');
  const [version, setVersion] = useState('');

  const handleAdd = () => {
    onAdd({ hostname, ip_address: ipAddress, site, version });
    // Limpiamos el formulario
    setHostname(''); setIpAddress(''); setSite(''); setVersion('');
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Add New F5 Device</DialogTitle>
      <DialogContent>
        <TextField autoFocus margin="dense" label="Hostname" fullWidth value={hostname} onChange={(e) => setHostname(e.target.value)} />
        <TextField margin="dense" label="IP Address" fullWidth value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} />
        <TextField margin="dense" label="Site (e.g., us,dc01)" fullWidth value={site} onChange={(e) => setSite(e.target.value)} />
        <TextField margin="dense" label="Version" fullWidth value={version} onChange={(e) => setVersion(e.target.value)} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleAdd}>Add Device</Button>
      </DialogActions>
    </Dialog>
  );
};
export default AddDeviceDialog;