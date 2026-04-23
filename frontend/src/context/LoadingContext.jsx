import React, { createContext, useContext, useReducer, useCallback } from 'react';
import {
  Skeleton,
  Box,
  Card,
  CardContent,
  LinearProgress,
  Typography,
  Stack,
  Fade,
  CircularProgress,
  Alert,
  Chip,
  Backdrop,
  Paper,
  useTheme,
  alpha,
  styled
} from '@mui/material';
import { keyframes } from '@mui/material/styles';

/**
 * ⏳ Enhanced Loading States Context & Management - CMT v2.5
 * Sistema granular y global de estados de carga para toda la aplicación
 */

// Estados de loading disponibles
export const LOADING_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error'
};

// Secciones del Dashboard que pueden tener loading independiente
export const DASHBOARD_SECTIONS = {
  METRICS: 'metrics',
  CERTIFICATES: 'certificates',
  DEVICES: 'devices',
  VIPS: 'vips',
  ALERTS: 'alerts',
  CHARTS: 'charts',
  RECENT_ACTIVITY: 'recent_activity'
};

// Estado inicial mejorado con tracking avanzado y funcionalidades globales
const initialState = {
  // Estados por sección del dashboard
  [DASHBOARD_SECTIONS.METRICS]: { 
    status: LOADING_STATES.IDLE, 
    progress: 0, 
    error: null,
    startTime: null,
    estimatedTime: null,
    completedSteps: [],
    totalSteps: 0,
    currentStep: null
  },
  [DASHBOARD_SECTIONS.CERTIFICATES]: { 
    status: LOADING_STATES.IDLE, 
    progress: 0, 
    error: null,
    startTime: null,
    estimatedTime: null,
    completedSteps: [],
    totalSteps: 0,
    currentStep: null
  },
  [DASHBOARD_SECTIONS.DEVICES]: { 
    status: LOADING_STATES.IDLE, 
    progress: 0, 
    error: null,
    startTime: null,
    estimatedTime: null,
    completedSteps: [],
    totalSteps: 0,
    currentStep: null
  },
  [DASHBOARD_SECTIONS.VIPS]: { 
    status: LOADING_STATES.IDLE, 
    progress: 0, 
    error: null,
    startTime: null,
    estimatedTime: null,
    completedSteps: [],
    totalSteps: 0,
    currentStep: null
  },
  [DASHBOARD_SECTIONS.ALERTS]: { 
    status: LOADING_STATES.IDLE, 
    progress: 0, 
    error: null,
    startTime: null,
    estimatedTime: null,
    completedSteps: [],
    totalSteps: 0,
    currentStep: null
  },
  [DASHBOARD_SECTIONS.CHARTS]: { 
    status: LOADING_STATES.IDLE, 
    progress: 0, 
    error: null,
    startTime: null,
    estimatedTime: null,
    completedSteps: [],
    totalSteps: 0,
    currentStep: null
  },
  [DASHBOARD_SECTIONS.RECENT_ACTIVITY]: { 
    status: LOADING_STATES.IDLE, 
    progress: 0, 
    error: null,
    startTime: null,
    estimatedTime: null,
    completedSteps: [],
    totalSteps: 0,
    currentStep: null
  },
  // Global loading state for application-wide operations
  globalLoading: {
    isActive: false,
    operation: null,
    progress: 0,
    message: '',
    stage: null,
    stages: [],
    startTime: null,
    error: null,
    showProgress: true,
    overlay: true
  },
  // Loading preferences and configuration
  preferences: {
    showDetailedProgress: true,
    enableOverallProgress: true,
    animateTransitions: true,
    enableSoundFeedback: false,
    progressUpdateInterval: 100,
    errorDisplayDuration: 5000,
    successDisplayDuration: 3000
  },
  // Metadata global del sistema de loading
  global: {
    totalSections: Object.keys(DASHBOARD_SECTIONS).length,
    completedSections: 0,
    activeSections: [],
    overallStartTime: null,
    loadingHistory: []
  }
};

// Actions mejorados
const ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_SUCCESS: 'SET_SUCCESS',
  SET_ERROR: 'SET_ERROR',
  SET_PROGRESS: 'SET_PROGRESS',
  RESET_SECTION: 'RESET_SECTION',
  RESET_ALL: 'RESET_ALL',
  START_STEP: 'START_STEP',
  COMPLETE_STEP: 'COMPLETE_STEP',
  SET_TOTAL_STEPS: 'SET_TOTAL_STEPS',
  UPDATE_ESTIMATE: 'UPDATE_ESTIMATE',
  // Global loading actions
  START_GLOBAL_LOADING: 'START_GLOBAL_LOADING',
  UPDATE_GLOBAL_PROGRESS: 'UPDATE_GLOBAL_PROGRESS',
  SET_GLOBAL_STAGE: 'SET_GLOBAL_STAGE',
  SET_GLOBAL_MESSAGE: 'SET_GLOBAL_MESSAGE',
  COMPLETE_GLOBAL_LOADING: 'COMPLETE_GLOBAL_LOADING',
  ERROR_GLOBAL_LOADING: 'ERROR_GLOBAL_LOADING',
  CLEAR_GLOBAL_LOADING: 'CLEAR_GLOBAL_LOADING',
  UPDATE_PREFERENCES: 'UPDATE_PREFERENCES',
  ADD_TO_HISTORY: 'ADD_TO_HISTORY'
};

