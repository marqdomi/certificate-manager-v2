// frontend/src/components/ConfirmDialog.jsx

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

const ConfirmDialog = ({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm' }) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      <DialogTitle id="confirm-dialog-title" sx={{ display: 'flex', alignItems: 'center' }}>
        <WarningAmberIcon color="warning" sx={{ mr: 1 }} />
        {title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="confirm-dialog-description">
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>
          Cancel
        </Button>
        {/* Usamos color="error" para el botón de confirmación destructiva */}
        <Button onClick={onConfirm} variant="contained" color="error" autoFocus>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;