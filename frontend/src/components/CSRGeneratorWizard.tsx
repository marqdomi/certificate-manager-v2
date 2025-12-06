/**
 * CSR Generator Wizard
 * 
 * A multi-step wizard for generating CSRs and completing the renewal process:
 * 1. Enter certificate details (CN, SANs, Organization, etc.)
 * 2. Generate CSR + Private Key (displayed once - user must save!)
 * 3. User submits CSR to CA manually (DigiCert, etc.)
 * 4. Complete with signed certificate to get PFX
 * 
 * This solves the F5 key export limitation by generating keys locally.
 */

import React, { useState, useCallback, useEffect, ChangeEvent, FC } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Chip,
  Tooltip,
  Paper,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Snackbar,
  SelectChangeEvent,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { generateCSR, completeCSR, getCSRDownloadUrl } from '../services/api';
import CertificateSearchAutocomplete, { CertificateOption } from './CertificateSearchAutocomplete';
import type { 
  CSRFormData, 
  CSRGenerateResponse, 
  CSRCompleteResponse,
  CertificateToRenew 
} from '../types/csr';

const STEPS = ['Certificate Details', 'Generate CSR & Key', 'Complete with Signed Cert'];

const DEFAULT_FORM: CSRFormData = {
  common_name: '',
  organization: '',
  organizational_unit: '',
  locality: '',
  state: '',
  country: 'US',
  email: '',
  san_dns_names: [],
  san_ip_addresses: [],
  key_size: 2048,
};

interface CSRGeneratorWizardProps {
  open: boolean;
  onClose: () => void;
  certificate?: CertificateToRenew | null;
  onCompleted?: (result: CSRCompleteResponse) => void;
}

type CopiedField = 'key' | 'csr' | null;

