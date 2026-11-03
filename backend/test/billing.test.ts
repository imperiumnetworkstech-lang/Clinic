import { beforeAll, describe, expect, it } from 'vitest';
import { PatientFile } from '../src/models/index.js';
import { loginWithEnrolment, loginWithoutMfa, randomUkFictionPhone } from './helpers.js';

type Session = Pick<Awaited<ReturnType<typeof loginWithoutMfa>>, 'client' | 'accessToken'>;
const bearer = (session: { accessToken: string }) => `Bearer ${session.accessToken}`;

let desk: Session;
let doctor: Session;
let assistant: Session;

beforeAll(async () => {
  desk = await loginWithoutMfa('receptionist');
  assistant = await loginWithoutMfa('assistant');
  doctor = await loginWithEnrolment('doctor');
});

async function patient() {
  const res = await desk.client
    .post('/api/v1/admin/patients')
    .set('Authorization', bearer(desk))
    .send({ name: 'Demo Billing Patient', phone: randomUkFictionPhone() });
  return res.body.id as string;
}

async function invoice(patientId: string, extra: Record<string, unknown> = {}) {
  return desk.client
    .post('/api/v1/admin/invoices')
    .set('Authorization', bearer(desk))
    .send({
      patientId,
      branch: 'mapusa',
      items: [
        { description: 'Root canal treatment', tooth: '36', unitPaise: 450_000 },
        { description: 'X-ray (IOPA)', quantity: 2, unitPaise: 20_000 },
      ],
      discountPaise: 40_000,
      ...extra,
    });
}

const pay = (id: string, amountPaise: number, method = 'upi') =>
  desk.client
    .post(`/api/v1/admin/invoices/${id}/payments`)
    .set('Authorization', bearer(desk))
    .send({ amountPaise, method, reference: method === 'upi' ? 'UPI123' : '' });

describe('invoices and payments', () => {
  it('totals lines, takes part payments, refuses overpayment and closes the balance', async () => {
    const created = await invoice(await patient());
    expect(created.status).toBe(201);
    expect(created.body.number).toMatch(/^INV-\d{6}$/);
    expect(created.body.totalPaise).toBe(450_000 + 40_000 - 40_000);

    const first = await pay(created.body.id, 200_000);
    expect(first.status).toBe(201);
    expect(first.body.receiptNumber).toMatch(/^RCT-\d{6}$/);

    const over = await pay(created.body.id, 300_000);
    expect(over.status).toBe(400);
    expect(over.body.code).toBe('overpayment');
    expect(over.body.details.balance).toBe(250_000);

    const due = await desk.client
      .get('/api/v1/admin/invoices?due=true&pageSize=100')
      .set('Authorization', bearer(desk));
    expect(due.body.items.map((i: { id: string }) => i.id)).toContain(created.body.id);
    expect(due.body.outstanding).toBeGreaterThanOrEqual(250_000);

    expect((await pay(created.body.id, 250_000, 'cash')).status).toBe(201);
    const detail = await desk.client
      .get(`/api/v1/admin/invoices/${created.body.id}`)
      .set('Authorization', bearer(desk));
    expect(detail.body).toMatchObject({ paidPaise: 450_000, totalPaise: 450_000 });
    expect(detail.body.items).toHaveLength(2);
    expect(detail.body.payments).toHaveLength(2);

    const stillDue = await desk.client
      .get('/api/v1/admin/invoices?due=true&pageSize=100')
      .set('Authorization', bearer(desk));
    expect(stillDue.body.items.map((i: { id: string }) => i.id)).not.toContain(created.body.id);
  });

  it('refuses a discount bigger than the bill', async () => {
    const res = await invoice(await patient(), { discountPaise: 10_000_000 });
    expect(res.status).toBe(400);
  });

  it('voids payments before the invoice', async () => {
    const created = await invoice(await patient());
    const payment = await pay(created.body.id, 100_000);
    const blocked = await desk.client
      .post(`/api/v1/admin/invoices/${created.body.id}/void`)
      .set('Authorization', bearer(desk))
      .send({ reason: 'Entered twice' });
    expect(blocked.body.code).toBe('has_payments');

    await desk.client
      .post(`/api/v1/admin/payments/${payment.body.id}/void`)
      .set('Authorization', bearer(desk))
      .send({ reason: 'Wrong invoice' })
      .expect(200);
    const voided = await desk.client
      .post(`/api/v1/admin/invoices/${created.body.id}/void`)
      .set('Authorization', bearer(desk))
      .send({ reason: 'Entered twice' });
    expect(voided.body.status).toBe('void');
    expect((await pay(created.body.id, 100)).body.code).toBe('invoice_void');
  });

  it('produces invoice and receipt PDFs', async () => {
    const created = await invoice(await patient());
    const payment = await pay(created.body.id, 50_000);
    const pdf = await desk.client
      .get(`/api/v1/admin/invoices/${created.body.id}/pdf`)
      .set('Authorization', bearer(desk))
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      });
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');

    const receipt = await desk.client
      .get(`/api/v1/admin/payments/${payment.body.id}/receipt`)
      .set('Authorization', bearer(desk));
    expect(receipt.status).toBe(200);
    expect(receipt.headers['content-type']).toBe('application/pdf');
  });

  it('sums the day’s collections by method', async () => {
    const created = await invoice(await patient());
    await pay(created.body.id, 12_300, 'card');
    const summary = await desk.client
      .get('/api/v1/admin/billing/summary')
      .set('Authorization', bearer(desk));
    expect(summary.body.byMethod.card).toBeGreaterThanOrEqual(12_300);
    expect(summary.body.totalPaise).toBeGreaterThanOrEqual(12_300);
  });

  it('keeps billing to roles that have it', async () => {
    const id = await patient();
    expect(
      (await assistant.client.get('/api/v1/admin/invoices').set('Authorization', bearer(assistant)))
        .status,
    ).toBe(403);
    const doctorWrite = await doctor.client
      .post('/api/v1/admin/invoices')
      .set('Authorization', bearer(doctor))
      .send({
        patientId: id,
        branch: 'mapusa',
        items: [{ description: 'Check-up', unitPaise: 50_000 }],
      });
    expect(doctorWrite.status).toBe(403);
  });
});

