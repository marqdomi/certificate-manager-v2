/**
 * BatchRenewalPage - CMT v2.5
 * 
 * Page for managing batch renewal of wildcard certificates
 * across multiple devices.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert,
  Card,
  CardContent,
  Stack,
  Checkbox,
  FormControlLabel,
  Grid,
  CircularProgress,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  RocketLaunch as DeployIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as PendingIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { fetchWildcardGroups, fetchWildcardDetails, startBatchDeploy, fetchBatchDeployStatus } from '../api/batch';
import type { WildcardGroup, WildcardInstance, BatchDeployResponse, BatchDeployStatus } from '../types/batch';

// Days until expiration to show warning
const EXPIRY_WARNING_DAYS = 30;

const getExpiryColor = (dateStr: string | null): 'error' | 'warning' | 'success' | 'default' => {
  if (!dateStr) return 'default';
  const days = Math.floor((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'error';
  if (days < EXPIRY_WARNING_DAYS) return 'warning';
  return 'success';
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
};

const getDaysUntilExpiry = (dateStr: string | null): string => {
  if (!dateStr) return '—';
  const days = Math.floor((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  return `${days}d`;
};

interface WildcardRowProps {
  group: WildcardGroup;
  onExpand: () => void;
  expanded: boolean;
  onDeploy: () => void;
}

const WildcardRow: React.FC<WildcardRowProps> = ({ group, onExpand, expanded, onDeploy }) => {
  const expiryColor = getExpiryColor(group.earliest_expiration);
  
  return (
    <>
      <TableRow hover sx={{ '& > *': { borderBottom: expanded ? 'none' : undefined } }}>
        <TableCell>
          <IconButton size="small" onClick={onExpand}>
            {expanded ? <CollapseIcon /> : <ExpandIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight="medium">
            {group.common_name}
          </Typography>
        </TableCell>
        <TableCell align="center">
          <Chip label={group.device_count} size="small" variant="outlined" />
        </TableCell>
        <TableCell>
          <Chip
            label={getDaysUntilExpiry(group.earliest_expiration)}
            color={expiryColor}
            size="small"
          />
        </TableCell>
        <TableCell>
          {formatDate(group.earliest_expiration)}
        </TableCell>
        <TableCell align="right">
          <Tooltip title="Batch Deploy">
            <IconButton color="primary" onClick={onDeploy}>
              <DeployIcon />
            </IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6} sx={{ py: 0, bgcolor: 'action.hover' }}>
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Deployed on {group.device_count} devices:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {group.devices.map((d) => (
                  <Chip
                    key={d.cert_id}
                    label={`${d.hostname} (${getDaysUntilExpiry(d.expiration)})`}
                    size="small"
                    color={getExpiryColor(d.expiration)}
                    variant="outlined"
                  />
                ))}
              </Stack>
            </Box>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

// Batch Deploy Dialog
interface BatchDeployDialogProps {
  open: boolean;
  onClose: () => void;
  wildcardName: string;
  devices: Array<{ id: number; hostname: string; cert_id: number; expiration: string | null }>;
}

const BatchDeployDialog: React.FC<BatchDeployDialogProps> = ({
  open,
  onClose,
  wildcardName,
  devices,
}) => {
  const [selectedDevices, setSelectedDevices] = useState<number[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<BatchDeployResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // Select all devices by default
      setSelectedDevices(devices.map(d => d.id));
      setDeployResult(null);
      setError(null);
    }
  }, [open, devices]);

  const handleToggleDevice = (deviceId: number) => {
    setSelectedDevices(prev =>
      prev.includes(deviceId)
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const handleSelectAll = () => {
    if (selectedDevices.length === devices.length) {
      setSelectedDevices([]);
    } else {
      setSelectedDevices(devices.map(d => d.id));
    }
  };

  const handleDeploy = async () => {
    if (selectedDevices.length === 0) return;
    
    setDeploying(true);
    setError(null);
    
    try {
      // For now, use the first selected device's cert as source
      const sourceCertId = devices.find(d => selectedDevices.includes(d.id))?.cert_id;
      if (!sourceCertId) throw new Error('No source certificate found');
      
      const result = await startBatchDeploy({
        source_cert_id: sourceCertId,
        target_device_ids: selectedDevices,
      });
      
      setDeployResult(result);
      
      // Poll for completion
      if (result.status === 'in_progress') {
        const pollInterval = setInterval(async () => {
          const status = await fetchBatchDeployStatus(result.batch_id);
          setDeployResult(status);
          if (status.status !== 'in_progress') {
            clearInterval(pollInterval);
          }
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setDeploying(false);
    }
  };

  const getStatusIcon = (status: BatchDeployStatus) => {
    switch (status) {
      case 'success': return <SuccessIcon color="success" />;
      case 'failed': return <ErrorIcon color="error" />;
      case 'partial': return <WarningIcon color="warning" />;
      case 'in_progress': return <CircularProgress size={20} />;
      default: return <PendingIcon color="disabled" />;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Batch Deploy: {wildcardName}
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        {!deployResult ? (
          <>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Select devices to deploy the renewed certificate to:
            </Typography>
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={selectedDevices.length === devices.length}
                  indeterminate={selectedDevices.length > 0 && selectedDevices.length < devices.length}
                  onChange={handleSelectAll}
                />
              }
              label="Select All"
            />
            
            <Paper variant="outlined" sx={{ mt: 1, maxHeight: 300, overflow: 'auto' }}>
              {devices.map((device) => (
                <Box
                  key={device.id}
                  sx={{
                    p: 1.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedDevices.includes(device.id)}
                        onChange={() => handleToggleDevice(device.id)}
                      />
                    }
                    label={device.hostname}
                  />
                  <Chip
                    label={getDaysUntilExpiry(device.expiration)}
                    size="small"
                    color={getExpiryColor(device.expiration)}
                  />
                </Box>
              ))}
            </Paper>
            
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {selectedDevices.length} of {devices.length} devices selected
            </Typography>
          </>
        ) : (
          <Box>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              {getStatusIcon(deployResult.status)}
              <Typography variant="h6">
                {deployResult.status === 'in_progress' ? 'Deploying...' : 
                 deployResult.status === 'success' ? 'Deployment Complete' :
                 deployResult.status === 'partial' ? 'Partial Success' : 'Deployment Failed'}
              </Typography>
            </Box>
            
            {deployResult.status === 'in_progress' && (
              <LinearProgress 
                variant="determinate" 
                value={(deployResult.completed / deployResult.total_devices) * 100}
                sx={{ mb: 2 }}
              />
            )}
            
            <Typography variant="body2" gutterBottom>
              {deployResult.completed} of {deployResult.total_devices} devices completed
              {deployResult.failed > 0 && `, ${deployResult.failed} failed`}
            </Typography>
            
            <Paper variant="outlined" sx={{ mt: 2, maxHeight: 250, overflow: 'auto' }}>
              {deployResult.results.map((result) => (
                <Box
                  key={result.device_id}
                  sx={{
                    p: 1.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  {getStatusIcon(result.status)}
                  <Box flex={1}>
                    <Typography variant="body2">{result.hostname}</Typography>
                    {result.message && (
                      <Typography variant="caption" color="text.secondary">
                        {result.message}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Paper>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {deployResult ? 'Close' : 'Cancel'}
        </Button>
        {!deployResult && (
          <Button
            variant="contained"
            onClick={handleDeploy}
            disabled={deploying || selectedDevices.length === 0}
            startIcon={deploying ? <CircularProgress size={20} /> : <DeployIcon />}
          >
            Deploy to {selectedDevices.length} Devices
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

// Main Page Component
const BatchRenewalPage: React.FC = () => {
  const [groups, setGroups] = useState<WildcardGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [deployDialog, setDeployDialog] = useState<{
    open: boolean;
    wildcardName: string;
    devices: WildcardGroup['devices'];
  }>({ open: false, wildcardName: '', devices: [] });

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWildcardGroups(2);
      setGroups(response.groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wildcards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const handleExpand = (name: string) => {
    setExpandedGroup(prev => prev === name ? null : name);
  };

  const handleDeploy = (group: WildcardGroup) => {
    setDeployDialog({
      open: true,
      wildcardName: group.common_name,
      devices: group.devices,
    });
  };

  const urgentCount = groups.filter(g => {
    if (!g.earliest_expiration) return false;
    const days = Math.floor((new Date(g.earliest_expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days < EXPIRY_WARNING_DAYS;
  }).length;

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Batch Renewal
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage wildcard certificates deployed across multiple F5 devices.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadGroups}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="h3" fontWeight="bold" color="primary.main">
                {groups.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Wildcard Certificates
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="h3" fontWeight="bold" color="warning.main">
                {urgentCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Expiring Soon (&lt; 30 days)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="h3" fontWeight="bold">
                {groups.reduce((sum, g) => sum + g.device_count, 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Deployments
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Error */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width={50}></TableCell>
                <TableCell>Wildcard Certificate</TableCell>
                <TableCell align="center">Devices</TableCell>
                <TableCell>Time Left</TableCell>
                <TableCell>Earliest Expiry</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No wildcard certificates found on multiple devices.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => (
                  <WildcardRow
                    key={group.common_name}
                    group={group}
                    expanded={expandedGroup === group.common_name}
                    onExpand={() => handleExpand(group.common_name)}
                    onDeploy={() => handleDeploy(group)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Deploy Dialog */}
      <BatchDeployDialog
        open={deployDialog.open}
        onClose={() => setDeployDialog({ ...deployDialog, open: false })}
        wildcardName={deployDialog.wildcardName}
        devices={deployDialog.devices}
      />
    </Container>
  );
};

export default BatchRenewalPage;
