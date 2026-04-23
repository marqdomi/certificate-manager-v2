// frontend/src/components/cluster/ClusterComponents.jsx
import React from 'react';
import {
  Box,
  Chip,
  Typography,
  Tooltip,
  IconButton,
  Stack,
  useTheme,
  alpha
} from '@mui/material';
import {
  Hub as ClusterIcon,
  Computer as DeviceIcon,
  Star as PrimaryIcon,
  Sync as SecondaryIcon,
  RadioButtonUnchecked as StandaloneIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon
} from '@mui/icons-material';

/**
 * ClusterBadge - Muestra información del cluster
 * Sigue las mejores prácticas de Microsoft para agrupación visual
 */
export const ClusterBadge = ({ 
  clusterKey, 
  clusterLabel,
  memberCount = 1, 
  isPrimary = false,
  isStandalone = false,
  size = 'medium',
  onClick = null,
  showCount = true
}) => {
  const theme = useTheme();
  
  if (isStandalone || !clusterKey) {
    return (
      <Chip
        icon={<StandaloneIcon sx={{ fontSize: '0.9rem' }} />}
        label="STANDALONE"
        size={size}
        variant="outlined"
        sx={{
          bgcolor: alpha(theme.palette.grey[500], 0.1),
          borderColor: alpha(theme.palette.grey[500], 0.3),
          color: theme.palette.text.secondary,
          '& .MuiChip-icon': {
            color: theme.palette.grey[500]
          }
        }}
      />
    );
  }

  return (
    <Tooltip 
      title={clusterKey}
      arrow
      disableHoverListener={!clusterKey}
    >
      <Chip
        icon={<ClusterIcon sx={{ fontSize: '0.9rem' }} />}
        label={
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ maxWidth: 220 }}>
            <Typography variant="caption" sx={{ fontWeight: 500 }} noWrap>
              {clusterLabel || clusterKey}
            </Typography>
            {showCount && (
              <Typography variant="caption" sx={{ 
                opacity: 0.8,
                fontSize: '0.7rem',
                fontWeight: 600
              }}>
                ({memberCount})
              </Typography>
            )}
          </Stack>
        }
        size={size}
        variant="filled"
        clickable={!!onClick}
        onClick={onClick}
        sx={{
          maxWidth: 240,
          bgcolor: alpha(theme.palette.primary.main, 0.15),
          borderColor: alpha(theme.palette.primary.main, 0.3),
          color: theme.palette.primary.main,
          '& .MuiChip-icon': {
            color: theme.palette.primary.main
          },
          ...(onClick && {
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.25),
              transform: 'translateY(-1px)',
              boxShadow: theme.shadows[2]
            }
          })
        }}
      />
    </Tooltip>
  );
};

/**
 * HAStateChip - Muestra el estado HA del dispositivo
 * Implementa el "Traffic Light Model" de Microsoft
 */
export const HAStateChip = ({ 
  haState, 
  isPrimary = false,
  size = 'small'
}) => {
  const theme = useTheme();
  
  if (!haState) {
    return (
      <Chip
        label="N/A"
        size={size}
        variant="outlined"
        sx={{
          opacity: 0.6,
          color: theme.palette.text.disabled
        }}
      />
    );
  }

  const state = haState.toLowerCase();
  let config = {
    icon: <DeviceIcon sx={{ fontSize: '0.8rem' }} />,
    label: haState,
    color: theme.palette.grey[500],
    bgColor: alpha(theme.palette.grey[500], 0.1)
  };

  // Traffic Light Model: Green (Healthy), Amber (Degraded), Red (Unhealthy)
  switch (state) {
    case 'active':
      config = {
        icon: isPrimary ? <PrimaryIcon sx={{ fontSize: '0.8rem' }} /> : <DeviceIcon sx={{ fontSize: '0.8rem' }} />,
        label: isPrimary ? 'Primary' : 'Active',
        color: theme.palette.success.main,
        bgColor: alpha(theme.palette.success.main, 0.15)
      };
      break;
    case 'standby':
      config = {
        icon: <SecondaryIcon sx={{ fontSize: '0.8rem' }} />,
        label: 'Standby',
        color: theme.palette.warning.main,
        bgColor: alpha(theme.palette.warning.main, 0.15)
      };
      break;
    case 'offline':
      config = {
        icon: <DeviceIcon sx={{ fontSize: '0.8rem' }} />,
        label: 'Offline',
        color: theme.palette.error.main,
        bgColor: alpha(theme.palette.error.main, 0.15)
      };
      break;
  }

  return (
    <Tooltip title={`HA State: ${config.label}`} arrow>
      <Chip
        icon={config.icon}
        label={config.label}
        size={size}
        variant="filled"
        sx={{
          bgcolor: config.bgColor,
          color: config.color,
          fontWeight: 500,
          '& .MuiChip-icon': {
            color: config.color
          }
        }}
      />
    </Tooltip>
  );
};

