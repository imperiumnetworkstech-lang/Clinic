import { z } from 'zod';
import { phoneSchema } from './common.js';

/**
 * Appointment request from the website. The clinic confirms every request manually (client
 * decision: same flow as the old site, front desk replies on WhatsApp/phone), so this is a
 * request with a preferred day and time of day, not a reserved slot.
 */
export const BRANCH_IDS = ['mapusa', 'candolim'] as const;
export const TIME_OF_DAY = ['morning', 'afternoon', 'evening', 'any'] as const;
export const PATIENT_FOR = ['me', 'child', 'someone_else'] as const;

export const TIME_OF_DAY_LABELS: Record<(typeof TIME_OF_DAY)[number], string> = {
  morning: 'Morning (10 am – 1 pm)',
  afternoon: 'Afternoon (1 pm – 5 pm)',
  evening: 'Evening (5 pm – 8 pm)',
  any: 'Any time',
};

export const PATIENT_FOR_LABELS: Record<(typeof PATIENT_FOR)[number], string> = {
  me: 'Myself',
  child: 'My child',
  someone_else: 'Someone else',
};

/** Version of the consent wording shown on the form; stored with every request. */
export const BOOKING_CONSENT_VERSION = 'booking-2026-11-03';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date');

export const appointmentRequestBody = z.object({
  /** Treatment slug, or "checkup" / "not-sure". */
  reason: z.string().trim().min(1, 'Choose what the visit is for').max(60),
  branch: z.enum(BRANCH_IDS, { message: 'Choose a clinic' }),
  preferredDate: isoDate,
  timeOfDay: z.enum(TIME_OF_DAY, { message: 'Choose a time of day' }),
  patientFor: z.enum(PATIENT_FOR),
  name: z.string().trim().min(2, 'Enter your name').max(120),
  phone: phoneSchema,
  notes: z.string().trim().max(500, 'Keep it under 500 characters').optional().default(''),
  consent: z.literal(true, { message: 'Please agree so we can contact you' }),
});

export type AppointmentRequestBody = z.infer<typeof appointmentRequestBody>;
export type AppointmentRequestInput = z.input<typeof appointmentRequestBody>;

/** Booking a specific free slot (branches with online booking enabled). */
export const slotBookingBody = z.object({
  reason: z.string().trim().min(1, 'Choose what the visit is for').max(60),
  branch: z.enum(BRANCH_IDS, { message: 'Choose a clinic' }),
  slotStart: z.iso.datetime({ offset: true, message: 'Choose a time' }),
  patientFor: z.enum(PATIENT_FOR),
  name: z.string().trim().min(2, 'Enter your name').max(120),
  phone: phoneSchema,
  /** Optional: lets the patient sign in to the portal with an emailed link. */
  email: z
    .union([z.literal(''), z.email('Enter a valid email address').trim().toLowerCase().max(254)])
    .optional()
    .default(''),
  notes: z.string().trim().max(500, 'Keep it under 500 characters').optional().default(''),
  consent: z.literal(true, { message: 'Please agree so we can contact you' }),
});

export type SlotBookingBody = z.infer<typeof slotBookingBody>;

export interface AvailableSlot {
  /** ISO timestamp of the slot start. */
  start: string;
  /** Local clinic time, e.g. "10:30". */
  time: string;
  available: boolean;
}

export interface AvailabilityDay {
  date: string;
  open: boolean;
  availableCount: number;
}
