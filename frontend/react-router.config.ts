import type { Config } from '@react-router/dev/config';
import { vercelPreset } from '@vercel/react-router/vite';

export default {
  // Public pages are server-rendered on every request (CDN-cached), per BUILD_PLAN decision D1.
  ssr: true,
  future: { v8_trailingSlashAwareDataRequests: true },
  presets: [vercelPreset()],
} satisfies Config;