/**
 * ClusterExpandButton - Botón para expandir/colapsar miembros del cluster
 */
export const ClusterExpandButton = ({ 
  expanded = false, 
  onClick,
  memberCount = 0,
  disabled = false 
}) => {
  const theme = useTheme();
  
  if (memberCount <= 1) return null;

  return (
    <Tooltip 
      title={expanded ? 'Collapse cluster members' : `Show ${memberCount - 1} more cluster members`}
      arrow
    >
      <IconButton
        size="small"
        onClick={onClick}
        disabled={disabled}
        sx={{
          color: theme.palette.primary.main,
          bgcolor: alpha(theme.palette.primary.main, 0.1),
          '&:hover': {
            bgcolor: alpha(theme.palette.primary.main, 0.2),
          }
        }}
      >
        {expanded ? <CollapseIcon /> : <ExpandIcon />}
      </IconButton>
    </Tooltip>
  );
};

/**
 * ClusterInfo - Componente completo con información del cluster
 * Combina Badge + HA State + Expand button
 */
export const ClusterInfo = ({
  device,
  clusterLabel,
  clusterMembers = [],
  expanded = false,
  onToggleExpand,
  showExpandButton = true,
  size = 'medium'
}) => {
  const theme = useTheme();
  
  const isStandalone = !device.cluster_key || !device.cluster_key.trim();
  const memberCount = clusterMembers.length || 1;

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <ClusterBadge
        clusterKey={device.cluster_key}
        clusterLabel={clusterLabel ?? device.cluster_label}
        memberCount={memberCount}
        isPrimary={device.is_primary_preferred}
        isStandalone={isStandalone}
        size={size}
        showCount={!isStandalone}
      />
      
      <HAStateChip
        haState={device.ha_state}
        isPrimary={device.is_primary_preferred}
        size="small"
      />

      {showExpandButton && !isStandalone && (
        <ClusterExpandButton
          expanded={expanded}
          onClick={onToggleExpand}
          memberCount={memberCount}
        />
      )}
    </Stack>
  );
};

/**
 * ClusterMemberRow - Fila para miembros del cluster (secundarios)
 */
export const ClusterMemberRow = ({ device, indent = true }) => {
  const theme = useTheme();
  
  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      py: 1,
      px: indent ? 4 : 2,
      bgcolor: alpha(theme.palette.primary.main, 0.03),
      borderLeft: `3px solid ${alpha(theme.palette.primary.main, 0.3)}`,
      ml: indent ? 2 : 0
    }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1 }}>
        <DeviceIcon sx={{ 
          color: theme.palette.text.secondary,
          fontSize: '1rem'
        }} />
        <Box>
          <Typography variant="body2" color="text.secondary">
            {device.hostname}
          </Typography>
          <Typography variant="caption" color="text.disabled">
            {device.ip_address}
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto' }}>
          <HAStateChip
            haState={device.ha_state}
            isPrimary={device.is_primary_preferred}
            size="small"
          />
        </Box>
      </Stack>
    </Box>
  );
};

export default {
  ClusterBadge,
  HAStateChip,
  ClusterExpandButton,
  ClusterInfo,
  ClusterMemberRow
};
