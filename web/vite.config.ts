import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Сборка кладётся в ../app — GitHub Pages (legacy, из корня main) раздаёт её по /app/.
// Ассеты (3D-модели, packshot'ы) лежат в public/ и копируются в выходную папку как есть.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../app',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
})
