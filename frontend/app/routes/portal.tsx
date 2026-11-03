import type { AvailabilityDay } from '@edc/shared';
import {
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  Loader2,
  LogOut,
  MapPin,
  Phone,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { SlotPicker } from '../components/SlotPicker';
import { Button, ButtonLink } from '../components/ui/Button';
import { Badge, EmptyState, Skeleton } from '../components/ui/primitives';
import { PortalError, portalApi, type PortalAppointment } from '../lib/portal-api';
import { pageMeta } from '../lib/seo';
import { reasonLabel } from '../lib/treatments';
import { container } from '../lib/ui';

export function meta() {
  return pageMeta({
    title: 'My Appointments | Expressions Dental Clinic',
    description: 'Your appointments at Expressions Dental Clinic.',
    path: '/portal',
    noindex: true,
  });
}

const STATUS: Record<
  PortalAppointment['status'],
  { label: string; tone: 'brand' | 'info' | 'success' | 'neutral' | 'warning' }
> = {
  pending: { label: 'Awaiting confirmation', tone: 'warning' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  checked_in: { label: 'Checked in', tone: 'info' },
  completed: { label: 'Completed', tone: 'neutral' },
  no_show: { label: 'Missed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

function when(iso: string) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));
}

/** Picks a new free time at the same clinic; the clinic then confirms it again. */
function ChangeTime({
  appointment,
  onMoved,
  onClose,
}: {
  appointment: PortalAppointment;
  onMoved: (startAt: string) => Promise<void>;
  onClose: () => void;
}) {
  const branch = appointment.location?.id ?? '';
  const [days, setDays] = useState<AvailabilityDay[] | null | 'off'>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/public/availability/${branch}?days=14`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((list: AvailabilityDay[]) => {
        if (!cancelled) setDays(list.some((day) => day.availableCount > 0) ? list : 'off');
      })
      .catch(() => {
        if (!cancelled) setDays('off');
      });
    return () => {
      cancelled = true;
    };
  }, [branch]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const slotStart = new FormData(event.currentTarget).get('slotStart');
    if (typeof slotStart !== 'string' || !slotStart) {
      setError('Choose a new time.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const moved = await portalApi.reschedule(appointment.id, slotStart);
      await onMoved(moved.startAt);
    } catch (caught) {
      setError(caught instanceof PortalError ? caught.message : 'Could not change the time.');
      if (caught instanceof PortalError && caught.status === 409) setRefresh((value) => value + 1);
    } finally {
      setSaving(false);
    }
  };

  if (days === null) {
    return (
      <p className="flex items-center gap-2 text-muted">
        <Loader2 size={18} className="animate-spin motion-reduce:animate-none" />
        Checking free times…
      </p>
    );
  }
  if (days === 'off') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p>Online changes aren’t available for this clinic. Please call to change the time.</p>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-6">
      <SlotPicker branch={branch} days={days} error={error || undefined} refresh={refresh} />
      <p className="text-sm text-muted">
        Your current time is released when you save. The clinic will confirm the new time.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Saving…' : 'Move to this time'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Keep current time
        </Button>
      </div>
    </form>
  );
}

function AppointmentCard({
  appointment,
  onCancel,
  onMoved,
}: {
  appointment: PortalAppointment;
  onCancel?: () => Promise<void>;
  onMoved?: (startAt: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<'idle' | 'cancel' | 'move'>('idle');
  const [busy, setBusy] = useState(false);
  const status = STATUS[appointment.status];
  const { location } = appointment;

  return (
    <article className="rounded-3xl bg-white p-5 ring-1 ring-neutral-200 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{appointment.reference}</p>
          <h3 className="mt-1 text-lg font-bold">{when(appointment.startAt)}</h3>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-2 text-[0.95rem] sm:grid-cols-2">
        <div>
          <dt className="text-muted">Patient</dt>
          <dd className="font-semibold">{appointment.patientName}</dd>
        </div>
        <div>
          <dt className="text-muted">Visit for</dt>
          <dd className="font-semibold">{reasonLabel(appointment.reason)}</dd>
        </div>
      </dl>
      {location && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[0.95rem]">
          <span className="inline-flex items-center gap-2">
            <MapPin size={16} className="shrink-0 text-primary-600" />
            {location.name}
          </span>
          {location.phone && (
            <a
              href={`tel:${location.phone}`}
              className="inline-flex min-h-11 items-center gap-2 font-semibold hover:text-primary-700"
            >
              <Phone size={16} className="text-primary-600" />
              {location.phone}
            </a>
          )}
        </div>
      )}
      {onCancel && appointment.canCancel && (
        <div className="mt-5 border-t border-neutral-200 pt-4">
          {mode === 'move' && onMoved ? (
            <ChangeTime
              appointment={appointment}
              onMoved={async (startAt) => {
                await onMoved(startAt);
                setMode('idle');
              }}
              onClose={() => setMode('idle')}
            />
          ) : mode === 'cancel' ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-semibold">Cancel this appointment?</p>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  onCancel().finally(() => setBusy(false));
                }}
              >
                {busy ? 'Cancelling…' : 'Yes, cancel it'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode('idle')}>
                Keep it
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {onMoved && (
                <Button size="sm" variant="secondary" onClick={() => setMode('move')}>
                  <CalendarClock size={16} />
                  Change time
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setMode('cancel')}>
                <CalendarX2 size={16} />
                Cancel appointment
              </Button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/** The signed-in patient's (or family's) appointments. Data loads in the browser only. */
export default function Portal() {
  const navigate = useNavigate();
  const [data, setData] = useState<{
    upcoming: PortalAppointment[];
    past: PortalAppointment[];
  } | null>(null);
  const [signedInAs, setSignedInAs] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const [me, appointments] = await Promise.all([portalApi.me(), portalApi.appointments()]);
      setSignedInAs(me.signedInAs);
      setData(appointments);
    } catch (caught) {
      if (caught instanceof PortalError && caught.status === 401) {
        navigate('/portal/login', { replace: true });
        return;
      }
      setMessage('We couldn’t load your appointments. Please refresh the page.');
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const cancel = async (id: string) => {
    setMessage('');
    try {
      await portalApi.cancel(id);
      setMessage('Your appointment has been cancelled.');
      await load();
    } catch (caught) {
      setMessage(
        caught instanceof PortalError ? caught.message : 'Something went wrong. Please call us.',
      );
    }
  };

  const signOut = async () => {
    await portalApi.logout();
    navigate('/portal/login', { replace: true });
  };

  return (
    <>
      <PageHeader
        crumbs={[{ name: 'My appointments', path: '/portal' }]}
        title="My appointments"
        intro={signedInAs ? `Signed in as ${signedInAs}` : undefined}
      >
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/book" size="sm">
            <CalendarPlus size={16} />
            Book another visit
          </ButtonLink>
          <Button size="sm" variant="secondary" onClick={() => void signOut()}>
            <LogOut size={16} />
            Sign out
          </Button>
        </div>
      </PageHeader>

      <section className={`${container} py-10 md:py-14`}>
        <div className="mx-auto max-w-3xl">
          <p role="status" className="empty:hidden mb-6 rounded-2xl bg-surface p-4 font-medium">
            {message}
          </p>
          {!data ? (
            <div className="space-y-4" aria-busy="true">
              <Skeleton className="h-40 rounded-3xl" />
              <Skeleton className="h-40 rounded-3xl" />
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold">Upcoming</h2>
              <div className="mt-4 space-y-4">
                {data.upcoming.length === 0 ? (
                  <EmptyState
                    icon={CalendarPlus}
                    title="No upcoming appointments"
                    action={<ButtonLink href="/book">Book a visit</ButtonLink>}
                  >
                    Visits booked by phone may not show here. Call the clinic to check them.
                  </EmptyState>
                ) : (
                  data.upcoming.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      onCancel={() => cancel(appointment.id)}
                      onMoved={async (startAt) => {
                        setMessage(
                          `Moved to ${when(startAt)}. The clinic will confirm the new time.`,
                        );
                        await load();
                      }}
                    />
                  ))
                )}
              </div>
              {data.upcoming.some((appointment) => !appointment.canCancel) && (
                <p className="mt-4 text-sm text-muted">
                  Appointments less than 2 hours away can’t be changed or cancelled online. Please
                  call the clinic.
                </p>
              )}

              {data.past.length > 0 && (
                <>
                  <h2 className="mt-12 text-xl font-bold">Past and cancelled</h2>
                  <div className="mt-4 space-y-4">
                    {data.past.map((appointment) => (
                      <AppointmentCard key={appointment.id} appointment={appointment} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
