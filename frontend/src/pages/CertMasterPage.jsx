// frontend/src/pages/CertMasterPage.jsx
/**
 * Certificate Master Table - Multi-location certificate tracking
 * Helps NOC team see where certificates are installed and their status
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Button, IconButton,
  Chip, TextField, InputAdornment, Dialog, DialogTitle, DialogContent,
  DialogActions, FormControl, InputLabel, Select, MenuItem, Alert,
  Tooltip, CircularProgress, Collapse, Divider, Stack, LinearProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tabs, Tab, Switch, FormControlLabel, Snackbar
} from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import { useTheme } from '@mui/material/styles';

// Icons
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import SyncIcon from '@mui/icons-material/Sync';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import PendingIcon from '@mui/icons-material/Pending';
import CloudIcon from '@mui/icons-material/Cloud';
import StorageIcon from '@mui/icons-material/Storage';
import DnsIcon from '@mui/icons-material/Dns';
import VerifiedIcon from '@mui/icons-material/Verified';
import GroupsIcon from '@mui/icons-material/Groups';
import FilterListIcon from '@mui/icons-material/FilterList';
import InfoIcon from '@mui/icons-material/Info';

import apiClient from '../services/api';

// Location type icons mapping
const locationTypeIcons = {
  f5: <DnsIcon fontSize="small" />,
  local_vm: <StorageIcon fontSize="small" />,
  physical_server: <StorageIcon fontSize="small" />,
  azure_app_gw: <CloudIcon fontSize="small" />,
  azure_front_door: <CloudIcon fontSize="small" />,
  aws_alb: <CloudIcon fontSize="small" />,
  aws_cloudfront: <CloudIcon fontSize="small" />,
  gcp_lb: <CloudIcon fontSize="small" />,
  kubernetes: <CloudIcon fontSize="small" />,
  cdn: <CloudIcon fontSize="small" />,
  other: <StorageIcon fontSize="small" />
};

// Status chip colors
const statusColors = {
  pending: 'warning',
  installed: 'info',
  verified: 'success',
  failed: 'error',
  not_applicable: 'default'
};

const statusIcons = {
  pending: <PendingIcon fontSize="small" />,
  installed: <CheckCircleIcon fontSize="small" />,
  verified: <VerifiedIcon fontSize="small" />,
  failed: <ErrorIcon fontSize="small" />,
  not_applicable: <InfoIcon fontSize="small" />
};

// Help tooltips for each section
const helpTexts = {
  totalCertificates: "Total unique certificates (by Common Name) discovered across all F5 devices. Each CN represents a certificate that can be installed in multiple locations.",
  pendingUpdates: "Installations where the installed certificate does NOT match the latest version. These locations need to be updated by the responsible team.",
  expiringIn30Days: "Certificates expiring within the next 30 days. These require priority attention for renewal.",
  verifiedInstallations: "Total locations (F5, VMs, Cloud) where certificates are installed and verified. Each certificate can have multiple installations.",
  installations: "Number of devices/locations where this certificate is installed. Click the arrow to see details of each location.",
  commonName: "The certificate's Common Name (CN). Uniquely identifies the certificate and usually matches the domain it protects.",
  ownerTeam: "Team responsible for managing this certificate's renewal and distribution.",
  status: "Overall installation status: 'All verified' means all locations have the current certificate installed.",
  syncFromF5: "Automatically imports all certificates discovered on F5 devices and creates installation records for each location."
};

// Stat Card Component with tooltip
const StatCard = ({ title, value, icon, color, onClick, subtitle, helpText }) => (
  <Tooltip title={helpText || ''} arrow placement="top">
    <Card 
      sx={{ 
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        '&:hover': onClick ? { transform: 'translateY(-2px)', boxShadow: 4 } : {}
      }}
      onClick={onClick}
    >
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ 
            p: 1.5, 
            borderRadius: 2, 
            bgcolor: `${color}15`, 
            color: color,
            display: 'flex'
          }}>
            {icon}
          </Box>
          <Box>
            <Typography variant="h4" fontWeight="bold">{value}</Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="body2" color="text.secondary">{title}</Typography>
              {helpText && <InfoIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
            </Stack>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  </Tooltip>
);

// Installation Row Component
const InstallationRow = ({ installation, onMarkUpdated, onVerify, onEdit, onDelete }) => {
  const theme = useTheme();
  const daysUntilExp = installation.days_until_expiration;
  
  return (
    <TableRow hover>
      <TableCell>
        <Stack direction="row" spacing={1} alignItems="center">
          {locationTypeIcons[installation.location_type]}
          <Box>
            <Typography variant="body2" fontWeight="medium">
              {installation.location_name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {installation.location_type.replace(/_/g, ' ').toUpperCase()}
            </Typography>
          </Box>
        </Stack>
      </TableCell>
      <TableCell>
        <Chip 
          icon={statusIcons[installation.status]}
          label={installation.status.replace(/_/g, ' ')}
          color={statusColors[installation.status]}
          size="small"
        />
      </TableCell>
      <TableCell>
        <Typography variant="body2">{installation.responsible_team}</Typography>
        {installation.responsible_contact && (
          <Typography variant="caption" color="text.secondary">
            {installation.responsible_contact}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        {installation.installed_expiration ? (
          <Box>
            <Typography variant="body2">
              {new Date(installation.installed_expiration).toLocaleDateString()}
            </Typography>
            {daysUntilExp !== null && (
              <Typography 
                variant="caption" 
                color={daysUntilExp < 30 ? 'error.main' : 'text.secondary'}
              >
                {daysUntilExp} days
              </Typography>
            )}
          </Box>
        ) : '—'}
      </TableCell>
      <TableCell>
        {installation.is_current ? (
          <Chip label="Current" color="success" size="small" variant="outlined" />
        ) : (
          <Chip label="Needs Update" color="warning" size="small" variant="outlined" />
        )}
      </TableCell>
      <TableCell>
        {installation.updated_by && (
          <Typography variant="caption" color="text.secondary">
            {installation.updated_by}<br/>
            {installation.updated_at && new Date(installation.updated_at).toLocaleDateString()}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Stack direction="row" spacing={0.5}>
          {installation.status === 'pending' && (
            <Tooltip title="Mark as Installed">
              <IconButton size="small" color="primary" onClick={() => onMarkUpdated(installation)}>
                <CheckCircleIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {installation.status === 'installed' && (
            <Tooltip title="Verify Installation">
              <IconButton size="small" color="success" onClick={() => onVerify(installation)}>
                <VerifiedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => onEdit(installation)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => onDelete(installation)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </TableCell>
    </TableRow>
  );
};

// Main Page Component
const CertMasterPage = () => {
  const theme = useTheme();
  
  // State
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [teams, setTeams] = useState([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    owner_team: '',
    environment: '',
    criticality: '',
    has_pending: null
  });
  const [expandedRows, setExpandedRows] = useState({});
  const [selectedCert, setSelectedCert] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create'); // create, edit
  const [installationDialogOpen, setInstallationDialogOpen] = useState(false);
  const [selectedInstallation, setSelectedInstallation] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [syncing, setSyncing] = useState(false);
  
  // Form state for certificate master
  const [certForm, setCertForm] = useState({
    common_name: '',
    friendly_name: '',
    description: '',
    owner_team: '',
    primary_contact: '',
    secondary_contact: '',
    environment: '',
    application: '',
    criticality: '',
    renewal_lead_days: 30,
    notes: ''
  });
  
  // Form state for installation
  const [installForm, setInstallForm] = useState({
    location_type: 'local_vm',
    location_name: '',
    location_identifier: '',
    responsible_team: '',
    responsible_contact: '',
    notes: '',
    installation_instructions: ''
  });

  // Fetch data
  const fetchDashboard = useCallback(async () => {
    try {
      const response = await apiClient.get('/cert-master/dashboard');
      setDashboard(response.data);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    }
  }, []);

  const fetchCertificates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (filters.owner_team) params.append('owner_team', filters.owner_team);
      if (filters.environment) params.append('environment', filters.environment);
      if (filters.criticality) params.append('criticality', filters.criticality);
      if (filters.has_pending !== null) params.append('has_pending', filters.has_pending);
      
      const response = await apiClient.get(`/cert-master/?${params}`);
      setCertificates(response.data);
    } catch (error) {
      console.error('Failed to fetch certificates:', error);
      setSnackbar({ open: true, message: 'Failed to load certificates', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [search, filters]);

  const fetchTeams = useCallback(async () => {
    try {
      const response = await apiClient.get('/cert-master/teams');
      setTeams(response.data);
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchCertificates();
    fetchTeams();
  }, [fetchDashboard, fetchCertificates, fetchTeams]);

  // Handlers
  const handleRefresh = () => {
    fetchDashboard();
    fetchCertificates();
    fetchTeams();
  };

  const handleSyncFromF5 = async () => {
    setSyncing(true);
    try {
      const response = await apiClient.post('/cert-master/sync-from-f5', {
        create_missing: true,
        update_existing: true,
        auto_create_installations: true
      });
      setSnackbar({ 
        open: true, 
        message: `Sync complete: ${response.data.created_masters} created, ${response.data.updated_masters} updated`, 
        severity: 'success' 
      });
      handleRefresh();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to sync from F5', severity: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const handleExpandRow = (certId) => {
    setExpandedRows(prev => ({
      ...prev,
      [certId]: !prev[certId]
    }));
  };

  const handleCreateCert = async () => {
    try {
      await apiClient.post('/cert-master/', certForm);
      setSnackbar({ open: true, message: 'Certificate master created', severity: 'success' });
      setDialogOpen(false);
      handleRefresh();
    } catch (error) {
      setSnackbar({ open: true, message: error.response?.data?.detail || 'Failed to create', severity: 'error' });
    }
  };

  const handleUpdateCert = async () => {
    try {
      await apiClient.put(`/cert-master/${selectedCert.id}`, certForm);
      setSnackbar({ open: true, message: 'Certificate master updated', severity: 'success' });
      setDialogOpen(false);
      handleRefresh();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to update', severity: 'error' });
    }
  };

  const handleDeleteCert = async (cert) => {
    if (!window.confirm(`Delete master record for "${cert.common_name}"? This will delete all installation records.`)) {
      return;
    }
    try {
      await apiClient.delete(`/cert-master/${cert.id}`);
      setSnackbar({ open: true, message: 'Certificate master deleted', severity: 'success' });
      handleRefresh();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to delete', severity: 'error' });
    }
  };

  const handleAddInstallation = async () => {
    try {
      await apiClient.post(`/cert-master/${selectedCert.id}/installations`, installForm);
      setSnackbar({ open: true, message: 'Installation added', severity: 'success' });
      setInstallationDialogOpen(false);
      handleRefresh();
    } catch (error) {
      setSnackbar({ open: true, message: error.response?.data?.detail || 'Failed to add installation', severity: 'error' });
    }
  };

  const handleMarkUpdated = async (installation) => {
    try {
      await apiClient.post(`/cert-master/installations/${installation.id}/mark-updated`, {
        status: 'installed'
      });
      setSnackbar({ open: true, message: 'Marked as installed', severity: 'success' });
      handleRefresh();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to update status', severity: 'error' });
    }
  };

  const handleVerify = async (installation) => {
    try {
      await apiClient.post(`/cert-master/installations/${installation.id}/verify`);
      setSnackbar({ open: true, message: 'Installation verified', severity: 'success' });
      handleRefresh();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to verify', severity: 'error' });
    }
  };

  const handleDeleteInstallation = async (installation) => {
    if (!window.confirm(`Delete installation at "${installation.location_name}"?`)) {
      return;
    }
    try {
      await apiClient.delete(`/cert-master/installations/${installation.id}`);
      setSnackbar({ open: true, message: 'Installation deleted', severity: 'success' });
      handleRefresh();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to delete installation', severity: 'error' });
    }
  };

  const openCreateDialog = () => {
    setCertForm({
      common_name: '',
      friendly_name: '',
      description: '',
      owner_team: '',
      primary_contact: '',
      secondary_contact: '',
      environment: '',
      application: '',
      criticality: '',
      renewal_lead_days: 30,
      notes: ''
    });
    setDialogMode('create');
    setDialogOpen(true);
  };

  const openEditDialog = (cert) => {
    setSelectedCert(cert);
    setCertForm({
      common_name: cert.common_name,
      friendly_name: cert.friendly_name || '',
      description: cert.description || '',
      owner_team: cert.owner_team || '',
      primary_contact: cert.primary_contact || '',
      secondary_contact: cert.secondary_contact || '',
      environment: cert.environment || '',
      application: cert.application || '',
      criticality: cert.criticality || '',
      renewal_lead_days: cert.renewal_lead_days || 30,
      notes: cert.notes || ''
    });
    setDialogMode('edit');
    setDialogOpen(true);
  };

  const openInstallationDialog = (cert) => {
    setSelectedCert(cert);
    setInstallForm({
      location_type: 'local_vm',
      location_name: '',
      location_identifier: '',
      responsible_team: '',
      responsible_contact: '',
      notes: '',
      installation_instructions: ''
    });
    setInstallationDialogOpen(true);
  };

  // Fetch full certificate details when expanding
  const fetchCertDetails = async (certId) => {
    try {
      const response = await apiClient.get(`/cert-master/${certId}`);
      setCertificates(prev => prev.map(c => 
        c.id === certId ? { ...c, installations: response.data.installations } : c
      ));
    } catch (error) {
      console.error('Failed to fetch cert details:', error);
    }
  };

  useEffect(() => {
    Object.keys(expandedRows).forEach(certId => {
      if (expandedRows[certId]) {
        const cert = certificates.find(c => c.id === parseInt(certId));
        if (cert && !cert.installations) {
          fetchCertDetails(parseInt(certId));
        }
      }
    });
  }, [expandedRows, certificates]);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Certificate Master Table
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track certificates across F5, VMs, and Cloud. Know who to contact when certs expire.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title={helpTexts.syncFromF5} arrow placement="bottom">
            <span>
              <Button 
                startIcon={syncing ? <CircularProgress size={18} /> : <SyncIcon />}
                onClick={handleSyncFromF5}
                disabled={syncing}
                variant="outlined"
              >
                Sync from F5
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Actualizar la lista de certificados" arrow>
            <Button startIcon={<RefreshIcon />} onClick={handleRefresh}>
              Refresh
            </Button>
          </Tooltip>
          <Tooltip title="Add a certificate manually (for certs not on F5)" arrow>
            <Button startIcon={<AddIcon />} variant="contained" onClick={openCreateDialog}>
              Add Certificate
            </Button>
          </Tooltip>
        </Stack>
      </Box>

      {/* Dashboard Stats */}
      {dashboard && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard 
              title="Total Certificates" 
              value={dashboard.active_certificates}
              icon={<DnsIcon />}
              color={theme.palette.primary.main}
              helpText={helpTexts.totalCertificates}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard 
              title="Pending Updates" 
              value={dashboard.pending_installations}
              icon={<PendingIcon />}
              color={theme.palette.warning.main}
              onClick={() => setFilters(f => ({ ...f, has_pending: true }))}
              subtitle="Click to filter"
              helpText={helpTexts.pendingUpdates}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard 
              title="Expiring in 30 days" 
              value={dashboard.certificates_expiring_30_days}
              icon={<WarningIcon />}
              color={theme.palette.error.main}
              helpText={helpTexts.expiringIn30Days}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard 
              title="Verified Installations" 
              value={dashboard.verified_installations}
              icon={<VerifiedIcon />}
              color={theme.palette.success.main}
              helpText={helpTexts.verifiedInstallations}
            />
          </Grid>
        </Grid>
      )}

      {/* Team Summary */}
      {dashboard && dashboard.by_team.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <GroupsIcon />
            <Typography variant="subtitle1" fontWeight="medium">
              Installations by Team
            </Typography>
            <Tooltip title="Shows how many installations each team has and how many are verified. Click a team to filter the table." arrow>
              <InfoIcon sx={{ fontSize: 16, color: 'text.disabled', cursor: 'help' }} />
            </Tooltip>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {dashboard.by_team.map(team => (
              <Chip
                key={team.team}
                label={`${team.team}: ${team.verified}/${team.total} verified`}
                color={team.pending > 0 ? 'warning' : 'success'}
                variant="outlined"
                onClick={() => setFilters(f => ({ ...f, owner_team: team.team }))}
                sx={{ mb: 1 }}
              />
            ))}
          </Stack>
        </Paper>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            placeholder="Search by CN, name, application..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>
            }}
            sx={{ minWidth: 300 }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Team</InputLabel>
            <Select
              value={filters.owner_team}
              label="Team"
              onChange={(e) => setFilters(f => ({ ...f, owner_team: e.target.value }))}
            >
              <MenuItem value="">All Teams</MenuItem>
              {teams.map(team => (
                <MenuItem key={team} value={team}>{team}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Environment</InputLabel>
            <Select
              value={filters.environment}
              label="Environment"
              onChange={(e) => setFilters(f => ({ ...f, environment: e.target.value }))}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="prod">Production</MenuItem>
              <MenuItem value="staging">Staging</MenuItem>
              <MenuItem value="dev">Development</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Criticality</InputLabel>
            <Select
              value={filters.criticality}
              label="Criticality"
              onChange={(e) => setFilters(f => ({ ...f, criticality: e.target.value }))}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Switch
                checked={filters.has_pending === true}
                onChange={(e) => setFilters(f => ({ ...f, has_pending: e.target.checked ? true : null }))}
              />
            }
            label="Has Pending"
          />
          {(filters.owner_team || filters.environment || filters.criticality || filters.has_pending !== null) && (
            <Button size="small" onClick={() => setFilters({ owner_team: '', environment: '', criticality: '', has_pending: null })}>
              Clear Filters
            </Button>
          )}
        </Stack>
      </Paper>

      {/* Certificates Table */}
      <Paper>
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : certificates.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No certificate master records found. Click "Sync from F5" to import certificates from F5 devices, 
              or "Add Certificate" to create a new record.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell width={40}>
                    <Tooltip title="Click the arrow to expand and view installation locations" arrow>
                      <InfoIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <span>Common Name</span>
                      <Tooltip title={helpTexts.commonName} arrow>
                        <InfoIcon sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                      </Tooltip>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <span>Owner Team</span>
                      <Tooltip title={helpTexts.ownerTeam} arrow>
                        <InfoIcon sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                      </Tooltip>
                    </Stack>
                  </TableCell>
                  <TableCell>Expiration</TableCell>
                  <TableCell>Environment</TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                      <span>Installations</span>
                      <Tooltip title={helpTexts.installations} arrow>
                        <InfoIcon sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                      </Tooltip>
                    </Stack>
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                      <span>Status</span>
                      <Tooltip title={helpTexts.status} arrow>
                        <InfoIcon sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                      </Tooltip>
                    </Stack>
                  </TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {certificates.map(cert => (
                  <React.Fragment key={cert.id}>
                    <TableRow hover>
                      <TableCell>
                        <Tooltip title={expandedRows[cert.id] ? "Hide locations" : `View ${cert.total_installations} locations`}>
                          <IconButton size="small" onClick={() => handleExpandRow(cert.id)}>
                            {expandedRows[cert.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {cert.common_name}
                        </Typography>
                        {cert.friendly_name && (
                          <Typography variant="caption" color="text.secondary">
                            {cert.friendly_name}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{cert.owner_team || '—'}</Typography>
                        {cert.primary_contact && (
                          <Typography variant="caption" color="text.secondary">
                            {cert.primary_contact}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {cert.current_expiration ? (
                          <Box>
                            <Typography variant="body2">
                              {new Date(cert.current_expiration).toLocaleDateString()}
                            </Typography>
                            <Typography 
                              variant="caption" 
                              color={cert.days_until_expiration < 30 ? 'error.main' : 'text.secondary'}
                            >
                              {cert.days_until_expiration} days
                            </Typography>
                          </Box>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {cert.environment && (
                          <Chip 
                            label={cert.environment} 
                            size="small" 
                            color={cert.environment === 'prod' ? 'error' : 'default'}
                            variant="outlined"
                          />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip 
                          title={
                            cert.installations && cert.installations.length > 0 
                              ? (
                                <Box sx={{ p: 0.5 }}>
                                  <Typography variant="caption" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>
                                    Devices ({cert.total_installations}):
                                  </Typography>
                                  {cert.installations.slice(0, 5).map((inst, idx) => (
                                    <Typography key={idx} variant="caption" sx={{ display: 'block' }}>
                                      • {inst.location_name}
                                    </Typography>
                                  ))}
                                  {cert.total_installations > 5 && (
                                    <Typography variant="caption" sx={{ display: 'block', fontStyle: 'italic' }}>
                                      +{cert.total_installations - 5} more...
                                    </Typography>
                                  )}
                                </Box>
                              )
                              : "Click the arrow to see devices"
                          }
                          arrow
                          placement="left"
                        >
                          <Chip 
                            label={`${cert.total_installations}`} 
                            size="small"
                            color={cert.pending_installations > 0 ? 'warning' : 'success'}
                            onClick={() => handleExpandRow(cert.id)}
                            sx={{ cursor: 'pointer' }}
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        {cert.pending_installations > 0 ? (
                          <Chip 
                            icon={<PendingIcon />}
                            label={`${cert.pending_installations} pending`}
                            color="warning"
                            size="small"
                          />
                        ) : cert.total_installations > 0 ? (
                          <Chip 
                            icon={<VerifiedIcon />}
                            label="All verified"
                            color="success"
                            size="small"
                          />
                        ) : (
                          <Chip label="No installs" size="small" />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Add installation location (VM, Cloud, etc.)">
                            <IconButton size="small" color="primary" onClick={() => openInstallationDialog(cert)}>
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit certificate info">
                            <IconButton size="small" onClick={() => openEditDialog(cert)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => handleDeleteCert(cert)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                    
                    {/* Expanded Installations */}
                    <TableRow>
                      <TableCell colSpan={8} sx={{ py: 0, bgcolor: 'action.hover' }}>
                        <Collapse in={expandedRows[cert.id]} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 2, px: 4 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Installation Locations
                            </Typography>
                            {cert.installations && cert.installations.length > 0 ? (
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Location</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Responsible Team</TableCell>
                                    <TableCell>Installed Cert Expiry</TableCell>
                                    <TableCell>Current?</TableCell>
                                    <TableCell>Last Updated</TableCell>
                                    <TableCell>Actions</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {cert.installations.map(inst => (
                                    <InstallationRow
                                      key={inst.id}
                                      installation={inst}
                                      onMarkUpdated={handleMarkUpdated}
                                      onVerify={handleVerify}
                                      onEdit={(i) => console.log('Edit installation', i)}
                                      onDelete={handleDeleteInstallation}
                                    />
                                  ))}
                                </TableBody>
                              </Table>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                No installation locations configured. Click "+" to add one.
                              </Typography>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Create/Edit Certificate Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {dialogMode === 'create' ? 'Add Certificate Master Record' : 'Edit Certificate Master Record'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Common Name (CN)"
                value={certForm.common_name}
                onChange={(e) => setCertForm(f => ({ ...f, common_name: e.target.value }))}
                disabled={dialogMode === 'edit'}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Friendly Name"
                value={certForm.friendly_name}
                onChange={(e) => setCertForm(f => ({ ...f, friendly_name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Application"
                value={certForm.application}
                onChange={(e) => setCertForm(f => ({ ...f, application: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Owner Team"
                value={certForm.owner_team}
                onChange={(e) => setCertForm(f => ({ ...f, owner_team: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Primary Contact"
                value={certForm.primary_contact}
                onChange={(e) => setCertForm(f => ({ ...f, primary_contact: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Environment</InputLabel>
                <Select
                  value={certForm.environment}
                  label="Environment"
                  onChange={(e) => setCertForm(f => ({ ...f, environment: e.target.value }))}
                >
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value="prod">Production</MenuItem>
                  <MenuItem value="staging">Staging</MenuItem>
                  <MenuItem value="dev">Development</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Criticality</InputLabel>
                <Select
                  value={certForm.criticality}
                  label="Criticality"
                  onChange={(e) => setCertForm(f => ({ ...f, criticality: e.target.value }))}
                >
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={certForm.description}
                onChange={(e) => setCertForm(f => ({ ...f, description: e.target.value }))}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                value={certForm.notes}
                onChange={(e) => setCertForm(f => ({ ...f, notes: e.target.value }))}
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={dialogMode === 'create' ? handleCreateCert : handleUpdateCert}
            disabled={!certForm.common_name}
          >
            {dialogMode === 'create' ? 'Create' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Installation Dialog */}
      <Dialog open={installationDialogOpen} onClose={() => setInstallationDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Installation Location</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Location Type</InputLabel>
                <Select
                  value={installForm.location_type}
                  label="Location Type"
                  onChange={(e) => setInstallForm(f => ({ ...f, location_type: e.target.value }))}
                >
                  <MenuItem value="local_vm">Local VM</MenuItem>
                  <MenuItem value="physical_server">Physical Server</MenuItem>
                  <MenuItem value="azure_app_gw">Azure App Gateway</MenuItem>
                  <MenuItem value="azure_front_door">Azure Front Door</MenuItem>
                  <MenuItem value="aws_alb">AWS ALB</MenuItem>
                  <MenuItem value="aws_cloudfront">AWS CloudFront</MenuItem>
                  <MenuItem value="gcp_lb">GCP Load Balancer</MenuItem>
                  <MenuItem value="kubernetes">Kubernetes</MenuItem>
                  <MenuItem value="cdn">CDN</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Location Name"
                value={installForm.location_name}
                onChange={(e) => setInstallForm(f => ({ ...f, location_name: e.target.value }))}
                required
                placeholder="e.g., vm-web-prod-01, azure-appgw-east"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Location Identifier"
                value={installForm.location_identifier}
                onChange={(e) => setInstallForm(f => ({ ...f, location_identifier: e.target.value }))}
                placeholder="IP address, ARN, resource ID, etc."
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Responsible Team"
                value={installForm.responsible_team}
                onChange={(e) => setInstallForm(f => ({ ...f, responsible_team: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Responsible Contact"
                value={installForm.responsible_contact}
                onChange={(e) => setInstallForm(f => ({ ...f, responsible_contact: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Installation Instructions"
                value={installForm.installation_instructions}
                onChange={(e) => setInstallForm(f => ({ ...f, installation_instructions: e.target.value }))}
                multiline
                rows={2}
                placeholder="How to install the certificate at this location"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInstallationDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleAddInstallation}
            disabled={!installForm.location_name || !installForm.responsible_team}
          >
            Add Installation
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CertMasterPage;
