/**
 * AuditLogTable Component - CMT v2.5
 * 
 * Displays a paginated, filterable table of audit log entries.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Stack,
  Alert,
  CircularProgress,
  Card,
  CardContent,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { fetchAuditLogs, fetchAuditActions } from '../api/audit';
import type {
  AuditLogEntry,
  AuditLogFilters,
  AuditAction,
  AuditResult,
  AUDIT_ACTION_METADATA,
  RESULT_COLORS,
} from '../types/audit';

// Re-define metadata inline since importing constants can be tricky
const ACTION_METADATA: Record<string, { label: string; color: 'success' | 'error' | 'warning' | 'info' | 'default' }> = {
  cert_deployed: { label: 'Certificate Deployed', color: 'success' },
  cert_renewed: { label: 'Certificate Renewed', color: 'success' },
  cert_deleted: { label: 'Certificate Deleted', color: 'error' },
  cert_uploaded: { label: 'Certificate Uploaded', color: 'info' },
  csr_generated: { label: 'CSR Generated', color: 'info' },
  csr_completed: { label: 'CSR Completed', color: 'success' },
  csr_deleted: { label: 'CSR Deleted', color: 'warning' },
  device_added: { label: 'Device Added', color: 'success' },
  device_modified: { label: 'Device Modified', color: 'info' },
  device_deleted: { label: 'Device Deleted', color: 'error' },
  device_scanned: { label: 'Device Scanned', color: 'info' },
  profile_created: { label: 'Profile Created', color: 'success' },
  profile_modified: { label: 'Profile Modified', color: 'info' },
  profile_deleted: { label: 'Profile Deleted', color: 'error' },
  user_login: { label: 'User Login', color: 'default' },
  user_logout: { label: 'User Logout', color: 'default' },
  user_created: { label: 'User Created', color: 'success' },
  user_modified: { label: 'User Modified', color: 'info' },
};

const RESULT_CHIP_COLORS: Record<string, 'success' | 'error' | 'warning'> = {
  success: 'success',
  failure: 'error',
  partial: 'warning',
};

interface AuditLogTableProps {
  deviceId?: number;
  resourceType?: string;
  resourceId?: number;
  compact?: boolean;
}

const AuditLogTable: React.FC<AuditLogTableProps> = ({
  deviceId,
  resourceType,
  resourceId,
  compact = false,
}) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(compact ? 10 : 25);
  const [total, setTotal] = useState(0);
  
  // Filters
  const [filterAction, setFilterAction] = useState<string>('');
  const [filterResult, setFilterResult] = useState<string>('');
  const [filterUsername, setFilterUsername] = useState<string>('');
  const [availableActions, setAvailableActions] = useState<Array<{ value: string; label: string }>>([]);
  const [showFilters, setShowFilters] = useState(!compact);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const filters: AuditLogFilters = {
        page: page + 1, // API is 1-indexed
        page_size: pageSize,
      };
      
      if (filterAction) filters.action = filterAction as AuditAction;
      if (filterResult) filters.result = filterResult as AuditResult;
      if (filterUsername) filters.username = filterUsername;
      if (deviceId) filters.device_id = deviceId;
      if (resourceType) filters.resource_type = resourceType;
      
      const response = await fetchAuditLogs(filters);
      setLogs(response.logs);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterAction, filterResult, filterUsername, deviceId, resourceType]);

  const loadActions = useCallback(async () => {
    try {
      const response = await fetchAuditActions();
      setAvailableActions(response.actions);
    } catch {
      // Fallback to hardcoded actions
      setAvailableActions(
        Object.entries(ACTION_METADATA).map(([value, meta]) => ({
          value,
          label: meta.label,
        }))
      );
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  const handleClearFilters = () => {
    setFilterAction('');
    setFilterResult('');
    setFilterUsername('');
    setPage(0);
  };

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleString();
  };

  const getActionChip = (action: string) => {
    const meta = ACTION_METADATA[action] || { label: action, color: 'default' as const };
    return (
      <Chip
        label={meta.label}
        color={meta.color}
        size="small"
        variant="outlined"
      />
    );
  };

  const getResultChip = (result: string) => {
    const color = RESULT_CHIP_COLORS[result] || 'default';
    return (
      <Chip
        label={result.toUpperCase()}
        color={color}
        size="small"
      />
    );
  };

  if (compact) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Recent Activity</Typography>
            <IconButton onClick={loadLogs} size="small" disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Box>
          
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          
          {loading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress size={24} />
            </Box>
          ) : logs.length === 0 ? (
            <Typography color="text.secondary" align="center">
              No activity recorded
            </Typography>
          ) : (
            <Stack spacing={1}>
              {logs.slice(0, 5).map((log) => (
                <Box
                  key={log.id}
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      {ACTION_METADATA[log.action]?.label || log.action}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {log.username || 'System'} • {formatTimestamp(log.timestamp)}
                    </Typography>
                  </Box>
                  {getResultChip(log.result)}
                </Box>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Audit Log</Typography>
        <Box>
          <Tooltip title="Toggle Filters">
            <IconButton onClick={() => setShowFilters(!showFilters)}>
              <FilterIcon color={showFilters ? 'primary' : 'inherit'} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton onClick={loadLogs} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Filters */}
      {showFilters && (
        <Box sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Action</InputLabel>
              <Select
                value={filterAction}
                label="Action"
                onChange={(e) => {
                  setFilterAction(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">All Actions</MenuItem>
                {availableActions.map((action) => (
                  <MenuItem key={action.value} value={action.value}>
                    {action.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Result</InputLabel>
              <Select
                value={filterResult}
                label="Result"
                onChange={(e) => {
                  setFilterResult(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">All Results</MenuItem>
                <MenuItem value="success">Success</MenuItem>
                <MenuItem value="failure">Failure</MenuItem>
                <MenuItem value="partial">Partial</MenuItem>
              </Select>
            </FormControl>

            <TextField
              size="small"
              label="Username"
              value={filterUsername}
              onChange={(e) => {
                setFilterUsername(e.target.value);
                setPage(0);
              }}
              sx={{ width: 150 }}
            />

            <IconButton onClick={handleClearFilters} size="small">
              <ClearIcon />
            </IconButton>
          </Stack>
        </Box>
      )}

      {/* Error */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Resource</TableCell>
              <TableCell>Device</TableCell>
              <TableCell>Result</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="text.secondary">No audit logs found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id} hover>
                  <TableCell>
                    <Typography variant="body2">
                      {formatTimestamp(log.timestamp)}
                    </Typography>
                  </TableCell>
                  <TableCell>{log.username || '—'}</TableCell>
                  <TableCell>{getActionChip(log.action)}</TableCell>
                  <TableCell>
                    {log.resource_name ? (
                      <Tooltip title={`${log.resource_type} #${log.resource_id}`}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {log.resource_name}
                        </Typography>
                      </Tooltip>
                    ) : log.resource_type ? (
                      <Typography variant="body2" color="text.secondary">
                        {log.resource_type}
                      </Typography>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {log.device_hostname || '—'}
                  </TableCell>
                  <TableCell>{getResultChip(log.result)}</TableCell>
                  <TableCell>
                    {(log.description || log.error_message) && (
                      <Tooltip title={log.error_message || log.description || ''}>
                        <IconButton size="small">
                          <InfoIcon fontSize="small" color={log.error_message ? 'error' : 'action'} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => {
          setPageSize(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[10, 25, 50, 100]}
      />
    </Paper>
  );
};

export default AuditLogTable;
