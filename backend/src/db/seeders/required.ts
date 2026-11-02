import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_ROLES, PERMISSIONS, ROLE_KEYS } from '@edc/shared';
import { Location, Permission, Role, RolePermission, Setting } from '../../models/index.js';
import { sequelize } from '../sequelize.js';

interface ClinicLocation {
  id: string;
  name: string;
  addressOnWebsite: string;
  addressOnGoogle?: string;
  postalCode?: string;
  locality: string;
  region: string;
  country: string;
  geo: { lat: number; lng: number };
  googlePlaceId: string;
  phone: string;
}

/** Returns the value unless it is missing or a `[[CLIENT TO …]]` placeholder. */
const confirmed = (value: string | undefined) => (value && !value.startsWith('[[') ? value : null);

async function readClinic(): Promise<{ locations: ClinicLocation[]; whatsapp: string }> {
  const file = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../../content/clinic.json',
  );
  const clinic = JSON.parse(await readFile(file, 'utf8')) as {
    locations: ClinicLocation[];
    clinic: { contact: { whatsapp: string } };
  };
  return { locations: clinic.locations, whatsapp: clinic.clinic.contact.whatsapp };
}

/**
 * Idempotent reference data every environment needs: permission catalogue, system roles with
 * their default permissions (only applied when a role is first created, so owner edits stick),
 * the two clinic branches from content/clinic.json, and default settings.
 */
export async function seedRequired(): Promise<void> {
  const { locations, whatsapp } = await readClinic();

  await sequelize.transaction(async (transaction) => {
    for (const [key, description] of Object.entries(PERMISSIONS)) {
      await Permission.upsert({ key, description }, { transaction });
    }

    for (const key of ROLE_KEYS) {
      const definition = DEFAULT_ROLES[key];
      const [role, created] = await Role.findOrCreate({
        where: { key },
        defaults: {
          key,
          name: definition.name,
          description: definition.description,
          requiresTwoFactor: definition.requiresTwoFactor,
          isSystem: true,
        },
        transaction,
      });
      if (created || key === 'super_admin') {
        // The owner role always holds every permission, including ones added later.
        await RolePermission.bulkCreate(
          definition.permissions.map((permissionKey) => ({ roleId: role.id, permissionKey })),
          { ignoreDuplicates: true, transaction },
        );
      }
    }

    for (const [index, location] of locations.entries()) {
      const address = confirmed(location.addressOnGoogle) ?? location.addressOnWebsite;
      await Location.findOrCreate({
        where: { slug: location.id },
        defaults: {
          slug: location.id,
          name: location.name,
          addressLine: address,
          locality: location.locality,
          region: location.region,
          postalCode: confirmed(location.postalCode),
          country: location.country,
          latitude: String(location.geo.lat),
          longitude: String(location.geo.lng),
          googlePlaceId: location.googlePlaceId,
          phone: location.phone,
          whatsapp,
          sortOrder: index,
        },
        transaction,
      });
    }

    const defaults: Record<string, unknown> = {
      'messaging.quiet_hours': { start: '21:00', end: '08:00', timezone: 'Asia/Kolkata' },
      'website.show_prices': false,
    };
    for (const [key, value] of Object.entries(defaults)) {
      await Setting.findOrCreate({ where: { key }, defaults: { key, value }, transaction });
    }
  });
}
