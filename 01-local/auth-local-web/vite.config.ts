import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Puerto fijo: es el único origen permitido por la política CORS de la API.
    port: 5173,
    strictPort: true,
  },
})
