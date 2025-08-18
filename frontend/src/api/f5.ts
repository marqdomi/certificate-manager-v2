

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

export async function getVips(deviceId: number): Promise<VipItem[]> {
  const resp = await fetch(`/api/v1/f5/vips?device_id=${deviceId}`);
  if (!resp.ok) throw new Error(`Failed to fetch VIPs: ${resp.status}`);
  return resp.json();
}

export async function rescanDeviceNow(deviceId: number): Promise<{queued: boolean}> {
  const resp = await fetch(`/api/v1/f5/cache/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_ids: [deviceId], full_resync: false })
  });
  if (!resp.ok) throw new Error(`Failed to queue refresh: ${resp.status}`);
  return resp.json();
}