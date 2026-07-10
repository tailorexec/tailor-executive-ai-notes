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
      includeAssets: ['favicon.png', 'favicon-48.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Tailor Executive AI Notes',
        short_name: 'Tailor Notes',
        description: 'IA de anotacoes, transcricoes e analise de reunioes',
        // Claro e o tema padrao do app (ThemeProvider.tsx): a splash screen do PWA instalado
        // usa ESTA cor fixa (nao a dinamica do <meta theme-color>, que so existe depois que o
        // JS roda). Deixar preto aqui fazia todo mundo no tema claro (a maioria) ver um flash
        // preto e a barra de status do Android preta brigando com um app branco.
        theme_color: '#FFFFFF',
        background_color: '#FFFFFF',
        display: 'standalone',
        // Safari 16.4+ passou a ler o Web App Manifest tambem para apps adicionados a tela de
        // inicio (antes disso so as meta tags apple-mobile-web-app-* valiam). Sem start_url/
        // scope/id explicitos, o iOS pode ficar em duvida sobre o "modo" do app e reservar uma
        // faixa extra de chrome (o espaco vazio abaixo do cabecalho, como se fosse a barra de
        // endereco) em vez de abrir 100% em tela cheia.
        start_url: '/',
        scope: '/',
        id: '/',
        display_override: ['standalone', 'fullscreen', 'minimal-ui'],
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
        globIgnores: ['**/pdf-*.js', '**/pdf.worker*', '**/mammoth-*.js', '**/jspdf*.js', '**/html2canvas*.js'],
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
