/**
 * ConfirmDeploymentStep - Enterprise-grade deployment confirmation
 */

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Alert, 
  Typography, 
  FormControlLabel, 
  Switch,
  Button, 
  TextField, 
  Paper,
  Divider,
  Chip,
  CircularProgress,
  Collapse,
  alpha,
} from '@mui/material';
import {
  RocketLaunch as DeployIcon,
  PlayArrow as PreviewIcon,
  CheckCircle as CheckCircleIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Verified as VerifiedIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import { 
  executeDeployment, 
  planDeployment, 
  verifyInstalledCert, 
  refreshDeviceCerts 
} from '../../services/api';
import PlanPreview from './PlanPreview';
import type { 
  DeviceInfo, 
  PreviewData, 
  UploadPayload, 
  DeploymentPlan,
  DeploymentResult,
  VerificationResult 
} from '../../types/renewal';

type NotifySeverity = 'success' | 'error' | 'warning' | 'info';

interface ConfirmDeploymentStepProps {
  device: DeviceInfo | null;
  certName: string;
  previewData: PreviewData | null;
  uploadPayload: UploadPayload | null;
  onResult?: (data: DeploymentResult) => void;
  onDone?: () => void;
  onNotify?: (message: string, severity: NotifySeverity) => void;
}

const ConfirmDeploymentStep: React.FC<ConfirmDeploymentStepProps> = ({ 
  device, 
  certName, 
  previewData, 
  uploadPayload, 
  onResult, 
  onDone, 
  onNotify 
}) => {
  const [installChainFromPfx, setInstallChainFromPfx] = useState(false);
  const [useExistingChain, setUseExistingChain] = useState(true);
  const [chainName, setChainName] = useState('DigiCert_Global_G2_TLS_RSA_SHA256_2020_CA1');
  const [updateProfiles, setUpdateProfiles] = useState(true);
  const [dryRun, setDryRun] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<DeploymentPlan | null>(null);
  const [executed, setExecuted] = useState(false);
  const [newObjectName, setNewObjectName] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isValidated = uploadPayload?.validated === true;
  const profileCount = previewData?.profiles?.length || 0;

  const onConfirm = async () => {
    setError(null);
    setSubmitting(true);
    setPlan(null);

    try {
      const payload: Record<string, unknown> = {
        deviceId: device?.id,
        oldCertName: certName,
        mode: uploadPayload?.mode,
        chainName: useExistingChain ? chainName : undefined,
        updateProfiles,
        selectedProfiles: previewData?.profiles || null,
        dryRun
      };

      if (uploadPayload?.mode === 'pfx') {
        payload.pfxFile = uploadPayload.pfxFile;
        payload.pfxPassword = uploadPayload.pfxPassword;
        payload.installChainFromPfx = installChainFromPfx;
      } else {
        payload.certPem = uploadPayload?.certPem;
        payload.keyPem = uploadPayload?.keyPem;
      }

      if (dryRun) {
        const data = await planDeployment(payload);
        setPlan((data as { plan?: DeploymentPlan })?.plan || data as DeploymentPlan);
        onNotify?.('Plan preview generated successfully.', 'info');
      } else {
        const data = await executeDeployment(payload) as DeploymentResult;
        
        const createdName =
          data?.result?.new_cert_object ||
          data?.new_cert_object ||
          data?.new_object_name ||
          null;
        
        setExecuted(true);
        setNewObjectName(createdName);
        setVerifyResult(null);

        // Fire-and-forget rescan
        try {
          if (device?.id) {
            refreshDeviceCerts(device.id, { fast: true });
          }
        } catch {
          // no-op
        }

        // Calculate updated count
        const upd = (() => {
          const res = data?.result ?? data;
          if (Array.isArray(res?.updated_profiles)) return res.updated_profiles.length;
          if (res?.updated_profiles && typeof res.updated_profiles === 'object') {
            return Object.keys(res.updated_profiles).length;
          }
          if (typeof res?.updated_count === 'number') return res.updated_count;
          if (typeof data?.updated_count === 'number') return data.updated_count;
          if (Array.isArray(data?.updated_profiles)) return data.updated_profiles.length;
          return null;
        })();

        const msg = upd != null
          ? `Deployment completed. Updated ${upd} SSL profile${upd === 1 ? '' : 's'}.`
          : `Deployment completed successfully.`;
        
        onNotify?.(msg, 'success');
        onResult?.(data);
      }
    } catch (e: unknown) {
      const error = e as { response?: { data?: { detail?: string } }; message?: string };
      const msg = error?.response?.data?.detail || error?.message || String(e);
      setError(msg);
      onNotify?.(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!device?.id || !newObjectName) return;
    
    setVerifying(true);
    setError(null);
    
    try {
      const data = await verifyInstalledCert(device.id, newObjectName) as VerificationResult;
      setVerifyResult(data);
      onNotify?.('Verification completed.', 'success');
    } catch (e: unknown) {
      const error = e as { response?: { data?: { detail?: string } }; message?: string };
      const msg = error?.response?.data?.detail || error?.message || String(e);
      setError(msg);
      onNotify?.(msg, 'error');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => { 
    setError(null); 
    setPlan(null); 
  }, [dryRun, device?.id, certName]);

  // Not validated state
  if (!uploadPayload || !isValidated) {
    return (
      <Alert severity="warning" sx={{ borderRadius: 2 }}>
        Please complete the certificate upload and validation step before deploying.
      </Alert>
    );
  }

  // Success state after deployment
  if (executed) {
    return (
      <Box>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            bgcolor: (theme) => alpha(theme.palette.success.main, 0.08),
            border: '1px solid',
            borderColor: 'success.main',
            borderRadius: 2,
            textAlign: 'center',
          }}
        >
          <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Deployment Successful
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            The certificate has been deployed to <strong>{device?.hostname}</strong>
          </Typography>
          
          {newObjectName && (
            <Chip 
              label={newObjectName} 
              color="success" 
              variant="outlined"
              sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
            />
          )}
        </Paper>

        {/* Verification section */}
        <Paper variant="outlined" sx={{ mt: 3, p: 2.5, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <VerifiedIcon color="primary" />
              <Box>
                <Typography variant="subtitle2">Verify Installation</Typography>
                <Typography variant="caption" color="text.secondary">
                  Confirm the certificate was installed correctly
                </Typography>
              </Box>
            </Box>
            <Button
              variant="outlined"
              onClick={handleVerify}
              disabled={verifying || !newObjectName}
              startIcon={verifying ? <CircularProgress size={16} /> : <VerifiedIcon />}
            >
              {verifying ? 'Verifying...' : 'Verify'}
            </Button>
          </Box>

          {verifyResult && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Subject</Typography>
                  <Typography variant="body2">{verifyResult.subject || 'N/A'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Version</Typography>
                  <Typography variant="body2">{verifyResult.version || 'N/A'}</Typography>
                </Box>
              </Box>
              {verifyResult.fingerprint_sha256 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">SHA-256 Fingerprint</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                    {verifyResult.fingerprint_sha256}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Paper>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button 
            variant="contained" 
            onClick={onDone}
            size="large"
          >
            Done
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      {/* Certificate Summary Card */}
      <Paper 
        variant="outlined" 
        sx={{ 
          p: 2.5, 
          mb: 3, 
          borderRadius: 2,
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.02),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <SecurityIcon color="primary" sx={{ mt: 0.5 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              New Certificate
            </Typography>
            <Typography variant="h6" fontWeight={600}>
              {uploadPayload?.parsed?.cn || 'N/A'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
              <Chip 
                size="small" 
                label={`Expires: ${uploadPayload?.parsed?.not_after || 'N/A'}`}
                variant="outlined"
              />
              <Chip 
                size="small" 
                label={uploadPayload?.mode?.toUpperCase()}
                color="primary"
                variant="outlined"
              />
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Target Device */}
      <Paper 
        variant="outlined" 
        sx={{ p: 2.5, mb: 3, borderRadius: 2 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <StorageIcon color="primary" />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Target Device
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {device?.hostname || `Device #${device?.id}`}
            </Typography>
          </Box>
          {profileCount > 0 && (
            <Chip 
              label={`${profileCount} SSL profile${profileCount !== 1 ? 's' : ''} will be updated`}
              color="info"
              size="small"
            />
          )}
        </Box>
      </Paper>

      {/* Deployment Options */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SettingsIcon fontSize="small" color="action" />
            <Typography variant="subtitle1" fontWeight={600}>
              Deployment Options
            </Typography>
          </Box>
          <Button
            size="small"
            onClick={() => setShowAdvanced(!showAdvanced)}
            endIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          >
            Advanced
          </Button>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <FormControlLabel
            control={
              <Switch 
                checked={updateProfiles} 
                onChange={e => setUpdateProfiles(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2">Update SSL Profiles Automatically</Typography>
                <Typography variant="caption" color="text.secondary">
                  Update all SSL profiles using this certificate
                </Typography>
              </Box>
            }
          />

          <FormControlLabel
            control={
              <Switch 
                checked={dryRun} 
                onChange={e => setDryRun(e.target.checked)}
                color="warning"
              />
            }
            label={
              <Box>
                <Typography variant="body2">Preview Mode (Dry Run)</Typography>
                <Typography variant="caption" color="text.secondary">
                  Generate a deployment plan without making changes
                </Typography>
              </Box>
            }
          />
        </Box>

        <Collapse in={showAdvanced}>
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {uploadPayload?.mode === 'pfx' && (
              <FormControlLabel
                control={
                  <Switch 
                    checked={installChainFromPfx} 
                    onChange={e => setInstallChainFromPfx(e.target.checked)}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2">Extract chain from PFX</Typography>
                }
              />
            )}

            <FormControlLabel
              control={
                <Switch 
                  checked={useExistingChain} 
                  onChange={e => setUseExistingChain(e.target.checked)}
                  size="small"
                />
              }
              label={
                <Typography variant="body2">Use existing chain object on device</Typography>
              }
            />
            
            {useExistingChain && (
              <TextField
                label="Chain Object Name"
                value={chainName}
                onChange={e => setChainName(e.target.value)}
                size="small"
                fullWidth
                sx={{ ml: 4 }}
              />
            )}
          </Box>
        </Collapse>
      </Paper>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Action Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          size="large"
          onClick={onConfirm}
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : (dryRun ? <PreviewIcon /> : <DeployIcon />)}
          color={dryRun ? 'info' : 'primary'}
          sx={{ minWidth: 180 }}
        >
          {submitting 
            ? 'Processing...' 
            : dryRun 
              ? 'Preview Plan' 
              : 'Deploy Certificate'
          }
        </Button>
      </Box>

      {/* Plan Preview */}
      {plan && (
        <Paper variant="outlined" sx={{ mt: 3, p: 2.5, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Deployment Plan Preview
          </Typography>
          <PlanPreview plan={plan} />
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button 
              size="small" 
              variant="outlined"
              onClick={() => {
                const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
              }}
            >
              View JSON
            </Button>
            <Button 
              size="small" 
              variant="outlined"
              onClick={() => {
                setDryRun(false);
              }}
            >
              Execute Plan
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default ConfirmDeploymentStep;