const CSRGeneratorWizard: FC<CSRGeneratorWizardProps> = ({ 
  open, 
  onClose, 
  certificate = null, 
  onCompleted 
}) => {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [form, setForm] = useState<CSRFormData>({ ...DEFAULT_FORM });
  const [sanInput, setSanInput] = useState<string>('');
  const [ipInput, setIpInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Selected certificate from search (for renewals)
  const [selectedCertificate, setSelectedCertificate] = useState<CertificateOption | null>(null);
  
  // Generated CSR data (from step 1)
  const [csrData, setCsrData] = useState<CSRGenerateResponse | null>(null);
  
  // Completion data (step 2)
  const [signedCert, setSignedCert] = useState<string>('');
  const [chainCert, setChainCert] = useState<string>('');
  const [pfxPassword, setPfxPassword] = useState<string>('');
  const [completionResult, setCompletionResult] = useState<CSRCompleteResponse | null>(null);
  
  // Clipboard feedback
  const [copiedField, setCopiedField] = useState<CopiedField>(null);

  // Handle certificate selection from search autocomplete
  const handleCertificateSelect = (cert: CertificateOption | null) => {
    setSelectedCertificate(cert);
    if (cert) {
      // Pre-fill form with certificate data
      const sanNames = cert.san_names || [];
      setForm(prev => ({
        ...prev,
        common_name: cert.common_name || cert.name || '',
        san_dns_names: sanNames.filter((s: string) => !s.match(/^\d+\.\d+\.\d+\.\d+$/)),
        san_ip_addresses: sanNames.filter((s: string) => s.match(/^\d+\.\d+\.\d+\.\d+$/)),
      }));
    }
  };

  // Pre-fill form when editing existing certificate (from inventory)
  useEffect(() => {
    if (certificate && open) {
      const sanNames = certificate.san_names 
        ? (typeof certificate.san_names === 'string' 
            ? JSON.parse(certificate.san_names) 
            : certificate.san_names)
        : [];
      
      setForm(prev => ({
        ...prev,
        common_name: certificate.common_name || certificate.name || '',
        san_dns_names: sanNames.filter((s: string) => !s.match(/^\d+\.\d+\.\d+\.\d+$/)),
        san_ip_addresses: sanNames.filter((s: string) => s.match(/^\d+\.\d+\.\d+\.\d+$/)),
      }));
    }
  }, [certificate, open]);

  // Reset state when dialog closes
  const handleClose = useCallback(() => {
    setActiveStep(0);
    setForm({ ...DEFAULT_FORM });
    setSelectedCertificate(null);
    setSanInput('');
    setIpInput('');
    setCsrData(null);
    setSignedCert('');
    setChainCert('');
    setPfxPassword('');
    setCompletionResult(null);
    setError(null);
    onClose?.();
  }, [onClose]);

  const handleFormChange = (field: keyof CSRFormData) => (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleKeySizeChange = (e: SelectChangeEvent<number>) => {
    setForm(prev => ({ ...prev, key_size: e.target.value as 2048 | 4096 }));
  };

  const handleAddSan = (): void => {
    if (sanInput.trim() && !form.san_dns_names.includes(sanInput.trim())) {
      setForm(prev => ({
        ...prev,
        san_dns_names: [...prev.san_dns_names, sanInput.trim()]
      }));
      setSanInput('');
    }
  };

  const handleRemoveSan = (san: string): void => {
    setForm(prev => ({
      ...prev,
      san_dns_names: prev.san_dns_names.filter(s => s !== san)
    }));
  };

  const handleAddIp = (): void => {
    if (ipInput.trim() && !form.san_ip_addresses.includes(ipInput.trim())) {
      setForm(prev => ({
        ...prev,
        san_ip_addresses: [...prev.san_ip_addresses, ipInput.trim()]
      }));
      setIpInput('');
    }
  };

  const handleRemoveIp = (ip: string): void => {
    setForm(prev => ({
      ...prev,
      san_ip_addresses: prev.san_ip_addresses.filter(i => i !== ip)
    }));
  };

  const handleCopy = async (text: string, field: CopiedField): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = (content: string, filename: string): void => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Step 1: Generate CSR
  const handleGenerateCSR = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      // Use certificate from props (inventory) or from search autocomplete
      const certId = certificate?.id || selectedCertificate?.id;
      
      const payload = {
        common_name: form.common_name,
        organization: form.organization || undefined,
        organizational_unit: form.organizational_unit || undefined,
        locality: form.locality || undefined,
        state: form.state || undefined,
        country: form.country || undefined,
        email: form.email || undefined,
        san_dns_names: form.san_dns_names.length > 0 ? form.san_dns_names : undefined,
        san_ip_addresses: form.san_ip_addresses.length > 0 ? form.san_ip_addresses : undefined,
        key_size: form.key_size,
        certificate_id: certId,
      };
      
      const result = await generateCSR(payload);
      setCsrData(result);
      setActiveStep(1);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(error.response?.data?.detail || error.message || 'Failed to generate CSR');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Complete with signed certificate
  const handleComplete = async (): Promise<void> => {
    if (!csrData?.renewal_request_id) {
      setError('No renewal request ID found');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await (completeCSR as Function)(
        csrData.renewal_request_id,
        signedCert,
        chainCert || null,
        pfxPassword || null
      ) as CSRCompleteResponse;
      setCompletionResult(result);
      setActiveStep(2);
      onCompleted?.(result);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(error.response?.data?.detail || error.message || 'Failed to complete CSR');
    } finally {
      setLoading(false);
    }
  };

  // Render Step 0: Certificate Details Form
  const renderDetailsStep = (): JSX.Element => (
    <Box sx={{ mt: 2 }}>
      {/* Certificate Search - only show if no certificate was passed from inventory */}
      {!certificate && (
        <Paper 
          variant="outlined" 
          sx={{ 
            p: 2, 
            mb: 3, 
            bgcolor: 'action.hover',
            borderStyle: 'dashed'
          }}
        >
          <Typography variant="subtitle2" gutterBottom color="primary">
            🔄 Renewing an existing certificate?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Search and select a certificate to automatically fill in the details below.
          </Typography>
          <CertificateSearchAutocomplete
            onSelect={handleCertificateSelect}
            selectedCertificate={selectedCertificate}
          />
        </Paper>
      )}

      {certificate && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <strong>Renewing:</strong> {certificate.common_name || certificate.name}
          <br />
          <Typography variant="caption" color="text.secondary">
            Certificate details have been pre-filled. Review and adjust if needed.
          </Typography>
        </Alert>
      )}

      {!certificate && !selectedCertificate && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <strong>New CSR Generation</strong> — Enter certificate details below. 
          A new private key will be generated locally (not on F5).
        </Alert>
      )}

      {selectedCertificate && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <strong>Renewing:</strong> {selectedCertificate.common_name}
          {selectedCertificate.days_remaining !== undefined && selectedCertificate.days_remaining <= 60 && (
            <Chip 
              size="small" 
              label={`${selectedCertificate.days_remaining}d remaining`} 
              color={selectedCertificate.days_remaining <= 30 ? 'error' : 'warning'}
              sx={{ ml: 1 }}
            />
          )}
          <br />
          <Typography variant="caption" color="text.secondary">
            Certificate details have been pre-filled from the selected certificate.
          </Typography>
        </Alert>
      )}
      
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            required
            label="Common Name (CN)"
            value={form.common_name}
            onChange={handleFormChange('common_name')}
            placeholder="*.example.com or www.example.com"
            helperText="The primary domain name for this certificate"
          />
        </Grid>
        
        <Grid item xs={12}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Subject Alternative Names (SANs)</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <TextField
              size="small"
              label="Add DNS Name"
              value={sanInput}
              onChange={(e) => setSanInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSan())}
              placeholder="api.example.com"
              sx={{ flex: 1 }}
            />
            <Button variant="outlined" onClick={handleAddSan} startIcon={<AddIcon />}>
              Add
            </Button>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
            {form.san_dns_names.map(san => (
              <Chip
                key={san}
                label={san}
                onDelete={() => handleRemoveSan(san)}
                size="small"
                color="primary"
                variant="outlined"
              />
            ))}
            {form.san_dns_names.length === 0 && (
              <Typography variant="caption" color="text.secondary">
                No SANs added (CN will be included automatically)
              </Typography>
            )}
          </Box>
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Organization"
            value={form.organization}
            onChange={handleFormChange('organization')}
            placeholder="Your Company Inc."
          />
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Organizational Unit"
            value={form.organizational_unit}
            onChange={handleFormChange('organizational_unit')}
            placeholder="IT Department"
          />
        </Grid>
        
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="City/Locality"
            value={form.locality}
            onChange={handleFormChange('locality')}
          />
        </Grid>
        
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="State/Province"
            value={form.state}
            onChange={handleFormChange('state')}
          />
        </Grid>
        
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Country Code"
            value={form.country}
            onChange={handleFormChange('country')}
            placeholder="US"
            inputProps={{ maxLength: 2 }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Email (optional)"
            value={form.email}
            onChange={handleFormChange('email')}
            type="email"
          />
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Key Size</InputLabel>
            <Select
              value={form.key_size}
              label="Key Size"
              onChange={handleKeySizeChange}
            >
              <MenuItem value={2048}>2048 bits (Standard)</MenuItem>
              <MenuItem value={4096}>4096 bits (High Security)</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );

  // Render Step 1: CSR & Key Generated
  const renderCSRStep = (): JSX.Element => (
    <Box sx={{ mt: 2 }}>
      <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
        <strong>⚠️ IMPORTANT:</strong> Save the Private Key NOW! 
        It will NOT be shown again after closing this dialog.
      </Alert>
      
      <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'success.50' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <CheckIcon color="success" sx={{ mr: 1 }} />
          <Typography variant="subtitle1" fontWeight="bold">
            CSR Generated Successfully
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Request ID: {csrData?.renewal_request_id} • 
          CN: {csrData?.common_name} • 
          Key Size: {csrData?.key_size} bits
        </Typography>
      </Paper>
      
      {/* Private Key Section */}
      <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
        🔐 Private Key
        <Chip label="SAVE THIS!" color="error" size="small" sx={{ ml: 1 }} />
      </Typography>
      <Paper variant="outlined" sx={{ p: 1, mb: 2, bgcolor: 'grey.50' }}>
        <TextField
          fullWidth
          multiline
          rows={6}
          value={csrData?.key_pem || ''}
          InputProps={{ 
            readOnly: true,
            sx: { fontFamily: 'monospace', fontSize: '0.75rem' }
          }}
        />
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Tooltip title="Copy to clipboard">
            <Button 
              size="small" 
              startIcon={<CopyIcon />}
              onClick={() => handleCopy(csrData?.key_pem || '', 'key')}
              color={copiedField === 'key' ? 'success' : 'primary'}
            >
              {copiedField === 'key' ? 'Copied!' : 'Copy Key'}
            </Button>
          </Tooltip>
          <Tooltip title="Download as file">
            <Button 
              size="small" 
              startIcon={<DownloadIcon />}
              onClick={() => handleDownload(csrData?.key_pem || '', `${form.common_name.replace(/\*/g, 'wildcard')}.key`)}
            >
              Download .key
            </Button>
          </Tooltip>
        </Box>
      </Paper>
      
      {/* CSR Section */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        📄 Certificate Signing Request (CSR)
      </Typography>
      <Paper variant="outlined" sx={{ p: 1, mb: 2, bgcolor: 'grey.50' }}>
        <TextField
          fullWidth
          multiline
          rows={8}
          value={csrData?.csr_pem || ''}
          InputProps={{ 
            readOnly: true,
            sx: { fontFamily: 'monospace', fontSize: '0.75rem' }
          }}
        />
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Tooltip title="Copy to clipboard">
            <Button 
              size="small" 
              startIcon={<CopyIcon />}
              onClick={() => handleCopy(csrData?.csr_pem || '', 'csr')}
              color={copiedField === 'csr' ? 'success' : 'primary'}
            >
              {copiedField === 'csr' ? 'Copied!' : 'Copy CSR'}
            </Button>
          </Tooltip>
          <Tooltip title="Download as file">
            <Button 
              size="small" 
              startIcon={<DownloadIcon />}
              onClick={() => handleDownload(csrData?.csr_pem || '', `${form.common_name.replace(/\*/g, 'wildcard')}.csr`)}
            >
              Download .csr
            </Button>
          </Tooltip>
        </Box>
      </Paper>
      
      <Divider sx={{ my: 3 }} />
      
      {/* Upload Signed Certificate */}
      <Typography variant="h6" sx={{ mb: 2 }}>
        Step 2: Paste Signed Certificate from CA
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Submit the CSR above to your Certificate Authority (DigiCert, etc.), 
        then paste the signed certificate below.
      </Alert>
      
      <TextField
        fullWidth
        multiline
        rows={6}
        label="Signed Certificate (PEM)"
        value={signedCert}
        onChange={(e) => setSignedCert(e.target.value)}
        placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
        sx={{ mb: 2 }}
      />
      
      <TextField
        fullWidth
        multiline
        rows={4}
        label="Certificate Chain (optional)"
        value={chainCert}
        onChange={(e) => setChainCert(e.target.value)}
        placeholder="-----BEGIN CERTIFICATE-----&#10;(Intermediate CA)&#10;-----END CERTIFICATE-----"
        helperText="Include intermediate CA certificates if provided by your CA"
        sx={{ mb: 2 }}
      />
      
      <TextField
        fullWidth
        label="PFX Password (optional)"
        value={pfxPassword}
        onChange={(e) => setPfxPassword(e.target.value)}
        type="password"
        helperText="Password to protect the generated PFX file"
      />
    </Box>
  );

  // Render Step 2: Completion
  const renderCompletionStep = (): JSX.Element => (
    <Box sx={{ mt: 2, textAlign: 'center' }}>
      <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
      <Typography variant="h5" gutterBottom>
        PFX File Ready!
      </Typography>
      
      <Paper variant="outlined" sx={{ p: 3, my: 3, textAlign: 'left' }}>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Common Name</Typography>
            <Typography variant="body1">{completionResult?.common_name}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Issuer</Typography>
            <Typography variant="body1">{completionResult?.issuer || 'Unknown'}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Expiration</Typography>
            <Typography variant="body1">
              {completionResult?.expiration_date 
                ? new Date(completionResult.expiration_date).toLocaleDateString()
                : 'Unknown'}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">PFX File</Typography>
            <Typography variant="body1">{completionResult?.pfx_filename}</Typography>
          </Grid>
        </Grid>
      </Paper>
      
      <Button
        variant="contained"
        size="large"
        startIcon={<DownloadIcon />}
        href={getCSRDownloadUrl(csrData?.renewal_request_id || 0)}
        download
        sx={{ mr: 2 }}
      >
        Download PFX
      </Button>
      
      <Alert severity="success" sx={{ mt: 3 }}>
        {completionResult?.message || 'Certificate is ready for deployment to F5.'}
      </Alert>
    </Box>
  );

  const canProceed = (): boolean => {
    if (activeStep === 0) {
      return form.common_name.trim().length > 0;
    }
    if (activeStep === 1) {
      return signedCert.trim().length > 0;
    }
    return true;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        CSR Generator
        {certificate && (
          <Typography variant="caption" color="text.secondary" display="block">
            Renewing: {certificate.common_name || certificate.name}
          </Typography>
        )}
      </DialogTitle>
      
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {activeStep === 0 && renderDetailsStep()}
        {activeStep === 1 && renderCSRStep()}
        {activeStep === 2 && renderCompletionStep()}
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          {activeStep === 2 ? 'Close' : 'Cancel'}
        </Button>
        
        {activeStep === 0 && (
          <Button
            variant="contained"
            onClick={handleGenerateCSR}
            disabled={!canProceed() || loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Generate CSR'}
          </Button>
        )}
        
        {activeStep === 1 && (
          <Button
            variant="contained"
            onClick={handleComplete}
            disabled={!canProceed() || loading}
            color="success"
          >
            {loading ? <CircularProgress size={24} /> : 'Complete & Generate PFX'}
          </Button>
        )}
      </DialogActions>
      
      <Snackbar
        open={!!copiedField}
        autoHideDuration={2000}
        onClose={() => setCopiedField(null)}
        message="Copied to clipboard!"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Dialog>
  );
};

export default CSRGeneratorWizard;
