import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/PokeRand/', // 👈 IMPORTANTE: El nombre de tu repositorio entre barras
  build: {
    chunkSizeWarningLimit: 800,
  },
})