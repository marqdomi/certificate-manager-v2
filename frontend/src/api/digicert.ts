// frontend/src/api/digicert.ts
import api from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DigicertOrderStatus =
  | 'PENDING_SUBMIT'
  | 'SUBMITTED'
  | 'NEEDS_APPROVAL'
  | 'APPROVAL_REJECTED'
  | 'PENDING_VALIDATION'
  | 'PENDING_DCV'
  | 'ISSUED'
  | 'DOWNLOADED'
  | 'DEPLOYING'
  | 'DEPLOYED'
  | 'PARTIAL_DEPLOY'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMEOUT_APPROVAL';

export const ACTIVE_STATUSES: DigicertOrderStatus[] = [
  'PENDING_SUBMIT',
  'SUBMITTED',
  'NEEDS_APPROVAL',
  'PENDING_VALIDATION',
  'PENDING_DCV',
  'ISSUED',
  'DOWNLOADED',
  'DEPLOYING',
];

export const TERMINAL_SUCCESS_STATUSES: DigicertOrderStatus[] = ['DEPLOYED'];

export const TERMINAL_FAILURE_STATUSES: DigicertOrderStatus[] = [
  'APPROVAL_REJECTED',
  'FAILED',
  'CANCELLED',
  'TIMEOUT_APPROVAL',
];

export interface PrecheckResponse {
  certificate_id: number;
  common_name: string;
  current_sans: string[];
  approval_required: boolean;
  approvers: string[];
  early_renewal_warning: boolean;
  days_until_expiration: number | null;
  new_sans_detected: string[];
  dcv_hint: string | null;
}

export interface PreviewResponse {
  certificate_id: number;
  common_name: string;
  san_list: string[];
  validity_years: number;
  product: string;
  organization_id: string | null;
  container_id: string | null;
  key_size: number;
  approval_required: boolean;
  quota_consumed: number;
  early_renewal_warning: boolean;
}

export interface CreateRenewalRequest {
  certificate_id: number;
  san_list?: string[];
  validity_years?: number;
  product?: string;
  organization_id?: string;
  container_id?: string;
  key_size?: number;
  idempotency_key?: string;
}

