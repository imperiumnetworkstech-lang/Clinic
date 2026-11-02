/**
 * Permission catalogue and default role matrix.
 *
 * Keys are stable identifiers stored in the database; descriptions are shown in the admin
 * role editor. The seeded matrix below is only the starting point — owners can change
 * role permissions from the admin panel later.
 */
export const PERMISSIONS = {
  'dashboard.read': 'View dashboard analytics',
  'appointments.read': 'View appointments and calendars',
  'appointments.write': 'Create, reschedule and cancel appointments',
  'patients.read': 'View patient profiles and visit timeline',
  'patients.write': 'Register and edit patient demographics',
  'patients.export': 'Import and export patient lists',
  'clinical.read': 'View clinical notes, medical history and files',
  'clinical.write': 'Write clinical notes, treatment plans and upload files',
  'billing.read': 'View invoices and payments',
  'billing.write': 'Create invoices and record payments',
  'leads.read': 'View the enquiries inbox',
  'leads.write': 'Update and convert enquiries',
  'messaging.send': 'Send patient messages and reminders',
  'messaging.manage': 'Edit message templates and automation rules',
  'cms.write': 'Edit website content as drafts',
  'cms.publish': 'Publish website content',
  'cms.review': 'Approve medical content (doctor review)',
  'catalogue.write': 'Manage treatments catalogue',
  'staff.read': 'View staff',
  'staff.write': 'Invite, edit and deactivate staff',
  'roles.manage': 'Change role permissions',
  'settings.write': 'Change clinic settings, hours and holidays',
  'audit.read': 'View the audit log',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

export const ROLE_KEYS = ['super_admin', 'doctor', 'receptionist', 'assistant'] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export interface RoleDefinition {
  name: string;
  description: string;
  /** Roles that must use TOTP two-factor authentication. */
  requiresTwoFactor: boolean;
  permissions: readonly PermissionKey[];
}

export const DEFAULT_ROLES: Record<RoleKey, RoleDefinition> = {
  super_admin: {
    name: 'Super Admin / Owner',
    description: 'Full access, including staff, roles, billing settings and audit log.',
    requiresTwoFactor: true,
    permissions: PERMISSION_KEYS,
  },
  doctor: {
    name: 'Doctor',
    description: 'Own schedule and patients, clinical records, treatment plans, content review.',
    requiresTwoFactor: true,
    permissions: [
      'dashboard.read',
      'appointments.read',
      'appointments.write',
      'patients.read',
      'patients.write',
      'clinical.read',
      'clinical.write',
      'billing.read',
      'messaging.send',
      'cms.write',
      'cms.review',
    ],
  },
  receptionist: {
    name: 'Receptionist / Front desk',
    description: 'Appointments, patient registration, reminders, enquiries and payments.',
    requiresTwoFactor: false,
    permissions: [
      'dashboard.read',
      'appointments.read',
      'appointments.write',
      'patients.read',
      'patients.write',
      'billing.read',
      'billing.write',
      'leads.read',
      'leads.write',
      'messaging.send',
    ],
  },
  assistant: {
    name: 'Assistant',
    description: 'Read-only view of the day schedule and patient basics.',
    requiresTwoFactor: false,
    permissions: ['appointments.read', 'patients.read'],
  },
};
