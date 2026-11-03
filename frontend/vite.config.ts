import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  // The E2E suite uses its own dependency cache so it never fights a running `pnpm dev`.
  ...(process.env.VITE_CACHE_DIR ? { cacheDir: process.env.VITE_CACHE_DIR } : {}),
  // Pre-bundle UI dependencies up front: if Vite discovers one mid-session it re-bundles,
  // and pages can end up with two copies of React ("Invalid hook call").
  optimizeDeps: {
    include: [
      // The workspace package itself is served from its build output so changes show up at
      // once; only its dependency is pre-bundled.
      '@edc/shared > zod',
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
    proxy: { '/api': process.env.API_ORIGIN ?? 'http://localhost:4000' },
  },
});
