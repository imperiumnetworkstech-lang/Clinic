import { Router } from 'express';
import { Op } from 'sequelize';
import { z } from 'zod';
import { badRequest, notFound } from '../lib/errors.js';
import { requirePermission, requireStaff, staffPrincipal } from '../middleware/auth.js';
import {
  Appointment,
  Holiday,
  Location,
  LocationSchedule,
  Patient,
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
