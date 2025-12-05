// src/pages/DiscoveryPage.tsx
/**
 * Network Discovery Page - Enterprise UI
 * 
 * Professional discovery interface following industry standards
 * similar to Ansible AWX, F5 BIG-IQ, and SolarWinds patterns.
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Chip,
  TextField,
  FormControlLabel,
  Checkbox,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  InputAdornment,
  Tabs,
  Tab,
  Collapse,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  Radar as RadarIcon,
  PlayArrow as StartIcon,
  Refresh as RefreshIcon,
  Download as ImportIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  VisibilityOff as VisibilityOffIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as PendingIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Search as SearchIcon,
  Storage as StorageIcon,
  NetworkCheck as NetworkIcon,
  History as HistoryIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { authProvider } from './LoginPage';
import api from '../services/api';

// ============================================================================
// Types
// ============================================================================

interface SubnetPreset {
  key: string;
  label: string;
  subnets: string[];
  total_ips: number;
}

interface CredentialSet {
  username: string;
  password: string;
  name: string;
}

interface DiscoveryJob {
  id: number;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  subnets: string[];
  total_ips: number;
  scanned_ips: number;
  found_devices: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

interface DiscoveredDevice {
  id: number;
  ip_address: string;
  hostname: string | null;
  version: string | null;
  platform: string | null;
  serial_number: string | null;
  ha_state: string | null;
  status: 'pending' | 'imported' | 'duplicate' | 'skipped';
  probe_success: boolean;
  probe_message: string | null;
  credential_source: string | null;
  suggested_site: string | null;
  suggested_cluster_key: string | null;
  imported_device_id: number | null;
}

interface DiscoveryProgress {
  job_id: number;
  total_ips: number;
  scanned_ips: number;
  found_devices: number;
  current_ip: string;
  status: string;
  percent: number;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_CONFIG = {
  pending: { color: 'default' as const, icon: PendingIcon, label: 'Pending' },
  running: { color: 'info' as const, icon: RadarIcon, label: 'Running' },
  completed: { color: 'success' as const, icon: SuccessIcon, label: 'Completed' },
  failed: { color: 'error' as const, icon: ErrorIcon, label: 'Failed' },
  cancelled: { color: 'warning' as const, icon: WarningIcon, label: 'Cancelled' },
};

const DEVICE_STATUS_CONFIG = {
  pending: { color: 'info' as const, label: 'Ready to Import' },
  imported: { color: 'success' as const, label: 'Imported' },
  duplicate: { color: 'warning' as const, label: 'Already Exists' },
  skipped: { color: 'default' as const, label: 'Skipped' },
};

// ============================================================================
// Main Component
// ============================================================================

export default function DiscoveryPage() {
  const token = authProvider.getToken();
  
  // ─────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────
  
  // UI State
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Data
  const [presets, setPresets] = useState<SubnetPreset[]>([]);
  const [jobs, setJobs] = useState<DiscoveryJob[]>([]);
  const [activeProgress, setActiveProgress] = useState<Record<number, DiscoveryProgress>>({});
  
  // New Scan Form
  const [activeStep, setActiveStep] = useState(0);
  const [credentials, setCredentials] = useState<CredentialSet[]>([
    { username: '', password: '', name: '' }
  ]);
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});
  const [saveCredentials, setSaveCredentials] = useState(true);
  const [scanMode, setScanMode] = useState<'preset' | 'custom'>('preset');
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [customSubnets, setCustomSubnets] = useState('');
  const [jobName, setJobName] = useState('');
  
  // Results Dialog
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<DiscoveryJob | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [autoCluster, setAutoCluster] = useState(true);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([]);
  
  // Computed
  const hasRunningJobs = jobs.some(j => j.status === 'running' || j.status === 'pending');
  const hasValidCredentials = credentials.some(c => c.username.trim() && c.password.trim());
  const hasValidTarget = scanMode === 'preset' ? !!selectedPreset : !!customSubnets.trim();
  const canStartScan = hasValidCredentials && hasValidTarget && !loading;
  
  // ─────────────────────────────────────────────────────────────────────────
  // Effects
  // ─────────────────────────────────────────────────────────────────────────
  
  useEffect(() => {
    fetchPresets();
    fetchJobs();
  }, []);
  
  // Auto-refresh when jobs are running
  useEffect(() => {
    if (!hasRunningJobs) return;
    const interval = setInterval(fetchJobs, 2000);
    return () => clearInterval(interval);
  }, [hasRunningJobs]);
  
  // WebSocket for real-time updates
  useEffect(() => {
    if (!token) return;
    
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:8000/api/v1/ws/devices?token=${token}`;
    
    let ws: WebSocket | null = null;
    
    try {
      ws = new WebSocket(wsUrl);
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'discovery_progress') {
            setActiveProgress(prev => ({ ...prev, [data.job_id]: data }));
            setJobs(prev => prev.map(job =>
              job.id === data.job_id
                ? { ...job, scanned_ips: data.scanned_ips, found_devices: data.found_devices,
                    status: data.status === 'completed' ? 'completed' : data.status === 'running' ? 'running' : job.status }
                : job
            ));
          }
          
          if (data.type === 'discovery_import_complete') {
            setSuccess(`Successfully imported ${data.imported} devices`);
            fetchJobs();
          }
        } catch (e) { /* ignore */ }
      };
    } catch (e) { /* fallback to polling */ }
    
    return () => ws?.close();
  }, [token]);
  
  // ─────────────────────────────────────────────────────────────────────────
  // API Functions
  // ─────────────────────────────────────────────────────────────────────────
  
  const fetchPresets = async () => {
    try {
      const response = await api.get('/discovery/presets');
      setPresets(response.data);
    } catch (err) {
      console.error('Failed to fetch presets:', err);
    }
  };
  
  const fetchJobs = async () => {
    try {
      const response = await api.get('/discovery/jobs');
      setJobs(response.data);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    }
  };
  
  const startScan = async () => {
    setLoading(true);
    setError(null);
    
    const validCredentials = credentials.filter(c => c.username.trim() && c.password.trim());
    
    try {
      const payload: any = {
        credentials: validCredentials.map(c => ({
          username: c.username.trim(),
          password: c.password,
          name: c.name.trim() || c.username.trim(),
        })),
        save_credentials: saveCredentials,
      };
      
      if (scanMode === 'preset') {
        payload.preset = selectedPreset;
      } else {
        payload.subnets = customSubnets.split('\n').map(s => s.trim()).filter(s => s);
      }
      
      if (jobName.trim()) {
        payload.name = jobName.trim();
      }
      
      const response = await api.post('/discovery/scan', payload);
      setSuccess(`Discovery scan started (Job #${response.data.id})`);
      setJobs(prev => [response.data, ...prev]);
      setActiveTab(1); // Switch to history tab
      
      // Reset form partially
      setSelectedPreset('');
      setCustomSubnets('');
      setJobName('');
      setActiveStep(0);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to start scan');
    } finally {
      setLoading(false);
    }
  };
  
  const viewJobDetails = async (job: DiscoveryJob) => {
    setSelectedJob(job);
    setDetailsOpen(true);
    setLoadingDevices(true);
    setSelectedDeviceIds([]);
    
    try {
      const response = await api.get(`/discovery/jobs/${job.id}/devices`, {
        params: { only_f5: true },
      });
      setDiscoveredDevices(response.data);
    } catch (err) {
      setDiscoveredDevices([]);
    } finally {
      setLoadingDevices(false);
    }
  };
  
  const importDevices = async () => {
    if (!selectedJob) return;
    setLoading(true);
    
    try {
      const payload: any = { auto_cluster: autoCluster };
      if (selectedDeviceIds.length > 0) {
        payload.device_ids = selectedDeviceIds;
      }
      
      const response = await api.post(`/discovery/jobs/${selectedJob.id}/import`, payload);
      setSuccess(response.data.message);
      setDetailsOpen(false);
      fetchJobs();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Import failed');
    } finally {
      setLoading(false);
    }
  };
  
  const deleteJob = async (jobId: number) => {
    if (!window.confirm('Delete this discovery job and all its results?')) return;
    
    try {
      await api.delete(`/discovery/jobs/${jobId}`);
      setJobs(prev => prev.filter(j => j.id !== jobId));
      setSuccess('Job deleted');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete job');
    }
  };
  
  // ─────────────────────────────────────────────────────────────────────────
  // Render Helpers
  // ─────────────────────────────────────────────────────────────────────────
  
  const renderCredentialsStep = () => (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Enter F5 device credentials. Multiple credential sets can be added for environments with different admin accounts.
      </Typography>
      
      <Stack spacing={2}>
        {credentials.map((cred, index) => (
          <Paper key={index} variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Credential Set {index + 1}
              </Typography>
              {credentials.length > 1 && (
                <IconButton
                  size="small"
                  onClick={() => setCredentials(prev => prev.filter((_, i) => i !== index))}
                >
                  <RemoveIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Username"
                  placeholder="admin"
                  value={cred.username}
                  onChange={(e) => {
                    const newCreds = [...credentials];
                    newCreds[index].username = e.target.value;
                    setCredentials(newCreds);
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Password"
                  type={showPasswords[index] ? 'text' : 'password'}
                  value={cred.password}
                  onChange={(e) => {
                    const newCreds = [...credentials];
                    newCreds[index].password = e.target.value;
                    setCredentials(newCreds);
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          edge="end"
                          onClick={() => setShowPasswords(prev => ({ ...prev, [index]: !prev[index] }))}
                        >
                          {showPasswords[index] ? <VisibilityOffIcon fontSize="small" /> : <ViewIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Label (optional)"
                  placeholder="e.g., DC01 Admin"
                  value={cred.name}
                  onChange={(e) => {
                    const newCreds = [...credentials];
                    newCreds[index].name = e.target.value;
                    setCredentials(newCreds);
                  }}
                />
              </Grid>
            </Grid>
          </Paper>
        ))}
      </Stack>
      
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setCredentials(prev => [...prev, { username: '', password: '', name: '' }])}
        >
          Add Credential Set
        </Button>
        
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={saveCredentials}
              onChange={(e) => setSaveCredentials(e.target.checked)}
            />
          }
          label={<Typography variant="body2">Save credentials for imported devices</Typography>}
        />
      </Box>
    </Box>
  );
  
  const renderTargetStep = () => (
    <Box>
      <Box sx={{ mb: 3 }}>
        <FormControl component="fieldset">
          <Tabs
            value={scanMode}
            onChange={(_, v) => setScanMode(v)}
            sx={{ mb: 2 }}
          >
            <Tab value="preset" label="Use Preset" icon={<StorageIcon />} iconPosition="start" />
            <Tab value="custom" label="Custom Range" icon={<NetworkIcon />} iconPosition="start" />
          </Tabs>
        </FormControl>
      </Box>
      
      {scanMode === 'preset' ? (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select a predefined network range to scan for F5 devices.
          </Typography>
          
          <FormControl fullWidth size="small">
            <InputLabel>Select Preset</InputLabel>
            <Select
              value={selectedPreset}
              label="Select Preset"
              onChange={(e) => setSelectedPreset(e.target.value)}
            >
              {presets.map((preset) => (
                <MenuItem key={preset.key} value={preset.key}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <span>{preset.label}</span>
                    <Chip size="small" label={`${preset.total_ips} IPs`} sx={{ ml: 2 }} />
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {selectedPreset && (
            <Paper variant="outlined" sx={{ mt: 2, p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="caption" color="text.secondary">Subnets to scan:</Typography>
              <Typography variant="body2" fontFamily="monospace" sx={{ mt: 0.5 }}>
                {presets.find(p => p.key === selectedPreset)?.subnets.join(', ')}
              </Typography>
            </Paper>
          )}
        </Box>
      ) : (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter IP addresses, ranges, or CIDR notation (one per line).
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={5}
            placeholder={`Examples:\n10.10.0.0/24\n192.168.1.100-192.168.1.200\n10.0.0.1`}
            value={customSubnets}
            onChange={(e) => setCustomSubnets(e.target.value)}
            sx={{ fontFamily: 'monospace' }}
          />
        </Box>
      )}
      
      <TextField
        fullWidth
        size="small"
        label="Job Name (optional)"
        placeholder="e.g., Q4 Infrastructure Audit"
        value={jobName}
        onChange={(e) => setJobName(e.target.value)}
        sx={{ mt: 3 }}
      />
    </Box>
  );
  
  const renderNewScanTab = () => (
    <Box sx={{ p: 3 }}>
      <Stepper activeStep={activeStep} orientation="vertical">
        <Step>
          <StepLabel
            optional={
              hasValidCredentials && (
                <Typography variant="caption" color="success.main">
                  ✓ {credentials.filter(c => c.username && c.password).length} credential set(s) configured
                </Typography>
              )
            }
          >
            <Typography variant="subtitle1">Authentication</Typography>
          </StepLabel>
          <StepContent>
            {renderCredentialsStep()}
            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                onClick={() => setActiveStep(1)}
                disabled={!hasValidCredentials}
              >
                Continue
              </Button>
            </Box>
          </StepContent>
        </Step>
        
        <Step>
          <StepLabel
            optional={
              hasValidTarget && (
                <Typography variant="caption" color="success.main">
                  ✓ {scanMode === 'preset' 
                    ? presets.find(p => p.key === selectedPreset)?.label 
                    : `${customSubnets.split('\n').filter(s => s.trim()).length} custom range(s)`}
                </Typography>
              )
            }
          >
            <Typography variant="subtitle1">Target Selection</Typography>
          </StepLabel>
          <StepContent>
            {renderTargetStep()}
            <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
              <Button onClick={() => setActiveStep(0)}>
                Back
              </Button>
              <Button
                variant="contained"
                onClick={() => setActiveStep(2)}
                disabled={!hasValidTarget}
              >
                Continue
              </Button>
            </Box>
          </StepContent>
        </Step>
        
        <Step>
          <StepLabel>
            <Typography variant="subtitle1">Review & Start</Typography>
          </StepLabel>
          <StepContent>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Credentials</Typography>
                  <Typography variant="body2">
                    {credentials.filter(c => c.username && c.password).length} credential set(s)
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Target</Typography>
                  <Typography variant="body2">
                    {scanMode === 'preset' 
                      ? presets.find(p => p.key === selectedPreset)?.label 
                      : `${customSubnets.split('\n').filter(s => s.trim()).length} custom range(s)`}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">IPs to Scan</Typography>
                  <Typography variant="body2">
                    {scanMode === 'preset' 
                      ? presets.find(p => p.key === selectedPreset)?.total_ips || '—'
                      : 'Calculated on start'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Save Credentials</Typography>
                  <Typography variant="body2">{saveCredentials ? 'Yes' : 'No'}</Typography>
                </Grid>
              </Grid>
            </Paper>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button onClick={() => setActiveStep(1)}>
                Back
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <StartIcon />}
                onClick={startScan}
                disabled={!canStartScan}
                size="large"
              >
                {loading ? 'Starting Scan...' : 'Start Discovery'}
              </Button>
            </Box>
          </StepContent>
        </Step>
      </Stepper>
    </Box>
  );
  
  const renderHistoryTab = () => (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon fontSize="small" />
          Recent Discovery Jobs
          {hasRunningJobs && <CircularProgress size={16} thickness={5} />}
        </Typography>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={fetchJobs}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      
      {jobs.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <SearchIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">
            No discovery jobs yet. Start a new scan to discover F5 devices.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell>Job Name</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">Progress</TableCell>
                <TableCell align="right">Found</TableCell>
                <TableCell align="right">Created</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map((job) => {
                const StatusIcon = STATUS_CONFIG[job.status].icon;
                const isActive = job.status === 'running' || job.status === 'pending';
                const percent = job.total_ips > 0 ? (job.scanned_ips / job.total_ips) * 100 : 0;
                
                return (
                  <TableRow key={job.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>{job.name}</Typography>
                        <Typography variant="caption" color="text.secondary">ID: {job.id}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        icon={<StatusIcon sx={{ fontSize: 16 }} />}
                        label={STATUS_CONFIG[job.status].label}
                        color={STATUS_CONFIG[job.status].color}
                        size="small"
                        sx={{ minWidth: 100 }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ minWidth: 150 }}>
                      {isActive ? (
                        <Box>
                          <LinearProgress
                            variant={job.status === 'pending' ? 'indeterminate' : 'determinate'}
                            value={percent}
                            sx={{ height: 6, borderRadius: 3, mb: 0.5 }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {job.scanned_ips} / {job.total_ips}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2">{job.scanned_ips} / {job.total_ips}</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={500} color={job.found_devices > 0 ? 'success.main' : 'text.secondary'}>
                        {job.found_devices}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="caption" color="text.secondary">
                        {new Date(job.created_at).toLocaleDateString()}<br />
                        {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        {job.status === 'completed' && job.found_devices > 0 && (
                          <Tooltip title="View Results">
                            <IconButton size="small" color="primary" onClick={() => viewJobDetails(job)}>
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {['completed', 'failed', 'cancelled'].includes(job.status) && (
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => deleteJob(job.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
  
  const renderResultsDialog = () => {
    const pendingDevices = discoveredDevices.filter(d => d.status === 'pending');
    const duplicateDevices = discoveredDevices.filter(d => d.status === 'duplicate');
    const importedDevices = discoveredDevices.filter(d => d.status === 'imported');
    
    return (
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="h6">Discovery Results</Typography>
              <Typography variant="body2" color="text.secondary">{selectedJob?.name}</Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Chip icon={<SuccessIcon />} label={`${pendingDevices.length} Ready`} color="info" size="small" />
              <Chip label={`${duplicateDevices.length} Duplicates`} color="warning" size="small" />
              <Chip label={`${importedDevices.length} Imported`} color="success" size="small" />
            </Stack>
          </Box>
        </DialogTitle>
        
        <DialogContent dividers>
          {loadingDevices ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
              <CircularProgress />
            </Box>
          ) : discoveredDevices.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <SearchIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">No F5 Devices Found</Typography>
              <Typography variant="body2" color="text.secondary">
                The scan completed but no F5 devices were discovered in the target range.
              </Typography>
            </Box>
          ) : (
            <Box>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <FormControlLabel
                  control={<Checkbox checked={autoCluster} onChange={(e) => setAutoCluster(e.target.checked)} />}
                  label="Auto-assign clusters after import"
                />
                {selectedDeviceIds.length > 0 && (
                  <Chip
                    label={`${selectedDeviceIds.length} selected`}
                    color="primary"
                    size="small"
                    onDelete={() => setSelectedDeviceIds([])}
                  />
                )}
              </Box>
              
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={selectedDeviceIds.length > 0 && selectedDeviceIds.length < pendingDevices.length}
                          checked={selectedDeviceIds.length > 0 && selectedDeviceIds.length === pendingDevices.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDeviceIds(pendingDevices.map(d => d.id));
                            } else {
                              setSelectedDeviceIds([]);
                            }
                          }}
                          disabled={pendingDevices.length === 0}
                        />
                      </TableCell>
                      <TableCell>IP Address</TableCell>
                      <TableCell>Hostname</TableCell>
                      <TableCell>Version</TableCell>
                      <TableCell>HA State</TableCell>
                      <TableCell>Site</TableCell>
                      <TableCell align="center">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {discoveredDevices.map((device) => (
                      <TableRow
                        key={device.id}
                        hover
                        selected={selectedDeviceIds.includes(device.id)}
                        sx={{ opacity: device.status === 'duplicate' ? 0.6 : 1 }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedDeviceIds.includes(device.id)}
                            onChange={() => {
                              setSelectedDeviceIds(prev =>
                                prev.includes(device.id)
                                  ? prev.filter(id => id !== device.id)
                                  : [...prev, device.id]
                              );
                            }}
                            disabled={device.status !== 'pending'}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">{device.ip_address}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                            {device.hostname || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>{device.version || '—'}</TableCell>
                        <TableCell>
                          {device.ha_state && (
                            <Chip
                              label={device.ha_state}
                              size="small"
                              color={device.ha_state === 'ACTIVE' ? 'success' : 'default'}
                              variant="outlined"
                            />
                          )}
                        </TableCell>
                        <TableCell>{device.suggested_site || '—'}</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={DEVICE_STATUS_CONFIG[device.status].label}
                            color={DEVICE_STATUS_CONFIG[device.status].color}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<ImportIcon />}
            onClick={importDevices}
            disabled={loading || pendingDevices.length === 0}
          >
            {selectedDeviceIds.length > 0 ? `Import ${selectedDeviceIds.length} Selected` : `Import All (${pendingDevices.length})`}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };
  
  // ─────────────────────────────────────────────────────────────────────────
  // Main Render
  // ─────────────────────────────────────────────────────────────────────────
  
  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <RadarIcon sx={{ fontSize: 36 }} color="primary" />
          Network Discovery
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Scan network ranges to automatically discover and import F5 BIG-IP devices into inventory.
        </Typography>
      </Box>
      
      {/* Alerts */}
      <Collapse in={!!error}>
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      </Collapse>
      
      <Collapse in={!!success}>
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      </Collapse>
      
      {/* Main Content */}
      <Paper variant="outlined">
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab
            label="New Scan"
            icon={<SearchIcon />}
            iconPosition="start"
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                History
                {jobs.length > 0 && (
                  <Chip size="small" label={jobs.length} sx={{ height: 20, fontSize: 11 }} />
                )}
              </Box>
            }
            icon={<HistoryIcon />}
            iconPosition="start"
          />
        </Tabs>
        
        {activeTab === 0 && renderNewScanTab()}
        {activeTab === 1 && renderHistoryTab()}
      </Paper>
      
      {/* Results Dialog */}
      {renderResultsDialog()}
    </Box>
  );
}
