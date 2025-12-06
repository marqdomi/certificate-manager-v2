/**
 * Audit Log Types - CMT v2.5
 */

// Audit action types matching backend
export type AuditAction =
  | 'cert_deployed'
  | 'cert_renewed'
  | 'cert_deleted'
  | 'cert_uploaded'
  | 'csr_generated'
  | 'csr_completed'
  | 'csr_deleted'
  | 'device_added'
  | 'device_modified'
  | 'device_deleted'
  | 'device_scanned'
  | 'profile_created'
  | 'profile_modified'
  | 'profile_deleted'
  | 'user_login'
  | 'user_logout'
  | 'user_created'
  | 'user_modified';

// Audit result types
export type AuditResult = 'success' | 'failure' | 'partial';

// Single audit log entry
export interface AuditLogEntry {
  id: number;
  timestamp: string;
  username: string | null;
  action: AuditAction;
  result: AuditResult;
  resource_type: string;
  resource_id: number | null;
  resource_name: string | null;
  device_hostname: string | null;
  description: string | null;
  error_message: string | null;
}

// API response for listing audit logs
export interface AuditLogListResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  page_size: number;
}

// Audit statistics for dashboard
export interface AuditStatsResponse {
  total_entries: number;
  by_action: Record<string, number>;
  by_result: Record<string, number>;
  recent_failures: number;
}

// Filter options for querying audit logs
export interface AuditLogFilters {
  page?: number;
  page_size?: number;
  action?: AuditAction;
  resource_type?: string;
  username?: string;
  device_id?: number;
  result?: AuditResult;
}

// Action metadata for display
export interface ActionMetadata {
  label: string;
  color: 'success' | 'error' | 'warning' | 'info' | 'default';
  icon: string;
  category: 'certificate' | 'device' | 'user' | 'csr' | 'profile';
}

// Action display configuration
export const AUDIT_ACTION_METADATA: Record<AuditAction, ActionMetadata> = {
  cert_deployed: { label: 'Certificate Deployed', color: 'success', icon: 'upload', category: 'certificate' },
  cert_renewed: { label: 'Certificate Renewed', color: 'success', icon: 'refresh', category: 'certificate' },
  cert_deleted: { label: 'Certificate Deleted', color: 'error', icon: 'delete', category: 'certificate' },
  cert_uploaded: { label: 'Certificate Uploaded', color: 'info', icon: 'upload_file', category: 'certificate' },
  csr_generated: { label: 'CSR Generated', color: 'info', icon: 'add_circle', category: 'csr' },
  csr_completed: { label: 'CSR Completed', color: 'success', icon: 'check_circle', category: 'csr' },
  csr_deleted: { label: 'CSR Deleted', color: 'warning', icon: 'delete', category: 'csr' },
  device_added: { label: 'Device Added', color: 'success', icon: 'add', category: 'device' },
  device_modified: { label: 'Device Modified', color: 'info', icon: 'edit', category: 'device' },
  device_deleted: { label: 'Device Deleted', color: 'error', icon: 'delete', category: 'device' },
  device_scanned: { label: 'Device Scanned', color: 'info', icon: 'radar', category: 'device' },
  profile_created: { label: 'Profile Created', color: 'success', icon: 'add_box', category: 'profile' },
  profile_modified: { label: 'Profile Modified', color: 'info', icon: 'edit', category: 'profile' },
  profile_deleted: { label: 'Profile Deleted', color: 'error', icon: 'delete', category: 'profile' },
  user_login: { label: 'User Login', color: 'default', icon: 'login', category: 'user' },
  user_logout: { label: 'User Logout', color: 'default', icon: 'logout', category: 'user' },
  user_created: { label: 'User Created', color: 'success', icon: 'person_add', category: 'user' },
  user_modified: { label: 'User Modified', color: 'info', icon: 'manage_accounts', category: 'user' },
};

// Result display colors
export const RESULT_COLORS: Record<AuditResult, 'success' | 'error' | 'warning'> = {
  success: 'success',
  failure: 'error',
  partial: 'warning',
};

// Resource type labels
export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  certificate: 'Certificate',
  device: 'Device',
  user: 'User',
  csr: 'CSR Request',
  profile: 'SSL Profile',
  deployment: 'Deployment',
};
