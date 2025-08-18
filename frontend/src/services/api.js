// frontend/src/services/api.js

import axios from 'axios';
import { authProvider } from '../pages/LoginPage';

const apiClient = axios.create({
  baseURL: '/api/v1', // use Vite proxy to backend
  withCredentials: true, // allow cookies if backend uses session auth
});

// --- Interceptor de Petición (Request) ---
// Se ejecuta ANTES de enviar cada petición
apiClient.interceptors.request.use(
  (config) => {
    const token = authProvider.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- ¡NUEVO! Interceptor de Respuesta (Response) ---
// Se ejecuta DESPUÉS de recibir una respuesta (o un error)
apiClient.interceptors.response.use(
  // Si la respuesta es exitosa (ej. status 200), simplemente la devuelve
  (response) => {
    return response;
  },
  // Si la respuesta es un error...
  (error) => {
    // Comprobamos si el error es un 401 Unauthorized
    if (error.response && error.response.status === 401) {
      // Si es un 401, significa que nuestro token es inválido o ha expirado.
      console.log("Authentication token is invalid or expired. Logging out.");
      authProvider.logout(); // Borramos el token y el rol
      // Recargamos la página. Nuestro ProtectedRoute nos redirigirá al login.
      window.location.reload(); 
    }
    
    // Para cualquier otro error, simplemente lo devolvemos para que sea manejado
    // por el componente que hizo la llamada (ej. para mostrar una notificación).
    return Promise.reject(error);
  }
);

export default apiClient;

// --- Convenience wrappers (optional) ---
export async function deployPfxForRenewal(certId, file, password) {
  const formData = new FormData();
  formData.append('pfx_file', file);
  if (password) formData.append('pfx_password', password);
  const { data } = await apiClient.post(`/certificates/${certId}/deploy-pfx`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function deployNewPfx(targetDeviceIds, file, password, installChainFromPfx = false) {
  const formData = new FormData();
  formData.append('pfx_file', file);
  if (password) formData.append('pfx_password', password);
  targetDeviceIds.forEach(id => formData.append('target_device_ids', id));
  formData.append('install_chain_from_pfx', installChainFromPfx);
  const { data } = await apiClient.post('/deployments/new-pfx', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function previewDeployment(deviceId, oldCertName, partition = 'Common') {
  const form = new FormData();
  form.append('device_id', deviceId);
  form.append('old_cert_name', oldCertName);
  form.append('partition', partition);
  const { data } = await apiClient.post('/deployments/preview', form);
  return data;
}

export async function confirmDeployment(deviceId, oldCertName, newObjectName, chainName = 'DigiCert_Global_G2_TLS_RSA_SHA256_2020_CA1', selectedProfiles = null) {
  const form = new FormData();
  form.append('device_id', deviceId);
  form.append('old_cert_name', oldCertName);
  form.append('new_object_name', newObjectName);
  form.append('chain_name', chainName);
  if (selectedProfiles) {
    form.append('selected_profiles', JSON.stringify(selectedProfiles));
  }
  const { data } = await apiClient.post('/deployments/confirm', form);
  return data;
}

export async function verifyInstalledCert(deviceId, objectName) {
  const { data } = await apiClient.get(`/certificates/devices/${deviceId}/verify/${objectName}`);
  return data; // {version, san:[], serial, not_after, subject, issuer}
}

export async function validateDeployment(payload) {
  // payload: { mode: 'pfx'|'pem', pfxFile?, pfxPassword?, certPem?, keyPem?, chainPem? }
  const form = new FormData();
  form.append('mode', payload.mode);
  if (payload.mode === 'pfx') {
    if (payload.pfxFile) form.append('pfx_file', payload.pfxFile);
    if (payload.pfxPassword) form.append('pfx_password', payload.pfxPassword);
  } else {
    if (payload.certPem) form.append('cert_pem', payload.certPem);
    if (payload.keyPem) form.append('key_pem', payload.keyPem);
    if (payload.chainPem) form.append('chain_pem', payload.chainPem);
  }
  const { data } = await apiClient.post('/deployments/validate', form);
  return data; // { parsed: {cn, san[], not_after}, warnings: [] }
}

export async function executeDeployment(opts) {
  // opts: { deviceId, oldCertName, mode, pfxFile?, pfxPassword?, certPem?, keyPem?, installChainFromPfx?, chainName?, updateProfiles?, selectedProfiles?, dryRun? }
  const form = new FormData();
  form.append('device_id', opts.deviceId);
  form.append('old_cert_name', opts.oldCertName || '');
  form.append('mode', opts.mode);
  if (opts.mode === 'pfx') {
    if (opts.pfxFile) form.append('pfx_file', opts.pfxFile);
    if (opts.pfxPassword) form.append('pfx_password', opts.pfxPassword);
    if (opts.installChainFromPfx != null) form.append('install_chain_from_pfx', String(!!opts.installChainFromPfx));
  } else {
    if (opts.certPem) form.append('cert_pem', opts.certPem);
    if (opts.keyPem) form.append('key_pem', opts.keyPem);
  }
  if (opts.chainName) form.append('chain_name', opts.chainName);
  if (opts.updateProfiles != null) form.append('update_profiles', String(!!opts.updateProfiles));
  if (opts.selectedProfiles) form.append('selected_profiles', JSON.stringify(opts.selectedProfiles));
  if (opts.dryRun != null) form.append('dry_run', String(!!opts.dryRun));
  const { data } = await apiClient.post('/deployments/execute', form);
  return data;
}

export async function planDeployment(opts) {
  // opts: { deviceId, oldCertName, mode, pfxFile?, pfxPassword?, certPem?, keyPem?, installChainFromPfx?, chainName?, updateProfiles?, selectedProfiles?, dryRun? }
  const form = new FormData();
  form.append('device_id', opts.deviceId);
  form.append('old_cert_name', opts.oldCertName || '');
  form.append('mode', opts.mode);
  if (opts.mode === 'pfx') {
    if (opts.pfxFile) form.append('pfx_file', opts.pfxFile);
    if (opts.pfxPassword) form.append('pfx_password', opts.pfxPassword);
    if (opts.installChainFromPfx != null) form.append('install_chain_from_pfx', String(!!opts.installChainFromPfx));
  } else {
    if (opts.certPem) form.append('cert_pem', opts.certPem);
    if (opts.keyPem) form.append('key_pem', opts.keyPem);
  }
  if (opts.chainName) form.append('chain_name', opts.chainName);
  if (opts.updateProfiles != null) form.append('update_profiles', String(!!opts.updateProfiles));
  if (opts.selectedProfiles) form.append('selected_profiles', JSON.stringify(opts.selectedProfiles));
  if (opts.dryRun != null) form.append('dry_run', String(!!opts.dryRun));
  const { data } = await apiClient.post('/deployments/plan', form);
  return data;
}