describe('patient files', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  it('uploads through a signed link, lists, views, shares and deletes', async () => {
    const id = await patient();
    const start = await doctor.client
      .post(`/api/v1/admin/patients/${id}/files`)
      .set('Authorization', bearer(doctor))
      .send({
        kind: 'xray',
        fileName: 'demo-xray.png',
        contentType: 'image/png',
        sizeBytes: png.length,
      });
    expect(start.status).toBe(201);
    const uploadPath = start.body.upload.url as string;

    const wrongType = await doctor.client
      .put(uploadPath)
      .set('Content-Type', 'image/jpeg')
      .send(png);
    expect(wrongType.body.code).toBe('content_type_mismatch');
    await doctor.client.put(uploadPath).set('Content-Type', 'image/png').send(png).expect(204);
    await doctor.client
      .post(`/api/v1/admin/files/${start.body.id}/complete`)
      .set('Authorization', bearer(doctor))
      .expect(200);

    const stored = await PatientFile.findByPk(start.body.id);
    expect(stored?.name).toMatch(/^v1:/);
    expect(stored?.storageKey).not.toContain(id);

    const list = await doctor.client
      .get(`/api/v1/admin/patients/${id}/files`)
      .set('Authorization', bearer(doctor));
    expect(list.body.items[0]).toMatchObject({ name: 'demo-xray.png', kind: 'xray' });

    const view = await doctor.client
      .get(`/api/v1/admin/files/${start.body.id}/url`)
      .set('Authorization', bearer(doctor));
    const object = await doctor.client.get(view.body.url as string);
    expect(object.status).toBe(200);
    expect(object.headers['content-type']).toBe('image/png');

    const tampered = (view.body.url as string).replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'));
    expect((await doctor.client.get(tampered)).status).toBe(401);

    const share = await doctor.client
      .post(`/api/v1/admin/files/${start.body.id}/share`)
      .set('Authorization', bearer(doctor))
      .send({ hours: 48 });
    expect(share.status).toBe(200);
    expect(new Date(share.body.expiresAt).getTime()).toBeGreaterThan(Date.now() + 47 * 3_600_000);

    await doctor.client
      .delete(`/api/v1/admin/files/${start.body.id}`)
      .set('Authorization', bearer(doctor))
      .expect(204);
    expect((await doctor.client.get(view.body.url as string)).status).toBe(404);
  });

  it('keeps files from staff without clinical access', async () => {
    const id = await patient();
    const res = await desk.client
      .get(`/api/v1/admin/patients/${id}/files`)
      .set('Authorization', bearer(desk));
    expect(res.status).toBe(403);
  });
});
