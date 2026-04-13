import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendTarget = process.env.VITE_DEV_PROXY_TARGET || 'http://localhost:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/health': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/dev/auth/token': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/v3/api-docs': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/swagger-ui.html': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/swagger-ui': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/testing/setup.ts',
    css: true,
  },
})
