// frontend/src/types/csr.ts
// Types for CSR Generator functionality

/**
 * Status values for CSR/Renewal requests
 */
export type CSRStatus = 
  | 'CSR_GENERATED'
  | 'CERT_RECEIVED'
  | 'PFX_READY'
  | 'DEPLOYED'
  | 'COMPLETED'
  | 'FAILED'
  | 'EXPIRED';

/**
 * Request payload for generating a new CSR
 */
export interface CSRGenerateRequest {
  common_name: string;
  organization?: string;
  organizational_unit?: string;
  locality?: string;
  state?: string;
  country?: string;
  email?: string;
  san_dns_names?: string[];
  san_ip_addresses?: string[];
  key_size?: 2048 | 4096;
  certificate_id?: number;
}

/**
 * Response from CSR generation
 */
export interface CSRGenerateResponse {
  renewal_request_id: number;
  common_name: string;
  csr_pem: string;
  key_pem: string;
  key_size: number;
  san_names: string[];
  message: string;
}

/**
 * Request to complete CSR with signed certificate
 */
export interface CSRCompleteRequest {
  signed_certificate_pem: string;
  certificate_chain_pem?: string | null;
  pfx_password?: string | null;
}

/**
 * Response from CSR completion
 */
export interface CSRCompleteResponse {
  renewal_request_id: number;
  status: CSRStatus;
  common_name: string;
  pfx_filename: string;
  expiration_date?: string;
  issuer?: string;
  message: string;
}

/**
 * Pending CSR item from list endpoint
 */
export interface PendingCSR {
  id: number;
  certificate_id?: number;
  certificate_name?: string;
  common_name: string;
  san_names?: string[];
  status: CSRStatus;
  csr_pem?: string;
  key_size?: number;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  pfx_filename?: string;
  cert_expiration_date?: string;
  cert_issuer?: string;
}

/**
 * Form state for CSR generation wizard
 */
export interface CSRFormData {
  common_name: string;
  organization: string;
  organizational_unit: string;
  locality: string;
  state: string;
  country: string;
  email: string;
  san_dns_names: string[];
  san_ip_addresses: string[];
  key_size: 2048 | 4096;
}

/**
 * Certificate data passed to wizard for renewal
 */
export interface CertificateToRenew {
  id?: number;
  name?: string;
  common_name?: string;
  san_names?: string | string[];
}

/**
 * Status display configuration
 */
export const STATUS_COLORS: Record<CSRStatus, 'warning' | 'info' | 'success' | 'default' | 'error'> = {
  CSR_GENERATED: 'warning',
  CERT_RECEIVED: 'info',
  PFX_READY: 'success',
  DEPLOYED: 'success',
  COMPLETED: 'default',
  FAILED: 'error',
  EXPIRED: 'error',
};

export const STATUS_LABELS: Record<CSRStatus, string> = {
  CSR_GENERATED: 'Awaiting CA',
  CERT_RECEIVED: 'Processing',
  PFX_READY: 'Ready to Deploy',
  DEPLOYED: 'Deployed',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
};
