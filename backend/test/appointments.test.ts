import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Appointment, Patient } from '../src/models/index.js';
import { addDays, todayInGoa } from '../src/services/availability.js';
import { emailDelivery } from '../src/services/emailDelivery.js';
import {
  api,
  cookiesFrom,
  loginWithEnrolment,
  loginWithoutMfa,
  randomUkFictionPhone,
} from './helpers.js';

/** The next Monday–Saturday at least two days out, so the 2-hour notice never interferes. */
function nextOpenDay(after = 2): string {
  for (let offset = after; offset < after + 7; offset += 1) {
    const date = addDays(todayInGoa(), offset);
    if (new Date(`${date}T00:00:00Z`).getUTCDay() !== 0) return date;
  }
  throw new Error('no open day');
}

function nextSunday(): string {
  for (let offset = 1; offset <= 7; offset += 1) {
    const date = addDays(todayInGoa(), offset);
    if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0) return date;
  }
  throw new Error('no sunday');
}

const at = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`).toISOString();

function booking(overrides: Record<string, unknown> = {}) {
  return {
    reason: 'checkup',
    branch: 'mapusa',
    slotStart: at(nextOpenDay(), '10:00'),
    patientFor: 'me',
    name: 'Demo Patient',
    phone: randomUkFictionPhone(),
    email: '',
    notes: '',
    consent: true,
    ...overrides,
  };
}

const auth = (token: string) => `Bearer ${token}`;

let ownerToken = '';

beforeAll(async () => {
  // Known schedule for these tests: Mon–Sat 10:00–13:00 and 14:00–20:00, 30-minute slots.
  const { client, accessToken } = await loginWithEnrolment('super_admin');
  ownerToken = accessToken;
  const day = [
    { open: '10:00', close: '13:00' },
    { open: '14:00', close: '20:00' },
  ];
  const res = await client
    .put('/api/v1/admin/schedules/mapusa')
    .set('Authorization', auth(accessToken))
    .send({
      active: true,
      slotMinutes: 30,
      capacity: 1,
      minNoticeMinutes: 120,
      maxDaysAhead: 60,
      weekly: {
        monday: day,
        tuesday: day,
        wednesday: day,
        thursday: day,
        friday: day,
        saturday: day,
        sunday: [],
      },
    });
  expect(res.status).toBe(200);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('availability', () => {
  it('lists which branches take online bookings', async () => {
    const res = await api().get('/api/v1/public/branches');
    const byId = Object.fromEntries(res.body.map((b: { id: string }) => [b.id, b]));
    expect(byId.mapusa.onlineBooking).toBe(true);
    expect(byId.candolim.onlineBooking).toBe(false);
  });

  it('generates slots from the schedule, skipping the lunch break', async () => {
    const res = await api().get(`/api/v1/public/availability/mapusa/${nextOpenDay(10)}`);
    expect(res.status).toBe(200);
    const times = res.body.slots.map((slot: { time: string }) => slot.time);
    expect(times).toHaveLength(6 + 12);
    expect(times[0]).toBe('10:00');
    expect(times).not.toContain('13:00');
    expect(times).toContain('14:00');
    expect(times.at(-1)).toBe('19:30');
  });

  it('shows Sundays as closed in the overview', async () => {
    const sunday = nextSunday();
    const res = await api().get(`/api/v1/public/availability/mapusa?from=${sunday}&days=1`);
    expect(res.body[0]).toEqual({ date: sunday, open: false, availableCount: 0 });
  });

  it('has no online booking for a branch without a schedule', async () => {
    const res = await api().get(`/api/v1/public/availability/candolim/${nextOpenDay()}`);
    expect(res.status).toBe(404);
  });
});

describe('booking a slot', () => {
  it('books a pending appointment and blocks the same slot for others', async () => {
    const slotStart = at(nextOpenDay(3), '11:00');
    const first = await api().post('/api/v1/public/appointments').send(booking({ slotStart }));
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ status: 'pending', startAt: slotStart });
    expect(first.body.reference).toMatch(/^APT-\d{5}$/);

    const second = await api().post('/api/v1/public/appointments').send(booking({ slotStart }));
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('slot_taken');

    const day = await api().get(`/api/v1/public/availability/mapusa/${nextOpenDay(3)}`);
    const slot = day.body.slots.find((s: { start: string }) => s.start === slotStart);
    expect(slot.available).toBe(false);
  });

  it('rejects times that are not on the schedule', async () => {
    const res = await api()
      .post('/api/v1/public/appointments')
      .send(booking({ slotStart: at(nextOpenDay(4), '13:30') }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('slot_invalid');
  });

  it('reuses the patient for the same phone and name, but not for a family member', async () => {
    const phone = randomUkFictionPhone();
    const date = nextOpenDay(5);
    await api()
      .post('/api/v1/public/appointments')
      .send(booking({ phone, name: 'Asha Naik', slotStart: at(date, '15:00') }));
    await api()
      .post('/api/v1/public/appointments')
      .send(booking({ phone, name: 'asha naik', slotStart: at(date, '15:30') }));
    await api()
      .post('/api/v1/public/appointments')
      .send(booking({ phone, name: 'Riya Naik', slotStart: at(date, '16:00') }));
    expect(await Patient.count({ where: { phone } })).toBe(2);
  });

  it('closes a day marked as a holiday', async () => {
    const date = nextOpenDay(6);
    const { client, accessToken } = await loginWithEnrolment('super_admin');
    const added = await client
      .post('/api/v1/admin/schedules/mapusa/holidays')
      .set('Authorization', auth(accessToken))
      .send({ date, reason: 'Festival' });
    expect(added.status).toBe(201);
    const day = await api().get(`/api/v1/public/availability/mapusa/${date}`);
    expect(day.body.slots).toEqual([]);
    const res = await api()
      .post('/api/v1/public/appointments')
      .send(booking({ slotStart: at(date, '10:00') }));
    expect(res.status).toBe(400);
  });
});

describe('front desk', () => {
  it('lists the day’s appointments and moves them through the allowed statuses', async () => {
    const date = nextOpenDay(7);
    const booked = await api()
      .post('/api/v1/public/appointments')
      .send(booking({ slotStart: at(date, '17:00') }));
    const { client, accessToken } = await loginWithoutMfa('receptionist');

    const list = await client
      .get(`/api/v1/admin/appointments?date=${date}&branch=mapusa`)
      .set('Authorization', auth(accessToken));
    const item = list.body.items.find(
      (a: { reference: string }) => a.reference === booked.body.reference,
    );
    expect(item.patient.name).toBe('Demo Patient');

    const skip = await client
      .patch(`/api/v1/admin/appointments/${item.id}`)
      .set('Authorization', auth(accessToken))
      .send({ status: 'completed' });
    expect(skip.status).toBe(400);
    expect(skip.body.code).toBe('invalid_transition');

    for (const status of ['confirmed', 'checked_in', 'completed']) {
      const res = await client
        .patch(`/api/v1/admin/appointments/${item.id}`)
        .set('Authorization', auth(accessToken))
        .send({ status });
      expect(res.status).toBe(200);
    }
    const stored = await Appointment.findByPk(item.id);
    expect(stored?.confirmedAt).not.toBeNull();
  });

  it('lets only roles with settings permission change the schedule', async () => {
    const { client, accessToken } = await loginWithoutMfa('receptionist');
    const res = await client
      .put('/api/v1/admin/schedules/mapusa')
      .set('Authorization', auth(accessToken))
      .send({});
    expect(res.status).toBe(403);
  });

  it('rejects overlapping hours on the same day', async () => {
    const res = await api()
      .put('/api/v1/admin/schedules/mapusa')
      .set('Authorization', auth(ownerToken))
      .send({
        active: true,
        slotMinutes: 30,
        capacity: 1,
        minNoticeMinutes: 120,
        maxDaysAhead: 60,
        weekly: {
          monday: [
            { open: '10:00', close: '14:00' },
            { open: '13:00', close: '18:00' },
          ],
          tuesday: [],
          wednesday: [],
          thursday: [],
          friday: [],
          saturday: [],
          sunday: [],
        },
      });
    expect(res.status).toBe(400);
  });
});

describe('patient portal by email link', () => {
  function captureLinks() {
    const links: string[] = [];
    vi.spyOn(emailDelivery, 'send').mockImplementation(async (message) => {
      const match = message.text.match(/token=([^\s]+)/);
      if (match?.[1]) links.push(decodeURIComponent(match[1]));
    });
    return links;
  }

  it('signs in with a one-time link and lets the patient cancel', async () => {
    const email = `patient.${Date.now()}@example.test`;
    const date = nextOpenDay(8);
    const booked = await api()
      .post('/api/v1/public/appointments')
      .send(booking({ email, slotStart: at(date, '18:00') }));
    expect(booked.status).toBe(201);

    const tokens = captureLinks();
    const client = api();
    const sent = await client.post('/api/v1/auth/patient/email-link').send({ email });
    expect(sent.status).toBe(202);
    expect(tokens).toHaveLength(1);

    const verify = await client
      .post('/api/v1/auth/patient/email-link/verify')
      .send({ token: tokens[0] });
    expect(verify.status).toBe(200);
    const bearer = auth(verify.body.accessToken);

    const reuse = await client
      .post('/api/v1/auth/patient/email-link/verify')
      .send({ token: tokens[0] });
    expect(reuse.status).toBe(401);

    const mine = await client.get('/api/v1/me/appointments').set('Authorization', bearer);
    const upcoming = mine.body.upcoming.find(
      (a: { reference: string }) => a.reference === booked.body.reference,
    );
    expect(upcoming).toMatchObject({ status: 'pending', canCancel: true });

    const cancel = await client
      .post(`/api/v1/me/appointments/${upcoming.id}/cancel`)
      .set('Authorization', bearer);
    expect(cancel.status).toBe(200);
    const day = await api().get(`/api/v1/public/availability/mapusa/${date}`);
    const freed = day.body.slots.find((s: { start: string }) => s.start === at(date, '18:00'));
    expect(freed.available).toBe(true);

    const logout = await client
      .post('/api/v1/auth/patient/logout')
      .set('Cookie', cookiesFrom(verify))
      .set('X-CSRF-Token', verify.body.csrfToken);
    expect(logout.status).toBe(204);
  });

  it('moves a booking to another free time and back to pending', async () => {
    const email = `move.${Date.now()}@example.test`;
    const date = nextOpenDay(10);
    const booked = await api()
      .post('/api/v1/public/appointments')
      .send(booking({ email, slotStart: at(date, '15:00') }));
    const blocker = await api()
      .post('/api/v1/public/appointments')
      .send(booking({ slotStart: at(date, '16:00') }));
    expect(blocker.status).toBe(201);
    const row = await Appointment.findOne({ where: { reference: booked.body.reference } });
    await row?.update({ status: 'confirmed' });

    const tokens = captureLinks();
    const client = api();
    await client.post('/api/v1/auth/patient/email-link').send({ email });
    const verify = await client
      .post('/api/v1/auth/patient/email-link/verify')
      .send({ token: tokens[0] });
    const bearer = auth(verify.body.accessToken);
    const move = (slotStart: string) =>
      client
        .post(`/api/v1/me/appointments/${row?.id}/reschedule`)
        .set('Authorization', bearer)
        .send({ slotStart });

    expect((await move(at(date, '16:00'))).status).toBe(409);
    expect((await move(at(date, '13:30'))).body.code).toBe('slot_invalid');

    const moved = await move(at(date, '17:30'));
    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({ status: 'pending', startAt: at(date, '17:30') });

    const day = await api().get(`/api/v1/public/availability/mapusa/${date}`);
    const slot = (time: string) =>
      day.body.slots.find((s: { start: string }) => s.start === at(date, time));
    expect(slot('15:00').available).toBe(true);
    expect(slot('17:30').available).toBe(false);

    // Moving within its own current time is allowed (it doesn't block itself).
    expect((await move(at(date, '17:30'))).status).toBe(200);
  });

  it('answers the same for unknown addresses and sends nothing', async () => {
    const tokens = captureLinks();
    const res = await api()
      .post('/api/v1/auth/patient/email-link')
      .send({ email: 'nobody.here@example.test' });
    expect(res.status).toBe(202);
    expect(tokens).toHaveLength(0);
  });

  it('cannot see or cancel other patients’ appointments', async () => {
    const email = `other.${Date.now()}@example.test`;
    const date = nextOpenDay(9);
    await api()
      .post('/api/v1/public/appointments')
      .send(booking({ email, slotStart: at(date, '10:00') }));
    const stranger = await api()
      .post('/api/v1/public/appointments')
      .send(booking({ slotStart: at(date, '10:30') }));
    const strangerRow = await Appointment.findOne({
      where: { reference: stranger.body.reference },
    });

    const tokens = captureLinks();
    const client = api();
    await client.post('/api/v1/auth/patient/email-link').send({ email });
    const verify = await client
      .post('/api/v1/auth/patient/email-link/verify')
      .send({ token: tokens[0] });
    const res = await client
      .post(`/api/v1/me/appointments/${strangerRow?.id}/cancel`)
      .set('Authorization', auth(verify.body.accessToken));
    expect(res.status).toBe(404);
  });
});
