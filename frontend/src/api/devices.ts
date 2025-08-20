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