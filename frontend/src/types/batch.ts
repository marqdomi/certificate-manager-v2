/**
 * Batch Operations Types - CMT v2.5
 */

// Batch deployment status
export type BatchDeployStatus = 'pending' | 'in_progress' | 'success' | 'failed' | 'partial';

// Device info within a wildcard group
export interface WildcardDeviceInfo {
  id: number;
  hostname: string;
  cert_id: number;
  expiration: string | null;
}

// A group of wildcards deployed across multiple devices
export interface WildcardGroup {
  common_name: string;
  certificate_count: number;
  device_count: number;
  devices: WildcardDeviceInfo[];
  earliest_expiration: string | null;
  latest_expiration: string | null;
}

// Response for wildcard groups
export interface WildcardGroupsResponse {
  groups: WildcardGroup[];
  total_wildcards: number;
}

// Detailed instance of a wildcard cert
export interface WildcardInstance {
  cert_id: number;
  device_id: number;
  hostname: string;
  ip_address: string;
  environment: string;
  expiration_date: string | null;
  serial_number: string | null;
  issuer: string | null;
  renewal_status: string | null;
}

// Wildcard details response
export interface WildcardDetailsResponse {
  common_name: string;
  total_instances: number;
  instances: WildcardInstance[];
}

// Batch deploy request
export interface BatchDeployRequest {
  source_cert_id: number;
  target_device_ids: number[];
  replace_cert_ids?: number[];
}

// Result for a single device in batch
export interface DeviceDeployResult {
  device_id: number;
  hostname: string;
  status: BatchDeployStatus;
  message?: string;
  cert_id?: number;
}

// Batch deploy response
export interface BatchDeployResponse {
  batch_id: string;
  status: BatchDeployStatus;
  total_devices: number;
  completed: number;
  failed: number;
  results: DeviceDeployResult[];
}

// Status chip colors
export const BATCH_STATUS_COLORS: Record<BatchDeployStatus, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  pending: 'default',
  in_progress: 'info',
  success: 'success',
  failed: 'error',
  partial: 'warning',
};
