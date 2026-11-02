import { existsSync } from 'node:fs';
import EmbeddedPostgres from 'embedded-postgres';

export interface LocalPostgres {
  stop(): Promise<void>;
}

/**
 * Starts a real PostgreSQL server from npm-shipped binaries (no Docker, no system install).
 * Used for local development and the test suite only — production uses Neon.
 */
export async function startLocalPostgres(options: {
  databaseUrl: string;
  dataDir: string;
  persistent: boolean;
  onLog?: (message: string) => void;
}): Promise<LocalPostgres> {
  const url = new URL(options.databaseUrl);
  const database = url.pathname.replace(/^\//, '');
  const server = new EmbeddedPostgres({
    databaseDir: options.dataDir,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    persistent: options.persistent,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: (message) => options.onLog?.(message),
    onError: (error) => options.onLog?.(String(error)),
  });

  if (!existsSync(options.dataDir)) await server.initialise();
  await server.start();

  const client = server.getPgClient('postgres', url.hostname);
  await client.connect();
  try {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (exists.rowCount === 0) await server.createDatabase(database);
  } finally {
    await client.end();
  }

  return { stop: () => server.stop() };
}
