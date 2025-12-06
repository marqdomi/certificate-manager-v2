import axios from 'axios'
import { authProvider } from '../pages/LoginPage'

// Enable debug logging only in development mode
const DEBUG = import.meta.env.DEV;

// Axios instance pointing at Vite proxy. In dev, Vite forwards `/api` to backend.
// In prod (static build behind the same origin), `/api` should be routed by the reverse proxy.
const apiClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  timeout: 30000,
  headers: { Accept: 'application/json' },
})

// ---- Request interceptor: attach bearer token if present ----
apiClient.interceptors.request.use(
  (config) => {
    const token = authProvider.getToken?.()
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
    if (DEBUG) console.debug('[api]', 'baseURL=', config.baseURL, 'url=', config.url);
    // Normalize accidental absolute URLs like "http://backend:8000/api/v1/..." coming from older code paths
    if (typeof config.url === 'string' && /^(https?:)?\/\/backend(:8000)?\//.test(config.url)) {
      try {
        const u = new URL(config.url, window.location.origin);
        // Keep only path+search so Vite proxy handles it (dev) or same-origin reverse proxy (prod)
        config.url = u.pathname + u.search + u.hash;
        // Ensure we keep our relative baseURL
        // (axios will ignore baseURL if url is absolute; now it's relative again)
      } catch (e) {
        // no-op if URL constructor fails; better to send as-is than break
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ---- Response interceptor: auto-logout on 401 ----
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      try {
        authProvider.logout?.()
      } finally {
        window.location.reload()
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient

// ---------------- Convenience wrappers ----------------
export async function deployPfxForRenewal(certId, file, password) {
  const formData = new FormData()
  formData.append('pfx_file', file)
  if (password) formData.append('pfx_password', password)
  const { data } = await apiClient.post(`/certificates/${certId}/deploy-pfx`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function deployNewPfx(targetDeviceIds, file, password, installChainFromPfx = false) {
  const formData = new FormData()
  formData.append('pfx_file', file)
  if (password) formData.append('pfx_password', password)
  targetDeviceIds.forEach((id) => formData.append('target_device_ids', id))
  formData.append('install_chain_from_pfx', installChainFromPfx)
  const { data } = await apiClient.post('/deployments/new-pfx', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function previewDeployment(deviceId, oldCertName, partition = 'Common') {
  const form = new FormData()
  form.append('device_id', deviceId)
  form.append('old_cert_name', oldCertName)
  form.append('partition', partition)
  const { data } = await apiClient.post('/deployments/preview', form)
  return data
}

export async function confirmDeployment(
  deviceId,
  oldCertName,
  newObjectName,
  chainName = 'DigiCert_Global_G2_TLS_RSA_SHA256_2020_CA1',
  selectedProfiles = null
) {
  const form = new FormData()
  form.append('device_id', deviceId)
  form.append('old_cert_name', oldCertName)
  form.append('new_object_name', newObjectName)
  form.append('chain_name', chainName)
  if (selectedProfiles) {
    form.append('selected_profiles', JSON.stringify(selectedProfiles))
  }
  const { data } = await apiClient.post('/deployments/confirm', form)
  return data
}

export async function verifyInstalledCert(deviceId, objectName) {
  const params = { device_id: deviceId, cert_name: objectName };
  const { data } = await apiClient.get('/certificates/verify', { params });
  return data;
}

export async function validateDeployment(payload) {
  const form = new FormData()
  form.append('mode', payload.mode)
  if (payload.mode === 'pfx') {
    if (payload.pfxFile) form.append('pfx_file', payload.pfxFile)
    if (payload.pfxPassword) form.append('pfx_password', payload.pfxPassword)
  } else {
    if (payload.certPem) form.append('cert_pem', payload.certPem)
    if (payload.keyPem) form.append('key_pem', payload.keyPem)
    if (payload.chainPem) form.append('chain_pem', payload.chainPem)
  }
  const { data } = await apiClient.post('/deployments/validate', form)
  return data
}

export async function executeDeployment(opts) {
  const form = new FormData()
  form.append('device_id', opts.deviceId)
  form.append('old_cert_name', opts.oldCertName || '')
  form.append('mode', opts.mode)
  if (opts.mode === 'pfx') {
    if (opts.pfxFile) form.append('pfx_file', opts.pfxFile)
    if (opts.pfxPassword) form.append('pfx_password', opts.pfxPassword)
    if (opts.installChainFromPfx != null) form.append('install_chain_from_pfx', String(!!opts.installChainFromPfx))
  } else {
    if (opts.certPem) form.append('cert_pem', opts.certPem)
    if (opts.keyPem) form.append('key_pem', opts.keyPem)
  }
  if (opts.chainName) form.append('chain_name', opts.chainName)
  if (opts.updateProfiles != null) form.append('update_profiles', String(!!opts.updateProfiles))
  if (opts.selectedProfiles) form.append('selected_profiles', JSON.stringify(opts.selectedProfiles))
  if (opts.dryRun != null) form.append('dry_run', String(!!opts.dryRun))
  // timeoutSeconds option (default 120)
  const timeoutSeconds = opts.timeoutSeconds != null ? opts.timeoutSeconds : 120
  form.append('timeout_seconds', timeoutSeconds)
  const { data } = await apiClient.post('/deployments/execute', form, { timeout: timeoutSeconds * 1000 })
  return data
}

export async function planDeployment(opts) {
  const form = new FormData()
  form.append('device_id', opts.deviceId)
  form.append('old_cert_name', opts.oldCertName || '')
  form.append('mode', opts.mode)
  if (opts.mode === 'pfx') {
    if (opts.pfxFile) form.append('pfx_file', opts.pfxFile)
    if (opts.pfxPassword) form.append('pfx_password', opts.pfxPassword)
    if (opts.installChainFromPfx != null) form.append('install_chain_from_pfx', String(!!opts.installChainFromPfx))
  } else {
    if (opts.certPem) form.append('cert_pem', opts.certPem)
    if (opts.keyPem) form.append('key_pem', opts.keyPem)
  }
  if (opts.chainName) form.append('chain_name', opts.chainName)
  if (opts.updateProfiles != null) form.append('update_profiles', String(!!opts.updateProfiles))
  if (opts.selectedProfiles) form.append('selected_profiles', JSON.stringify(opts.selectedProfiles))
  if (opts.dryRun != null) form.append('dry_run', String(!!opts.dryRun))
  // timeoutSeconds option (default 90)
  const timeoutSeconds = opts.timeoutSeconds != null ? opts.timeoutSeconds : 90
  form.append('timeout_seconds', timeoutSeconds)

  try {
    const { data } = await apiClient.post('/deployments/plan', form, { timeout: timeoutSeconds * 1000 })

    // --- Normalize response shape for the UI ---
    const rawPlan = (data && data.plan) ? data.plan : data || {}
    const normalized = {
      dry_run: (data && typeof data.dry_run === 'boolean') ? data.dry_run : true,
      plan: {
        device: rawPlan.device || '',
        device_ip: rawPlan.device_ip || '',
        old_cert_name: rawPlan.old_cert_name ?? null,
        mode: rawPlan.mode || opts.mode,
        derived_new_object: rawPlan.derived_new_object ?? null,
        chain_name: rawPlan.chain_name || opts.chainName || '',
        install_chain_from_pfx: !!rawPlan.install_chain_from_pfx,
        update_profiles: !!rawPlan.update_profiles,
        profiles_detected: Array.isArray(rawPlan.profiles_detected) ? rawPlan.profiles_detected : [],
        virtual_servers: Array.isArray(rawPlan.virtual_servers) ? rawPlan.virtual_servers : [],
        profiles_to_update: Array.isArray(rawPlan.profiles_to_update) ? rawPlan.profiles_to_update : [],
        actions: Array.isArray(rawPlan.actions) ? rawPlan.actions : [],
      },
    }

    return normalized
  } catch (err) {
    // Keep the page from crashing; surface error upstream
    console.error('[planDeployment] failed:', err)
    throw err
  }
}

export async function refreshDeviceCerts(deviceId, { fast = true } = {}) {
  // Try a device-scoped endpoint first; fall back to certificates/scan for older backends.
  try {
    const payload = { fast };
    const { data } = await apiClient.post(`/devices/${deviceId}/scan-certs`, payload);
    return data;
  } catch (err) {
    const status = err?.response?.status;
    if (status !== 404) throw err;
    // Fallback shape: some backends expect form data with device_id
    try {
      const form = new FormData();
      form.append('device_id', deviceId);
      form.append('fast', String(!!fast));
      const { data } = await apiClient.post('/certificates/scan', form);
      return data;
    } catch (err2) {
      throw err2;
    }
  }
}

export async function getImpactPreview(deviceId, certName) {
  const params = { device_id: deviceId, cert_name: certName };
  const { data } = await apiClient.get('/f5/cache/impact-preview', { params });
  return data;
}

export async function deleteCertificate(id) {
  const { data } = await apiClient.delete(`/certificates/${id}`)
  return data
}