// frontend/src/components/CertificateDetailDrawer.jsx
import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Chip,
  Tooltip,
  Button,
  Stack,
  CircularProgress,
  alpha,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SecurityIcon from '@mui/icons-material/Security';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
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

// Usage state configuration
const USAGE_STATE_CONFIG = {
  'active': { label: 'In Use', color: 'success', icon: CheckCircleIcon },
  'in-use': { label: 'In Use', color: 'success', icon: CheckCircleIcon },
  'profiles-no-vips': { label: 'Orphan', color: 'warning', icon: WarningIcon },
  'no-profiles': { label: 'Unused', color: 'default', icon: HelpOutlineIcon },
  'error': { label: 'Error', color: 'error', icon: ErrorIcon },
};

const CertificateDetailDrawer = ({
  open,
  onClose,
  certificate,
  usageState,
  isFavorite,
  onToggleFavorite,
  onRenew,
  onShowUsage,
  onDelete,
  userRole,
}) => {
  if (!certificate) return null;

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
  };

  // Format dates nicely
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = dayjs(dateStr);
    return d.isValid() ? d.format('YYYY-MM-DD') : '—';
  };

  // Get days remaining color
  const getDaysColor = (days) => {
    if (days === null || days === undefined) return 'default';
    if (days <= 0) return 'error';
    if (days <= 30) return 'warning';
    return 'success';
  };

  // Get usage state display
  const effectiveUsageState = usageState || certificate.usage_state;
  const usageConfig = USAGE_STATE_CONFIG[effectiveUsageState] || USAGE_STATE_CONFIG['error'];
  const UsageIcon = usageConfig.icon;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 420 },
          top: 64,
          height: 'calc(100% - 64px)',
        },
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box
          sx={{
            p: 2.5,
            background: (theme) =>
              `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(
                theme.palette.warning.main,
                0.05
              )} 100%)`,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: (theme) => alpha(theme.palette.warning.main, 0.15),
                  color: 'warning.main',
                }}
              >
                <SecurityIcon fontSize="medium" />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
                  {certificate.common_name || certificate.name || 'Certificate'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ID: {certificate.id}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {onToggleFavorite && (
                <Tooltip title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
                  <IconButton onClick={() => onToggleFavorite(certificate.id)} size="small">
                    {isFavorite ? (
                      <StarIcon sx={{ color: 'warning.main' }} />
                    ) : (
                      <StarBorderIcon />
                    )}
                  </IconButton>
                </Tooltip>
              )}
              <IconButton onClick={onClose} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>

          {/* Status Chips */}
          <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
            <Chip
              label={`${certificate.days_remaining ?? '?'} days`}
              color={getDaysColor(certificate.days_remaining)}
              size="small"
              sx={{ fontWeight: 600 }}
            />
            <Chip
              icon={UsageIcon ? <UsageIcon fontSize="small" /> : undefined}
              label={usageConfig.label}
              color={usageConfig.color}
              size="small"
              variant="outlined"
            />
            {certificate.renewal_status === 'CSR_GENERATED' && (
              <Chip label="CSR Generated" color="info" size="small" />
            )}
          </Stack>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
          {/* Certificate Info Section */}
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Certificate Information
          </Typography>
          
          <InfoRow label="Common Name" value={certificate.common_name} copyable onCopy={handleCopy} />
          <InfoRow label="Certificate Name" value={certificate.name} copyable onCopy={handleCopy} />
          <InfoRow label="Expiration Date" value={formatDate(certificate.expiration_date)} />
          <InfoRow 
            label="Days Remaining" 
            value={
              certificate.days_remaining !== null && certificate.days_remaining !== undefined
                ? `${certificate.days_remaining} days`
                : '—'
            } 
          />

          <Divider sx={{ my: 2 }} />

          {/* Device Info Section */}
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            F5 Device
          </Typography>
          
          <InfoRow label="Hostname" value={certificate.f5_device_hostname} copyable onCopy={handleCopy} />
          <InfoRow label="Device ID" value={certificate.device_id} />

          <Divider sx={{ my: 2 }} />

          {/* Usage Info Section */}
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Usage Status
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            {UsageIcon && <UsageIcon color={usageConfig.color} />}
            <Typography variant="body2">
              {effectiveUsageState === 'active' || effectiveUsageState === 'in-use'
                ? 'This certificate is actively used by virtual servers'
                : effectiveUsageState === 'profiles-no-vips'
                ? 'Linked to SSL profiles but no VIPs are using them'
                : effectiveUsageState === 'no-profiles'
                ? 'Not linked to any SSL profile'
                : 'Usage status unknown'}
            </Typography>
          </Box>

          {certificate.renewal_status && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Renewal Status
              </Typography>
              <InfoRow label="Status" value={certificate.renewal_status} />
              {certificate.renewal_id && (
                <InfoRow label="Renewal ID" value={certificate.renewal_id} />
              )}
            </>
          )}
        </Box>

        {/* Actions Footer */}
        <Box
          sx={{
            p: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
          }}
        >
          <Stack spacing={1.5}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<VisibilityIcon />}
              onClick={() => onShowUsage && onShowUsage(certificate.id)}
            >
              View Usage Details
            </Button>
            
            {userRole !== 'viewer' && (
              <Button
                fullWidth
                variant="contained"
                startIcon={<AutorenewIcon />}
                onClick={() => onRenew && onRenew(certificate)}
                disabled={!certificate.common_name}
              >
                {certificate.renewal_status === 'CSR_GENERATED' ? 'Continue Renewal' : 'Renew Certificate'}
              </Button>
            )}
            
            {userRole === 'admin' && (
              <Button
                fullWidth
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => onDelete && onDelete(certificate.id)}
              >
                Delete Certificate
              </Button>
            )}
          </Stack>
        </Box>
      </Box>
    </Drawer>
  );
};

export default CertificateDetailDrawer;
