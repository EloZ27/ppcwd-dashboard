import { defineConfig } from 'vite';

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
});

