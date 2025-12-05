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
 * Estado del cache de un device
 */
export interface DeviceCacheStatus {
  device_id: number;
  profiles_count: number;
  vips_count: number;
  links_count: number;
  last_updated: string | null;
}

/**
 * Respuesta de scan/refresh
 */
export interface ScanResponse {
  queued: boolean;
  message?: string;
}

/**
 * VIP Profile de un device
 */
export interface VipProfile {
  full_path: string;
  partition: string;
  name: string;
  cert_name?: string | null;
}

/**
 * VIP Item con sus profiles
 */
export interface VipItem {
  vip_name: string;
  profiles: VipProfile[];
}
