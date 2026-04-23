/**
 * 🚀 Advanced Dashboard - CMT v2.5
 * Dashboard principal con integración completa de funcionalidad avanzada
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Fab,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Badge,
  Divider,
  Alert,
  Collapse,
  IconButton,
  Tab,
  Tabs,
  useTheme,
  alpha
} from '@mui/material';

import {
  Dashboard as DashboardIcon,
  FilterList as FilterIcon,
  GetApp as ExportIcon,
  TrendingUp as TrendsIcon,
  Notifications as AlertsIcon,
  Navigation as NavigationIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Speed as SpeedIcon,
  Timeline as TimelineIcon,
  Security as SecurityIcon,
  Assessment as ReportsIcon
} from '@mui/icons-material';

// Importar componentes avanzados
import AdvancedFilters from './AdvancedFilters';
import ReportExportSystem from './ReportExportSystem';
import TemporalComparison from './TemporalComparison';
import CustomizableAlertsSystem from './CustomizableAlertsSystem';
import DrillDownNavigation from './DrillDownNavigation';

// Importar hooks
import { useAdvancedFilters } from '../hooks/useAdvancedFilters';
import { useDrillDownNavigation } from '../hooks/useDrillDownNavigation';
import { useTemporalTrends } from '../hooks/useTemporalTrends';
import { useCustomAlerts } from '../hooks/useCustomAlerts';

/**
 * 🎯 Componente principal del Dashboard Avanzado
 */
