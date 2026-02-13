// frontend/src/components/shared/StatusChip.jsx
// ============================================================================
// Universal status chip with built-in color mapping
// ============================================================================
// Replaces 4+ ad-hoc Chip implementations with hardcoded color logic.
//
// Usage:
//   <StatusChip status="ACTIVE" />                     → auto-resolved color
//   <StatusChip status="warning" label="Expiring" />   → custom label
//   <StatusChip colorMap={{ UP: 'success' }} status="UP" />
// ============================================================================

import React from 'react';
import { Chip, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';

// ---------------------------------------------------------------------------
// Built-in color map (covers HA state, sync, scan, cert status, generic)
// ---------------------------------------------------------------------------
const DEFAULT_COLOR_MAP = {
  // HA states
  active: 'success',
  standby: 'default',
  offline: 'error',

  // Sync / scan
  'in sync': 'success',
  'in-sync': 'success',
  'changes pending': 'warning',
  'changes-pending': 'warning',
  'not connected': 'error',
  'not-connected': 'error',
  disconnected: 'error',
  standalone: 'info',

  // Scan / health
  success: 'success',
  healthy: 'success',
  failed: 'error',
  error: 'error',
  warning: 'warning',
  pending: 'info',
  unknown: 'default',
  expired: 'error',
  valid: 'success',

  // Generic
  enabled: 'success',
  disabled: 'default',
  true: 'success',
  false: 'error',
  yes: 'success',
  no: 'error',
};

/**
 * Universal status chip.
 *
 * @param {object}  props
 * @param {string}  props.status    — Status key used for color lookup & default label
 * @param {string}  [props.label]   — Override display label (defaults to status)
 * @param {object}  [props.colorMap] — Custom color map merged on top of defaults
 * @param {'small'|'medium'} [props.size='small']
 * @param {'filled'|'outlined'|'soft'} [props.variant='soft'] — "soft" = filled with alpha bg
 * @param {object}  [props.sx]      — Additional sx styles
 */
const StatusChip = ({
  status,
  label,
  colorMap,
  size = 'small',
  variant = 'soft',
  sx = {},
  ...rest
}) => {
  const theme = useTheme();

  if (!status && !label) return null;

  const normalised = String(status ?? '').toLowerCase().trim();
  const merged = colorMap ? { ...DEFAULT_COLOR_MAP, ...colorMap } : DEFAULT_COLOR_MAP;
  const paletteKey = merged[normalised] || 'default';
  const displayLabel = label || status || '—';

  // "soft" variant: transparent background, colored text
  if (variant === 'soft') {
    const color =
      paletteKey === 'default'
        ? theme.palette.text.secondary
        : theme.palette[paletteKey]?.main ?? theme.palette.text.secondary;

    return (
      <Chip
        label={displayLabel}
        size={size}
        sx={{
          fontWeight: 600,
          backgroundColor: alpha(color, 0.12),
          color,
          border: 'none',
          ...sx,
        }}
        {...rest}
      />
    );
  }

  // MUI built-in variants (filled / outlined)
  return (
    <Chip
      label={displayLabel}
      size={size}
      color={paletteKey}
      variant={variant}
      sx={{ fontWeight: 600, ...sx }}
      {...rest}
    />
  );
};

export default StatusChip;