// Reducer mejorado con tracking avanzado
const loadingReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.SET_LOADING:
      const currentTime = Date.now();
      return {
        ...state,
        [action.section]: {
          ...state[action.section],
          status: LOADING_STATES.LOADING,
          error: null,
          progress: action.progress || 0,
          startTime: currentTime,
          currentStep: action.currentStep || null
        },
        global: {
          ...state.global,
          activeSections: [...new Set([...state.global.activeSections, action.section])],
          overallStartTime: state.global.overallStartTime || currentTime
        }
      };

    case ACTIONS.SET_SUCCESS:
      return {
        ...state,
        [action.section]: {
          ...state[action.section],
          status: LOADING_STATES.SUCCESS,
          error: null,
          progress: 100,
          completedSteps: [...state[action.section].completedSteps, 'completed']
        },
        global: {
          ...state.global,
          completedSections: state.global.completedSections + 1,
          activeSections: state.global.activeSections.filter(s => s !== action.section),
          loadingHistory: [
            ...state.global.loadingHistory,
            {
              section: action.section,
              startTime: state[action.section].startTime,
              endTime: Date.now(),
              duration: Date.now() - (state[action.section].startTime || Date.now()),
              success: true
            }
          ].slice(-50) // Keep last 50 entries
        }
      };

    case ACTIONS.SET_ERROR:
      return {
        ...state,
        [action.section]: {
          ...state[action.section],
          status: LOADING_STATES.ERROR,
          error: action.error,
          progress: 0
        },
        global: {
          ...state.global,
          activeSections: state.global.activeSections.filter(s => s !== action.section),
          loadingHistory: [
            ...state.global.loadingHistory,
            {
              section: action.section,
              startTime: state[action.section].startTime,
              endTime: Date.now(),
              duration: Date.now() - (state[action.section].startTime || Date.now()),
              success: false,
              error: action.error?.message || 'Unknown error'
            }
          ].slice(-50)
        }
      };

    case ACTIONS.SET_PROGRESS:
      const newProgress = Math.min(100, Math.max(0, action.progress));
      const currentSection = state[action.section];
      const elapsed = Date.now() - (currentSection.startTime || Date.now());
      const estimatedTotal = newProgress > 0 ? (elapsed / newProgress) * 100 : null;
      const estimatedRemaining = estimatedTotal ? estimatedTotal - elapsed : null;

      return {
        ...state,
        [action.section]: {
          ...state[action.section],
          progress: newProgress,
          estimatedTime: estimatedRemaining
        }
      };

    case ACTIONS.START_STEP:
      return {
        ...state,
        [action.section]: {
          ...state[action.section],
          currentStep: action.step
        }
      };

    case ACTIONS.COMPLETE_STEP:
      const updatedSteps = [...state[action.section].completedSteps, action.step];
      const stepProgress = state[action.section].totalSteps > 0 
        ? Math.round((updatedSteps.length / state[action.section].totalSteps) * 100)
        : state[action.section].progress;

      return {
        ...state,
        [action.section]: {
          ...state[action.section],
          completedSteps: updatedSteps,
          progress: stepProgress,
          currentStep: null
        }
      };

    case ACTIONS.SET_TOTAL_STEPS:
      return {
        ...state,
        [action.section]: {
          ...state[action.section],
          totalSteps: action.totalSteps,
          completedSteps: []
        }
      };

    case ACTIONS.RESET_SECTION:
      return {
        ...state,
        [action.section]: {
          status: LOADING_STATES.IDLE,
          progress: 0,
          error: null,
          startTime: null,
          estimatedTime: null,
          completedSteps: [],
          totalSteps: 0,
          currentStep: null
        },
        global: {
          ...state.global,
          activeSections: state.global.activeSections.filter(s => s !== action.section)
        }
      };

    case ACTIONS.RESET_ALL:
      return initialState;

    // Global loading cases
    case ACTIONS.START_GLOBAL_LOADING:
      return {
        ...state,
        globalLoading: {
          ...state.globalLoading,
          isActive: true,
          operation: action.operation,
          progress: 0,
          message: action.message || '',
          stage: action.stage || null,
          stages: action.stages || [],
          startTime: Date.now(),
          error: null,
          showProgress: action.showProgress !== undefined ? action.showProgress : true,
          overlay: action.overlay !== undefined ? action.overlay : true
        }
      };

    case ACTIONS.UPDATE_GLOBAL_PROGRESS:
      return {
        ...state,
        globalLoading: {
          ...state.globalLoading,
          progress: Math.min(Math.max(action.progress, 0), 100)
        }
      };

    case ACTIONS.SET_GLOBAL_STAGE:
      return {
        ...state,
        globalLoading: {
          ...state.globalLoading,
          stage: action.stage,
          message: action.message || state.globalLoading.message
        }
      };

    case ACTIONS.SET_GLOBAL_MESSAGE:
      return {
        ...state,
        globalLoading: {
          ...state.globalLoading,
          message: action.message
        }
      };

    case ACTIONS.COMPLETE_GLOBAL_LOADING:
      return {
        ...state,
        globalLoading: {
          ...state.globalLoading,
          isActive: false,
          progress: 100,
          message: action.message || 'Completed',
          error: null
        }
      };

    case ACTIONS.ERROR_GLOBAL_LOADING:
      return {
        ...state,
        globalLoading: {
          ...state.globalLoading,
          isActive: false,
          error: action.error,
          message: action.message || 'Error occurred'
        }
      };

    case ACTIONS.CLEAR_GLOBAL_LOADING:
      return {
        ...state,
        globalLoading: {
          ...initialState.globalLoading
        }
      };

    case ACTIONS.UPDATE_PREFERENCES:
      return {
        ...state,
        preferences: {
          ...state.preferences,
          ...action.preferences
        }
      };

    default:
      return state;
  }
};

// Context
const LoadingContext = createContext();

/**
 * 🔄 Loading Provider Component Mejorado
 */
