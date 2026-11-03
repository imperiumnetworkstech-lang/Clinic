import { tmpdir } from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/** Shared with backend/scripts/e2e-stack.ts, which writes every outgoing email here. */
export const OUTBOX = path.join(tmpdir(), 'edc-e2e-outbox.jsonl');
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
    baseURL: 'http://localhost:5173',
    timezoneId: 'Asia/Kolkata',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npx tsx scripts/e2e-stack.ts',
      cwd: '../backend',
      url: 'http://localhost:4000/health',
      env: { E2E_OUTBOX: OUTBOX },
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: 'pipe',
    },
    {
      command: 'npx react-router dev --port 5173 --strictPort',
      url: 'http://localhost:5173',
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
