// frontend/src/constants/designTokens.js
// ============================================================================
// CMT Design System — Design Tokens
// ============================================================================
// Centralized semantic color maps, chart palettes, and reusable constants.
// These tokens work hand-in-hand with `theme.js` but can be imported without
// needing a theme reference (useful for Recharts configs, static objects, etc.)
//
// MIGRATION NOTE: Every hardcoded hex/rgba in the codebase should eventually
// reference either theme.palette.* or one of these token maps.
// ============================================================================

// ---------------------------------------------------------------------------
// 1. Status Colors — unified semantic status palette
// ---------------------------------------------------------------------------
// Used for: certificate health, device status, scan results, HA state, etc.
// These replace all scattered Tailwind-style hex colors (#10b981, #ef4444, etc.)

export const STATUS_COLORS = {
  // ---- Positive / Success ----
  success: {
    light: { main: '#2e7d32', bg: '#E8F5E9', text: '#1B5E20' },
    dark:  { main: '#4CAF50', bg: '#1B3A26', text: '#81C784' },
  },
  // ---- Warning ----
  warning: {
    light: { main: '#ed6c02', bg: '#FFF3E0', text: '#E65100' },
    dark:  { main: '#FFB74D', bg: '#3E2C1A', text: '#FFD54F' },
  },
  // ---- Error / Danger ----
  error: {
    light: { main: '#d32f2f', bg: '#FFEBEE', text: '#B71C1C' },
    dark:  { main: '#EF5350', bg: '#3A1A1A', text: '#E57373' },
  },
  // ---- Informational ----
  info: {
    light: { main: '#0288d1', bg: '#E3F2FD', text: '#01579B' },
    dark:  { main: '#42A5F5', bg: '#1A2C3E', text: '#90CAF9' },
  },
  // ---- Neutral / Unknown ----
  neutral: {
    light: { main: '#757575', bg: '#F5F5F5', text: '#424242' },
    dark:  { main: '#9E9E9E', bg: '#253349', text: '#B0BEC5' },
  },
};

// ---------------------------------------------------------------------------
// 2. Certificate Status Colors
// ---------------------------------------------------------------------------
// Maps certificate health states to semantic colors.
// Usage: `getCertStatusColor('healthy', mode)` → returns { main, bg, text }

export const CERT_STATUS = {
  healthy:  'success',
  expiring: 'warning',
  expired:  'error',
  unknown:  'neutral',
};

/**
 * Get the color set for a certificate based on days remaining.
 * @param {number} daysRemaining
 * @param {'light'|'dark'} mode
 * @returns {{ main: string, bg: string, text: string }}
 */
export function getCertDaysColor(daysRemaining, mode = 'light') {
  if (daysRemaining <= 0) return STATUS_COLORS.error[mode];
  if (daysRemaining <= 30) return STATUS_COLORS.warning[mode];
  return STATUS_COLORS.success[mode];
}

/**
 * Get MUI color name from days remaining (for Chip `color` prop, etc.)
 * @param {number} daysRemaining
 * @returns {'success'|'warning'|'error'}
 */
export function getCertDaysMuiColor(daysRemaining) {
  if (daysRemaining <= 0) return 'error';
  if (daysRemaining <= 30) return 'warning';
  return 'success';
}

// ---------------------------------------------------------------------------
// 3. Device / Scan Status Colors
// ---------------------------------------------------------------------------

export const SCAN_STATUS_MAP = {
  success: 'success',
  error:   'error',
  failed:  'error',
  warning: 'warning',
  running: 'info',
  pending: 'neutral',
  default: 'neutral',
};

export const HA_STATE_MAP = {
  ACTIVE:     'success',
  STANDBY:    'neutral',
  STANDALONE: 'info',
  OFFLINE:    'error',
};

export const SYNC_COLOR_MAP = {
  green:  'success',
  yellow: 'warning',
  red:    'error',
};

/**
 * Resolve a semantic status key to actual colors for the current mode.
 * @param {string} semanticKey - e.g. 'success', 'error', 'warning', 'info', 'neutral'
 * @param {'light'|'dark'} mode
 * @returns {{ main: string, bg: string, text: string }}
 */
export function getStatusColors(semanticKey, mode = 'light') {
  return STATUS_COLORS[semanticKey]?.[mode] ?? STATUS_COLORS.neutral[mode];
}

// ---------------------------------------------------------------------------
// 4. Chart Colors — consistent palette for Recharts
// ---------------------------------------------------------------------------
// Ordered for visual distinctiveness; safe for colorblind users (checked via
// Coblis colorblind simulator).

