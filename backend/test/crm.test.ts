import { beforeAll, describe, expect, it } from 'vitest';
import { ClinicalNote, Patient, RefreshToken } from '../src/models/index.js';
import { addDays, todayInGoa } from '../src/services/availability.js';
import {
  createStaff,
  loginWithEnrolment,
  loginWithoutMfa,
  randomUkFictionPhone,
} from './helpers.js';

type Session = Awaited<ReturnType<typeof loginWithoutMfa>>;
const bearer = (session: { accessToken: string }) => `Bearer ${session.accessToken}`;

let desk: Session;
let doctor: Awaited<ReturnType<typeof loginWithEnrolment>>;
let assistant: Session;

beforeAll(async () => {
  desk = await loginWithoutMfa('receptionist');
  assistant = await loginWithoutMfa('assistant');
  doctor = await loginWithEnrolment('doctor');
});

async function register(name = 'Demo CRM Patient') {
  const res = await desk.client
    .post('/api/v1/admin/patients')
    .set('Authorization', bearer(desk))
    .send({ name, phone: randomUkFictionPhone(), email: '', homeBranch: 'mapusa' });
  expect(res.status).toBe(201);
  return res.body as { id: string; code: string };
}

/** A far-future weekday at a fixed Goa time, so tests never collide with the clock. */
const slot = (dayOffset: number, time: string) =>
  new Date(`${addDays(todayInGoa(), dayOffset)}T${time}:00+05:30`).toISOString();

describe('patients CRM', () => {
  it('registers, finds and refuses duplicates', async () => {
    const phone = randomUkFictionPhone();
    const created = await desk.client
      .post('/api/v1/admin/patients')
      .set('Authorization', bearer(desk))
      .send({ name: 'Demo Search Person', phone });
    expect(created.status).toBe(201);
    expect(created.body.code).toMatch(/^EDC-\d{6}$/);

    const again = await desk.client
      .post('/api/v1/admin/patients')
      .set('Authorization', bearer(desk))
      .send({ name: 'demo search person', phone });
    expect(again.status).toBe(409);
    expect(again.body.details.id).toBe(created.body.id);

    const found = await desk.client
      .get('/api/v1/admin/patients?q=Search Person')
      .set('Authorization', bearer(desk));
    expect(found.body.items.map((p: { id: string }) => p.id)).toContain(created.body.id);
    const byPhone = await desk.client
      .get(`/api/v1/admin/patients?q=${phone.slice(-6)}`)
      .set('Authorization', bearer(desk));
    expect(byPhone.body.total).toBeGreaterThanOrEqual(1);
  });

  it('keeps clinical data from staff without clinical access', async () => {
    const { id } = await register();
    const asDesk = await desk.client
      .get(`/api/v1/admin/patients/${id}`)
      .set('Authorization', bearer(desk));
    expect(asDesk.status).toBe(200);
    expect(asDesk.body.clinical).toBeNull();

    const write = await desk.client
      .put(`/api/v1/admin/patients/${id}/medical-history`)
      .set('Authorization', bearer(desk))
      .send({ allergies: 'Penicillin' });
    expect(write.status).toBe(403);

    const assistantCreate = await assistant.client
      .post('/api/v1/admin/patients')
      .set('Authorization', bearer(assistant))
      .send({ name: 'Nope', phone: randomUkFictionPhone() });
    expect(assistantCreate.status).toBe(403);
  });

  it('stores medical history and notes encrypted and shows them to doctors', async () => {
    const { id } = await register();
    await doctor.client
      .put(`/api/v1/admin/patients/${id}/medical-history`)
      .set('Authorization', bearer(doctor))
      .send({ allergies: 'Penicillin', conditions: '', medications: 'Metformin', notes: '' })
      .expect(200);
    await doctor.client
      .post(`/api/v1/admin/patients/${id}/notes`)
      .set('Authorization', bearer(doctor))
      .send({ body: 'Deep caries on 36; RCT advised.' })
      .expect(201);

    const raw = await Patient.findByPk(id);
    expect(raw?.medicalHistory).toMatch(/^v1:/);
    expect(raw?.medicalHistory).not.toContain('Penicillin');
    const note = await ClinicalNote.findOne({ where: { patientId: id } });
    expect(note?.body).toMatch(/^v1:/);

    const record = await doctor.client
      .get(`/api/v1/admin/patients/${id}`)
      .set('Authorization', bearer(doctor));
    expect(record.body.clinical.medicalHistory).toMatchObject({
      allergies: 'Penicillin',
      medications: 'Metformin',
    });
    expect(record.body.clinical.notes[0].body).toBe('Deep caries on 36; RCT advised.');
    expect(record.body.timeline.map((e: { kind: string }) => e.kind)).toContain('note');
  });

  it('moves a treatment plan along as items are done', async () => {
    const { id } = await register();
    const created = await doctor.client
      .post(`/api/v1/admin/patients/${id}/plans`)
      .set('Authorization', bearer(doctor))
      .send({
        title: 'Lower left molar',
        notes: 'Discussed options',
        items: [
          { treatment: 'root-canal-treatment', tooth: '36', sessions: 2 },
          { treatment: 'dental-crowns', tooth: '36' },
        ],
      });
    expect(created.status).toBe(201);
    await doctor.client
      .patch(`/api/v1/admin/plans/${created.body.id}`)
      .set('Authorization', bearer(doctor))
      .send({ status: 'accepted' })
      .expect(200);

    const record = await doctor.client
      .get(`/api/v1/admin/patients/${id}`)
      .set('Authorization', bearer(doctor));
    const [first, second] = record.body.clinical.plans[0].items;
    expect(record.body.clinical.plans[0].notes).toBe('Discussed options');

    const one = await doctor.client
      .patch(`/api/v1/admin/plan-items/${first.id}`)
      .set('Authorization', bearer(doctor))
      .send({ status: 'done' });
    expect(one.body.planStatus).toBe('in_progress');
    const two = await doctor.client
      .patch(`/api/v1/admin/plan-items/${second.id}`)
      .set('Authorization', bearer(doctor))
      .send({ status: 'done' });
    expect(two.body.planStatus).toBe('completed');
  });

  it('lists patients due for recall', async () => {
    const { id } = await register('Demo Recall Patient');
    await desk.client
      .patch(`/api/v1/admin/patients/${id}`)
      .set('Authorization', bearer(desk))
      .send({ nextRecallOn: addDays(todayInGoa(), 10), recallNote: '6-month check-up' })
      .expect(200);
    const due = await desk.client
      .get('/api/v1/admin/patients?recall=due&pageSize=100')
      .set('Authorization', bearer(desk));
    expect(due.body.items.map((p: { id: string }) => p.id)).toContain(id);
  });
});

