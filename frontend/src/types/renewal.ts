/**
 * Types for Renewal Wizard components
 */

// Renewal methods available in the wizard
export type RenewalMethod = 'pfx' | 'csr' | 'continue';

export const RENEWAL_METHODS = {
  PFX: 'pfx' as RenewalMethod,
  CSR: 'csr' as RenewalMethod,
  CONTINUE: 'continue' as RenewalMethod,
} as const;

// Device information
export interface DeviceInfo {
  id: number;
  hostname?: string;
  ip_address?: string;
}

// Certificate information for renewal
export interface CertificateInfo {
  id: number;
  name: string;
  common_name?: string;
  san_names?: string | string[];
  device_id?: number;
  device_hostname?: string;
  expiration_date?: string;
  days_remaining?: number;
  renewal_status?: string;
  renewal_id?: number;
}

// Pending CSR request
export interface PendingCSRRequest {
  id: number;
  common_name: string;
  original_certificate_id?: number;
  status: string;
  created_at?: string;
  san_names?: string[];
}

// Upload mode
export type UploadMode = 'pfx' | 'pem';

// Parsed certificate data from validation
export interface ParsedCertificate {
  cn?: string;
  not_after?: string;
  san?: string[];
  subjectAltName?: string[];
  subject?: string;
  issuer?: string;
}

// Validation result from backend
export interface ValidationResult {
  parsed?: ParsedCertificate;
  warnings?: string[];
  info?: {
    san?: string[];
  };
  san?: string[];
}

// Upload payload passed between steps
export interface UploadPayload {
  mode: UploadMode;
  pfxFile?: File | null;
  pfxPassword?: string;
  certPem?: string;
  keyPem?: string;
  chainPem?: string;
  parsed?: ParsedCertificate;
  warnings?: string[];
  validated?: boolean;
}

// Preview data from impact preview step
export interface PreviewData {
  profiles: SSLProfile[];
  from: 'cache' | 'live' | 'simplified' | 'cache-miss' | 'cache-error' | 'none';
  error?: string | null;
}

// SSL Profile information
export interface SSLProfile {
  name: string;
  partition: string;
  context: string;
  vips: VIPInfo[];
  profile_full_path?: string;
}

// VIP information
export interface VIPInfo {
  name?: string;
  enabled?: boolean;
  disabled?: boolean;
  state?: string;
  status?: {
    enabled?: boolean;
  };
}

// Deployment plan
export interface DeploymentPlan {
  device?: string;
  device_ip?: string;
  old_cert_name?: string;
  mode?: string;
  derived_new_object?: string;
  chain_name?: string;
  install_chain_from_pfx?: boolean;
  update_profiles?: boolean;
  actions?: string[];
  profiles_to_update?: string[];
}

// Deployment result
export interface DeploymentResult {
  result?: {
    new_cert_object?: string;
    updated_profiles?: string[] | Record<string, unknown>;
    updated_count?: number;
  };
  new_cert_object?: string;
  new_object_name?: string;
  updated_profiles?: string[];
  updated_count?: number;
}

// Verification result
export interface VerificationResult {
  version?: string;
  san?: string[];
  serial?: string;
  not_after?: string;
  subject?: string;
  issuer?: string;
  fingerprint_sha256?: string;
  object_name?: string;
  source?: string;
}

// Toast notification
export interface ToastState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}
