import type { StaffProfile } from '@edc/shared';
import { CalendarDays, ChevronLeft, ChevronRight, Phone, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AdminShell } from '../components/AdminShell';
import { WhatsAppIcon } from '../components/icons';
import { Button } from '../components/ui/Button';
import { Badge, EmptyState, Skeleton } from '../components/ui/primitives';
import {
  adminApi,
  ApiError,
  schedulingApi,
  type AppointmentRow,
  type AppointmentStatus,
} from '../lib/admin-api';
import { branches } from '../lib/clinic';
import { reasonLabel } from '../lib/treatments';
import { container } from '../lib/ui';

export function meta() {
  return [
    { title: 'Appointments | Expressions Dental admin' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

const STATUS: Record<
  AppointmentStatus,
  { label: string; tone: 'brand' | 'info' | 'success' | 'neutral' | 'warning' }
> = {
  pending: { label: 'To confirm', tone: 'warning' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  checked_in: { label: 'Checked in', tone: 'info' },
  completed: { label: 'Completed', tone: 'neutral' },
  no_show: { label: 'No-show', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

/** The buttons for each status; mirrors the transitions the API allows. */
const ACTIONS: Record<
  AppointmentStatus,
  Array<{ to: AppointmentStatus; label: string; variant: 'primary' | 'secondary' | 'ghost' }>
> = {
  pending: [
    { to: 'confirmed', label: 'Confirm', variant: 'primary' },
    { to: 'cancelled', label: 'Cancel', variant: 'ghost' },
  ],
  confirmed: [
    { to: 'checked_in', label: 'Check in', variant: 'primary' },
    { to: 'no_show', label: 'No-show', variant: 'secondary' },
    { to: 'cancelled', label: 'Cancel', variant: 'ghost' },
  ],
  checked_in: [{ to: 'completed', label: 'Mark completed', variant: 'primary' }],
  completed: [],
  no_show: [{ to: 'confirmed', label: 'Restore', variant: 'secondary' }],
  cancelled: [{ to: 'confirmed', label: 'Restore', variant: 'secondary' }],
};

const todayInGoa = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

function shiftDate(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const goaDay = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(iso));

const time = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));

const longDate = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));

/** WhatsApp is sent by hand (client decision), and never during quiet hours, 9 pm – 8 am IST. */
function inQuietHours() {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Asia/Kolkata',
    }).format(new Date()),
  );
  return hour >= 21 || hour < 8;
}

