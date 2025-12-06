/// <reference types="vite/client" />

// Lightweight HTTP helper used by parts of the app that don't use axios.
// Keep this file tiny and framework-agnostic.

// Read from Vite envs. In some TS setups `import.meta.env` can be typed narrowly,
// so we defensively cast to `any` and normalize the value to a string.
const VITE_ENV: any = (import.meta as any).env || {};
export const API_BASE: string = String(VITE_ENV.VITE_API_BASE_URL || '')
  .replace(/\/+$/, '');

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
  const url = `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;

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