// frontend/src/components/CredentialDialog.jsx
/**
 * Enhanced Credential Dialog - Enterprise Edition
 * 
 * Modern credential management with template support.
 * Features:
 * - Select from saved credential templates
 * - Manual credential entry
 * - Save credentials as new template option
 * - Enterprise-level design
 */

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
  IconButton,
  Tabs,
  Tab,
  Alert,
  Chip,
  Divider,
  InputAdornment,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Radio,
  alpha,
  Stack,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

// Icons
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StorageIcon from '@mui/icons-material/Storage';
import StarIcon from '@mui/icons-material/Star';

import apiClient from '../services/api';

// Tab Panel helper
function TabPanel({ children, value, index, ...other }) {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

const CredentialDialog = ({ open, onClose, onSave, device }) => {
  const theme = useTheme();
  
  // Tab state
  const [activeTab, setActiveTab] = useState(0);
  
  // Template selection state
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  
  // Manual entry state
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  
  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Load templates when dialog opens
  useEffect(() => {
    if (open) {
      loadTemplates();
      // Reset state
      setActiveTab(0);
      setSelectedTemplate(null);
      setUsername(device?.username || 'admin');
      setPassword('');
      setSaveAsTemplate(false);
      setTemplateName('');
      setError(null);
    }
  }, [open, device]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      // URL should NOT include /api/v1 - apiClient already adds it as baseURL
      const response = await apiClient.get('/credentials/templates');
      setTemplates(response.data.templates || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
      // Don't show error - templates are optional
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      if (activeTab === 0 && selectedTemplate) {
        // Apply template - URL should NOT include /api/v1 (apiClient adds it)
        await apiClient.post('/credentials/templates/apply', {
          template_id: selectedTemplate.id,
          device_ids: [device.id]
        });
        onSave({ 
          username: selectedTemplate.username, 
          fromTemplate: true,
          templateName: selectedTemplate.name 
        });
      } else {
        // Manual entry
        if (!password) {
          setError('Password is required');
          setSaving(false);
          return;
        }

        // If saving as template, create the template first
        if (saveAsTemplate && templateName) {
          try {
            await apiClient.post('/credentials/templates', {
              name: templateName,
              username,
              password,
              description: `Created from device ${device.hostname}`
            });
          } catch (err) {
            console.warn('Failed to save template:', err);
            // Continue with credential save even if template save fails
          }
        }

        onSave({ username, password });
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save credentials');
    } finally {
      setSaving(false);
    }
  };

  const canSave = () => {
    if (activeTab === 0) {
      return selectedTemplate !== null;
    }
    return password.length > 0 && (!saveAsTemplate || templateName.length > 0);
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
          borderRadius: 3,
          overflow: 'hidden',
        }
      }}
    >
      {/* Header */}
      <DialogTitle 
        sx={{ 
          p: 0,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.background.paper, 1)} 100%)`,
        }}
      >
        <Box sx={{ p: 2.5, pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                }}
              >
                <VpnKeyIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={600}>
                  Set Credentials
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Configure authentication for this device
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={onClose} size="small" sx={{ mt: -0.5, mr: -0.5 }}>
              <CloseIcon />
            </IconButton>
          </Box>
          
          {/* Device Info */}
          <Box 
            sx={{ 
              mt: 2, 
              p: 1.5, 
              borderRadius: 2, 
              bgcolor: alpha(theme.palette.info.main, 0.08),
              border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5
            }}
          >
            <StorageIcon color="info" fontSize="small" />
            <Box>
              <Typography variant="subtitle2" fontWeight={600}>
                {device.hostname}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {device.ip_address}
              </Typography>
            </Box>
          </Box>
        </Box>
        
        {/* Tabs */}
        <Tabs 
          value={activeTab} 
          onChange={(_, v) => setActiveTab(v)}
          sx={{ 
            px: 2,
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
            }
          }}
        >
          <Tab 
            icon={<FolderSpecialIcon fontSize="small" />} 
            iconPosition="start" 
            label="Use Template" 
            sx={{ textTransform: 'none', fontWeight: 500 }}
          />
          <Tab 
            icon={<EditIcon fontSize="small" />} 
            iconPosition="start" 
            label="Manual Entry" 
            sx={{ textTransform: 'none', fontWeight: 500 }}
          />
        </Tabs>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {error && (
          <Alert severity="error" sx={{ mx: 2, mt: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Template Selection Tab */}
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ px: 2.5, pb: 2 }}>
            {loadingTemplates ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : templates.length === 0 ? (
              <Box 
                sx={{ 
                  textAlign: 'center', 
                  py: 4,
                  px: 2,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.warning.main, 0.05),
                  border: `1px dashed ${alpha(theme.palette.warning.main, 0.3)}`,
                }}
              >
                <FolderSpecialIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  No credential templates available
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Switch to "Manual Entry" tab to enter credentials
                </Typography>
              </Box>
            ) : (
              <List sx={{ py: 0 }}>
                {templates.map((template) => (
                  <ListItem 
                    key={template.id}
                    disablePadding
                    sx={{ mb: 1 }}
                  >
                    <ListItemButton
                      onClick={() => setSelectedTemplate(template)}
                      selected={selectedTemplate?.id === template.id}
                      sx={{
                        borderRadius: 2,
                        border: `1px solid ${
                          selectedTemplate?.id === template.id 
                            ? theme.palette.primary.main 
                            : theme.palette.divider
                        }`,
                        bgcolor: selectedTemplate?.id === template.id 
                          ? alpha(theme.palette.primary.main, 0.08)
                          : 'transparent',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.04),
                        }
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Radio 
                          checked={selectedTemplate?.id === template.id}
                          size="small"
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle2" fontWeight={600}>
                              {template.name}
                            </Typography>
                            {template.is_default && (
                              <Chip 
                                icon={<StarIcon sx={{ fontSize: '14px !important' }} />}
                                label="Default" 
                                size="small" 
                                color="warning"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary" component="div">
                              <PersonIcon sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
                              {template.username}
                              {template.environment && (
                                <>
                                  <span style={{ margin: '0 8px' }}>•</span>
                                  {template.environment}
                                </>
                              )}
                            </Typography>
                            {template.description && (
                              <Typography 
                                variant="caption" 
                                color="text.secondary" 
                                sx={{ display: 'block', mt: 0.25 }}
                              >
                                {template.description}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Stack direction="column" alignItems="flex-end" spacing={0.5}>
                          <Chip 
                            size="small"
                            label={`Used ${template.usage_count}x`}
                            sx={{ 
                              height: 20, 
                              fontSize: '0.7rem',
                              bgcolor: alpha(theme.palette.success.main, 0.1),
                              color: 'success.dark'
                            }}
                          />
                        </Stack>
                      </ListItemSecondaryAction>
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </TabPanel>

        {/* Manual Entry Tab */}
        <TabPanel value={activeTab} index={1}>
          <Box sx={{ px: 2.5, pb: 2 }}>
            <TextField
              fullWidth
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ 
                mb: 2,
                '& .MuiOutlinedInput-root': { borderRadius: 2 }
              }}
            />
            
            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canSave()) handleSave(); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ 
                mb: 2,
                '& .MuiOutlinedInput-root': { borderRadius: 2 }
              }}
            />

            <Divider sx={{ my: 2 }} />

            {/* Save as Template Option */}
            <Box 
              sx={{ 
                p: 2, 
                borderRadius: 2, 
                bgcolor: alpha(theme.palette.primary.main, 0.04),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox 
                    checked={saveAsTemplate} 
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                    size="small"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Save as Template
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Reuse these credentials for other devices
                    </Typography>
                  </Box>
                }
              />
              
              {saveAsTemplate && (
                <TextField
                  fullWidth
                  size="small"
                  label="Template Name"
                  placeholder="e.g., Production F5 Credentials"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  sx={{ 
                    mt: 2,
                    '& .MuiOutlinedInput-root': { borderRadius: 2 }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <FolderSpecialIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            </Box>
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button 
          onClick={onClose} 
          sx={{ borderRadius: 2, textTransform: 'none' }}
        >
          Cancel
        </Button>
        <Button 
          variant="contained"
          onClick={handleSave}
          disabled={!canSave() || saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
          sx={{ borderRadius: 2, textTransform: 'none', px: 3 }}
        >
          {saving ? 'Saving...' : activeTab === 0 ? 'Apply Template' : 'Save Credentials'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CredentialDialog;