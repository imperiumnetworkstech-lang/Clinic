import {
  clinicalNoteBody,
  medicalHistoryBody,
  patientCreateBody,
  patientUpdateBody,
  planItemUpdateBody,
  treatmentPlanBody,
  treatmentPlanUpdateBody,
} from '@edc/shared';
import { Router, type Request } from 'express';
import { col, fn, literal, Op, where as sqlWhere } from 'sequelize';
import { z } from 'zod';
import { sequelize } from '../db/sequelize.js';
import { badRequest, HttpError, notFound } from '../lib/errors.js';
import { requirePermission, requireStaff, staffPrincipal } from '../middleware/auth.js';
import {
  Appointment,
  ClinicalNote,
  Lead,
  Location,
  Patient,
  PatientConsent,
  TreatmentPlan,
  TreatmentPlanItem,
  User,
} from '../models/index.js';
import { audit } from '../services/audit.js';
import { addDays, todayInGoa } from '../services/availability.js';
import {
  openText,
  readMedicalHistory,
  sealMedicalHistory,
  sealText,
} from '../services/clinical.js';

/** Patients CRM: search, registration, the patient record, clinical notes and treatment plans. */
export const adminPatientsRouter = Router();

adminPatientsRouter.use(requireStaff);

const can = (req: Request, permission: Parameters<typeof requirePermission>[0]) =>
  staffPrincipal(req).permissions.has(permission);

const LAST_VISIT = literal(
  `(SELECT max(a.start_at) FROM appointments a WHERE a.patient_id = "Patient"."id"
     AND a.status = 'completed' AND a.deleted_at IS NULL)`,
);
const NEXT_VISIT = literal(
  `(SELECT min(a.start_at) FROM appointments a WHERE a.patient_id = "Patient"."id"
     AND a.status IN ('pending', 'confirmed') AND a.start_at > now() AND a.deleted_at IS NULL)`,
);

