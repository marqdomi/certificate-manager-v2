/**
 * 🎨 VALIDATION DISPLAY COMPONENTS - CMT v2.5
 * Componentes React para mostrar errores de validación de forma elegante
 * UI profesional para feedback de validación
 */

import React from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Chip,
  Collapse,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
  useTheme
} from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Security as SecurityIcon,
  DataUsage as DataIcon
} from '@mui/icons-material';

/**
 * 🚨 Componente principal para mostrar resultado de validación
 */
export const ValidationResult = ({ 
  validation, 
  title = "Resultado de Validación",
  showSummary = true,
  showDetails = true,
  expandable = true,
  severity = "auto"
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = React.useState(!expandable);

  if (!validation) {
    return null;
  }

  const { isValid, errors = [], warnings = [], summary } = validation;

  // Determinar severidad automática
  let alertSeverity = severity;
  if (severity === "auto") {
    if (!isValid && errors.length > 0) {
      alertSeverity = "error";
    } else if (warnings && warnings.length > 0) {
      alertSeverity = "warning";
    } else if (isValid) {
      alertSeverity = "success";
    } else {
      alertSeverity = "info";
    }
  }

  const getSummaryText = () => {
    if (isValid && (!warnings || warnings.length === 0)) {
      return "✅ Todos los datos son válidos";
    } else if (isValid && warnings && warnings.length > 0) {
      return `✅ Datos válidos con ${warnings.length} advertencia(s)`;
    } else {
      return `❌ ${errors.length} error(es) encontrado(s)`;
    }
  };

  return (
    <Paper 
      elevation={2}
      sx={{ 
        mb: 2,
        borderRadius: 2,
        overflow: 'hidden',
        border: `1px solid ${
          alertSeverity === 'error' ? theme.palette.error.light :
          alertSeverity === 'warning' ? theme.palette.warning.light :
          alertSeverity === 'success' ? theme.palette.success.light :
          theme.palette.info.light
        }`
      }}
    >
      <Alert 
        severity={alertSeverity}
        action={
          expandable && (errors.length > 0 || (warnings && warnings.length > 0)) && (
            <IconButton
              aria-label="toggle details"
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{ color: 'inherit' }}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )
        }
      >
        <AlertTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon fontSize="small" />
          {title}
        </AlertTitle>
        
        <Typography variant="body2" sx={{ mb: 1 }}>
          {getSummaryText()}
        </Typography>

        {showSummary && summary && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            {summary.validatedSections && summary.validatedSections.map(section => (
              <Chip
                key={section}
                icon={<DataIcon />}
                label={section}
                size="small"
                variant="outlined"
                sx={{ 
                  color: 'inherit',
                  borderColor: 'currentColor',
                  '& .MuiChip-icon': { color: 'inherit' }
                }}
              />
            ))}
          </Box>
        )}
      </Alert>

      {showDetails && expandable && (
        <Collapse in={expanded}>
          <Box sx={{ p: 2, backgroundColor: theme.palette.background.default }}>
            {errors.length > 0 && (
              <ValidationErrorsList errors={errors} />
            )}
            
            {warnings && warnings.length > 0 && (
              <>
                {errors.length > 0 && <Divider sx={{ my: 2 }} />}
                <ValidationWarningsList warnings={warnings} />
              </>
            )}
          </Box>
        </Collapse>
      )}

      {showDetails && !expandable && (
        <Box sx={{ p: 2, backgroundColor: theme.palette.background.default }}>
          {errors.length > 0 && <ValidationErrorsList errors={errors} />}
          {warnings && warnings.length > 0 && (
            <>
              {errors.length > 0 && <Divider sx={{ my: 2 }} />}
              <ValidationWarningsList warnings={warnings} />
            </>
          )}
        </Box>
      )}
    </Paper>
  );
};

/**
 * ❌ Lista de errores de validación
 */
