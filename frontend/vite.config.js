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
        },
        '/docs': {
          target: apiBase,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: true,
      port: 5173,
    },
    define: {
      __API_BASE__: JSON.stringify(apiBase),
    },
  }
})
