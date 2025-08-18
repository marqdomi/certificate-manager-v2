import api from '../services/api';

export interface SearchVipsParams {
  q?: string;
  device_id?: number;
  enabled?: boolean;
  limit?: number;
}

export async function searchVips(params: SearchVipsParams) {
  const res = await api.get('/api/v1/vips/search', { params: { ...params } });
  return res.data;
}