// frontend/src/constants/deviceStates.ts
// Constantes centralizadas para estados de devices

/**
 * Estados de HA
 */
export const HA_STATES = {
  ACTIVE: 'active',
  STANDBY: 'standby',
  STANDALONE: 'standalone',
  OFFLINE: 'offline',
} as const;

export type HAState = typeof HA_STATES[keyof typeof HA_STATES];

/**
 * Estados de sincronización
 */
export const SYNC_STATUSES = {
  IN_SYNC: 'In Sync',
  CHANGES_PENDING: 'Changes Pending',
  DISCONNECTED: 'Disconnected',
  STANDALONE: 'Standalone',
} as const;

export type SyncStatus = typeof SYNC_STATUSES[keyof typeof SYNC_STATUSES];

/**
 * Colores de sync según backend (last_sync_color)
 */
export const SYNC_COLORS = {
  GREEN: 'green',
  YELLOW: 'yellow',
  RED: 'red',
} as const;

export type SyncColor = typeof SYNC_COLORS[keyof typeof SYNC_COLORS];

/**
 * Estados de scan
 */
export const SCAN_STATUSES = {
  SUCCESS: 'success',
  ERROR: 'error',
  FAILED: 'failed',
  RUNNING: 'running',
  PENDING: 'pending',
} as const;

export type ScanStatus = typeof SCAN_STATUSES[keyof typeof SCAN_STATUSES];

/**
 * Mapeo de colores MUI para estados HA
 */
export const HA_STATE_COLORS: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  [HA_STATES.ACTIVE]: 'success',
  [HA_STATES.STANDBY]: 'warning',
  [HA_STATES.STANDALONE]: 'default',
  [HA_STATES.OFFLINE]: 'error',
};

/**
 * Mapeo de colores MUI para estados de sync
 */
export const SYNC_STATUS_COLORS: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  [SYNC_COLORS.GREEN]: 'success',
  [SYNC_COLORS.YELLOW]: 'warning',
  [SYNC_COLORS.RED]: 'error',
};

/**
 * Mapeo de colores MUI para estados de scan
 */
export const SCAN_STATUS_COLORS: Record<string, 'success' | 'error' | 'info' | 'default'> = {
  [SCAN_STATUSES.SUCCESS]: 'success',
  [SCAN_STATUSES.ERROR]: 'error',
  [SCAN_STATUSES.FAILED]: 'error',
  [SCAN_STATUSES.RUNNING]: 'info',
  [SCAN_STATUSES.PENDING]: 'default',
};

/**
 * Labels legibles para estados HA
 */
export const HA_STATE_LABELS: Record<string, string> = {
  [HA_STATES.ACTIVE]: 'Active',
  [HA_STATES.STANDBY]: 'Standby',
  [HA_STATES.STANDALONE]: 'Standalone',
  [HA_STATES.OFFLINE]: 'Offline',
};

/**
 * Helper: obtener color MUI para estado HA
 */
export function getHAStateColor(state: string | null | undefined): 'success' | 'warning' | 'error' | 'default' {
  if (!state) return 'default';
  const lowerState = state.toLowerCase();
  return HA_STATE_COLORS[lowerState] || 'default';
}

/**
 * Helper: obtener color MUI para sync color
 */
export function getSyncColor(color: string | null | undefined): 'success' | 'warning' | 'error' | 'default' {
  if (!color) return 'default';
  return SYNC_STATUS_COLORS[color.toLowerCase()] || 'default';
}

/**
 * Helper: obtener color MUI para scan status
 */
export function getScanStatusColor(status: string | null | undefined): 'success' | 'error' | 'info' | 'default' {
  if (!status) return 'default';
  return SCAN_STATUS_COLORS[status.toLowerCase()] || 'default';
}

/**
 * Helper: determinar si device tiene problemas de health
 */
export function hasHealthIssues(scanStatus: string | null | undefined): boolean {
  if (!scanStatus) return false;
  const lower = scanStatus.toLowerCase();
  return lower === SCAN_STATUSES.ERROR || lower === SCAN_STATUSES.FAILED;
}
