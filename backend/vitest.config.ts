import { tmpdir } from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

/** Test-only values; the suite runs against a throwaway embedded Postgres on its own port. */
const testEnv = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgres://edc_test:edc_test_pw@localhost:54339/edc_test',
  APP_ORIGIN: 'http://localhost:5173',
  TRUST_PROXY: 'true',
  JWT_ACCESS_SECRET: 'test-access-secret-that-is-long-enough-0123456789',
  DATA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  HMAC_SECRET: 'test-hmac-secret-that-is-long-enough-0123456789',
  ENFORCE_STAFF_2FA: 'true',
  OTP_DELIVERY: 'log',
  EMAIL_DELIVERY: 'log',
  FILE_STORAGE: 'local',
  FILE_STORAGE_DIR: path.join(tmpdir(), 'edc-test-files'),
};

export default defineConfig({
  test: {
    env: testEnv,
    globalSetup: ['./test/globalSetup.ts'],
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 120_000,
    pool: 'forks',
  },
});

export { testEnv };
