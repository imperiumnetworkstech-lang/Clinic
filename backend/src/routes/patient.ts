import { Router, type Request } from 'express';
import { Op } from 'sequelize';
import { z } from 'zod';
import { badRequest, notFound } from '../lib/errors.js';
import { requirePatient } from '../middleware/auth.js';
import { Appointment, Location, Patient } from '../models/index.js';
import { audit } from '../services/audit.js';

export const patientRouter = Router();

patientRouter.use(requirePatient);

/** Patients sign in by email ("email:<address>") or phone; both cover a family's profiles. */
function profileScope(req: Request) {
  const subject = req.auth?.id ?? '';
  return subject.startsWith('email:') ? { email: subject.slice(6) } : { phone: subject };
}

async function profileIds(req: Request): Promise<string[]> {
  const profiles = await Patient.findAll({ where: profileScope(req), attributes: ['id'] });
  return profiles.map((profile) => profile.id);
}

/** Patients may cancel online up to this long before the appointment; later, they call. */
const CANCEL_CUTOFF_MINUTES = 120;

patientRouter.get('/', async (req, res) => {
  const profiles = await Patient.findAll({
    where: profileScope(req),
    attributes: ['id', 'code', 'name'],
    order: [['createdAt', 'ASC']],
  });
  res.json({ signedInAs: req.auth?.id.replace(/^email:/, ''), profiles });
});

patientRouter.get('/appointments', async (req, res) => {
  const ids = await profileIds(req);
  const appointments = await Appointment.findAll({
    where: { patientId: { [Op.in]: ids } },
    include: [
      { model: Location, as: 'location', attributes: ['slug', 'name', 'addressLine', 'phone'] },
      { model: Patient, as: 'patient', attributes: ['id', 'name'] },
    ],
    order: [['startAt', 'DESC']],
    limit: 100,
  });
  const now = Date.now();
  const view = appointments.map((appointment) => ({
    id: appointment.id,
    reference: appointment.reference,
    status: appointment.status,
    startAt: appointment.startAt.toISOString(),
    endAt: appointment.endAt.toISOString(),
    reason: appointment.reason,
    patientName: appointment.patient?.name ?? '',
    location: appointment.location
      ? {
          id: appointment.location.slug,
          name: appointment.location.name,
          address: appointment.location.addressLine,
          phone: appointment.location.phone,
        }
      : null,
    canCancel:
      ['pending', 'confirmed'].includes(appointment.status) &&
      appointment.startAt.getTime() - now > CANCEL_CUTOFF_MINUTES * 60_000,
  }));
  res.json({
    upcoming: view
      .filter((a) => new Date(a.endAt).getTime() > now && a.status !== 'cancelled')
      .reverse(),
    past: view.filter((a) => new Date(a.endAt).getTime() <= now || a.status === 'cancelled'),
  });
});

patientRouter.post('/appointments/:id/cancel', async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const appointment = await Appointment.findOne({
    where: { id, patientId: { [Op.in]: await profileIds(req) } },
  });
  if (!appointment) throw notFound('appointment_not_found', 'Appointment not found.');
  if (!['pending', 'confirmed'].includes(appointment.status)) {
    throw badRequest('not_cancellable', 'This appointment can no longer be cancelled online.');
  }
  if (appointment.startAt.getTime() - Date.now() <= CANCEL_CUTOFF_MINUTES * 60_000) {
    throw badRequest(
      'too_late_to_cancel',
      'It’s too close to your appointment to cancel online. Please call the clinic.',
    );
  }
  await appointment.update({
    status: 'cancelled',
    cancelledAt: new Date(),
    cancelledBy: 'patient',
  });
  await audit(req, {
    action: 'appointment.cancelled_by_patient',
    entity: 'appointment',
    entityId: appointment.id,
  });
  res.json({ id: appointment.id, status: appointment.status });
});
