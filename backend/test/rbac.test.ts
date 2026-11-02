import { describe, expect, it } from 'vitest';
import { AuditLog } from '../src/models/index.js';
import { api, loginWithEnrolment, loginWithoutMfa, PASSWORD } from './helpers.js';

const bearer = (token: string) => `Bearer ${token}`;

describe('role-based access control', () => {
  it('rejects requests without a token', async () => {
    const res = await api().get('/api/v1/admin/me');
    expect(res.status).toBe(401);
  });

  it('gives the receptionist its own permissions but not staff or audit access', async () => {
    const { client, accessToken } = await loginWithoutMfa('receptionist');
    const me = await client.get('/api/v1/admin/me').set('Authorization', bearer(accessToken));
    expect(me.status).toBe(200);
    expect(me.body.role).toBe('receptionist');
    expect(me.body.permissions).toContain('appointments.write');
    expect(me.body.permissions).not.toContain('clinical.read');

    for (const path of ['/api/v1/admin/staff', '/api/v1/admin/audit-log']) {
      const res = await client.get(path).set('Authorization', bearer(accessToken));
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('missing_permission');
    }
  });

  it('lets the owner list roles, staff and the audit log', async () => {
    const { client, accessToken, user } = await loginWithEnrolment('super_admin');
    const roles = await client.get('/api/v1/admin/roles').set('Authorization', bearer(accessToken));
    expect(roles.status).toBe(200);
    expect(roles.body.map((role: { key: string }) => role.key)).toEqual(
      expect.arrayContaining(['super_admin', 'doctor', 'receptionist', 'assistant']),
    );

    const log = await client
      .get(`/api/v1/admin/audit-log?action=auth.mfa_enabled&pageSize=5`)
      .set('Authorization', bearer(accessToken));
    expect(log.status).toBe(200);
    expect(log.body.items.some((item: { actorId: string }) => item.actorId === user.id)).toBe(true);
  });

  it('lets the owner create staff and audits it; a patient token is refused', async () => {
    const { client, accessToken } = await loginWithEnrolment('super_admin');
    const email = `new.receptionist.${Date.now()}@expressions.test`;
    const created = await client
      .post('/api/v1/admin/staff')
      .set('Authorization', bearer(accessToken))
      .send({ name: 'New Receptionist', email, role: 'receptionist', password: PASSWORD });
    expect(created.status).toBe(201);
    expect(
      await AuditLog.count({ where: { action: 'staff.created', entityId: created.body.id } }),
    ).toBe(1);

    const duplicate = await client
      .post('/api/v1/admin/staff')
      .set('Authorization', bearer(accessToken))
      .send({ name: 'Again', email, role: 'receptionist', password: PASSWORD });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.code).toBe('email_taken');
  });

  it('refuses weak staff passwords', async () => {
    const { client, accessToken } = await loginWithEnrolment('super_admin');
    const res = await client
      .post('/api/v1/admin/staff')
      .set('Authorization', bearer(accessToken))
      .send({ name: 'Weak', email: 'weak@expressions.test', role: 'assistant', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].path).toBe('password');
  });
});
