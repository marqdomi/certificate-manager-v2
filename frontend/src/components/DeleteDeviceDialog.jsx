// frontend/src/components/DeleteDeviceDialog.jsx
import React from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  Typography,
  Box,
  Alert,
  Paper,
  IconButton,
  Fade,
  Chip,
  useTheme,
  Divider,
  Grid
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WarningIcon from '@mui/icons-material/Warning';
import DeleteIcon from '@mui/icons-material/Delete';
import DevicesIcon from '@mui/icons-material/Devices';
import SecurityIcon from '@mui/icons-material/Security';
import InfoIcon from '@mui/icons-material/Info';

const DeleteDeviceDialog = ({ open, onClose, onConfirm, device, isDeleting = false }) => {
  const theme = useTheme();

  if (!device) return null;

  const handleConfirm = () => {
    onConfirm(device);
  };

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
      {/* Header con gradiente de advertencia */}
      <DialogTitle sx={{ 
        p: 0,
        background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
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
            <WarningIcon sx={{ fontSize: 28 }} />
            <Box>
              <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
                Delete Device
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                This action cannot be undone
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={onClose}
            disabled={isDeleting}
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
          {/* Alerta principal */}
          <Grid item xs={12}>
            <Alert 
              severity="error" 
              icon={<WarningIcon />}
              sx={{ 
                borderRadius: '12px',
                bgcolor: 'error.main',
                color: 'error.contrastText',
                '& .MuiAlert-icon': {
                  color: 'error.contrastText'
                }
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Warning: Permanent Deletion
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                You are about to permanently delete this device and all its associated data.
              </Typography>
            </Alert>
          </Grid>

          {/* Información del dispositivo */}
          <Grid item xs={12}>
            <Paper sx={{ 
              p: 3, 
              borderRadius: '12px',
              border: '2px solid',
              borderColor: 'error.main',
              bgcolor: theme.palette.mode === 'dark' 
                ? 'rgba(211, 47, 47, 0.1)' 
                : 'rgba(211, 47, 47, 0.05)'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <DevicesIcon color="error" sx={{ fontSize: 24 }} />
                <Typography variant="h6" color="error.main" sx={{ fontWeight: 600 }}>
                  Device to be deleted:
                </Typography>
              </Box>
              
              <Box sx={{ ml: 4 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  {device.hostname}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  IP Address: {device.ip_address}
                </Typography>
                {device.site && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Site: {device.site}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Chip 
                    label={device.ha_state || 'Unknown'} 
                    size="small"
                    color={device.ha_state === 'ACTIVE' ? 'success' : 'default'}
                    sx={{ fontSize: '0.75rem' }}
                  />
                  {device.version && (
                    <Chip 
                      label={`v${device.version}`} 
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.75rem' }}
                    />
                  )}
                </Box>
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 1 }}>
              <Typography variant="body2" color="text.secondary">
                What will be deleted
              </Typography>
            </Divider>
          </Grid>

          {/* Lista de elementos a eliminar */}
          <Grid item xs={12}>
            <Box sx={{ pl: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <DevicesIcon color="error" />
                <Typography variant="body1">
                  <strong>Device configuration and settings</strong>
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <SecurityIcon color="error" />
                <Typography variant="body1">
                  <strong>All associated SSL certificates</strong>
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <InfoIcon color="error" />
                <Typography variant="body1">
                  <strong>Device scan history and facts</strong>
                </Typography>
              </Box>
            </Box>
          </Grid>

          {/* Confirmación final */}
          <Grid item xs={12}>
            <Alert 
              severity="warning" 
              sx={{ borderRadius: '12px' }}
            >
              <Typography variant="body2">
                <strong>Please confirm:</strong> This action will permanently remove all data 
                related to <strong>{device.hostname}</strong> from the system. This cannot be undone.
              </Typography>
            </Alert>
          </Grid>
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
          disabled={isDeleting}
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
          onClick={handleConfirm}
          variant="contained"
          color="error"
          disabled={isDeleting}
          startIcon={isDeleting ? null : <DeleteIcon />}
          sx={{ 
            borderRadius: '12px',
            px: 3,
            py: 1,
            textTransform: 'none',
            fontWeight: 600,
            background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #ff5252 0%, #e53e3e 100%)',
            }
          }}
        >
          {isDeleting ? 'Deleting Device...' : 'Delete Device'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteDeviceDialog;