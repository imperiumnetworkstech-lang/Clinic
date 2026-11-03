import { formatRupees, PAYMENT_METHOD_LABELS } from '@edc/shared';
import { FileText, IndianRupee, Plus, Receipt, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  ApiError,
  billingApi,
  type InvoiceRow,
  type PatientRecord,
  type PaymentMethod,
} from '../../lib/admin-api';
import { branches } from '../../lib/clinic';
import { cn } from '../../lib/cn';
import { reasonLabel, treatments } from '../../lib/treatments';
import { Button } from '../ui/Button';
import { Badge } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';

const fieldClass =
  'mt-1 block min-h-11 w-full rounded-xl bg-white px-3 ring-1 ring-neutral-300 outline-none focus:ring-2 focus:ring-secondary-500';

const toPaise = (rupees: string) => Math.round(Number(rupees || '0') * 100);

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

function invoiceState(invoice: InvoiceRow) {
  if (invoice.status === 'void') return { label: 'Void', tone: 'neutral' as const };
  if (invoice.paidPaise >= invoice.totalPaise) return { label: 'Paid', tone: 'success' as const };
  if (invoice.paidPaise > 0) return { label: 'Part paid', tone: 'info' as const };
  return { label: 'Unpaid', tone: 'warning' as const };
}

function Problem({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-2xl bg-[#FEF4F3] p-3 text-sm font-medium text-[#92020B]">
      {message}
    </p>
  );
}

const problemText = (caught: unknown, fallback: string) =>
  caught instanceof ApiError ? (caught.fieldErrors[0]?.message ?? caught.message) : fallback;

/* ------------------------------------------------------------------ new invoice */

function NewInvoiceSheet({
  record,
  open,
  onOpenChange,
  onCreated,
}: {
  record: PatientRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const blank = { description: '', tooth: '', quantity: 1, rate: '' };
  const [lines, setLines] = useState([blank]);
  const [discount, setDiscount] = useState('');
  const [notes, setNotes] = useState('');
  const [branch, setBranch] = useState(record.patient.homeBranch?.slug ?? 'mapusa');
  const [visit, setVisit] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const subtotal = lines.reduce((sum, line) => sum + line.quantity * toPaise(line.rate), 0);
  const total = subtotal - toPaise(discount);
  const setLine = (index: number, patch: Partial<typeof blank>) =>
    setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const recentVisits = record.appointments.filter((a) => a.status !== 'cancelled').slice(0, 10);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await billingApi.create({
        patientId: record.patient.id,
        branch,
        ...(visit ? { appointmentId: visit } : {}),
        items: lines.map((line) => ({
          description: line.description,
          tooth: line.tooth,
          quantity: line.quantity,
          unitPaise: toPaise(line.rate),
        })),
        discountPaise: toPaise(discount),
        notes,
      });
      setLines([blank]);
      setDiscount('');
      setNotes('');
      setVisit('');
      onOpenChange(false);
      onCreated();
    } catch (caught) {
      setError(problemText(caught, 'Could not create the invoice.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="New invoice" className="md:max-w-[44rem]">
      <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Clinic
            <select
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              className={fieldClass}
            >
              {branches.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.shortName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            For visit <span className="font-normal text-muted">(optional)</span>
            <select
              value={visit}
              onChange={(event) => setVisit(event.target.value)}
              className={fieldClass}
            >
              <option value="">Not linked</option>
              {recentVisits.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {shortDate(appointment.startAt)} · {reasonLabel(appointment.reason)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="space-y-3">
          <legend className="font-semibold">Treatments</legend>
          {lines.map((line, index) => (
            <div
              key={index}
              className="grid grid-cols-[1fr_4.5rem_3.5rem_6rem_auto] items-end gap-2"
            >
              <label className="text-sm font-semibold">
                <span className={cn(index > 0 && 'sr-only')}>Treatment</span>
                <input
                  list="invoice-treatments"
                  required
                  maxLength={160}
                  value={line.description}
                  onChange={(event) => setLine(index, { description: event.target.value })}
                  className={fieldClass}
                />
              </label>
              <label className="text-sm font-semibold">
                <span className={cn(index > 0 && 'sr-only')}>Tooth</span>
                <input
                  maxLength={40}
                  value={line.tooth}
                  onChange={(event) => setLine(index, { tooth: event.target.value })}
                  className={fieldClass}
                />
              </label>
              <label className="text-sm font-semibold">
                <span className={cn(index > 0 && 'sr-only')}>Qty</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={line.quantity}
                  onChange={(event) =>
                    setLine(index, { quantity: Number(event.target.value) || 1 })
                  }
                  className={cn(fieldClass, 'px-2')}
                />
              </label>
              <label className="text-sm font-semibold">
                <span className={cn(index > 0 && 'sr-only')}>Rate (₹)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  required
                  value={line.rate}
                  onChange={(event) => setLine(index, { rate: event.target.value })}
                  className={cn(fieldClass, 'px-2')}
                />
              </label>
              <button
                type="button"
                aria-label={`Remove line ${index + 1}`}
                disabled={lines.length === 1}
                onClick={() => setLines(lines.filter((_, i) => i !== index))}
                className="grid size-11 place-items-center rounded-full text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          <datalist id="invoice-treatments">
            {treatments.map((treatment) => (
              <option key={treatment.slug} value={treatment.name} />
            ))}
          </datalist>
          <Button size="sm" variant="ghost" onClick={() => setLines([...lines, blank])}>
            <Plus size={16} />
            Add line
          </Button>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <label className="text-sm font-semibold">
            Discount (₹)
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-semibold">
            Note on the invoice <span className="font-normal text-muted">(optional)</span>
            <input
              maxLength={500}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={fieldClass}
            />
          </label>
        </div>

        <p className="flex items-center justify-between rounded-2xl bg-surface p-4 font-semibold">
          <span>Total</span>
          <span className="text-xl tabular-nums">{formatRupees(Math.max(total, 0))}</span>
        </p>
        <Problem message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={saving || total < 0}>
          {saving ? 'Saving…' : 'Create invoice'}
        </Button>
      </form>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ payment */

function PaymentSheet({
  invoice,
  onOpenChange,
  onPaid,
}: {
  invoice: InvoiceRow | null;
  onOpenChange: (open: boolean) => void;
  onPaid: (paymentId: string, receipt: string) => void;
}) {
  const balance = invoice ? invoice.totalPaise - invoice.paidPaise : 0;
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAmount(balance ? String(balance / 100) : '');
    setReference('');
    setError('');
  }, [invoice, balance]);

  if (!invoice) return null;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const paid = await billingApi.pay(invoice.id, {
        amountPaise: toPaise(amount),
        method,
        reference,
      });
      onOpenChange(false);
      onPaid(paid.id, paid.receiptNumber);
    } catch (caught) {
      setError(problemText(caught, 'Could not record the payment.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open onOpenChange={onOpenChange} title={`Record payment · ${invoice.number}`}>
      <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-5">
        <p className="text-muted">
          Balance due <strong className="text-neutral-950">{formatRupees(balance)}</strong>. Part
          payments are fine.
        </p>
        <label className="block font-semibold">
          Amount received (₹)
          <input
            type="number"
            inputMode="decimal"
            min={0.01}
            max={balance / 100}
            step="0.01"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className={cn(fieldClass, 'min-h-12 text-lg')}
          />
        </label>
        <fieldset>
          <legend className="font-semibold">Paid by</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((value) => (
              <label
                key={value}
                className="flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl px-3 ring-1 ring-neutral-200 has-[:checked]:bg-primary-50 has-[:checked]:ring-2 has-[:checked]:ring-primary-600"
              >
                <input
                  type="radio"
                  name="method"
                  value={value}
                  checked={method === value}
                  onChange={() => setMethod(value)}
                  className="size-4 accent-primary-600"
                />
                {PAYMENT_METHOD_LABELS[value]}
              </label>
            ))}
          </div>
        </fieldset>
        {method !== 'cash' && (
          <label className="block font-semibold">
            Transaction reference <span className="font-normal text-muted">(optional)</span>
            <input
              maxLength={80}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              className={fieldClass}
            />
          </label>
        )}
        <Problem message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving ? 'Saving…' : 'Record payment'}
        </Button>
      </form>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ void */

function VoidSheet({
  target,
  onOpenChange,
  onDone,
}: {
  target: { kind: 'invoice' | 'payment'; id: string; label: string } | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setReason('');
    setError('');
  }, [target]);
  if (!target) return null;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (target.kind === 'invoice') await billingApi.voidInvoice(target.id, reason);
      else await billingApi.voidPayment(target.id, reason);
      onOpenChange(false);
      onDone();
    } catch (caught) {
      setError(problemText(caught, 'Could not void it.'));
    }
  };
  return (
    <Sheet open onOpenChange={onOpenChange} title={`Void ${target.label}`}>
      <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-4">
        <p className="text-muted">
          Voiding keeps the record but cancels it. It can’t be undone, and it’s logged with your
          name.
        </p>
        <label className="block font-semibold">
          Reason
          <input
            required
            minLength={3}
            maxLength={200}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={fieldClass}
          />
        </label>
        <Problem message={error} />
        <Button type="submit" className="w-full">
          Void {target.kind}
        </Button>
      </form>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ panel */

export function BillingPanel({ record, canWrite }: { record: PatientRecord; canWrite: boolean }) {
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [details, setDetails] = useState<Record<string, InvoiceRow>>({});
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<InvoiceRow | null>(null);
  const [voiding, setVoiding] = useState<{
    kind: 'invoice' | 'payment';
    id: string;
    label: string;
  } | null>(null);
  const [message, setMessage] = useState<{ text: string; receipt?: string } | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await billingApi.invoices({ patientId: record.patient.id });
      setInvoices(result.items);
      const full = await Promise.all(result.items.map((invoice) => billingApi.invoice(invoice.id)));
      setDetails(Object.fromEntries(full.map((invoice) => [invoice.id, invoice])));
    } catch (caught) {
      setError(problemText(caught, 'Could not load invoices.'));
      setInvoices([]);
    }
  }, [record.patient.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = async (action: () => Promise<void>) => {
    setError('');
    try {
      await action();
    } catch (caught) {
      setError(problemText(caught, 'Could not open the PDF.'));
    }
  };

  const due = (invoices ?? [])
    .filter((invoice) => invoice.status === 'issued')
    .reduce((sum, invoice) => sum + invoice.totalPaise - invoice.paidPaise, 0);

  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-neutral-200 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Billing</h2>
          {invoices && invoices.length > 0 && (
            <p className={cn('text-sm', due ? 'font-semibold text-[#92020B]' : 'text-muted')}>
              {due ? `${formatRupees(due)} due` : 'Nothing due'}
            </p>
          )}
        </div>
        {canWrite && (
          <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
            <FileText size={16} />
            New invoice
          </Button>
        )}
      </div>

      {message && (
        <p
          role="status"
          className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-[#E8F7EE] p-3 font-medium text-[#0B5E31]"
        >
          {message.text}
          {message.receipt && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void open(() => billingApi.openReceipt(message.receipt ?? ''))}
            >
              <Receipt size={16} />
              Open receipt
            </Button>
          )}
        </p>
      )}
      <div className="mt-4">
        <Problem message={error} />
      </div>

      {invoices?.length === 0 && <p className="mt-2 text-muted">No invoices yet.</p>}
      <ul className="mt-2 space-y-3">
        {invoices?.map((invoice) => {
          const state = invoiceState(invoice);
          const detail = details[invoice.id];
          const balance = invoice.totalPaise - invoice.paidPaise;
          return (
            <li key={invoice.id} className="rounded-2xl ring-1 ring-neutral-200">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {invoice.number} · {formatRupees(invoice.totalPaise)}
                  </p>
                  <p className="text-sm text-muted">
                    {shortDate(invoice.issuedOn)}
                    {detail?.items
                      ? ` · ${detail.items.map((item) => item.description).join(', ')}`
                      : ''}
                  </p>
                </div>
                <Badge tone={state.tone}>{state.label}</Badge>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void open(() => billingApi.openInvoicePdf(invoice.id))}
                  >
                    <FileText size={16} />
                    PDF
                  </Button>
                  {canWrite && invoice.status === 'issued' && balance > 0 && (
                    <Button size="sm" onClick={() => setPaying(invoice)}>
                      <IndianRupee size={16} />
                      Record payment
                    </Button>
                  )}
                  {canWrite && invoice.status === 'issued' && invoice.paidPaise === 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setVoiding({ kind: 'invoice', id: invoice.id, label: invoice.number })
                      }
                    >
                      Void
                    </Button>
                  )}
                </div>
              </div>
              {detail?.payments && detail.payments.length > 0 && (
                <ul className="divide-y divide-neutral-200 border-t border-neutral-200 text-sm">
                  {detail.payments.map((payment) => (
                    <li key={payment.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
                      <span className={cn('flex-1', payment.voidedAt && 'text-muted line-through')}>
                        {shortDate(payment.receivedAt)} · {payment.receiptNumber} ·{' '}
                        {PAYMENT_METHOD_LABELS[payment.method]} ·{' '}
                        <strong>{formatRupees(payment.amountPaise)}</strong>
                        {payment.receiver ? ` · ${payment.receiver.name}` : ''}
                      </span>
                      {!payment.voidedAt && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void open(() => billingApi.openReceipt(payment.id))}
                          >
                            <Receipt size={16} />
                            Receipt
                          </Button>
                          {canWrite && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setVoiding({
                                  kind: 'payment',
                                  id: payment.id,
                                  label: payment.receiptNumber,
                                })
                              }
                            >
                              Void
                            </Button>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <NewInvoiceSheet
        record={record}
        open={creating}
        onOpenChange={setCreating}
        onCreated={() => {
          setMessage({ text: 'Invoice created.' });
          void load();
        }}
      />
      <PaymentSheet
        invoice={paying}
        onOpenChange={(isOpen) => !isOpen && setPaying(null)}
        onPaid={(paymentId, receipt) => {
          setMessage({ text: `Payment recorded: ${receipt}.`, receipt: paymentId });
          void load();
        }}
      />
      <VoidSheet
        target={voiding}
        onOpenChange={(isOpen) => !isOpen && setVoiding(null)}
        onDone={() => {
          setMessage({ text: 'Voided.' });
          void load();
        }}
      />
    </section>
  );
}
