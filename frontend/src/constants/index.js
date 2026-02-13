// frontend/src/constants/index.js
// ============================================================================
// Barrel export for all design system constants
// ============================================================================
// Usage:
//   import { STATUS_COLORS, getCertDaysColor, CHART_COLORS } from '../constants';
//   import { glassmorphicCard, accentCard } from '../constants';
// ============================================================================

export {
  // Color tokens
  STATUS_COLORS,
  CERT_STATUS,
  getCertDaysColor,
  getCertDaysMuiColor,
  SCAN_STATUS_MAP,
  HA_STATE_MAP,
  SYNC_COLOR_MAP,
  getStatusColors,
  // Chart colors
  CHART_COLORS,
  CHART_COLORS_DARK,
  getChartColors,
  HOST_COMPONENT_COLORS,
  // Layout
  LAYOUT,
  // Transitions & Radii
  TRANSITIONS,
  RADII,
  // Special colors
  FAVORITE_COLOR,
  AZURE_BRAND,
} from './designTokens.js';

export {
  // Style mixins
  glassmorphicCard,
  accentCard,
  pageContainer,
  pageHeader,
  statsRow,
  clickableCard,
  monoText,
  columnSeparator,
  sectionHeader,
  gradientHeader,
  actionButtonHover,
} from './styleMixins.js';

// Re-export device states (already existed)
export {
  HA_STATES,
  SYNC_STATUSES,
  SYNC_COLORS,
  SCAN_STATUSES,
  HA_STATE_COLORS,
  SYNC_STATUS_COLORS,
  SCAN_STATUS_COLORS,
  HA_STATE_LABELS,
  getHAStateColor,
  getSyncColor,
  getScanStatusColor,
  hasHealthIssues,
} from './deviceStates.ts';
