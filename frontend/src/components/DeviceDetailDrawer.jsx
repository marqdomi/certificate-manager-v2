// frontend/src/components/DeviceDetailDrawer.jsx
import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Chip,
  Grid,
  Tooltip,
  Button,
  Stack,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import SecurityIcon from '@mui/icons-material/Security';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

// Helper component for info rows
const InfoRow = ({ label, value, copyable = false, onCopy }) => (
  <Box sx={{ mb: 1.5 }}>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
      {label}
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-all' }}>
        {value || '—'}
      </Typography>
      {copyable && value && (
        <Tooltip title="Copy to clipboard">
          <IconButton size="small" onClick={() => onCopy(value)}>
            <ContentCopyIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  </Box>
);

// Status chip with appropriate color
const StatusChip = ({ label, status, colorMap }) => {
  const color = colorMap?.[status] || 'default';
  return <Chip label={label || '—'} color={color} size="small" sx={{ fontWeight: 600 }} />;
};

const DeviceDetailDrawer = ({
  open,
  onClose,
  device,
  onSetCredentials,
  onEdit,
  onRefreshFacts,
  onScan,
}) => {
  if (!device) return null;

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
  };

  // Format dates nicely
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = dayjs(dateStr);
    return d.isValid() ? `${d.format('YYYY-MM-DD HH:mm')} (${d.fromNow()})` : '—';
  };

  // HA state color mapping
  const haColorMap = {
    ACTIVE: 'success',
    STANDBY: 'default',
    OFFLINE: 'error',
  };

  // Sync color mapping
  const syncColorMap = {
    green: 'success',
    yellow: 'warning',
    red: 'error',
  };

  // Scan status color mapping
  const scanColorMap = {
    success: 'success',
    failed: 'error',
    running: 'info',
    pending: 'default',
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 420 },
          p: 0,
          top: 64, // Height of the AppBar
          height: 'calc(100% - 64px)',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor: 'background.default',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            {device.is_primary_preferred && (
              <Tooltip title="Primary device for cluster operations">
                <StarIcon sx={{ color: 'warning.main', fontSize: 20 }} />
              </Tooltip>
            )}
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {device.hostname}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {device.ip_address}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Action buttons */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => onScan?.(device)}
          >
            Scan
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<SecurityIcon />}
            onClick={() => onSetCredentials?.(device)}
          >
            Credentials
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => onEdit?.(device)}
          >
            Edit
          </Button>
        </Stack>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
        {/* Status Section */}
        <Typography variant="subtitle2" color="primary" sx={{ mb: 1.5, fontWeight: 600 }}>
          STATUS
        </Typography>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={4}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              HA State
            </Typography>
            <StatusChip
              label={device.ha_state || 'Unknown'}
              status={device.ha_state}
              colorMap={haColorMap}
            />
          </Grid>
          <Grid item xs={4}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Sync Status
            </Typography>
            <StatusChip
              label={device.sync_status || 'Unknown'}
              status={device.last_sync_color}
              colorMap={syncColorMap}
            />
          </Grid>
          <Grid item xs={4}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Last Scan
            </Typography>
            <StatusChip
              label={device.last_scan_status || 'Pending'}
              status={device.last_scan_status}
              colorMap={scanColorMap}
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* Device Info Section */}
        <Typography variant="subtitle2" color="primary" sx={{ mb: 1.5, fontWeight: 600 }}>
          DEVICE INFO
        </Typography>
        <InfoRow label="Hostname" value={device.hostname} copyable onCopy={handleCopy} />
        <InfoRow label="IP Address" value={device.ip_address} copyable onCopy={handleCopy} />
        <InfoRow label="Site" value={device.site} />
        <InfoRow label="Version" value={device.version} />
        <InfoRow label="Platform" value={device.platform} />
        <InfoRow label="Serial Number" value={device.serial_number} copyable onCopy={handleCopy} />

        <Divider sx={{ my: 2 }} />

        {/* Cluster Info Section */}
        <Typography variant="subtitle2" color="primary" sx={{ mb: 1.5, fontWeight: 600 }}>
          CLUSTER INFO
        </Typography>
        <InfoRow label="Cluster Key" value={device.cluster_key} />
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Primary Preferred
          </Typography>
          <Chip
            label={device.is_primary_preferred ? 'Yes' : 'No'}
            color={device.is_primary_preferred ? 'warning' : 'default'}
            size="small"
            icon={device.is_primary_preferred ? <StarIcon /> : undefined}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Network Section */}
        <Typography variant="subtitle2" color="primary" sx={{ mb: 1.5, fontWeight: 600 }}>
          NETWORK
        </Typography>
        <InfoRow label="DNS Servers" value={device.dns_servers} />

        <Divider sx={{ my: 2 }} />

        {/* Credentials Section */}
        <Typography variant="subtitle2" color="primary" sx={{ mb: 1.5, fontWeight: 600 }}>
          CREDENTIALS
        </Typography>
        <InfoRow label="Username" value={device.username} />
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Password Status
          </Typography>
          <Chip
            label={device.encrypted_password ? 'Configured' : 'Not Set'}
            color={device.encrypted_password ? 'success' : 'error'}
            size="small"
            variant="outlined"
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Timestamps Section */}
        <Typography variant="subtitle2" color="primary" sx={{ mb: 1.5, fontWeight: 600 }}>
          TIMESTAMPS
        </Typography>
        <InfoRow label="Last Facts Refresh" value={formatDate(device.last_facts_refresh)} />
        <InfoRow label="Last Scan" value={formatDate(device.last_scan_timestamp)} />
        <InfoRow label="Created" value={formatDate(device.created_at)} />
        <InfoRow label="Updated" value={formatDate(device.updated_at)} />

        {/* Scan Message (if error) */}
        {device.last_scan_status === 'failed' && device.last_scan_message && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" color="error" sx={{ mb: 1.5, fontWeight: 600 }}>
              LAST ERROR
            </Typography>
            <Typography
              variant="body2"
              sx={{
                p: 1.5,
                backgroundColor: 'error.light',
                color: 'error.contrastText',
                borderRadius: 1,
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {device.last_scan_message}
            </Typography>
          </>
        )}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          backgroundColor: 'background.default',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Device ID: {device.id} • Active: {device.active ? 'Yes' : 'No'}
        </Typography>
      </Box>
    </Drawer>
  );
};

export default DeviceDetailDrawer;
