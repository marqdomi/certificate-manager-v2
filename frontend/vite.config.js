import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load envs from .env / .env.local; Vite only exposes vars prefixed with VITE_
  const env = loadEnv(mode, process.cwd(), '')

  // Resolve API base.
  // In Docker (NODE_ENV !== 'development' locally), use 'backend' hostname.
  // When running npm run dev locally (outside Docker), use localhost.
  const resolveApiBase = () => {
    const raw = env.VITE_API_BASE_URL || ''
    
    // If explicitly set and not empty, use it directly
    if (raw && raw !== 'backend') {
      return raw
    }
    
    // Check if we're running inside Docker (backend hostname works)
    // or locally (need localhost)
    const isInsideDocker = env.RUNNING_IN_DOCKER === 'true'
    
    if (isInsideDocker) {
      return 'http://backend:8000'
    }
    
    // Default to localhost for local development
    return 'http://localhost:8000'
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
      __APP_NAME__: JSON.stringify(env.VITE_APP_NAME || 'Certificate Management Tool'),
      __APP_VERSION__: JSON.stringify(env.VITE_APP_VERSION || '2.0.0'),
    },
  }
})
