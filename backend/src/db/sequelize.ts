import pg from 'pg';
import { Sequelize } from 'sequelize';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

/**
 * Single Sequelize instance. `dialectModule` is passed explicitly so serverless bundlers
 * (Vercel) include `pg`; Sequelize would otherwise require it dynamically.
 */
export const sequelize = new Sequelize(env.DATABASE_URL, {
  dialect: 'postgres',
  dialectModule: pg,
  dialectOptions: env.DATABASE_SSL ? { ssl: { require: true, rejectUnauthorized: true } } : {},
  pool: { max: env.DATABASE_POOL_MAX, min: 0, idle: 10_000, acquire: 30_000 },
  define: { underscored: true },
  timezone: '+00:00',
  logging: (sql) => logger.trace({ sql }, 'sql'),
});
