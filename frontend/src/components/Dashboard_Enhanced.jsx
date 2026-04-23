// frontend/src/components/Dashboard.jsx (VERSIÓN CON ERROR HANDLING & VALIDACIÓN ROBUSTA)

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Grid, 
  Paper, 
  Typography, 
  Box, 
  useTheme, 
  GlobalStyles,
  Alert,
  AlertTitle,
  Button,
  Snackbar
} from '@mui/material';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import DnsIcon from '@mui/icons-material/Dns';
import LanguageIcon from '@mui/icons-material/Language';
import PowerIcon from '@mui/icons-material/Power';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import LinkIcon from '@mui/icons-material/Link';
import RefreshIcon from '@mui/icons-material/Refresh';

// Error handling components
import ErrorBoundary from './ErrorBoundary';

// Loading context
import { 
  useLoading, 
  LoadingWrapper, 
  OverallProgress,
  DASHBOARD_SECTIONS 
} from '../context/LoadingContext';

// Validation schemas
import { validateDashboardData, DashboardMetricsSchema } from '../utils/validationSchemas';

// Retry hooks
import { useApiRetry, retryUtils } from '../hooks/useRetry';

// Dashboard sections
import AlertsSection from './AlertsSection';
import QuickActions from './QuickActions';
import MetricsSection from './MetricsSection';

// Hook para contadores animados
const useCountUp = (end, duration = 1000, startDelay = 0) => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      if (end === 0) {
        setCount(0);
        return;
      }

      let startTime = null;
      const animate = (currentTime) => {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        setCount(Math.floor(easeOutCubic * end));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setCount(end);
        }
      };
      requestAnimationFrame(animate);
    }, startDelay);
    
    return () => clearTimeout(timer);
  }, [end, duration, startDelay]);
  
  return count;
};

const glassmorphicStyle = {
  p: { xs: 2, sm: 2.5 },
  height: '100%',
  backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(26, 33, 51, 0.6)' : 'rgba(255, 255, 255, 0.7)',
  backdropFilter: 'blur(12px)',
  border: '1px solid',
  borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
  borderRadius: (theme) => theme.shape.borderRadius,
  transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
};

const StatCard = ({ title, value, color, onClick, icon: Icon, delay = 0, lastUpdated, error = null, onRetry = null }) => {
  const animatedValue = useCountUp(error ? 0 : value, 1200, delay);
  const theme = useTheme();
  
  // Format last updated time
  const getTimeAgo = (date) => {
    if (!date) return 'Just now';
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  // Handle error state
  if (error) {
    return (
      <Paper 
        elevation={0}
        sx={{ 
          ...glassmorphicStyle,
          textAlign: 'center',
          borderRadius: '16px',
          position: 'relative',
          overflow: 'hidden',
          borderColor: theme.palette.error.main,
          backgroundColor: `${theme.palette.error.main}10`
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          mb: 1,
          color: theme.palette.error.main,
          opacity: 0.8 
        }}>
          <ErrorIcon sx={{ fontSize: 32 }} />
        </Box>
        
        <Typography 
          variant="body2" 
          color="error.main"
          gutterBottom
          sx={{ 
            fontWeight: 500,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            fontSize: '0.75rem'
          }}
        >
          Error: {title}
        </Typography>
        
        <Typography 
          variant="body2" 
          color="text.secondary"
          sx={{ mb: 1, fontSize: '0.7rem' }}
        >
          {error.message || 'Failed to load data'}
        </Typography>

        {onRetry && (
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<RefreshIcon />}
            onClick={onRetry}
            sx={{ mt: 1 }}
          >
            Retry
          </Button>
        )}
      </Paper>
    );
  }
  
  return (
    <Paper 
      elevation={0}
      sx={{ 
        ...glassmorphicStyle,
        textAlign: 'center',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        borderRadius: '16px',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
          transform: 'translateY(-8px) scale(1.02)',
          boxShadow: (theme) => theme.palette.mode === 'dark' 
            ? '0 20px 40px rgba(0,0,0,0.4)' 
            : '0 20px 40px rgba(90, 100, 120, 0.25)',
        },
        '&:active': {
          transform: 'translateY(-4px) scale(1.01)',
        },
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: `linear-gradient(90deg, ${color}, ${color}80)`,
          opacity: 0.8,
        }
      }} 
      onClick={onClick}
    >
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        mb: 1,
        color: color,
        opacity: 0.8 
      }}>
        <Icon sx={{ fontSize: 32 }} />
      </Box>
      
      <Typography 
        variant="body2" 
        color="text.secondary" 
        gutterBottom
        sx={{ 
          fontWeight: 500,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          fontSize: '0.75rem'
        }}
      >
        {title}
      </Typography>
      
      <Typography 
        variant="h3" 
        component="p" 
        sx={{ 
          fontWeight: 700, 
          color,
          background: `linear-gradient(45deg, ${color}, ${color}80)`,
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: 'none',
          fontSize: { xs: '2rem', sm: '2.5rem' },
          lineHeight: 1
        }}
      >
        {animatedValue}
      </Typography>
      
      <Typography 
        variant="caption" 
        color="text.secondary"
        sx={{ 
          mt: 0.5,
          fontStyle: 'italic',
          opacity: 0.7,
          fontSize: '0.65rem'
        }}
      >
        {getTimeAgo(lastUpdated)}
      </Typography>
    </Paper>
  );
};

