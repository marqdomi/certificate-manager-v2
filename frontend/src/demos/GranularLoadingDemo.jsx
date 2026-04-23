/**
 * 📖 Granular Loading States - Guía de Uso
 * CMT v2.5 Dashboard - Sistema de Estados de Carga Granulares
 */

import React, { useEffect } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import {
  LoadingProvider,
  useLoading,
  LoadingWrapper,
  ProgressTracker,
  LoadingStats,
  OverallProgress,
  DASHBOARD_SECTIONS,
  MetricsSkeleton,
  CertificateSkeleton,
  DeviceSkeleton,
  VipsSkeleton,
  AlertsSkeleton,
  ChartSkeleton
} from '../context/LoadingContext';

/**
 * 🎯 Ejemplo 1: Uso Básico con LoadingWrapper
 */
const BasicExample = () => {
  const { setLoading, setProgress, setSuccess, isLoading } = useLoading();

  const simulateLoading = async (section) => {
    setLoading(section, 0, 'Iniciando carga...');
    
    // Simular pasos de carga
    for (let i = 0; i <= 100; i += 20) {
      await new Promise(resolve => setTimeout(resolve, 500));
      setProgress(section, i);
    }
    
    setSuccess(section);
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h5">Ejemplo Básico - LoadingWrapper</Typography>
      
      {/* Controles */}
      <Stack direction="row" spacing={2}>
        <Button 
          variant="outlined" 
          onClick={() => simulateLoading(DASHBOARD_SECTIONS.METRICS)}
          disabled={isLoading(DASHBOARD_SECTIONS.METRICS)}
        >
          Cargar Métricas
        </Button>
        <Button 
          variant="outlined" 
          onClick={() => simulateLoading(DASHBOARD_SECTIONS.CERTIFICATES)}
          disabled={isLoading(DASHBOARD_SECTIONS.CERTIFICATES)}
        >
          Cargar Certificados
        </Button>
      </Stack>

      {/* Contenido envuelto con Loading States */}
      <LoadingWrapper 
        section={DASHBOARD_SECTIONS.METRICS}
        showProgress={true}
        showSteps={true}
        showEstimate={true}
      >
        <Typography variant="h6">✅ Métricas Cargadas</Typography>
        <Typography>Total certificados: 156</Typography>
        <Typography>Certificados expirados: 3</Typography>
        <Typography>Próximos a expirar: 12</Typography>
      </LoadingWrapper>

      <LoadingWrapper 
        section={DASHBOARD_SECTIONS.CERTIFICATES}
        showProgress={true}
        transition="slide"
      >
        <Typography variant="h6">✅ Certificados Cargados</Typography>
        <Typography>Lista de certificados SSL/TLS activos</Typography>
      </LoadingWrapper>
    </Stack>
  );
};

/**
 * 🎯 Ejemplo 2: Tracking Avanzado con Pasos
 */
const AdvancedTrackingExample = () => {
  const { 
    setLoading, 
    setTotalSteps, 
    startStep, 
    completeStep, 
    setProgress, 
    setSuccess 
  } = useLoading();

  const simulateAdvancedLoading = async (section) => {
    const steps = [
      'Conectando a servidor',
      'Autenticando',
      'Descargando datos',
      'Procesando información',
      'Validando certificados',
      'Finalizando'
    ];

    setTotalSteps(section, steps.length);
    setLoading(section, 0);

    for (let i = 0; i < steps.length; i++) {
      startStep(section, steps[i]);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      completeStep(section, steps[i]);
      setProgress(section, Math.round(((i + 1) / steps.length) * 100));
    }

    setSuccess(section);
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h5">Ejemplo Avanzado - Tracking por Pasos</Typography>
      
      <Button 
        variant="contained" 
        onClick={() => simulateAdvancedLoading(DASHBOARD_SECTIONS.DEVICES)}
      >
        Cargar Dispositivos (Con Pasos)
      </Button>

      <ProgressTracker 
        section={DASHBOARD_SECTIONS.DEVICES} 
        detailed={true} 
      />

      <LoadingWrapper 
        section={DASHBOARD_SECTIONS.DEVICES}
        showProgress={true}
        showSteps={true}
        showEstimate={true}
      >
        <Typography variant="h6">✅ Dispositivos Cargados</Typography>
        <Typography>F5 BigIP: 4 dispositivos</Typography>
        <Typography>Estados: 3 online, 1 mantenimiento</Typography>
      </LoadingWrapper>
    </Stack>
  );
};

/**
 * 🎯 Ejemplo 3: Múltiples Secciones y Progreso Global
 */
