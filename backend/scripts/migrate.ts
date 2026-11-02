/** `migrate.ts up` applies pending migrations; `migrate.ts down` reverts the latest one. */
import { migrator } from '../src/db/migrator.js';
import { sequelize } from '../src/db/sequelize.js';

const direction = process.argv[2] ?? 'up';
if (direction !== 'up' && direction !== 'down') throw new Error('Usage: migrate.ts up|down');

const done = direction === 'up' ? await migrator.up() : await migrator.down();
process.stdout.write(
  done.length
    ? `${direction === 'up' ? 'Applied' : 'Reverted'}: ${done.map((m) => m.name).join(', ')}\n`
    : 'Nothing to do\n',
);
await sequelize.close();
