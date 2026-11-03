import { tmpdir } from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/** Shared with backend/scripts/e2e-stack.ts, which writes every outgoing email here. */
export const OUTBOX = path.join(tmpdir(), 'edc-e2e-outbox.jsonl');

/** Own ports, so the suite can run while `pnpm dev` (4000/5173) is up. */
const API_PORT = 4100;
export const BASE_URL = 'http://localhost:5174';
process.env.E2E_OUTBOX = OUTBOX;

/**
 * End-to-end flows on a phone-sized Chromium against a throwaway backend (fresh Postgres,
 * fake demo data). Run with `pnpm --filter @edc/frontend e2e`.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: BASE_URL,
    timezoneId: 'Asia/Kolkata',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npx tsx scripts/e2e-stack.ts',
      cwd: '../backend',
      url: `http://localhost:${API_PORT}/health`,
      env: { E2E_OUTBOX: OUTBOX, E2E_API_PORT: String(API_PORT), E2E_WEB_ORIGIN: BASE_URL },
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: 'pipe',
    },
    {
      command: 'npx react-router dev --port 5174 --strictPort --force',
      url: BASE_URL,
      // Published CMS content must show at once, not after the usual one-minute cache.
      env: {
        CONTENT_CACHE_MS: '0',
        API_ORIGIN: `http://localhost:${API_PORT}`,
        VITE_CACHE_DIR: 'node_modules/.vite-e2e',
      },
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