function confirmationLink(appointment: AppointmentRow) {
  const patient = appointment.patient;
  if (!patient) return null;
  const text = [
    `Hello ${patient.name}, your appointment at ${
      appointment.location?.name ?? 'Expressions Dental Clinic'
    } is confirmed for ${longDate(goaDay(appointment.startAt))} at ${time(appointment.startAt)}.`,
    `Reference: ${appointment.reference}`,
    'Reply here if you need to change it.',
  ].join('\n');
  return `https://wa.me/${patient.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

function AppointmentCard({
  appointment,
  canWrite,
  onStatus,
}: {
  appointment: AppointmentRow;
  canWrite: boolean;
  onStatus: (status: AppointmentStatus) => void;
}) {
  const status = STATUS[appointment.status];
  const { patient } = appointment;
  const whatsapp = appointment.status === 'confirmed' ? confirmationLink(appointment) : null;
  const quiet = inQuietHours();

  return (
    <article className="grid gap-4 rounded-3xl bg-white p-5 ring-1 ring-neutral-200 sm:grid-cols-[6rem_1fr] sm:p-6">
      <div>
        <p className="text-xl font-bold">{time(appointment.startAt)}</p>
        <p className="text-sm text-muted">to {time(appointment.endAt)}</p>
      </div>
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{patient?.name ?? 'Unknown patient'}</h2>
            <p className="text-sm text-muted">
              {appointment.reference}
              {patient ? ` · ${patient.code}` : ''}
              {appointment.location ? ` · ${appointment.location.name}` : ''}
              {appointment.source === 'website' ? ' · booked online' : ''}
            </p>
          </div>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <p className="mt-3 text-[0.95rem]">
          <span className="text-muted">Visit for </span>
          <span className="font-semibold">{reasonLabel(appointment.reason)}</span>
        </p>
        {appointment.notes && (
          <p className="mt-2 rounded-2xl bg-surface p-3 text-[0.95rem] whitespace-pre-line">
            {appointment.notes}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {patient && (
            <a
              href={`tel:${patient.phone}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-50 px-4 font-semibold text-primary-700"
            >
              <Phone size={16} />
              {patient.phone}
            </a>
          )}
          {whatsapp &&
            (quiet ? (
              <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-neutral-100 px-4 text-sm font-semibold text-neutral-600">
                <WhatsAppIcon size={18} />
                Quiet hours: send after 8 am
              </span>
            ) : (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#E8F7EE] px-4 font-semibold text-[#0B5E31]"
              >
                <WhatsAppIcon size={18} />
                Send confirmation
              </a>
            ))}
          {canWrite && (
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              {ACTIONS[appointment.status].map((action) => (
                <Button
                  key={action.to}
                  size="sm"
                  variant={action.variant}
                  onClick={() => onStatus(action.to)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/** Front desk day view: one day's appointments in time order, with status actions. */
export default function AdminAppointments() {
  const navigate = useNavigate();
  const [me, setMe] = useState<StaffProfile | null>(null);
  const [date, setDate] = useState(todayInGoa);
  const [branch, setBranch] = useState('');
  const [items, setItems] = useState<AppointmentRow[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    setItems(null);
    try {
      const profile = await adminApi.me();
      setMe(profile);
      if (!profile.permissions.includes('appointments.read')) {
        setItems([]);
        return;
      }
      const result = await schedulingApi.appointments(date, branch || undefined);
      setItems(result.items);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        navigate('/admin/login', { replace: true });
        return;
      }
      setError(caught instanceof ApiError ? caught.message : 'Could not reach the server.');
      setItems([]);
    }
  }, [date, branch, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = async (appointment: AppointmentRow, status: AppointmentStatus) => {
    setError('');
    try {
      await schedulingApi.setStatus(appointment.id, status);
      setItems(
        (current) =>
          current?.map((row) => (row.id === appointment.id ? { ...row, status } : row)) ?? null,
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not update the appointment.');
    }
  };

  const canWrite = me?.permissions.includes('appointments.write') ?? false;
  const active = items?.filter((item) => item.status !== 'cancelled') ?? [];
  const toConfirm = active.filter((item) => item.status === 'pending').length;

  return (
    <AdminShell me={me}>
      <main className={`${container} py-8`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Appointments</h1>
            <p className="mt-1 text-muted">
              {longDate(date)}
              {items ? ` · ${active.length} booked` : ''}
              {toConfirm ? ` · ${toConfirm} to confirm` : ''}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            <RefreshCw size={16} />
            Refresh
          </Button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            aria-label="Previous day"
            onClick={() => setDate((value) => shiftDate(value, -1))}
          >
            <ChevronLeft size={18} />
          </Button>
          <label className="sr-only" htmlFor="day">
            Day
          </label>
          <input
            id="day"
            type="date"
            value={date}
            onChange={(event) => event.target.value && setDate(event.target.value)}
            className="min-h-11 rounded-full bg-white px-4 ring-1 ring-neutral-300"
          />
          <Button
            variant="secondary"
            size="sm"
            aria-label="Next day"
            onClick={() => setDate((value) => shiftDate(value, 1))}
          >
            <ChevronRight size={18} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDate(todayInGoa())}>
            Today
          </Button>
          <label className="flex items-center gap-2 text-sm font-semibold sm:ml-auto">
            Clinic
            <select
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              className="min-h-11 rounded-full bg-white px-4 ring-1 ring-neutral-300"
            >
              <option value="">Both clinics</option>
              {branches.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.shortName}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <p role="alert" className="mt-6 rounded-2xl bg-[#FEF4F3] p-4 font-medium text-[#92020B]">
            {error}
          </p>
        )}

        <div className="mt-6 grid gap-4">
          {items === null &&
            [0, 1, 2].map((key) => (
              <div key={key} className="rounded-3xl bg-white p-6 ring-1 ring-neutral-200">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="mt-3 h-5 w-56" />
                <Skeleton className="mt-5 h-10 w-full" />
              </div>
            ))}
          {items?.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              canWrite={canWrite}
              onStatus={(status) => void changeStatus(appointment, status)}
            />
          ))}
        </div>

        {items?.length === 0 && !error && (
          <div className="mt-2">
            <EmptyState icon={CalendarDays} title="No appointments this day">
              Bookings from the website appear here as soon as they are made.
            </EmptyState>
          </div>
        )}
      </main>
    </AdminShell>
  );
}