const AdvancedDashboard = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [showAdvancedFeatures, setShowAdvancedFeatures] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    certificates: [],
    devices: [],
    vulnerabilities: [],
    metrics: {}
  });

  // Hooks de funcionalidad avanzada
  const {
    filters,
    filteredData,
    applyFilter,
    clearFilters,
    saveFilterPreset,
    getActiveFiltersCount
  } = useAdvancedFilters({
    data: dashboardData,
    initialFilters: {
      status: 'all',
      priority: 'all',
      timeRange: '30d'
    }
  });

  const {
    currentNavigation,
    navigateTo,
    navigationHistory,
    bookmarks,
    addBookmark,
    isBookmarked
  } = useDrillDownNavigation('dashboard');

  const {
    trendsData,
    comparisons,
    insights,
    loadTrends,
    refreshTrends
  } = useTemporalTrends();

  const {
    alerts,
    activeAlerts,
    evaluateAlerts,
    alertStats
  } = useCustomAlerts();

  // Estados del dashboard
  const [loading, setLoading] = useState(false);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);

  /**
   * 🔄 Efectos y carga de datos
   */
  useEffect(() => {
    loadDashboardData();
    loadTrends();
    evaluateAlerts();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Simular carga de datos del dashboard
      const mockData = generateMockDashboardData();
      setDashboardData(mockData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshDashboard = async () => {
    await Promise.all([
      loadDashboardData(),
      refreshTrends(),
      evaluateAlerts()
    ]);
  };

  /**
   * 📊 Métricas y estadísticas del dashboard
   */
  const dashboardMetrics = useMemo(() => {
    const { certificates, devices, vulnerabilities } = filteredData;
    
    return {
      totalCertificates: certificates?.length || 0,
      expiringCertificates: certificates?.filter(cert => cert.status === 'expiring')?.length || 0,
      totalDevices: devices?.length || 0,
      offlineDevices: devices?.filter(device => device.status === 'offline')?.length || 0,
      criticalVulnerabilities: vulnerabilities?.filter(vuln => vuln.severity === 'critical')?.length || 0,
      activeAlerts: activeAlerts?.length || 0,
      filtersActive: getActiveFiltersCount()
    };
  }, [filteredData, activeAlerts, getActiveFiltersCount]);

  /**
   * 🎨 Componentes del Dashboard
   */
  const MetricCard = ({ title, value, subtitle, color = 'primary', icon: Icon, onClick }) => (
    <Card
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        '&:hover': onClick ? {
          transform: 'translateY(-2px)',
          boxShadow: theme.shadows[4]
        } : {}
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div" color={`${color}.main`}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="textSecondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          {Icon && (
            <Icon 
              sx={{ 
                fontSize: 40, 
                color: alpha(theme.palette[color].main, 0.7) 
              }} 
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );

  const QuickActionsSpeedDial = () => {
    const actions = [
      { 
        icon: <FilterIcon />, 
        name: 'Filtros Avanzados',
        onClick: () => setActiveTab(1)
      },
      { 
        icon: <ExportIcon />, 
        name: 'Exportar Reportes',
        onClick: () => setActiveTab(2)
      },
      { 
        icon: <TrendsIcon />, 
        name: 'Análisis Temporal',
        onClick: () => setActiveTab(3)
      },
      { 
        icon: <AlertsIcon />, 
        name: 'Gestión de Alertas',
        onClick: () => setActiveTab(4)
      },
      { 
        icon: <NavigationIcon />, 
        name: 'Navegación Contextual',
        onClick: () => setActiveTab(5)
      }
    ];

    return (
      <SpeedDial
        ariaLabel="Acciones rápidas"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        icon={<SpeedDialIcon />}
        onClose={() => setSpeedDialOpen(false)}
        onOpen={() => setSpeedDialOpen(true)}
        open={speedDialOpen}
      >
        {actions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={() => {
              action.onClick();
              setSpeedDialOpen(false);
            }}
          />
        ))}
      </SpeedDial>
    );
  };

  const DashboardHeader = () => (
    <Box sx={{ mb: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4" component="h1" gutterBottom>
          🛡️ CMT v2.5 - Dashboard Avanzado
        </Typography>
        
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={refreshDashboard}
            disabled={loading}
          >
            Actualizar
          </Button>
          
          <Button
            variant="contained"
            startIcon={<SettingsIcon />}
            onClick={() => setShowAdvancedFeatures(!showAdvancedFeatures)}
          >
            Funciones Avanzadas
            {showAdvancedFeatures ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </Button>
        </Box>
      </Box>

      {/* Indicadores de estado */}
      <Box display="flex" gap={1} flexWrap="wrap">
        {dashboardMetrics.filtersActive > 0 && (
          <Chip
            label={`${dashboardMetrics.filtersActive} filtros activos`}
            color="primary"
            size="small"
            icon={<FilterIcon />}
          />
        )}
        
        {dashboardMetrics.activeAlerts > 0 && (
          <Chip
            label={`${dashboardMetrics.activeAlerts} alertas activas`}
            color="warning"
            size="small"
            icon={<AlertsIcon />}
          />
        )}
        
        {isBookmarked() && (
          <Chip
            label="Vista guardada"
            color="info"
            size="small"
            variant="outlined"
          />
        )}
      </Box>
    </Box>
  );

  const MetricsOverview = () => (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="Certificados Totales"
          value={dashboardMetrics.totalCertificates}
          subtitle={`${dashboardMetrics.expiringCertificates} próximos a expirar`}
          color="primary"
          icon={SecurityIcon}
          onClick={() => navigateTo('certificates')}
        />
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="Dispositivos"
          value={dashboardMetrics.totalDevices}
          subtitle={`${dashboardMetrics.offlineDevices} sin conexión`}
          color="info"
          icon={SpeedIcon}
          onClick={() => navigateTo('devices')}
        />
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="Vulnerabilidades Críticas"
          value={dashboardMetrics.criticalVulnerabilities}
          color="error"
          icon={SecurityIcon}
          onClick={() => navigateTo('security')}
        />
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="Alertas Activas"
          value={dashboardMetrics.activeAlerts}
          color="warning"
          icon={AlertsIcon}
          onClick={() => setActiveTab(4)}
        />
      </Grid>
    </Grid>
  );

  const AdvancedFeaturesPanel = () => (
    <Collapse in={showAdvancedFeatures}>
      <Paper sx={{ p: 2, mb: 3, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
        <Typography variant="h6" gutterBottom>
          ✨ Funcionalidad Avanzada CMT v2.5
        </Typography>
        
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 2 }}
        >
          <Tab label="Dashboard" icon={<DashboardIcon />} />
          <Tab label="Filtros" icon={<FilterIcon />} />
          <Tab label="Reportes" icon={<ReportsIcon />} />
          <Tab label="Tendencias" icon={<TimelineIcon />} />
          <Tab label="Alertas" icon={<AlertsIcon />} />
          <Tab label="Navegación" icon={<NavigationIcon />} />
        </Tabs>

        <Box sx={{ mt: 2 }}>
          {activeTab === 0 && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Dashboard principal con métricas en tiempo real y acceso rápido a todas las funciones avanzadas
              </Alert>
              <MetricsOverview />
            </Box>
          )}

          {activeTab === 1 && (
            <AdvancedFilters
              data={dashboardData}
              onFiltersChange={(newFilters) => {
                Object.entries(newFilters).forEach(([key, value]) => {
                  applyFilter(key, value);
                });
              }}
              currentFilters={filters}
            />
          )}

          {activeTab === 2 && (
            <ReportExportSystem
              data={filteredData}
              context={currentNavigation.context}
              filters={filters}
            />
          )}

          {activeTab === 3 && (
            <TemporalComparison
              data={filteredData}
              context={currentNavigation.context}
              onInsightClick={(insight) => {
                // Navegar al contexto del insight
                if (insight.navigateTo) {
                  navigateTo(insight.navigateTo.context, insight.navigateTo.entity);
                }
              }}
            />
          )}

          {activeTab === 4 && (
            <CustomizableAlertsSystem
              data={dashboardData}
              context={currentNavigation.context}
              onAlertTriggered={(alert) => {
                // Manejar alertas activadas
                console.log('Alert triggered:', alert);
              }}
            />
          )}

          {activeTab === 5 && (
            <DrillDownNavigation
              currentContext={currentNavigation.context}
              currentEntity={currentNavigation.entity}
              data={dashboardData}
              onNavigate={(context, entity, filters) => {
                navigateTo(context, entity, filters);
              }}
            />
          )}
        </Box>
      </Paper>
    </Collapse>
  );

  return (
    <Box sx={{ p: 3 }}>
      <DashboardHeader />
      
      {/* Panel de funcionalidad avanzada */}
      <AdvancedFeaturesPanel />
      
      {/* Métricas principales cuando no se muestran funciones avanzadas */}
      {!showAdvancedFeatures && <MetricsOverview />}
      
      {/* Contenido principal del dashboard */}
      <Grid container spacing={3}>
        {/* Resumen de certificados */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              📜 Estado de Certificados
            </Typography>
            <Box sx={{ mt: 2 }}>
              {filteredData.certificates?.slice(0, 5).map((cert, index) => (
                <Box 
                  key={cert.id || index}
                  display="flex" 
                  justifyContent="space-between" 
                  alignItems="center"
                  py={1}
                  sx={{ 
                    borderBottom: index < 4 ? `1px solid ${theme.palette.divider}` : 'none',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) }
                  }}
                  onClick={() => navigateTo('certificate_detail', cert)}
                >
                  <Typography variant="body2">
                    {cert.common_name || cert.subject}
                  </Typography>
                  <Chip
                    label={cert.status}
                    size="small"
                    color={
                      cert.status === 'valid' ? 'success' :
                      cert.status === 'expiring' ? 'warning' : 'error'
                    }
                  />
                </Box>
              )) || (
                <Typography color="textSecondary">
                  No hay datos de certificados disponibles
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Resumen de dispositivos */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              🖥️ Estado de Dispositivos
            </Typography>
            <Box sx={{ mt: 2 }}>
              {filteredData.devices?.slice(0, 5).map((device, index) => (
                <Box 
                  key={device.id || index}
                  display="flex" 
                  justifyContent="space-between" 
                  alignItems="center"
                  py={1}
                  sx={{ 
                    borderBottom: index < 4 ? `1px solid ${theme.palette.divider}` : 'none',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) }
                  }}
                  onClick={() => navigateTo('device_detail', device)}
                >
                  <Typography variant="body2">
                    {device.hostname || device.ip_address}
                  </Typography>
                  <Chip
                    label={device.status}
                    size="small"
                    color={
                      device.status === 'online' ? 'success' :
                      device.status === 'offline' ? 'error' : 'warning'
                    }
                  />
                </Box>
              )) || (
                <Typography color="textSecondary">
                  No hay datos de dispositivos disponibles
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Speed Dial para acciones rápidas */}
      <QuickActionsSpeedDial />
    </Box>
  );
};

/**
 * 🧪 Función para generar datos de prueba
 */
const generateMockDashboardData = () => {
  const statuses = ['valid', 'expiring', 'expired'];
  const deviceStatuses = ['online', 'offline', 'error'];
  const severities = ['low', 'medium', 'high', 'critical'];

  return {
    certificates: Array.from({ length: 50 }, (_, i) => ({
      id: `cert-${i + 1}`,
      common_name: `certificate${i + 1}.example.com`,
      subject: `CN=certificate${i + 1}.example.com,O=Example Corp`,
      issuer: `Example CA ${Math.floor(i / 10) + 1}`,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      expiration_date: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      type: Math.random() > 0.5 ? 'SSL/TLS' : 'Code Signing'
    })),

    devices: Array.from({ length: 30 }, (_, i) => ({
      id: `device-${i + 1}`,
      hostname: `device-${i + 1}`,
      ip_address: `192.168.1.${i + 1}`,
      status: deviceStatuses[Math.floor(Math.random() * deviceStatuses.length)],
      type: Math.random() > 0.5 ? 'F5 Load Balancer' : 'Nginx Proxy',
      location: `Datacenter ${Math.floor(i / 10) + 1}`,
      certificates: [`cert-${i + 1}`, `cert-${i + 2}`]
    })),

    vulnerabilities: Array.from({ length: 15 }, (_, i) => ({
      id: `vuln-${i + 1}`,
      title: `Vulnerability ${i + 1}`,
      severity: severities[Math.floor(Math.random() * severities.length)],
      status: Math.random() > 0.5 ? 'open' : 'resolved',
      affected_devices: [`device-${i + 1}`, `device-${i + 2}`],
      affected_certificates: [`cert-${i + 1}`]
    })),

    metrics: {
      timestamp: new Date().toISOString(),
      performance: {
        response_time: Math.random() * 100,
        throughput: Math.random() * 1000,
        error_rate: Math.random() * 5
      }
    }
  };
};

export default AdvancedDashboard;