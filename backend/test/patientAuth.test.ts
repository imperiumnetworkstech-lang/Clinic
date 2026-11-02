import { afterEach, describe, expect, it, vi } from 'vitest';
import { OtpChallenge } from '../src/models/index.js';
import { otpDelivery } from '../src/services/otpDelivery.js';
import { api, cookiesFrom, createPatient, randomUkFictionPhone } from './helpers.js';

function captureCodes() {
  const codes: string[] = [];
  vi.spyOn(otpDelivery, 'send').mockImplementation(async (_phone, code) => {
    codes.push(code);
  });
  return codes;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('patient OTP login', () => {
  it('answers identically for unknown numbers and sends nothing', async () => {
    const codes = captureCodes();
    const phone = randomUkFictionPhone();
    const res = await api().post('/api/v1/auth/patient/otp/send').send({ phone });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ status: 'sent', expiresIn: 300 });
    expect(codes).toHaveLength(0);
    expect(await OtpChallenge.count({ where: { phone } })).toBe(0);
  });

  it('logs in with the right code and shows every profile on that phone', async () => {
    const phone = randomUkFictionPhone();
    await createPatient(phone, 'Parent Patient');
    await createPatient(phone, 'Child Patient');
    const codes = captureCodes();
    const client = api();

    await client.post('/api/v1/auth/patient/otp/send').send({ phone });
    const stored = await OtpChallenge.findOne({ where: { phone } });
    expect(stored?.codeHash).not.toContain(codes[0]);

    const verify = await client
      .post('/api/v1/auth/patient/otp/verify')
      .send({ phone, code: codes[0] });
    expect(verify.status).toBe(200);

    const me = await client
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${verify.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.profiles.map((p: { name: string }) => p.name).sort()).toEqual([
      'Child Patient',
      'Parent Patient',
    ]);

    const reused = await client
      .post('/api/v1/auth/patient/otp/verify')
      .send({ phone, code: codes[0] });
    expect(reused.status).toBe(401);

    const logout = await client
      .post('/api/v1/auth/patient/logout')
      .set('Cookie', cookiesFrom(verify))
      .set('X-CSRF-Token', verify.body.csrfToken);
    expect(logout.status).toBe(204);
  });

  it('burns the code after 5 wrong attempts', async () => {
    const phone = randomUkFictionPhone();
    await createPatient(phone);
    const codes = captureCodes();
    const client = api();
    await client.post('/api/v1/auth/patient/otp/send').send({ phone });
    const wrong = codes[0] === '000000' ? '111111' : '000000';

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const res = await client.post('/api/v1/auth/patient/otp/verify').send({ phone, code: wrong });
      expect(res.status).toBe(401);
    }
    const right = await client
      .post('/api/v1/auth/patient/otp/verify')
      .send({ phone, code: codes[0] });
    expect(right.status).toBe(401);
  });

  it('a patient token cannot reach the admin API', async () => {
    const phone = randomUkFictionPhone();
    await createPatient(phone);
    const codes = captureCodes();
    const client = api();
    await client.post('/api/v1/auth/patient/otp/send').send({ phone });
    const verify = await client
      .post('/api/v1/auth/patient/otp/verify')
      .send({ phone, code: codes[0] });
    const admin = await client
      .get('/api/v1/admin/me')
      .set('Authorization', `Bearer ${verify.body.accessToken}`);
    expect(admin.status).toBe(403);
  });

  it('limits OTP sends per phone', async () => {
    const phone = randomUkFictionPhone();
    captureCodes();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      statuses.push((await api().post('/api/v1/auth/patient/otp/send').send({ phone })).status);
    }
    expect(statuses).toEqual([202, 202, 202, 429]);
  });
});