const GlobalProgressExample = () => {
  const { setLoading, setProgress, setSuccess } = useLoading();

  const simulateMultipleSections = async () => {
    const sections = [
      DASHBOARD_SECTIONS.METRICS,
      DASHBOARD_SECTIONS.CERTIFICATES,
      DASHBOARD_SECTIONS.DEVICES,
      DASHBOARD_SECTIONS.VIPS,
      DASHBOARD_SECTIONS.ALERTS
    ];

    // Iniciar todas las secciones
    sections.forEach(section => {
      setLoading(section, 0);
    });

    // Simular carga progresiva
    for (let progress = 0; progress <= 100; progress += 10) {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      sections.forEach(section => {
        const randomVariation = Math.random() * 20 - 10; // ±10%
        const sectionProgress = Math.max(0, Math.min(100, progress + randomVariation));
        setProgress(section, sectionProgress);
      });
    }

    // Completar todas las secciones
    sections.forEach(section => {
      setSuccess(section);
    });
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h5">Ejemplo Global - Múltiples Secciones</Typography>
      
      <Button 
        variant="contained" 
        color="secondary"
        onClick={simulateMultipleSections}
      >
        Cargar Todo el Dashboard
      </Button>

      {/* Progreso global en la parte superior */}
      <OverallProgress position="card" showDetails={true} showSections={true} />

      {/* Estadísticas de carga */}
      <LoadingStats showHistory={true} />

      {/* Secciones individuales */}
      <Stack spacing={2}>
        {Object.values(DASHBOARD_SECTIONS).map(section => (
          <LoadingWrapper 
            key={section}
            section={section}
            showProgress={true}
          >
            <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
              ✅ {section.replace('_', ' ')} - Datos Cargados
            </Typography>
          </LoadingWrapper>
        ))}
      </Stack>
    </Stack>
  );
};

/**
 * 🎯 Ejemplo 4: Skeletons Especializados
 */
const SkeletonShowcase = () => {
  return (
    <Stack spacing={3}>
      <Typography variant="h5">Skeletons Especializados</Typography>
      
      <Box>
        <Typography variant="h6" gutterBottom>Métricas Skeleton</Typography>
        <MetricsSkeleton count={4} animated={true} />
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>Certificados Skeleton</Typography>
        <CertificateSkeleton rows={3} showActions={true} />
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>Dispositivos Skeleton</Typography>
        <DeviceSkeleton rows={2} showNetwork={true} />
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>VIPs Skeleton</Typography>
        <VipsSkeleton rows={4} showStatus={true} />
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>Alertas Skeleton</Typography>
        <AlertsSkeleton count={3} showSeverity={true} />
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>Gráficos Skeleton</Typography>
        <Stack direction="row" spacing={2}>
          <ChartSkeleton type="line" height={250} showLegend={true} />
          <ChartSkeleton type="pie" height={250} showLegend={true} />
          <ChartSkeleton type="bar" height={250} showLegend={true} />
        </Stack>
      </Box>
    </Stack>
  );
};

/**
 * 🎯 Componente Principal de Demostración
 */
const GranularLoadingDemo = () => {
  return (
    <LoadingProvider>
      <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
        <Typography variant="h4" gutterBottom align="center">
          🎯 Granular Loading States Demo
        </Typography>
        <Typography variant="subtitle1" gutterBottom align="center" color="text.secondary">
          CMT v2.5 - Sistema de Estados de Carga Granulares
        </Typography>

        {/* Progreso global siempre visible */}
        <OverallProgress position="top" />

        <Stack spacing={6} sx={{ mt: 4 }}>
          <BasicExample />
          <AdvancedTrackingExample />
          <GlobalProgressExample />
          <SkeletonShowcase />
        </Stack>
      </Box>
    </LoadingProvider>
  );
};

export default GranularLoadingDemo;

/**
 * 📚 GUÍA DE USO RÁPIDA:
 * 
 * 1. CONFIGURACIÓN BÁSICA:
 *    - Envolver tu app con <LoadingProvider>
 *    - Usar useLoading() para controlar estados
 * 
 * 2. LOADING WRAPPER:
 *    <LoadingWrapper 
 *      section={DASHBOARD_SECTIONS.METRICS}
 *      showProgress={true}
 *      showSteps={true}
 *      showEstimate={true}
 *    >
 *      Tu contenido aquí
 *    </LoadingWrapper>
 * 
 * 3. CONTROL MANUAL:
 *    const { setLoading, setProgress, setSuccess } = useLoading();
 *    setLoading(section, 0, 'Paso inicial');
 *    setProgress(section, 50);
 *    setSuccess(section);
 * 
 * 4. TRACKING AVANZADO:
 *    setTotalSteps(section, 5);
 *    startStep(section, 'Conectando...');
 *    completeStep(section, 'Conectando...');
 * 
 * 5. COMPONENTES ÚTILES:
 *    - <ProgressTracker section={section} detailed={true} />
 *    - <LoadingStats showHistory={true} />
 *    - <OverallProgress position="top" />
 * 
 * 6. SKELETONS ESPECIALIZADOS:
 *    - <MetricsSkeleton count={4} />
 *    - <CertificateSkeleton rows={5} />
 *    - <ChartSkeleton type="pie" height={300} />
 */