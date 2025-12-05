// frontend/src/components/BulkCredentialsDialog.jsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Box,
  Typography,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from '@mui/material';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DevicesIcon from '@mui/icons-material/Devices';

const BulkCredentialsDialog = ({ open, onClose, devices, onSave }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    const credentials = { username, password };
    const successResults = [];
    const failedResults = [];

    for (const device of devices) {
      try {
        await onSave(device.id, credentials);
        successResults.push({ device, success: true });
      } catch (err) {
        failedResults.push({ device, success: false, error: err.message });
      }
    }

    setResults({
      success: successResults,
      failed: failedResults,
      total: devices.length,
    });
    setLoading(false);
  };

  const handleClose = () => {
    setUsername('admin');
    setPassword('');
    setResults(null);
    setError(null);
    onClose();
  };

  const allSuccessful = results && results.failed.length === 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <VpnKeyIcon color="primary" />
        Bulk Set Credentials
      </DialogTitle>
      <DialogContent>
        {!results ? (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              This will set the same credentials for <strong>{devices.length}</strong> selected devices.
            </Alert>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {/* Selected Devices Summary */}
            <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <DevicesIcon fontSize="small" />
                Selected Devices ({devices.length})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {devices.slice(0, 5).map((device) => (
                  <Chip 
                    key={device.id} 
                    label={device.hostname} 
                    size="small" 
                    variant="outlined"
                  />
                ))}
                {devices.length > 5 && (
                  <Chip 
                    label={`+${devices.length - 5} more`} 
                    size="small" 
                    color="primary"
                  />
                )}
              </Box>
            </Box>

            <TextField
              autoFocus
              margin="dense"
              label="Username"
              type="text"
              fullWidth
              variant="outlined"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              sx={{ mb: 2 }}
            />

            <TextField
              margin="dense"
              label="Password"
              type="password"
              fullWidth
              variant="outlined"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              helperText="Enter the common password for all selected devices"
            />
          </>
        ) : (
          <>
            {/* Results View */}
            <Alert severity={allSuccessful ? 'success' : 'warning'} sx={{ mb: 2 }}>
              {allSuccessful
                ? `Successfully updated credentials for all ${results.total} devices!`
                : `Updated ${results.success.length} of ${results.total} devices. ${results.failed.length} failed.`}
            </Alert>

            {results.failed.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="error" sx={{ mb: 1 }}>
                  Failed Devices:
                </Typography>
                <List dense>
                  {results.failed.map(({ device, error }) => (
                    <ListItem key={device.id}>
                      <ListItemIcon>
                        <ErrorIcon color="error" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={device.hostname}
                        secondary={error || 'Unknown error'}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {results.success.length > 0 && (
              <Box>
                <Typography variant="subtitle2" color="success.main" sx={{ mb: 1 }}>
                  Successful Devices ({results.success.length}):
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {results.success.slice(0, 10).map(({ device }) => (
                    <Chip
                      key={device.id}
                      label={device.hostname}
                      size="small"
                      color="success"
                      variant="outlined"
                      icon={<CheckCircleIcon />}
                    />
                  ))}
                  {results.success.length > 10 && (
                    <Chip 
                      label={`+${results.success.length - 10} more`} 
                      size="small" 
                      color="success"
                    />
                  )}
                </Box>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {!results ? (
          <>
            <Button onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={loading || !password}
              startIcon={loading ? <CircularProgress size={18} /> : <VpnKeyIcon />}
            >
              {loading ? `Updating ${devices.length} devices...` : 'Set Credentials'}
            </Button>
          </>
        ) : (
          <Button onClick={handleClose} variant="contained">
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BulkCredentialsDialog;
