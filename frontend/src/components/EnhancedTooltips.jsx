/**
 * 💡 Enhanced Tooltips System - CMT v2.5
 * Sistema completo de tooltips informativos con contenido rico y posicionamiento inteligente
 */

import React, { useState, useEffect, useRef, cloneElement } from 'react';
import {
  Box,
  Tooltip,
  Paper,
  Typography,
  IconButton,
  Chip,
  Button,
  Divider,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Link,
  Fade,
  Grow,
  Slide,
  useTheme,
  alpha,
  styled
} from '@mui/material';

import {
  Info as InfoIcon,
  Help as HelpIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Lightbulb as TipIcon,
  Security as SecurityIcon,
  Speed as PerformanceIcon,
  Code as CodeIcon,
  Link as LinkIcon,
  KeyboardArrowRight as ArrowIcon,
  Close as CloseIcon,
  PushPin as PinIcon
} from '@mui/icons-material';

/**
 * 🎨 Styled Components para tooltips personalizados
 */
const StyledTooltip = styled(({ className, ...props }) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme, tooltiptype = 'default' }) => ({
  [`& .MuiTooltip-tooltip`]: {
    backgroundColor: getTooltipColor(theme, tooltiptype),
    color: theme.palette.getContrastText(getTooltipColor(theme, tooltiptype)),
    maxWidth: 'none',
    fontSize: theme.typography.pxToRem(12),
    borderRadius: theme.spacing(1),
    padding: theme.spacing(1),
    boxShadow: theme.shadows[4],
    border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
    backdropFilter: 'blur(8px)',
    
    '&.rich-tooltip': {
      maxWidth: 400,
      padding: 0,
      backgroundColor: theme.palette.background.paper,
      color: theme.palette.text.primary,
      border: `1px solid ${theme.palette.divider}`,
    },
    
    '&.interactive-tooltip': {
      cursor: 'pointer',
      transition: 'all 0.2s ease-in-out',
      '&:hover': {
        transform: 'scale(1.02)',
        boxShadow: theme.shadows[8],
      }
    }
  },
  
  [`& .MuiTooltip-arrow`]: {
    color: getTooltipColor(theme, tooltiptype),
    '&::before': {
      border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
    }
  }
}));

const getTooltipColor = (theme, type) => {
  const colors = {
    default: theme.palette.grey[800],
    info: theme.palette.info.main,
    warning: theme.palette.warning.main,
    error: theme.palette.error.main,
    success: theme.palette.success.main,
    tip: theme.palette.primary.main,
    security: theme.palette.error.dark,
    performance: theme.palette.success.dark
  };
  return colors[type] || colors.default;
};

/**
 * 🎯 Componente BasicTooltip - Tooltip simple y elegante
 */
export const BasicTooltip = ({ 
  title, 
  children, 
  type = 'default',
  placement = 'top',
  delay = 500,
  ...props 
}) => {
  return (
    <StyledTooltip
      title={title}
      placement={placement}
      enterDelay={delay}
      tooltiptype={type}
      arrow
      {...props}
    >
      {children}
    </StyledTooltip>
  );
};

/**
 * 💎 Componente RichTooltip - Tooltip con contenido rico
 */
