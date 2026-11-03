import type { StaffProfile } from '@edc/shared';
import { PATIENT_FOR_LABELS, TIME_OF_DAY_LABELS } from '@edc/shared';
import { Inbox, Phone, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AdminShell } from '../components/AdminShell';
import { WhatsAppIcon } from '../components/icons';
import { Button } from '../components/ui/Button';
import { Badge, EmptyState, Skeleton } from '../components/ui/primitives';
import { adminApi, ApiError, type LeadRow, type LeadStatus } from '../lib/admin-api';
import { cn } from '../lib/cn';
import { reasonLabel } from '../lib/treatments';
import { container } from '../lib/ui';

export function meta() {
  return [
    { title: 'Enquiries | Expressions Dental admin' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

const STATUSES: Array<{
  value: LeadStatus;
  label: string;
  tone: 'brand' | 'info' | 'success' | 'neutral';
}> = [
  { value: 'new', label: 'New', tone: 'brand' },
  { value: 'contacted', label: 'Contacted', tone: 'info' },
  { value: 'booked', label: 'Booked', tone: 'success' },
  { value: 'lost', label: 'Lost', tone: 'neutral' },
];

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

function received(iso: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));
}

function replyLink(lead: LeadRow) {
  const text = `Hello ${lead.name}, this is Expressions Dental Clinic about your appointment request ${lead.reference}.`;
  return `https://wa.me/${lead.phone.replace('+', '')}?text=${encodeURIComponent(text)}`;
}

function LeadCard({ lead, onStatus }: { lead: LeadRow; onStatus: (status: LeadStatus) => void }) {
  const status = STATUSES.find((entry) => entry.value === lead.status);
  const { details } = lead;
  return (
    <article className="rounded-3xl bg-white p-5 ring-1 ring-neutral-200 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            {lead.reference} · received {received(lead.createdAt)}
          </p>
          <h2 className="mt-1 text-lg font-bold">{lead.name}</h2>
        </div>
        {status && <Badge tone={status.tone}>{status.label}</Badge>}
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-2 text-[0.95rem] sm:grid-cols-2">
        {[
          ['Visit for', details.reason ? reasonLabel(details.reason) : '—'],
          ['Clinic', lead.location?.name ?? '—'],
          [
            'Preferred',
            `${formatDate(details.preferredDate)} · ${
              details.timeOfDay
                ? (TIME_OF_DAY_LABELS[details.timeOfDay as keyof typeof TIME_OF_DAY_LABELS] ??
                  details.timeOfDay)
                : ''
            }`,
          ],
          [
            'For',
            details.patientFor
              ? (PATIENT_FOR_LABELS[details.patientFor as keyof typeof PATIENT_FOR_LABELS] ??
                details.patientFor)
              : '—',
          ],
        ].map(([term, value]) => (
          <div key={term} className="flex gap-2">
            <dt className="w-24 shrink-0 text-muted">{term}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {details.notes && (
        <p className="mt-3 rounded-2xl bg-surface p-3 text-[0.95rem]">“{details.notes}”</p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <a
          href={`tel:${lead.phone}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-50 px-4 font-semibold text-primary-700"
        >
          <Phone size={16} />
          {lead.phone}
        </a>
        <a
          href={replyLink(lead)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#E8F7EE] px-4 font-semibold text-[#0B5E31]"
        >
          <WhatsAppIcon size={18} />
          Reply on WhatsApp
        </a>
        <label className="ml-auto flex items-center gap-2 text-sm font-semibold">
          Status
          <select
            value={lead.status}
            onChange={(event) => onStatus(event.target.value as LeadStatus)}
            className="min-h-11 rounded-full bg-white px-4 ring-1 ring-neutral-300"
          >
            {STATUSES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </article>
  );
}

/** The website enquiries inbox (client-rendered, behind sign-in). */
export default function AdminEnquiries() {
  const navigate = useNavigate();
  const [me, setMe] = useState<StaffProfile | null>(null);
  const [leads, setLeads] = useState<LeadRow[] | null>(null);
  const [filter, setFilter] = useState<LeadStatus | 'all'>('new');
  const [error, setError] = useState('');

  const load = useCallback(
    async (status: LeadStatus | 'all') => {
      setError('');
      setLeads(null);
      try {
        const profile = await adminApi.me();
        setMe(profile);
        if (!profile.permissions.includes('leads.read')) {
          setLeads([]);
          return;
        }
        const result = await adminApi.leads(status === 'all' ? undefined : status);
        setLeads(result.items);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          navigate('/admin/login', { replace: true });
          return;
        }
        setError(caught instanceof ApiError ? caught.message : 'Could not reach the server.');
        setLeads([]);
      }
    },
    [navigate],
  );

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  const changeStatus = async (lead: LeadRow, status: LeadStatus) => {
    setLeads(
      (current) => current?.map((row) => (row.id === lead.id ? { ...row, status } : row)) ?? null,
    );
    try {
      await adminApi.setLeadStatus(lead.id, status);
    } catch {
      setError('Could not update the status. Please try again.');
      void load(filter);
    }
  };

  const canSeeLeads = me?.permissions.includes('leads.read') ?? true;

  return (
    <AdminShell me={me}>
      <main className={`${container} py-8`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Enquiries</h1>
            <p className="mt-1 text-muted">Appointment requests from the website. Newest first.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void load(filter)}>
            <RefreshCw size={16} />
            Refresh
          </Button>
        </div>

        {canSeeLeads && (
          <div
            className="mt-6 flex gap-2 overflow-x-auto pb-1"
            role="tablist"
            aria-label="Filter by status"
          >
            {[{ value: 'all' as const, label: 'All' }, ...STATUSES].map((entry) => (
              <button
                key={entry.value}
                type="button"
                role="tab"
                aria-selected={filter === entry.value}
                onClick={() => setFilter(entry.value)}
                className={cn(
                  'min-h-11 shrink-0 rounded-full px-4 font-semibold ring-1 transition',
                  filter === entry.value
                    ? 'bg-neutral-950 text-white ring-neutral-950'
                    : 'bg-white ring-neutral-200 hover:bg-neutral-50',
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-6 rounded-2xl bg-[#FEF4F3] p-4 font-medium text-[#92020B]">
            {error}
          </p>
        )}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {leads === null &&
            [0, 1, 2, 3].map((key) => (
              <div key={key} className="rounded-3xl bg-white p-6 ring-1 ring-neutral-200">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-3 h-6 w-56" />
                <Skeleton className="mt-5 h-16 w-full" />
              </div>
            ))}
          {leads?.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onStatus={(status) => void changeStatus(lead, status)}
            />
          ))}
        </div>

        {leads?.length === 0 && !error && (
          <div className="mt-2">
            <EmptyState
              icon={Inbox}
              title={canSeeLeads ? 'No enquiries here' : 'No access to enquiries'}
            >
              {canSeeLeads
                ? 'New appointment requests from the website will appear here.'
                : 'Your role does not include the enquiries inbox.'}
            </EmptyState>
          </div>
        )}
      </main>
    </AdminShell>
  );
}
