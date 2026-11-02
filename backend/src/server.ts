import { createApp } from './app.js';
import { env } from './config/env.js';
import { sequelize } from './db/sequelize.js';
import { logger } from './lib/logger.js';

const server = createApp().listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close();
  await sequelize.close();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