export interface RenewalOrder {
  id: number;
  certificate_id: number;
  status: DigicertOrderStatus;
  digicert_order_id: string | null;
  digicert_certificate_id: string | null;
  common_name: string;
  san_list: string[];
  validity_years: number;
  product: string | null;
  container_id: string | null;
  organization_id: string | null;
  key_size: number;
  serial_number: string | null;
  thumbprint: string | null;
  valid_from: string | null;
  valid_till: string | null;
  approval_required: boolean;
  approval_detected_at: string | null;
  last_approval_reminder_at: string | null;
  dcv_method: string | null;
  dcv_completed_at: string | null;
  deploy_results: Record<string, DeployDeviceResult> | null;
  deployed_at: string | null;
  error_message: string | null;
  private_key_purged_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface DeployDeviceResult {
  status: 'success' | 'failed';
  device_hostname?: string;
  details?: unknown;
  error?: string;
  timestamp?: string;
}

export interface DcvToken {
  san: string;
  method: string;
  record_name?: string | null;
  record_value?: string | null;
  http_file_name?: string | null;
  http_file_content?: string | null;
  email?: string | null;
}

export interface DcvStatusResponse {
  order_id: number;
  tokens: DcvToken[];
  completed_at: string | null;
}

export interface AuditEvent {
  id: number;
  event_type: string;
  username: string | null;
  event_metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface HealthResponse {
  digicert_api: 'ok' | 'degraded' | 'down' | 'disabled';
  last_successful_call: string | null;
  active_orders: number;
  stuck_orders: number;
  feature_enabled: boolean;
}

export interface DigicertConfig {
  api_key_set: boolean;
  api_key_last4: string | null;
  container_id: string | null;
  organization_id: string | null;
  default_product: string | null;
  default_validity_years: number;
  default_key_size: number;
  approval_notify_emails: string[];
  approval_reminder_interval_hours: number;
  base_url: string;
  feature_enabled: boolean;
}

export interface DigicertConfigUpdate {
  api_key?: string | null;
  container_id?: string | null;
  organization_id?: string | null;
  default_product?: string | null;
  default_validity_years?: number | null;
  default_key_size?: number | null;
  approval_notify_emails?: string[] | null;
  approval_reminder_interval_hours?: number | null;
}

export interface DigicertContainer {
  id: number | string;
  name: string;
  parent_id?: number | string | null;
}

export interface DigicertOrganization {
  id: number | string;
  name: string;
  status?: string;
  container?: { id: number | string; name: string };
}

export interface DigicertProduct {
  name_id: string;
  name: string;
  type?: string;
  validation_type?: string;
  allowed_validity_years?: number[];
}

// ---------------------------------------------------------------------------
// Renewals API
// ---------------------------------------------------------------------------

export async function precheck(certificateId: number, product?: string): Promise<PrecheckResponse> {
  const res = await api.get('/digicert/renewals/precheck', {
    params: { certificate_id: certificateId, ...(product ? { product } : {}) },
  });
  return res.data;
}

export async function preview(payload: CreateRenewalRequest): Promise<PreviewResponse> {
  const res = await api.post('/digicert/renewals/preview', payload);
  return res.data;
}

export async function createRenewal(
  payload: CreateRenewalRequest,
  idempotencyKey?: string,
): Promise<RenewalOrder> {
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await api.post('/digicert/renewals', payload, { headers });
  return res.data;
}

export async function listRenewals(params: {
  certificate_id?: number;
  status?: DigicertOrderStatus;
  active_only?: boolean;
  limit?: number;
  offset?: number;
} = {}): Promise<RenewalOrder[]> {
  const res = await api.get('/digicert/renewals', { params });
  return res.data;
}

export async function getRenewal(orderId: number): Promise<RenewalOrder> {
  const res = await api.get(`/digicert/renewals/${orderId}`);
  return res.data;
}

export async function deployRenewal(
  orderId: number,
  deviceIds?: number[],
): Promise<RenewalOrder> {
  const res = await api.post(`/digicert/renewals/${orderId}/deploy`, {
    device_ids: deviceIds ?? null,
    auto_deploy: false,
  });
  return res.data;
}

export async function retryDeployRenewal(orderId: number): Promise<RenewalOrder> {
  const res = await api.post(`/digicert/renewals/${orderId}/deploy/retry`);
  return res.data;
}

export async function cancelRenewal(orderId: number, reason?: string): Promise<RenewalOrder> {
  const res = await api.post(`/digicert/renewals/${orderId}/cancel`, { reason });
  return res.data;
}

export async function retryRenewal(orderId: number): Promise<RenewalOrder> {
  const res = await api.post(`/digicert/renewals/${orderId}/retry`);
  return res.data;
}

export async function getDcvStatus(orderId: number): Promise<DcvStatusResponse> {
  const res = await api.get(`/digicert/renewals/${orderId}/dcv`);
  return res.data;
}

export async function checkDcv(orderId: number): Promise<RenewalOrder> {
  const res = await api.post(`/digicert/renewals/${orderId}/dcv/check`);
  return res.data;
}

export async function getAudit(orderId: number): Promise<AuditEvent[]> {
  const res = await api.get(`/digicert/renewals/${orderId}/audit`);
  return res.data;
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await api.get('/digicert/health');
  return res.data;
}

// ---------------------------------------------------------------------------
// Admin config API
// ---------------------------------------------------------------------------

export async function getConfig(): Promise<DigicertConfig> {
  const res = await api.get('/admin/providers/digicert/config');
  return res.data;
}

export async function updateConfig(payload: DigicertConfigUpdate): Promise<DigicertConfig> {
  const res = await api.put('/admin/providers/digicert/config', payload);
  return res.data;
}

export async function testConnection(): Promise<{
  ok: boolean;
  message: string;
  account?: unknown;
}> {
  const res = await api.post('/admin/providers/digicert/test-connection');
  return res.data;
}

export async function listContainers(): Promise<DigicertContainer[]> {
  const res = await api.get('/admin/providers/digicert/containers');
  return res.data;
}

export async function listOrganizations(containerId?: string): Promise<DigicertOrganization[]> {
  const res = await api.get('/admin/providers/digicert/organizations', {
    params: containerId ? { container_id: containerId } : undefined,
  });
  return res.data;
}

export async function listProducts(): Promise<DigicertProduct[]> {
  const res = await api.get('/admin/providers/digicert/products');
  return res.data;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isActive(status: DigicertOrderStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function isTerminalSuccess(status: DigicertOrderStatus): boolean {
  return TERMINAL_SUCCESS_STATUSES.includes(status);
}

export function isTerminalFailure(status: DigicertOrderStatus): boolean {
  return TERMINAL_FAILURE_STATUSES.includes(status);
}

export function statusColor(
  status: DigicertOrderStatus,
): 'default' | 'primary' | 'warning' | 'success' | 'error' | 'info' {
  if (isTerminalSuccess(status)) return 'success';
  if (isTerminalFailure(status)) return 'error';
  if (status === 'NEEDS_APPROVAL') return 'warning';
  if (status === 'ISSUED' || status === 'DOWNLOADED') return 'info';
  return 'primary';
}

export function statusLabel(status: DigicertOrderStatus): string {
  return status.replace(/_/g, ' ');
}
