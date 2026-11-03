import { appointmentMoveBody, staffAppointmentBody } from '@edc/shared';
import { Router } from 'express';
import { Op, type Transaction } from 'sequelize';
import { sequelize } from '../db/sequelize.js';
import { z } from 'zod';
import { badRequest, HttpError, notFound } from '../lib/errors.js';
import { requirePermission, requireStaff, staffPrincipal } from '../middleware/auth.js';
import {
  Appointment,
  Holiday,
  Location,
  LocationSchedule,
  Patient,
  Role,
  SLOT_HOLDING,
  User,
  type AppointmentStatus,
} from '../models/index.js';
import { audit } from '../services/audit.js';
import { addDays, todayInGoa } from '../services/availability.js';

/** Front-desk scheduling: the day's appointments, status changes, and branch schedules. */
export const adminSchedulingRouter = Router();

adminSchedulingRouter.use(requireStaff);

const goaDayStart = (date: string) => new Date(`${date}T00:00:00+05:30`);

const dayQuery = z.object({
  date: z.iso.date().optional(),
  branch: z.string().max(40).optional(),
});

adminSchedulingRouter.get(
  '/appointments',
  requirePermission('appointments.read'),
  async (req, res) => {
    const query = dayQuery.parse(req.query);
    const date = query.date ?? todayInGoa();
    const location = query.branch
      ? await Location.findOne({ where: { slug: query.branch } })
      : null;
    if (query.branch && !location) throw notFound('branch_not_found', 'Unknown clinic.');

    const appointments = await Appointment.findAll({
      where: {
        startAt: { [Op.gte]: goaDayStart(date), [Op.lt]: goaDayStart(addDays(date, 1)) },
        ...(location ? { locationId: location.id } : {}),
      },
      include: [
        { model: Patient, as: 'patient', attributes: ['id', 'code', 'name', 'phone', 'email'] },
        { model: Location, as: 'location', attributes: ['slug', 'name'] },
        { model: User, as: 'dentist', attributes: ['id', 'name'] },
      ],
      order: [['startAt', 'ASC']],
    });
    res.json({ date, items: appointments });
  },
);

/** Allowed status moves; anything else is refused so the history stays meaningful. */
const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'no_show', 'cancelled'],
  checked_in: ['completed'],
  completed: [],
  no_show: ['confirmed'],
  cancelled: ['confirmed'],
};

const statusBody = z.object({
  status: z.enum(['pending', 'confirmed', 'checked_in', 'completed', 'no_show', 'cancelled']),
});

adminSchedulingRouter.patch(
  '/appointments/:id',
  requirePermission('appointments.write'),
  async (req, res) => {
    const principal = staffPrincipal(req);
    const { status } = statusBody.parse(req.body);
    const appointment = await Appointment.findByPk(z.uuid().parse(req.params.id));
    if (!appointment) throw notFound('appointment_not_found', 'Appointment not found.');
    const current = appointment.status as AppointmentStatus;
    if (!TRANSITIONS[current].includes(status)) {
      throw badRequest(
        'invalid_transition',
        `An appointment that is ${current.replace('_', ' ')} can’t be marked ${status.replace('_', ' ')}.`,
      );
    }
    const previous = current;
    await appointment.update({
      status,
      ...(status === 'confirmed' ? { confirmedAt: new Date(), confirmedBy: principal.id } : {}),
      ...(status === 'cancelled'
        ? { cancelledAt: new Date(), cancelledBy: 'clinic' as const }
        : {}),
    });
    await audit(req, {
      action: 'appointment.status_changed',
      entity: 'appointment',
      entityId: appointment.id,
      meta: { from: previous, to: status },
    });
    res.json({ id: appointment.id, status: appointment.status });
  },
);

/* ------------------------------------------------------------------ calendar */

/** Staff who can be assigned as the treating dentist (doctors, and owners who practise). */
adminSchedulingRouter.get(
  '/dentists',
  requirePermission('appointments.read'),
  async (_req, res) => {
    const users = await User.findAll({
      where: { status: 'active' },
      include: [
        {
          model: Role,
          as: 'role',
          attributes: ['key'],
          where: { key: { [Op.in]: ['doctor', 'super_admin'] } },
        },
      ],
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });
    res.json(users.map((user) => ({ id: user.id, name: user.name, role: user.role?.key })));
  },
);

const calendarQuery = z.object({
  from: z.iso.date().optional(),
  days: z.coerce.number().int().min(1).max(14).default(7),
  branch: z.string().max(40).optional(),
});

