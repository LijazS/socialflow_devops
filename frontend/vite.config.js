import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api/auth': { target: 'http://localhost:8001', changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/auth/, '') },
      '/api/posts': { target: 'http://localhost:8002', changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/posts/, '') },
      '/api/feed':  { target: 'http://localhost:8003', changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/feed/, '') },
      '/api/notifications': { target: 'http://localhost:8004', changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/notifications/, '') },
    }
  }
})
