// frontend/src/pages/RenewWizard.jsx
import React, { useMemo, useState } from 'react';
import { Box, Paper, Stepper, Step, StepLabel, Button, Typography } from '@mui/material';
import ImpactPreviewStep from '../components/wizard/ImpactPreviewStep';
import ConfirmDeploymentStep from '../components/wizard/ConfirmDeploymentStep';

const steps = ['Impact Preview', 'Confirm & Deploy'];

export default function RenewWizard({ device, certName, onClose }) {
  const [activeStep, setActiveStep] = useState(0);
  const [previewData, setPreviewData] = useState(null);

  const canGoNext = useMemo(() => {
    if (activeStep === 0) return true; // no bloqueamos paso 1
    if (activeStep === 1) return true;
    return false;
  }, [activeStep]);

  const handleNext = () => setActiveStep((s) => Math.min(s + 1, steps.length - 1));
  const handleBack = () => setActiveStep((s) => Math.max(s - 1, 0));

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
        Renew Certificate – {certName}
      </Typography>
      <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
        {steps.map((label) => (<Step key={label}><StepLabel>{label}</StepLabel></Step>))}
      </Stepper>

      <Box sx={{ minHeight: 300 }}>
        {activeStep === 0 && (
          <ImpactPreviewStep
            device={device}
            certName={certName}
            onLoaded={(data) => setPreviewData(data)}
          />
        )}

        {activeStep === 1 && (
          <ConfirmDeploymentStep
            device={device}
            certName={certName}
            previewData={previewData}
          />
        )}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Box>
          <Button disabled={activeStep === 0} onClick={handleBack} sx={{ mr: 1 }}>Back</Button>
          {activeStep < steps.length - 1 ? (
            <Button variant="contained" onClick={handleNext} disabled={!canGoNext}>Next</Button>
          ) : (
            <Button variant="contained" onClick={onClose}>Close</Button>
          )}
        </Box>
      </Box>
    </Paper>
  );
}