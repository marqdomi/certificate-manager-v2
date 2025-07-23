// frontend/src/services/api.js

import axios from 'axios';
import { authProvider } from '../pages/LoginPage';

const apiClient = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
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