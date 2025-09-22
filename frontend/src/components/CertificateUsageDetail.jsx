import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/api';
import { 
    Box, 
    Typography, 
    CircularProgress, 
    List, 
    ListItem, 
    ListItemText, 
    Divider, 
    Chip,
    Paper,
    Alert,
    Button,
    Stack
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const MAX_ATTEMPTS = 3;
const REQ_TIMEOUT_MS = 120000; // 120s por intento
const RETRIABLE_HTTP = new Set([408, 429, 500, 502, 503, 504]);

const classifyError = (e) => {
  const http = e?.response?.status;
  const code = e?.code;
  const msg = e?.message || '';
  let title = 'Connection error';
  let hint = '';
  let retriable = false;

  if (code === 'ECONNABORTED') {
    title = 'Request timed out (120s) contacting F5';
    hint = 'The device took too long to respond. We will retry automatically.';
    retriable = true;
  } else if (http === 401) {
    title = 'Unauthorized (401) on F5';
    hint = 'Check device credentials/role.';
    retriable = false;
  } else if ([408, 429, 500, 502, 503, 504].includes(http)) {
    title = `F5 responded ${http}`;
    hint = 'The F5 may be busy or temporarily unstable. We will retry.';
    retriable = true;
  } else if (!http && msg && /Network|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|No route to host/i.test(msg)) {
    title = 'Could not establish connection to host';
    hint = 'Verify network connectivity and ports.';
    retriable = true;
  }

  return { code: http || code || 'ERR', retriable, title, hint, raw: JSON.stringify({
    http, code, message: msg, data: e?.response?.data
  }, null, 2) };
};

const CertificateUsageDetail = ({ certId }) => {
  const [usage, setUsage] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | retrying | success | error
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(null);

  const fetchUsage = useCallback(async (n = 1) => {
    if (!certId) return;
    setAttempt(n);
    setStatus(n === 1 ? 'loading' : 'retrying');
    setError(null);

    try {
      const res = await apiClient.get(`/certificates/${certId}/usage?fast=1`, { timeout: REQ_TIMEOUT_MS });
      setUsage(res.data || {});
      setStatus('success');
    } catch (e) {
      const http = e?.response?.status;
      const code = e?.code; // axios timeout => 'ECONNABORTED'
      const retriable = code === 'ECONNABORTED' || RETRIABLE_HTTP.has(http);

      if (retriable && n < MAX_ATTEMPTS) {
        const backoff = Math.min(1500 * 2 ** (n - 1), 6000);
        setTimeout(() => fetchUsage(n + 1), backoff);
      } else {
        setError(e);
        setStatus('error');
      }
    }
  }, [certId]);

  useEffect(() => {
    fetchUsage(1);
  }, [fetchUsage]);

  if (status === 'loading' || status === 'retrying') {
    return (
      <Box sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <CircularProgress size={22} />
          <Typography variant="body2">
            {status === 'loading' ? 'Contacting backend…' : `Retrying… (attempt ${attempt}/${MAX_ATTEMPTS})`}
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <Alert severity="error" sx={{ m: 1 }}>
        Failed to load usage details. Please try again.
        <Box sx={{ mt: 1 }}>
          <Button variant="outlined" size="small" onClick={() => fetchUsage(1)}>
            Retry (live)
          </Button>
        </Box>
      </Alert>
    );
  }

  const profiles = Array.isArray(usage?.profiles)
    ? usage.profiles
    : (Array.isArray(usage?.profile_refs) ? usage.profile_refs : []);
  const virtualServers = Array.isArray(usage?.virtual_servers)
    ? usage.virtual_servers
    : (Array.isArray(usage?.vips) ? usage.vips : []);

  if (profiles.length === 0 && virtualServers.length === 0) {
    return <Alert severity="info" sx={{ m: 1 }}>No usage data available for this certificate.</Alert>;
  }

  return (
    <Box>
      {profiles.length > 0 && (
        <Box mb={2}>
          <Typography variant="overline" color="text.secondary">SSL Profiles</Typography>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            {`Used in ${profiles.length} Profile${profiles.length === 1 ? '' : 's'}`}
          </Typography>
          <List dense>
            {profiles.map((p, idx) => (
              <ListItem key={idx} sx={{ pl: 1 }}>
                <ListItemText primary={typeof p === 'string' ? p : p?.name ?? ''} />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {virtualServers.length > 0 && (
        <>
          {profiles.length > 0 && <Divider sx={{ my: 2 }} />}

          <Box>
            <Typography variant="overline" color="text.secondary">Virtual Servers</Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
              {`Applied to ${virtualServers.length} Server${virtualServers.length === 1 ? '' : 's'}`}
            </Typography>
            <List>
              {virtualServers.map((vs, idx) => {
                const name = typeof vs === 'string' ? vs : vs?.name;
                const destination = typeof vs === 'string' ? '' : vs?.destination;
                const state = typeof vs === 'string' ? '' : (vs?.state ?? '');
                return (
                  <Paper key={name ?? idx} variant="outlined" sx={{ mb: 1.5, p: 1, borderRadius: 2 }}>
                    <ListItem>
                      <ListItemText 
                        primary={name} 
                        primaryTypographyProps={{ fontWeight: 'bold' }}
                        secondary={destination}
                      />
                      <Chip 
                        icon={state === 'enabled' ? <CheckCircleIcon /> : null} 
                        label={state || '—'} 
                        color={state === 'enabled' ? 'success' : 'default'} 
                        size="small"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </ListItem>
                  </Paper>
                );
              })}
            </List>
          </Box>
        </>
      )}

      <Divider sx={{ my: 1.5 }} />
      <Button variant="outlined" size="small" onClick={() => fetchUsage(1)}>
        Retry live lookup
      </Button>
    </Box>
  );
};

export default CertificateUsageDetail;