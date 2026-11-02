import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { testEnv } from '../vitest.config.js';

/**
 * Boots a fresh, non-persistent Postgres for the run, applies migrations and the required
 * seed, and tears it all down afterwards. Modules that read env are imported after it is set.
 */
export default async function setup() {
  Object.assign(process.env, testEnv);
  const dataDir = path.join(await mkdtemp(path.join(tmpdir(), 'edc-test-')), 'pg');

  const { startLocalPostgres } = await import('../src/db/embeddedPostgres.js');
  const server = await startLocalPostgres({
    databaseUrl: testEnv.DATABASE_URL,
    dataDir,
    persistent: false,
  });

  const { migrator } = await import('../src/db/migrator.js');
  const { seedRequired } = await import('../src/db/seeders/required.js');
  const { sequelize } = await import('../src/db/sequelize.js');
  await migrator.up();
  await seedRequired();
  await sequelize.close();

  return async () => {
    await server.stop();
    await rm(path.dirname(dataDir), { recursive: true, force: true });
  };
}
