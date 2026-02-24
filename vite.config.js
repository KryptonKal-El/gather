import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Vite plugin that proxies /api/searchImages to SerpAPI during development.
 * In production, Firebase Hosting rewrites this path to a Cloud Function.
 * @param {string} apiKey - SerpAPI key loaded from environment
 */
const devImageSearchProxy = (apiKey) => ({
  name: 'dev-image-search-proxy',
  configureServer(server) {
    server.middlewares.use('/api/searchImages', async (req, res) => {
      const url = new URL(req.url, 'http://localhost');
      const query = url.searchParams.get('q');
      const count = parseInt(url.searchParams.get('num'), 10) || 8;

      if (!query) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing q param' }));
        return;
      }

      const params = new URLSearchParams({
        engine: 'google_images',
        q: query,
        api_key: apiKey,
        num: String(count),
        safe: 'active',
      });

      try {
        const response = await fetch(`https://serpapi.com/search.json?${params}`);
        const data = await response.json();
        const results = (data.images_results ?? []).slice(0, count).map((img) => ({
          url: img.original,
          thumbnail: img.thumbnail,
          title: img.title ?? '',
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ results }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      devImageSearchProxy(env.VITE_SERPAPI_KEY ?? ''),
      react(),
      VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'icon-64x64.png'],
      manifest: {
        name: 'ShoppingListAI',
        short_name: 'ShopAI',
        description: 'AI-powered grocery shopping list with real-time sync',
        theme_color: '#4caf50',
        background_color: '#fafafa',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|gif|webp|svg)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'external-images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'firebase-storage-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  }
})
