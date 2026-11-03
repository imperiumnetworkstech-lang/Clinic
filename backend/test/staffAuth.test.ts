import { authenticator } from 'otplib';
import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { AuditLog, RefreshToken, User } from '../src/models/index.js';
import {
  api,
  cookiesFrom,
  createStaff,
  loginWithEnrolment,
  loginWithoutMfa,
  PASSWORD,
} from './helpers.js';

describe('staff password login', () => {
  it('rejects an unknown email with a generic message', async () => {
    const res = await api()
      .post('/api/v1/auth/staff/login')
      .send({ email: 'nobody@expressions.test', password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('invalid_credentials');
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('rejects a wrong password and audits the failure without the password', async () => {
    const user = await createStaff('receptionist');
    const res = await api()
      .post('/api/v1/auth/staff/login')
      .send({ email: user.email, password: 'wrong password!!' });
    expect(res.status).toBe(401);
    const entry = await AuditLog.findOne({
      where: { action: 'auth.login_failed', actorId: user.id },
    });
    expect(entry?.meta).toEqual({ reason: 'bad_password' });
  });

  it('rejects disabled accounts', async () => {
    const user = await createStaff('receptionist', { status: 'disabled' });
    const res = await api()
      .post('/api/v1/auth/staff/login')
      .send({ email: user.email, password: PASSWORD });
    expect(res.status).toBe(401);
  });

  it('validates the body', async () => {
    const res = await api().post('/api/v1/auth/staff/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation_failed');
  });

  it('locks an account after 5 attempts in the window', async () => {
    const user = await createStaff('receptionist');
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const res = await api()
        .post('/api/v1/auth/staff/login')
        .send({ email: user.email, password: 'wrong password!!' });
      statuses.push(res.status);
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
  });

  it('signs in a role without 2FA and sets httpOnly refresh + CSRF cookies', async () => {
    const { res } = await loginWithoutMfa('receptionist');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', expiresIn: 900 });
    const cookies = res.headers['set-cookie'] as unknown as string[];
    const refresh = cookies.find((cookie) => cookie.startsWith('edc_srt='));
    expect(refresh).toMatch(/HttpOnly/);
    expect(refresh).toMatch(/SameSite=Strict/);
    expect(refresh).toMatch(/Path=\/api\/v1\/auth/);
    expect(cookies.some((cookie) => cookie.startsWith('edc_csrf='))).toBe(true);
  });
});

describe('staff two-factor authentication', () => {
  it('forces owners to enrol in 2FA before they get a session', async () => {
    const user = await createStaff('super_admin');
    const res = await api()
      .post('/api/v1/auth/staff/login')
      .send({ email: user.email, password: PASSWORD });
    expect(res.body.status).toBe('mfa_setup_required');
    expect(res.body.accessToken).toBeUndefined();
  });

  it('enrols, signs in, then requires a TOTP code at the next login', async () => {
    const { user, client, res, secret } = await loginWithEnrolment('super_admin');
    expect(res.status).toBe(200);
    expect((await User.findByPk(user.id))?.totpEnabled).toBe(true);

    const login = await client
      .post('/api/v1/auth/staff/login')
      .send({ email: user.email, password: PASSWORD });
    expect(login.body.status).toBe('mfa_required');

    // The enrolment code's time step was consumed, so replaying the same code fails.
    const replay = await client
      .post('/api/v1/auth/staff/2fa/verify')
      .send({ mfaToken: login.body.mfaToken, code: authenticator.generate(secret) });
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('invalid_code');

    await User.update({ totpLastStep: null }, { where: { id: user.id } });
    const verified = await client
      .post('/api/v1/auth/staff/2fa/verify')
      .send({ mfaToken: login.body.mfaToken, code: authenticator.generate(secret) });
    expect(verified.status).toBe(200);
    expect(verified.body.status).toBe('ok');
  });

  it('skips the TOTP step entirely in testing mode', async () => {
    const { user, client } = await loginWithEnrolment('super_admin');
    env.ENFORCE_STAFF_2FA = false;
    try {
      const login = await client
        .post('/api/v1/auth/staff/login')
        .send({ email: user.email, password: PASSWORD });
      expect(login.status).toBe(200);
      expect(login.body.status).toBe('ok');
    } finally {
      env.ENFORCE_STAFF_2FA = true;
    }
  });

  it('does not accept an MFA token from the wrong stage', async () => {
    const user = await createStaff('doctor');
    const client = api();
    const login = await client
      .post('/api/v1/auth/staff/login')
      .send({ email: user.email, password: PASSWORD });
    const res = await client
      .post('/api/v1/auth/staff/2fa/verify')
      .send({ mfaToken: login.body.mfaToken, code: '123456' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('invalid_mfa_token');
  });

  it('stores the TOTP secret encrypted', async () => {
    const { user, secret } = await loginWithEnrolment('doctor');
    const stored = (await User.findByPk(user.id))?.totpSecretEnc ?? '';
    expect(stored.startsWith('v1:')).toBe(true);
    expect(stored).not.toContain(secret);
  });
});

describe('staff sessions', () => {
  it('rotates the refresh token and revokes the family when an old token is reused', async () => {
    const { client, res } = await loginWithoutMfa('receptionist');
    const firstCookies = cookiesFrom(res);

    const rotated = await client
      .post('/api/v1/auth/staff/refresh')
      .set('Cookie', firstCookies)
      .set('X-CSRF-Token', res.body.csrfToken);
    expect(rotated.status).toBe(200);
    const newAccess = rotated.body.accessToken as string;

    const reuse = await client
      .post('/api/v1/auth/staff/refresh')
      .set('Cookie', firstCookies)
      .set('X-CSRF-Token', res.body.csrfToken);
    expect(reuse.status).toBe(401);
    expect(reuse.body.code).toBe('session_revoked');

    const me = await client.get('/api/v1/admin/me').set('Authorization', `Bearer ${newAccess}`);
    expect(me.status).toBe(401);
  });

  it('requires the CSRF header on refresh', async () => {
    const { client, res } = await loginWithoutMfa('receptionist');
    const refresh = await client.post('/api/v1/auth/staff/refresh').set('Cookie', cookiesFrom(res));
    expect(refresh.status).toBe(403);
    expect(refresh.body.code).toBe('csrf_failed');
  });

  it('logout ends the session immediately', async () => {
    const { client, res, accessToken } = await loginWithoutMfa('receptionist');
    const logout = await client
      .post('/api/v1/auth/staff/logout')
      .set('Cookie', cookiesFrom(res))
      .set('X-CSRF-Token', res.body.csrfToken);
    expect(logout.status).toBe(204);
    const me = await client.get('/api/v1/admin/me').set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(401);
  });

  it('deactivating a user cuts off an existing access token', async () => {
    const { user, client, accessToken } = await loginWithoutMfa('receptionist');
    await user.update({ status: 'disabled' });
    const me = await client.get('/api/v1/admin/me').set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(401);
  });

  it('stores only a hash of the refresh token', async () => {
    const { user, res } = await loginWithoutMfa('receptionist');
    const raw = cookiesFrom(res).match(/edc_srt=([^;]+)/)?.[1] ?? '';
    const stored = await RefreshToken.findOne({ where: { subjectId: user.id } });
    expect(stored?.tokenHash).toHaveLength(64);
    expect(stored?.tokenHash).not.toBe(raw);
  });
});
