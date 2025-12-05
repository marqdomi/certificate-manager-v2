import api from '../services/api';
import type { Device, DeviceRow, VipProfile, VipItem, ScanResponse, DeviceCreate, DeviceUpdate, DeviceCredentials } from '../types/device';

// Re-export types for backwards compatibility
export type { Device, DeviceRow, VipProfile, VipItem, ScanResponse, DeviceCreate, DeviceUpdate, DeviceCredentials };

// VipProfile and VipItem are now in types/device.ts

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
// DeviceRow type is now imported from types/device.ts

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

// --- Device CRUD Operations ---

/**
 * Create a new device
 */
export async function createDevice(data: DeviceCreate): Promise<Device> {
  const res = await api.post('/devices', data);
  return res.data;
}

/**
 * Update a device
 */
export async function updateDevice(deviceId: number, data: DeviceUpdate): Promise<Device> {
  const res = await api.put(`/devices/${deviceId}`, data);
  return res.data;
}

/**
 * Delete a device
 */
export async function deleteDevice(deviceId: number): Promise<void> {
  await api.delete(`/devices/${deviceId}`);
}

/**
 * Update device credentials
 */
export async function updateDeviceCredentials(deviceId: number, credentials: DeviceCredentials): Promise<{message: string}> {
  const res = await api.put(`/devices/${deviceId}/credentials`, credentials);
  return res.data;
}

// --- F5 Scan Operations ---

/**
 * Trigger scan for all devices (legacy endpoint)
 */
export async function scanAllDevices(deviceIds?: number[]): Promise<{message: string}> {
  const res = await api.post('/f5/scan-all', deviceIds ? { device_ids: deviceIds } : {});
  return res.data;
}