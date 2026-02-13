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
  alpha,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import SecurityIcon from '@mui/icons-material/Security';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { authProvider } from '../pages/LoginPage';
import { InfoRow } from './shared';

dayjs.extend(relativeTime);

const CertificateDetailDrawer = ({
  open,
  onClose,
  certificate,
  isFavorite,
  onToggleFavorite,
  onRenew,
  onShowUsage,
  onDelete,
}) => {
  if (!certificate) return null;

  // Get user role from auth provider
  const userRole = authProvider.getRole?.() || 'viewer';

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
                  <IconButton onClick={() => onToggleFavorite(certificate.id)} size="small" aria-label="Toggle favorite">
                    {isFavorite ? (
                      <StarIcon sx={{ color: 'warning.main' }} />
                    ) : (
                      <StarBorderIcon />
                    )}
                  </IconButton>
                </Tooltip>
              )}
              <IconButton onClick={onClose} size="small" aria-label="Close">
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
          
          <InfoRow label="Common Name" value={certificate.common_name} copyable />
          <InfoRow label="Certificate Name" value={certificate.name} copyable />
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
          
          <InfoRow label="Hostname" value={certificate.f5_device_hostname} copyable />
          <InfoRow label="Device ID" value={certificate.device_id} />

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
