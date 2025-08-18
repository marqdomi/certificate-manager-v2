import React, { useState } from 'react';
import { Box, Alert, Typography, FormControlLabel, Checkbox, Button, TextField, Stack } from '@mui/material';
import { executeDeployment, planDeployment } from '../../services/api';
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

  const [driftInfo, setDriftInfo] = useState(null); // { added: string[], removed: string[], vipChanged: Array<{key:string, added:string[], removed:string[]}> }
  const [requireSecondConfirm, setRequireSecondConfirm] = useState(false);
  const [driftChecking, setDriftChecking] = useState(false);
  const [driftError, setDriftError] = useState(null);

  const isValidated = uploadPayload?.validated === true;

  const profileKey = (p) => `${p?.partition || 'Common'}/${p?.name}`;

  const normalizeProfiles = (list) => {
    const map = new Map();
    (list || []).forEach((p) => {
      const key = profileKey(p);
      const vips = new Set((p?.vips || []).filter(Boolean));
      map.set(key, { key, vips });
    });
    return map;
  };

  const diffProfiles = (cached, live) => {
    const A = normalizeProfiles(cached);
    const B = normalizeProfiles(live);

    const added = [];
    const removed = [];
    const vipChanged = [];

    // Added / removed profiles
    for (const k of B.keys()) { if (!A.has(k)) added.push(k); }
    for (const k of A.keys()) { if (!B.has(k)) removed.push(k); }

    // VIP differences for common profiles
    for (const k of A.keys()) {
      if (B.has(k)) {
        const a = A.get(k).vips;
        const b = B.get(k).vips;
        const addV = [...b].filter(x => !a.has(x));
        const remV = [...a].filter(x => !b.has(x));
        if (addV.length || remV.length) {
          vipChanged.push({ key: k, added: addV, removed: remV });
        }
      }
    }
    return { added, removed, vipChanged };
  };

  const fetchLivePreview = async () => {
    const params = new URLSearchParams();
    if (device?.id != null) params.set('device_id', String(device.id));
    else if (device?.hostname) params.set('device_hostname', device.hostname);
    params.set('cert_name', certName || '');
    params.set('timeout', '10');

    const res = await fetch(`/api/v1/f5/impact-preview?${params.toString()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`impact-preview failed: ${res.status} ${txt}`);
    }
    const data = await res.json();
    if (data?.error) {
      throw new Error(String(data.error));
    }
    return Array.isArray(data?.profiles) ? data.profiles : [];
  };

  const onConfirm = async () => {
    setError(null);
    setDriftError(null);
    setSubmitting(true);
    setPlan(null);

    try {
      // If it's a real deploy, run a live drift-check unless user already confirmed once
      if (!dryRun && !requireSecondConfirm) {
        try {
          setDriftChecking(true);
          const liveProfiles = await fetchLivePreview();
          const cachedProfiles = Array.isArray(previewData?.profiles) ? previewData.profiles : [];
          const diff = diffProfiles(cachedProfiles, liveProfiles);
          const hasDrift = (diff.added.length + diff.removed.length + diff.vipChanged.length) > 0;
          if (hasDrift) {
            setDriftInfo(diff);
            setRequireSecondConfirm(true); // Arm second-click confirmation
            if (typeof onNotify === 'function') {
              onNotify(
                `Differences detected since preview: +${diff.added.length} / -${diff.removed.length} profiles, ${diff.vipChanged.length} VIP set changes. Click again to proceed.`,
                'warning'
              );
            }
            return; // stop here; wait for user to click again
          }
        } catch (driftErr) {
          // If drift-check fails, require explicit second confirmation
          setDriftError(driftErr.message || String(driftErr));
          setRequireSecondConfirm(true);
          if (typeof onNotify === 'function') {
            onNotify(`Could not run live check: ${driftErr.message || driftErr}`, 'warning');
          }
          return;
        } finally {
          setDriftChecking(false);
        }
      }

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
        setRequireSecondConfirm(false);
        setDriftInfo(null);
        if (typeof onNotify === 'function') {
          onNotify('Plan preview generated.', 'info');
        }
      } else {
        const data = await executeDeployment(payload);
        if (typeof onNotify === 'function') {
          const upd = Array.isArray(data?.updated_profiles) ? data.updated_profiles.length : (data?.updated_count ?? null);
          const msg = upd != null
            ? `Deployment completed on ${device?.hostname || 'device'}. Updated ${upd} SSL profile${upd === 1 ? '' : 's'}.`
            : `Deployment completed on ${device?.hostname || 'device'}.`;
          onNotify(msg, 'success');
        }
        setRequireSecondConfirm(false);
        setDriftInfo(null);
        onResult && onResult(data);
        onDone && onDone();
      }
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || String(e);
      setError(msg);
      if (typeof onNotify === 'function') {
        onNotify(msg, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  React.useEffect(() => {
    setRequireSecondConfirm(false);
    setDriftInfo(null);
    setDriftError(null);
  }, [dryRun, device?.id, certName]);

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

      {requireSecondConfirm && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {driftError ? (
            <>
              Live drift-check could not be completed: <strong>{driftError}</strong>.<br/>
              Click <em>Confirm & Deploy</em> again to proceed anyway.
            </>
          ) : driftInfo ? (
            <>
              Differences detected since preview. Profiles <strong>added</strong>: {driftInfo.added.length}, <strong>removed</strong>: {driftInfo.removed.length},
              <strong> VIP updates</strong>: {driftInfo.vipChanged.length}.<br/>
              Click <em>Confirm & Deploy</em> again to proceed anyway, or go back and refresh the preview.
            </>
          ) : (
            <>Differences or uncertainty detected. Click again to proceed anyway.</>
          )}
        </Alert>
      )}

      <Box mt={2}>
        <Button variant="contained" onClick={onConfirm} disabled={submitting || !isValidated}>
          {submitting
            ? 'Submitting…'
            : (dryRun
              ? 'Preview Plan'
              : (requireSecondConfirm ? 'Confirm & Deploy (proceed anyway)' : 'Confirm & Deploy'))}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

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