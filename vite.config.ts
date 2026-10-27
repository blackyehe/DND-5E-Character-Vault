import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    proxy: {
      '/api/2014': 'http://localhost:3000',
      // Preserve the browser-facing host so the API's origin check stays valid.
      '/api': { target: 'http://localhost:4000', changeOrigin: false },
    },
  },
})