export const LoadingProvider = ({ children }) => {
  const [state, dispatch] = useReducer(loadingReducer, initialState);

  // Funciones básicas
  const setLoading = useCallback((section, progress = 0, currentStep = null) => {
    dispatch({ type: ACTIONS.SET_LOADING, section, progress, currentStep });
  }, []);

  const setSuccess = useCallback((section) => {
    dispatch({ type: ACTIONS.SET_SUCCESS, section });
  }, []);

  const setError = useCallback((section, error) => {
    dispatch({ type: ACTIONS.SET_ERROR, section, error });
  }, []);

  const setProgress = useCallback((section, progress) => {
    dispatch({ type: ACTIONS.SET_PROGRESS, section, progress });
  }, []);

  // Funciones avanzadas de tracking
  const startStep = useCallback((section, step) => {
    dispatch({ type: ACTIONS.START_STEP, section, step });
  }, []);

  const completeStep = useCallback((section, step) => {
    dispatch({ type: ACTIONS.COMPLETE_STEP, section, step });
  }, []);

  const setTotalSteps = useCallback((section, totalSteps) => {
    dispatch({ type: ACTIONS.SET_TOTAL_STEPS, section, totalSteps });
  }, []);

  const resetSection = useCallback((section) => {
    dispatch({ type: ACTIONS.RESET_SECTION, section });
  }, []);

  const resetAll = useCallback(() => {
    dispatch({ type: ACTIONS.RESET_ALL });
  }, []);

  // Funciones de consulta mejoradas
  const getSectionState = useCallback((section) => {
    return state[section] || { 
      status: LOADING_STATES.IDLE, 
      progress: 0, 
      error: null,
      startTime: null,
      estimatedTime: null,
      completedSteps: [],
      totalSteps: 0,
      currentStep: null
    };
  }, [state]);

  const isLoading = useCallback((section) => {
    return state[section]?.status === LOADING_STATES.LOADING;
  }, [state]);

  const hasError = useCallback((section) => {
    return state[section]?.status === LOADING_STATES.ERROR;
  }, [state]);

  const isSuccess = useCallback((section) => {
    return state[section]?.status === LOADING_STATES.SUCCESS;
  }, [state]);

  // Funciones de progreso global mejoradas
  const getOverallProgress = useCallback(() => {
    const sections = Object.values(DASHBOARD_SECTIONS);
    const totalProgress = sections.reduce((acc, section) => {
      return acc + (state[section]?.progress || 0);
    }, 0);
    return Math.round(totalProgress / sections.length);
  }, [state]);

  const isAnyLoading = useCallback(() => {
    return state.global.activeSections.length > 0;
  }, [state]);

  const getActiveLoadingSections = useCallback(() => {
    return state.global.activeSections.map(section => ({
      section,
      ...state[section]
    }));
  }, [state]);

  const getEstimatedTimeRemaining = useCallback(() => {
    const activeSections = state.global.activeSections;
    if (activeSections.length === 0) return null;

    const estimates = activeSections
      .map(section => state[section].estimatedTime)
      .filter(estimate => estimate !== null && estimate > 0);

    if (estimates.length === 0) return null;

    return Math.max(...estimates);
  }, [state]);

  const getLoadingStats = useCallback(() => {
    const history = state.global.loadingHistory;
    const recent = history.slice(-10);
    
    return {
      totalLoads: history.length,
      successRate: history.length > 0 ? 
        (history.filter(h => h.success).length / history.length) * 100 : 0,
      averageDuration: recent.length > 0 ? 
        recent.reduce((acc, h) => acc + h.duration, 0) / recent.length : 0,
      recentHistory: recent
    };
  }, [state]);

  const formatEstimatedTime = useCallback((ms) => {
    if (!ms || ms <= 0) return null;
    
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }, []);

  // Global loading functions
  const startGlobalLoading = useCallback((operation, options = {}) => {
    dispatch({
      type: ACTIONS.START_GLOBAL_LOADING,
      operation,
      message: options.message || `Starting ${operation}...`,
      stage: options.stage,
      stages: options.stages || [],
      showProgress: options.showProgress,
      overlay: options.overlay
    });
  }, []);

  const updateGlobalProgress = useCallback((progress) => {
    dispatch({
      type: ACTIONS.UPDATE_GLOBAL_PROGRESS,
      progress
    });
  }, []);

  const setGlobalStage = useCallback((stage, message) => {
    dispatch({
      type: ACTIONS.SET_GLOBAL_STAGE,
      stage,
      message
    });
  }, []);

  const setGlobalMessage = useCallback((message) => {
    dispatch({
      type: ACTIONS.SET_GLOBAL_MESSAGE,
      message
    });
  }, []);

  const completeGlobalLoading = useCallback((message) => {
    dispatch({
      type: ACTIONS.COMPLETE_GLOBAL_LOADING,
      message
    });
  }, []);

  const errorGlobalLoading = useCallback((error, message) => {
    dispatch({
      type: ACTIONS.ERROR_GLOBAL_LOADING,
      error,
      message
    });
  }, []);

  const clearGlobalLoading = useCallback(() => {
    dispatch({
      type: ACTIONS.CLEAR_GLOBAL_LOADING
    });
  }, []);

  const updatePreferences = useCallback((preferences) => {
    dispatch({
      type: ACTIONS.UPDATE_PREFERENCES,
      preferences
    });
  }, []);

  const value = {
    state,
    setLoading,
    setSuccess,
    setError,
    setProgress,
    startStep,
    completeStep,
    setTotalSteps,
    resetSection,
    resetAll,
    getSectionState,
    isLoading,
    hasError,
    isSuccess,
    getOverallProgress,
    isAnyLoading,
    getActiveLoadingSections,
    getEstimatedTimeRemaining,
    getLoadingStats,
    formatEstimatedTime,
    // Global loading functions
    startGlobalLoading,
    updateGlobalProgress,
    setGlobalStage,
    setGlobalMessage,
    completeGlobalLoading,
    errorGlobalLoading,
    clearGlobalLoading,
    updatePreferences,
    DASHBOARD_SECTIONS,
    LOADING_STATES
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
};

/**
 * 🎣 useLoading Hook Mejorado
 */
export const useLoading = (section = null) => {
  const context = useContext(LoadingContext);
  
  if (!context) {
    throw new Error('useLoading debe ser usado dentro de LoadingProvider');
  }

  if (section) {
    return {
      ...context,
      sectionState: context.getSectionState(section),
      isLoading: context.isLoading(section),
      hasError: context.hasError(section),
      isSuccess: context.isSuccess(section)
    };
  }

  return context;
};

/**
 * 💀 Skeleton Components Especializados y Mejorados
 */

// Skeleton para métricas con animaciones avanzadas
export const MetricsSkeleton = ({ count = 4, animated = true }) => {
  const theme = useTheme();
  
  return (
    <Stack direction="row" spacing={2} flexWrap="wrap">
      {Array.from({ length: count }).map((_, index) => (
        <Card
          key={index}
          sx={{
            minWidth: 280,
            flex: 1,
            background: `linear-gradient(135deg, 
              ${theme.palette.background.paper}90, 
              ${theme.palette.background.default}50)`,
            backdropFilter: 'blur(10px)',
            border: `1px solid ${theme.palette.divider}30`,
            position: 'relative',
            overflow: 'hidden',
            ...(animated && {
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: `linear-gradient(90deg, 
                  transparent, 
                  ${theme.palette.primary.main}15, 
                  transparent)`,
                animation: 'shimmer 2s infinite'
              },
              '@keyframes shimmer': {
                '0%': { left: '-100%' },
                '100%': { left: '100%' }
              }
            })
          }}
        >
          <CardContent>
            <Stack spacing={2}>
              <Skeleton 
                variant="text" 
                width="65%" 
                height={28} 
                animation={animated ? 'wave' : false}
              />
              <Skeleton 
                variant="text" 
                width="45%" 
                height={52} 
                sx={{ fontSize: '2.5rem' }}
                animation={animated ? 'wave' : false}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Skeleton 
                  variant="circular" 
                  width={12} 
                  height={12}
                  animation={animated ? 'pulse' : false}
                />
                <Skeleton 
                  variant="text" 
                  width="75%" 
                  height={22}
                  animation={animated ? 'wave' : false}
                />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Skeleton 
                  variant="text" 
                  width="30%" 
                  height={16}
                  animation={animated ? 'wave' : false}
                />
                <Skeleton 
                  variant="text" 
                  width="25%" 
                  height={16}
                  animation={animated ? 'wave' : false}
                />
              </Box>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
};

// Skeleton especializado para certificados
export const CertificateSkeleton = ({ rows = 5, showActions = true }) => {
  const theme = useTheme();
  
  return (
    <Card sx={{ 
      background: `linear-gradient(135deg, 
        ${theme.palette.background.paper}90, 
        ${theme.palette.background.default}50)`,
      backdropFilter: 'blur(10px)',
      border: `1px solid ${theme.palette.divider}30`
    }}>
      <CardContent>
        {/* Header con filtros */}
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          <Skeleton variant="rectangular" width={200} height={40} sx={{ borderRadius: 1 }} />
          <Skeleton variant="rectangular" width={150} height={40} sx={{ borderRadius: 1 }} />
          <Box sx={{ flex: 1 }} />
          {showActions && (
            <Skeleton variant="rectangular" width={120} height={40} sx={{ borderRadius: 1 }} />
          )}
        </Stack>
        
        {/* Table Headers */}
        <Stack direction="row" spacing={2} sx={{ mb: 2, pb: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Skeleton variant="text" width="25%" height={32} />
          <Skeleton variant="text" width="20%" height={32} />
          <Skeleton variant="text" width="15%" height={32} />
          <Skeleton variant="text" width="15%" height={32} />
          <Skeleton variant="text" width="10%" height={32} />
          {showActions && <Skeleton variant="text" width="15%" height={32} />}
        </Stack>
        
        {/* Table Rows */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <Stack key={rowIndex} direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center' }}>
            <Skeleton variant="text" width="25%" height={48} />
            <Skeleton variant="text" width="20%" height={48} />
            <Skeleton variant="rectangular" width="15%" height={24} sx={{ borderRadius: 0.5 }} />
            <Skeleton variant="text" width="15%" height={48} />
            <Skeleton variant="circular" width={24} height={24} />
            {showActions && (
              <Stack direction="row" spacing={1}>
                <Skeleton variant="circular" width={32} height={32} />
                <Skeleton variant="circular" width={32} height={32} />
                <Skeleton variant="circular" width={32} height={32} />
              </Stack>
            )}
          </Stack>
        ))}
      </CardContent>
    </Card>
  );
};

// Skeleton especializado para dispositivos
export const DeviceSkeleton = ({ rows = 4, showNetwork = true }) => {
  const theme = useTheme();
  
  return (
    <Card sx={{ 
      background: `linear-gradient(135deg, 
        ${theme.palette.background.paper}90, 
        ${theme.palette.background.default}50)`,
      backdropFilter: 'blur(10px)',
      border: `1px solid ${theme.palette.divider}30`
    }}>
      <CardContent>
        {Array.from({ length: rows }).map((_, index) => (
          <Box key={index} sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}20`, borderRadius: 2 }}>
            <Stack direction="row" spacing={3} alignItems="center">
              {/* Device Icon */}
              <Skeleton variant="rectangular" width={64} height={64} sx={{ borderRadius: 2 }} />
              
              {/* Device Info */}
              <Box sx={{ flex: 1 }}>
                <Stack spacing={1}>
                  <Skeleton variant="text" width="40%" height={28} />
                  <Skeleton variant="text" width="60%" height={20} />
                  <Stack direction="row" spacing={2}>
                    <Skeleton variant="rectangular" width={80} height={20} sx={{ borderRadius: 0.5 }} />
                    <Skeleton variant="rectangular" width={100} height={20} sx={{ borderRadius: 0.5 }} />
                  </Stack>
                </Stack>
              </Box>
              
              {/* Network Status */}
              {showNetwork && (
                <Box>
                  <Stack spacing={1} alignItems="center">
                    <Skeleton variant="circular" width={16} height={16} />
                    <Skeleton variant="text" width={60} height={16} />
                  </Stack>
                </Box>
              )}
              
              {/* Actions */}
              <Stack direction="row" spacing={1}>
                <Skeleton variant="circular" width={36} height={36} />
                <Skeleton variant="circular" width={36} height={36} />
              </Stack>
            </Stack>
          </Box>
        ))}
      </CardContent>
    </Card>
  );
};

// Skeleton especializado para VIPs
export const VipsSkeleton = ({ rows = 6, showStatus = true }) => {
  const theme = useTheme();
  
  return (
    <Card sx={{ 
      background: `linear-gradient(135deg, 
        ${theme.palette.background.paper}90, 
        ${theme.palette.background.default}50)`,
      backdropFilter: 'blur(10px)',
      border: `1px solid ${theme.palette.divider}30`
    }}>
      <CardContent>
        {/* Header */}
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          <Skeleton variant="text" width="30%" height={32} />
          <Box sx={{ flex: 1 }} />
          <Skeleton variant="rectangular" width={100} height={32} sx={{ borderRadius: 1 }} />
        </Stack>
        
        {/* VIP Grid */}
        <Stack spacing={2}>
          {Array.from({ length: rows }).map((_, index) => (
            <Box key={index} sx={{ p: 2, border: `1px solid ${theme.palette.divider}20`, borderRadius: 1 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Skeleton variant="text" width="20%" height={24} />
                <Skeleton variant="text" width="15%" height={24} />
                <Skeleton variant="text" width="25%" height={24} />
                {showStatus && (
                  <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 0.5 }} />
                )}
                <Box sx={{ flex: 1 }} />
                <Stack direction="row" spacing={1}>
                  <Skeleton variant="circular" width={28} height={28} />
                  <Skeleton variant="circular" width={28} height={28} />
                </Stack>
              </Stack>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
};

// Skeleton especializado para alertas
export const AlertsSkeleton = ({ count = 4, showSeverity = true }) => {
  const theme = useTheme();
  const severities = ['error', 'warning', 'info', 'success'];
  
  return (
    <Stack spacing={2}>
      {Array.from({ length: count }).map((_, index) => {
        const severity = severities[index % severities.length];
        return (
          <Alert 
            key={index} 
            severity={severity} 
            sx={{ 
              opacity: 0.7,
              background: `${theme.palette[severity].main}10`,
              border: `1px solid ${theme.palette[severity].main}30`
            }}
          >
            <Stack spacing={1}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Skeleton variant="text" width="60%" height={24} />
                {showSeverity && (
                  <Skeleton variant="rectangular" width={60} height={20} sx={{ borderRadius: 0.5 }} />
                )}
              </Stack>
              <Skeleton variant="text" width="85%" height={20} />
              <Skeleton variant="text" width="40%" height={16} />
            </Stack>
          </Alert>
        );
      })}
    </Stack>
  );
};

// Skeleton especializado para gráficos con múltiples tipos
export const ChartSkeleton = ({ type = 'line', height = 320, showLegend = true }) => {
  const theme = useTheme();
  
  const renderChartContent = () => {
    switch (type) {
      case 'pie':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height }}>
            <Skeleton variant="circular" width={height * 0.6} height={height * 0.6} />
          </Box>
        );
      case 'bar':
        return (
          <Box sx={{ display: 'flex', alignItems: 'end', justifyContent: 'space-around', height, px: 2 }}>
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton 
                key={index}
                variant="rectangular" 
                width={24} 
                height={Math.random() * (height * 0.7) + (height * 0.2)}
                sx={{ borderRadius: '4px 4px 0 0' }}
              />
            ))}
          </Box>
        );
      default: // line chart
        return (
          <Box sx={{ position: 'relative', height }}>
            <Skeleton 
              variant="rectangular" 
              width="100%" 
              height="100%" 
              sx={{ borderRadius: 1 }}
            />
            {/* Simulated line chart points */}
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton
                key={index}
                variant="circular"
                width={8}
                height={8}
                sx={{
                  position: 'absolute',
                  left: `${15 + index * 15}%`,
                  top: `${20 + Math.random() * 50}%`
                }}
              />
            ))}
          </Box>
        );
    }
  };
  
  return (
    <Card
      sx={{
        background: `linear-gradient(135deg, 
          ${theme.palette.background.paper}90, 
          ${theme.palette.background.default}50)`,
        backdropFilter: 'blur(10px)',
        border: `1px solid ${theme.palette.divider}30`
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Skeleton variant="text" width="35%" height={32} />
            <Box sx={{ flex: 1 }} />
            <Skeleton variant="rectangular" width={100} height={24} sx={{ borderRadius: 0.5 }} />
          </Stack>
          
          {renderChartContent()}
          
          {showLegend && (
            <Stack direction="row" spacing={3} justifyContent="center" sx={{ mt: 2 }}>
              {Array.from({ length: 4 }).map((_, index) => (
                <Stack key={index} direction="row" spacing={1} alignItems="center">
                  <Skeleton variant="rectangular" width={12} height={12} sx={{ borderRadius: 0.5 }} />
                  <Skeleton variant="text" width={60} height={16} />
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

/**
 * 🎭 Loading Wrapper Component Mejorado
 * Envuelve contenido con estados de loading automáticos y transiciones suaves
 */
export const LoadingWrapper = ({ 
  section, 
  children, 
  fallback = null,
  showProgress = true,
  showSteps = true,
  showEstimate = true,
  minHeight = 200,
  errorFallback = null,
  retryAction = null,
  customSkeletonProps = {},
  transition = 'fade',
  debug = false
}) => {
  const { 
    getSectionState, 
    formatEstimatedTime,
    resetSection 
  } = useLoading();
  const sectionState = getSectionState(section);
  const theme = useTheme();

  const renderSkeleton = () => {
    const skeletonProps = { animated: true, ...customSkeletonProps };
    
    switch (section) {
      case DASHBOARD_SECTIONS.METRICS:
        return <MetricsSkeleton {...skeletonProps} />;
      case DASHBOARD_SECTIONS.CERTIFICATES:
        return <CertificateSkeleton {...skeletonProps} />;
      case DASHBOARD_SECTIONS.DEVICES:
        return <DeviceSkeleton {...skeletonProps} />;
      case DASHBOARD_SECTIONS.VIPS:
        return <VipsSkeleton {...skeletonProps} />;
      case DASHBOARD_SECTIONS.ALERTS:
        return <AlertsSkeleton {...skeletonProps} />;
      case DASHBOARD_SECTIONS.CHARTS:
        return <ChartSkeleton {...skeletonProps} />;
      default:
        return fallback || (
          <Box sx={{ minHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={48} thickness={4} />
          </Box>
        );
    }
  };

  const renderProgressInfo = () => {
    if (!showProgress && !showSteps && !showEstimate) return null;

    return (
      <Box sx={{ mb: 3 }}>
        {/* Progress Bar */}
        {showProgress && sectionState.progress > 0 && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Cargando {section}...
              </Typography>
              <Typography variant="body2" color="primary.main" fontWeight="medium">
                {sectionState.progress}%
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={sectionState.progress}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: `${theme.palette.primary.main}15`,
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  background: `linear-gradient(90deg, 
                    ${theme.palette.primary.main}, 
                    ${theme.palette.primary.light})`,
                  transition: 'transform 0.4s ease'
                }
              }}
            />
          </Box>
        )}

        {/* Current Step */}
        {showSteps && sectionState.currentStep && (
          <Box sx={{ mb: 1 }}>
            <Chip 
              label={sectionState.currentStep}
              size="small"
              color="primary"
              variant="outlined"
              sx={{
                animation: 'pulse 2s infinite',
                '@keyframes pulse': {
                  '0%': { opacity: 1 },
                  '50%': { opacity: 0.7 },
                  '100%': { opacity: 1 }
                }
              }}
            />
          </Box>
        )}

        {/* Completed Steps */}
        {showSteps && sectionState.completedSteps.length > 0 && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Pasos completados: {sectionState.completedSteps.length}
              {sectionState.totalSteps > 0 && ` de ${sectionState.totalSteps}`}
            </Typography>
          </Box>
        )}

        {/* Estimated Time */}
        {showEstimate && sectionState.estimatedTime && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              Tiempo estimado: {formatEstimatedTime(sectionState.estimatedTime)}
            </Typography>
          </Box>
        )}
      </Box>
    );
  };

  const renderError = () => {
    if (errorFallback) return errorFallback;
    
    return (
      <Alert 
        severity="error" 
        sx={{ 
          my: 2,
          background: `${theme.palette.error.main}10`,
          border: `1px solid ${theme.palette.error.main}30`
        }}
        action={
          retryAction && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Typography
                component="button"
                variant="body2"
                sx={{
                  background: 'none',
                  border: 'none',
                  color: theme.palette.error.main,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  '&:hover': { opacity: 0.8 }
                }}
                onClick={() => {
                  resetSection(section);
                  retryAction();
                }}
              >
                Reintentar
              </Typography>
            </Box>
          )
        }
      >
        <Typography variant="h6" gutterBottom>
          Error al cargar {section}
        </Typography>
        <Typography variant="body2">
          {sectionState.error?.message || 'Ha ocurrido un error inesperado'}
        </Typography>
        {debug && sectionState.error?.stack && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Debug: {sectionState.error.stack.substring(0, 200)}...
            </Typography>
          </Box>
        )}
      </Alert>
    );
  };

  const renderTransition = (content) => {
    switch (transition) {
      case 'slide':
        return (
          <Box
            sx={{
              transform: sectionState.status === LOADING_STATES.LOADING ? 'translateY(10px)' : 'translateY(0)',
              opacity: sectionState.status === LOADING_STATES.LOADING ? 0.8 : 1,
              transition: 'all 0.3s ease'
            }}
          >
            {content}
          </Box>
        );
      case 'scale':
        return (
          <Box
            sx={{
              transform: sectionState.status === LOADING_STATES.LOADING ? 'scale(0.98)' : 'scale(1)',
              opacity: sectionState.status === LOADING_STATES.LOADING ? 0.8 : 1,
              transition: 'all 0.3s ease'
            }}
          >
            {content}
          </Box>
        );
      default: // fade
        return (
          <Fade in timeout={400}>
            <Box>
              {content}
            </Box>
          </Fade>
        );
    }
  };

  // Estados principales
  if (sectionState.status === LOADING_STATES.ERROR) {
    return renderTransition(renderError());
  }

  if (sectionState.status === LOADING_STATES.LOADING) {
    return renderTransition(
      <Box>
        {renderProgressInfo()}
        {renderSkeleton()}
      </Box>
    );
  }

  // Estado success o idle - mostrar contenido
  return renderTransition(children);
};

/**
 * 📊 Progress Tracking Components Avanzados
 */

// Componente de tracking detallado por sección
export const ProgressTracker = ({ section, detailed = false, compact = false }) => {
  const { getSectionState, formatEstimatedTime } = useLoading();
  const sectionState = getSectionState(section);
  const theme = useTheme();

  if (sectionState.status === LOADING_STATES.IDLE || sectionState.status === LOADING_STATES.SUCCESS) {
    return null;
  }

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
        <CircularProgress size={16} thickness={4} />
        <Typography variant="caption" color="text.secondary">
          {section} {sectionState.progress > 0 && `(${sectionState.progress}%)`}
        </Typography>
      </Box>
    );
  }

  return (
    <Card sx={{ 
      mb: 2, 
      background: `${theme.palette.background.paper}95`,
      backdropFilter: 'blur(10px)',
      border: `1px solid ${theme.palette.divider}40`
    }}>
      <CardContent sx={{ p: 2 }}>
        <Stack spacing={2}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={24} thickness={4} />
            <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
              Cargando {section.replace('_', ' ')}
            </Typography>
            {sectionState.progress > 0 && (
              <Chip 
                label={`${sectionState.progress}%`}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
          </Box>

          {/* Progress Bar */}
          {sectionState.progress > 0 && (
            <LinearProgress
              variant="determinate"
              value={sectionState.progress}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: `${theme.palette.primary.main}15`,
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  background: `linear-gradient(90deg, 
                    ${theme.palette.primary.main}, 
                    ${theme.palette.primary.light})`
                }
              }}
            />
          )}

          {/* Detailed Info */}
          {detailed && (
            <Stack spacing={1}>
              {sectionState.currentStep && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Paso actual:
                  </Typography>
                  <Chip 
                    label={sectionState.currentStep}
                    size="small"
                    color="secondary"
                    sx={{
                      animation: 'pulse 2s infinite',
                      '@keyframes pulse': {
                        '0%': { opacity: 1 },
                        '50%': { opacity: 0.7 },
                        '100%': { opacity: 1 }
                      }
                    }}
                  />
                </Box>
              )}

              {sectionState.completedSteps.length > 0 && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Pasos completados ({sectionState.completedSteps.length}
                    {sectionState.totalSteps > 0 && ` de ${sectionState.totalSteps}`}):
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {sectionState.completedSteps.slice(-5).map((step, index) => (
                      <Chip
                        key={index}
                        label={step}
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    ))}
                    {sectionState.completedSteps.length > 5 && (
                      <Typography variant="caption" color="text.secondary">
                        +{sectionState.completedSteps.length - 5} más
                      </Typography>
                    )}
                  </Stack>
                </Box>
              )}

              {sectionState.estimatedTime && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Tiempo estimado restante:
                  </Typography>
                  <Typography variant="body2" color="primary.main" fontWeight="medium">
                    {formatEstimatedTime(sectionState.estimatedTime)}
                  </Typography>
                </Box>
              )}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

// Componente de estadísticas de loading globales
export const LoadingStats = ({ showHistory = false }) => {
  const { getLoadingStats, getActiveLoadingSections } = useLoading();
  const stats = getLoadingStats();
  const activeSections = getActiveLoadingSections();
  const theme = useTheme();

  if (activeSections.length === 0 && !showHistory) return null;

  return (
    <Card sx={{ 
      mb: 2,
      background: `${theme.palette.background.paper}95`,
      backdropFilter: 'blur(10px)',
      border: `1px solid ${theme.palette.divider}40`
    }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Estadísticas de Carga
        </Typography>
        
        <Stack spacing={2}>
          {/* Stats actuales */}
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Secciones activas
              </Typography>
              <Typography variant="h6" color="primary.main">
                {activeSections.length}
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="body2" color="text.secondary">
                Tasa de éxito
              </Typography>
              <Typography variant="h6" color="success.main">
                {stats.successRate.toFixed(1)}%
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="body2" color="text.secondary">
                Duración promedio
              </Typography>
              <Typography variant="h6">
                {(stats.averageDuration / 1000).toFixed(1)}s
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="body2" color="text.secondary">
                Total cargas
              </Typography>
              <Typography variant="h6">
                {stats.totalLoads}
              </Typography>
            </Box>
          </Box>

          {/* Secciones activas */}
          {activeSections.length > 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Secciones cargando:
              </Typography>
              <Stack spacing={1}>
                {activeSections.map(({ section, progress, currentStep }) => (
                  <Box key={section} sx={{ 
                    p: 1, 
                    border: `1px solid ${theme.palette.divider}30`,
                    borderRadius: 1,
                    background: `${theme.palette.primary.main}05`
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body2" sx={{ minWidth: 120, textTransform: 'capitalize' }}>
                        {section.replace('_', ' ')}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{ flex: 1, height: 6, borderRadius: 3 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {progress}%
                      </Typography>
                    </Box>
                    {currentStep && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                        {currentStep}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Historial reciente */}
          {showHistory && stats.recentHistory.length > 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Historial reciente:
              </Typography>
              <Stack spacing={0.5}>
                {stats.recentHistory.slice(-5).map((entry, index) => (
                  <Box key={index} sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2,
                    py: 0.5,
                    px: 1,
                    borderRadius: 0.5,
                    background: entry.success 
                      ? `${theme.palette.success.main}10`
                      : `${theme.palette.error.main}10`
                  }}>
                    <Chip
                      size="small"
                      color={entry.success ? 'success' : 'error'}
                      variant="outlined"
                      label={entry.success ? '✓' : '✗'}
                      sx={{ minWidth: 40 }}
                    />
                    <Typography variant="caption" sx={{ minWidth: 80, textTransform: 'capitalize' }}>
                      {entry.section.replace('_', ' ')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(entry.duration / 1000).toFixed(1)}s
                    </Typography>
                    {!entry.success && entry.error && (
                      <Typography variant="caption" color="error.main">
                        {entry.error.substring(0, 30)}...
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
// Overall Progress Component Mejorado con Global Loading Support
export const OverallProgress = ({ 
  position = 'top', 
  showDetails = false, 
  showSections = false,
  variant = 'auto', // 'auto', 'dashboard', 'global', 'combined'
  showGlobalProgress = true
}) => {
  const { 
    state,
    getOverallProgress, 
    isAnyLoading, 
    getActiveLoadingSections,
    getEstimatedTimeRemaining,
    formatEstimatedTime 
  } = useLoading();
  const theme = useTheme();
  
  const { globalLoading, preferences } = state;
  const activeSections = getActiveLoadingSections();
  const estimatedTime = getEstimatedTimeRemaining();
  
  // Determine which loading to show based on variant
  const shouldShowDashboard = (variant === 'auto' || variant === 'dashboard' || variant === 'combined') && isAnyLoading();
  const shouldShowGlobal = (variant === 'auto' || variant === 'global' || variant === 'combined') && 
                          globalLoading.isActive && 
                          showGlobalProgress && 
                          preferences.enableOverallProgress;
  
  // If auto mode, prioritize global loading over dashboard loading
  const showDashboard = variant === 'auto' ? (shouldShowDashboard && !shouldShowGlobal) : shouldShowDashboard;
  const showGlobal = shouldShowGlobal;
  
  if (!showDashboard && !showGlobal) return null;

  // Global loading progress bar
  const globalProgressBar = (
    <LinearProgress
      variant="determinate"
      value={globalLoading.progress}
      sx={{
        height: position === 'top' ? 4 : 8,
        backgroundColor: alpha(theme.palette.primary.main, 0.1),
        borderRadius: 2,
        '& .MuiLinearProgress-bar': {
          backgroundColor: theme.palette.primary.main,
          borderRadius: 2,
          transition: 'transform 0.3s ease-in-out'
        }
      }}
    />
  );

  // Dashboard progress bar
  const dashboardProgressBar = (
    <LinearProgress
      variant="determinate"
      value={getOverallProgress()}
      sx={{
        height: position === 'top' ? 3 : 6,
        backgroundColor: 'transparent',
        '& .MuiLinearProgress-bar': {
          background: `linear-gradient(90deg, 
            ${theme.palette.primary.main}, 
            ${theme.palette.secondary.main})`,
          transition: 'transform 0.4s ease'
        }
      }}
    />
  );

  // Top position (minimal display)
  if (position === 'top') {
    return (
      <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
        {showGlobal && globalProgressBar}
        {showDashboard && !showGlobal && dashboardProgressBar}
        {/* Show message for global loading */}
        {showGlobal && globalLoading.message && (
          <Box sx={{ 
            backgroundColor: alpha(theme.palette.background.paper, 0.95),
            backdropFilter: 'blur(8px)',
            borderBottom: `1px solid ${theme.palette.divider}`,
            px: 2,
            py: 1
          }}>
            <Typography variant="caption" color="text.secondary">
              {globalLoading.message}
            </Typography>
          </Box>
        )}
      </Box>
    );
  }

  // Card display (detailed)
  return (
    <Card sx={{ 
      mb: 2,
      background: `${theme.palette.background.paper}95`,
      backdropFilter: 'blur(10px)',
      border: `1px solid ${theme.palette.divider}40`
    }}>
      <CardContent sx={{ p: 2 }}>
        <Stack spacing={2}>
          
          {/* Global Loading Display */}
          {showGlobal && (
            <>
              {/* Global Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h6" color="primary">
                  {globalLoading.operation || 'Global Operation'}
                </Typography>
                <Chip 
                  label={`${Math.round(globalLoading.progress)}%`}
                  color="primary"
                  size="small"
                />
                {globalLoading.startTime && (
                  <Typography variant="caption" color="text.secondary">
                    ⏱️ {formatEstimatedTime(Math.floor((Date.now() - globalLoading.startTime) / 1000))}
                  </Typography>
                )}
              </Box>

              {/* Global Progress Bar */}
              {globalProgressBar}

              {/* Global Message and Stage */}
              {(globalLoading.message || globalLoading.stage) && (
                <Stack spacing={1}>
                  {globalLoading.message && (
                    <Typography variant="body2" color="text.secondary">
                      {globalLoading.message}
                    </Typography>
                  )}
                  {globalLoading.stage && (
                    <Typography variant="caption" color="text.secondary">
                      Current Stage: {globalLoading.stage}
                    </Typography>
                  )}
                </Stack>
              )}

              {/* Global Stages Progress */}
              {globalLoading.stages.length > 0 && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Progress Stages:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {globalLoading.stages.map((stage, index) => (
                      <Chip
                        key={`global-stage-${index}`}
                        label={stage}
                        size="small"
                        variant={globalLoading.stage === stage ? "filled" : "outlined"}
                        color={
                          globalLoading.stage === stage ? "primary" :
                          globalLoading.stages.indexOf(globalLoading.stage) > index ? "success" : "default"
                        }
                        sx={{ 
                          fontSize: '0.75rem',
                          textTransform: 'capitalize'
                        }}
                      />
                    ))}
                  </Stack>
                </Box>
              )}
            </>
          )}

          {/* Dashboard Loading Display */}
          {showDashboard && (
            <>
              {/* Dashboard Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h6">
                  {showGlobal ? 'Dashboard Progress' : 'Progreso General'}
                </Typography>
                <Chip 
                  label={`${getOverallProgress()}%`}
                  color={showGlobal ? "secondary" : "primary"}
                  size="small"
                />
                {estimatedTime && (
                  <Typography variant="caption" color="text.secondary">
                    ⏱️ {formatEstimatedTime(estimatedTime)}
                  </Typography>
                )}
              </Box>

              {/* Dashboard Progress Bar */}
              {dashboardProgressBar}

              {/* Dashboard Details */}
              {showDetails && (
                <Box sx={{ display: 'flex', gap: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    Secciones activas: {activeSections.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total: {Object.keys(DASHBOARD_SECTIONS).length}
                  </Typography>
                </Box>
              )}

              {/* Active Sections */}
              {showSections && activeSections.length > 0 && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Cargando:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {activeSections.map(({ section, progress }) => (
                      <Chip
                        key={section}
                        label={`${section.replace('_', ' ')} (${progress}%)`}
                        size="small"
                        color={showGlobal ? "secondary" : "primary"}
                        variant="outlined"
                        sx={{ 
                          textTransform: 'capitalize',
                          animation: 'pulse 2s infinite',
                          '@keyframes pulse': {
                            '0%': { opacity: 1 },
                            '50%': { opacity: 0.7 },
                            '100%': { opacity: 1 }
                          }
                        }}
                      />
                    ))}
                  </Stack>
                </Box>
              )}
            </>
          )}

        </Stack>
      </CardContent>
    </Card>
  );
};

// Convenience components for different use cases
export const GlobalProgressBar = (props) => (
  <OverallProgress variant="global" position="top" {...props} />
);

export const DashboardProgressBar = (props) => (
  <OverallProgress variant="dashboard" {...props} />
);

export const CombinedProgressBar = (props) => (
  <OverallProgress variant="combined" {...props} />
);
