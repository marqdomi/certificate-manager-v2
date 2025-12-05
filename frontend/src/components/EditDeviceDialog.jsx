// frontend/src/components/EditDeviceDialog.jsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Box,
  Alert,
  CircularProgress,
  Typography,
  Divider,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';

const EditDeviceDialog = ({ open, onClose, device, onSave }) => {
  const [formData, setFormData] = useState({
    hostname: '',
    ip_address: '',
    site: '',
    cluster_key: '',
    is_primary_preferred: false,
    active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cargar datos del device cuando se abre el dialog
  useEffect(() => {
    if (device && open) {
      setFormData({
        hostname: device.hostname || '',
        ip_address: device.ip_address || '',
        site: device.site || '',
        cluster_key: device.cluster_key || '',
        is_primary_preferred: device.is_primary_preferred || false,
        active: device.active !== false, // default true
      });
      setError(null);
    }
  }, [device, open]);

  const handleChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v1/devices/${device.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update device');
      }

      const updatedDevice = await response.json();
      onSave(updatedDevice);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = () => {
    if (!device) return false;
    return (
      formData.hostname !== (device.hostname || '') ||
      formData.ip_address !== (device.ip_address || '') ||
      formData.site !== (device.site || '') ||
      formData.cluster_key !== (device.cluster_key || '') ||
      formData.is_primary_preferred !== (device.is_primary_preferred || false) ||
      formData.active !== (device.active !== false)
    );
  };

  if (!device) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EditIcon color="primary" />
        Edit Device
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
          Device ID: {device.id}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Basic Info */}
          <TextField
            label="Hostname"
            value={formData.hostname}
            onChange={handleChange('hostname')}
            fullWidth
            required
            helperText="FQDN of the F5 device"
          />

          <TextField
            label="IP Address"
            value={formData.ip_address}
            onChange={handleChange('ip_address')}
            fullWidth
            required
            helperText="Management IP address"
          />

          <TextField
            label="Site"
            value={formData.site}
            onChange={handleChange('site')}
            fullWidth
            placeholder="e.g., us-dc01, eu-west"
            helperText="Data center or location identifier"
          />

          <Divider sx={{ my: 1 }} />

          {/* Cluster Info */}
          <Typography variant="subtitle2" color="text.secondary">
            Cluster Configuration
          </Typography>

          <TextField
            label="Cluster Key"
            value={formData.cluster_key}
            onChange={handleChange('cluster_key')}
            fullWidth
            placeholder="e.g., usdc02-fab1-lb-001"
            helperText="Unique identifier for the HA cluster pair"
          />

          <FormControlLabel
            control={
              <Switch
                checked={formData.is_primary_preferred}
                onChange={handleChange('is_primary_preferred')}
                color="warning"
              />
            }
            label={
              <Box>
                <Typography variant="body2">Preferred Primary</Typography>
                <Typography variant="caption" color="text.secondary">
                  Mark this device as the preferred primary for its cluster
                </Typography>
              </Box>
            }
          />

          <Divider sx={{ my: 1 }} />

          {/* Status */}
          <FormControlLabel
            control={
              <Switch
                checked={formData.active}
                onChange={handleChange('active')}
                color="success"
              />
            }
            label={
              <Box>
                <Typography variant="body2">Active</Typography>
                <Typography variant="caption" color="text.secondary">
                  Inactive devices are excluded from scans and deployments
                </Typography>
              </Box>
            }
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !hasChanges()}
          startIcon={loading ? <CircularProgress size={18} /> : null}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditDeviceDialog;
