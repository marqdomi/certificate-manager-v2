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

export type VipSearchResult = {
  vip_name: string;
  device: string;
  profiles: number;
  destination: string | null;       // p.ej. "10.141.31.51:443"
  destination_raw?: string | null;  // p.ej. "10.141.31.51%834:443"
  ip?: string | null;
  route_domain?: number | null;
  service_port?: number | null;
  enabled?: boolean | null;
  vip_full_path?: string | null;
  partition?: string | null;
  status?: string | null;
  last_sync?: string | null;        // ISO string
};

export async function getVips(deviceId: number): Promise<VipItem[]> {
  // Usa el cliente unificado de Axios con baseURL = '/api/v1'
  const res = await api.get('/f5/vips', { params: { device_id: deviceId } });
  return res.data;
}

export async function rescanDeviceNow(deviceId: number): Promise<{ queued: boolean }> {
  // Encola un refresh para un device específico
  const res = await api.post('/f5/cache/refresh', {
    device_ids: [deviceId],
    full_resync: false,
  });
  return res.data;
}