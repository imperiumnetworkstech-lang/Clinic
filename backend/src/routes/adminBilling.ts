import { invoiceBody, paymentBody, voidBody } from '@edc/shared';
import { Router, type Response } from 'express';
import { literal, Op, QueryTypes } from 'sequelize';
import { z } from 'zod';
import { sequelize } from '../db/sequelize.js';
import { badRequest, notFound } from '../lib/errors.js';
import { requirePermission, requireStaff, staffPrincipal } from '../middleware/auth.js';
import {
  Appointment,
  Invoice,
  InvoiceItem,
  Location,
  Patient,
  Payment,
  User,
} from '../models/index.js';
import { audit } from '../services/audit.js';
import { addDays, todayInGoa } from '../services/availability.js';
import { invoicePdf, receiptPdf } from '../services/pdf.js';

/** Invoices and payments. No GST (client decision); payments are recorded by the front desk. */
export const adminBillingRouter = Router();

adminBillingRouter.use(requireStaff);

const goaDayStart = (date: string) => new Date(`${date}T00:00:00+05:30`);

adminBillingRouter.post('/invoices', requirePermission('billing.write'), async (req, res) => {
  const body = invoiceBody.parse(req.body);
  const [patient, location] = await Promise.all([
    Patient.findByPk(body.patientId),
    Location.findOne({ where: { slug: body.branch } }),
  ]);
  if (!patient) throw notFound('patient_not_found', 'Patient not found.');
  if (!location) throw notFound('branch_not_found', 'Unknown clinic.');
  if (body.appointmentId) {
    const visit = await Appointment.findOne({
      where: { id: body.appointmentId, patientId: patient.id },
    });
    if (!visit) throw badRequest('appointment_not_found', 'That visit isn’t this patient’s.');
  }

  const lines = body.items.map((item, index) => ({
    ...item,
    amountPaise: item.quantity * item.unitPaise,
    sortOrder: index,
  }));
  const subtotal = lines.reduce((sum, line) => sum + line.amountPaise, 0);
  const invoice = await sequelize.transaction(async (transaction) => {
    const created = await Invoice.create(
      {
        patientId: patient.id,
        locationId: location.id,
        appointmentId: body.appointmentId ?? null,
        issuedOn: body.issuedOn ?? todayInGoa(),
        subtotalPaise: subtotal,
        discountPaise: body.discountPaise,
        totalPaise: subtotal - body.discountPaise,
        notes: body.notes,
        createdBy: staffPrincipal(req).id,
      },
      { transaction },
    );
    await InvoiceItem.bulkCreate(
      lines.map((line) => ({ ...line, invoiceId: created.id })),
      { transaction },
    );
    return created;
  });
  await invoice.reload();
  await audit(req, {
    action: 'invoice.created',
    entity: 'invoice',
    entityId: invoice.id,
    meta: { totalPaise: invoice.totalPaise },
  });
  res.status(201).json({ id: invoice.id, number: invoice.number, totalPaise: invoice.totalPaise });
});

