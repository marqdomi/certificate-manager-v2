/// <reference types="vite/client" />

// Lightweight HTTP helper used by parts of the app that don't use axios.
// Keep this file tiny and framework-agnostic.

// Get API base URL with runtime config support (for production containers)
function getApiBase(): string {
  // 1. Check runtime config first (injected by entrypoint.sh in production)
  if (typeof window !== 'undefined' && (window as any).APP_CONFIG && (window as any).APP_CONFIG.API_URL) {
    return String((window as any).APP_CONFIG.API_URL).replace(/\/+$/, '');
  }
  
  // 2. Fall back to Vite env variables (development)
  const VITE_ENV: any = (import.meta as any).env || {};
  const envUrl = VITE_ENV.VITE_API_URL || VITE_ENV.VITE_API_BASE_URL || '';
  if (envUrl) {
    return String(envUrl).replace(/\/+$/, '');
  }
  
  // 3. Final fallback - empty string means relative URLs
  return '';
}

export const API_BASE: string = getApiBase();

function authHeader(): Record<string, string> {
  try {
    // Try both possible keys for compatibility
    const token = localStorage.getItem('user_token') || localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Get base URL dynamically to ensure runtime config is used
  const base = getApiBase();
  const url = `${base}${path.startsWith('/') ? '' : '/'}${path}`;

  // Build headers with the Headers class to satisfy the `HeadersInit` union.
  const headers = new Headers(init.headers as HeadersInit | undefined);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const ah = authHeader();
  for (const [k, v] of Object.entries(ah)) headers.set(k, v);

  const resp = await fetch(url, { ...init, headers });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`${resp.status} ${resp.statusText} | ${text}`);
  }
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}