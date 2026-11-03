import { describe, expect, it } from 'vitest';
import { AuditLog, Lead } from '../src/models/index.js';
import { api, loginWithEnrolment, loginWithoutMfa, randomUkFictionPhone } from './helpers.js';

const URL = '/api/v1/public/appointment-requests';

function inDays(days: number): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    reason: 'root-canal-treatment',
    branch: 'mapusa',
    preferredDate: inDays(2),
    timeOfDay: 'evening',
    patientFor: 'me',
    name: 'Demo Patient',
    phone: randomUkFictionPhone(),
    notes: 'Pain on the lower left side',
    consent: true,
    ...overrides,
  };
}

describe('website appointment requests', () => {
  it('stores a valid request as a new lead with a reference and consent record', async () => {
    const body = request();
    const res = await api().post(URL).send(body);
    expect(res.status).toBe(201);
    expect(res.body.reference).toMatch(/^REQ-\d{5}$/);

    const lead = await Lead.findOne({ where: { reference: res.body.reference } });
    expect(lead).toMatchObject({
      source: 'website_booking',
      status: 'new',
      name: 'Demo Patient',
      phone: body.phone,
      consentTextVersion: 'booking-2026-11-03',
    });
    expect(lead?.locationId).not.toBeNull();
    expect(lead?.details).toMatchObject({ reason: 'root-canal-treatment', timeOfDay: 'evening' });

    const entry = await AuditLog.findOne({ where: { action: 'lead.created', entityId: lead?.id } });
    expect(entry?.actorId).not.toBe(body.phone);
  });

  it('normalises Indian mobile numbers to E.164', async () => {
    const res = await api()
      .post(URL)
      .send(request({ phone: '98765 43210' }));
    expect(res.status).toBe(201);
    const lead = await Lead.findOne({ where: { reference: res.body.reference } });
    expect(lead?.phone).toBe('+919876543210');
  });

  it('requires consent and the core fields', async () => {
    const res = await api()
      .post(URL)
      .send(request({ consent: false, name: '', branch: 'goa' }));
    expect(res.status).toBe(400);
    const paths = res.body.errors.map((error: { path: string }) => error.path);
    expect(paths).toEqual(expect.arrayContaining(['consent', 'name', 'branch']));
  });

  it('rejects dates in the past or too far ahead', async () => {
    for (const preferredDate of [inDays(-1), inDays(120)]) {
      const res = await api().post(URL).send(request({ preferredDate }));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('date_out_of_range');
    }
  });

  it('limits repeat requests from the same phone', async () => {
    const phone = randomUkFictionPhone();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      statuses.push((await api().post(URL).send(request({ phone }))).status);
    }
    expect(statuses).toEqual([201, 201, 201, 429]);
  });
});

describe('enquiries inbox', () => {
  it('lets the front desk list leads and update their status, with an audit trail', async () => {
    const created = await api().post(URL).send(request());
    const lead = await Lead.findOne({ where: { reference: created.body.reference } });
    const { client, accessToken } = await loginWithoutMfa('receptionist');
    const auth = `Bearer ${accessToken}`;

    const list = await client.get('/api/v1/admin/leads?status=new').set('Authorization', auth);
    expect(list.status).toBe(200);
    expect(list.body.items.some((item: { id: string }) => item.id === lead?.id)).toBe(true);

    const update = await client
      .patch(`/api/v1/admin/leads/${lead?.id}`)
      .set('Authorization', auth)
      .send({ status: 'contacted' });
    expect(update.status).toBe(200);
    expect(
      await AuditLog.count({ where: { action: 'lead.status_changed', entityId: lead?.id } }),
    ).toBe(1);
  });

  it('keeps leads away from roles without leads permissions', async () => {
    const { client, accessToken } = await loginWithoutMfa('assistant');
    const res = await client
      .get('/api/v1/admin/leads')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });

  it('lets the owner see leads too', async () => {
    const { client, accessToken } = await loginWithEnrolment('super_admin');
    const res = await client
      .get('/api/v1/admin/leads')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
  });
});
