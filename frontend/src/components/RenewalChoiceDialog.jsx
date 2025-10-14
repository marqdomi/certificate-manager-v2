// frontend/src/components/RenewalChoiceDialog.jsx

// Necesitamos importar Grid para que funcione
import React from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, Button, 
    Typography, Box, Paper, IconButton, Grid, Tooltip
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';

const RenewalChoiceDialog = ({ open, onClose, cert, onGenerateCsr, onDeploy }) => {
  if (!cert) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
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

        <Grid container spacing={2}>
          {/* Opción A: Generar CSR */}
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
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
          </Grid>

          {/* Opción B: Desplegar Certificado */}
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
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
          </Grid>
        </Grid>

      </DialogContent>
    </Dialog>
  );
};


export default RenewalChoiceDialog;