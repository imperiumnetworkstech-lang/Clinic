import { Lead, Location, OtpChallenge, Patient, PatientConsent } from './clinic.js';
import { Appointment, Holiday, LocationSchedule, PatientLoginLink } from './scheduling.js';
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

Location.hasOne(LocationSchedule, { foreignKey: 'locationId', as: 'schedule' });
LocationSchedule.belongsTo(Location, { foreignKey: 'locationId', as: 'location' });
LocationSchedule.belongsTo(User, { foreignKey: 'updatedBy', as: 'editor' });
Location.hasMany(Holiday, { foreignKey: 'locationId', as: 'holidays' });
Holiday.belongsTo(Location, { foreignKey: 'locationId', as: 'location' });
Appointment.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });
Appointment.belongsTo(Location, { foreignKey: 'locationId', as: 'location' });
Appointment.belongsTo(User, { foreignKey: 'confirmedBy', as: 'confirmer' });
Appointment.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Patient.hasMany(Appointment, { foreignKey: 'patientId', as: 'appointments' });

export type { ActorType, SubjectType, UserStatus } from './identity.js';
export type { AppointmentSource, AppointmentStatus } from './scheduling.js';
export { APPOINTMENT_STATUSES, SLOT_HOLDING } from './scheduling.js';
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
  Appointment,
  AuditLog,
  Holiday,
  LocationSchedule,
  PatientLoginLink,
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
