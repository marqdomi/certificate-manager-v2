import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
    Chip,
    Button,
    Tooltip,
    Badge,
    Drawer,
    Stack,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormGroup,
    FormControlLabel,
    Checkbox,
    Divider,
    alpha,
    ToggleButton,
    ToggleButtonGroup,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';

// --- (Imports de componentes no cambian) ---
import apiClient, { getImpactPreview, deleteCertificate } from '../services/api';
import CertificateTable from '../components/CertificateTable';
import RenewalChoiceDialog from '../components/RenewalChoiceDialog';
import CertificateUsageDetail from '../components/CertificateUsageDetail';
import RenewalWizardDialog from '../components/wizard/RenewWizardDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import ExportButton from '../components/ExportButton';
import CertificateDetailDrawer from '../components/CertificateDetailDrawer';

// localStorage keys
const FILTERS_KEY = 'cmt_cert_filters';
const FAVORITES_KEY = 'cmt_cert_favorites';

// StatCard component for KPIs
const StatCard = ({ icon, label, value, color, onClick, active }) => (
  <Tooltip title={`Click to filter by ${label}`}>
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2.5,
        py: 1.5,
        borderRadius: 3,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        border: '2px solid',
        borderColor: active ? color : 'transparent',
        backgroundColor: active
          ? (theme) => alpha(color, theme.palette.mode === 'dark' ? 0.2 : 0.1)
          : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        '&:hover': {
          backgroundColor: (theme) => alpha(color, theme.palette.mode === 'dark' ? 0.15 : 0.08),
          transform: 'translateY(-2px)',
          boxShadow: `0 4px 12px ${alpha(color, 0.3)}`,
        },
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(color, 0.15),
          color: color,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="h5" fontWeight={700} color={color}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {label}
        </Typography>
      </Box>
    </Box>
  </Tooltip>
);


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

  // Usage modal state
  const [selectedCertId, setSelectedCertId] = useState(null);
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState([]);
  const [clearSelectionKey, setClearSelectionKey] = useState(0);
  // View controls for cluster reduction - load from localStorage
  const [onlyPrimaries, setOnlyPrimaries] = useState(() => {
    const saved = localStorage.getItem(FILTERS_KEY);
    return saved ? JSON.parse(saved).onlyPrimaries ?? true : true;
  });
  const [dedupe, setDedupe] = useState(() => {
    const saved = localStorage.getItem(FILTERS_KEY);
    return saved ? JSON.parse(saved).dedupe ?? true : true;
  });
  
  // New states for enhanced UX
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [, setTick] = useState(0); // For relative time updates
  const searchInputRef = useRef(null);

  // Detail drawer states
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedCertForDetail, setSelectedCertForDetail] = useState(null);

  // Favorites system - persisted to localStorage
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem(FAVORITES_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // View mode: 'table' or 'cards'
  const [viewMode, setViewMode] = useState('table');

  const location = useLocation();
  const navigate = useNavigate();

  // Persist filters to localStorage
  useEffect(() => {
    localStorage.setItem(FILTERS_KEY, JSON.stringify({ onlyPrimaries, dedupe }));
  }, [onlyPrimaries, dedupe]);

  // Persist favorites to localStorage
  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  // Toggle favorite
  const toggleFavorite = useCallback((certId) => {
    setFavorites(prev => {
      if (prev.includes(certId)) {
        return prev.filter(id => id !== certId);
      }
      return [...prev, certId];
    });
  }, []);

  // Check if certificate is favorite
  const isFavorite = useCallback((certId) => {
    return favorites.includes(certId);
  }, [favorites]);

  // Update relative time display every minute
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // "/" to focus search
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && e.target === document.body) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Escape to close modals/drawers
      if (e.key === 'Escape') {
        if (detailDrawerOpen) setDetailDrawerOpen(false);
        else if (usageModalOpen) setUsageModalOpen(false);
        else if (filterDrawerOpen) setFilterDrawerOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [usageModalOpen, filterDrawerOpen]);

  // Calculate stats for KPIs
  const stats = useMemo(() => {
    const total = allCerts.length;
    const healthy = allCerts.filter(c => c.days_remaining > 30).length;
    const expiring = allCerts.filter(c => c.days_remaining > 0 && c.days_remaining <= 30).length;
    const expired = allCerts.filter(c => c.days_remaining <= 0).length;
    return { total, healthy, expiring, expired };
  }, [allCerts]);

  // Helper function for relative time
  const getRelativeTime = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter) count++;
    return count;
  }, [statusFilter]);

  // Clear all filters
  const clearAllFilters = () => {
    setStatusFilter(null);
    setShowFavoritesOnly(false);
    setSearchTerm('');
  };

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setClearSelectionKey(k => k + 1);
  }, []);

  const handleOpenWizard = (cert) => {
        setActiveCert(cert);
        setWizardOpen(true);
    };

    const handleWizardClose = () => {
        setWizardOpen(false);
        fetchData(); 
    };
  
  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (onlyPrimaries) params.set('primaries_only', '1');
    if (dedupe) params.set('dedupe', '1');

    apiClient.get(`/certificates/?${params.toString()}`)
      .then(response => {
        setAllCerts(response.data);
        setLastRefresh(new Date());
      })
      .catch(error => {
        console.error("Error fetching data:", error);
        setNotification({ open: true, message: 'Failed to load certificate data.', severity: 'error' });
      })
      .finally(() => {
        setLoading(false); 
      });
  }, [onlyPrimaries, dedupe]);
  
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
    // --- Favorites filter ---
    if (showFavoritesOnly) {
      dataToFilter = dataToFilter.filter(c => favorites.includes(c.id));
    }
    return dataToFilter;
  }, [allCerts, statusFilter, searchTerm, showFavoritesOnly, favorites]);

  // Export selected certificates (must be after displayCerts is defined)
  const exportSelectedCerts = useCallback(() => {
    const selectedCerts = displayCerts.filter(c => selectedIds.includes(c.id));
    if (selectedCerts.length === 0) return;
    
    const csvContent = [
      ['ID', 'Common Name', 'Certificate Name', 'F5 Device', 'Expiration Date', 'Days Left'].join(','),
      ...selectedCerts.map(c => [
        c.id,
        `"${c.common_name || ''}"`,
        `"${c.name || ''}"`,
        `"${c.f5_device_hostname || ''}"`,
        c.expiration_date || '',
        c.days_remaining ?? ''
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cmt_selected_certificates_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    setNotification({ open: true, message: `Exported ${selectedCerts.length} certificates`, severity: 'success' });
  }, [displayCerts, selectedIds]);

  // Open certificate detail drawer
  const handleOpenDetailDrawer = useCallback((cert) => {
    setSelectedCertForDetail(cert);
    setDetailDrawerOpen(true);
  }, []);

  const handleShowUsage = (certId) => {
    setSelectedCertId(certId);
    const certObject = allCerts.find(c => c.id === certId);
    setActiveCert(certObject);
    setUsageModalOpen(true);
  };

  // Show usage from detail drawer
  const handleShowUsageFromDrawer = useCallback(() => {
    if (selectedCertForDetail) {
      setDetailDrawerOpen(false);
      handleShowUsage(selectedCertForDetail.id);
    }
  }, [selectedCertForDetail]);

  // Renew from detail drawer
  const handleRenewFromDrawer = useCallback(() => {
    if (selectedCertForDetail) {
      setDetailDrawerOpen(false);
      handleOpenWizard(selectedCertForDetail);
    }
  }, [selectedCertForDetail]);

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
      if (import.meta.env.DEV) console.debug('[delete] calling', 'certificates/' + certToDeleteId, 'baseURL=', apiClient.defaults?.baseURL);
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
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
              Certificate Inventory
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Manage and monitor SSL/TLS certificates across your F5 infrastructure
            </Typography>
          </Box>
        </Box>

        {/* KPI Stats Bar */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <StatCard
            icon={<SecurityIcon />}
            label="Total Certificates"
            value={stats.total}
            color="#6366f1"
            onClick={() => { setStatusFilter(null); }}
            active={!statusFilter}
          />
          <StatCard
            icon={<CheckCircleOutlineIcon />}
            label="Healthy"
            value={stats.healthy}
            color="#10b981"
            onClick={() => { setStatusFilter('healthy'); }}
            active={statusFilter === 'healthy'}
          />
          <StatCard
            icon={<WarningAmberIcon />}
            label="Expiring Soon"
            value={stats.expiring}
            color="#f59e0b"
            onClick={() => { setStatusFilter('warning'); }}
            active={statusFilter === 'warning'}
          />
          <StatCard
            icon={<ErrorOutlineIcon />}
            label="Expired"
            value={stats.expired}
            color="#ef4444"
            onClick={() => { setStatusFilter('expired'); }}
            active={statusFilter === 'expired'}
          />
        </Box>

        {/* Bulk Actions Bar */}
        {selectedIds.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              mb: 2,
              p: 1.5,
              borderRadius: 2,
              backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.1),
              border: '1px solid',
              borderColor: 'primary.main',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckBoxIcon color="primary" />
              <Typography variant="body2" fontWeight={600} color="primary">
                {selectedIds.length} certificate{selectedIds.length > 1 ? 's' : ''} selected
              </Typography>
            </Box>
            
            <Box sx={{ flexGrow: 1 }} />
            
            <Button
              size="small"
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={exportSelectedCerts}
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              Export Selected
            </Button>
            
            <Button
              size="small"
              variant="text"
              onClick={clearSelection}
              sx={{ textTransform: 'none' }}
            >
              Clear Selection
            </Button>
          </Box>
        )}

        {/* Toolbar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            mb: 2,
            p: 1.5,
            borderRadius: 2,
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          }}
        >
          {/* Search */}
          <TextField
            inputRef={searchInputRef}
            variant="outlined"
            size="small"
            placeholder="Search certificates... (press /)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ width: { xs: '100%', sm: 280 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
          />

          {/* Filters Button */}
          <Badge badgeContent={activeFilterCount} color="primary">
            <Button
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={() => setFilterDrawerOpen(true)}
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              Filters
            </Button>
          </Badge>

          {/* Favorites Toggle */}
          <Tooltip title={showFavoritesOnly ? "Show all certificates" : "Show favorites only"}>
            <Button
              variant={showFavoritesOnly ? "contained" : "outlined"}
              startIcon={showFavoritesOnly ? <StarIcon /> : <StarBorderIcon />}
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              sx={{ textTransform: 'none', borderRadius: 2 }}
              color={showFavoritesOnly ? "warning" : "inherit"}
            >
              {favorites.length > 0 && `(${favorites.length})`}
            </Button>
          </Tooltip>

          {/* View Mode Toggle */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="table" aria-label="table view">
              <Tooltip title="Table View">
                <ViewListIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="cards" aria-label="card view">
              <Tooltip title="Card View">
                <ViewModuleIcon />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          <Box sx={{ flexGrow: 1 }} />

          {/* Last Refresh */}
          <Tooltip title={`Last updated: ${lastRefresh.toLocaleTimeString()}`}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
              <AccessTimeIcon sx={{ fontSize: 16 }} />
              <Typography variant="caption">{getRelativeTime(lastRefresh)}</Typography>
            </Box>
          </Tooltip>

          {/* Refresh Button */}
          <Tooltip title="Refresh data">
            <IconButton onClick={fetchData} disabled={loading} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>

          {/* Export */}
          <ExportButton 
            certificates={displayCerts} 
            disabled={loading}
            filenamePrefix="cmt_certificates"
          />
        </Box>

        {/* Active Filters Display */}
        {(activeFilterCount > 0 || searchTerm) && (
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Active filters:
            </Typography>
            {statusFilter && (
              <Chip
                size="small"
                label={`Status: ${statusFilter}`}
                onDelete={() => setStatusFilter(null)}
                color="primary"
                variant="outlined"
              />
            )}
            {showFavoritesOnly && (
              <Chip
                size="small"
                icon={<StarIcon />}
                label="Favorites only"
                onDelete={() => setShowFavoritesOnly(false)}
                color="warning"
                variant="filled"
              />
            )}
            {searchTerm && (
              <Chip
                size="small"
                label={`Search: "${searchTerm}"`}
                onDelete={() => setSearchTerm('')}
                variant="outlined"
              />
            )}
            <Button
              size="small"
              startIcon={<ClearAllIcon />}
              onClick={clearAllFilters}
              sx={{ textTransform: 'none' }}
            >
              Clear all
            </Button>
          </Box>
        )}

        {notification.open && (
          <Alert severity={notification.severity} onClose={() => setNotification({ ...notification, open: false })} sx={{ mb: 2 }}>
            {notification.message}
          </Alert>
        )}

        {/* Empty State */}
        {displayCerts.length === 0 && !loading ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <SecurityIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No certificates found
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Try adjusting your search or filters
            </Typography>
          </Box>
        ) : viewMode === 'table' ? (
          <CertificateTable
            certificates={displayCerts}
            loading={actionLoading}
            onInitiateRenewal={handleOpenWizard}
            onOpenDeploy={handleOpenWizard}
            onShowUsage={handleShowUsage}
            onDelete={handleDeleteRequest}
            activeActionCertId={activeActionCertId}
            // Bulk selection props
            onSelectionChange={setSelectedIds}
            clearSelectionKey={clearSelectionKey}
            // Row click for detail drawer
            onRowClick={handleOpenDetailDrawer}
            // Favorites
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
          />
        ) : (
          /* Card View */
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
            gap: 2 
          }}>
            {displayCerts.map((cert) => {
              const daysRemaining = cert.days_remaining;
              const statusColor = daysRemaining <= 0 ? '#ef4444' : daysRemaining <= 30 ? '#f59e0b' : '#10b981';
              const isFav = isFavorite(cert.id);
              
              return (
                <Paper
                  key={cert.id}
                  onClick={() => handleOpenDetailDrawer(cert)}
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: isFav ? alpha('#f59e0b', 0.5) : 'divider',
                    borderRadius: 2,
                    transition: 'all 0.2s ease-in-out',
                    backgroundColor: (theme) => theme.palette.background.paper,
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 2,
                      borderColor: 'primary.main',
                    },
                    position: 'relative',
                  }}
                >
                  {/* Favorite Star - subtle */}
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(cert.id); }}
                    sx={{ 
                      position: 'absolute', 
                      top: 6, 
                      right: 6,
                      opacity: isFav ? 1 : 0.3,
                      '&:hover': { opacity: 1 },
                      transition: 'opacity 0.2s',
                    }}
                  >
                    {isFav ? <StarIcon sx={{ color: '#f59e0b', fontSize: 18 }} /> : <StarBorderIcon sx={{ color: 'text.disabled', fontSize: 18 }} />}
                  </IconButton>

                  {/* Status indicator dot */}
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: statusColor,
                      position: 'absolute',
                      top: 14,
                      left: 14,
                    }}
                  />

                  <Box sx={{ pl: 2.5, pr: 3 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {cert.common_name || cert.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ opacity: 0.7 }}>
                      {cert.name}
                    </Typography>
                  </Box>

                  <Divider sx={{ my: 1.5, opacity: 0.6 }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                    <Typography variant="caption" color="text.secondary">
                      Days Left
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: statusColor }} />
                      <Typography variant="caption" fontWeight={500}>
                        {daysRemaining <= 0 ? 'Expired' : daysRemaining}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">
                      Device
                    </Typography>
                    <Typography variant="caption" noWrap sx={{ maxWidth: 120, fontWeight: 500 }}>
                      {cert.f5_device_hostname || '—'}
                    </Typography>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}

      </Paper>

      {/* Filter Drawer */}
      <Drawer
        anchor="right"
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        PaperProps={{
          sx: { width: 320, p: 3 },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" fontWeight={600}>
            Filters
          </Typography>
          <IconButton onClick={() => setFilterDrawerOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <Stack spacing={3}>
          {/* Status Filter */}
          <FormControl fullWidth size="small">
            <InputLabel>Certificate Status</InputLabel>
            <Select
              value={statusFilter || ''}
              label="Certificate Status"
              onChange={(e) => setStatusFilter(e.target.value || null)}
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="healthy">Healthy (&gt;30 days)</MenuItem>
              <MenuItem value="warning">Expiring Soon (1-30 days)</MenuItem>
              <MenuItem value="expired">Expired</MenuItem>
            </Select>
          </FormControl>

          <Divider />

          {/* Data Source Options */}
          <Typography variant="subtitle2" color="text.secondary">
            Data Source Options
          </Typography>

          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={onlyPrimaries}
                  onChange={(e) => setOnlyPrimaries(e.target.checked)}
                />
              }
              label="Cluster primaries only"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={dedupe}
                  onChange={(e) => setDedupe(e.target.checked)}
                />
              }
              label="De-duplicate certificates"
            />
          </FormGroup>

          <Divider />

          {/* Actions */}
          <Button
            fullWidth
            variant="outlined"
            startIcon={<ClearAllIcon />}
            onClick={() => {
              clearAllFilters();
              setOnlyPrimaries(true);
              setDedupe(true);
            }}
          >
            Reset All Filters
          </Button>
        </Stack>
      </Drawer>

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
          {usageModalOpen && selectedCertId && <CertificateUsageDetail certId={selectedCertId} />}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Certificate Confirmation"
        message="Are you sure you want to permanently delete this certificate? This action is irreversible and cannot be undone."
      />

      {/* Certificate Detail Drawer */}
      <CertificateDetailDrawer
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        certificate={selectedCertForDetail}
        onShowUsage={handleShowUsageFromDrawer}
        onRenew={handleRenewFromDrawer}
        isFavorite={selectedCertForDetail ? isFavorite(selectedCertForDetail.id) : false}
        onToggleFavorite={() => selectedCertForDetail && toggleFavorite(selectedCertForDetail.id)}
      />
    </Box>
  );
}
export default InventoryPage;