export const CHART_COLORS = {
  // Primary series palette (up to 8 series)
  series: [
    '#5A31A0', // brand purple
    '#0dc6e7', // brand teal
    '#2e7d32', // success green
    '#ed6c02', // warning orange
    '#d32f2f', // error red
    '#0288d1', // info blue
    '#7B52C1', // purple light
    '#FFB74D', // amber
  ],

  // Categorical palette for HostSearch components (6 categories)
  categorical: [
    '#5A31A0', // Virtual Servers → brand purple
    '#2e7d32', // Pools → green
    '#ed6c02', // Pool Members → orange
    '#7B52C1', // Nodes → purple light
    '#d32f2f', // iRules → red
    '#64748B', // Data Groups → slate
  ],

  // Expiration trend chart (specific semantic meaning)
  expiration: {
    expired:    '#d32f2f',
    expiring30: '#ed6c02',
    expiring90: '#FFB74D',
    healthy:    '#2e7d32',
    cumulative: '#5A31A0',
  },

  // Pie chart / donut fills
  pie: ['#5A31A0', '#0dc6e7', '#2e7d32', '#ed6c02', '#7B52C1', '#FFB74D'],

  // Gradient fill helpers (for AreaChart)
  gradientStart: 'rgba(90, 49, 160, 0.3)',
  gradientEnd:   'rgba(90, 49, 160, 0.0)',
};

// Dark mode chart overrides — slightly brighter for contrast on dark backgrounds
export const CHART_COLORS_DARK = {
  ...CHART_COLORS,
  series: [
    '#7B52C1',
    '#4DD9F0',
    '#4CAF50',
    '#FFB74D',
    '#EF5350',
    '#42A5F5',
    '#9575CD',
    '#FFD54F',
  ],
  categorical: [
    '#7B52C1',
    '#4CAF50',
    '#FFB74D',
    '#9575CD',
    '#EF5350',
    '#90A4AE',
  ],
  expiration: {
    expired:    '#EF5350',
    expiring30: '#FFB74D',
    expiring90: '#FFD54F',
    healthy:    '#4CAF50',
    cumulative: '#7B52C1',
  },
  pie: ['#7B52C1', '#4DD9F0', '#4CAF50', '#FFB74D', '#9575CD', '#FFD54F'],
  gradientStart: 'rgba(123, 82, 193, 0.3)',
  gradientEnd:   'rgba(123, 82, 193, 0.0)',
};

/**
 * Get chart colors for the current theme mode.
 * @param {'light'|'dark'} mode
 * @returns {typeof CHART_COLORS}
 */
export function getChartColors(mode = 'light') {
  return mode === 'dark' ? CHART_COLORS_DARK : CHART_COLORS;
}

// ---------------------------------------------------------------------------
// 5. Host Search Component Colors
// ---------------------------------------------------------------------------
// Used specifically by HostSearchPage for the SEARCH_COMPONENTS config.
// These map to the categorical chart palette for consistency.

export const HOST_COMPONENT_COLORS = {
  virtual_servers: CHART_COLORS.categorical[0],
  pools:           CHART_COLORS.categorical[1],
  pool_members:    CHART_COLORS.categorical[2],
  nodes:           CHART_COLORS.categorical[3],
  irules:          CHART_COLORS.categorical[4],
  data_groups:     CHART_COLORS.categorical[5],
};

// ---------------------------------------------------------------------------
// 6. Page Layout Constants
// ---------------------------------------------------------------------------

export const LAYOUT = {
  drawerWidth: 240,
  drawerWidthCollapsed: 64,
  appBarHeight: 64,
  breadcrumbHeight: 40,
  pageMaxWidth: 'xl',        // MUI Container maxWidth
  pagePadding: { xs: 2, sm: 3 },
  sectionSpacing: 3,
  cardSpacing: 3,
};

// ---------------------------------------------------------------------------
// 7. Transition Presets (importable without theme)
// ---------------------------------------------------------------------------

export const TRANSITIONS = {
  fast:     'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
  standard: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  slow:     'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
  bounce:   'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
};

// ---------------------------------------------------------------------------
// 8. Radius Presets (importable without theme)
// ---------------------------------------------------------------------------

export const RADII = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

// ---------------------------------------------------------------------------
// 9. Monospace Font Family
// ---------------------------------------------------------------------------
// Single-source font stack for technical/code text. Avoids naked 'monospace'
// scattered across components. Import this instead of using fontFamily: 'monospace'.

export const MONO_FONT = '"JetBrains Mono", "Fira Code", "Consolas", monospace';

// ---------------------------------------------------------------------------
// 10. Favorite Star Color
// ---------------------------------------------------------------------------

export const FAVORITE_COLOR = {
  active:   '#F59E0B',
  inactive: 'text.disabled',
  hoverBg: (alpha_fn) => alpha_fn('#F59E0B', 0.1),
};

// ---------------------------------------------------------------------------
// 10. Microsoft / Azure Brand (for Login page Azure button)
// ---------------------------------------------------------------------------

export const AZURE_BRAND = {
  primary:    '#0078D4',
  hover:      '#106EBE',
  text:       '#FFFFFF',
};
