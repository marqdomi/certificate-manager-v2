import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField, 
  Box, 
  Typography,
  Grid,
  Alert,
  Paper,
  IconButton,
  InputAdornment,
  Fade,
  Chip,
  useTheme,
  Divider
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SecurityIcon from '@mui/icons-material/Security';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DevicesIcon from '@mui/icons-material/Devices';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const CredentialDialog = ({ open, onClose, onSave, device }) => {
  const theme = useTheme();
  const [formData, setFormData] = useState({
    username: 'admin',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Cada vez que el modal se abre para un nuevo dispositivo, actualizamos los datos
  useEffect(() => {
    if (device && open) {
      setFormData({
        username: device.username || 'admin',
        password: ''
      });
      setErrors({});
      setShowPassword(false);
    }
  }, [device, open]);

  // Validación en tiempo real
  const validateField = (name, value) => {
    const newErrors = { ...errors };
    
    switch (name) {
      case 'username':
        if (!value.trim()) {
          newErrors.username = 'Username is required';
        } else if (value.length < 3) {
          newErrors.username = 'Username must be at least 3 characters';
        } else {
          delete newErrors.username;
        }
        break;
      
      case 'password':
        if (!value) {
          newErrors.password = 'Password is required';
        } else if (value.length < 6) {
          newErrors.password = 'Password must be at least 6 characters';
        } else {
          delete newErrors.password;
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

  const handleSave = async () => {
    // Validación final
    const finalErrors = {};
    
    if (!formData.username.trim()) {
      finalErrors.username = 'Username is required';
    }
    if (!formData.password) {
      finalErrors.password = 'Password is required';
    }
    
    if (Object.keys(finalErrors).length > 0) {
      setErrors(finalErrors);
      return;
    }

    setIsSaving(true);
    
    try {
      await onSave(formData);
    } catch (error) {
      console.error('Error saving credentials:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && isFormValid && !isSaving) {
      handleSave();
    }
  };

  const isFormValid = !Object.keys(errors).length && 
                     formData.username.trim() && 
                     formData.password;

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  if (!open || !device) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
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
            <SecurityIcon sx={{ fontSize: 28 }} />
            <Box>
              <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
                Device Credentials
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                Configure authentication for F5 device access
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
          {/* Información del dispositivo */}
          <Grid item xs={12}>
            <Paper sx={{ 
              p: 2, 
              bgcolor: 'primary.main', 
              color: 'primary.contrastText',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: 2
            }}>
              <DevicesIcon />
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {device.hostname}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {device.ip_address} • {device.site || 'No site specified'}
                </Typography>
              </Box>
              <Box sx={{ ml: 'auto' }}>
                <Chip 
                  label={device.ha_state || 'Unknown'} 
                  size="small"
                  sx={{ 
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    fontWeight: 600
                  }}
                />
              </Box>
            </Paper>
          </Grid>

          {/* Información de seguridad */}
          <Grid item xs={12}>
            <Alert 
              severity="info" 
              icon={<InfoIcon />}
              sx={{ borderRadius: '12px' }}
            >
              <Typography variant="body2">
                <strong>Security Note:</strong> Credentials are encrypted and stored securely. 
                Only authorized users can view or modify device credentials.
              </Typography>
            </Alert>
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Authentication Details
              </Typography>
            </Divider>
          </Grid>

          {/* Campo de usuario */}
          <Grid item xs={12}>
            <TextField
              autoFocus
              label="Username"
              fullWidth
              value={formData.username}
              onChange={handleInputChange('username')}
              onKeyDown={handleKeyDown}
              error={!!errors.username}
              helperText={errors.username || 'F5 device administrative username'}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon color="primary" />
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

          {/* Campo de contraseña */}
          <Grid item xs={12}>
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              value={formData.password}
              onChange={handleInputChange('password')}
              onKeyDown={handleKeyDown}
              error={!!errors.password}
              helperText={errors.password || 'Administrative password for device access'}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="primary" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={togglePasswordVisibility}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
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

          {/* Estado del formulario */}
          {Object.keys(errors).length > 0 && (
            <Grid item xs={12}>
              <Alert severity="error" sx={{ borderRadius: '12px' }}>
                Please fix the validation errors above
              </Alert>
            </Grid>
          )}

          {/* Confirmación de formulario válido */}
          {isFormValid && (
            <Grid item xs={12}>
              <Alert 
                severity="success" 
                icon={<CheckCircleIcon />}
                sx={{ borderRadius: '12px' }}
              >
                Credentials are ready to be saved
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
          onClick={handleSave}
          variant="contained"
          disabled={!isFormValid || isSaving}
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
          {isSaving ? 'Saving...' : 'Save Credentials'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CredentialDialog;