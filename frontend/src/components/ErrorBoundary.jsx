import React, { Component, createContext, useContext, useState, useCallback } from 'react';
import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
  Alert,
  AlertTitle,
  Collapse,
  IconButton,
  Divider,
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Backdrop,
  CircularProgress,
  alpha,
  styled
} from '@mui/material';
import {
  ErrorOutline,
  Refresh,
  BugReport,
  ExpandMore,
  ExpandLess,
  Home,
  Warning as WarningIcon,
  Info as InfoIcon,
  ContentCopy as CopyIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';

// Error types
export const ERROR_TYPES = {
  NETWORK: 'NETWORK',
  VALIDATION: 'VALIDATION',
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  SERVER: 'SERVER',
  CLIENT: 'CLIENT',
  UNKNOWN: 'UNKNOWN'
};

// Error severities
export const ERROR_SEVERITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// Error Context for global error state management
const ErrorContext = createContext();

export const useErrorHandler = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    // Fallback for backward compatibility
    const throwError = (error) => {
      throw error;
    };
    return { throwError };
  }
  return context;
};

// Error Provider Component
export const ErrorProvider = ({ children }) => {
  const [errors, setErrors] = useState([]);
  const [globalError, setGlobalError] = useState(null);

  const addError = useCallback((error, metadata = {}) => {
    const errorObject = {
      id: Date.now() + Math.random(),
      message: error.message || 'An unexpected error occurred',
      stack: error.stack,
      type: metadata.type || ERROR_TYPES.UNKNOWN,
      severity: metadata.severity || ERROR_SEVERITIES.MEDIUM,
      timestamp: new Date().toISOString(),
      component: metadata.component,
      action: metadata.action,
      userId: metadata.userId,
      sessionId: metadata.sessionId,
      url: window.location.href,
      userAgent: navigator.userAgent,
      retryable: metadata.retryable !== false,
      ...metadata
    };

    setErrors(prev => [...prev, errorObject]);

    // Set as global error if critical
    if (errorObject.severity === ERROR_SEVERITIES.CRITICAL) {
      setGlobalError(errorObject);
    }

    // Log error (could be sent to external service)
    console.error('Application Error:', errorObject);

    return errorObject.id;
  }, []);

  const removeError = useCallback((errorId) => {
    setErrors(prev => prev.filter(error => error.id !== errorId));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
    setGlobalError(null);
  }, []);

  const clearGlobalError = useCallback(() => {
    setGlobalError(null);
  }, []);

  const retryAction = useCallback((errorId, retryFn) => {
    if (retryFn && typeof retryFn === 'function') {
      removeError(errorId);
      try {
        retryFn();
      } catch (error) {
        addError(error, { type: ERROR_TYPES.CLIENT, action: 'retry' });
      }
    }
  }, [addError, removeError]);

  // Backward compatibility
  const throwError = useCallback((error) => {
    addError(error, { type: ERROR_TYPES.CLIENT });
    throw error;
  }, [addError]);

  const value = {
    errors,
    globalError,
    addError,
    removeError,
    clearErrors,
    clearGlobalError,
    retryAction,
    throwError // For backward compatibility
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
};

/**
 * 🛡️ Enterprise Error Boundary Component
 * Captura errores de React y muestra fallbacks elegantes con opciones de recovery
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      expanded: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo,
      hasError: true
    });

    // Log error to monitoring service
    this.logErrorToService(error, errorInfo);
  }

  logErrorToService = (error, errorInfo) => {
    // En producción, enviar a servicio de monitoring como Sentry
    console.error('🚨 Error Boundary Caught:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      retryCount: this.state.retryCount
    });
  };

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      expanded: false,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleToggleExpanded = () => {
    this.setState(prevState => ({
      expanded: !prevState.expanded
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          expanded={this.state.expanded}
          retryCount={this.state.retryCount}
          onRetry={this.handleRetry}
          onToggleExpanded={this.handleToggleExpanded}
          title={this.props.title}
          variant={this.props.variant}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * 🎨 Error Fallback UI Component
 */
const ErrorFallback = ({
  error,
  errorInfo,
  expanded,
  retryCount,
  onRetry,
  onToggleExpanded,
  title = 'Algo salió mal',
  variant = 'full'
}) => {
  const theme = useTheme();
  const navigate = useNavigate();

  const getErrorSeverity = () => {
    if (retryCount >= 3) return 'error';
    if (retryCount >= 1) return 'warning';
    return 'info';
  };

  const getErrorIcon = () => {
    const severity = getErrorSeverity();
    return severity === 'error' ? <BugReport /> : <ErrorOutline />;
  };

  const handleGoHome = () => {
    navigate('/');
  };

  // Fallback compacto para secciones específicas
  if (variant === 'section') {
    return (
      <Paper
        elevation={2}
        sx={{
          p: 3,
          m: 1,
          background: `linear-gradient(135deg, 
            ${theme.palette.error.light}15, 
            ${theme.palette.error.main}10)`,
          border: `1px solid ${theme.palette.error.main}30`,
          borderRadius: 2
        }}
      >
        <Stack spacing={2} alignItems="center">
          <ErrorOutline color="error" sx={{ fontSize: 40 }} />
          <Typography variant="h6" color="error.main" textAlign="center">
            Error en esta sección
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            No se pudieron cargar los datos
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Refresh />}
            onClick={onRetry}
            sx={{ mt: 1 }}
          >
            Reintentar
          </Button>
        </Stack>
      </Paper>
    );
  }

  // Fallback completo para errores críticos
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Paper
        elevation={8}
        sx={{
          p: 6,
          background: `linear-gradient(135deg, 
            ${theme.palette.background.paper}, 
            ${theme.palette.background.default})`,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 3
        }}
      >
        <Stack spacing={4} alignItems="center">
          {/* Error Icon */}
          <Box
            sx={{
              p: 3,
              borderRadius: '50%',
              background: `linear-gradient(135deg, 
                ${theme.palette.error.light}20, 
                ${theme.palette.error.main}10)`,
              border: `2px solid ${theme.palette.error.main}30`
            }}
          >
            {getErrorIcon()}
          </Box>

          {/* Error Title */}
          <Typography variant="h4" color="error.main" textAlign="center" fontWeight="bold">
            {title}
          </Typography>

          {/* Error Description */}
          <Typography variant="body1" color="text.secondary" textAlign="center" maxWidth="500px">
            Se ha producido un error inesperado. Por favor, intenta recargar la página o contacta al soporte técnico.
          </Typography>

          {/* Retry Count Info */}
          {retryCount > 0 && (
            <Alert severity={getErrorSeverity()} sx={{ width: '100%' }}>
              <AlertTitle>Intentos de recuperación: {retryCount}</AlertTitle>
              {retryCount >= 3 && 'El error persiste. Se recomienda contactar al soporte técnico.'}
            </Alert>
          )}

          {/* Action Buttons */}
          <Stack direction="row" spacing={2} flexWrap="wrap" justifyContent="center">
            <Button
              variant="contained"
              startIcon={<Refresh />}
              onClick={onRetry}
              size="large"
              color="primary"
            >
              Reintentar
            </Button>
            <Button
              variant="outlined"
              startIcon={<Home />}
              onClick={handleGoHome}
              size="large"
            >
              Ir al Inicio
            </Button>
          </Stack>

          <Divider sx={{ width: '100%' }} />

          {/* Error Details Toggle */}
          <Box sx={{ width: '100%' }}>
            <Button
              variant="text"
              startIcon={expanded ? <ExpandLess /> : <ExpandMore />}
              onClick={onToggleExpanded}
              color="text.secondary"
              sx={{ mb: 2 }}
            >
              {expanded ? 'Ocultar' : 'Mostrar'} detalles técnicos
            </Button>

            <Collapse in={expanded}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  backgroundColor: theme.palette.grey[50],
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1
                }}
              >
                <Typography variant="subtitle2" color="error" gutterBottom>
                  Error Message:
                </Typography>
                <Typography
                  variant="body2"
                  component="pre"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    overflow: 'auto',
                    mb: 2,
                    p: 1,
                    backgroundColor: theme.palette.background.paper,
                    borderRadius: 1
                  }}
                >
                  {error?.message || 'Mensaje de error no disponible'}
                </Typography>

                {error?.stack && (
                  <>
                    <Typography variant="subtitle2" color="error" gutterBottom>
                      Stack Trace:
                    </Typography>
                    <Typography
                      variant="body2"
                      component="pre"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.7rem',
                        overflow: 'auto',
                        p: 1,
                        backgroundColor: theme.palette.background.paper,
                        borderRadius: 1,
                        maxHeight: 200
                      }}
                    >
                      {error.stack}
                    </Typography>
                  </>
                )}
              </Paper>
            </Collapse>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
};

