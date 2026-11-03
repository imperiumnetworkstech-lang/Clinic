import { Lead, Location, OtpChallenge, Patient, PatientConsent } from './clinic.js';
import {
  AuditLog,
  Permission,
  RefreshToken,
  Role,
  RolePermission,
  User,
  Setting,
} from './identity.js';

Role.hasMany(User, { foreignKey: 'roleId', as: 'users' });
User.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });

Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: 'roleId',
  otherKey: 'permissionKey',
  as: 'permissions',
});
Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: 'permissionKey',
  otherKey: 'roleId',
  as: 'roles',
});

Setting.belongsTo(User, { foreignKey: 'updatedBy', as: 'editor' });

Location.hasMany(Patient, { foreignKey: 'homeLocationId', as: 'patients' });
Patient.belongsTo(Location, { foreignKey: 'homeLocationId', as: 'homeLocation' });

Patient.hasMany(PatientConsent, { foreignKey: 'patientId', as: 'consents' });
PatientConsent.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });
PatientConsent.belongsTo(User, { foreignKey: 'recordedBy', as: 'recorder' });

Lead.belongsTo(Location, { foreignKey: 'locationId', as: 'location' });
Lead.belongsTo(User, { foreignKey: 'assignedTo', as: 'assignee' });
Lead.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });

export type { ActorType, SubjectType, UserStatus } from './identity.js';
export type {
  AppointmentRequestDetails,
  ConsentType,
  DayKey,
  Gender,
  LeadSource,
  LeadStatus,
  OpeningHours,
  PatientSource,
} from './clinic.js';

export {
  AuditLog,
  Lead,
  Location,
  OtpChallenge,
  Patient,
  PatientConsent,
  Permission,
  RefreshToken,
  Role,
  RolePermission,
  Setting,
  User,
};
