import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  // Pre-bundle UI dependencies up front: if Vite discovers one mid-session it re-bundles,
  // and pages can end up with two copies of React ("Invalid hook call").
  optimizeDeps: {
    include: [
      '@radix-ui/react-accordion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-navigation-menu',
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
      'lucide-react',
    ],
  },
  server: {
    port: 5173,
    // Same-origin API in dev, mirroring the Vercel rewrite in production.
    proxy: { '/api': 'http://localhost:4000' },
  },
});
