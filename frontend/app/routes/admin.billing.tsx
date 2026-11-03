import { formatRupees, PAYMENT_METHOD_LABELS } from '@edc/shared';
import { ChevronRight, IndianRupee, Wallet } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AdminShell } from '../components/AdminShell';
import { EmptyState, Skeleton } from '../components/ui/primitives';
import { billingApi, type InvoiceRow, type PaymentMethod } from '../lib/admin-api';
import { container } from '../lib/ui';
import { useStaff } from '../lib/use-staff';

export function meta() {
  return [
    { title: 'Billing | Expressions Dental admin' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

const todayInGoa = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));

/** End-of-day cash-up and the list of unpaid balances. */
export default function AdminBilling() {
  const { me, problem } = useStaff();
  const [date, setDate] = useState(todayInGoa);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof billingApi.summary>> | null>(
    null,
  );
  const [dues, setDues] = useState<{ outstanding?: number; items: InvoiceRow[] } | null>(null);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await billingApi.summary(date));
    } catch (caught) {
      setError(problem(caught));
    }
  }, [date, problem]);

  const loadDues = useCallback(async () => {
    try {
      setDues(await billingApi.invoices({ due: true }));
    } catch (caught) {
      setError(problem(caught));
      setDues({ items: [] });
    }
  }, [problem]);

  useEffect(() => {
    if (me) void loadSummary();
  }, [me, loadSummary]);
  useEffect(() => {
    if (me) void loadDues();
  }, [me, loadDues]);

  return (
    <AdminShell me={me}>
      <main className={`${container} py-8`}>
        <h1 className="text-2xl font-bold sm:text-3xl">Billing</h1>
        <p className="mt-1 text-muted">
          Money received and balances still due. Invoices are made from each patient’s record.
        </p>

        {error && (
          <p role="alert" className="mt-6 rounded-2xl bg-[#FEF4F3] p-4 font-medium text-[#92020B]">
            {error}
          </p>
        )}

        <section
          aria-labelledby="collections"
          className="mt-8 rounded-3xl bg-white p-5 ring-1 ring-neutral-200 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="collections" className="text-lg font-bold">
              Collections
            </h2>
            <label className="flex items-center gap-2 text-sm font-semibold">
              Day
              <input
                type="date"
                value={date}
                onChange={(event) => event.target.value && setDate(event.target.value)}
                className="min-h-11 rounded-full bg-white px-4 ring-1 ring-neutral-300"
              />
            </label>
          </div>
          {!summary ? (
            <Skeleton className="mt-4 h-20 w-full" />
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr]">
              <div className="rounded-2xl bg-surface p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-muted">
                  <Wallet size={16} className="text-primary-600" />
                  Total received
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums">
                  {formatRupees(summary.totalPaise)}
                </p>
                <p className="text-sm text-muted">{summary.count} payments</p>
              </div>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => (
                  <div key={method} className="rounded-2xl p-4 ring-1 ring-neutral-200">
                    <dt className="text-sm text-muted">{PAYMENT_METHOD_LABELS[method]}</dt>
                    <dd className="font-bold tabular-nums">
                      {formatRupees(summary.byMethod[method] ?? 0)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </section>

        <section aria-labelledby="dues" className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="dues" className="text-lg font-bold">
              Balances due
            </h2>
            {dues?.outstanding !== undefined && (
              <p className="font-semibold">
                Outstanding <span className="tabular-nums">{formatRupees(dues.outstanding)}</span>
              </p>
            )}
          </div>
          <ul className="mt-3 divide-y divide-neutral-200 overflow-hidden rounded-3xl bg-white ring-1 ring-neutral-200">
            {dues === null && (
              <li className="p-5">
                <Skeleton className="h-10 w-full" />
              </li>
            )}
            {dues?.items.map((invoice) => (
              <li key={invoice.id}>
                <Link
                  to={invoice.patient ? `/admin/patients/${invoice.patient.id}` : '#'}
                  className="flex items-center gap-4 p-4 transition hover:bg-neutral-50 sm:px-6"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{invoice.patient?.name}</span>
                    <span className="block text-sm text-muted">
                      {invoice.number} · {shortDate(invoice.issuedOn)} · total{' '}
                      {formatRupees(invoice.totalPaise)}
                    </span>
                  </span>
                  <span className="text-right font-bold text-[#92020B] tabular-nums">
                    {formatRupees(invoice.totalPaise - invoice.paidPaise)}
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-neutral-400" />
                </Link>
              </li>
            ))}
          </ul>
          {dues?.items.length === 0 && (
            <div className="mt-3">
              <EmptyState icon={IndianRupee} title="No balances due">
                Every invoice is paid in full.
              </EmptyState>
            </div>
          )}
        </section>
      </main>
    </AdminShell>
  );
}
