import api from '../services/api';

export type VipProfile = {
  full_path: string;
  partition: string;
  name: string;
  cert_name?: string | null;
};

export type VipItem = {
  vip_name: string;
  profiles: VipProfile[];
};

/**
 * Obtener VIPs cacheadas para un device específico
 */
export async function getVips(deviceId: number): Promise<VipItem[]> {
  const res = await api.get('/f5/vips', { params: { device_id: deviceId } });
  return res.data;
}

/**
 * Encola un refresh para un device específico (modo rápido por defecto)
 */
export async function rescanDeviceNow(deviceId: number): Promise<{ queued: boolean }> {
  const res = await api.post('/f5/cache/refresh', {
    device_ids: [deviceId],
    full_resync: false,
  });
  return res.data;
}

/**
 * Encola un refresh para una lista de devices. Si `full` es true, fuerza resync completo.
 */
export async function scanDevicesByIds(
  ids: number[],
  full: boolean = false,
): Promise<{ queued: boolean } | { queued: boolean }[]> {
  const res = await api.post('/f5/cache/refresh', {
    device_ids: ids,
    full_resync: full,
  });
  return res.data;
}

/**
 * Encola un refresh global para todos los devices.
 */
export async function scanDevicesAll(full: boolean = false): Promise<{ queued: boolean }>
{
  const res = await api.post('/f5/cache/refresh', {
    all: true,
    full_resync: full,
  });
  return res.data;
}

// --- New Device Facts & Cache API (uses preconfigured api client baseURL) ---
export type DeviceRow = {
  id: number;
  hostname: string;
  ip_address: string;
  site?: string;
  version?: string | null;
  platform?: string | null;
  serial_number?: string | null;
  ha_state?: string | null; // ACTIVE / STANDBY / etc
  sync_status?: string | null; // In Sync / Changes Pending
  last_sync_color?: string | null; // green / yellow / red
  dns_servers?: string | null;
  last_facts_refresh?: string | null;
  last_scan_status?: string | null;
  last_scan_message?: string | null;
  last_scan_timestamp?: string | null;
  active: boolean;
};

export async function getDevices(params: {
  search?: string;
  only_active?: boolean;
  only_in_sync?: boolean;
  only_primary?: boolean;
} = {}): Promise<DeviceRow[]> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.only_active) qs.set('only_active', 'true');
  if (params.only_in_sync) qs.set('only_in_sync', 'true');
  if (params.only_primary) qs.set('only_primary', 'true');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await api.get(`/devices/${suffix}`);
  return res.data;
}

export async function refreshFacts(deviceId: number): Promise<{message: string}> {
  const res = await api.post(`/devices/${deviceId}/refresh-facts`);
  return res.data;
}

export async function refreshFactsAll(): Promise<{message: string}> {
  const res = await api.post(`/devices/refresh-facts-all`);
  return res.data;
}

export async function refreshCache(deviceId: number, limit_certs?: number): Promise<{message: string}> {
  const qs = limit_certs != null ? `?limit_certs=${encodeURIComponent(String(limit_certs))}` : '';
  const res = await api.post(`/devices/${deviceId}/refresh-cache${qs}`);
  return res.data;
}