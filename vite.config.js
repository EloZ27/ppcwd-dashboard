import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  server: {
    host: true, // Listen on all local IP addresses (0.0.0.0) for mobile device preview
    port: 5173,
    proxy: {
      // Proxy API requests to the production backend so real-time dashboard data loads during local dev
      '/api': {
        target: 'https://ppcwd-dashboard.vercel.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        uploader: fileURLToPath(new URL('uploader.html', import.meta.url)),
      },
    },
  },
});

