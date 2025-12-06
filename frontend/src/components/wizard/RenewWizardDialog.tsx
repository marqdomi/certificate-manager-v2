/**
 * RenewWizardDialog – Unified Renewal Wizard
 * 
 * Enterprise-grade design with clean, modern UI
 * 
 * Step 0: Method Selection (PFX ready / Generate CSR / Continue pending)
 * Step 1: Impact Preview (see affected SSL profiles)
 * Step 2: Upload Certificate
 * Step 3: Confirm & Deploy
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Snackbar,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Storage as StorageIcon,
} from "@mui/icons-material";
import apiClient, { verifyInstalledCert } from "../../services/api";
import UploadCertStep from "./UploadCertStep";
import ConfirmDeploymentStep from "./ConfirmDeploymentStep";
import MethodSelectionStep, { RENEWAL_METHODS } from "./MethodSelectionStep";
import type { 
  DeviceInfo, 
  CertificateInfo, 
  PreviewData, 
  UploadPayload, 
  ToastState,
  RenewalMethod,
  PendingCSRRequest,
  SSLProfile
} from "../../types/renewal";

// Types for profile handling
interface ProfileRow {
  name: string;
  partition: string;
  context: string;
  full_path?: string;
}

interface ImpactResolvedPayload {
  profiles: ProfileRow[];
  from: string;
  error: string | null;
}

type NotifySeverity = 'success' | 'error' | 'warning' | 'info';

interface RawProfileItem {
  fullPath?: string;
  full_path?: string;
  profile_full_path?: string;
  name?: string;
  profile?: string;
  profile_name?: string;
  partition?: string;
  partition_name?: string;
  context?: string;
  side?: string;
  profileContext?: string;
}

interface NormalizedPayload {
  profiles?: RawProfileItem[];
  results?: RawProfileItem[];
}

// Normalizes various backend shapes into clean rows
function normalizeProfilesPayload(payload: NormalizedPayload | RawProfileItem[] | null): ProfileRow[] {
  const raw: (RawProfileItem | string)[] =
    (payload && Array.isArray((payload as NormalizedPayload).profiles) && (payload as NormalizedPayload).profiles) ||
    (Array.isArray(payload) && payload) ||
    (payload && Array.isArray((payload as NormalizedPayload).results) && (payload as NormalizedPayload).results) ||
    [];

  const rows: ProfileRow[] = [];
  for (const item of raw) {
    if (!item) continue;

    if (typeof item === "string") {
      let partition = "Common";
      let name = item;
      const m = item.match(/^\/([^/]+)\/(.+)$/);
      if (m) {
        partition = m[1];
        name = m[2];
      }
      rows.push({ name, partition, context: "—", full_path: item });
      continue;
    }

    const full = item.fullPath || item.full_path || item.profile_full_path;
    let name = item.name || item.profile || item.profile_name;
    let partition = item.partition || item.partition_name;

    if ((!name || !partition) && full) {
      const m = full.match(/^\/([^/]+)\/(.+)$/);
      if (m) {
        partition = partition || m[1];
        name = name || m[2];
      }
    }

    const context = item.context || item.side || item.profileContext || "—";

    rows.push({
      name: name || "—",
      partition: partition || "Common",
      context,
      full_path: full,
    });
  }
  return rows;
}

// -----------------------------------------------------------------------------
// ImpactPreviewStep - Clean enterprise design
// -----------------------------------------------------------------------------
interface ImpactPreviewStepProps {
  device: DeviceInfo | null;
  certName: string;
  certificateId?: number;
  timeoutSeconds?: number;
  onResolved?: (payload: ImpactResolvedPayload) => void;
}

function ImpactPreviewStep({
  device,
  certName,
  certificateId,
  timeoutSeconds = 30,
  onResolved,
}: ImpactPreviewStepProps) {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [source, setSource] = useState<'none' | 'cache' | 'live'>('none');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const fetchProfiles = useCallback(async (forceLive = false) => {
    setError(null);
    setLoading(true);

    try {
      // Try simplified endpoint first (fastest)
      if (certificateId && !forceLive) {
        const r = await apiClient.get(`/certificates/${certificateId}/ssl-profiles`);
        const data = r?.data || {};
        const sslProfiles = data.ssl_profiles || [];
        
        const rows: ProfileRow[] = sslProfiles.map((profile: SSLProfile) => ({
          name: profile.name,
          partition: profile.partition,
          context: profile.context || 'clientside',
          full_path: profile.profile_full_path,
        }));

        setProfiles(rows);
        setSource("cache");
        setLastUpdated(new Date());
        onResolved?.({ profiles: rows, from: "cache", error: null });
        return;
      }

      // Live query to device
      if (device?.id && certName) {
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();

        const res = await apiClient.get(`/f5/impact-preview`, {
          params: { device_id: device.id, cert_name: certName, timeout: timeoutSeconds },
          signal: abortRef.current.signal,
        });

        const rows = normalizeProfilesPayload(res?.data || {});
        setProfiles(rows);
        setSource("live");
        setLastUpdated(new Date());
        onResolved?.({ profiles: rows, from: "live", error: null });
      }
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      const isCanceled = err?.message?.includes("canceled") || err?.message?.includes("ERR_CANCELED");
      
      if (!isCanceled) {
        const msg = err?.response?.data?.detail || err.message || "Failed to load SSL profiles";
        setError(msg);
        onResolved?.({ profiles: [], from: "none", error: msg });
      }
    } finally {
      setLoading(false);
    }
  }, [certificateId, device?.id, certName, timeoutSeconds, onResolved]);

  useEffect(() => {
    fetchProfiles();
    return () => abortRef.current?.abort();
  }, [fetchProfiles]);

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Box>
      {/* Header with device info */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 2, 
          mb: 3, 
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <StorageIcon color="primary" />
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Target Device
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {device?.hostname || `Device #${device?.id}`}
                {device?.ip_address && (
                  <Typography component="span" color="text.secondary" sx={{ ml: 1 }}>
                    ({device.ip_address})
                  </Typography>
                )}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {lastUpdated && (
              <Typography variant="caption" color="text.secondary">
                Updated {formatTime(lastUpdated)}
              </Typography>
            )}
            <Tooltip title="Refresh from device">
              <IconButton 
                size="small" 
                onClick={() => fetchProfiles(true)}
                disabled={loading}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      {/* Loading state */}
      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} sx={{ mr: 2 }} />
          <Typography color="text.secondary">
            Loading SSL profiles...
          </Typography>
        </Box>
      )}

      {/* Error state */}
      {error && !loading && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => fetchProfiles()}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Empty state */}
      {!loading && !error && profiles.length === 0 && (
        <Paper 
          elevation={0} 
          sx={{ 
            p: 4, 
            textAlign: 'center',
            bgcolor: (theme) => alpha(theme.palette.info.main, 0.04),
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <InfoIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No SSL Profiles Found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This certificate is not currently associated with any SSL profiles.
            You can still proceed with the renewal.
          </Typography>
        </Paper>
      )}

      {/* Profiles table */}
      {!loading && profiles.length > 0 && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SecurityIcon fontSize="small" color="primary" />
              <Typography variant="subtitle1" fontWeight={600}>
                SSL Profiles Using This Certificate
              </Typography>
            </Box>
            <Chip 
              size="small" 
              label={`${profiles.length} profile${profiles.length !== 1 ? 's' : ''}`}
              color="primary"
              variant="outlined"
            />
          </Box>

          <TableContainer 
            component={Paper} 
            variant="outlined"
            sx={{ 
              borderRadius: 2,
              '& .MuiTableCell-head': {
                bgcolor: (theme) => theme.palette.mode === 'dark' 
                  ? alpha(theme.palette.primary.main, 0.1) 
                  : 'grey.50',
                fontWeight: 600,
              }
            }}
          >
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Profile Name</TableCell>
                  <TableCell>Partition</TableCell>
                  <TableCell>Context</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {profiles.map((p, idx) => (
                  <TableRow 
                    key={`${p.name}-${idx}`}
                    sx={{ 
                      '&:last-child td': { border: 0 },
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircleIcon fontSize="small" color="success" />
                        <Typography variant="body2" fontWeight={500}>
                          {p.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        size="small" 
                        label={p.partition} 
                        variant="outlined"
                        sx={{ fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {p.context}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Alert 
            severity="info" 
            icon={<InfoIcon />}
            sx={{ mt: 2, borderRadius: 2 }}
          >
            These SSL profiles will be automatically updated when you deploy the new certificate.
          </Alert>
        </>
      )}
    </Box>
  );
}

// -----------------------------------------------------------------------------
// RenewWizardDialog
// -----------------------------------------------------------------------------
interface RenewWizardDialogProps {
  open: boolean;
  onClose: () => void;
  device: DeviceInfo | null;
  certName: string;
  certificateId?: number;
  certificate?: CertificateInfo;
}

export default function RenewWizardDialog({ 
  open, 
  onClose, 
  device, 
  certName, 
  certificateId, 
  certificate 
}: RenewWizardDialogProps) {
  // Method selection state
  const [renewalMethod, setRenewalMethod] = useState<RenewalMethod | null>(null);
  const [pendingCSR, setPendingCSR] = useState<PendingCSRRequest | null>(null);
  
  const [activeStep, setActiveStep] = useState(0);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [uploadPayload, setUploadPayload] = useState<UploadPayload | null>(null);
  const [toast, setToast] = useState<ToastState>({ open: false, message: "", severity: "success" });
  
  const notify = (message: string, severity: NotifySeverity = "success") => 
    setToast({ open: true, message, severity });

  // Dynamic steps based on method
  const steps = useMemo(() => {
    if (renewalMethod === RENEWAL_METHODS.CSR) {
      return ['Method', 'Impact Preview', 'Upload Certificate', 'Confirm & Deploy'];
    }
    if (renewalMethod === RENEWAL_METHODS.CONTINUE) {
      return ['Method', 'Upload Certificate', 'Confirm & Deploy'];
    }
    return ['Method', 'Impact Preview', 'Upload Certificate', 'Confirm & Deploy'];
  }, [renewalMethod]);

  // Handle method selection
  const handleMethodSelect = useCallback((method: RenewalMethod, pending: PendingCSRRequest | null) => {
    setRenewalMethod(method);
    setPendingCSR(pending);
  }, []);

  const reset = () => {
    setActiveStep(0);
    setRenewalMethod(null);
    setPendingCSR(null);
    setPreviewData(null);
    setUploadPayload(null);
  };

  const handleClose = () => {
    reset();
    setToast((t) => ({ ...t, open: false }));
    onClose?.();
  };

  const maxStep = steps.length - 1;
  const next = () => setActiveStep((s) => Math.min(maxStep, s + 1));
  const back = () => setActiveStep((s) => Math.max(0, s - 1));

  const getLogicalStep = (): string => {
    if (activeStep === 0) return 'method';
    
    if (renewalMethod === RENEWAL_METHODS.CONTINUE) {
      if (activeStep === 1) return 'upload';
      if (activeStep === 2) return 'deploy';
    } else {
      if (activeStep === 1) return 'impact';
      if (activeStep === 2) return 'upload';
      if (activeStep === 3) return 'deploy';
    }
    return 'unknown';
  };

  const logicalStep = getLogicalStep();

  const canNext = (): boolean => {
    if (logicalStep === 'method') {
      return !!renewalMethod;
    }
    if (logicalStep === 'upload') {
      return !!uploadPayload?.validated;
    }
    return true;
  };

  // Handle CSR method - open CSR Generator instead
  const handleCSRFlow = () => {
    handleClose();
    window.dispatchEvent(new CustomEvent('openCSRGenerator', { 
      detail: { certificateId, certName, certificate, device } 
    }));
  };

  const verifyNow = async () => {
    try {
      if (!device?.id || !certName) {
        notify("Missing device or cert name", "warning");
        return;
      }
      const res = await verifyInstalledCert(device.id, certName) as { 
        ok?: boolean; 
        data?: { ok?: boolean; error?: string }; 
        error?: string; 
        message?: string 
      };
      const ok = !!res?.ok || !!res?.data?.ok;
      if (ok) {
        notify("Verification OK: certificate is installed and readable", "success");
      } else {
        const msg =
          res?.error ||
          res?.data?.error ||
          res?.message ||
          "Verification failed";
        notify(msg, "warning");
      }
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      const msg = err?.response?.data?.detail || err.message || "Verification failed";
      notify(msg, "error");
    }
  };

  const handleNext = () => {
    if (logicalStep === 'method' && renewalMethod === RENEWAL_METHODS.CSR) {
      handleCSRFlow();
      return;
    }
    next();
  };

  return (
    <Dialog 
      open={!!open} 
      onClose={handleClose} 
      fullWidth 
      maxWidth="md"
      PaperProps={{
        sx: { borderRadius: 3 }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        borderBottom: '1px solid',
        borderColor: 'divider',
        pb: 2,
      }}>
        <Box>
          <Typography variant="h6" component="span" fontWeight={600}>
            Renew Certificate
          </Typography>
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ mt: 0.5, fontFamily: 'monospace' }}
          >
            {certName}
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3, pb: 2 }}>
        {/* Stepper */}
        <Stepper 
          activeStep={activeStep} 
          alternativeLabel 
          sx={{ 
            mb: 4,
            '& .MuiStepLabel-label': {
              fontSize: '0.875rem',
            },
            '& .MuiStepIcon-root.Mui-completed': {
              color: 'success.main',
            },
          }}
        >
          {steps.map((label, index) => (
            <Step key={label} completed={index < activeStep}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step 0: Method Selection */}
        {logicalStep === 'method' && (
          <MethodSelectionStep
            certificateId={certificateId}
            certName={certName}
            certificate={certificate}
            onMethodSelect={handleMethodSelect}
            initialMethod={renewalMethod}
          />
        )}

        {/* Impact Preview Step */}
        {logicalStep === 'impact' && (
          <ImpactPreviewStep
            device={device}
            certName={certName}
            certificateId={certificateId}
            timeoutSeconds={60}
            onResolved={(payload) => setPreviewData(payload as PreviewData)}
          />
        )}

        {/* Upload Certificate Step */}
        {logicalStep === 'upload' && (
          <UploadCertStep
            device={device}
            certName={certName}
            onValidated={(payload: UploadPayload) => setUploadPayload({ ...payload, validated: true })}
            onInvalidated={() => setUploadPayload(null)}
          />
        )}

        {/* Confirm & Deploy Step */}
        {logicalStep === 'deploy' && (
          <ConfirmDeploymentStep
            device={device}
            certName={certName}
            previewData={previewData}
            uploadPayload={uploadPayload}
            onDone={handleClose}
            onNotify={(msg: string, sev: string) => notify(msg, sev as NotifySeverity)}
          />
        )}
      </DialogContent>

      <DialogActions sx={{ 
        px: 3, 
        py: 2, 
        borderTop: '1px solid',
        borderColor: 'divider',
        gap: 1,
      }}>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        {logicalStep === 'deploy' && (
          <Button onClick={verifyNow} variant="outlined" color="info">
            Verify Installation
          </Button>
        )}
        <Button 
          onClick={back} 
          disabled={activeStep === 0}
          variant="outlined"
        >
          Back
        </Button>
        <Button
          onClick={activeStep < maxStep ? handleNext : handleClose}
          variant="contained"
          disabled={!canNext()}
          sx={{ minWidth: 120 }}
        >
          {logicalStep === 'method' && renewalMethod === RENEWAL_METHODS.CSR 
            ? "Open CSR Generator" 
            : activeStep < maxStep 
              ? "Continue" 
              : "Done"}
        </Button>
      </DialogActions>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          severity={toast.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Dialog>
  );
}