export const ValidationErrorsList = ({ errors = [] }) => {
  const theme = useTheme();

  if (errors.length === 0) {
    return null;
  }

  return (
    <Box>
      <Typography 
        variant="subtitle2" 
        sx={{ 
          color: theme.palette.error.dark,
          fontWeight: 600,
          mb: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        <ErrorIcon fontSize="small" />
        Errores de Validación ({errors.length})
      </Typography>
      
      <List dense sx={{ py: 0 }}>
        {errors.map((error, index) => (
          <ListItem 
            key={index}
            sx={{ 
              py: 0.5,
              borderRadius: 1,
              '&:hover': {
                backgroundColor: theme.palette.error.main + '08'
              }
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <ErrorIcon 
                fontSize="small" 
                sx={{ color: theme.palette.error.main }}
              />
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {error.section && (
                    <Chip 
                      label={error.section} 
                      size="small" 
                      variant="outlined"
                      sx={{ 
                        mr: 1, 
                        height: 20,
                        fontSize: '0.75rem',
                        color: theme.palette.error.main,
                        borderColor: theme.palette.error.main
                      }}
                    />
                  )}
                  {error.field && `${error.field}: `}
                  {error.message}
                </Typography>
              }
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

/**
 * ⚠️ Lista de advertencias de validación
 */
export const ValidationWarningsList = ({ warnings = [] }) => {
  const theme = useTheme();

  if (warnings.length === 0) {
    return null;
  }

  return (
    <Box>
      <Typography 
        variant="subtitle2" 
        sx={{ 
          color: theme.palette.warning.dark,
          fontWeight: 600,
          mb: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        <WarningIcon fontSize="small" />
        Advertencias ({warnings.length})
      </Typography>
      
      <List dense sx={{ py: 0 }}>
        {warnings.map((warning, index) => (
          <ListItem 
            key={index}
            sx={{ 
              py: 0.5,
              borderRadius: 1,
              '&:hover': {
                backgroundColor: theme.palette.warning.main + '08'
              }
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <WarningIcon 
                fontSize="small" 
                sx={{ color: theme.palette.warning.main }}
              />
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography variant="body2">
                  {warning.section && (
                    <Chip 
                      label={warning.section} 
                      size="small" 
                      variant="outlined"
                      sx={{ 
                        mr: 1, 
                        height: 20,
                        fontSize: '0.75rem',
                        color: theme.palette.warning.main,
                        borderColor: theme.palette.warning.main
                      }}
                    />
                  )}
                  {warning.message}
                </Typography>
              }
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

/**
 * 📊 Indicador compacto de estado de validación
 */
export const ValidationStatus = ({ 
  validation, 
  size = "medium",
  showText = true,
  showCount = true 
}) => {
  const theme = useTheme();

  if (!validation) {
    return null;
  }

  const { isValid, errors = [], warnings = [] } = validation;
  
  const getIcon = () => {
    if (!isValid && errors.length > 0) {
      return <ErrorIcon fontSize={size} sx={{ color: theme.palette.error.main }} />;
    } else if (warnings.length > 0) {
      return <WarningIcon fontSize={size} sx={{ color: theme.palette.warning.main }} />;
    } else if (isValid) {
      return <CheckCircleIcon fontSize={size} sx={{ color: theme.palette.success.main }} />;
    } else {
      return <InfoIcon fontSize={size} sx={{ color: theme.palette.info.main }} />;
    }
  };

  const getText = () => {
    if (!isValid && errors.length > 0) {
      return showCount ? `${errors.length} errores` : "Errores";
    } else if (warnings.length > 0) {
      return showCount ? `${warnings.length} advertencias` : "Advertencias";
    } else if (isValid) {
      return "Válido";
    } else {
      return "Pendiente";
    }
  };

  const getColor = () => {
    if (!isValid && errors.length > 0) {
      return theme.palette.error.main;
    } else if (warnings.length > 0) {
      return theme.palette.warning.main;
    } else if (isValid) {
      return theme.palette.success.main;
    } else {
      return theme.palette.info.main;
    }
  };

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 0.5,
        color: getColor()
      }}
    >
      {getIcon()}
      {showText && (
        <Typography 
          variant="body2" 
          sx={{ 
            color: 'inherit',
            fontWeight: 500
          }}
        >
          {getText()}
        </Typography>
      )}
    </Box>
  );
};

/**
 * 📈 Barra de progreso de validación
 */
export const ValidationProgress = ({ 
  validation, 
  height = 6,
  showText = true 
}) => {
  const theme = useTheme();

  if (!validation || !validation.summary) {
    return null;
  }

  const { summary, isValid, errors = [] } = validation;
  const { validatedSections = [] } = summary;
  
  // Calcular progreso (simplificado)
  const progress = isValid ? 100 : Math.max(0, 100 - (errors.length * 10));
  
  const getColor = () => {
    if (progress === 100) {
      return theme.palette.success.main;
    } else if (progress >= 70) {
      return theme.palette.warning.main;
    } else {
      return theme.palette.error.main;
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {showText && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Validación
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {Math.round(progress)}%
          </Typography>
        </Box>
      )}
      
      <Box
        sx={{
          width: '100%',
          height,
          backgroundColor: theme.palette.grey[200],
          borderRadius: height / 2,
          overflow: 'hidden'
        }}
      >
        <Box
          sx={{
            width: `${progress}%`,
            height: '100%',
            backgroundColor: getColor(),
            borderRadius: height / 2,
            transition: 'width 0.3s ease, background-color 0.3s ease'
          }}
        />
      </Box>
      
      {showText && validatedSections.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          Secciones validadas: {validatedSections.join(', ')}
        </Typography>
      )}
    </Box>
  );
};

/**
 * 🎯 Exportar todos los componentes
 */
export default {
  ValidationResult,
  ValidationErrorsList,
  ValidationWarningsList,
  ValidationStatus,
  ValidationProgress
};