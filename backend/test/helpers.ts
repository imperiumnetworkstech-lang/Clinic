import { randomInt, randomUUID } from 'node:crypto';
import type { RoleKey } from '@edc/shared';
import { authenticator } from 'otplib';
import request from 'supertest';
import type { Response } from 'supertest';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/auth/password.js';
import { Patient, Role, User } from '../src/models/index.js';

export const app = createApp();

export const PASSWORD = 'correct horse battery staple';

/** A fresh client IP per test keeps per-IP rate limits from leaking between tests. */
export function randomIp(): string {
  return `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
}

export function api(ip = randomIp()) {
  return {
    ip,
    post: (url: string) => request(app).post(url).set('X-Forwarded-For', ip),
    get: (url: string) => request(app).get(url).set('X-Forwarded-For', ip),
  };
}

export async function createStaff(role: RoleKey, overrides: Partial<{ status: 'disabled' }> = {}) {
  const roleRow = await Role.findOne({ where: { key: role } });
  if (!roleRow) throw new Error(`role ${role} not seeded`);
  return User.create({
    name: `Test ${role}`,
    email: `${role}.${randomUUID()}@expressions.test`,
    phone: null,
    passwordHash: await hashPassword(PASSWORD),
    roleId: roleRow.id,
    ...overrides,
  });
}

export async function createPatient(phone: string, name = 'Test Patient') {
  return Patient.create({
    name,
    phone,
    email: null,
    dateOfBirth: null,
    gender: null,
    source: 'other',
    homeLocationId: null,
    isDemo: true,
  });
}

export function randomUkFictionPhone(): string {
  return `+447700900${String(randomInt(1000)).padStart(3, '0')}`;
}

/** Cookie header value built from a response's Set-Cookie headers. */
export function cookiesFrom(response: Response): string {
  const raw = response.headers['set-cookie'] as unknown as string[] | undefined;
  return (raw ?? []).map((cookie) => cookie.split(';')[0]).join('; ');
}

/** Signs in a role without 2FA (receptionist/assistant) and returns the session. */
export async function loginWithoutMfa(role: 'receptionist' | 'assistant') {
  const user = await createStaff(role);
  const client = api();
  const res = await client
    .post('/api/v1/auth/staff/login')
    .send({ email: user.email, password: PASSWORD });
  if (res.body.status !== 'ok') throw new Error(`unexpected login result ${res.status}`);
  return { user, client, res, accessToken: res.body.accessToken as string };
}

/** Signs in a 2FA role by completing enrolment; returns the session and the TOTP secret. */
export async function loginWithEnrolment(role: 'super_admin' | 'doctor') {
  const user = await createStaff(role);
  const client = api();
  const login = await client
    .post('/api/v1/auth/staff/login')
    .send({ email: user.email, password: PASSWORD });
  const setup = await client
    .post('/api/v1/auth/staff/2fa/setup')
    .send({ mfaToken: login.body.mfaToken });
  const secret = new URL(setup.body.otpauthUrl as string).searchParams.get('secret') ?? '';
  const res = await client
    .post('/api/v1/auth/staff/2fa/enable')
    .send({ mfaToken: login.body.mfaToken, code: authenticator.generate(secret) });
  return { user, client, res, secret, accessToken: res.body.accessToken as string };
}
