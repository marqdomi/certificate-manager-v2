import React from 'react';
import { Dialog, DialogTitle, DialogContent } from '@mui/material';
import RenewWizard from '../pages/RenewWizard';

/**
 * Wrapper dialog kept under the same filename used by InventoryPage.
 * It now renders the NEW RenewWizard (impact preview + confirm & deploy),
 * so InventoryPage doesn't need to change its imports/logic.
 */
const RenewalWizardDialog = ({ open, onClose, certificate }) => {
  if (!open || !certificate) return null;

  // Build the minimal device object the new wizard expects
  const device = {
    id: certificate.device_id,
    hostname: certificate.f5_device_hostname || certificate.f5_hostname || 'Unknown device',
  };

  // We prefer to use the F5 object name for lookups; fall back to common_name
  const certName = certificate.name || certificate.common_name || 'Unknown cert';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 'bold' }}>
        Renew Certificate – {certificate.common_name || certName}
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <RenewWizard device={device} certName={certName} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
};

export default RenewalWizardDialog;