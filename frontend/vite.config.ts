import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  server: {
    port: 5173,
    // Same-origin API in dev, mirroring the Vercel rewrite in production.
    proxy: { '/api': 'http://localhost:4000' },
  },
});
