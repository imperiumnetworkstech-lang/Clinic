import { createStaffBody, PERMISSIONS, staffUpdateBody, type StaffProfile } from '@edc/shared';
import { Router } from 'express';
import { Op, QueryTypes } from 'sequelize';
import { z } from 'zod';
import { hashPassword } from '../auth/password.js';
import { sequelize } from '../db/sequelize.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { requirePermission, requireStaff, staffPrincipal } from '../middleware/auth.js';
import {
  Appointment,
  AuditLog,
  Lead,
  Location,
  Patient,
  Permission,
  RefreshToken,
  Role,
  User,
} from '../models/index.js';
import { audit } from '../services/audit.js';
import { addDays, todayInGoa } from '../services/availability.js';

export const adminRouter = Router();

adminRouter.use(requireStaff);

adminRouter.get('/me', async (req, res) => {
  const principal = staffPrincipal(req);
  const user = await User.findByPk(principal.id);
  if (!user) throw forbidden();
  const body: StaffProfile = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: principal.role,
    permissions: [...principal.permissions].sort(),
    twoFactorEnabled: user.totpEnabled,
  };
  res.json(body);
});

adminRouter.get('/permissions', requirePermission('roles.manage'), (_req, res) => {
  res.json(Object.entries(PERMISSIONS).map(([key, description]) => ({ key, description })));
});

adminRouter.get('/roles', requirePermission('staff.read'), async (_req, res) => {
  const roles = await Role.findAll({
    include: [{ model: Permission, as: 'permissions', attributes: ['key'] }],
    order: [['createdAt', 'ASC']],
  });
  res.json(
    roles.map((role) => {
      const permissions = (role.get('permissions') as Permission[] | undefined) ?? [];
      return {
        id: role.id,
        key: role.key,
        name: role.name,
        description: role.description,
        requiresTwoFactor: role.requiresTwoFactor,
        permissions: permissions.map((permission) => permission.key).sort(),
      };
    }),
  );
});

adminRouter.get('/staff', requirePermission('staff.read'), async (_req, res) => {
  const users = await User.findAll({
    include: [{ model: Role, as: 'role', attributes: ['key', 'name'] }],
    order: [['name', 'ASC']],
  });
  res.json(
    users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      role: user.role?.key,
      twoFactorEnabled: user.totpEnabled,
      lastLoginAt: user.lastLoginAt,
    })),
  );
});

adminRouter.post('/staff', requirePermission('staff.write'), async (req, res) => {
  const principal = staffPrincipal(req);
  const body = createStaffBody.parse(req.body);
  if (body.role === 'super_admin' && principal.role !== 'super_admin') {
    throw forbidden('role_escalation', 'Only an owner can create another owner account.');
  }
  const role = await Role.findOne({ where: { key: body.role } });
  if (!role) throw badRequest('unknown_role', 'That role does not exist.');
  if (await User.findOne({ where: { email: body.email } })) {
    throw badRequest('email_taken', 'A staff member with this email already exists.');
  }

  const user = await User.create({
    name: body.name,
    email: body.email,
    phone: body.phone ?? null,
    passwordHash: await hashPassword(body.password),
    roleId: role.id,
    passwordChangedAt: new Date(),
  });
  await audit(req, {
    action: 'staff.created',
    entity: 'user',
    entityId: user.id,
    meta: { role: role.key },
  });
  res.status(201).json({ id: user.id });
});

const auditQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().max(80).optional(),
  entity: z.string().max(60).optional(),
  entityId: z.string().max(64).optional(),
});

