import api from '../services/api';
import type { Device, DeviceRow, ScanResponse, DeviceCreate, DeviceUpdate, DeviceCredentials } from '../types/device';

// Re-export types for backwards compatibility
export type { Device, DeviceRow, ScanResponse, DeviceCreate, DeviceUpdate, DeviceCredentials };

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