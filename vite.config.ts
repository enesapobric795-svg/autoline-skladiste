import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/olx-api': {
        target: 'https://api.olx.ba',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/olx-api/, '')
      }
    }
  }
})
