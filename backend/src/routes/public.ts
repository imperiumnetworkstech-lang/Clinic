import { appointmentRequestBody, BOOKING_CONSENT_VERSION, slotBookingBody } from '@edc/shared';
import { Router } from 'express';
import { z } from 'zod';
import { badRequest, notFound } from '../lib/errors.js';
import { hmac } from '../lib/crypto.js';
import { Lead, Location, LocationSchedule } from '../models/index.js';
import {
  availabilityOverview,
  bookableBranch,
  slotsForDay,
  todayInGoa,
} from '../services/availability.js';
import { bookSlot } from '../services/booking.js';
import { audit } from '../services/audit.js';
import { consume, RULES } from '../services/rateLimit.js';

export const publicRouter = Router();

const MAX_DAYS_AHEAD = 90;

/** Today's date in the clinic's timezone, as YYYY-MM-DD. */
function todayInIndia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Appointment request from the website booking form. Stored as a lead for the front desk;
 * the patient then sends the same details on WhatsApp (manual WhatsApp, client decision).
 */
publicRouter.post('/appointment-requests', async (req, res) => {
  const body = appointmentRequestBody.parse(req.body);
  await consume(RULES.bookingPerIp, req.ip ?? 'unknown');
  await consume(RULES.bookingPerPhone, body.phone);

  const today = todayInIndia();
  if (body.preferredDate < today || body.preferredDate > addDays(today, MAX_DAYS_AHEAD)) {
    throw badRequest('date_out_of_range', `Choose a date within the next ${MAX_DAYS_AHEAD} days.`);
  }

  const location = await Location.findOne({ where: { slug: body.branch, active: true } });
  const lead = await Lead.create({
    source: 'website_booking',
    name: body.name,
    phone: body.phone,
    locationId: location?.id ?? null,
    details: {
      reason: body.reason,
      preferredDate: body.preferredDate,
      timeOfDay: body.timeOfDay,
      patientFor: body.patientFor,
      notes: body.notes,
    },
    consentTextVersion: BOOKING_CONSENT_VERSION,
    consentedAt: new Date(),
    assignedTo: null,
    patientId: null,
    ip: req.ip ?? null,
  });

  await audit(req, {
    action: 'lead.created',
    actorType: 'anonymous',
    actorId: hmac(body.phone),
    entity: 'lead',
    entityId: lead.id,
    meta: { source: 'website_booking', branch: body.branch },
  });

  res.status(201).json({ reference: lead.reference, status: 'received' });
});

/** Branches and whether patients can pick a live slot there (otherwise: request form). */
publicRouter.get('/branches', async (_req, res) => {
  const locations = await Location.findAll({
    where: { active: true },
    include: [{ model: LocationSchedule, as: 'schedule', required: false }],
    order: [['sortOrder', 'ASC']],
  });
  res.json(
    locations.map((location) => {
      const schedule = location.get('schedule') as LocationSchedule | null;
      return {
        id: location.slug,
        name: location.name,
        onlineBooking: Boolean(schedule?.active),
        slotMinutes: schedule?.slotMinutes ?? null,
      };
    }),
  );
});

const overviewQuery = z.object({
  from: z.iso.date().optional(),
  days: z.coerce.number().int().min(1).max(31).default(14),
});

publicRouter.get('/availability/:branch', async (req, res) => {
  const branch = await bookableBranch(z.string().max(40).parse(req.params.branch));
  if (!branch) throw notFound('online_booking_unavailable', 'Online booking is not open here.');
  const query = overviewQuery.parse(req.query);
  res.json(await availabilityOverview(branch, query.from ?? todayInGoa(), query.days));
});

publicRouter.get('/availability/:branch/:date', async (req, res) => {
  const branch = await bookableBranch(z.string().max(40).parse(req.params.branch));
  if (!branch) throw notFound('online_booking_unavailable', 'Online booking is not open here.');
  const date = z.iso.date().parse(req.params.date);
  res.set('Cache-Control', 'no-store');
  res.json({
    date,
    slotMinutes: branch.schedule.slotMinutes,
    slots: await slotsForDay(branch, date),
  });
});

/** Books a live slot as a pending appointment; the front desk confirms it. */
publicRouter.post('/appointments', async (req, res) => {
  const body = slotBookingBody.parse(req.body);
  await consume(RULES.bookingPerIp, req.ip ?? 'unknown');
  await consume(RULES.bookingPerPhone, body.phone);

  const { appointment } = await bookSlot(body, { ip: req.ip ?? null });
  await audit(req, {
    action: 'appointment.booked_online',
    actorType: 'anonymous',
    actorId: hmac(body.phone),
    entity: 'appointment',
    entityId: appointment.id,
    meta: { branch: body.branch },
  });
  res.status(201).json({
    reference: appointment.reference,
    status: appointment.status,
    startAt: appointment.startAt.toISOString(),
    endAt: appointment.endAt.toISOString(),
  });
});