adminRouter.get('/audit-log', requirePermission('audit.read'), async (req, res) => {
  const query = auditQuery.parse(req.query);
  const { rows, count } = await AuditLog.findAndCountAll({
    where: {
      ...(query.action ? { action: query.action } : {}),
      ...(query.entity ? { entity: query.entity } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
    },
    order: [['id', 'DESC']],
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
  res.json({ page: query.page, pageSize: query.pageSize, total: count, items: rows });
});

const leadsQuery = z.object({
  status: z.enum(['new', 'contacted', 'booked', 'lost']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

adminRouter.get('/leads', requirePermission('leads.read'), async (req, res) => {
  const query = leadsQuery.parse(req.query);
  const { rows, count } = await Lead.findAndCountAll({
    where: query.status ? { status: query.status } : {},
    include: [{ model: Location, as: 'location', attributes: ['slug', 'name'] }],
    order: [['createdAt', 'DESC']],
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
  res.json({ page: query.page, pageSize: query.pageSize, total: count, items: rows });
});

const leadUpdateBody = z.object({ status: z.enum(['new', 'contacted', 'booked', 'lost']) });

adminRouter.patch('/leads/:id', requirePermission('leads.write'), async (req, res) => {
  const { status } = leadUpdateBody.parse(req.body);
  const lead = await Lead.findByPk(z.uuid().parse(req.params.id));
  if (!lead) throw notFound('lead_not_found', 'This enquiry no longer exists.');
  const previous = lead.status;
  await lead.update({ status });
  await audit(req, {
    action: 'lead.status_changed',
    entity: 'lead',
    entityId: lead.id,
    meta: { from: previous, to: status },
  });
  res.json({ id: lead.id, status: lead.status });
});

adminRouter.patch('/staff/:id', requirePermission('staff.write'), async (req, res) => {
  const principal = staffPrincipal(req);
  const body = staffUpdateBody.parse(req.body);
  const user = await User.findByPk(z.uuid().parse(req.params.id), {
    include: [{ model: Role, as: 'role', attributes: ['key'] }],
  });
  if (!user) throw notFound('staff_not_found', 'Staff member not found.');
  if (user.id === principal.id && (body.role !== undefined || body.status !== undefined)) {
    throw forbidden('self_change', 'You can’t change your own role or deactivate yourself.');
  }
  const touchesOwner = user.role?.key === 'super_admin' || body.role === 'super_admin';
  if (touchesOwner && principal.role !== 'super_admin') {
    throw forbidden('role_escalation', 'Only an owner can change an owner account.');
  }
  const role = body.role ? await Role.findOne({ where: { key: body.role } }) : null;
  if (body.role && !role) throw badRequest('unknown_role', 'That role does not exist.');

  await user.update({
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.phone !== undefined ? { phone: body.phone } : {}),
    ...(role ? { roleId: role.id } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
  });
  // A role change or deactivation ends every session, so new rights apply at once.
  if (role || body.status === 'disabled') {
    await RefreshToken.update(
      { revokedAt: new Date(), revokedReason: 'staff_updated' },
      { where: { subjectType: 'staff', subjectId: user.id, revokedAt: { [Op.is]: null } } },
    );
  }
  await audit(req, {
    action: 'staff.updated',
    entity: 'user',
    entityId: user.id,
    meta: { fields: Object.keys(body), ...(body.role ? { role: body.role } : {}) },
  });
  res.json({ id: user.id });
});

/** Front-page numbers for the clinic. Counts only; no patient details. */
adminRouter.get('/dashboard', requirePermission('dashboard.read'), async (_req, res) => {
  const today = todayInGoa();
  const dayStart = (date: string) => new Date(`${date}T00:00:00+05:30`);
  const since90 = new Date(Date.now() - 90 * 86_400_000);

  const [todayRows, toConfirm, newEnquiries, recallsDue, newPatients, outcomes, daily] =
    await Promise.all([
      Appointment.findAll({
        where: { startAt: { [Op.gte]: dayStart(today), [Op.lt]: dayStart(addDays(today, 1)) } },
        attributes: ['status'],
      }),
      Appointment.count({ where: { status: 'pending', startAt: { [Op.gt]: new Date() } } }),
      Lead.count({ where: { status: 'new' } }),
      Patient.count({ where: { nextRecallOn: { [Op.lte]: addDays(today, 30) } } }),
      Patient.count({ where: { createdAt: { [Op.gte]: dayStart(addDays(today, -29)) } } }),
      Appointment.findAll({
        where: { status: { [Op.in]: ['completed', 'no_show'] }, startAt: { [Op.gte]: since90 } },
        attributes: ['status'],
      }),
      sequelize.query<{ day: string; online: string; staff: string }>(
        `SELECT to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
                count(*) FILTER (WHERE source = 'website') AS online,
                count(*) FILTER (WHERE source <> 'website') AS staff
           FROM appointments
          WHERE deleted_at IS NULL AND created_at >= :since
          GROUP BY 1`,
        { replacements: { since: dayStart(addDays(today, -29)) }, type: QueryTypes.SELECT },
      ),
    ]);

  const byStatus = (status: string) => todayRows.filter((row) => row.status === status).length;
  const byDay = new Map(daily.map((row) => [row.day, row]));
  const noShows = outcomes.filter((row) => row.status === 'no_show').length;

  res.json({
    today: {
      total: todayRows.filter((row) => row.status !== 'cancelled').length,
      pending: byStatus('pending'),
      confirmed: byStatus('confirmed'),
      checkedIn: byStatus('checked_in'),
      completed: byStatus('completed'),
      noShow: byStatus('no_show'),
    },
    toConfirm,
    newEnquiries,
    recallsDue,
    newPatients30d: newPatients,
    noShowRate90d: outcomes.length ? noShows / outcomes.length : null,
    bookings30d: Array.from({ length: 30 }, (_, index) => {
      const day = addDays(today, index - 29);
      const row = byDay.get(day);
      return { day, online: Number(row?.online ?? 0), staff: Number(row?.staff ?? 0) };
    }),
  });
});
