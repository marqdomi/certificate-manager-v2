// frontend/src/components/RenewalChoiceDialog.jsx

import React from 'react';
import { 
    Dialog, DialogTitle, DialogContent, Button, 
    Typography, Box, Paper, IconButton, Tooltip, useTheme
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';

const RenewalChoiceDialog = ({ open, onClose, cert, onGenerateCsr, onDeploy }) => {
  const theme = useTheme();
  const radii = theme.customRadii || {};
  
  if (!cert) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"
      PaperProps={{ sx: { borderRadius: `${radii.md ?? 12}px` } }}
    >
      <DialogTitle>
        Renewing: <strong>{cert.common_name}</strong>
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" sx={{ mb: 3 }}>
          What do you need to do first?
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          {/* Option A: Generate CSR */}
          <Paper variant="outlined" sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', borderRadius: `${radii.sm ?? 8}px` }}>
            <Typography variant="h6" gutterBottom>1. Generate CSR</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
              Choose this if you are starting the renewal process and need a CSR to submit to your Certificate Authority.
            </Typography>
            <Tooltip title="Start the renewal by generating a Certificate Signing Request">
              <span>
                <Button
                  variant="contained"
                  onClick={onGenerateCsr}
                  endIcon={<ArrowForwardIcon />}
                  sx={{ mt: 2 }}
                  aria-label="Go to CSR Generator"
                >
                  Go to CSR Generator
                </Button>
              </span>
            </Tooltip>
          </Paper>

          {/* Option B: Deploy Certificate */}
          <Paper variant="outlined" sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', borderRadius: `${radii.sm ?? 8}px` }}>
            <Typography variant="h6" gutterBottom>2. Deploy Certificate</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
              Choose this if you already have the signed certificate file (.pfx or .crt) and are ready to install it on the F5.
            </Typography>
            <Tooltip title="Proceed to deploy your signed certificate on the F5">
              <span>
                <Button
                  variant="contained"
                  onClick={onDeploy}
                  endIcon={<ArrowForwardIcon />}
                  sx={{ mt: 2 }}
                  aria-label="Go to Deploy Center"
                >
                  Go to Deploy Center
                </Button>
              </span>
            </Tooltip>
          </Paper>
        </Box>

      </DialogContent>
    </Dialog>
  );
};


export default RenewalChoiceDialog;