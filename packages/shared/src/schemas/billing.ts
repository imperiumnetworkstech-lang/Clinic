import { z } from 'zod';
import { BRANCH_IDS } from './booking.js';

/** Billing and patient-file request bodies. Money is always whole paise (₹1 = 100). */

const paise = z.number().int().min(0).max(100_000_000);

export const invoiceBody = z
  .object({
    patientId: z.uuid(),
    branch: z.enum(BRANCH_IDS),
    appointmentId: z.uuid().optional(),
    issuedOn: z.iso.date().optional(),
    items: z
      .array(
        z.object({
          description: z.string().trim().min(1, 'Describe the treatment').max(160),
          tooth: z.string().trim().max(40).default(''),
          quantity: z.number().int().min(1).max(50).default(1),
          unitPaise: paise,
        }),
      )
      .min(1, 'Add at least one line')
      .max(30),
    discountPaise: paise.default(0),
    notes: z.string().trim().max(500).default(''),
  })
  .refine(
    (body) =>
      body.discountPaise <=
      body.items.reduce((sum, item) => sum + item.quantity * item.unitPaise, 0),
    { message: 'The discount can’t be more than the total', path: ['discountPaise'] },
  );

export const PAYMENT_METHOD_VALUES = ['cash', 'upi', 'card', 'bank_transfer', 'other'] as const;

export const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHOD_VALUES)[number], string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  other: 'Other',
};

export const paymentBody = z.object({
  amountPaise: z.number().int().min(1, 'Enter the amount received').max(100_000_000),
  method: z.enum(PAYMENT_METHOD_VALUES),
  reference: z.string().trim().max(80).default(''),
  receivedAt: z.iso.datetime({ offset: true }).optional(),
});

export const voidBody = z.object({
  reason: z.string().trim().min(3, 'Say why').max(200),
});

export const FILE_KIND_VALUES = ['xray', 'photo', 'report', 'document', 'other'] as const;

export const FILE_KIND_LABELS: Record<(typeof FILE_KIND_VALUES)[number], string> = {
  xray: 'X-ray',
  photo: 'Photo',
  report: 'Report',
  document: 'Document',
  other: 'Other',
};

/** Accepted upload types: images, PDFs and DICOM X-rays. */
export const FILE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/dicom',
] as const;

export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export const fileUploadBody = z.object({
  kind: z.enum(FILE_KIND_VALUES),
  fileName: z.string().trim().min(1).max(200),
  contentType: z.enum(FILE_CONTENT_TYPES, {
    message: 'Upload a JPEG, PNG, WebP, PDF or DICOM file',
  }),
  sizeBytes: z.number().int().min(1).max(MAX_FILE_BYTES, 'Files can be up to 15 MB'),
});

export const fileShareBody = z.object({
  hours: z.number().int().min(1).max(168).default(24),
});

/** e.g. 150000 → "₹1,500", 150050 → "₹1,500.50" (Indian digit grouping). */
export function formatRupees(amountPaise: number): string {
  const rupees = amountPaise / 100;
  return `₹${new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: amountPaise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rupees)}`;
}

export type InvoiceBody = z.input<typeof invoiceBody>;
export type PaymentBody = z.input<typeof paymentBody>;
