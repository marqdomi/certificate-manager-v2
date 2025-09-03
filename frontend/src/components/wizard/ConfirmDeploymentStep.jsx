import React, { useState, useEffect } from 'react';
import { Box, Alert, Typography, FormControlLabel, Checkbox, Button, TextField, Stack } from '@mui/material';
import { executeDeployment, planDeployment, verifyInstalledCert, refreshDeviceCerts } from '../../services/api';
import PlanPreview from './PlanPreview';

export default function ConfirmDeploymentStep({ device, certName, previewData, uploadPayload, onResult, onDone, onNotify }) {
  const [installChainFromPfx, setInstallChainFromPfx] = useState(false);
  const [useExistingChain, setUseExistingChain] = useState(true);
  const [chainName, setChainName] = useState('DigiCert_Global_G2_TLS_RSA_SHA256_2020_CA1');
  const [updateProfiles, setUpdateProfiles] = useState(true);
  const [dryRun, setDryRun] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [plan, setPlan] = useState(null);
  const [executed, setExecuted] = useState(false);
  const [newObjectName, setNewObjectName] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const isValidated = uploadPayload?.validated === true;

  // Helpers used by the buttons under the plan
  const openPlanInNewTab = (p) => {
    try {
      const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (_) { /* no-op */ }
  };
  const downloadPlan = (p) => {
    try {
      const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deploy-plan-${device?.hostname || 'device'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (_) { /* no-op */ }
  };

  const onConfirm = async () => {
    setError(null);
    setSubmitting(true);
    setPlan(null);

    try {
      const payload = {
        deviceId: device?.id,
        oldCertName: certName,
        mode: uploadPayload?.mode,
        chainName,
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
        setPlan(data?.plan || data);
        if (typeof onNotify === 'function') onNotify('Plan preview generated.', 'info');
      } else {
        const data = await executeDeployment(payload);
        // Try to pick the new object name from common shapes
        const createdName =
          data?.result?.new_cert_object ||
          data?.new_cert_object ||
          data?.new_object_name ||
          null;
        setExecuted(true);
        setNewObjectName(createdName);
        setVerifyResult(null);

        // Fire-and-forget rescan of certificates so Inventory reflects new state
        try {
          refreshDeviceCerts(device?.id, { fast: true });
          onNotify?.('Triggered certificate rescan on device to update inventory.', 'info');
        } catch (_) { /* no-op */ }

        if (typeof onNotify === 'function') {
          const upd = Array.isArray(data?.result?.updated_profiles)
            ? data.result.updated_profiles.length
            : (data?.updated_profiles?.length ?? data?.updated_count ?? null);
          const msg = upd != null
            ? `Deployment completed on ${device?.hostname || 'device'}. Updated ${upd} SSL profile${upd === 1 ? '' : 's'}.`
            : `Deployment completed on ${device?.hostname || 'device'}.`;
          onNotify(msg, 'success');
        }
        onResult && onResult(data);
        // NOTE: Do not auto-close. The user can Verify and then Finish.
      }
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || String(e);
      setError(msg);
      if (typeof onNotify === 'function') onNotify(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!device?.id || !newObjectName) return;
    setVerifying(true);
    setError(null);
    try {
      const data = await verifyInstalledCert(device.id, newObjectName);
      setVerifyResult(data);
      if (typeof onNotify === 'function') onNotify('Verification completed.', 'success');
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || String(e);
      setError(msg);
      if (typeof onNotify === 'function') onNotify(msg, 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleFinish = () => {
    // allow parent to close the dialog explicitly
    onDone && onDone();
  };

  useEffect(() => { setError(null); setPlan(null); }, [dryRun, device?.id, certName]);

  return (
    <Box>
      {!uploadPayload ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You haven't uploaded/validated a certificate yet. Go back to the previous step to upload a PFX or paste PEMs.
        </Alert>
      ) : (!isValidated ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          You have selected a certificate but it has not been validated yet. Click <strong>Validate</strong> in the previous step to enable deployment actions.
        </Alert>
      ) : null)}

      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        Confirm deployment on <strong>{device?.hostname}</strong> for cert <strong>{certName}</strong>
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        New certificate: <strong>{uploadPayload?.parsed?.cn || 'N/A'}</strong> (expires {uploadPayload?.parsed?.not_after || 'N/A'})
      </Alert>

      {executed && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Deployment finished on <strong>{device?.hostname}</strong>.
          {newObjectName ? <> New object: <code>{newObjectName}</code>.</> : null}
        </Alert>
      )}

      {uploadPayload?.mode === 'pfx' && (
        <FormControlLabel
          control={<Checkbox checked={installChainFromPfx} onChange={e => setInstallChainFromPfx(e.target.checked)} />}
          label="Install chain from PFX (off by default)"
        />
      )}

      <FormControlLabel
        control={<Checkbox checked={useExistingChain} onChange={e => setUseExistingChain(e.target.checked)} />}
        label="Use existing chain object"
      />
      {useExistingChain && (
        <TextField
          label="Chain object name"
          value={chainName}
          onChange={e => setChainName(e.target.value)}
          sx={{ mt: 1 }}
        />
      )}

      <FormControlLabel
        control={<Checkbox checked={updateProfiles} onChange={e => setUpdateProfiles(e.target.checked)} />}
        label="Update detected profiles"
      />

      <FormControlLabel
        control={<Checkbox checked={dryRun} onChange={e => setDryRun(e.target.checked)} />}
        label="Simulate changes (dry-run)"
      />

      <Box mt={2}>
        {!executed ? (
          <Button variant="contained" onClick={onConfirm} disabled={submitting || !isValidated}>
            {submitting ? 'Submitting…' : (dryRun ? 'Preview Plan' : 'Confirm & Deploy')}
          </Button>
        ) : (
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={handleVerify} disabled={verifying || !newObjectName}>
              {verifying ? 'Verifying…' : 'Verify now'}
            </Button>
            <Button variant="contained" color="primary" onClick={handleFinish}>
              Finish
            </Button>
          </Stack>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      {verifyResult && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <div><strong>Verification:</strong></div>
          <div>Version: {verifyResult.version ?? 'N/A'}</div>
          <div>Subject: {verifyResult.subject ?? 'N/A'}</div>
          <div>SAN: {Array.isArray(verifyResult.san) ? verifyResult.san.join(', ') : (verifyResult.san || 'N/A')}</div>
          <div>Fingerprint (SHA-256): <code>{verifyResult.fingerprint_sha256 || 'N/A'}</code></div>
        </Alert>
      )}

      {plan && (
        <Box sx={{ mt: 2 }}>
          <PlanPreview plan={plan} />
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button size="small" onClick={() => openPlanInNewTab(plan)}>Open plan (JSON)</Button>
            <Button size="small" onClick={() => downloadPlan(plan)}>Download plan</Button>
          </Stack>
        </Box>
      )}
    </Box>
  );
}