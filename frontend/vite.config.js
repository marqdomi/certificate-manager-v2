
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load envs from .env / .env.local; Vite only exposes vars prefixed with VITE_
  const env = loadEnv(mode, process.cwd(), '')

  // Default to local backend if not provided
  const apiBase = env.VITE_API_BASE_URL || 'http://localhost:8000'

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      // Dev-time proxy to avoid CORS while keeping explicit API base
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
