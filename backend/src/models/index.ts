import { Invoice, InvoiceItem, PatientFile, Payment } from './billing.js';
import { Lead, Location, OtpChallenge, Patient, PatientConsent } from './clinic.js';
import { ClinicalNote, TreatmentPlan, TreatmentPlanItem } from './clinical.js';
import { CmsEntry, CmsRevision } from './cms.js';
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
Appointment.belongsTo(User, { foreignKey: 'dentistId', as: 'dentist' });

Patient.hasMany(ClinicalNote, { foreignKey: 'patientId', as: 'clinicalNotes' });
ClinicalNote.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });
ClinicalNote.belongsTo(User, { foreignKey: 'authorId', as: 'author' });
ClinicalNote.belongsTo(Appointment, { foreignKey: 'appointmentId', as: 'appointment' });
Patient.hasMany(TreatmentPlan, { foreignKey: 'patientId', as: 'treatmentPlans' });
TreatmentPlan.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });
TreatmentPlan.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
TreatmentPlan.hasMany(TreatmentPlanItem, {
  foreignKey: 'planId',
  as: 'items',
  onDelete: 'CASCADE',
});
TreatmentPlanItem.belongsTo(TreatmentPlan, { foreignKey: 'planId', as: 'plan' });

Patient.hasMany(Invoice, { foreignKey: 'patientId', as: 'invoices' });
Invoice.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });
Invoice.belongsTo(Location, { foreignKey: 'locationId', as: 'location' });
Invoice.belongsTo(Appointment, { foreignKey: 'appointmentId', as: 'appointment' });
Invoice.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Invoice.hasMany(InvoiceItem, { foreignKey: 'invoiceId', as: 'items', onDelete: 'CASCADE' });
InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'invoice' });
Invoice.hasMany(Payment, { foreignKey: 'invoiceId', as: 'payments' });
Payment.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'invoice' });
Payment.belongsTo(User, { foreignKey: 'receivedBy', as: 'receiver' });
Patient.hasMany(PatientFile, { foreignKey: 'patientId', as: 'files' });
PatientFile.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });
PatientFile.belongsTo(User, { foreignKey: 'uploadedBy', as: 'uploader' });

CmsEntry.hasMany(CmsRevision, { foreignKey: 'entryId', as: 'revisions', onDelete: 'CASCADE' });
CmsRevision.belongsTo(CmsEntry, { foreignKey: 'entryId', as: 'entry' });
CmsRevision.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });

export type { ActorType, SubjectType, UserStatus } from './identity.js';
export type { AppointmentSource, AppointmentStatus } from './scheduling.js';
export { PLAN_ITEM_STATUSES, PLAN_STATUSES } from './clinical.js';
export { FILE_KINDS, PAYMENT_METHODS } from './billing.js';
export type { FileKind, PaymentMethod } from './billing.js';
export type { CmsAction } from './cms.js';
export type { PlanItemStatus, PlanStatus } from './clinical.js';
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
  ClinicalNote,
  CmsEntry,
  CmsRevision,
  Invoice,
  InvoiceItem,
  PatientFile,
  Payment,
  TreatmentPlan,
  TreatmentPlanItem,
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
