// frontend/src/pages/admin/DigicertConfigPage.jsx
import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Stack,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import ScienceIcon from '@mui/icons-material/Science';

import {
  getConfig,
  updateConfig,
  testConnection,
  listContainers,
  listOrganizations,
  listProducts,
} from '../../api/digicert';

export default function DigicertConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [cfg, setCfg] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [changeKey, setChangeKey] = useState(false);
  const [container, setContainer] = useState('');
  const [org, setOrg] = useState('');
  const [product, setProduct] = useState('');
  const [validity, setValidity] = useState(1);
  const [keySize, setKeySize] = useState(2048);
  const [emails, setEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [reminderHours, setReminderHours] = useState(24);

  const [containers, setContainers] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [products, setProducts] = useState([]);
  const [testResult, setTestResult] = useState(null);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const c = await getConfig();
      setCfg(c);
      setContainer(c.container_id || '');
      setOrg(c.organization_id || '');
      setProduct(c.default_product || '');
      setValidity(c.default_validity_years || 1);
      setKeySize(c.default_key_size || 2048);
      setEmails(c.approval_notify_emails || []);
      setReminderHours(c.approval_reminder_interval_hours || 24);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  const loadLookups = async () => {
    // Solo pedimos lookups si el feature está habilitado y hay api_key
    if (!cfg?.api_key_set) return;
    try {
      const [c, o, p] = await Promise.all([
        listContainers().catch(() => []),
        listOrganizations().catch(() => []),
        listProducts().catch(() => []),
      ]);
      setContainers(c);
      setOrgs(o);
      setProducts(p);
    } catch {
      /* silent */
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (cfg?.api_key_set) loadLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.api_key_set]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const payload = {
        container_id: container || null,
        organization_id: org || null,
        default_product: product || null,
        default_validity_years: validity,
        default_key_size: keySize,
        approval_notify_emails: emails,
        approval_reminder_interval_hours: reminderHours,
      };
      if (changeKey && apiKey) {
        payload.api_key = apiKey;
      }
      const updated = await updateConfig(payload);
      setCfg(updated);
      setChangeKey(false);
      setApiKey('');
      setSuccess('Configuration saved');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const r = await testConnection();
      setTestResult(r);
    } catch (e) {
      setTestResult({ ok: false, message: errMsg(e) });
    } finally {
      setTesting(false);
    }
  };

  const addEmail = () => {
    const v = newEmail.trim();
    if (!v || emails.includes(v)) return;
    setEmails([...emails, v]);
    setNewEmail('');
  };

  if (loading) {
    return (
      <Container sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 2 }}>
        DigiCert Provider
      </Typography>

      {!cfg?.feature_enabled && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Feature flag <code>ENABLE_DIGICERT_RENEWAL</code> is disabled. Renewals via DigiCert API
          are currently unavailable. Enable it in backend environment variables.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          API Credentials
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Current key:
              </Typography>
              {cfg?.api_key_set ? (
                <Chip label={`••••${cfg.api_key_last4 || '????'}`} color="success" size="small" />
              ) : (
                <Chip label="Not set" color="default" size="small" />
              )}
              <Box sx={{ flex: 1 }} />
              {!changeKey && (
                <Button variant="outlined" size="small" onClick={() => setChangeKey(true)}>
                  {cfg?.api_key_set ? 'Change key' : 'Set key'}
                </Button>
              )}
            </Box>
            {changeKey && (
              <TextField
                label="DigiCert API Key (X-DC-DEVKEY)"
                fullWidth
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                helperText="Stored encrypted at rest. Only last 4 chars are shown after save."
              />
            )}
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              Base URL: <code>{cfg?.base_url}</code>
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Button
              onClick={handleTest}
              startIcon={testing ? <CircularProgress size={16} /> : <ScienceIcon />}
              disabled={testing || !cfg?.api_key_set}
              variant="outlined"
            >
              Test connection
            </Button>
            {testResult && (
              <Alert severity={testResult.ok ? 'success' : 'error'} sx={{ mt: 1 }}>
                {testResult.message}
              </Alert>
            )}
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Defaults
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Container</InputLabel>
              <Select
                label="Container"
                value={container}
                onChange={(e) => setContainer(e.target.value)}
              >
                <MenuItem value="">(none)</MenuItem>
                {containers.map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    {c.name} (#{c.id})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Organization</InputLabel>
              <Select label="Organization" value={org} onChange={(e) => setOrg(e.target.value)}>
                <MenuItem value="">(none)</MenuItem>
                {orgs.map((o) => (
                  <MenuItem key={o.id} value={String(o.id)}>
                    {o.name} (#{o.id})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Default product</InputLabel>
              <Select
                label="Default product"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
              >
                <MenuItem value="">(none)</MenuItem>
                {products.map((p) => (
                  <MenuItem key={p.name_id} value={p.name_id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Default validity</InputLabel>
              <Select
                label="Default validity"
                value={validity}
                onChange={(e) => setValidity(Number(e.target.value))}
              >
                <MenuItem value={1}>1 year</MenuItem>
                <MenuItem value={2}>2 years</MenuItem>
                <MenuItem value={3}>3 years</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Default key size</InputLabel>
              <Select
                label="Default key size"
                value={keySize}
                onChange={(e) => setKeySize(Number(e.target.value))}
              >
                <MenuItem value={2048}>RSA 2048</MenuItem>
                <MenuItem value={3072}>RSA 3072</MenuItem>
                <MenuItem value={4096}>RSA 4096</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Manager approval notifications
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Approvers that should be reminded while a DigiCert order sits in{' '}
          <code>NEEDS_APPROVAL</code>.
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
          {emails.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No emails configured.
            </Typography>
          )}
          {emails.map((e) => (
            <Chip
              key={e}
              label={e}
              onDelete={() => setEmails(emails.filter((x) => x !== e))}
              deleteIcon={<DeleteIcon />}
              sx={{ mb: 1 }}
            />
          ))}
        </Stack>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            size="small"
            placeholder="approver@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addEmail();
              }
            }}
            fullWidth
          />
          <Button onClick={addEmail} startIcon={<AddIcon />} variant="outlined">
            Add
          </Button>
        </Box>
        <TextField
          label="Reminder interval (hours)"
          type="number"
          size="small"
          value={reminderHours}
          onChange={(e) => setReminderHours(Number(e.target.value) || 0)}
          inputProps={{ min: 1, max: 168 }}
        />
      </Paper>

      <Divider sx={{ mb: 2 }} />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
        >
          Save configuration
        </Button>
      </Box>
    </Container>
  );
}

function errMsg(e) {
  return e?.response?.data?.detail || e?.message || 'Unexpected error';
}