// Error Notification Component
export const ErrorNotification = ({ 
  open = false, 
  onClose, 
  error, 
  autoHideDuration = 6000,
  showDetails = false 
}) => {
  const theme = useTheme();
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case ERROR_SEVERITIES.CRITICAL: return 'error';
      case ERROR_SEVERITIES.HIGH: return 'warning';
      case ERROR_SEVERITIES.MEDIUM: return 'info';
      default: return 'info';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case ERROR_SEVERITIES.CRITICAL: return <ErrorOutline />;
      case ERROR_SEVERITIES.HIGH: return <WarningIcon />;
      case ERROR_SEVERITIES.MEDIUM: return <InfoIcon />;
      default: return <InfoIcon />;
    }
  };

  if (!error) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: alpha(theme.palette.background.paper, 0.95),
          backdropFilter: 'blur(8px)'
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          {getSeverityIcon(error.severity)}
          <Typography variant="h6" color={getSeverityColor(error.severity)}>
            Error Notification
          </Typography>
          <Chip
            label={error.type}
            size="small"
            color={getSeverityColor(error.severity)}
            variant="outlined"
          />
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2}>
          <Alert severity={getSeverityColor(error.severity)}>
            <AlertTitle>
              {error.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())} Error
            </AlertTitle>
            {error.message}
          </Alert>

          {error.component && (
            <Typography variant="body2" color="text.secondary">
              Component: {error.component}
            </Typography>
          )}

          {error.action && (
            <Typography variant="body2" color="text.secondary">
              Action: {error.action}
            </Typography>
          )}

          <Typography variant="caption" color="text.secondary">
            Occurred at: {new Date(error.timestamp).toLocaleString()}
          </Typography>

          {(showDetails && error.stack) && (
            <Box>
              <Button
                size="small"
                startIcon={showErrorDetails ? <ExpandLess /> : <ExpandMore />}
                onClick={() => setShowErrorDetails(!showErrorDetails)}
              >
                {showErrorDetails ? 'Hide' : 'Show'} Technical Details
              </Button>

              <Collapse in={showErrorDetails}>
                <Paper sx={{ 
                  p: 2, 
                  mt: 1,
                  backgroundColor: alpha(theme.palette.background.default, 0.5),
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  maxHeight: 200,
                  overflow: 'auto'
                }}>
                  <Typography variant="body2" sx={{ 
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {error.stack}
                  </Typography>
                </Paper>
              </Collapse>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        {error.retryable && (
          <Button
            startIcon={<Refresh />}
            onClick={() => {
              onClose();
              // Trigger retry if available
            }}
            color="primary"
          >
            Retry
          </Button>
        )}
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Higher-order component for error handling
export const withErrorBoundary = (Component, errorBoundaryConfig = {}) => {
  const WrappedComponent = (props) => (
    <ErrorBoundary {...errorBoundaryConfig}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

// Hook for programmatic error boundary
export const useErrorBoundary = () => {
  const [error, setError] = useState(null);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const captureError = useCallback((error) => {
    setError(error);
  }, []);

  if (error) {
    throw error;
  }

  return { captureError, resetError };
};

// Global error boundary for entire application
export const GlobalErrorBoundary = ({ children, onError, onNavigateHome }) => {
  const errorHandler = useErrorHandler();

  return (
    <ErrorBoundary
      onError={onError}
      fallbackProps={{
        variant: 'full',
        title: 'Application Error',
        showDetails: true,
        customActions: onNavigateHome ? [
          {
            label: 'Go to Dashboard',
            icon: <Home />,
            onClick: onNavigateHome,
            variant: 'outlined',
            color: 'primary'
          }
        ] : []
      }}
    >
      {children}
    </ErrorBoundary>
  );
};

// Section-level error boundary
export const SectionErrorBoundary = ({ children, section, onError }) => {
  return (
    <ErrorBoundary
      onError={onError}
      fallbackProps={{
        variant: 'section',
        title: `Error in ${section} section`,
        showDetails: false
      }}
    >
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundary;