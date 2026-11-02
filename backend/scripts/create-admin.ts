/**
 * Creates the first owner (super admin) account:
 *   pnpm --filter @edc/backend admin:create --name "Dr. Sandeep" --email owner@example.com
 * A strong random password is printed once; the owner must set up 2FA at first sign-in.
 */
import { parseArgs } from 'node:util';
import { createStaffBody } from '@edc/shared';
import { hashPassword } from '../src/auth/password.js';
import { randomToken } from '../src/lib/crypto.js';
import { Role, User } from '../src/models/index.js';
import { sequelize } from '../src/db/sequelize.js';

const { values } = parseArgs({
  options: { name: { type: 'string' }, email: { type: 'string' } },
});

const password = randomToken(18);
const input = createStaffBody.parse({
  name: values.name,
  email: values.email,
  role: 'super_admin',
  password,
});

const role = await Role.findOne({ where: { key: 'super_admin' } });
if (!role) throw new Error('Run `pnpm db:seed` first');
if (await User.findOne({ where: { email: input.email } })) {
  throw new Error(`A user with email ${input.email} already exists`);
}

await User.create({
  name: input.name,
  email: input.email,
  phone: null,
  passwordHash: await hashPassword(password),
  roleId: role.id,
  passwordChangedAt: new Date(),
});
process.stdout.write(
  `Owner account created for ${input.email}\nTemporary password (shown once): ${password}\n`,
);
await sequelize.close();
