/**
 * Batch Operations API Service - CMT v2.5
 */

import { http } from './http';
import type {
  WildcardGroupsResponse,
  WildcardDetailsResponse,
  BatchDeployRequest,
  BatchDeployResponse,
} from '../types/batch';

const BASE_PATH = '/api/v1/batch';

/**
 * Get wildcard certificates grouped by name across devices
 */
export async function fetchWildcardGroups(
  minDevices: number = 2
): Promise<WildcardGroupsResponse> {
  return http<WildcardGroupsResponse>(`${BASE_PATH}/wildcards?min_devices=${minDevices}`);
}

/**
 * Get detailed info about a specific wildcard across all devices
 */
export async function fetchWildcardDetails(
  commonName: string
): Promise<WildcardDetailsResponse> {
  return http<WildcardDetailsResponse>(`${BASE_PATH}/wildcards/${encodeURIComponent(commonName)}`);
}

/**
 * Start a batch deployment operation
 */
export async function startBatchDeploy(
  request: BatchDeployRequest
): Promise<BatchDeployResponse> {
  return http<BatchDeployResponse>(`${BASE_PATH}/deploy`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Get status of a batch deployment
 */
export async function fetchBatchDeployStatus(
  batchId: string
): Promise<BatchDeployResponse> {
  return http<BatchDeployResponse>(`${BASE_PATH}/deploy/${batchId}`);
}

/**
 * List all batch operations
 */
export async function fetchBatchOperations(): Promise<{
  operations: Array<{
    batch_id: string;
    status: string;
    total: number;
    completed: number;
    failed: number;
    started_at: string;
    user: string;
  }>;
}> {
  return http(`${BASE_PATH}/deploy`);
}