// --- Componente principal del Dashboard con Error Handling Robusto ---
const Dashboard = ({ stats, systemStats, onFilterSelect, lastUpdated }) => {
  const theme = useTheme();
  
  // Loading states management
  const { 
    setLoading, 
    setSuccess, 
    setError,
    isLoading,
    hasError,
    getSectionState
  } = useLoading();

  // Retry logic for data fetching
  const { 
    executeWithRetry, 
    isRetrying, 
    retryCount, 
    error: retryError,
    reset: resetRetry 
  } = useApiRetry({
    maxRetries: 3,
    initialDelay: 1000,
    onRetry: (error, attempt, delay) => {
      console.warn(`Dashboard data retry attempt ${attempt}:`, error.message);
    },
    onFailure: (error, attempts) => {
      console.error(`Dashboard data failed after ${attempts} attempts:`, error);
      setError(DASHBOARD_SECTIONS.METRICS, error);
    }
  });

  // State for validation errors and notifications
  const [validationErrors, setValidationErrors] = useState([]);
  const [showValidationAlert, setShowValidationAlert] = useState(false);
  const [processedData, setProcessedData] = useState({
    metrics: null,
    validationResults: null
  });

  // Validate and process incoming data
  const validateAndProcessData = useCallback((stats, systemStats) => {
    try {
      setLoading(DASHBOARD_SECTIONS.METRICS, 10);

      // Sanitize input data
      const dashboardData = {
        metrics: DashboardMetricsSchema.sanitize({
          certificates: stats,
          devices: systemStats?.devices,
          vips: systemStats?.vips,
          ssl_profiles: systemStats?.ssl_profiles
        }),
        lastUpdated
      };

      setLoading(DASHBOARD_SECTIONS.METRICS, 40);

      // Validate the sanitized data
      const validationResults = validateDashboardData(dashboardData);
      
      setLoading(DASHBOARD_SECTIONS.METRICS, 80);

      if (!validationResults.isValid) {
        console.warn('Dashboard data validation errors:', validationResults.errors);
        setValidationErrors(validationResults.errors);
        setShowValidationAlert(true);
        
        // Use sanitized data even with validation errors
        setProcessedData({
          metrics: dashboardData.metrics,
          validationResults
        });
      } else {
        setValidationErrors([]);
        setProcessedData({
          metrics: dashboardData.metrics,
          validationResults
        });
      }

      setLoading(DASHBOARD_SECTIONS.METRICS, 100);
      setSuccess(DASHBOARD_SECTIONS.METRICS);

      return dashboardData.metrics;
    } catch (error) {
      console.error('Dashboard data processing error:', error);
      setError(DASHBOARD_SECTIONS.METRICS, error);
      setProcessedData({ metrics: null, validationResults: null });
      throw error;
    }
  }, [setLoading, setSuccess, setError, lastUpdated]);

  // Effect to process data when props change
  useEffect(() => {
    if (stats || systemStats) {
      validateAndProcessData(stats, systemStats);
    }
  }, [stats, systemStats, validateAndProcessData]);

  // Retry data loading
  const handleRetryData = useCallback(async () => {
    try {
      resetRetry();
      await executeWithRetry(async () => {
        return validateAndProcessData(stats, systemStats);
      });
    } catch (error) {
      console.error('Retry failed:', error);
    }
  }, [executeWithRetry, resetRetry, validateAndProcessData, stats, systemStats]);

  // Extract safe data with fallbacks
  const safeStats = processedData.metrics?.certificates || stats || {};
  const total = safeStats.total ?? 0;
  const healthy = safeStats.active ?? safeStats.healthy ?? 0;
  const warning = safeStats.expiring_soon ?? safeStats.warning ?? 0;
  const expired = safeStats.expired ?? 0;

  // Device statistics from system stats with validation
  const deviceStats = processedData.metrics?.devices || systemStats?.devices || {};
  const totalDevices = deviceStats.total ?? 0;
  const activeDevices = deviceStats.online ?? deviceStats.active ?? 0;
  const inactiveDevices = deviceStats.offline ?? deviceStats.inactive ?? 0;

  // VIPs statistics with validation
  const vipStats = processedData.metrics?.vips || systemStats?.vips || {};
  const totalVips = vipStats.total ?? 0;
  const enabledVips = vipStats.secured ?? vipStats.enabled ?? 0;
  const disabledVips = vipStats.unsecured ?? vipStats.disabled ?? 0;

  // SSL Profiles statistics with validation
  const sslProfileStats = processedData.metrics?.ssl_profiles || systemStats?.ssl_profiles || {};
  const totalProfiles = sslProfileStats.total ?? 0;
  const profilesWithCerts = sslProfileStats.with_certificates ?? 0;

  const pieData = [
    { name: 'Healthy (> 30d)', value: healthy, color: theme.palette.success.main },
    { name: 'Warning (< 30d)', value: warning, color: theme.palette.warning.main },
    { name: 'Expired', value: expired, color: theme.palette.error.main },
  ];
  
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, payload }) => {
    if (percent * 100 < 5) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text x={x} y={y} fill={theme.palette.getContrastText(payload.color)} textAnchor="middle" dominantBaseline="central" fontWeight="bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <ErrorBoundary title="Dashboard Error" variant="full">
      <OverallProgress />
      
      {/* Validation Errors Notification */}
      <Snackbar
        open={showValidationAlert}
        autoHideDuration={6000}
        onClose={() => setShowValidationAlert(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          severity="warning" 
          onClose={() => setShowValidationAlert(false)}
          action={
            <Button size="small" onClick={handleRetryData}>
              Retry
            </Button>
          }
        >
          <AlertTitle>Data Validation Issues</AlertTitle>
          {validationErrors.length > 0 && (
            <Typography variant="body2">
              {validationErrors.slice(0, 3).map(err => err.message).join(', ')}
              {validationErrors.length > 3 && ` and ${validationErrors.length - 3} more...`}
            </Typography>
          )}
        </Alert>
      </Snackbar>

      <GlobalStyles styles={{
        '@keyframes fadeInSlideUp': {
          from: {
            opacity: 0,
            transform: 'translateY(10px)'
          },
          to: {
            opacity: 1,
            transform: 'translateY(0)'
          }
        }
      }} />
      
      <Box>
        {/* --- CERTIFICADOS --- */}
        <ErrorBoundary title="Certificate Metrics Error" variant="section">
          <LoadingWrapper 
            section={DASHBOARD_SECTIONS.METRICS}
            showProgress={true}
            errorFallback={
              <Alert severity="error" action={
                <Button size="small" onClick={handleRetryData}>
                  Retry
                </Button>
              }>
                Error loading certificate metrics
              </Alert>
            }
          >
            <MetricsSection 
              title="Certificate Overview" 
              subtitle="SSL/TLS certificate status and health metrics"
              icon={SecurityIcon}
              delay={0}
            >
              <Grid item xs={12} sm={6} md={3}>
                <StatCard 
                  title="Total Certificates" 
                  value={total} 
                  color={theme.palette.text.primary} 
                  onClick={() => onFilterSelect(null)}
                  icon={SecurityIcon}
                  delay={0}
                  lastUpdated={lastUpdated}
                  error={hasError(DASHBOARD_SECTIONS.METRICS) ? getSectionState(DASHBOARD_SECTIONS.METRICS).error : null}
                  onRetry={handleRetryData}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard 
                  title="Healthy (> 30 days)" 
                  value={healthy} 
                  color={theme.palette.success.main} 
                  onClick={() => onFilterSelect({ type: 'status', value: 'healthy' })}
                  icon={CheckCircleIcon}
                  delay={100}
                  lastUpdated={lastUpdated}
                  error={hasError(DASHBOARD_SECTIONS.METRICS) ? getSectionState(DASHBOARD_SECTIONS.METRICS).error : null}
                  onRetry={handleRetryData}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard 
                  title="Warning (< 30 days)" 
                  value={warning} 
                  color={theme.palette.warning.main} 
                  onClick={() => onFilterSelect({ type: 'status', value: 'warning' })}
                  icon={WarningIcon}
                  delay={200}
                  lastUpdated={lastUpdated}
                  error={hasError(DASHBOARD_SECTIONS.METRICS) ? getSectionState(DASHBOARD_SECTIONS.METRICS).error : null}
                  onRetry={handleRetryData}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard 
                  title="Expired" 
                  value={expired} 
                  color={theme.palette.error.main} 
                  onClick={() => onFilterSelect({ type: 'status', value: 'expired' })}
                  icon={ErrorIcon}
                  delay={300}
                  lastUpdated={lastUpdated}
                  error={hasError(DASHBOARD_SECTIONS.METRICS) ? getSectionState(DASHBOARD_SECTIONS.METRICS).error : null}
                  onRetry={handleRetryData}
                />
              </Grid>
            </MetricsSection>
          </LoadingWrapper>
        </ErrorBoundary>

        {/* --- DISPOSITIVOS --- */}
        <ErrorBoundary title="Device Metrics Error" variant="section">
          <LoadingWrapper section={DASHBOARD_SECTIONS.DEVICES}>
            <MetricsSection 
              title="Device Infrastructure" 
              subtitle="F5 load balancer status and connectivity"
              icon={DnsIcon}
              delay={200}
            >
              <Grid item xs={12} sm={6} md={3}>
                <StatCard 
                  title="Total Devices" 
                  value={totalDevices} 
                  color={theme.palette.info.main} 
                  onClick={() => onFilterSelect({ type: 'devices', value: 'all' })}
                  icon={DnsIcon}
                  delay={400}
                  lastUpdated={lastUpdated}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard 
                  title="Active Devices" 
                  value={activeDevices} 
                  color={theme.palette.success.main} 
                  onClick={() => onFilterSelect({ type: 'devices', value: 'active' })}
                  icon={PowerIcon}
                  delay={500}
                  lastUpdated={lastUpdated}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard 
                  title="Inactive Devices" 
                  value={inactiveDevices} 
                  color={theme.palette.warning.main} 
                  onClick={() => onFilterSelect({ type: 'devices', value: 'inactive' })}
                  icon={PowerIcon}
                  delay={600}
                  lastUpdated={lastUpdated}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard 
                  title="Total VIPs" 
                  value={totalVips} 
                  color={theme.palette.primary.main} 
                  onClick={() => onFilterSelect({ type: 'vips', value: 'all' })}
                  icon={LanguageIcon}
                  delay={700}
                  lastUpdated={lastUpdated}
                />
              </Grid>
            </MetricsSection>
          </LoadingWrapper>
        </ErrorBoundary>

        {/* --- SSL PROFILES Y VIPS AVANZADOS --- */}
        <ErrorBoundary title="SSL Configuration Error" variant="section">
          <LoadingWrapper section={DASHBOARD_SECTIONS.CHARTS}>
            <MetricsSection 
              title="SSL Configuration" 
              subtitle="SSL profiles and VIP configuration status"
              icon={AccountTreeIcon}
              delay={400}
            >
              <Grid item xs={12} sm={6} md={3}>
                <StatCard 
                  title="SSL Profiles" 
                  value={totalProfiles} 
                  color={theme.palette.info.main} 
                  onClick={() => onFilterSelect({ type: 'profiles', value: 'all' })}
                  icon={AccountTreeIcon}
                  delay={800}
                  lastUpdated={lastUpdated}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard 
                  title="Profiles with Certs" 
                  value={profilesWithCerts} 
                  color={theme.palette.success.main} 
                  onClick={() => onFilterSelect({ type: 'profiles', value: 'with_certs' })}
                  icon={LinkIcon}
                  delay={900}
                  lastUpdated={lastUpdated}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard 
                  title="Enabled VIPs" 
                  value={enabledVips} 
                  color={theme.palette.success.main} 
                  onClick={() => onFilterSelect({ type: 'vips', value: 'enabled' })}
                  icon={LanguageIcon}
                  delay={1000}
                  lastUpdated={lastUpdated}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard 
                  title="Disabled VIPs" 
                  value={disabledVips} 
                  color={theme.palette.warning.main} 
                  onClick={() => onFilterSelect({ type: 'vips', value: 'disabled' })}
                  icon={LanguageIcon}
                  delay={1100}
                  lastUpdated={lastUpdated}
                />
              </Grid>
            </MetricsSection>
          </LoadingWrapper>
        </ErrorBoundary>
        
        {/* --- SECCIÓN DE QUICK ACTIONS --- */}
        <ErrorBoundary title="Quick Actions Error" variant="section">
          <LoadingWrapper section={DASHBOARD_SECTIONS.RECENT_ACTIVITY}>
            <Box sx={{ mb: 4 }}>
              <QuickActions systemStats={systemStats} />
            </Box>
          </LoadingWrapper>
        </ErrorBoundary>
        
        {/* --- SECCIÓN INFERIOR: ALERTAS Y GRÁFICO --- */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <ErrorBoundary title="Alerts Error" variant="section">
              <LoadingWrapper section={DASHBOARD_SECTIONS.ALERTS}>
                <AlertsSection systemStats={systemStats} />
              </LoadingWrapper>
            </ErrorBoundary>
          </Grid>
          
          {/* --- GRÁFICO DE CERTIFICADOS MEJORADO --- */}
          <Grid item xs={12} md={6}>
            <ErrorBoundary title="Certificate Chart Error" variant="section">
              <LoadingWrapper section={DASHBOARD_SECTIONS.CHARTS}>
                <Paper 
                      elevation={0} 
                      sx={{ 
                        ...glassmorphicStyle, 
                        borderRadius: '16px',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                   <Typography 
                     variant="h6" 
                     align="center" 
                     sx={{ 
                       fontWeight: 700, 
                       mb: 2,
                       background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                       backgroundClip: 'text',
                       WebkitBackgroundClip: 'text',
                       WebkitTextFillColor: 'transparent',
                       fontSize: '1.25rem'
                     }}
                   >
                     Certificate Health Overview
                   </Typography>
                   
                   <Box sx={{ width: '100%', height: 320, position: 'relative' }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <defs>
                                  <linearGradient id="healthyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor={theme.palette.success.light} />
                                    <stop offset="100%" stopColor={theme.palette.success.dark} />
                                  </linearGradient>
                                  <linearGradient id="warningGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor={theme.palette.warning.light} />
                                    <stop offset="100%" stopColor={theme.palette.warning.dark} />
                                  </linearGradient>
                                  <linearGradient id="expiredGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor={theme.palette.error.light} />
                                    <stop offset="100%" stopColor={theme.palette.error.dark} />
                                  </linearGradient>
                                </defs>
                                <Pie 
                                    data={pieData} 
                                    dataKey="value" 
                                    nameKey="name" 
                                    cx="50%" 
                                    cy="50%" 
                                    outerRadius="85%"
                                    innerRadius="55%"
                                    paddingAngle={2}
                                    labelLine={false}
                                    label={renderCustomizedLabel}
                                    animationBegin={400}
                                    animationDuration={1200}
                                >
                                    {pieData.map((entry, index) => {
                                      let fill = entry.color;
                                      if (entry.name.includes('Healthy')) fill = 'url(#healthyGrad)';
                                      else if (entry.name.includes('Warning')) fill = 'url(#warningGrad)';
                                      else if (entry.name.includes('Expired')) fill = 'url(#expiredGrad)';
                                      
                                      return (
                                        <Cell 
                                          key={`cell-${index}`} 
                                          fill={fill} 
                                          stroke={theme.palette.background.paper} 
                                          strokeWidth={3}
                                          style={{
                                            filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.1))',
                                            cursor: 'pointer'
                                          }}
                                        />
                                      );
                                    })}
                                </Pie>
                                <Tooltip
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0];
                                      const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
                                      return (
                                        <Box
                                          sx={{
                                            backgroundColor: theme.palette.background.paper,
                                            border: `1px solid ${theme.palette.divider}`,
                                            borderRadius: '12px',
                                            p: 2,
                                            boxShadow: theme.shadows[8],
                                            backdropFilter: 'blur(8px)'
                                          }}
                                        >
                                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                            {data.name}
                                          </Typography>
                                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                            {data.value} certificates ({percentage}%)
                                          </Typography>
                                        </Box>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        
                        {/* Centro del donut con métricas principales */}
                        <Box
                          sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            textAlign: 'center',
                            pointerEvents: 'none'
                          }}
                        >
                          <Typography 
                            variant="h4" 
                            sx={{ 
                              fontWeight: 800,
                              background: `linear-gradient(45deg, ${theme.palette.text.primary}, ${theme.palette.primary.main})`,
                              backgroundClip: 'text',
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              mb: 0.5
                            }}
                          >
                            {total}
                          </Typography>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: 'text.secondary',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              fontSize: '0.75rem'
                            }}
                          >
                            Total Certificates
                          </Typography>
                          {total > 0 && (
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                color: expired > 0 ? theme.palette.error.main : 
                                      warning > 0 ? theme.palette.warning.main : 
                                      theme.palette.success.main,
                                fontWeight: 600,
                                mt: 0.5,
                                display: 'block'
                              }}
                            >
                              {expired > 0 ? `${expired} Expired` : 
                               warning > 0 ? `${warning} Expiring Soon` : 
                               'All Healthy'}
                            </Typography>
                          )}
                        </Box>
                        
                        {/* Leyenda personalizada */}
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: 8,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            display: 'flex',
                            gap: 2,
                            flexWrap: 'wrap',
                            justifyContent: 'center'
                          }}
                        >
                          {pieData.map((entry, index) => {
                            const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(0) : 0;
                            return (
                              <Box
                                key={entry.name}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                  opacity: 0,
                                  animation: `fadeInSlideUp 0.6s ease-out ${800 + index * 200}ms forwards`
                                }}
                              >
                                <Box
                                  sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    backgroundColor: entry.color,
                                    boxShadow: `0 2px 4px ${entry.color}40`
                                  }}
                                />
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    color: 'text.secondary'
                                  }}
                                >
                                  {percentage}%
                                </Typography>
                              </Box>
                            );
                          })}
                        </Box>
                    </Box>
                </Paper>
              </LoadingWrapper>
            </ErrorBoundary>
          </Grid>
        </Grid>
      </Box>
    </ErrorBoundary>
  );
};

export default Dashboard;