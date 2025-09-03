// frontend/src/components/wizard/UploadCertStep.jsx
import React, { useState } from 'react';
import { Box, Tabs, Tab, TextField, Button, Alert, Typography } from '@mui/material';
import { validateDeployment } from '../../services/api';

export default function UploadCertStep({ onValidated, defaultMode = 'pfx' }) {
  const [mode, setMode] = useState(defaultMode);
  const [pfxFile, setPfxFile] = useState(null);
  const [pfxPassword, setPfxPassword] = useState('');
  const [certPem, setCertPem] = useState('');
  const [keyPem, setKeyPem] = useState('');
  const [chainPem, setChainPem] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const onValidate = async () => {
    setError(null);
    setLoading(true);
    try {
      const payload = { mode };
      if (mode === 'pfx') {
        payload.pfxFile = pfxFile;
        payload.pfxPassword = pfxPassword;
        if (!pfxFile) throw new Error('Please select a PFX file.');
      } else {
        payload.certPem = certPem;
        payload.keyPem = keyPem;
        payload.chainPem = chainPem || undefined;
        if (!certPem || !keyPem) throw new Error('Please paste both CERT and KEY.');
      }
      const data = await validateDeployment(payload);
      setResult(data);
      onValidated && onValidated({ mode, pfxFile, pfxPassword, certPem, keyPem, chainPem, parsed: data.parsed, warnings: data.warnings });
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Tabs value={mode} onChange={(_, v) => setMode(v)} sx={{ mb: 2 }}>
        <Tab label="Upload PFX" value="pfx" />
        <Tab label="Use PEM" value="pem" />
      </Tabs>
      <Typography variant="body2" sx={{ mb: 1 }}>Step 1: Upload a PFX file or paste PEM cert/key, then click <strong>Validate</strong>.</Typography>

      {mode === 'pfx' ? (
        <Box display="grid" gap={2}>
          <Button variant="outlined" component="label">
            Select .pfx/.p12 file
            <input type="file" accept=".pfx,.p12" hidden onChange={e => setPfxFile(e.target.files?.[0] || null)} />
          </Button>
          {pfxFile && <Typography variant="caption">Selected: {pfxFile.name}</Typography>}
          <TextField
            label="PFX password"
            type="password"
            value={pfxPassword}
            onChange={e => setPfxPassword(e.target.value)}
          />
        </Box>
      ) : (
        <Box display="grid" gap={2}>
          <TextField
            label="Certificate (PEM)"
            multiline minRows={6}
            value={certPem}
            onChange={e => setCertPem(e.target.value)}
          />
          <TextField
            label="Private Key (PEM)"
            multiline minRows={6}
            value={keyPem}
            onChange={e => setKeyPem(e.target.value)}
          />
          <TextField
            label="Chain (optional, PEM)"
            multiline minRows={4}
            value={chainPem}
            onChange={e => setChainPem(e.target.value)}
          />
        </Box>
      )}

      <Box mt={2} display="flex" gap={2}>
        <Button variant="contained" onClick={onValidate} disabled={loading}>
          {loading ? 'Validating…' : 'Validate'}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {result && (() => {
        const parsed = result.parsed || {};
        // Try multiple shapes the backend might return
        let sanList = [];
        if (Array.isArray(parsed.san)) sanList = parsed.san;
        else if (Array.isArray(parsed.subjectAltName)) sanList = parsed.subjectAltName;
        else if (Array.isArray(result.info?.san)) sanList = result.info.san;
        else if (Array.isArray(result.san)) sanList = result.san;

        return (
          <Alert severity="success" sx={{ mt: 2 }}>
            <div><strong>CN:</strong> {parsed.cn || 'N/A'}</div>
            <div><strong>Not After:</strong> {parsed.not_after || 'N/A'}</div>
            <div>
              <strong>SAN:</strong>{' '}
              {sanList.length ? (
                <>
                  {sanList.slice(0, 5).join(', ')}
                  {sanList.length > 5 ? ' …' : ''}
                </>
              ) : (
                'N/A'
              )}
            </div>
            {result.warnings?.length ? (
              <div style={{ marginTop: 8 }}>
                <strong>Warnings:</strong> {result.warnings.join(' | ')}
              </div>
            ) : null}
          </Alert>
        );
      })()}
    </Box>
  );
}