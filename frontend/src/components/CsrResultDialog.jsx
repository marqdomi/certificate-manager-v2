import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Typography, Snackbar, Alert } from '@mui/material';

const CsrResultDialog = ({ open, onClose, data }) => {
  const [copied, setCopied] = React.useState(false);
  if (!data) return null;
  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (e) {
      // no-op: best effort; browsers without permissions will silently fail
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>CSR Generated Successfully</DialogTitle>
      <DialogContent>
        <Typography variant="body2" gutterBottom>
          Copy the CSR below and submit it to your Certificate Authority. The new private key has been securely stored.
        </Typography>
        <Box sx={{ mt: 2 }}>
          <TextField multiline fullWidth rows={15} value={data.csr} InputProps={{ readOnly: true }} />
          <Button onClick={() => handleCopy(data.csr)} sx={{ mt: 1 }}>Copy CSR</Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setCopied(false)} severity="success" sx={{ width: '100%' }}>
          CSR copied to clipboard
        </Alert>
      </Snackbar>
    </Dialog>
  );
};
export default CsrResultDialog;