const listQuery = z.object({
  patientId: z.uuid().optional(),
  due: z.enum(['true']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

adminBillingRouter.get('/invoices', requirePermission('billing.read'), async (req, res) => {
  const query = listQuery.parse(req.query);
  const { rows, count } = await Invoice.findAndCountAll({
    where: {
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.due ? { status: 'issued', [Op.and]: [literal('total_paise > paid_paise')] } : {}),
    },
    include: [
      { model: Patient, as: 'patient', attributes: ['id', 'code', 'name', 'phone'] },
      { model: Location, as: 'location', attributes: ['slug', 'name'] },
    ],
    order: [
      ['issuedOn', query.due ? 'ASC' : 'DESC'],
      ['createdAt', 'DESC'],
    ],
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
  const outstanding = query.due
    ? Number(
        (
          await sequelize.query<{ due: string }>(
            "SELECT coalesce(sum(total_paise - paid_paise), 0) AS due FROM invoices WHERE status = 'issued'",
            { type: QueryTypes.SELECT },
          )
        )[0]?.due ?? 0,
      )
    : undefined;
  res.json({ page: query.page, pageSize: query.pageSize, total: count, outstanding, items: rows });
});

async function loadInvoice(id: unknown) {
  const invoice = await Invoice.findByPk(z.uuid().parse(id), {
    include: [
      { model: InvoiceItem, as: 'items' },
      {
        model: Payment,
        as: 'payments',
        include: [{ model: User, as: 'receiver', attributes: ['id', 'name'] }],
      },
      { model: Patient, as: 'patient', attributes: ['id', 'code', 'name', 'phone'] },
      { model: Location, as: 'location' },
    ],
    order: [
      [{ model: InvoiceItem, as: 'items' }, 'sortOrder', 'ASC'],
      [{ model: Payment, as: 'payments' }, 'receivedAt', 'ASC'],
    ],
  });
  if (!invoice) throw notFound('invoice_not_found', 'Invoice not found.');
  return invoice;
}

adminBillingRouter.get('/invoices/:id', requirePermission('billing.read'), async (req, res) => {
  res.json(await loadInvoice(req.params.id));
});

adminBillingRouter.post(
  '/invoices/:id/payments',
  requirePermission('billing.write'),
  async (req, res) => {
    const body = paymentBody.parse(req.body);
    const id = z.uuid().parse(req.params.id);
    const payment = await sequelize.transaction(async (transaction) => {
      // Lock the invoice so two desks recording at once can't overpay it.
      const invoice = await Invoice.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!invoice) throw notFound('invoice_not_found', 'Invoice not found.');
      if (invoice.status === 'void') throw badRequest('invoice_void', 'This invoice is void.');
      const balance = invoice.totalPaise - invoice.paidPaise;
      if (body.amountPaise > balance) {
        throw badRequest('overpayment', 'That is more than the balance due.', { balance });
      }
      const created = await Payment.create(
        {
          invoiceId: invoice.id,
          amountPaise: body.amountPaise,
          method: body.method,
          reference: body.reference,
          receivedAt: body.receivedAt ? new Date(body.receivedAt) : new Date(),
          receivedBy: staffPrincipal(req).id,
        },
        { transaction },
      );
      await invoice.update({ paidPaise: invoice.paidPaise + body.amountPaise }, { transaction });
      return created;
    });
    await payment.reload();
    await audit(req, {
      action: 'payment.recorded',
      entity: 'invoice',
      entityId: id,
      meta: { paymentId: payment.id, amountPaise: payment.amountPaise, method: payment.method },
    });
    res.status(201).json({ id: payment.id, receiptNumber: payment.receiptNumber });
  },
);

adminBillingRouter.post(
  '/invoices/:id/void',
  requirePermission('billing.write'),
  async (req, res) => {
    const { reason } = voidBody.parse(req.body);
    const invoice = await Invoice.findByPk(z.uuid().parse(req.params.id));
    if (!invoice) throw notFound('invoice_not_found', 'Invoice not found.');
    if (invoice.status === 'void')
      throw badRequest('invoice_void', 'This invoice is already void.');
    if (invoice.paidPaise > 0) {
      throw badRequest('has_payments', 'Void its payments first, then the invoice.');
    }
    await invoice.update({
      status: 'void',
      voidReason: reason,
      voidedAt: new Date(),
      voidedBy: staffPrincipal(req).id,
    });
    await audit(req, { action: 'invoice.voided', entity: 'invoice', entityId: invoice.id });
    res.json({ id: invoice.id, status: invoice.status });
  },
);

adminBillingRouter.post(
  '/payments/:id/void',
  requirePermission('billing.write'),
  async (req, res) => {
    const { reason } = voidBody.parse(req.body);
    const id = z.uuid().parse(req.params.id);
    const payment = await sequelize.transaction(async (transaction) => {
      const found = await Payment.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!found) throw notFound('payment_not_found', 'Payment not found.');
      if (found.voidedAt) throw badRequest('payment_void', 'This payment is already void.');
      const invoice = await Invoice.findByPk(found.invoiceId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!invoice) throw notFound('invoice_not_found', 'Invoice not found.');
      await found.update(
        { voidReason: reason, voidedAt: new Date(), voidedBy: staffPrincipal(req).id },
        { transaction },
      );
      await invoice.update({ paidPaise: invoice.paidPaise - found.amountPaise }, { transaction });
      return found;
    });
    await audit(req, {
      action: 'payment.voided',
      entity: 'invoice',
      entityId: payment.invoiceId,
      meta: { paymentId: payment.id },
    });
    res.json({ id: payment.id, voided: true });
  },
);

function sendPdf(res: Response, buffer: Buffer, name: string) {
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${name}.pdf"`,
    'Cache-Control': 'private, no-store',
  });
  res.send(buffer);
}

adminBillingRouter.get('/invoices/:id/pdf', requirePermission('billing.read'), async (req, res) => {
  const invoice = await loadInvoice(req.params.id);
  const patient = await Patient.findByPk(invoice.patientId);
  const pdf = await invoicePdf({
    invoice,
    items: invoice.items ?? [],
    payments: invoice.payments ?? [],
    patient: patient ?? undefined,
    location: invoice.location,
  });
  sendPdf(res, pdf, invoice.number);
});

adminBillingRouter.get(
  '/payments/:id/receipt',
  requirePermission('billing.read'),
  async (req, res) => {
    const payment = await Payment.findByPk(z.uuid().parse(req.params.id));
    if (!payment) throw notFound('payment_not_found', 'Payment not found.');
    const invoice = await Invoice.findByPk(payment.invoiceId, {
      include: [{ model: Location, as: 'location' }],
    });
    if (!invoice) throw notFound('invoice_not_found', 'Invoice not found.');
    const patient = await Patient.findByPk(invoice.patientId);
    const pdf = await receiptPdf({
      payment,
      invoice,
      patient: patient ?? undefined,
      location: invoice.location,
    });
    sendPdf(res, pdf, payment.receiptNumber);
  },
);

/** One day's collections by payment method (Goa time), for the end-of-day cash-up. */
adminBillingRouter.get('/billing/summary', requirePermission('billing.read'), async (req, res) => {
  const date = z.iso.date().optional().parse(req.query.date) ?? todayInGoa();
  const payments = await Payment.findAll({
    where: {
      voidedAt: { [Op.is]: null },
      receivedAt: { [Op.gte]: goaDayStart(date), [Op.lt]: goaDayStart(addDays(date, 1)) },
    },
    attributes: ['method', 'amountPaise'],
  });
  const byMethod: Record<string, number> = {};
  for (const payment of payments) {
    byMethod[payment.method] = (byMethod[payment.method] ?? 0) + payment.amountPaise;
  }
  res.json({
    date,
    count: payments.length,
    totalPaise: payments.reduce((sum, payment) => sum + payment.amountPaise, 0),
    byMethod,
  });
});
