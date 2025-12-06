// frontend/src/types/device.ts
// Tipos centralizados para Device - SINGLE SOURCE OF TRUTH

/**
 * Device completo con todos los campos del backend
 */
export interface Device {
  id: number;
  hostname: string;
  ip_address: string;
  site?: string | null;
  cluster_key?: string | null;
  is_primary_preferred: boolean;
  version?: string | null;
  platform?: string | null;
  serial_number?: string | null;
  ha_state?: string | null;          // ACTIVE | STANDBY | STANDALONE
  sync_status?: string | null;       // In Sync | Changes Pending | Disconnected
  last_sync_color?: string | null;   // green | yellow | red
  dns_servers?: string | null;
  last_facts_refresh?: string | null;
  last_scan_status?: string | null;  // success | error | running | pending
  last_scan_message?: string | null;
  last_scan_timestamp?: string | null;
  active: boolean;
  username?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Alias para compatibilidad con código existente (DeviceRow = Device)
 */
export type DeviceRow = Device;

/**
 * Props for DeviceTable component
 */
export interface DeviceTableProps {
  onSetCredentials: (device: Device) => void;
  onDeleteDevice: (deviceId: number) => void;
  onRowClick?: (device: Device) => void;
  searchTerm?: string;
  refreshTrigger?: number;
  userRole?: string;
  onSelectionChange?: (ids: number[]) => void;
  clearSelectionKey?: number;
  filters?: DeviceFilters;
  onDevicesLoaded?: (devices: Device[]) => void;
  favorites?: number[];
  visibleColumns?: string[];
  onToggleFavorite?: (deviceId: number) => void;
}

/**
 * Device filters for DeviceTable
 */
export interface DeviceFilters {
  ha_state?: string | null;
  sync_status?: string | null;
  site?: string | null;
  is_primary_preferred?: boolean | null;
  no_credentials?: boolean | null;
  health_status?: string | null;
}

/**
 * Device mínimo para selects y listas simples
 */
export interface DeviceMinimal {
  id: number;
  hostname: string;
  ip_address?: string;
  site?: string | null;
}

/**
 * Credenciales de un device
 */
export interface DeviceCredentials {
  username: string;
  password: string;
}

/**
 * Payload para crear un device
 */
export interface DeviceCreate {
  hostname: string;
  ip_address: string;
  site?: string;
  cluster_key?: string;
  is_primary_preferred?: boolean;
  active?: boolean;
  username?: string;
  password?: string;
}

/**
 * Payload para actualizar un device
 */
export interface DeviceUpdate {
  hostname?: string;
  ip_address?: string;
  site?: string;
  cluster_key?: string;
  is_primary_preferred?: boolean;
  active?: boolean;
}

/**
 * Respuesta de scan/refresh
 */
export interface ScanResponse {
  queued: boolean;
  message?: string;
}
