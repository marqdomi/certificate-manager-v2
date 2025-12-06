/**
 * Audit Log API Service - CMT v2.5
 */

import { http } from './http';
import type {
  AuditLogListResponse,
  AuditStatsResponse,
  AuditLogFilters,
  AuditLogEntry,
} from '../types/audit';

const BASE_PATH = '/api/v1/audit';

/**
 * Fetch paginated audit logs with optional filters
 */
export async function fetchAuditLogs(
  filters: AuditLogFilters = {}
): Promise<AuditLogListResponse> {
  const params = new URLSearchParams();
  
  if (filters.page) params.set('page', String(filters.page));
  if (filters.page_size) params.set('page_size', String(filters.page_size));
  if (filters.action) params.set('action', filters.action);
  if (filters.resource_type) params.set('resource_type', filters.resource_type);
  if (filters.username) params.set('username', filters.username);
  if (filters.device_id) params.set('device_id', String(filters.device_id));
  if (filters.result) params.set('result', filters.result);
  
  const query = params.toString();
  const path = query ? `${BASE_PATH}/logs?${query}` : `${BASE_PATH}/logs`;
  
  return http<AuditLogListResponse>(path);
}

/**
 * Get a single audit log entry
 */
export async function fetchAuditLogById(logId: number): Promise<AuditLogEntry> {
  return http<AuditLogEntry>(`${BASE_PATH}/logs/${logId}`);
}

/**
 * Get audit history for a specific resource
 */
export async function fetchResourceAuditHistory(
  resourceType: string,
  resourceId: number,
  limit: number = 50
): Promise<{ resource_type: string; resource_id: number; logs: AuditLogEntry[] }> {
  return http(`${BASE_PATH}/resource/${resourceType}/${resourceId}?limit=${limit}`);
}

/**
 * Get all audit logs for a specific device
 */
export async function fetchDeviceAuditHistory(
  deviceId: number,
  limit: number = 100
): Promise<{ device_id: number; logs: AuditLogEntry[] }> {
  return http(`${BASE_PATH}/device/${deviceId}?limit=${limit}`);
}

/**
 * Get audit statistics for dashboard
 */
export async function fetchAuditStats(days: number = 7): Promise<AuditStatsResponse> {
  return http<AuditStatsResponse>(`${BASE_PATH}/stats?days=${days}`);
}

/**
 * Get list of available audit action types
 */
export async function fetchAuditActions(): Promise<{
  actions: Array<{ value: string; label: string }>;
}> {
  return http(`${BASE_PATH}/actions`);
}
