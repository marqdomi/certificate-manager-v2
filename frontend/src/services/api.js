import axios from 'axios'
import { authProvider } from '../pages/LoginPage'

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
    console.debug('[api]', 'baseURL=', config.baseURL, 'url=', config.url);
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
  const { data } = await apiClient.get(`/certificates/devices/${deviceId}/verify/${objectName}`)
  return data
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
  const { data } = await apiClient.post('/deployments/execute', form)
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
  const { data } = await apiClient.post('/deployments/plan', form)
  return data
}

// ---------------- VIPs helpers ----------------
export async function getVipsOverview() {
  const { data } = await apiClient.get('/vips/overview')
  return data
}

export async function searchVips(query, { limit = 200, deviceId, enabled } = {}) {
  const params = {}
  const q = (query ?? '').trim()
  if (q) params.q = q
  if (limit != null) params.limit = limit
  if (deviceId !== undefined && deviceId !== null && `${deviceId}` !== '') params.device_id = Number(deviceId)
  if (typeof enabled === 'boolean') params.enabled = enabled
  const { data } = await apiClient.get('/vips/search', { params })
  return data
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