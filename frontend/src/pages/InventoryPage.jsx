import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Box,
    Typography,
    CircularProgress,
    Alert,
    TextField,
    InputAdornment,
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    Paper,
    Chip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close'; 

// --- (Imports de componentes no cambian) ---
import apiClient, { getImpactPreview, deleteCertificate } from '../services/api';
import CertificateTable from '../components/CertificateTable';
import RenewalChoiceDialog from '../components/RenewalChoiceDialog';
import CertificateUsageDetail from '../components/CertificateUsageDetail';
import RenewalWizardDialog from '../components/wizard/RenewWizardDialog';
import ConfirmDialog from '../components/ConfirmDialog';


const glassmorphicStyle = {
  p: { xs: 2, sm: 3 },
  backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(26, 33, 51, 0.6)' : 'rgba(255, 255, 255, 0.7)',
  backdropFilter: 'blur(12px)',
  border: '1px solid',
  borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
  borderRadius: '20px',
};


function InventoryPage() {
  
  // --- ESTADOS ---
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [certToDeleteId, setCertToDeleteId] = useState(null);
  const [allCerts, setAllCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [choiceDialogOpen, setChoiceDialogOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [activeActionCertId, setActiveActionCertId] = useState(null);
  const [activeCert, setActiveCert] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

  // ✅ LA CORRECCIÓN ESTÁ AQUÍ: Reintroducimos el estado que faltaba para el modal de "Usage"
  const [selectedCertId, setSelectedCertId] = useState(null);
  // --- New orphanOnly state ---
  const [orphanOnly, setOrphanOnly] = useState(false);
  const [noProfilesOnly, setNoProfilesOnly] = useState(false);
  // View controls for cluster reduction
  const [onlyPrimaries, setOnlyPrimaries] = useState(true);
  const [dedupe, setDedupe] = useState(true);

  const location = useLocation();
  const navigate = useNavigate();

  const handleOpenWizard = (cert) => {
        setActiveCert(cert);
        setWizardOpen(true);
    };

    const handleWizardClose = () => {
        setWizardOpen(false);
        fetchData(); 
    };
  
  const fetchData = () => {
    const params = new URLSearchParams();
    if (onlyPrimaries) params.set('primaries_only', '1');
    if (dedupe) params.set('dedupe', '1');

    apiClient.get(`/certificates/?${params.toString()}`)
      .then(response => {
        setAllCerts(response.data);
      })
      .catch(error => {
        console.error("Error fetching data:", error);
        setNotification({ open: true, message: 'Failed to load certificate data.', severity: 'error' });
      })
      .finally(() => {
        setLoading(false); 
      });
  };
  
  useEffect(() => {
    const initialFilter = location.state?.initialFilter;
    if (initialFilter) {
      setStatusFilter(initialFilter.value);
      navigate(location.pathname, { replace: true, state: {} }); 
    }
    fetchData();
  }, [onlyPrimaries, dedupe]);

  const displayCerts = useMemo(() => {
    let dataToFilter = [...allCerts];
    if (statusFilter) {
      if (statusFilter === 'healthy') {
        dataToFilter = dataToFilter.filter(c => c.days_remaining > 30);
      } else if (statusFilter === 'warning') {
        dataToFilter = dataToFilter.filter(c => c.days_remaining > 0 && c.days_remaining <= 30);
      } else if (statusFilter === 'expired') {
        dataToFilter = dataToFilter.filter(c => c.days_remaining <= 0);
      }
    }
    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      dataToFilter = dataToFilter.filter(c =>
        (c.common_name && c.common_name.toLowerCase().includes(lowercasedFilter)) ||
        (c.name && c.name.toLowerCase().includes(lowercasedFilter))
      );
    }
    // --- Orphan filters ---
    if (noProfilesOnly) {
      dataToFilter = dataToFilter.filter(c => c.usage_state === 'no-profiles');
    } else if (orphanOnly) {
      dataToFilter = dataToFilter.filter(c => ['no-profiles','profiles-no-vips'].includes(c.usage_state));
    }
    return dataToFilter;
  }, [allCerts, statusFilter, searchTerm, orphanOnly, noProfilesOnly]);

  const handleShowUsage = (certId) => {
    setSelectedCertId(certId);
    const certObject = allCerts.find(c => c.id === certId);
    setActiveCert(certObject);
    setUsageModalOpen(true);
  };

  const handleRenewalStart = (cert) => {
    setActiveCert(cert);
    setChoiceDialogOpen(true);
  };
  const navigateToCsrGenerator = () => {
    setChoiceDialogOpen(false);
    navigate('/generate-csr', { state: { certificateToRenew: activeCert } });
  };
  const navigateToDeployCenter = () => {
    setChoiceDialogOpen(false);
    navigate('/deploy', { state: { certificateToRenew: activeCert } });
  };
  
  // Ahora esta función encontrará `setSelectedCertId` y funcionará correctamente
  const handleDeleteRequest = (certId) => {
    setCertToDeleteId(certId); // Guardamos el ID del cert a borrar
    setConfirmOpen(true);      // Abrimos nuestro diálogo personalizado
  };

  const handleConfirmDelete = async () => {
    setConfirmOpen(false);
    if (!certToDeleteId) return;

    const cert = allCerts.find((c) => c.id === certToDeleteId);
    if (!cert) {
      setNotification({ open: true, message: 'Certificate not found in current view.', severity: 'error' });
      return;
    }

    try {
      setActionLoading(true);
      setActiveActionCertId(certToDeleteId);

      // 1) Preview en caché (no golpea F5)
      const preview = await getImpactPreview(cert.device_id, cert.name);
      if (!preview.can_delete_safely) {
        const msg = preview.profiles_using_cert > 0
          ? `Cannot delete: referenced by ${preview.profiles_using_cert} profile(s) and ${preview.vip_refs} VIP(s).`
          : `Cannot delete: referenced by ${preview.vip_refs} VIP(s).`;
        setNotification({ open: true, message: msg, severity: 'warning' });
        setActionLoading(false);
        setActiveActionCertId(null);
        setCertToDeleteId(null);
        return;
      }

      // 2) Borrado definitivo
      console.debug('[delete] calling', 'certificates/' + certToDeleteId, 'baseURL=', apiClient.defaults?.baseURL);
      await deleteCertificate(certToDeleteId);
      setNotification({ open: true, message: 'Certificate deleted successfully. Refreshing list...', severity: 'success' });
      setTimeout(() => {
        fetchData();
        setActionLoading(false);
        setActiveActionCertId(null);
        setCertToDeleteId(null);
      }, 800);
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Unknown error';
      setNotification({ open: true, message: `Failed to delete certificate: ${detail}.`, severity: 'error' });
      setActionLoading(false);
      setActiveActionCertId(null);
      setCertToDeleteId(null);
    }
  };

  // --- RENDERIZADO (Se mantiene el nuevo diseño) ---

  if (loading && allCerts.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box>
      <Paper elevation={0} sx={glassmorphicStyle}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            Certificate Inventory
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TextField
              variant="outlined"
              size="small"
              placeholder="Search by CN or Name"
              value={searchTerm}
              onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setStatusFilter(null);
              }}
              sx={{ width: { xs: '100%', md: '400px' } }}
              InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }}
            />
            <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
              <Chip
                size="small"
                variant={statusFilter === 'expired' ? 'filled' : 'outlined'}
                color={statusFilter === 'expired' ? 'warning' : 'default'}
                label="Only expired"
                onClick={() => setStatusFilter(statusFilter === 'expired' ? null : 'expired')}
              />
              <Chip
                size="small"
                variant={noProfilesOnly ? 'filled' : 'outlined'}
                color={noProfilesOnly ? 'success' : 'default'}
                label="Only no-profiles"
                onClick={() => {
                  const next = !noProfilesOnly;
                  setNoProfilesOnly(next);
                  if (next) setOrphanOnly(false); // evita solape: si activas no-profiles, apaga orphanOnly
                }}
              />
              <Chip
                size="small"
                variant={orphanOnly ? 'filled' : 'outlined'}
                color={orphanOnly ? 'warning' : 'default'}
                label="Only orphans"
                onClick={() => setOrphanOnly(!orphanOnly)}
              />
              <Chip
                size="small"
                variant={onlyPrimaries ? 'filled' : 'outlined'}
                color={onlyPrimaries ? 'primary' : 'default'}
                label="Cluster primaries"
                onClick={() => setOnlyPrimaries(!onlyPrimaries)}
              />
              <Chip
                size="small"
                variant={dedupe ? 'filled' : 'outlined'}
                color={dedupe ? 'info' : 'default'}
                label="De-duplicate"
                onClick={() => setDedupe(!dedupe)}
              />
            </Box>
          </Box>
        </Box>

        {notification.open && (
          <Alert severity={notification.severity} onClose={() => setNotification({ ...notification, open: false })} sx={{ mb: 2 }}>
            {notification.message}
          </Alert>
        )}

        <CertificateTable
          certificates={displayCerts}
          loading={actionLoading}
          onInitiateRenewal={handleOpenWizard}
          onOpenDeploy={handleOpenWizard}
          onShowUsage={handleShowUsage}
          onDelete={handleDeleteRequest}
          activeActionCertId={activeActionCertId}
        />

      </Paper>

      {/* --- DIÁLOGOS (No cambian) --- */}

      <RenewalChoiceDialog
        open={choiceDialogOpen}
        onClose={() => setChoiceDialogOpen(false)}
        cert={activeCert}
        onGenerateCsr={navigateToCsrGenerator}
        onDeploy={navigateToDeployCenter}
      />
      <RenewalWizardDialog
        open={wizardOpen}
        onClose={handleWizardClose}
        device={activeCert ? { id: activeCert.device_id, hostname: activeCert.device_hostname || (activeCert.device && activeCert.device.hostname) || null } : null}
        certName={activeCert ? (activeCert.certificate_name || activeCert.name || '') : ''}
        certificateId={activeCert ? activeCert.id : null}
      />
      <Dialog open={usageModalOpen} onClose={() => setUsageModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          Usage Details for: {activeCert ? activeCert.common_name : ''}
          <IconButton
            aria-label="close"
            onClick={() => setUsageModalOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {usageModalOpen && selectedCertId && (
            <CertificateUsageDetail certId={selectedCertId} cert={activeCert} />
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Certificate Confirmation"
        message="Are you sure you want to permanently delete this certificate? This action is irreversible and cannot be undone."
      />
    </Box>
  );
}
export default InventoryPage;