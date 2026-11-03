import { z } from 'zod';
import { ROLE_KEYS } from '../permissions.js';
import { BRANCH_IDS } from './booking.js';
import { emailSchema, phoneSchema } from './common.js';

/** Request bodies for the admin CRM: patients, clinical records, plans, calendar and staff. */

const isoDate = z.iso.date();
const optionalEmail = z.union([z.literal(''), emailSchema]).optional();

export const GENDERS = ['female', 'male', 'other', 'undisclosed'] as const;
export const PATIENT_SOURCES = [
  'website',
  'google',
  'instagram',
  'facebook',
  'referral',
  'walk_in',
  'whatsapp',
  'phone',
  'other',
] as const;

export const patientCreateBody = z.object({
  name: z.string().trim().min(2, 'Enter the patient’s name').max(120),
  phone: phoneSchema,
  email: optionalEmail,
  dateOfBirth: z.union([z.literal(''), isoDate]).optional(),
  gender: z.enum(GENDERS).optional(),
  homeBranch: z.enum(BRANCH_IDS).optional(),
  source: z.enum(PATIENT_SOURCES).optional(),
});

export const patientUpdateBody = patientCreateBody.partial().extend({
  nextRecallOn: isoDate.nullable().optional(),
  recallNote: z.string().trim().max(120).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
});

export const medicalHistoryBody = z.object({
  allergies: z.string().trim().max(500).default(''),
  conditions: z.string().trim().max(1000).default(''),
  medications: z.string().trim().max(1000).default(''),
  notes: z.string().trim().max(2000).default(''),
});

export const clinicalNoteBody = z.object({
  body: z.string().trim().min(1, 'Write the note').max(5000),
  appointmentId: z.uuid().optional(),
});

export const PLAN_STATUS_VALUES = [
  'proposed',
  'accepted',
  'in_progress',
  'completed',
  'declined',
] as const;
export const PLAN_ITEM_STATUS_VALUES = ['planned', 'done', 'cancelled'] as const;

const planItem = z.object({
  treatment: z.string().trim().min(1, 'Name the treatment').max(80),
  tooth: z.string().trim().max(40).default(''),
  sessions: z.number().int().min(1).max(20).default(1),
});

export const treatmentPlanBody = z.object({
  title: z.string().trim().min(1, 'Give the plan a title').max(120),
  notes: z.string().trim().max(2000).default(''),
  items: z.array(planItem).min(1, 'Add at least one treatment').max(30),
});

export const treatmentPlanUpdateBody = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  status: z.enum(PLAN_STATUS_VALUES).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const planItemUpdateBody = z.object({ status: z.enum(PLAN_ITEM_STATUS_VALUES) });

export const STAFF_APPOINTMENT_SOURCES = ['phone', 'walk_in', 'whatsapp', 'admin'] as const;

/** Front desk booking: confirmed straight away, may exceed the online grid (e.g. walk-ins). */
export const staffAppointmentBody = z.object({
  patientId: z.uuid(),
  branch: z.enum(BRANCH_IDS),
  startAt: z.iso.datetime({ offset: true }),
  durationMinutes: z.number().int().min(10).max(240),
  reason: z.string().trim().min(1).max(60),
  notes: z.string().trim().max(500).default(''),
  dentistId: z.uuid().nullable().default(null),
  source: z.enum(STAFF_APPOINTMENT_SOURCES).default('phone'),
  /** Book even if the time is already full (double-booking a chair on purpose). */
  force: z.boolean().default(false),
});

export const appointmentMoveBody = z.object({
  startAt: z.iso.datetime({ offset: true }),
  durationMinutes: z.number().int().min(10).max(240).optional(),
  dentistId: z.uuid().nullable().optional(),
  force: z.boolean().default(false),
});

export const staffUpdateBody = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: phoneSchema.nullable().optional(),
  role: z.enum(ROLE_KEYS).optional(),
  status: z.enum(['active', 'disabled']).optional(),
});

export type PatientCreateBody = z.infer<typeof patientCreateBody>;
export type PatientUpdateBody = z.infer<typeof patientUpdateBody>;
export type MedicalHistory = z.infer<typeof medicalHistoryBody>;
export type TreatmentPlanBody = z.input<typeof treatmentPlanBody>;
export type StaffAppointmentBody = z.input<typeof staffAppointmentBody>;
