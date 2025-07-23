// frontend/src/components/CsrResultDialog.jsx
import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Typography } from '@mui/material';

const CsrResultDialog = ({ open, onClose, data }) => {
  if (!data) return null;
  const handleCopy = (text) => navigator.clipboard.writeText(text);

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
    </Dialog>
  );
};
export default CsrResultDialog;