adminSchedulingRouter.get('/calendar', requirePermission('appointments.read'), async (req, res) => {
  const query = calendarQuery.parse(req.query);
  const from = query.from ?? todayInGoa();
  const location = query.branch ? await Location.findOne({ where: { slug: query.branch } }) : null;
  if (query.branch && !location) throw notFound('branch_not_found', 'Unknown clinic.');
  const items = await Appointment.findAll({
    where: {
      startAt: { [Op.gte]: goaDayStart(from), [Op.lt]: goaDayStart(addDays(from, query.days)) },
      ...(location ? { locationId: location.id } : {}),
    },
    include: [
      { model: Patient, as: 'patient', attributes: ['id', 'code', 'name', 'phone'] },
      { model: Location, as: 'location', attributes: ['slug', 'name'] },
      { model: User, as: 'dentist', attributes: ['id', 'name'] },
    ],
    order: [['startAt', 'ASC']],
  });
  res.json({ from, days: query.days, items });
});

/**
 * Refuses a time that would overbook the branch (more patients than chairs) or the dentist,
 * unless the front desk deliberately forces it. Runs inside the caller's transaction after
 * locking the branch schedule row, so two concurrent bookings can't both slip through.
 */
async function assertBookable(options: {
  locationId: string;
  start: Date;
  end: Date;
  dentistId: string | null;
  excludeId?: string;
  force: boolean;
  transaction: Transaction;
}) {
  const { locationId, start, end, dentistId, excludeId, force, transaction } = options;
  const schedule = await LocationSchedule.findOne({
    where: { locationId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (force) return;
  const overlapping = {
    status: { [Op.in]: SLOT_HOLDING },
    startAt: { [Op.lt]: end },
    endAt: { [Op.gt]: start },
    ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
  };
  const atBranch = await Appointment.count({ where: { ...overlapping, locationId }, transaction });
  if (atBranch >= (schedule?.capacity ?? 1)) {
    throw new HttpError(409, 'slot_full', 'Every chair is booked at that time.');
  }
  if (dentistId) {
    const busy = await Appointment.count({ where: { ...overlapping, dentistId }, transaction });
    if (busy > 0) {
      throw new HttpError(409, 'dentist_busy', 'That dentist already has a patient then.');
    }
  }
}

async function activeDentist(id: string | null | undefined) {
  if (!id) return;
  const dentist = await User.findOne({ where: { id, status: 'active' } });
  if (!dentist) throw badRequest('dentist_not_found', 'Choose an active dentist.');
}

adminSchedulingRouter.post(
  '/appointments',
  requirePermission('appointments.write'),
  async (req, res) => {
    const principal = staffPrincipal(req);
    const body = staffAppointmentBody.parse(req.body);
    const [patient, location] = await Promise.all([
      Patient.findByPk(body.patientId),
      Location.findOne({ where: { slug: body.branch, active: true } }),
    ]);
    if (!patient) throw notFound('patient_not_found', 'Patient not found.');
    if (!location) throw notFound('branch_not_found', 'Unknown clinic.');
    await activeDentist(body.dentistId);

    const start = new Date(body.startAt);
    const end = new Date(start.getTime() + body.durationMinutes * 60_000);
    const appointment = await sequelize.transaction(async (transaction) => {
      await assertBookable({
        locationId: location.id,
        start,
        end,
        dentistId: body.dentistId,
        force: body.force,
        transaction,
      });
      return Appointment.create(
        {
          patientId: patient.id,
          locationId: location.id,
          startAt: start,
          endAt: end,
          status: 'confirmed',
          source: body.source,
          reason: body.reason,
          notes: body.notes,
          dentistId: body.dentistId,
          confirmedAt: new Date(),
          confirmedBy: principal.id,
          createdBy: principal.id,
        },
        { transaction },
      );
    });
    await appointment.reload();
    await audit(req, {
      action: 'appointment.created_by_staff',
      entity: 'appointment',
      entityId: appointment.id,
      meta: { branch: body.branch, source: body.source, forced: body.force },
    });
    res.status(201).json({ id: appointment.id, reference: appointment.reference });
  },
);

adminSchedulingRouter.patch(
  '/appointments/:id/time',
  requirePermission('appointments.write'),
  async (req, res) => {
    const body = appointmentMoveBody.parse(req.body);
    const appointment = await Appointment.findByPk(z.uuid().parse(req.params.id));
    if (!appointment) throw notFound('appointment_not_found', 'Appointment not found.');
    if (!['pending', 'confirmed'].includes(appointment.status)) {
      throw badRequest('not_movable', 'Only upcoming appointments can be moved.');
    }
    const dentistId = body.dentistId === undefined ? appointment.dentistId : body.dentistId;
    await activeDentist(dentistId);
    const minutes =
      body.durationMinutes ??
      Math.round((appointment.endAt.getTime() - appointment.startAt.getTime()) / 60_000);
    const start = new Date(body.startAt);
    const end = new Date(start.getTime() + minutes * 60_000);
    const from = appointment.startAt.toISOString();

    await sequelize.transaction(async (transaction) => {
      await assertBookable({
        locationId: appointment.locationId,
        start,
        end,
        dentistId,
        excludeId: appointment.id,
        force: body.force,
        transaction,
      });
      await appointment.update({ startAt: start, endAt: end, dentistId }, { transaction });
    });
    await audit(req, {
      action: 'appointment.moved_by_staff',
      entity: 'appointment',
      entityId: appointment.id,
      meta: { from, to: start.toISOString(), forced: body.force },
    });
    res.json({
      id: appointment.id,
      startAt: appointment.startAt.toISOString(),
      endAt: appointment.endAt.toISOString(),
      dentistId: appointment.dentistId,
    });
  },
);

/* ------------------------------------------------------------------ schedules */

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');
const intervals = z
  .array(z.object({ open: hhmm, close: hhmm }))
  .max(4)
  .refine((list) => list.every((i) => i.open < i.close), 'Each closing time must be after opening')
  .refine(
    (list) =>
      [...list]
        .sort((a, b) => a.open.localeCompare(b.open))
        .every((item, index, sorted) => {
          const previous = sorted[index - 1];
          return !previous || previous.close <= item.open;
        }),
    'Opening hours on one day must not overlap',
  );

const scheduleBody = z.object({
  active: z.boolean(),
  slotMinutes: z.number().int().min(10).max(120),
  capacity: z.number().int().min(1).max(10),
  minNoticeMinutes: z.number().int().min(0).max(2880),
  maxDaysAhead: z.number().int().min(1).max(180),
  weekly: z.object({
    monday: intervals,
    tuesday: intervals,
    wednesday: intervals,
    thursday: intervals,
    friday: intervals,
    saturday: intervals,
    sunday: intervals,
  }),
});

adminSchedulingRouter.get(
  '/schedules',
  requirePermission('appointments.read'),
  async (_req, res) => {
    const locations = await Location.findAll({
      where: { active: true },
      include: [
        { model: LocationSchedule, as: 'schedule', required: false },
        {
          model: Holiday,
          as: 'holidays',
          required: false,
          where: { date: { [Op.gte]: todayInGoa() } },
        },
      ],
      order: [
        ['sortOrder', 'ASC'],
        [{ model: Holiday, as: 'holidays' }, 'date', 'ASC'],
      ],
    });
    res.json(
      locations.map((location) => ({
        id: location.slug,
        name: location.name,
        schedule: location.get('schedule') ?? null,
        holidays: location.get('holidays') ?? [],
      })),
    );
  },
);

adminSchedulingRouter.put(
  '/schedules/:branch',
  requirePermission('settings.write'),
  async (req, res) => {
    const principal = staffPrincipal(req);
    const body = scheduleBody.parse(req.body);
    const location = await Location.findOne({
      where: { slug: z.string().parse(req.params.branch) },
    });
    if (!location) throw notFound('branch_not_found', 'Unknown clinic.');

    const [schedule] = await LocationSchedule.findOrCreate({
      where: { locationId: location.id },
      defaults: { locationId: location.id, ...body, updatedBy: principal.id },
    });
    await schedule.update({ ...body, updatedBy: principal.id });
    await audit(req, {
      action: 'schedule.updated',
      entity: 'location',
      entityId: location.id,
      meta: { active: body.active, slotMinutes: body.slotMinutes, capacity: body.capacity },
    });
    res.json(schedule);
  },
);

const holidayBody = z.object({
  date: z.iso.date(),
  reason: z.string().trim().max(120).default(''),
});

adminSchedulingRouter.post(
  '/schedules/:branch/holidays',
  requirePermission('settings.write'),
  async (req, res) => {
    const body = holidayBody.parse(req.body);
    const location = await Location.findOne({
      where: { slug: z.string().parse(req.params.branch) },
    });
    if (!location) throw notFound('branch_not_found', 'Unknown clinic.');
    const [holiday, created] = await Holiday.findOrCreate({
      where: { locationId: location.id, date: body.date },
      defaults: { locationId: location.id, date: body.date, reason: body.reason },
    });
    if (!created) throw badRequest('holiday_exists', 'That day is already marked closed.');
    await audit(req, {
      action: 'holiday.added',
      entity: 'location',
      entityId: location.id,
      meta: body,
    });
    res.status(201).json(holiday);
  },
);

adminSchedulingRouter.delete(
  '/holidays/:id',
  requirePermission('settings.write'),
  async (req, res) => {
    const holiday = await Holiday.findByPk(z.uuid().parse(req.params.id));
    if (!holiday) throw notFound('holiday_not_found', 'Closed day not found.');
    await holiday.destroy();
    await audit(req, {
      action: 'holiday.removed',
      entity: 'location',
      entityId: holiday.locationId,
      meta: { date: holiday.date },
    });
    res.status(204).end();
  },
);