describe('calendar', () => {
  it('books by phone, refuses double-booking unless forced, and moves', async () => {
    const a = await register();
    const b = await register();
    const dentists = await desk.client
      .get('/api/v1/admin/dentists')
      .set('Authorization', bearer(desk));
    const dentistId = (dentists.body as Array<{ id: string }>).find(
      (d) => d.id === doctor.user.id,
    )?.id;
    expect(dentistId).toBeDefined();

    const book = (patientId: string, startAt: string, extra: Record<string, unknown> = {}) =>
      desk.client
        .post('/api/v1/admin/appointments')
        .set('Authorization', bearer(desk))
        .send({
          patientId,
          branch: 'candolim',
          startAt,
          durationMinutes: 30,
          reason: 'checkup',
          dentistId,
          ...extra,
        });

    const first = await book(a.id, slot(40, '11:00'));
    expect(first.status).toBe(201);
    expect(first.body.reference).toMatch(/^APT-/);

    const clash = await book(b.id, slot(40, '11:15'));
    expect(clash.status).toBe(409);
    expect(clash.body.code).toBe('slot_full');

    const forced = await book(b.id, slot(40, '11:15'), { force: true, dentistId: null });
    expect(forced.status).toBe(201);

    const moved = await desk.client
      .patch(`/api/v1/admin/appointments/${first.body.id}/time`)
      .set('Authorization', bearer(desk))
      .send({ startAt: slot(40, '15:00') });
    expect(moved.status).toBe(200);
    expect(moved.body.startAt).toBe(slot(40, '15:00'));

    const week = await desk.client
      .get(`/api/v1/admin/calendar?from=${addDays(todayInGoa(), 40)}&days=1&branch=candolim`)
      .set('Authorization', bearer(desk));
    const mine = week.body.items.find((item: { id: string }) => item.id === first.body.id);
    expect(mine).toMatchObject({ status: 'confirmed', source: 'phone' });
    expect(mine.dentist.id).toBe(dentistId);
  });

  it('refuses a dentist who is already with a patient', async () => {
    const a = await register();
    const b = await register();
    const send = (patientId: string, branch: string) =>
      desk.client
        .post('/api/v1/admin/appointments')
        .set('Authorization', bearer(desk))
        .send({
          patientId,
          branch,
          startAt: slot(41, '12:00'),
          durationMinutes: 45,
          reason: 'checkup',
          dentistId: doctor.user.id,
        });
    expect((await send(a.id, 'candolim')).status).toBe(201);
    const busy = await send(b.id, 'mapusa');
    expect(busy.status).toBe(409);
    expect(busy.body.code).toBe('dentist_busy');
  });
});

describe('dashboard and staff', () => {
  it('summarises the clinic without patient details', async () => {
    const res = await desk.client.get('/api/v1/admin/dashboard').set('Authorization', bearer(desk));
    expect(res.status).toBe(200);
    expect(res.body.bookings30d).toHaveLength(30);
    expect(res.body.today).toHaveProperty('total');
    expect(JSON.stringify(res.body)).not.toMatch(/Demo CRM Patient/);
  });

  it('lets an owner change roles, ending that person’s sessions', async () => {
    const owner = await loginWithEnrolment('super_admin');
    const target = await loginWithoutMfa('assistant');
    const res = await owner.client
      .patch(`/api/v1/admin/staff/${target.user.id}`)
      .set('Authorization', bearer(owner))
      .send({ role: 'receptionist' });
    expect(res.status).toBe(200);
    const live = await RefreshToken.count({
      where: { subjectType: 'staff', subjectId: target.user.id, revokedAt: null },
    });
    expect(live).toBe(0);

    const self = await owner.client
      .patch(`/api/v1/admin/staff/${owner.user.id}`)
      .set('Authorization', bearer(owner))
      .send({ status: 'disabled' });
    expect(self.status).toBe(403);
  });

  it('stops non-owners from touching owner accounts', async () => {
    const someOwner = await createStaff('super_admin');
    const deskAdmin = await loginWithoutMfa('receptionist');
    const res = await deskAdmin.client
      .patch(`/api/v1/admin/staff/${someOwner.id}`)
      .set('Authorization', bearer(deskAdmin))
      .send({ status: 'disabled' });
    expect(res.status).toBe(403);
  });
});
