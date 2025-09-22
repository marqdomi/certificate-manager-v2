// frontend/src/pages/admin/SystemConfiguration.jsx

import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Alert,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
  Settings as SettingsIcon,
  Email as EmailIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { adminService } from '../../services/admin';
import { useAuth } from '../../context/AuthContext';

const SystemConfiguration = () => {
  const { hasPermission } = useAuth();
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null
  });

  // Track which sections have been modified
  const [modifiedSections, setModifiedSections] = useState(new Set());

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminService.getSystemConfig();
      setConfig(response.data || {});
      setModifiedSections(new Set()); // Clear modifications when loading fresh data
    } catch (err) {
      console.error('Error loading configuration:', err);
      setError('Failed to load system configuration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (section, key, value) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
    
    // Track that this section has been modified
    setModifiedSections(prev => new Set([...prev, section]));
    
    // Clear any existing success/error messages
    setError(null);
    setSuccess(null);
  };

  const handleSaveConfiguration = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      await adminService.updateSystemConfig(config);
      setSuccess('System configuration saved successfully');
      setModifiedSections(new Set()); // Clear modifications after successful save
    } catch (err) {
      console.error('Error saving configuration:', err);
      setError('Failed to save system configuration. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmSave = () => {
    setConfirmDialog({
      open: true,
      title: 'Save Configuration Changes',
      message: 'Are you sure you want to save these configuration changes? Some changes may require a system restart to take effect.',
      onConfirm: () => {
        setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
        handleSaveConfiguration();
      }
    });
  };

  const hasModifications = () => modifiedSections.size > 0;

  if (!hasPermission('admin_write')) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          You don't have permission to access system configuration.
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
          <CircularProgress />
          <Typography variant="h6" sx={{ ml: 2 }}>
            Loading configuration...
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          System Configuration
        </Typography>
        <Box display="flex" gap={2}>
          <Tooltip title="Refresh">
            <IconButton onClick={loadConfiguration} disabled={saving}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={confirmSave}
            disabled={!hasModifications() || saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {hasModifications() && (
        <Alert severity="info" sx={{ mb: 3 }}>
          You have unsaved changes. Click "Save Changes" to apply them.
        </Alert>
      )}

      {/* Authentication Configuration */}
      <Accordion 
        defaultExpanded
        sx={{ mb: 2, border: modifiedSections.has('auth') ? '2px solid #1976d2' : 'none' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" gap={1}>
            <SecurityIcon />
            <Typography variant="h6">Authentication Settings</Typography>
            {modifiedSections.has('auth') && (
              <Chip label="Modified" size="small" color="primary" />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.auth?.enable_ldap || false}
                    onChange={(e) => handleConfigChange('auth', 'enable_ldap', e.target.checked)}
                  />
                }
                label="Enable LDAP Authentication"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.auth?.enable_azure_ad || false}
                    onChange={(e) => handleConfigChange('auth', 'enable_azure_ad', e.target.checked)}
                  />
                }
                label="Enable Azure AD Authentication"
              />
            </Grid>
            
            {config.auth?.enable_ldap && (
              <>
                <Grid item xs={12}>
                  <Divider>
                    <Typography variant="subtitle2" color="textSecondary">
                      LDAP Configuration
                    </Typography>
                  </Divider>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="LDAP Server"
                    value={config.auth?.ldap_server || ''}
                    onChange={(e) => handleConfigChange('auth', 'ldap_server', e.target.value)}
                    placeholder="ldaps://your-domain.com:636"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Base DN"
                    value={config.auth?.ldap_base_dn || ''}
                    onChange={(e) => handleConfigChange('auth', 'ldap_base_dn', e.target.value)}
                    placeholder="DC=company,DC=com"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="User Search Filter"
                    value={config.auth?.ldap_user_filter || ''}
                    onChange={(e) => handleConfigChange('auth', 'ldap_user_filter', e.target.value)}
                    placeholder="(sAMAccountName={username})"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Group Search Filter"
                    value={config.auth?.ldap_group_filter || ''}
                    onChange={(e) => handleConfigChange('auth', 'ldap_group_filter', e.target.value)}
                    placeholder="(member={user_dn})"
                  />
                </Grid>
              </>
            )}

            {config.auth?.enable_azure_ad && (
              <>
                <Grid item xs={12}>
                  <Divider>
                    <Typography variant="subtitle2" color="textSecondary">
                      Azure AD Configuration
                    </Typography>
                  </Divider>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Tenant ID"
                    value={config.auth?.azure_tenant_id || ''}
                    onChange={(e) => handleConfigChange('auth', 'azure_tenant_id', e.target.value)}
                    placeholder="your-tenant-id"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Client ID"
                    value={config.auth?.azure_client_id || ''}
                    onChange={(e) => handleConfigChange('auth', 'azure_client_id', e.target.value)}
                    placeholder="your-client-id"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Client Secret"
                    type="password"
                    value={config.auth?.azure_client_secret || ''}
                    onChange={(e) => handleConfigChange('auth', 'azure_client_secret', e.target.value)}
                    placeholder="Enter client secret"
                  />
                </Grid>
              </>
            )}

            <Grid item xs={12}>
              <Divider>
                <Typography variant="subtitle2" color="textSecondary">
                  Security Policies
                </Typography>
              </Divider>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Session Timeout (minutes)"
                type="number"
                value={config.auth?.session_timeout_minutes || 60}
                onChange={(e) => handleConfigChange('auth', 'session_timeout_minutes', parseInt(e.target.value))}
                inputProps={{ min: 5, max: 1440 }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Max Login Attempts"
                type="number"
                value={config.auth?.max_login_attempts || 5}
                onChange={(e) => handleConfigChange('auth', 'max_login_attempts', parseInt(e.target.value))}
                inputProps={{ min: 1, max: 20 }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Account Lockout Duration (minutes)"
                type="number"
                value={config.auth?.lockout_duration_minutes || 30}
                onChange={(e) => handleConfigChange('auth', 'lockout_duration_minutes', parseInt(e.target.value))}
                inputProps={{ min: 1, max: 1440 }}
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Database Configuration */}
      <Accordion 
        sx={{ mb: 2, border: modifiedSections.has('database') ? '2px solid #1976d2' : 'none' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" gap={1}>
            <StorageIcon />
            <Typography variant="h6">Database Settings</Typography>
            {modifiedSections.has('database') && (
              <Chip label="Modified" size="small" color="primary" />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Connection Pool Size"
                type="number"
                value={config.database?.pool_size || 10}
                onChange={(e) => handleConfigChange('database', 'pool_size', parseInt(e.target.value))}
                inputProps={{ min: 1, max: 100 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Max Overflow Connections"
                type="number"
                value={config.database?.max_overflow || 20}
                onChange={(e) => handleConfigChange('database', 'max_overflow', parseInt(e.target.value))}
                inputProps={{ min: 0, max: 100 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Connection Timeout (seconds)"
                type="number"
                value={config.database?.connection_timeout || 30}
                onChange={(e) => handleConfigChange('database', 'connection_timeout', parseInt(e.target.value))}
                inputProps={{ min: 1, max: 300 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.database?.enable_query_logging || false}
                    onChange={(e) => handleConfigChange('database', 'enable_query_logging', e.target.checked)}
                  />
                }
                label="Enable Query Logging"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Application Settings */}
      <Accordion 
        sx={{ mb: 2, border: modifiedSections.has('application') ? '2px solid #1976d2' : 'none' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" gap={1}>
            <SettingsIcon />
            <Typography variant="h6">Application Settings</Typography>
            {modifiedSections.has('application') && (
              <Chip label="Modified" size="small" color="primary" />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Log Level</InputLabel>
                <Select
                  value={config.application?.log_level || 'INFO'}
                  label="Log Level"
                  onChange={(e) => handleConfigChange('application', 'log_level', e.target.value)}
                >
                  <MenuItem value="DEBUG">DEBUG</MenuItem>
                  <MenuItem value="INFO">INFO</MenuItem>
                  <MenuItem value="WARNING">WARNING</MenuItem>
                  <MenuItem value="ERROR">ERROR</MenuItem>
                  <MenuItem value="CRITICAL">CRITICAL</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Default Page Size"
                type="number"
                value={config.application?.default_page_size || 20}
                onChange={(e) => handleConfigChange('application', 'default_page_size', parseInt(e.target.value))}
                inputProps={{ min: 5, max: 100 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Max Export Records"
                type="number"
                value={config.application?.max_export_records || 10000}
                onChange={(e) => handleConfigChange('application', 'max_export_records', parseInt(e.target.value))}
                inputProps={{ min: 100, max: 100000 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.application?.enable_api_rate_limiting || true}
                    onChange={(e) => handleConfigChange('application', 'enable_api_rate_limiting', e.target.checked)}
                  />
                }
                label="Enable API Rate Limiting"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Application Name"
                value={config.application?.app_name || 'Certificate Management Tool'}
                onChange={(e) => handleConfigChange('application', 'app_name', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Application Description"
                value={config.application?.app_description || ''}
                onChange={(e) => handleConfigChange('application', 'app_description', e.target.value)}
                placeholder="Enter a description for your application"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Email Configuration */}
      <Accordion 
        sx={{ mb: 2, border: modifiedSections.has('email') ? '2px solid #1976d2' : 'none' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" gap={1}>
            <EmailIcon />
            <Typography variant="h6">Email Configuration</Typography>
            {modifiedSections.has('email') && (
              <Chip label="Modified" size="small" color="primary" />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.email?.enable_email_notifications || false}
                    onChange={(e) => handleConfigChange('email', 'enable_email_notifications', e.target.checked)}
                  />
                }
                label="Enable Email Notifications"
              />
            </Grid>
            
            {config.email?.enable_email_notifications && (
              <>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="SMTP Server"
                    value={config.email?.smtp_server || ''}
                    onChange={(e) => handleConfigChange('email', 'smtp_server', e.target.value)}
                    placeholder="smtp.your-domain.com"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="SMTP Port"
                    type="number"
                    value={config.email?.smtp_port || 587}
                    onChange={(e) => handleConfigChange('email', 'smtp_port', parseInt(e.target.value))}
                    inputProps={{ min: 1, max: 65535 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="SMTP Username"
                    value={config.email?.smtp_username || ''}
                    onChange={(e) => handleConfigChange('email', 'smtp_username', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="SMTP Password"
                    type="password"
                    value={config.email?.smtp_password || ''}
                    onChange={(e) => handleConfigChange('email', 'smtp_password', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="From Email"
                    type="email"
                    value={config.email?.from_email || ''}
                    onChange={(e) => handleConfigChange('email', 'from_email', e.target.value)}
                    placeholder="noreply@your-domain.com"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.email?.use_tls || true}
                        onChange={(e) => handleConfigChange('email', 'use_tls', e.target.checked)}
                      />
                    }
                    label="Use TLS/SSL"
                  />
                </Grid>
              </>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Confirmation Dialog */}
      <Dialog 
        open={confirmDialog.open} 
        onClose={() => setConfirmDialog({ open: false, title: '', message: '', onConfirm: null })}
      >
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, title: '', message: '', onConfirm: null })}>
            Cancel
          </Button>
          <Button variant="contained" onClick={confirmDialog.onConfirm}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SystemConfiguration;