import { appointmentRequestBody, BOOKING_CONSENT_VERSION } from '@edc/shared';
import { Router } from 'express';
import { badRequest } from '../lib/errors.js';
import { hmac } from '../lib/crypto.js';
import { Lead, Location } from '../models/index.js';
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
