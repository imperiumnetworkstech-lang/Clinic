import type { PermissionKey } from '@edc/shared';
import type { NextFunction, Request, Response } from 'express';
import { isFamilyActive, verifyAccessToken } from '../auth/tokens.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { Role, User } from '../models/index.js';
import { permissionsForRole } from '../services/permissions.js';
import type { StaffPrincipal } from '../types/express.js';

function bearer(req: Request): string {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) throw unauthorized();
  return header.slice('Bearer '.length).trim();
}

/**
 * Verifies the access token and re-checks the account and session on every request, so a
 * deactivated user or a logged-out session loses access immediately rather than at expiry.
 */
export async function requireStaff(req: Request, _res: Response, next: NextFunction) {
  const claims = verifyAccessToken(bearer(req));
  if (claims.typ !== 'staff') throw forbidden();

  const [user, active] = await Promise.all([
    User.findByPk(claims.sub, { include: [{ model: Role, as: 'role' }] }),
    isFamilyActive(claims.sid),
  ]);
  if (!user || user.status !== 'active' || !user.role || !active) {
    throw unauthorized('session_revoked', 'Your session has ended. Please sign in again.');
  }

  req.auth = {
    type: 'staff',
    id: user.id,
    roleId: user.role.id,
    role: user.role.key,
    permissions: await permissionsForRole(user.role.id),
    sessionFamily: claims.sid,
  };
  next();
}

export async function requirePatient(req: Request, _res: Response, next: NextFunction) {
  const claims = verifyAccessToken(bearer(req));
  if (claims.typ !== 'patient') throw forbidden();
  if (!(await isFamilyActive(claims.sid))) {
    throw unauthorized('session_revoked', 'Your session has ended. Please sign in again.');
  }
  req.auth = { type: 'patient', id: claims.sub, sessionFamily: claims.sid };
  next();
}

export function staffPrincipal(req: Request): StaffPrincipal {
  if (req.auth?.type !== 'staff') throw unauthorized();
  return req.auth;
}

/** Use after `requireStaff`. Passes if the role holds every listed permission. */
export function requirePermission(...required: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const principal = staffPrincipal(req);
    const missing = required.filter((permission) => !principal.permissions.has(permission));
    if (missing.length > 0) throw forbidden('missing_permission', 'Your role cannot do this.');
    next();
  };
}
