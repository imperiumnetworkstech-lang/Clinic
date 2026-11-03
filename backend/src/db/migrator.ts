import type { QueryInterface } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';
import { logger } from '../lib/logger.js';
import * as m01 from './migrations/20261103-01-identity.js';
import * as m02 from './migrations/20261103-02-clinic-patients.js';
import * as m03 from './migrations/20261103-03-leads.js';
import * as m04 from './migrations/20261103-04-appointments.js';
import * as m05 from './migrations/20261103-05-clinical.js';
import * as m06 from './migrations/20261103-06-billing-files.js';
import { sequelize } from './sequelize.js';

interface MigrationModule {
  up(qi: QueryInterface): Promise<void>;
  down(qi: QueryInterface): Promise<void>;
}

/** Registered explicitly (not globbed) so bundlers can trace every migration. Order matters. */
const MIGRATIONS: Array<[name: string, module: MigrationModule]> = [
  ['20261103-01-identity', m01],
  ['20261103-02-clinic-patients', m02],
  ['20261103-03-leads', m03],
  ['20261103-04-appointments', m04],
  ['20261103-05-clinical', m05],
  ['20261103-06-billing-files', m06],
];

export const migrator = new Umzug<QueryInterface>({
  migrations: MIGRATIONS.map(([name, module]) => ({
    name,
    up: ({ context }) => module.up(context),
    down: ({ context }) => module.down(context),
  })),
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize, tableName: 'schema_migrations' }),
  logger: {
    info: (event) => logger.info(event, 'migration'),
    warn: (event) => logger.warn(event, 'migration'),
    error: (event) => logger.error(event, 'migration'),
    debug: (event) => logger.debug(event, 'migration'),
  },
});
