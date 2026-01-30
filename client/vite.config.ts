import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import { viteSingleFile } from 'vite-plugin-singlefile'
import tailwindcss from 'tailwindcss'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  envDir: '..',
  envPrefix: ['VITE_', 'TRANSPORTS'],
  plugins: [
    react(),
    tailwindcss(), 
    viteSingleFile(),
    legacy({
      targets: ['defaults', 'not IE 11', 'Android >= 7'],
    }),
     alias: {
      "@": path.resolve(__dirname, "src"),
    },
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:8080',
        ws: true,
      },
      '/device-check': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  }
})
