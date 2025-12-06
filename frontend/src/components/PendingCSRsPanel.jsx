/**
 * Pending CSRs Panel
 * 
 * Shows a list of CSR requests that are pending completion.
 * Allows users to:
 * - View pending CSRs
 * - Complete them with signed certificates
 * - Download ready PFX files
 * - Delete abandoned requests
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CheckCircle as CompleteIcon,
  ContentCopy as CopyIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { listPendingCSRs, deleteCSRRequest, completeCSR, getCSRDownloadUrl } from '../services/api';

const STATUS_COLORS = {
  CSR_GENERATED: 'warning',
  CERT_RECEIVED: 'info',
  PFX_READY: 'success',
  DEPLOYED: 'success',
  COMPLETED: 'default',
  FAILED: 'error',
  EXPIRED: 'error',
};

const STATUS_LABELS = {
  CSR_GENERATED: 'Awaiting CA',
  CERT_RECEIVED: 'Processing',
  PFX_READY: 'Ready to Deploy',
  DEPLOYED: 'Deployed',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
};

const PendingCSRsPanel = ({ onRefresh }) => {
  const [pendingCSRs, setPendingCSRs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Complete dialog state
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [selectedCSR, setSelectedCSR] = useState(null);
  const [signedCert, setSignedCert] = useState('');
  const [chainCert, setChainCert] = useState('');
  const [pfxPassword, setPfxPassword] = useState('');
  const [completing, setCompleting] = useState(false);
  
  // View CSR dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingCSR, setViewingCSR] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchPendingCSRs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPendingCSRs();
      setPendingCSRs(data.pending_requests || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch pending CSRs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingCSRs();
  }, [fetchPendingCSRs]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this CSR request? The private key will be permanently lost.')) {
      return;
    }
    try {
      await deleteCSRRequest(id);
      fetchPendingCSRs();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete CSR request');
    }
  };

  const handleOpenComplete = (csr) => {
    setSelectedCSR(csr);
    setSignedCert('');
    setChainCert('');
    setPfxPassword('');
    setCompleteDialogOpen(true);
  };

  const handleComplete = async () => {
    if (!selectedCSR || !signedCert.trim()) return;
    
    setCompleting(true);
    try {
      await completeCSR(selectedCSR.id, signedCert, chainCert || null, pfxPassword || null);
      setCompleteDialogOpen(false);
      fetchPendingCSRs();
      onRefresh?.();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to complete CSR');
    } finally {
      setCompleting(false);
    }
  };

  const handleViewCSR = (csr) => {
    setViewingCSR(csr);
    setViewDialogOpen(true);
  };

  const handleCopyCSR = async () => {
    if (viewingCSR?.csr_pem) {
      try {
        await navigator.clipboard.writeText(viewingCSR.csr_pem);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  if (loading && pendingCSRs.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Pending CSR Requests</Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={fetchPendingCSRs} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>
      
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {pendingCSRs.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No pending CSR requests. Generate a new CSR to start the renewal process.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Common Name</TableCell>
                <TableCell>SANs</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pendingCSRs.map((csr) => (
                <TableRow key={csr.id} hover>
                  <TableCell>{csr.id}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {csr.common_name}
                    </Typography>
                    {csr.certificate_name && (
                      <Typography variant="caption" color="text.secondary">
                        Linked: {csr.certificate_name}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {csr.san_names?.length > 0 ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {csr.san_names.slice(0, 3).map((san, i) => (
                          <Chip key={i} label={san} size="small" variant="outlined" />
                        ))}
                        {csr.san_names.length > 3 && (
                          <Chip label={`+${csr.san_names.length - 3}`} size="small" />
                        )}
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={STATUS_LABELS[csr.status] || csr.status}
                      color={STATUS_COLORS[csr.status] || 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(csr.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View CSR">
                      <IconButton size="small" onClick={() => handleViewCSR(csr)}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    
                    {csr.status === 'CSR_GENERATED' && (
                      <Tooltip title="Complete with signed certificate">
                        <IconButton 
                          size="small" 
                          color="primary"
                          onClick={() => handleOpenComplete(csr)}
                        >
                          <CompleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    {csr.status === 'PFX_READY' && (
                      <Tooltip title="Download PFX">
                        <IconButton 
                          size="small" 
                          color="success"
                          component="a"
                          href={getCSRDownloadUrl(csr.id)}
                          download
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    <Tooltip title="Delete request">
                      <IconButton 
                        size="small" 
                        color="error"
                        onClick={() => handleDelete(csr.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {/* Complete Dialog */}
      <Dialog open={completeDialogOpen} onClose={() => setCompleteDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Complete CSR: {selectedCSR?.common_name}
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Paste the signed certificate from your CA to generate the PFX file.
          </Alert>
          
          <TextField
            fullWidth
            multiline
            rows={8}
            label="Signed Certificate (PEM)"
            value={signedCert}
            onChange={(e) => setSignedCert(e.target.value)}
            placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
            sx={{ mb: 2 }}
            required
          />
          
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Certificate Chain (optional)"
            value={chainCert}
            onChange={(e) => setChainCert(e.target.value)}
            placeholder="Intermediate CA certificates"
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            label="PFX Password (optional)"
            value={pfxPassword}
            onChange={(e) => setPfxPassword(e.target.value)}
            type="password"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompleteDialogOpen(false)} disabled={completing}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleComplete}
            disabled={!signedCert.trim() || completing}
            color="success"
          >
            {completing ? <CircularProgress size={24} /> : 'Complete & Generate PFX'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* View CSR Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          CSR Details: {viewingCSR?.common_name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">Status</Typography>
            <Box>
              <Chip 
                label={STATUS_LABELS[viewingCSR?.status] || viewingCSR?.status}
                color={STATUS_COLORS[viewingCSR?.status] || 'default'}
                size="small"
              />
            </Box>
          </Box>
          
          {viewingCSR?.san_names?.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">SANs</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {viewingCSR.san_names.map((san, i) => (
                  <Chip key={i} label={san} size="small" variant="outlined" />
                ))}
              </Box>
            </Box>
          )}
          
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Certificate Signing Request</Typography>
          <TextField
            fullWidth
            multiline
            rows={12}
            value={viewingCSR?.csr_pem || ''}
            InputProps={{ 
              readOnly: true,
              sx: { fontFamily: 'monospace', fontSize: '0.75rem' }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button 
            startIcon={<CopyIcon />} 
            onClick={handleCopyCSR}
            color={copied ? 'success' : 'primary'}
          >
            {copied ? 'Copied!' : 'Copy CSR'}
          </Button>
          <Button onClick={() => setViewDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PendingCSRsPanel;
