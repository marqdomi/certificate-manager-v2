/**
 * UploadCertStep - Enterprise-grade certificate upload step
 */

import React, { useState, ChangeEvent } from 'react';
import { 
  Box, 
  Paper,
  TextField, 
  Button, 
  Alert, 
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  alpha,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Code as CodeIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Lock as LockIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { validateDeployment } from '../../services/api';
import type { 
  UploadMode, 
  UploadPayload, 
  ValidationResult, 
  DeviceInfo,
} from '../../types/renewal';

interface UploadCertStepProps {
  device?: DeviceInfo | null;
  certName?: string;
  onValidated?: (payload: UploadPayload) => void;
  onInvalidated?: () => void;
  defaultMode?: UploadMode;
}

const UploadCertStep: React.FC<UploadCertStepProps> = ({ 
  onValidated, 
  onInvalidated,
  defaultMode = 'pfx' 
}) => {
  const [mode, setMode] = useState<UploadMode>(defaultMode);
  const [pfxFile, setPfxFile] = useState<File | null>(null);
  const [pfxPassword, setPfxPassword] = useState('');
  const [certPem, setCertPem] = useState('');
  const [keyPem, setKeyPem] = useState('');
  const [chainPem, setChainPem] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);

  const handleModeChange = (_: React.MouseEvent<HTMLElement>, newMode: UploadMode | null) => {
    if (newMode) {
      setMode(newMode);
      setResult(null);
      setError(null);
      onInvalidated?.();
    }
  };

  const onValidate = async () => {
    setError(null);
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { mode };
      
      if (mode === 'pfx') {
        if (!pfxFile) throw new Error('Please select a PFX file.');
        payload.pfxFile = pfxFile;
        payload.pfxPassword = pfxPassword;
      } else {
        if (!certPem || !keyPem) throw new Error('Please paste both certificate and private key.');
        payload.certPem = certPem;
        payload.keyPem = keyPem;
        payload.chainPem = chainPem || undefined;
      }
      
      const data = await validateDeployment(payload) as ValidationResult;
      setResult(data);
      
      onValidated?.({ 
        mode, 
        pfxFile, 
        pfxPassword, 
        certPem, 
        keyPem, 
        chainPem, 
        parsed: data.parsed, 
        warnings: data.warnings,
        validated: true,
      });
    } catch (e: unknown) {
      const error = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(error?.response?.data?.detail || error?.message || String(e));
      onInvalidated?.();
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPfxFile(e.target.files?.[0] || null);
    setResult(null);
    onInvalidated?.();
  };

  // Extract SAN list from various result shapes
  const getSanList = (res: ValidationResult): string[] => {
    const parsed = res.parsed || {};
    if (Array.isArray(parsed.san)) return parsed.san;
    if (Array.isArray(parsed.subjectAltName)) return parsed.subjectAltName;
    if (Array.isArray(res.info?.san)) return res.info.san;
    if (Array.isArray(res.san)) return res.san;
    return [];
  };

  const isReady = mode === 'pfx' ? !!pfxFile : (!!certPem && !!keyPem);

  return (
    <Box>
      {/* Format selector */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Certificate Format
        </Typography>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeChange}
          sx={{ 
            '& .MuiToggleButton-root': {
              px: 3,
              py: 1.5,
              textTransform: 'none',
            }
          }}
        >
          <ToggleButton value="pfx">
            <UploadIcon sx={{ mr: 1 }} fontSize="small" />
            PFX / P12 File
          </ToggleButton>
          <ToggleButton value="pem">
            <CodeIcon sx={{ mr: 1 }} fontSize="small" />
            PEM Format
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* PFX Upload */}
      {mode === 'pfx' && (
        <Paper
          variant="outlined"
          sx={{
            p: 3,
            borderRadius: 2,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.02),
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* File drop zone */}
            <Paper
              variant="outlined"
              sx={{
                p: 4,
                textAlign: 'center',
                border: '2px dashed',
                borderColor: pfxFile ? 'success.main' : 'divider',
                bgcolor: pfxFile 
                  ? (theme) => alpha(theme.palette.success.main, 0.04)
                  : 'transparent',
                borderRadius: 2,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                }
              }}
              component="label"
            >
              <input 
                type="file" 
                accept=".pfx,.p12" 
                hidden 
                onChange={handleFileChange} 
              />
              {pfxFile ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
                  <CheckCircleIcon color="success" />
                  <Box>
                    <Typography fontWeight={600}>{pfxFile.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(pfxFile.size / 1024).toFixed(1)} KB • Click to change
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <>
                  <DescriptionIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography fontWeight={500} gutterBottom>
                    Drop your PFX/P12 file here
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    or click to browse
                  </Typography>
                </>
              )}
            </Paper>

            {/* Password field */}
            <TextField
              label="PFX Password"
              type="password"
              value={pfxPassword}
              onChange={e => setPfxPassword(e.target.value)}
              fullWidth
              InputProps={{
                startAdornment: <LockIcon sx={{ mr: 1, color: 'text.disabled' }} fontSize="small" />,
              }}
              helperText="Enter the password used to protect the PFX file"
            />
          </Box>
        </Paper>
      )}

      {/* PEM Input */}
      {mode === 'pem' && (
        <Paper
          variant="outlined"
          sx={{
            p: 3,
            borderRadius: 2,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.02),
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Certificate (PEM)"
              multiline 
              minRows={5}
              maxRows={10}
              value={certPem}
              onChange={e => { setCertPem(e.target.value); setResult(null); onInvalidated?.(); }}
              placeholder="-----BEGIN CERTIFICATE-----"
              fullWidth
              sx={{
                '& .MuiInputBase-input': {
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                }
              }}
            />
            <TextField
              label="Private Key (PEM)"
              multiline 
              minRows={5}
              maxRows={10}
              value={keyPem}
              onChange={e => { setKeyPem(e.target.value); setResult(null); onInvalidated?.(); }}
              placeholder="-----BEGIN PRIVATE KEY-----"
              fullWidth
              sx={{
                '& .MuiInputBase-input': {
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                }
              }}
            />
            <TextField
              label="Chain Certificate (Optional)"
              multiline 
              minRows={3}
              maxRows={8}
              value={chainPem}
              onChange={e => setChainPem(e.target.value)}
              placeholder="-----BEGIN CERTIFICATE-----"
              fullWidth
              helperText="Include intermediate CA certificates if provided by your CA"
              sx={{
                '& .MuiInputBase-input': {
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                }
              }}
            />
          </Box>
        </Paper>
      )}

      {/* Validate button */}
      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
        <Button 
          variant="contained" 
          onClick={onValidate} 
          disabled={loading || !isReady}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <CheckCircleIcon />}
          sx={{ minWidth: 140 }}
        >
          {loading ? 'Validating...' : 'Validate'}
        </Button>
        {result && (
          <Chip 
            icon={<CheckCircleIcon />} 
            label="Valid Certificate" 
            color="success" 
            variant="outlined"
          />
        )}
      </Box>

      {/* Error message */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ mt: 2, borderRadius: 2 }}
          icon={<WarningIcon />}
        >
          {error}
        </Alert>
      )}
      
      {/* Validation result */}
      {result && (
        <Paper
          variant="outlined"
          sx={{ 
            mt: 3, 
            p: 2.5, 
            borderRadius: 2,
            borderColor: 'success.main',
            bgcolor: (theme) => alpha(theme.palette.success.main, 0.04),
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CheckCircleIcon color="success" />
            <Typography variant="subtitle1" fontWeight={600}>
              Certificate Validated Successfully
            </Typography>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Common Name (CN)
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {result.parsed?.cn || 'N/A'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Expiration Date
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {result.parsed?.not_after || 'N/A'}
              </Typography>
            </Box>
          </Box>
          
          {(() => {
            const sanList = getSanList(result);
            if (sanList.length === 0) return null;
            return (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Subject Alternative Names (SANs)
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                  {sanList.slice(0, 8).map((san, i) => (
                    <Chip 
                      key={i} 
                      label={san} 
                      size="small" 
                      variant="outlined"
                      sx={{ fontSize: '0.75rem' }}
                    />
                  ))}
                  {sanList.length > 8 && (
                    <Chip 
                      label={`+${sanList.length - 8} more`} 
                      size="small" 
                      color="primary"
                      sx={{ fontSize: '0.75rem' }}
                    />
                  )}
                </Box>
              </Box>
            );
          })()}

          {result.warnings && result.warnings.length > 0 && (
            <Alert severity="warning" sx={{ mt: 2, borderRadius: 1 }} icon={<WarningIcon />}>
              <Typography variant="body2">
                {result.warnings.join(' • ')}
              </Typography>
            </Alert>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default UploadCertStep;
