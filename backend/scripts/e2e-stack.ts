/**
 * Throwaway backend for the Playwright suite (frontend/e2e): a fresh embedded Postgres, all
 * migrations, the required seed plus fake demo users, and the API on :4000. Emails are
 * appended to an outbox file that the tests read instead of being sent. Test use only.
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const E2E_DEMO_PASSWORD = 'e2e-demo-password-0001';

const outbox = process.env.E2E_OUTBOX ?? path.join(tmpdir(), 'edc-e2e-outbox.jsonl');

Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: '4000',
  LOG_LEVEL: 'warn',
  DATABASE_URL: 'postgres://edc_e2e:edc_e2e_pw@localhost:54349/edc_e2e',
  DATABASE_SSL: 'false',
  APP_ORIGIN: 'http://localhost:5173',
  CORS_ORIGINS: 'http://localhost:5173',
  TRUST_PROXY: 'true',
  JWT_ACCESS_SECRET: 'e2e-access-secret-that-is-long-enough-0123456789',
  DATA_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
  HMAC_SECRET: 'e2e-hmac-secret-that-is-long-enough-0123456789',
  // Local visual checks may sign in as the demo owner without an authenticator app.
  ENFORCE_STAFF_2FA: process.env.E2E_STAFF_2FA === 'off' ? 'false' : 'true',
  OTP_DELIVERY: 'log',
  EMAIL_DELIVERY: 'log',
});

const dataDir = path.join(await mkdtemp(path.join(tmpdir(), 'edc-e2e-')), 'pg');
const { startLocalPostgres } = await import('../src/db/embeddedPostgres.js');
const database = await startLocalPostgres({
  databaseUrl: process.env.DATABASE_URL ?? '',
  dataDir,
  persistent: false,
});

const { migrator } = await import('../src/db/migrator.js');
const { seedRequired } = await import('../src/db/seeders/required.js');
const { seedDemo } = await import('../src/db/seeders/demo.js');
await migrator.up();
await seedRequired();
await seedDemo(E2E_DEMO_PASSWORD);

const { emailDelivery } = await import('../src/services/emailDelivery.js');
writeFileSync(outbox, '');
emailDelivery.send = async (message) => {
  appendFileSync(outbox, `${JSON.stringify(message)}\n`);
};

const { createApp } = await import('../src/app.js');
const { sequelize } = await import('../src/db/sequelize.js');
const server = createApp().listen(4000, () => {
  process.stdout.write('E2E API listening on http://localhost:4000\n');
});

const stop = async () => {
  server.close();
  await sequelize.close();
  await database.stop();
  await rm(path.dirname(dataDir), { recursive: true, force: true });
  process.exit(0);
};
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
