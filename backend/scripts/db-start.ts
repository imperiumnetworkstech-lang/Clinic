/**
 * Runs a local PostgreSQL for development until Ctrl+C. Data persists in backend/.data/pg.
 * Reads DATABASE_URL so the server matches what the API connects to.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLocalPostgres } from '../src/db/embeddedPostgres.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set — copy backend/.env.example to .env');

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.data/pg');
const server = await startLocalPostgres({ databaseUrl, dataDir, persistent: true });
const { hostname, port, pathname } = new URL(databaseUrl);
process.stdout.write(`Postgres running on ${hostname}:${port}${pathname} — Ctrl+C to stop\n`);

const stop = async () => {
  await server.stop();
  process.exit(0);
};
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
setInterval(() => undefined, 60_000);
