// frontend/src/components/shared/ConfirmDialog.jsx
// ============================================================================
// Reusable confirmation dialog for destructive actions
// ============================================================================
// Replaces window.confirm() and ad-hoc confirm dialogs across pages.
//
// Usage:
//   <ConfirmDialog
//     open={showConfirm}
//     title="Delete Device"
//     message="Are you sure you want to delete this device? This action cannot be undone."
//     confirmLabel="Delete"
//     severity="error"
//     onConfirm={handleDelete}
//     onCancel={() => setShowConfirm(false)}
//     loading={deleting}
//   />
// ============================================================================

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import DeleteIcon from '@mui/icons-material/Delete';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const SEVERITY_CONFIG = {
  error: {
    icon: <DeleteIcon />,
    color: 'error',
  },
  warning: {
    icon: <WarningAmberIcon />,
    color: 'warning',
  },
  info: {
    icon: <InfoOutlinedIcon />,
    color: 'info',
  },
  danger: {
    icon: <ErrorOutlineIcon />,
    color: 'error',
  },
};

/**
 * Standardized confirmation dialog for destructive/important actions.
 *
 * @param {object}          props
 * @param {boolean}         props.open          — Whether the dialog is open
 * @param {string}          props.title         — Dialog title
 * @param {React.ReactNode} props.message       — Body message (string or JSX)
 * @param {string}          [props.confirmLabel='Confirm'] — Confirm button text
 * @param {string}          [props.cancelLabel='Cancel']   — Cancel button text
 * @param {'error'|'warning'|'info'|'danger'} [props.severity='error'] — Visual severity
 * @param {React.ReactNode} [props.icon]        — Override default icon
 * @param {function}        props.onConfirm     — Called when user confirms
 * @param {function}        props.onCancel      — Called when user cancels
 * @param {boolean}         [props.loading]     — Show spinner on confirm button
 * @param {number}          [props.maxWidth=440] — Dialog max width in px
 */
const ConfirmDialog = ({
  open,
  title = 'Confirm Action',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  severity = 'error',
  icon,
  onConfirm,
  onCancel,
  loading = false,
  maxWidth = 440,
}) => {
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.error;
  const displayIcon = icon || config.icon;

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: '100%',
          maxWidth,
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          pb: 1,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 2,
            bgcolor: (theme) => alpha(theme.palette[config.color].main, 0.1),
            color: `${config.color}.main`,
            flexShrink: 0,
          }}
        >
          {React.cloneElement(displayIcon, { fontSize: 'small' })}
        </Box>
        <Typography variant="h6" fontWeight={600} component="span">
          {title}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        {typeof message === 'string' ? (
          <Typography variant="body2" color="text.secondary">
            {message}
          </Typography>
        ) : (
          message
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={onCancel}
          disabled={loading}
          variant="outlined"
          color="inherit"
          sx={{ minWidth: 90 }}
        >
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          variant="contained"
          color={config.color}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
          sx={{ minWidth: 90 }}
        >
          {loading ? 'Processing…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
