import path from 'node:path'
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  // `npm run build:pages` builds for https://pappysan1.github.io/loopscoop/
  base: mode === 'pages' ? '/loopscoop/' : '/',
  server: {
    port: 3000,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
        // Write the app shell as index.html so any static host (GitHub Pages) serves it.
        prerender: { outputPath: '/index' },
      },
    }),
    viteReact(),
  ],
}))
