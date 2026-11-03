import { PAYMENT_METHOD_LABELS } from '@edc/shared';
import PDFDocument from 'pdfkit';
import type { Invoice, InvoiceItem, Location, Patient, Payment } from '../models/index.js';

/**
 * Plain A4 invoice and receipt PDFs. The clinic does not charge GST, so there are no tax
 * lines. The standard PDF fonts have no ₹ glyph, so amounts print as "Rs. 1,500.00".
 */
const CLINIC = 'Expressions Dental Clinic';
const INK = '#1f242b';
const MUTED = '#576170';
const BRAND = '#ad0068';

export const rupees = (paise: number) =>
  `Rs. ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(paise / 100)}`;

const longDate = (value: string | Date) =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: typeof value === 'string' ? 'UTC' : 'Asia/Kolkata',
  }).format(typeof value === 'string' ? new Date(`${value}T00:00:00Z`) : value);

function toBuffer(draw: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: { Title: CLINIC, Author: CLINIC },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    draw(doc);
    doc.end();
  });
}

function header(doc: PDFKit.PDFDocument, title: string, location: Location | undefined) {
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(18).text(CLINIC, 50, 50);
  doc.fillColor(MUTED).font('Helvetica').fontSize(9);
  if (location) {
    doc.text(
      [location.addressLine, location.locality, location.region].filter(Boolean).join(', '),
      { width: 300 },
    );
    doc.text(`Phone ${location.phone}`);
  }
  doc
    .fillColor(INK)
    .font('Helvetica-Bold')
    .fontSize(20)
    .text(title, 350, 50, { width: 195, align: 'right' });
  doc.moveDown(3);
}

function party(
  doc: PDFKit.PDFDocument,
  patient: Patient | undefined,
  facts: Array<[string, string]>,
) {
  const top = 140;
  doc.fillColor(MUTED).font('Helvetica').fontSize(9).text('BILLED TO', 50, top);
  doc
    .fillColor(INK)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(patient?.name ?? '', 50, top + 14);
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(MUTED)
    .text(`${patient?.code ?? ''}  ·  ${patient?.phone ?? ''}`);
  facts.forEach(([label, value], index) => {
    const y = top + index * 16;
    doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(label, 330, y, { width: 90 });
    doc.fillColor(INK).font('Helvetica-Bold').text(value, 420, y, { width: 125, align: 'right' });
  });
  doc.y = top + Math.max(60, facts.length * 16 + 20);
}

