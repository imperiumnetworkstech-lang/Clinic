import type { PermissionKey, RoleKey } from '@edc/shared';

export interface StaffPrincipal {
  type: 'staff';
  id: string;
  roleId: string;
  role: RoleKey;
  permissions: Set<PermissionKey>;
  sessionFamily: string;
}

export interface PatientPrincipal {
  type: 'patient';
  /** Patients authenticate by phone; one login can see every profile sharing that number. */
  id: string;
  sessionFamily: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: StaffPrincipal | PatientPrincipal;
    }
  }
}
