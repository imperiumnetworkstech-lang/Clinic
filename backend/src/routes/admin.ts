import { createStaffBody, PERMISSIONS, type StaffProfile } from '@edc/shared';
import { Router } from 'express';
import { z } from 'zod';
import { hashPassword } from '../auth/password.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { requirePermission, requireStaff, staffPrincipal } from '../middleware/auth.js';
import { AuditLog, Lead, Location, Permission, Role, User } from '../models/index.js';
import { audit } from '../services/audit.js';

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
