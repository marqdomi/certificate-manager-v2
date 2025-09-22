import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load envs from .env / .env.local; Vite only exposes vars prefixed with VITE_
  const env = loadEnv(mode, process.cwd(), '')

  // Resolve API base.
  // If VITE_API_BASE_URL is unset OR points to localhost/127.0.0.1 (which breaks inside Docker),
  // fall back to the docker service name "backend".
  const resolveApiBase = () => {
    const raw = env.VITE_API_BASE_URL || ''
    const isLocalHost =
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(raw) ||
      raw === 'localhost' ||
      raw === '127.0.0.1'
    if (!raw || isLocalHost) return 'http://backend:8000'
    return raw
  }
  const apiBase = resolveApiBase()

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': {
          target: apiBase,
          changeOrigin: true,
          secure: false,  // Ignore SSL certificate errors
          configure: (proxy, options) => {
            proxy.on('error', (err, req, res) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log('Sending Request to the Target:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, res) => {
              console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
            });
          },
        },
        '/docs': {
          target: apiBase,
          changeOrigin: true,
          secure: false,  // Ignore SSL certificate errors
        },
      },
    },
    preview: {
      host: true,
      port: 5173,
    },
    define: {
      __API_BASE__: JSON.stringify(apiBase),
      __APP_NAME__: JSON.stringify(env.VITE_APP_NAME || 'Certificate Management Tool'),
      __APP_VERSION__: JSON.stringify(env.VITE_APP_VERSION || '2.0.0'),
    },
  }
})
