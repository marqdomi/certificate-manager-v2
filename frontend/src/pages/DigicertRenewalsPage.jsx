// frontend/src/pages/DigicertRenewalsPage.jsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Tooltip,
  Divider,
  Tabs,
  Tab,
  FormControlLabel,
  Switch,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CancelIcon from '@mui/icons-material/Cancel';
import ReplayIcon from '@mui/icons-material/Replay';

import {
  listRenewals,
  getRenewal,
  getAudit,
  deployRenewal,
  retryDeployRenewal,
  cancelRenewal,
  retryRenewal,
  getHealth,
  statusColor,
  statusLabel,
  isActive,
} from '../api/digicert';

export default function DigicertRenewalsPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeOnly, setActiveOnly] = useState(false);
  const [health, setHealth] = useState(null);

  const [detailOrderId, setDetailOrderId] = useState(null);
  const [cancelDialog, setCancelDialog] = useState({ open: false, orderId: null, reason: '' });

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listRenewals({ active_only: activeOnly, limit: 200 });
      setOrders(data);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  const fetchHealth = useCallback(async () => {
    try {
      const h = await getHealth();
      setHealth(h);
    } catch {
      setHealth(null);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchHealth();
  }, [fetchOrders, fetchHealth]);

  // Auto-refresh cada 10s si hay órdenes activas
  useEffect(() => {
    const hasActive = orders.some((o) => isActive(o.status));
    if (!hasActive) return;
    const id = setInterval(fetchOrders, 10000);
    return () => clearInterval(id);
  }, [orders, fetchOrders]);

  const handleDeploy = async (orderId) => {
    try {
      await deployRenewal(orderId);
      await fetchOrders();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const handleRetryDeploy = async (orderId) => {
    try {
      await retryDeployRenewal(orderId);
      await fetchOrders();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const handleRetrySubmit = async (orderId) => {
    try {
      await retryRenewal(orderId);
      await fetchOrders();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const handleCancelConfirm = async () => {
    try {
      await cancelRenewal(cancelDialog.orderId, cancelDialog.reason);
      setCancelDialog({ open: false, orderId: null, reason: '' });
      await fetchOrders();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" sx={{ flex: 1, fontWeight: 'bold' }}>
          DigiCert Renewals
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              size="small"
            />
          }
          label="Active only"
          sx={{ mr: 1 }}
        />
        <IconButton onClick={fetchOrders} disabled={loading}>
          <RefreshIcon />
        </IconButton>
      </Box>

      {health && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <StatBlock label="Feature" value={health.feature_enabled ? 'Enabled' : 'Disabled'} />
            <StatBlock
              label="DigiCert API"
              value={health.digicert_api}
              color={
                health.digicert_api === 'ok'
                  ? 'success'
                  : health.digicert_api === 'disabled'
                  ? 'default'
                  : 'warning'
              }
            />
            <StatBlock label="Active orders" value={health.active_orders} />
            <StatBlock
              label="Stuck (>24h)"
              value={health.stuck_orders}
              color={health.stuck_orders > 0 ? 'error' : 'default'}
            />
          </Box>
        </Paper>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper>
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Common Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>DigiCert Order</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Created by</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No DigiCert renewal orders found.
                  </TableCell>
                </TableRow>
              )}
              {orders.map((o) => {
                const canDeploy = ['ISSUED', 'DOWNLOADED'].includes(o.status);
                const canRetryDeploy = ['PARTIAL_DEPLOY', 'FAILED'].includes(o.status) && !!o.digicert_order_id;
                const canRetrySubmit = o.status === 'FAILED' && !o.digicert_order_id;
                const canCancel = isActive(o.status) && o.status !== 'DEPLOYING';

                return (
                  <TableRow key={o.id} hover>
                    <TableCell>#{o.id}</TableCell>
                    <TableCell>{o.common_name}</TableCell>
                    <TableCell>
                      <Chip
                        label={statusLabel(o.status)}
                        color={statusColor(o.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{o.digicert_order_id || '—'}</TableCell>
                    <TableCell>{fmtDate(o.created_at)}</TableCell>
                    <TableCell>{o.created_by || '—'}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Details">
                        <IconButton size="small" onClick={() => setDetailOrderId(o.id)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {canDeploy && (
                        <Tooltip title="Deploy to F5">
                          <IconButton size="small" color="primary" onClick={() => handleDeploy(o.id)}>
                            <CloudUploadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canRetryDeploy && (
                        <Tooltip title="Retry deploy">
                          <IconButton size="small" onClick={() => handleRetryDeploy(o.id)}>
                            <ReplayIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canRetrySubmit && (
                        <Tooltip title="Retry submit">
                          <IconButton size="small" onClick={() => handleRetrySubmit(o.id)}>
                            <ReplayIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canCancel && (
                        <Tooltip title="Cancel order">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setCancelDialog({ open: true, orderId: o.id, reason: '' })}
                          >
                            <CancelIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Cancel dialog */}
      <Dialog open={cancelDialog.open} onClose={() => setCancelDialog({ ...cancelDialog, open: false })} fullWidth>
        <DialogTitle>Cancel order #{cancelDialog.orderId}</DialogTitle>
        <DialogContent>
          <TextField
            label="Reason (optional)"
            fullWidth
            multiline
            minRows={2}
            value={cancelDialog.reason}
            onChange={(e) => setCancelDialog({ ...cancelDialog, reason: e.target.value })}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialog({ ...cancelDialog, open: false })}>Back</Button>
          <Button color="error" variant="contained" onClick={handleCancelConfirm}>
            Cancel order
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail drawer */}
      {detailOrderId != null && (
        <RenewalDetailDialog orderId={detailOrderId} onClose={() => setDetailOrderId(null)} />
      )}
    </Container>
  );
}

function RenewalDetailDialog({ orderId, onClose }) {
  const [tab, setTab] = useState(0);
  const [order, setOrder] = useState(null);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [o, a] = await Promise.all([getRenewal(orderId), getAudit(orderId)]);
        if (cancelled) return;
        setOrder(o);
        setAudit(a);
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        Renewal order #{orderId}
        {order && (
          <Chip
            label={statusLabel(order.status)}
            color={statusColor(order.status)}
            size="small"
            sx={{ ml: 1 }}
          />
        )}
      </DialogTitle>
      <DialogContent dividers>
        {loading && <CircularProgress />}
        {error && <Alert severity="error">{error}</Alert>}
        {order && (
          <Box>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
              <Tab label="Overview" />
              <Tab label="Deploy results" />
              <Tab label={`Audit (${audit.length})`} />
            </Tabs>

            {tab === 0 && (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
                <InfoRow label="Certificate ID" value={order.certificate_id} />
                <InfoRow label="Common Name" value={order.common_name} />
                <InfoRow label="Product" value={order.product || '—'} />
                <InfoRow label="Validity" value={`${order.validity_years} year(s)`} />
                <InfoRow label="Key size" value={`RSA ${order.key_size}`} />
                <InfoRow label="Container" value={order.container_id || '—'} />
                <InfoRow label="Organization" value={order.organization_id || '—'} />
                <InfoRow label="DigiCert order ID" value={order.digicert_order_id || '—'} />
                <InfoRow label="DigiCert cert ID" value={order.digicert_certificate_id || '—'} />
                <InfoRow label="Serial" value={order.serial_number || '—'} />
                <InfoRow label="Valid from" value={fmtDate(order.valid_from)} />
                <InfoRow label="Valid till" value={fmtDate(order.valid_till)} />
                <InfoRow label="Deployed at" value={fmtDate(order.deployed_at)} />
                <InfoRow
                  label="Private key"
                  value={
                    order.private_key_purged_at
                      ? `Purged at ${fmtDate(order.private_key_purged_at)}`
                      : 'Retained (encrypted)'
                  }
                />
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <InfoRow
                    label="SANs"
                    value={order.san_list?.length ? order.san_list.join(', ') : '(only CN)'}
                  />
                </Box>
                {order.error_message && (
                  <Box sx={{ gridColumn: '1 / -1' }}>
                    <Alert severity="error">{order.error_message}</Alert>
                  </Box>
                )}
              </Box>
            )}

            {tab === 1 && (
              <Box>
                {!order.deploy_results || Object.keys(order.deploy_results).length === 0 ? (
                  <Typography color="text.secondary">No deploy attempts yet.</Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Device</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Timestamp</TableCell>
                        <TableCell>Error</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(order.deploy_results).map(([deviceId, r]) => (
                        <TableRow key={deviceId}>
                          <TableCell>{r.device_hostname || deviceId}</TableCell>
                          <TableCell>
                            <Chip
                              label={r.status}
                              color={r.status === 'success' ? 'success' : 'error'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{fmtDate(r.timestamp)}</TableCell>
                          <TableCell sx={{ maxWidth: 300, wordBreak: 'break-all' }}>
                            {r.error || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Box>
            )}

            {tab === 2 && (
              <Box>
                {audit.length === 0 ? (
                  <Typography color="text.secondary">No audit entries.</Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>When</TableCell>
                        <TableCell>Event</TableCell>
                        <TableCell>User</TableCell>
                        <TableCell>Metadata</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {audit.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>{fmtDate(e.created_at)}</TableCell>
                          <TableCell>
                            <code>{e.event_type}</code>
                          </TableCell>
                          <TableCell>{e.username || '—'}</TableCell>
                          <TableCell sx={{ maxWidth: 400 }}>
                            <pre
                              style={{
                                margin: 0,
                                fontSize: 11,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                              }}
                            >
                              {e.event_metadata ? JSON.stringify(e.event_metadata, null, 2) : '—'}
                            </pre>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function InfoRow({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-all' }}>
        {value ?? '—'}
      </Typography>
    </Box>
  );
}

function StatBlock({ label, value, color = 'default' }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Box>
        <Chip label={String(value)} color={color} size="small" />
      </Box>
    </Box>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function errMsg(e) {
  return e?.response?.data?.detail || e?.message || 'Unexpected error';
}