const listQuery = z.object({
  q: z.string().trim().max(80).optional(),
  recall: z.enum(['due']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

adminPatientsRouter.get('/patients', requirePermission('patients.read'), async (req, res) => {
  const query = listQuery.parse(req.query);
  const digits = query.q?.replace(/\D/g, '') ?? '';
  const search = query.q
    ? {
        [Op.or]: [
          { name: { [Op.iLike]: `%${query.q}%` } },
          { code: { [Op.iLike]: `%${query.q}%` } },
          { email: { [Op.iLike]: `%${query.q}%` } },
          ...(digits.length >= 4 ? [{ phone: { [Op.like]: `%${digits}%` } }] : []),
        ],
      }
    : {};
  const recall =
    query.recall === 'due' ? { nextRecallOn: { [Op.lte]: addDays(todayInGoa(), 30) } } : {};

  const { rows, count } = await Patient.findAndCountAll({
    where: { ...search, ...recall },
    attributes: [
      'id',
      'code',
      'name',
      'phone',
      'email',
      'nextRecallOn',
      'recallNote',
      'createdAt',
      [LAST_VISIT, 'lastVisitAt'],
      [NEXT_VISIT, 'nextVisitAt'],
    ],
    include: [{ model: Location, as: 'homeLocation', attributes: ['slug', 'name'] }],
    order: query.recall ? [['nextRecallOn', 'ASC']] : [['createdAt', 'DESC']],
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
  res.json({ page: query.page, pageSize: query.pageSize, total: count, items: rows });
});

async function branchId(slug: string | undefined): Promise<string | null | undefined> {
  if (slug === undefined) return undefined;
  const location = await Location.findOne({ where: { slug } });
  if (!location) throw badRequest('branch_not_found', 'Unknown clinic.');
  return location.id;
}

adminPatientsRouter.post('/patients', requirePermission('patients.write'), async (req, res) => {
  const body = patientCreateBody.parse(req.body);
  const existing = await Patient.findOne({
    where: {
      phone: body.phone,
      [Op.and]: [sqlWhere(fn('lower', col('name')), body.name.toLowerCase())],
    },
  });
  if (existing) {
    throw new HttpError(409, 'patient_exists', 'This patient is already registered.', {
      id: existing.id,
    });
  }
  const patient = await Patient.create({
    name: body.name,
    phone: body.phone,
    email: body.email || null,
    dateOfBirth: body.dateOfBirth || null,
    gender: body.gender ?? null,
    source: body.source ?? null,
    homeLocationId: (await branchId(body.homeBranch)) ?? null,
  });
  await patient.reload();
  await audit(req, { action: 'patient.created', entity: 'patient', entityId: patient.id });
  res.status(201).json({ id: patient.id, code: patient.code });
});

async function findPatient(id: unknown) {
  const patient = await Patient.findByPk(z.uuid().parse(id), {
    include: [{ model: Location, as: 'homeLocation', attributes: ['slug', 'name'] }],
  });
  if (!patient) throw notFound('patient_not_found', 'Patient not found.');
  return patient;
}

type TimelineEvent = { at: string; kind: string; title: string; detail?: string };

adminPatientsRouter.get('/patients/:id', requirePermission('patients.read'), async (req, res) => {
  const patient = await findPatient(req.params.id);
  const clinical = can(req, 'clinical.read');

  const [appointments, consents, leads, notes, plans] = await Promise.all([
    Appointment.findAll({
      where: { patientId: patient.id },
      include: [
        { model: Location, as: 'location', attributes: ['slug', 'name'] },
        { model: User, as: 'dentist', attributes: ['id', 'name'] },
      ],
      order: [['startAt', 'DESC']],
      limit: 100,
    }),
    PatientConsent.findAll({ where: { patientId: patient.id }, order: [['createdAt', 'DESC']] }),
    Lead.findAll({ where: { patientId: patient.id }, order: [['createdAt', 'DESC']] }),
    clinical
      ? ClinicalNote.findAll({
          where: { patientId: patient.id },
          include: [{ model: User, as: 'author', attributes: ['id', 'name'] }],
          order: [['createdAt', 'DESC']],
          limit: 100,
        })
      : Promise.resolve([]),
    clinical
      ? TreatmentPlan.findAll({
          where: { patientId: patient.id },
          include: [{ model: TreatmentPlanItem, as: 'items' }],
          order: [
            ['createdAt', 'DESC'],
            [{ model: TreatmentPlanItem, as: 'items' }, 'sortOrder', 'ASC'],
          ],
        })
      : Promise.resolve([]),
  ]);

  // Latest decision per consent type (rows are append-only).
  const latestConsent = new Map<string, PatientConsent>();
  for (const consent of consents) {
    if (!latestConsent.has(consent.type)) latestConsent.set(consent.type, consent);
  }

  const timeline: TimelineEvent[] = [
    { at: patient.createdAt.toISOString(), kind: 'registered', title: 'Registered' },
    ...appointments.map((appointment) => ({
      at: appointment.startAt.toISOString(),
      kind: 'appointment',
      title: `Appointment ${appointment.status.replace('_', ' ')}`,
      detail: `${appointment.reference} · ${appointment.location?.name ?? ''}`,
    })),
    ...leads.map((lead) => ({
      at: lead.createdAt.toISOString(),
      kind: 'enquiry',
      title: 'Website enquiry',
      detail: lead.reference,
    })),
    ...notes.map((note) => ({
      at: note.createdAt.toISOString(),
      kind: 'note',
      title: `Clinical note by ${note.author?.name ?? 'staff'}`,
    })),
    ...plans.map((plan) => ({
      at: plan.createdAt.toISOString(),
      kind: 'plan',
      title: `Treatment plan: ${plan.title}`,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  if (clinical) {
    await audit(req, {
      action: 'patient.clinical_viewed',
      entity: 'patient',
      entityId: patient.id,
    });
  }

  res.json({
    patient: {
      id: patient.id,
      code: patient.code,
      name: patient.name,
      phone: patient.phone,
      email: patient.email,
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
      source: patient.source,
      tags: patient.tags,
      homeBranch: patient.get('homeLocation') ?? null,
      nextRecallOn: patient.nextRecallOn,
      recallNote: patient.recallNote,
      createdAt: patient.createdAt,
    },
    consents: [...latestConsent.values()].map((consent) => ({
      type: consent.type,
      granted: consent.granted,
      at: consent.createdAt,
    })),
    appointments: appointments.map((appointment) => ({
      id: appointment.id,
      reference: appointment.reference,
      status: appointment.status,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      reason: appointment.reason,
      location: appointment.location ?? null,
      dentist: appointment.dentist ?? null,
    })),
    clinical: clinical
      ? {
          medicalHistory: readMedicalHistory(patient.medicalHistory),
          notes: notes.map((note) => ({
            id: note.id,
            body: openText(note.body),
            author: note.author?.name ?? '',
            appointmentId: note.appointmentId,
            createdAt: note.createdAt,
          })),
          plans: plans.map((plan) => ({
            id: plan.id,
            title: plan.title,
            status: plan.status,
            notes: openText(plan.notes),
            createdAt: plan.createdAt,
            items: (plan.items ?? []).map((item) => ({
              id: item.id,
              treatment: item.treatment,
              tooth: item.tooth,
              sessions: item.sessions,
              status: item.status,
              completedAt: item.completedAt,
            })),
          })),
        }
      : null,
    timeline,
  });
});

adminPatientsRouter.patch(
  '/patients/:id',
  requirePermission('patients.write'),
  async (req, res) => {
    const patient = await findPatient(req.params.id);
    const body = patientUpdateBody.parse(req.body);
    const homeLocationId = await branchId(body.homeBranch);
    await patient.update({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.email !== undefined ? { email: body.email || null } : {}),
      ...(body.dateOfBirth !== undefined ? { dateOfBirth: body.dateOfBirth || null } : {}),
      ...(body.gender !== undefined ? { gender: body.gender } : {}),
      ...(body.source !== undefined ? { source: body.source } : {}),
      ...(homeLocationId !== undefined ? { homeLocationId } : {}),
      ...(body.nextRecallOn !== undefined ? { nextRecallOn: body.nextRecallOn } : {}),
      ...(body.recallNote !== undefined ? { recallNote: body.recallNote } : {}),
      ...(body.tags !== undefined ? { tags: body.tags } : {}),
    });
    await audit(req, {
      action: 'patient.updated',
      entity: 'patient',
      entityId: patient.id,
      meta: { fields: Object.keys(body) },
    });
    res.json({ id: patient.id });
  },
);

adminPatientsRouter.put(
  '/patients/:id/medical-history',
  requirePermission('clinical.write'),
  async (req, res) => {
    const patient = await findPatient(req.params.id);
    const history = medicalHistoryBody.parse(req.body);
    await patient.update({ medicalHistory: sealMedicalHistory(history) });
    await audit(req, {
      action: 'patient.medical_history_updated',
      entity: 'patient',
      entityId: patient.id,
    });
    res.json(history);
  },
);

adminPatientsRouter.post(
  '/patients/:id/notes',
  requirePermission('clinical.write'),
  async (req, res) => {
    const patient = await findPatient(req.params.id);
    const body = clinicalNoteBody.parse(req.body);
    if (body.appointmentId) {
      const appointment = await Appointment.findOne({
        where: { id: body.appointmentId, patientId: patient.id },
      });
      if (!appointment)
        throw badRequest('appointment_not_found', 'That visit isn’t this patient’s.');
    }
    const note = await ClinicalNote.create({
      patientId: patient.id,
      appointmentId: body.appointmentId ?? null,
      authorId: staffPrincipal(req).id,
      body: sealText(body.body),
    });
    await audit(req, { action: 'clinical_note.created', entity: 'patient', entityId: patient.id });
    res.status(201).json({ id: note.id });
  },
);

adminPatientsRouter.post(
  '/patients/:id/plans',
  requirePermission('clinical.write'),
  async (req, res) => {
    const patient = await findPatient(req.params.id);
    const body = treatmentPlanBody.parse(req.body);
    const plan = await sequelize.transaction(async (transaction) => {
      const created = await TreatmentPlan.create(
        {
          patientId: patient.id,
          title: body.title,
          notes: sealText(body.notes),
          createdBy: staffPrincipal(req).id,
        },
        { transaction },
      );
      await TreatmentPlanItem.bulkCreate(
        body.items.map((item, index) => ({ ...item, planId: created.id, sortOrder: index })),
        { transaction },
      );
      return created;
    });
    await audit(req, { action: 'treatment_plan.created', entity: 'patient', entityId: patient.id });
    res.status(201).json({ id: plan.id });
  },
);

adminPatientsRouter.patch('/plans/:id', requirePermission('clinical.write'), async (req, res) => {
  const plan = await TreatmentPlan.findByPk(z.uuid().parse(req.params.id));
  if (!plan) throw notFound('plan_not_found', 'Treatment plan not found.');
  const body = treatmentPlanUpdateBody.parse(req.body);
  await plan.update({
    ...(body.title !== undefined ? { title: body.title } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.notes !== undefined ? { notes: sealText(body.notes) } : {}),
  });
  await audit(req, {
    action: 'treatment_plan.updated',
    entity: 'patient',
    entityId: plan.patientId,
    meta: { planId: plan.id, ...(body.status ? { status: body.status } : {}) },
  });
  res.json({ id: plan.id, status: plan.status });
});

/** Marking items done moves an accepted plan to in progress, and finishing all completes it. */
adminPatientsRouter.patch(
  '/plan-items/:id',
  requirePermission('clinical.write'),
  async (req, res) => {
    const { status } = planItemUpdateBody.parse(req.body);
    const item = await TreatmentPlanItem.findByPk(z.uuid().parse(req.params.id));
    if (!item) throw notFound('plan_item_not_found', 'Treatment not found.');
    const plan = await TreatmentPlan.findByPk(item.planId, {
      include: [{ model: TreatmentPlanItem, as: 'items' }],
    });
    if (!plan) throw notFound('plan_not_found', 'Treatment plan not found.');

    await item.update({ status, completedAt: status === 'done' ? new Date() : null });
    const items = (plan.items ?? []).map((entry) => (entry.id === item.id ? item : entry));
    const open = items.filter((entry) => entry.status === 'planned').length;
    const done = items.filter((entry) => entry.status === 'done').length;
    if (open === 0 && done > 0 && plan.status !== 'declined') {
      await plan.update({ status: 'completed' });
    } else if (done > 0 && ['proposed', 'accepted', 'completed'].includes(plan.status)) {
      await plan.update({ status: 'in_progress' });
    }
    await audit(req, {
      action: 'treatment_plan.item_updated',
      entity: 'patient',
      entityId: plan.patientId,
      meta: { planId: plan.id, itemId: item.id, status },
    });
    res.json({ id: item.id, status: item.status, planStatus: plan.status });
  },
);
