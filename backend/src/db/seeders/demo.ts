import { ROLE_KEYS } from '@edc/shared';
import { hashPassword } from '../../auth/password.js';
import { Location, Patient, Role, User } from '../../models/index.js';
import { sequelize } from '../sequelize.js';

/**
 * Clearly fake development data. Refuses to run in production. Staff use the reserved
 * `.test` domain; patient phones use Ofcom's +44 7700 900xxx range reserved for fiction, so
 * no real person can ever receive a message from demo data.
 */
export async function seedDemo(password: string): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo data must never be seeded in production');
  }

  const passwordHash = await hashPassword(password);
  const mapusa = await Location.findOne({ where: { slug: 'mapusa' } });

  await sequelize.transaction(async (transaction) => {
    for (const key of ROLE_KEYS) {
      const role = await Role.findOne({ where: { key }, transaction });
      if (!role) throw new Error(`Run the required seed first (missing role ${key})`);
      await User.findOrCreate({
        where: { email: `demo.${key.replace('_', '-')}@expressions.test` },
        defaults: {
          name: `Demo ${role.name.split(' ')[0]}`,
          email: `demo.${key.replace('_', '-')}@expressions.test`,
          phone: null,
          passwordHash,
          roleId: role.id,
          passwordChangedAt: new Date(),
        },
        transaction,
      });
    }

    for (let n = 1; n <= 5; n += 1) {
      const number = String(n).padStart(2, '0');
      await Patient.findOrCreate({
        where: { name: `Demo Patient ${number}`, isDemo: true },
        defaults: {
          name: `Demo Patient ${number}`,
          // Patients 04 and 05 share a phone, like a parent booking for a child.
          phone: `+447700900${String(Math.min(n, 4)).padStart(3, '0')}`,
          email: null,
          dateOfBirth: null,
          gender: null,
          source: 'other',
          homeLocationId: mapusa?.id ?? null,
          isDemo: true,
        },
        transaction,
      });
    }
  });
}
