// frontend/src/components/digicert/DigicertRenewalWizard.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  TextField,
  Chip,
  Divider,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  Grid,
  Paper,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import {
  precheck as apiPrecheck,
  preview as apiPreview,
  createRenewal,
  getRenewal,
  statusColor,
  statusLabel,
} from '../../api/digicert';

const STEPS = ['Precheck', 'Configure', 'Confirm', 'Tracking'];

/**
 * DigiCert Renewal Wizard (4 pasos).
 * Props:
 *   open, onClose  -> control del diálogo
 *   certificate    -> { id, common_name, name, ... } del cert a renovar
 */
export default function DigicertRenewalWizard({ open, onClose, certificate }) {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Step 1: precheck
  const [precheckData, setPrecheckData] = useState(null);

  // Step 2: form
  const [sanList, setSanList] = useState([]);
  const [newSan, setNewSan] = useState('');
  const [validityYears, setValidityYears] = useState(1);
  const [keySize, setKeySize] = useState(2048);
  const [useDefaultProduct, setUseDefaultProduct] = useState(true);
  const [productOverride, setProductOverride] = useState('');

  // Step 3: preview + submit
  const [previewData, setPreviewData] = useState(null);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [idempotencyKey] = useState(() => cryptoRandom());

  // Step 4: polling
  const [trackedOrder, setTrackedOrder] = useState(null);

  // --- Reset al abrir ---
  useEffect(() => {
    if (!open) return;
    setActiveStep(0);
    setError(null);
    setPrecheckData(null);
    setPreviewData(null);
    setCreatedOrder(null);
    setTrackedOrder(null);
    setSanList([]);
    setNewSan('');
    setValidityYears(1);
    setKeySize(2048);
    setUseDefaultProduct(true);
    setProductOverride('');
  }, [open, certificate?.id]);

  // --- Step 1: Cargar precheck ---
  useEffect(() => {
    if (!open || !certificate?.id || activeStep !== 0) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiPrecheck(certificate.id);
        if (cancelled) return;
        setPrecheckData(data);
        // Pre-cargar SANs actuales en el form
        setSanList(data.current_sans || []);
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, certificate?.id, activeStep]);

  // --- Step 4: Polling cada 5s mientras no sea terminal ---
  useEffect(() => {
    if (activeStep !== 3 || !createdOrder?.id) return;
    let cancelled = false;
    let timerId;

    const poll = async () => {
      try {
        const order = await getRenewal(createdOrder.id);
        if (cancelled) return;
        setTrackedOrder(order);
        const terminal = [
          'DEPLOYED',
          'PARTIAL_DEPLOY',
          'FAILED',
          'CANCELLED',
          'APPROVAL_REJECTED',
          'TIMEOUT_APPROVAL',
        ].includes(order.status);
        if (!terminal) {
          timerId = setTimeout(poll, 5000);
        }
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [activeStep, createdOrder?.id]);

  // --- Navegación ---
  const handleNext = async () => {
    setError(null);
    if (activeStep === 1) {
      // Ir a Confirm: cargar preview
      try {
        setLoading(true);
        const data = await apiPreview({
          certificate_id: certificate.id,
          san_list: sanList.length ? sanList : undefined,
          validity_years: validityYears,
          key_size: keySize,
          product: useDefaultProduct ? undefined : productOverride || undefined,
        });
        setPreviewData(data);
      } catch (e) {
        setError(errMsg(e));
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    if (activeStep === 2) {
      // Submit real
      try {
        setLoading(true);
        const order = await createRenewal(
          {
            certificate_id: certificate.id,
            san_list: sanList.length ? sanList : undefined,
            validity_years: validityYears,
            key_size: keySize,
            product: useDefaultProduct ? undefined : productOverride || undefined,
            idempotency_key: idempotencyKey,
          },
          idempotencyKey,
        );
        setCreatedOrder(order);
        setTrackedOrder(order);
      } catch (e) {
        setError(errMsg(e));
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    setActiveStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setError(null);
    setActiveStep((s) => Math.max(s - 1, 0));
  };

  const addSan = () => {
    const v = newSan.trim();
    if (!v) return;
    if (sanList.includes(v)) return;
    setSanList([...sanList, v]);
    setNewSan('');
  };

  const removeSan = (s) => setSanList(sanList.filter((x) => x !== s));

  const canGoNext = useMemo(() => {
    if (loading) return false;
    if (activeStep === 0) return !!precheckData;
    if (activeStep === 1) return sanList.length > 0 || !!precheckData?.common_name;
    if (activeStep === 2) return !!previewData;
    return false;
  }, [activeStep, loading, precheckData, previewData, sanList]);

  const nextLabel = useMemo(() => {
    if (activeStep === 2) return 'Submit renewal';
    if (activeStep === 3) return 'Close';
    return 'Next';
  }, [activeStep]);

  const handleNextOrClose = () => {
    if (activeStep === 3) {
      onClose?.();
      return;
    }
    handleNext();
  };

  if (!certificate) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>
          DigiCert API Renewal –{' '}
          <strong>{certificate.common_name || certificate.name}</strong>
        </span>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading && activeStep < 3 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {/* ---------- Step 1: Precheck ---------- */}
        {activeStep === 0 && !loading && precheckData && (
          <Box>
            <Typography variant="body1" sx={{ mb: 2 }}>
              This will open a new renewal order on DigiCert <strong>automatically</strong>. A new
              private key and CSR will be generated. The existing cert on the F5 is not touched
              until you confirm deployment.
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <InfoRow label="Common Name" value={precheckData.common_name} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <InfoRow
                  label="Days to expiration"
                  value={
                    precheckData.days_until_expiration != null
                      ? `${precheckData.days_until_expiration} days`
                      : '—'
                  }
                />
              </Grid>
              <Grid item xs={12}>
                <InfoRow
                  label="Current SANs"
                  value={
                    precheckData.current_sans?.length
                      ? precheckData.current_sans.join(', ')
                      : '(only Common Name)'
                  }
                />
              </Grid>
            </Grid>

            {precheckData.early_renewal_warning && (
              <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mt: 2 }}>
                This certificate still has plenty of time before expiration. DigiCert may only
                grant partial reuse of validity time.
              </Alert>
            )}

            {precheckData.approval_required && (
              <Alert severity="info" sx={{ mt: 2 }}>
                This account requires <strong>manager approval</strong> before DigiCert issues the
                cert. Approvers will be notified automatically.
                {precheckData.approvers?.length > 0 && (
                  <Box component="div" sx={{ mt: 1 }}>
                    Approvers: {precheckData.approvers.join(', ')}
                  </Box>
                )}
              </Alert>
            )}
          </Box>
        )}

        {/* ---------- Step 2: Configure ---------- */}
        {activeStep === 1 && !loading && (
          <Box>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Configure what DigiCert will issue. You can add extra SANs or adjust validity.
            </Typography>

            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Subject Alternative Names (SANs)
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                {sanList.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No SANs configured. Only Common Name will be included.
                  </Typography>
                )}
                {sanList.map((san) => (
                  <Chip
                    key={san}
                    label={san}
                    onDelete={() => removeSan(san)}
                    deleteIcon={<DeleteIcon />}
                    variant="outlined"
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  placeholder="e.g. www.example.com"
                  value={newSan}
                  onChange={(e) => setNewSan(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSan();
                    }
                  }}
                  fullWidth
                />
                <Button onClick={addSan} variant="outlined" startIcon={<AddIcon />}>
                  Add
                </Button>
              </Box>
            </Paper>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Validity</InputLabel>
                  <Select
                    label="Validity"
                    value={validityYears}
                    onChange={(e) => setValidityYears(Number(e.target.value))}
                  >
                    <MenuItem value={1}>1 year</MenuItem>
                    <MenuItem value={2}>2 years</MenuItem>
                    <MenuItem value={3}>3 years</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Key size</InputLabel>
                  <Select
                    label="Key size"
                    value={keySize}
                    onChange={(e) => setKeySize(Number(e.target.value))}
                  >
                    <MenuItem value={2048}>RSA 2048</MenuItem>
                    <MenuItem value={3072}>RSA 3072</MenuItem>
                    <MenuItem value={4096}>RSA 4096</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={useDefaultProduct}
                      onChange={(e) => setUseDefaultProduct(e.target.checked)}
                    />
                  }
                  label="Use default product configured in Admin"
                />
                {!useDefaultProduct && (
                  <TextField
                    fullWidth
                    size="small"
                    label="DigiCert product name_id"
                    placeholder="e.g. ssl_plus"
                    value={productOverride}
                    onChange={(e) => setProductOverride(e.target.value)}
                    helperText="Use exact name_id as returned by /products endpoint"
                  />
                )}
              </Grid>
            </Grid>
          </Box>
        )}

        {/* ---------- Step 3: Confirm ---------- */}
        {activeStep === 2 && !loading && previewData && (
          <Box>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Review what will be sent to DigiCert:
            </Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={6}>
                  <InfoRow label="Common Name" value={previewData.common_name} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <InfoRow label="Product" value={previewData.product} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <InfoRow label="Validity" value={`${previewData.validity_years} year(s)`} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <InfoRow label="Key size" value={`RSA ${previewData.key_size}`} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <InfoRow label="Container" value={previewData.container_id || '(default)'} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <InfoRow label="Organization" value={previewData.organization_id || '(default)'} />
                </Grid>
                <Grid item xs={12}>
                  <InfoRow
                    label="SANs"
                    value={previewData.san_list.length ? previewData.san_list.join(', ') : '(none)'}
                  />
                </Grid>
              </Grid>
            </Paper>

            {previewData.approval_required && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Order will require manager approval before issuance.
              </Alert>
            )}
            {previewData.early_renewal_warning && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Renewing earlier than DigiCert's validity reuse threshold. You may lose time.
              </Alert>
            )}

            <Alert severity="warning" sx={{ mt: 2 }}>
              Clicking <strong>Submit renewal</strong> creates a real order on DigiCert and{' '}
              <strong>consumes quota</strong>. No deploy to F5 happens until you confirm it
              afterwards.
            </Alert>
          </Box>
        )}

        {/* ---------- Step 4: Tracking ---------- */}
        {activeStep === 3 && (
          <Box>
            {!trackedOrder ? (
              <CircularProgress />
            ) : (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography variant="subtitle1">Order status:</Typography>
                  <Chip
                    label={statusLabel(trackedOrder.status)}
                    color={statusColor(trackedOrder.status)}
                    size="small"
                  />
                </Box>

                <Divider sx={{ mb: 2 }} />

                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={6}>
                    <InfoRow label="Local order ID" value={`#${trackedOrder.id}`} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <InfoRow
                      label="DigiCert order ID"
                      value={trackedOrder.digicert_order_id || '(pending submit)'}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <InfoRow
                      label="DigiCert cert ID"
                      value={trackedOrder.digicert_certificate_id || '—'}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <InfoRow
                      label="Serial"
                      value={trackedOrder.serial_number || '—'}
                    />
                  </Grid>
                </Grid>

                {trackedOrder.error_message && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {trackedOrder.error_message}
                  </Alert>
                )}

                {trackedOrder.status === 'NEEDS_APPROVAL' && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    Waiting for manager approval on DigiCert. Approvers have been notified.
                  </Alert>
                )}

                {(trackedOrder.status === 'ISSUED' ||
                  trackedOrder.status === 'DOWNLOADED') && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    Certificate has been issued. You can now deploy it to your F5 devices
                    from the <strong>DigiCert Renewals</strong> page.
                  </Alert>
                )}

                {trackedOrder.status === 'DEPLOYED' && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    Renewal completed and deployed successfully.
                  </Alert>
                )}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {activeStep < 3 && (
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        {activeStep > 0 && activeStep < 3 && (
          <Button onClick={handleBack} disabled={loading}>
            Back
          </Button>
        )}
        <Button
          variant="contained"
          onClick={handleNextOrClose}
          disabled={activeStep < 3 && !canGoNext}
          color={activeStep === 2 ? 'warning' : 'primary'}
        >
          {nextLabel}
        </Button>
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
        {value}
      </Typography>
    </Box>
  );
}

function errMsg(e) {
  return (
    e?.response?.data?.detail ||
    e?.message ||
    'Unexpected error'
  );
}

function cryptoRandom() {
  try {
    const arr = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(arr);
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
