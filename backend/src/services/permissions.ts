import type { PermissionKey } from '@edc/shared';
import { RolePermission } from '../models/index.js';

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { permissions: Set<PermissionKey>; expiresAt: number }>();

/**
 * Permissions for a role, cached briefly per instance. Role edits take effect within the TTL
 * everywhere, and immediately on the instance that made the change (via `invalidate`).
 */
export async function permissionsForRole(roleId: string): Promise<Set<PermissionKey>> {
  const hit = cache.get(roleId);
  if (hit && hit.expiresAt > Date.now()) return hit.permissions;

  const rows = await RolePermission.findAll({ where: { roleId }, attributes: ['permissionKey'] });
  const permissions = new Set(rows.map((row) => row.permissionKey as PermissionKey));
  cache.set(roleId, { permissions, expiresAt: Date.now() + CACHE_TTL_MS });
  return permissions;
}

export function invalidateRolePermissions(roleId?: string): void {
  if (roleId) cache.delete(roleId);
  else cache.clear();
}
