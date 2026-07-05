import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Tailor Executive AI Notes',
        short_name: 'Tailor Notes',
        description: 'IA de anotacoes, transcricoes e analise de reunioes',
        theme_color: '#010101',
        background_color: '#010101',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'pt-BR',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Nao precachear os pesados de extracao de PDF/DOCX (carregam sob demanda).
        globIgnores: ['**/pdf-*.js', '**/pdf.worker*', '**/mammoth-*.js'],
        navigateFallbackDenylist: [/^\/api/],
        // Atualiza o app imediatamente ao publicar (evita servir versao antiga em cache).
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
})
