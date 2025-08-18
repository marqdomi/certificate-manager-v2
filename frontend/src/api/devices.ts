// frontend/src/api/devices.ts
import api from '../services/api';

export type Device = {
  id: number;
  hostname: string;
  ip_address: string;
  site?: string | null;
};

export type CacheStatus = {
  device_id: number;
  profiles_count: number;
  vips_count: number;
  links_count: number;
  last_updated: string | null;
};

export async function fetchDevices(search?: string): Promise<Device[]> {
  const res = await api.get('/devices/', { params: search ? { search } : undefined });
  return res.data;
}

export async function fetchCacheStatus(deviceId: number): Promise<CacheStatus> {
  const res = await api.get('/f5/cache/status', { params: { device_id: deviceId } });
  return res.data;
}

export async function triggerCacheRefresh(deviceIds: number[]): Promise<{queued: boolean}> {
  const res = await api.post('/f5/cache/refresh', { device_ids: deviceIds });
  return res.data;
}