function totalsRow(doc: PDFKit.PDFDocument, label: string, value: string, strong = false) {
  const y = doc.y;
  doc
    .fillColor(strong ? INK : MUTED)
    .font(strong ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(strong ? 11 : 10);
  doc.text(label, 330, y, { width: 110 });
  doc.text(value, 440, y, { width: 105, align: 'right' });
  doc.moveDown(0.6);
}

function footer(doc: PDFKit.PDFDocument) {
  doc
    .fillColor(MUTED)
    .font('Helvetica')
    .fontSize(8)
    .text(
      'This is a computer-generated document and does not need a signature. Thank you for choosing Expressions Dental Clinic.',
      50,
      770,
      { width: 495, align: 'center' },
    );
}

export function invoicePdf(data: {
  invoice: Invoice;
  items: InvoiceItem[];
  payments: Payment[];
  patient?: Patient;
  location?: Location;
}): Promise<Buffer> {
  const { invoice, items, payments, patient, location } = data;
  return toBuffer((doc) => {
    header(doc, invoice.status === 'void' ? 'INVOICE (VOID)' : 'INVOICE', location);
    party(doc, patient, [
      ['Invoice no.', invoice.number],
      ['Date', longDate(invoice.issuedOn)],
      ['Balance due', rupees(invoice.totalPaise - invoice.paidPaise)],
    ]);

    const columns = { item: 50, tooth: 300, qty: 360, rate: 400, amount: 470 };
    const headY = doc.y + 10;
    doc.rect(50, headY - 6, 495, 22).fill('#f5f6f8');
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9);
    doc.text('TREATMENT', columns.item + 6, headY);
    doc.text('TOOTH', columns.tooth, headY);
    doc.text('QTY', columns.qty, headY, { width: 30, align: 'right' });
    doc.text('RATE', columns.rate, headY, { width: 65, align: 'right' });
    doc.text('AMOUNT', columns.amount, headY, { width: 75, align: 'right' });
    let y = headY + 24;
    doc.font('Helvetica').fontSize(10).fillColor(INK);
    for (const item of items) {
      const height = doc.heightOfString(item.description, { width: 240 });
      doc.text(item.description, columns.item + 6, y, { width: 240 });
      doc.text(item.tooth || '—', columns.tooth, y, { width: 55 });
      doc.text(String(item.quantity), columns.qty, y, { width: 30, align: 'right' });
      doc.text(rupees(item.unitPaise), columns.rate, y, { width: 65, align: 'right' });
      doc.text(rupees(item.amountPaise), columns.amount, y, { width: 75, align: 'right' });
      y += Math.max(height, 12) + 10;
      doc
        .moveTo(50, y - 5)
        .lineTo(545, y - 5)
        .strokeColor('#e5e7eb')
        .lineWidth(0.5)
        .stroke();
    }
    doc.y = y + 6;

    totalsRow(doc, 'Subtotal', rupees(invoice.subtotalPaise));
    if (invoice.discountPaise) totalsRow(doc, 'Discount', `- ${rupees(invoice.discountPaise)}`);
    totalsRow(doc, 'Total', rupees(invoice.totalPaise), true);
    totalsRow(doc, 'Paid', rupees(invoice.paidPaise));
    totalsRow(doc, 'Balance due', rupees(invoice.totalPaise - invoice.paidPaise), true);

    const active = payments.filter((payment) => !payment.voidedAt);
    if (active.length) {
      doc.moveDown(1);
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('PAYMENTS RECEIVED', 50);
      doc.font('Helvetica').fontSize(9).fillColor(INK);
      for (const payment of active) {
        doc.text(
          `${longDate(payment.receivedAt)}  ·  ${payment.receiptNumber}  ·  ${PAYMENT_METHOD_LABELS[payment.method]}  ·  ${rupees(payment.amountPaise)}`,
          50,
        );
      }
    }
    if (invoice.notes) {
      doc.moveDown(1);
      doc.fillColor(MUTED).fontSize(9).text(invoice.notes, 50, doc.y, { width: 495 });
    }
    footer(doc);
  });
}

export function receiptPdf(data: {
  payment: Payment;
  invoice: Invoice;
  patient?: Patient;
  location?: Location;
}): Promise<Buffer> {
  const { payment, invoice, patient, location } = data;
  return toBuffer((doc) => {
    header(doc, payment.voidedAt ? 'RECEIPT (VOID)' : 'RECEIPT', location);
    party(doc, patient, [
      ['Receipt no.', payment.receiptNumber],
      ['Date', longDate(payment.receivedAt)],
      ['Against invoice', invoice.number],
    ]);
    doc.moveDown(1);
    doc.rect(50, doc.y, 495, 70).fill('#f5f6f8');
    const boxY = doc.y + 16;
    doc.fillColor(MUTED).font('Helvetica').fontSize(10).text('Amount received', 70, boxY);
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(22)
      .text(rupees(payment.amountPaise), 70, boxY + 16);
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(10)
      .text(
        `By ${PAYMENT_METHOD_LABELS[payment.method]}${payment.reference ? ` (ref. ${payment.reference})` : ''}`,
        330,
        boxY + 22,
        { width: 195, align: 'right' },
      );
    doc.y = boxY + 74;
    totalsRow(doc, 'Invoice total', rupees(invoice.totalPaise));
    totalsRow(doc, 'Paid to date', rupees(invoice.paidPaise));
    totalsRow(doc, 'Balance due', rupees(invoice.totalPaise - invoice.paidPaise), true);
    footer(doc);
  });
}
