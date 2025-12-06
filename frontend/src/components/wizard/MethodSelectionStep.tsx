/**
 * MethodSelectionStep - Step 0 of the Unified Renewal Wizard
 * Enterprise-styled method selection for certificate renewal
 * 
 * Options:
 * - Upload existing PFX/PEM (fast path)
 * - Generate CSR first (full renewal flow)
 * - Continue pending CSR (if one exists)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  Paper,
  Chip,
  CircularProgress,
  alpha,
} from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import DescriptionIcon from '@mui/icons-material/Description';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SecurityIcon from '@mui/icons-material/Security';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import WarningIcon from '@mui/icons-material/Warning';
import apiClient from '../../services/api';
import type { 
  RenewalMethod, 
  CertificateInfo, 
  PendingCSRRequest 
} from '../../types/renewal';

export { RENEWAL_METHODS } from '../../types/renewal';

interface MethodSelectionStepProps {
  certificateId?: number;
  certName?: string;
  certificate?: CertificateInfo | null;
  onMethodSelect: (method: RenewalMethod, pendingCSR: PendingCSRRequest | null) => void;
  initialMethod?: RenewalMethod | null;
}

const MethodSelectionStep: React.FC<MethodSelectionStepProps> = ({
  certificateId,
  certName,
  certificate,
  onMethodSelect,
  initialMethod = null,
}) => {
  const [method, setMethod] = useState<RenewalMethod>(initialMethod || 'pfx');
  const [pendingCSR, setPendingCSR] = useState<PendingCSRRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for pending CSR on mount
  useEffect(() => {
    const checkPendingCSR = async () => {
      if (!certificateId) {
        setLoading(false);
        return;
      }

      try {
        const response = await apiClient.get('/csr/pending');
        const pending = response.data?.find(
          (r: PendingCSRRequest) => 
            r.original_certificate_id === certificateId && 
            r.status === 'CSR_GENERATED'
        );
        
        if (pending) {
          setPendingCSR(pending);
          setMethod('continue');
        }
      } catch (e) {
        console.warn('Could not check for pending CSR:', e);
      } finally {
        setLoading(false);
      }
    };

    checkPendingCSR();
  }, [certificateId]);

  // Notify parent when method changes
  useEffect(() => {
    onMethodSelect(method, pendingCSR);
  }, [method, pendingCSR, onMethodSelect]);

  const formatDate = useCallback((dateStr?: string): string => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }, []);

  const getDaysRemainingColor = (days: number): 'error' | 'warning' | 'success' => {
    if (days <= 30) return 'error';
    if (days <= 60) return 'warning';
    return 'success';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 6 }}>
        <CircularProgress size={32} />
        <Typography color="text.secondary">Checking renewal status...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Certificate Info Card */}
      {certificate && (
        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            borderRadius: 2,
            bgcolor: (theme) => alpha(theme.palette.info.main, 0.04),
            borderColor: (theme) => alpha(theme.palette.info.main, 0.3),
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <SecurityIcon sx={{ color: 'info.main', mt: 0.25 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Certificate to Renew
              </Typography>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                {certificate.common_name || certName}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <CalendarTodayIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    Expires: <strong>{formatDate(certificate.expiration_date)}</strong>
                  </Typography>
                </Box>
                {certificate.days_remaining !== undefined && (
                  <Chip
                    size="small"
                    icon={certificate.days_remaining <= 30 ? <WarningIcon /> : undefined}
                    label={`${certificate.days_remaining} days remaining`}
                    color={getDaysRemainingColor(certificate.days_remaining)}
                    variant={certificate.days_remaining <= 30 ? 'filled' : 'outlined'}
                  />
                )}
              </Box>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Method Selection Header */}
      <Typography variant="subtitle1" fontWeight={600}>
        How would you like to renew this certificate?
      </Typography>

      {/* Method Options */}
      <RadioGroup
        value={method}
        onChange={(e) => setMethod(e.target.value as RenewalMethod)}
      >
        {/* Option 1: Upload PFX/PEM */}
        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            mb: 2,
            cursor: 'pointer',
            borderRadius: 2,
            borderColor: method === 'pfx' ? 'primary.main' : 'divider',
            borderWidth: method === 'pfx' ? 2 : 1,
            bgcolor: method === 'pfx' 
              ? (theme) => alpha(theme.palette.primary.main, 0.04)
              : 'background.paper',
            transition: 'all 0.15s ease-in-out',
            '&:hover': { 
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
              borderColor: method === 'pfx' ? 'primary.main' : 'primary.light',
            },
          }}
          onClick={() => setMethod('pfx')}
        >
          <FormControlLabel
            value="pfx"
            control={<Radio color="primary" />}
            label={
              <Box sx={{ ml: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.75 }}>
                  <UploadIcon color={method === 'pfx' ? 'primary' : 'action'} />
                  <Typography variant="subtitle1" fontWeight={600}>
                    I have a PFX or PEM certificate ready
                  </Typography>
                  <Chip 
                    size="small" 
                    label="Recommended" 
                    color="success" 
                    sx={{ height: 22, fontSize: '0.7rem' }}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Upload your renewed certificate file (.pfx, .p12) or paste PEM content directly.
                  Best when you already obtained the signed certificate from your CA.
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', m: 0, width: '100%' }}
          />
        </Paper>

        {/* Option 2: Generate CSR */}
        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            mb: 2,
            cursor: 'pointer',
            borderRadius: 2,
            borderColor: method === 'csr' ? 'primary.main' : 'divider',
            borderWidth: method === 'csr' ? 2 : 1,
            bgcolor: method === 'csr'
              ? (theme) => alpha(theme.palette.primary.main, 0.04)
              : 'background.paper',
            transition: 'all 0.15s ease-in-out',
            '&:hover': { 
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
              borderColor: method === 'csr' ? 'primary.main' : 'primary.light',
            },
          }}
          onClick={() => setMethod('csr')}
        >
          <FormControlLabel
            value="csr"
            control={<Radio color="primary" />}
            label={
              <Box sx={{ ml: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.75 }}>
                  <DescriptionIcon color={method === 'csr' ? 'primary' : 'action'} />
                  <Typography variant="subtitle1" fontWeight={600}>
                    I need to generate a CSR first
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Generate a Certificate Signing Request (CSR) and private key locally.
                  Submit the CSR to your Certificate Authority (DigiCert, etc.), then complete the process here.
                </Typography>
                <Box
                  sx={{
                    mt: 1.5,
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: (theme) => alpha(theme.palette.grey[500], 0.08),
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    💡 Certificate details will be pre-filled from the current certificate
                  </Typography>
                </Box>
              </Box>
            }
            sx={{ alignItems: 'flex-start', m: 0, width: '100%' }}
          />
        </Paper>

        {/* Option 3: Continue Pending CSR (only if exists) */}
        {pendingCSR && (
          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              mb: 2,
              cursor: 'pointer',
              borderRadius: 2,
              borderColor: method === 'continue' ? 'warning.main' : 'divider',
              borderWidth: method === 'continue' ? 2 : 1,
              bgcolor: method === 'continue'
                ? (theme) => alpha(theme.palette.warning.main, 0.08)
                : 'background.paper',
              transition: 'all 0.15s ease-in-out',
              '&:hover': { 
                bgcolor: (theme) => alpha(theme.palette.warning.main, 0.1),
                borderColor: method === 'continue' ? 'warning.main' : 'warning.light',
              },
            }}
            onClick={() => setMethod('continue')}
          >
            <FormControlLabel
              value="continue"
              control={<Radio color="warning" />}
              label={
                <Box sx={{ ml: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.75 }}>
                    <ScheduleIcon color="warning" />
                    <Typography variant="subtitle1" fontWeight={600}>
                      Continue pending CSR
                    </Typography>
                    <Chip 
                      size="small" 
                      label={`Request #${pendingCSR.id}`} 
                      color="warning" 
                      variant="outlined"
                      sx={{ height: 22, fontSize: '0.7rem' }}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    You already have a CSR generated for this certificate. 
                    Paste the signed certificate from your CA to complete the renewal.
                  </Typography>
                  <Box
                    sx={{
                      mt: 1.5,
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: (theme) => alpha(theme.palette.warning.main, 0.08),
                      display: 'flex',
                      gap: 3,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      <strong>CN:</strong> {pendingCSR.common_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      <strong>Created:</strong> {formatDate(pendingCSR.created_at)}
                    </Typography>
                  </Box>
                </Box>
              }
              sx={{ alignItems: 'flex-start', m: 0, width: '100%' }}
            />
          </Paper>
        )}
      </RadioGroup>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default MethodSelectionStep;
