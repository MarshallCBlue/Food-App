import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// This file tells Vite (the tool that turns our code into files Netlify can
// serve) that we are building a React app, and — via VitePWA — that it
// should also produce a web app manifest and a service worker so the app
// can be properly installed rather than just bookmarked.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Applies a new version automatically on the next load rather than
      // needing an "update available" prompt built into the app.
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Fridge Magnet',
        short_name: 'Fridge Magnet',
        description: "Shopping list, inventory, and one tap on the fridge.",
        start_url: '/',
        display: 'standalone',
        background_color: '#f4f8f5',
        theme_color: '#2f6f4f',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Every screen in this app reads live data from Supabase — there's
        // no offline mode yet (that's a possible later step), so the
        // service worker only ever precaches the app's own JS/CSS/HTML
        // shell. It deliberately has no runtime-caching rules for Supabase
        // requests, which would otherwise risk serving stale data.
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