export const RichTooltip = ({ 
  children, 
  title, 
  description, 
  type = 'info',
  shortcut,
  links = [],
  actions = [],
  placement = 'top',
  ...props 
}) => {
  const theme = useTheme();
  
  const getTypeIcon = () => {
    const icons = {
      info: <InfoIcon fontSize="small" />,
      warning: <WarningIcon fontSize="small" />,
      error: <ErrorIcon fontSize="small" />,
      success: <SuccessIcon fontSize="small" />,
      tip: <TipIcon fontSize="small" />,
      security: <SecurityIcon fontSize="small" />,
      performance: <PerformanceIcon fontSize="small" />
    };
    return icons[type] || icons.info;
  };

  const tooltipContent = (
    <Card elevation={0} sx={{ maxWidth: 350 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header */}
        <Box display="flex" alignItems="flex-start" gap={1} mb={1}>
          <Box 
            sx={{ 
              color: getTooltipColor(theme, type),
              mt: 0.5 
            }}
          >
            {getTypeIcon()}
          </Box>
          <Box flex={1}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              {title}
            </Typography>
            {description && (
              <Typography variant="body2" color="text.secondary" paragraph>
                {description}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Shortcut */}
        {shortcut && (
          <Box mb={1}>
            <Chip
              label={shortcut}
              size="small"
              variant="outlined"
              icon={<CodeIcon fontSize="small" />}
              sx={{ fontSize: '0.75rem' }}
            />
          </Box>
        )}

        {/* Links */}
        {links.length > 0 && (
          <Box mb={1}>
            {links.map((link, index) => (
              <Link
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                variant="body2"
                display="flex"
                alignItems="center"
                gap={0.5}
                sx={{ mb: 0.5, textDecoration: 'none' }}
              >
                <LinkIcon fontSize="small" />
                {link.label}
              </Link>
            ))}
          </Box>
        )}

        {/* Actions */}
        {actions.length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            <Box display="flex" gap={1} flexWrap="wrap">
              {actions.map((action, index) => (
                <Button
                  key={index}
                  size="small"
                  variant={action.primary ? "contained" : "outlined"}
                  onClick={action.onClick}
                  startIcon={action.icon}
                >
                  {action.label}
                </Button>
              ))}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <StyledTooltip
      title={tooltipContent}
      placement={placement}
      className="rich-tooltip"
      arrow
      {...props}
    >
      {children}
    </StyledTooltip>
  );
};

/**
 * 🎮 Componente InteractiveTooltip - Tooltip interactivo con estado
 */
export const InteractiveTooltip = ({ 
  children, 
  content,
  isPinnable = false,
  onPin,
  onClose,
  ...props 
}) => {
  const [isPinned, setIsPinned] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handlePin = () => {
    setIsPinned(!isPinned);
    if (onPin) onPin(!isPinned);
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsPinned(false);
    if (onClose) onClose();
  };

  const tooltipContent = (
    <Box sx={{ position: 'relative' }}>
      {/* Pin/Close controls */}
      {(isPinnable || isPinned) && (
        <Box
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            display: 'flex',
            gap: 0.5,
            zIndex: 1
          }}
        >
          {isPinnable && (
            <IconButton
              size="small"
              onClick={handlePin}
              sx={{ 
                color: isPinned ? 'primary.main' : 'text.secondary',
                '&:hover': { backgroundColor: alpha('#fff', 0.1) }
              }}
            >
              <PinIcon fontSize="small" />
            </IconButton>
          )}
          {isPinned && (
            <IconButton
              size="small"
              onClick={handleClose}
              sx={{ 
                color: 'text.secondary',
                '&:hover': { backgroundColor: alpha('#fff', 0.1) }
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      )}
      
      {/* Content */}
      <Box pt={isPinnable || isPinned ? 2 : 0}>
        {content}
      </Box>
    </Box>
  );

  return (
    <StyledTooltip
      title={tooltipContent}
      open={isOpen || isPinned}
      onOpen={() => setIsOpen(true)}
      onClose={() => !isPinned && setIsOpen(false)}
      className="interactive-tooltip"
      disableHoverListener={isPinned}
      disableFocusListener={isPinned}
      disableTouchListener={isPinned}
      {...props}
    >
      {children}
    </StyledTooltip>
  );
};

/**
 * 📊 Componente DataTooltip - Tooltip especializado para datos
 */
export const DataTooltip = ({ 
  children, 
  data = {},
  formatters = {},
  compareData = null,
  showTrends = false,
  ...props 
}) => {
  const theme = useTheme();

  const formatValue = (key, value) => {
    if (formatters[key]) {
      return formatters[key](value);
    }
    
    // Auto-formatters básicos
    if (typeof value === 'number') {
      if (key.toLowerCase().includes('percent') || key.toLowerCase().includes('%')) {
        return `${value.toFixed(1)}%`;
      }
      if (key.toLowerCase().includes('size') || key.toLowerCase().includes('bytes')) {
        return formatBytes(value);
      }
      if (key.toLowerCase().includes('date') || key.toLowerCase().includes('time')) {
        return new Date(value).toLocaleDateString();
      }
      return value.toLocaleString();
    }
    
    return value;
  };

  const getTrendIndicator = (current, previous) => {
    if (!previous || typeof current !== 'number' || typeof previous !== 'number') return null;
    
    const change = ((current - previous) / previous) * 100;
    const isPositive = change > 0;
    
    return (
      <Chip
        label={`${isPositive ? '+' : ''}${change.toFixed(1)}%`}
        size="small"
        color={isPositive ? 'success' : 'error'}
        sx={{ ml: 1, fontSize: '0.7rem' }}
      />
    );
  };

  const tooltipContent = (
    <Paper sx={{ p: 2, minWidth: 200 }}>
      <List dense disablePadding>
        {Object.entries(data).map(([key, value], index) => (
          <ListItem key={key} disableGutters>
            <ListItemText
              primary={
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Typography>
                  <Box display="flex" alignItems="center">
                    <Typography variant="body2" fontWeight={500}>
                      {formatValue(key, value)}
                    </Typography>
                    {showTrends && compareData && compareData[key] && 
                      getTrendIndicator(value, compareData[key])
                    }
                  </Box>
                </Box>
              }
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );

  return (
    <StyledTooltip
      title={tooltipContent}
      className="rich-tooltip"
      arrow
      {...props}
    >
      {children}
    </StyledTooltip>
  );
};

/**
 * 🔄 Componente ProgressTooltip - Tooltip para estados de progreso
 */
export const ProgressTooltip = ({ 
  children, 
  title,
  steps = [],
  currentStep = 0,
  totalSteps,
  showProgress = true,
  ...props 
}) => {
  const progress = totalSteps ? (currentStep / totalSteps) * 100 : 0;

  const tooltipContent = (
    <Box sx={{ minWidth: 250, p: 1 }}>
      <Typography variant="subtitle2" gutterBottom>
        {title}
      </Typography>
      
      {showProgress && (
        <Box sx={{ mb: 2 }}>
          <Box display="flex" justifyContent="space-between" mb={0.5}>
            <Typography variant="body2" color="text.secondary">
              Progreso
            </Typography>
            <Typography variant="body2" fontWeight={500}>
              {Math.round(progress)}%
            </Typography>
          </Box>
          <Box
            sx={{
              width: '100%',
              height: 4,
              backgroundColor: 'action.hover',
              borderRadius: 2,
              overflow: 'hidden'
            }}
          >
            <Box
              sx={{
                width: `${progress}%`,
                height: '100%',
                backgroundColor: 'primary.main',
                transition: 'width 0.3s ease-in-out'
              }}
            />
          </Box>
        </Box>
      )}
      
      {steps.length > 0 && (
        <List dense disablePadding>
          {steps.map((step, index) => (
            <ListItem key={index} disableGutters>
              <ListItemIcon sx={{ minWidth: 24 }}>
                {index < currentStep ? (
                  <SuccessIcon fontSize="small" color="success" />
                ) : index === currentStep ? (
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: 'primary.main',
                      animation: 'pulse 1.5s infinite'
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: 'action.disabled'
                    }}
                  />
                )}
              </ListItemIcon>
              <ListItemText
                primary={step.label || step}
                secondary={step.description}
                primaryTypographyProps={{
                  variant: 'body2',
                  color: index <= currentStep ? 'text.primary' : 'text.secondary'
                }}
                secondaryTypographyProps={{
                  variant: 'caption'
                }}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );

  return (
    <StyledTooltip
      title={tooltipContent}
      className="rich-tooltip"
      arrow
      {...props}
    >
      {children}
    </StyledTooltip>
  );
};

/**
 * 🎯 Componente TooltipProvider - Proveedor de contexto para tooltips
 */
export const TooltipProvider = ({ children, config = {} }) => {
  const {
    defaultDelay = 500,
    maxWidth = 300,
    enableRichTooltips = true,
    enableAnimations = true
  } = config;

  return (
    <Box
      sx={{
        '& .MuiTooltip-tooltip': {
          maxWidth: maxWidth,
          ...(enableAnimations && {
            transition: 'all 0.2s ease-in-out'
          })
        }
      }}
    >
      {children}
    </Box>
  );
};

/**
 * 🔧 Utilidades para tooltips
 */
export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const createTooltipContent = (type, data) => {
  switch (type) {
    case 'certificate':
      return {
        title: data.common_name || 'Certificado',
        description: `Emisor: ${data.issuer}\nVence: ${new Date(data.expiration_date).toLocaleDateString()}`,
        type: data.status === 'expired' ? 'error' : data.status === 'expiring' ? 'warning' : 'success'
      };
    
    case 'device':
      return {
        title: data.hostname || data.ip_address,
        description: `Tipo: ${data.type}\nEstado: ${data.status}`,
        type: data.status === 'offline' ? 'error' : 'success'
      };
    
    case 'vulnerability':
      return {
        title: data.title,
        description: data.description,
        type: data.severity === 'critical' ? 'error' : data.severity === 'high' ? 'warning' : 'info'
      };
    
    default:
      return { title: 'Información', type: 'info' };
  }
};

/**
 * 🎨 Estilos globales para animaciones
 */
const globalStyles = `
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }
  
  .tooltip-fade-enter {
    opacity: 0;
    transform: scale(0.8);
  }
  
  .tooltip-fade-enter-active {
    opacity: 1;
    transform: scale(1);
    transition: opacity 200ms, transform 200ms;
  }
  
  .tooltip-fade-exit {
    opacity: 1;
    transform: scale(1);
  }
  
  .tooltip-fade-exit-active {
    opacity: 0;
    transform: scale(0.8);
    transition: opacity 200ms, transform 200ms;
  }
`;

// Inyectar estilos globales
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = globalStyles;
  document.head.appendChild(styleElement);
}

export default {
  BasicTooltip,
  RichTooltip,
  InteractiveTooltip,
  DataTooltip,
  ProgressTooltip,
  TooltipProvider,
  createTooltipContent,
  formatBytes
};