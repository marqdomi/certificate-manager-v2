// frontend/src/pages/CredentialTemplatesPage.jsx
/**
 * Credential Templates Management Page
 * 
 * CRUD operations for credential templates with enterprise design.
 * Features:
 * - View all templates
 * - Create new templates
 * - Edit existing templates (including password)
 * - Delete templates
 * - Set default template
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  InputAdornment,
  alpha,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

// Icons
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoIcon from '@mui/icons-material/Info';
import DevicesIcon from '@mui/icons-material/Devices';

import apiClient from '../services/api';
import { PageHeader, PageTransition, EmptyState, SkeletonTable } from '../components/shared';
import { glassmorphicCard } from '../constants/styleMixins';

const CredentialTemplatesPage = () => {
  const theme = useTheme();
  
  // State
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create'); // 'create' or 'edit'
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    username: 'admin',
    password: '',
    environment: '',
    site_pattern: '',
    is_default: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Load templates
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/credentials/templates?include_inactive=true');
      setTemplates(response.data.templates || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Failed to load credential templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Open create dialog
  const handleOpenCreate = () => {
    setDialogMode('create');
    setSelectedTemplate(null);
    setFormData({
      name: '',
      description: '',
      username: 'admin',
      password: '',
      environment: '',
      site_pattern: '',
      is_default: false,
    });
    setShowPassword(false);
    setDialogOpen(true);
  };

  // Open edit dialog
  const handleOpenEdit = (template) => {
    setDialogMode('edit');
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      username: template.username,
      password: '', // Don't pre-fill password for security
      environment: template.environment || '',
      site_pattern: template.site_pattern || '',
      is_default: template.is_default,
    });
    setShowPassword(false);
    setDialogOpen(true);
  };

  // Handle form submit
  const handleSubmit = async () => {
    if (!formData.name || !formData.username) {
      setSnackbar({ open: true, message: 'Name and username are required', severity: 'error' });
      return;
    }
    
    if (dialogMode === 'create' && !formData.password) {
      setSnackbar({ open: true, message: 'Password is required for new templates', severity: 'error' });
      return;
    }

    setSaving(true);
    try {
      const payload = { ...formData };
      
      // Don't send empty password on edit (keeps existing)
      if (dialogMode === 'edit' && !payload.password) {
        delete payload.password;
      }
      
      // Remove empty optional fields
      if (!payload.environment) delete payload.environment;
      if (!payload.site_pattern) delete payload.site_pattern;
      if (!payload.description) delete payload.description;

      if (dialogMode === 'create') {
        await apiClient.post('/credentials/templates', payload);
        setSnackbar({ open: true, message: 'Template created successfully', severity: 'success' });
      } else {
        await apiClient.put(`/credentials/templates/${selectedTemplate.id}`, payload);
        setSnackbar({ open: true, message: 'Template updated successfully', severity: 'success' });
      }
      
      setDialogOpen(false);
      loadTemplates();
    } catch (err) {
      const message = err.response?.data?.detail || 'Failed to save template';
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!templateToDelete) return;
    
    try {
      await apiClient.delete(`/credentials/templates/${templateToDelete.id}`);
      setSnackbar({ open: true, message: 'Template deleted successfully', severity: 'success' });
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
      loadTemplates();
    } catch (err) {
      const message = err.response?.data?.detail || 'Failed to delete template';
      setSnackbar({ open: true, message, severity: 'error' });
    }
  };

  // Toggle default
  const handleToggleDefault = async (template) => {
    try {
      await apiClient.put(`/credentials/templates/${template.id}`, {
        is_default: !template.is_default,
      });
      setSnackbar({ 
        open: true, 
        message: template.is_default ? 'Default removed' : 'Set as default', 
        severity: 'success' 
      });
      loadTemplates();
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to update template', severity: 'error' });
    }
  };

  if (loading && templates.length === 0) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <SkeletonTable rows={5} columns={4} />
      </Box>
    );
  }

  return (
    <PageTransition>
      {/* Header */}
      <PageHeader
        title="Credential Templates"
        subtitle="Manage reusable credential sets for F5 devices."
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadTemplates}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenCreate}
            >
              New Template
            </Button>
          </Box>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Info Alert */}
      <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2 }}>
        Credential templates allow you to define reusable authentication sets. 
        The <strong>Default</strong> template will be automatically used when no specific credentials are set for a device.
        Use <strong>Site Pattern</strong> to auto-match templates to devices by hostname pattern.
      </Alert>

      {/* Templates Table */}
      <TableContainer component={Paper} elevation={0} sx={{ ...glassmorphicCard(theme) }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
              <TableCell width="50">Default</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Username</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Site Pattern</TableCell>
              <TableCell align="center">Usage</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState
                    icon={<VpnKeyIcon />}
                    title="No credential templates found"
                    subtitle="Create one to get started."
                  />
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template) => (
                <TableRow 
                  key={template.id}
                  sx={{ 
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) },
                    opacity: template.is_active ? 1 : 0.5,
                  }}
                >
                  <TableCell>
                    <Tooltip title={template.is_default ? "Default template" : "Set as default"}>
                      <IconButton 
                        size="small" 
                        onClick={() => handleToggleDefault(template)}
                        color={template.is_default ? "warning" : "default"}
                        aria-label="Toggle default template"
                      >
                        {template.is_default ? <StarIcon /> : <StarBorderIcon />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {template.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <PersonIcon fontSize="small" color="action" />
                      {template.username}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 200 }} noWrap>
                      {template.description || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {template.site_pattern ? (
                      <Chip 
                        label={template.site_pattern} 
                        size="small" 
                        variant="outlined"
                        color="primary"
                      />
                    ) : '-'}
                  </TableCell>
                  <TableCell align="center">
                    <Chip 
                      icon={<DevicesIcon sx={{ fontSize: '16px !important' }} />}
                      label={template.usage_count}
                      size="small"
                      color={template.usage_count > 0 ? "success" : "default"}
                      sx={{ minWidth: 60 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={template.is_active ? "Active" : "Inactive"}
                      size="small"
                      color={template.is_active ? "success" : "default"}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton 
                        size="small" 
                        onClick={() => handleOpenEdit(template)}
                        color="primary"
                        aria-label="Edit"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton 
                        size="small" 
                        onClick={() => {
                          setTemplateToDelete(template);
                          setDeleteDialogOpen(true);
                        }}
                        color="error"
                        disabled={template.is_default}
                        aria-label="Delete"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <VpnKeyIcon color="primary" />
            {dialogMode === 'create' ? 'Create New Template' : 'Edit Template'}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Template Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
              placeholder="e.g., Production, Development, Omnitracs"
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
              placeholder="Optional description for this template"
            />
            <TextField
              label="Username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              fullWidth
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label={dialogMode === 'edit' ? "New Password (leave blank to keep current)" : "Password"}
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              fullWidth
              required={dialogMode === 'create'}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      size="small"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Site Pattern"
              value={formData.site_pattern}
              onChange={(e) => setFormData({ ...formData, site_pattern: e.target.value })}
              fullWidth
              placeholder="e.g., omnitracs, prod, eu"
              helperText="Hostname pattern for auto-matching (optional)"
            />
            <TextField
              label="Environment"
              value={formData.environment}
              onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
              fullWidth
              placeholder="e.g., production, development"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  color="warning"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <StarIcon fontSize="small" color={formData.is_default ? "warning" : "disabled"} />
                  Set as default template
                </Box>
              }
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSubmit}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : null}
          >
            {dialogMode === 'create' ? 'Create' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Template?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the template <strong>"{templateToDelete?.name}"</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone. Devices using this template will lose their credential assignment.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </PageTransition>
  );
};

export default CredentialTemplatesPage;
