/**
 * `seed.ts` loads required reference data (safe in every environment).
 * `seed.ts --demo` also loads fake demo staff and patients; needs DEMO_SEED_PASSWORD.
 */
import { seedDemo } from '../src/db/seeders/demo.js';
import { seedRequired } from '../src/db/seeders/required.js';
import { sequelize } from '../src/db/sequelize.js';

await seedRequired();
process.stdout.write('Required data seeded (permissions, roles, branches, settings)\n');

if (process.argv.includes('--demo')) {
  const password = process.env.DEMO_SEED_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error('Set DEMO_SEED_PASSWORD (12+ characters) in backend/.env to seed demo users');
  }
  await seedDemo(password);
  process.stdout.write('Demo data seeded: demo.<role>@expressions.test, Demo Patient 01–05\n');
}

await sequelize.close();
