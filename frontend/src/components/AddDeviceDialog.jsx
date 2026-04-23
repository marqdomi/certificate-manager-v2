// frontend/src/components/AddDeviceDialog.jsx
import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField, 
  Grid, 
  Typography, 
  Box,
  Alert,
  Chip,
  IconButton,
  InputAdornment,
  Fade,
  Paper,
  useTheme
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RouterIcon from '@mui/icons-material/Router';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';

const AddDeviceDialog = ({ open, onClose, onAdd }) => {
  const theme = useTheme();
  const [formData, setFormData] = useState({
    hostname: '',
    ip_address: '',
    site: '',
    version: '',
    cluster_key: '',
    is_primary_preferred: false
  });
  
  const [errors, setErrors] = useState({});
  const [isValidating, setIsValidating] = useState(false);

  // Limpiar formulario cuando se cierra el modal
  useEffect(() => {
    if (!open) {
      setFormData({
        hostname: '',
        ip_address: '',
        site: '',
        version: '',
        cluster_key: '',
        is_primary_preferred: false
      });
      setErrors({});
    }
  }, [open]);

  // Validación en tiempo real
  const validateField = (name, value) => {
    const newErrors = { ...errors };
    
    switch (name) {
      case 'hostname':
        if (!value.trim()) {
          newErrors.hostname = 'Hostname is required';
        } else if (!/^[a-zA-Z0-9.-]+$/.test(value)) {
          newErrors.hostname = 'Invalid hostname format';
        } else {
          delete newErrors.hostname;
        }
        break;
      
      case 'ip_address':
        if (!value.trim()) {
          newErrors.ip_address = 'IP Address is required';
        } else if (!/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(value)) {
          newErrors.ip_address = 'Invalid IP address format';
        } else {
          delete newErrors.ip_address;
        }
        break;
      
      case 'site':
        if (value && !/^[a-zA-Z0-9,.-]+$/.test(value)) {
          newErrors.site = 'Invalid site format';
        } else {
          delete newErrors.site;
        }
        break;
        
      default:
        break;
    }
    
    setErrors(newErrors);
  };

  const handleInputChange = (field) => (event) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    validateField(field, value);
  };

  const handleAdd = async () => {
    // Validación final
    const requiredFields = ['hostname', 'ip_address'];
    const finalErrors = {};
    
    requiredFields.forEach(field => {
      if (!formData[field].trim()) {
        finalErrors[field] = `${field.replace('_', ' ')} is required`;
      }
    });
    
    if (Object.keys(finalErrors).length > 0) {
      setErrors(finalErrors);
      return;
    }

    setIsValidating(true);
    
    try {
      await onAdd(formData);
      // El formulario se limpiará automáticamente cuando se cierre el modal
    } catch (error) {
      console.error('Error adding device:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const isFormValid = !Object.keys(errors).length && 
                     formData.hostname.trim() && 
                     formData.ip_address.trim();

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '20px',
          backdropFilter: 'blur(20px)',
          backgroundColor: theme.palette.mode === 'dark' 
            ? 'rgba(18, 24, 38, 0.9)' 
            : 'rgba(255, 255, 255, 0.9)',
          border: '1px solid',
          borderColor: theme.palette.mode === 'dark' 
            ? 'rgba(255, 255, 255, 0.1)' 
            : 'rgba(0, 0, 0, 0.1)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.2)',
        }
      }}
      TransitionComponent={Fade}
      TransitionProps={{ timeout: 300 }}
    >
      {/* Header con gradiente */}
      <DialogTitle sx={{ 
        p: 0,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        borderRadius: '20px 20px 0 0',
      }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          p: 3
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <RouterIcon sx={{ fontSize: 28 }} />
            <Box>
              <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
                Add New F5 Device
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                Configure a new F5 BIG-IP device for certificate management
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={onClose}
            sx={{ 
              color: 'white',
              '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {/* Información de ayuda */}
          <Grid item xs={12}>
            <Paper sx={{ 
              p: 2, 
              bgcolor: 'info.main', 
              color: 'info.contrastText',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}>
              <InfoIcon />
              <Typography variant="body2">
                <strong>Tip:</strong> Ensure the F5 device is reachable and has management interface configured.
              </Typography>
            </Paper>
          </Grid>

          {/* Campos requeridos */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon color="primary" />
              Required Information
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              autoFocus
              label="Hostname"
              fullWidth
              value={formData.hostname}
              onChange={handleInputChange('hostname')}
              error={!!errors.hostname}
              helperText={errors.hostname || 'FQDN or hostname of the F5 device'}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <RouterIcon color="primary" />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                }
              }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label="IP Address"
              fullWidth
              value={formData.ip_address}
              onChange={handleInputChange('ip_address')}
              error={!!errors.ip_address}
              helperText={errors.ip_address || 'Management IP address'}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <NetworkCheckIcon color="primary" />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                }
              }}
            />
          </Grid>

          {/* Campos opcionales */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2, mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocationOnIcon color="secondary" />
              Optional Information
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label="Site / Location"
              fullWidth
              value={formData.site}
              onChange={handleInputChange('site')}
              error={!!errors.site}
              helperText={errors.site || 'e.g., us,dc01, europe,lon01'}
              placeholder="us,dc01"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                }
              }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label="Version"
              fullWidth
              value={formData.version}
              onChange={handleInputChange('version')}
              helperText="F5 TMOS version (will be auto-detected)"
              placeholder="16.1.4"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                }
              }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label="Cluster Key"
              fullWidth
              value={formData.cluster_key}
              onChange={handleInputChange('cluster_key')}
              helperText="Cluster identifier (will be auto-assigned)"
              placeholder="us-dc01-lb-001"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                }
              }}
            />
          </Grid>

          {/* Estado del formulario */}
          {Object.keys(errors).length > 0 && (
            <Grid item xs={12}>
              <Alert severity="error" sx={{ borderRadius: '12px' }}>
                Please fix the validation errors above
              </Alert>
            </Grid>
          )}
        </Grid>
      </DialogContent>

      <DialogActions sx={{ 
        p: 3, 
        gap: 2,
        borderTop: '1px solid',
        borderColor: 'divider'
      }}>
        <Button 
          onClick={onClose}
          variant="outlined"
          sx={{ 
            borderRadius: '12px',
            px: 3,
            py: 1,
            textTransform: 'none',
            fontWeight: 500
          }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleAdd}
          variant="contained"
          disabled={!isFormValid || isValidating}
          sx={{ 
            borderRadius: '12px',
            px: 3,
            py: 1,
            textTransform: 'none',
            fontWeight: 600,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)',
            }
          }}
        >
          {isValidating ? 'Adding Device...' : 'Add Device'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddDeviceDialog;