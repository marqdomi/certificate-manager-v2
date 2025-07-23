// frontend/src/pages/InventoryPage.jsx

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
    IconButton
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close'; 

// --- Componentes que REALMENTE usa esta página ---
import apiClient from '../services/api';
import CertificateTable from '../components/CertificateTable';
import RenewalChoiceDialog from '../components/RenewalChoiceDialog'; // El único diálogo de acción que abre esta página
import CertificateUsageDetail from '../components/CertificateUsageDetail'; // Para el modal de "Usage"
import RenewalDetailDialog from '../components/RenewalDetailDialog';
import DeployDialog from '../components/DeployDialog';
import CsrResultDialog from '../components/CsrResultDialog';
import renewalDetailOpen from '../components/RenewalDetailDialog';
import activeRenewalId from '../components/RenewalDetailDialog';


function InventoryPage() {
  // --- ESTADOS ---
  const [renewalDetailOpen, setRenewalDetailOpen] = useState(false); // Controla el diálogo de detalles de renovación
  // Estados para los datos y la carga principal de la tabla
  const [allCerts, setAllCerts] = useState([]);      // Guarda la lista maestra de certificados
  const [loading, setLoading] = useState(true);          // Controla el spinner de carga inicial
  const [actionLoading, setActionLoading] = useState(false); // Controla los spinners en los botones de acción

  // Estados para filtrar y buscar en la tabla
  const [statusFilter, setStatusFilter] = useState(null);    // Para el filtro del dashboard ('healthy', 'warning', etc.)
  const [searchTerm, setSearchTerm] = useState('');        // Para el texto de la barra de búsqueda

  // Estados para los diálogos que SÍ se abren desde esta página
  const [choiceDialogOpen, setChoiceDialogOpen] = useState(false); // Controla el diálogo de elección "Renew/Deploy"
  const [usageModalOpen, setUsageModalOpen] = useState(false);     // Controla el diálogo de "Show Usage"
  
  // Estados para pasar datos a los diálogos o a otras páginas
  const [activeCert, setActiveCert] = useState(null);          // Guarda el objeto del cert en el que se hizo clic
  const [activeActionCertId, setActiveActionCertId] = useState(null); // Guarda el ID del cert para mostrar el spinner en la fila correcta

  // Estado para la barra de notificaciones
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

  // Guarda el ID del certificado seleccionado para mostrar su uso
  const [selectedCertId, setSelectedCertId] = useState(null); 
  // Guarda el ID de la renovación activa para mostrar sus detalles
  const [activeRenewalId, setActiveRenewalId] = useState(null);   
  
  // Hooks de React Router (estos no son estados, pero van aquí)
  const location = useLocation();
  const navigate = useNavigate();

// --- LÓGICA DE DATOS (VERSIÓN FINAL) ---
  
  // Función principal para cargar todos los datos desde el backend
  const fetchData = () => {
    setLoading(true);
    apiClient.get('/certificates')
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
  
  // Un único useEffect para manejar la carga inicial y el filtro del Dashboard
  useEffect(() => {
    // Leemos el filtro que nos pudo haber pasado la página de Dashboard
    const initialFilter = location.state?.initialFilter;
    
    // Si hay un filtro, lo establecemos en el estado ANTES de cargar los datos
    if (initialFilter) {
      setStatusFilter(initialFilter.value);
      // Limpiamos el estado de la navegación para que no se vuelva a aplicar
      navigate(location.pathname, { replace: true, state: {} }); 
    }
    
    // Siempre cargamos los datos al montar la página
    fetchData(); 
  }, []); // El array vacío asegura que esto se ejecute solo al montar la primera vez


  // useMemo calcula los certificados a mostrar. Es la forma más eficiente.
  const displayCerts = useMemo(() => {
    let dataToFilter = [...allCerts];

    // Primero, aplicamos el filtro de estado que vino del dashboard (si existe)
    if (statusFilter) {
      if (statusFilter === 'healthy') {
        dataToFilter = dataToFilter.filter(c => c.days_remaining > 30);
      } else if (statusFilter === 'warning') {
        dataToFilter = dataToFilter.filter(c => c.days_remaining > 0 && c.days_remaining <= 30);
      } else if (statusFilter === 'expired') {
        dataToFilter = dataToFilter.filter(c => c.days_remaining <= 0);
      }
    }

    // Luego, sobre el resultado, aplicamos el término de búsqueda
    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      dataToFilter = dataToFilter.filter(c => 
        (c.common_name && c.common_name.toLowerCase().includes(lowercasedFilter)) ||
        (c.name && c.name.toLowerCase().includes(lowercasedFilter))
      );
    }
    
    return dataToFilter;
  }, [allCerts, statusFilter, searchTerm]);


  // --- LÓGICA DE ACCIONES (VERSIÓN FINAL Y LIMPIA) ---

  /**
   * Se llama cuando el usuario hace clic en el botón principal de acción "RENEW..." o "DEPLOY".
   * Su única responsabilidad es guardar el certificado y abrir el diálogo de elección.
   */
  const handleRenewalStart = (cert) => {
    setActiveCert(cert);
    setChoiceDialogOpen(true);
  };

  /**
   * Se llama desde el diálogo de elección cuando el usuario elige "Generate CSR".
   * Cierra el diálogo de elección y redirige a la página del generador de CSR.
   */
  const navigateToCsrGenerator = () => {
    setChoiceDialogOpen(false);
    navigate('/generate-csr', { state: { certificateToRenew: activeCert } });
  };

  /**
   * Se llama desde el diálogo de elección cuando el usuario elige "Deploy Certificate".
   * Cierra el diálogo de elección y redirige al centro de despliegue.
   */
  const navigateToDeployCenter = () => {
    setChoiceDialogOpen(false);
    navigate('/deploy', { state: { certificateToRenew: activeCert } });
  };

  /**
   * Se llama cuando se hace clic en el icono del ojo. Abre el diálogo de uso.
   */
  const handleShowUsage = (certId) => {
    setSelectedCertId(certId);
    setUsageModalOpen(true);
  };

  /**
   * Se llama cuando se hace clic en el icono de información. Abre los detalles de la renovación.
   */
  const handleShowRenewalDetails = (renewalId) => {
    // Necesitamos este estado para pasarlo al diálogo de detalles
    setActiveRenewalId(renewalId);
    setRenewalDetailOpen(true);
  };

  /**
   * Se llama cuando se hace clic en el icono de la papelera.
   */
  const handleDeleteCertificate = (certId) => {
    if (window.confirm('Are you sure you want to permanently delete this certificate? This action is irreversible.')) {
      setActionLoading(true);
      setActiveActionCertId(certId);
      
      apiClient.delete(`/certificates/${certId}`)
        .then(() => {
          setNotification({ open: true, message: 'Certificate deleted successfully. Refreshing list...', severity: 'success' });
          // Esperamos un poco y recargamos los datos para que el usuario vea el cambio.
          setTimeout(() => fetchData(), 1500);
        })
        .catch(err => {
          setNotification({ open: true, message: `Failed to delete certificate: ${err.response?.data?.detail || 'Unknown error'}.`, severity: 'error' });
        })
        .finally(() => {
          setActionLoading(false);
          setActiveActionCertId(null);
        });
    }
  };

  // --- RENDERIZADO (VERSIÓN FINAL Y LIMPIA) ---

  // Muestra un spinner grande solo durante la carga inicial de datos
  if (loading && allCerts.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Certificate Inventory
      </Typography>

      {/* Barra de Notificaciones */}
      {notification.open && (
        <Alert severity={notification.severity} onClose={() => setNotification({ ...notification, open: false })} sx={{ mb: 2 }}>
          {notification.message}
        </Alert>
      )}
      
      {/* Controles de la Tabla (Búsqueda) */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <TextField
            label="Search by CN or Name"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => {
                setSearchTerm(e.target.value);
                setStatusFilter(null);
            }}
            sx={{ width: '400px' }}
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }}
        />
      </Box>

      {/* La Tabla de Certificados */}
      <CertificateTable
        certificates={displayCerts}
        // El loading de la tabla solo se activa si hay una acción en curso
        loading={actionLoading}
        onInitiateRenewal={handleRenewalStart}
        onOpenDeploy={navigateToDeployCenter}
        onShowUsage={handleShowUsage}
        onShowRenewalDetails={handleShowRenewalDetails}
        onDelete={handleDeleteCertificate}
        actionLoading={actionLoading}
        activeActionCertId={activeActionCertId}
      />
      
      {/* --- DIÁLOGOS QUE SÍ PERTENECEN A ESTA PÁGINA --- */}

      {/* El diálogo para elegir el siguiente paso en la renovación */}
      <RenewalChoiceDialog
        open={choiceDialogOpen}
        onClose={() => setChoiceDialogOpen(false)}
        cert={activeCert}
        onGenerateCsr={navigateToCsrGenerator}
        onDeploy={navigateToDeployCenter}
      />

      {/* El diálogo para mostrar los detalles de uso */}
      <Dialog open={usageModalOpen} onClose={() => setUsageModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          Certificate Usage Details
          <IconButton 
            aria-label="close"
            onClick={() => setUsageModalOpen(false)} 
            sx={{ position: 'absolute', right: 8, top: 8, color: (theme) => theme.palette.grey[500] }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedCertId && <CertificateUsageDetail certId={selectedCertId} />}
        </DialogContent>
      </Dialog> 

      {/* El diálogo para mostrar los detalles de una renovación activa */}
      <RenewalDetailDialog
        open={renewalDetailOpen}
        onClose={() => setRenewalDetailOpen(false)}
        renewalId={activeRenewalId}
      />
    </Box>
  );
}
export default InventoryPage; 