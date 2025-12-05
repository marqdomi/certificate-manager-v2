// frontend/src/components/AddDeviceDialog.jsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  InputAdornment,
  Stack,
  alpha,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Storage as DeviceIcon,
  Computer as HostnameIcon,
  Language as IpIcon,
  LocationOn as SiteIcon,
  Info as VersionIcon,
} from '@mui/icons-material';

const AddDeviceDialog = ({ open, onClose, onAdd }) => {
  const [hostname, setHostname] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [site, setSite] = useState('');
  const [version, setVersion] = useState('');
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    if (!hostname.trim()) newErrors.hostname = 'Hostname is required';
    if (!ipAddress.trim()) {
      newErrors.ipAddress = 'IP Address is required';
    } else if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ipAddress)) {
      newErrors.ipAddress = 'Invalid IP address format';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAdd = () => {
    if (!validateForm()) return;
    onAdd({ hostname: hostname.trim(), ip_address: ipAddress.trim(), site: site.trim(), version: version.trim() });
    // Clear form
    setHostname('');
    setIpAddress('');
    setSite('');
    setVersion('');
    setErrors({});
  };

  const handleClose = () => {
    setHostname('');
    setIpAddress('');
    setSite('');
    setVersion('');
    setErrors({});
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && hostname && ipAddress) {
      handleAdd();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          backgroundImage: 'none',
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: (theme) =>
            `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'primary.main',
              color: 'white',
            }}
          >
            <DeviceIcon />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={600}>
              Add New F5 Device
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Register a device manually in the inventory
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={handleClose} size="small" sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Content */}
      <DialogContent sx={{ pt: 4, pb: 2 }}>
        <Stack spacing={3}>
          <TextField
            autoFocus
            label="Hostname"
            placeholder="e.g., f5-lb-prod-01.company.com"
            fullWidth
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            onKeyDown={handleKeyDown}
            error={!!errors.hostname}
            helperText={errors.hostname}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <HostnameIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />

          <TextField
            label="IP Address"
            placeholder="e.g., 192.168.1.100"
            fullWidth
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
            onKeyDown={handleKeyDown}
            error={!!errors.ipAddress}
            helperText={errors.ipAddress}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <IpIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />

          <Divider>
            <Typography variant="caption" color="text.secondary">
              Optional
            </Typography>
          </Divider>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Site / Location"
              placeholder="e.g., us-east-1"
              fullWidth
              value={site}
              onChange={(e) => setSite(e.target.value)}
              onKeyDown={handleKeyDown}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SiteIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            />

            <TextField
              label="Version"
              placeholder="e.g., 16.1.3"
              fullWidth
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              onKeyDown={handleKeyDown}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <VersionIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            />
          </Box>
        </Stack>
      </DialogContent>

      {/* Actions */}
      <DialogActions
        sx={{
          px: 3,
          py: 2.5,
          borderTop: '1px solid',
          borderColor: 'divider',
          gap: 1.5,
        }}
      >
        <Button
          onClick={handleClose}
          variant="outlined"
          color="inherit"
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            px: 3,
            py: 1,
            minWidth: 100,
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleAdd}
          variant="contained"
          disabled={!hostname || !ipAddress}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            px: 3,
            py: 1,
            minWidth: 140,
            color: 'white',
            background: (theme) =>
              `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            '&:hover': {
              background: (theme) =>
                `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
            },
            '&.Mui-disabled': {
              color: 'rgba(255, 255, 255, 0.5)',
              background: (theme) => theme.palette.action.disabledBackground,
            },
          }}
        >
          Add Device
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddDeviceDialog;