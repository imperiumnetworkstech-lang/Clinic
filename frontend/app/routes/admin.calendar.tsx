import { CalendarPlus, ChevronLeft, ChevronRight, ExternalLink, RefreshCw } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Link } from 'react-router';
import { AdminShell } from '../components/AdminShell';
import { BookAppointmentSheet, type BookingDefaults } from '../components/BookAppointmentSheet';
import { Button } from '../components/ui/Button';
import { Sheet } from '../components/ui/Sheet';
import {
  ApiError,
  crmApi,
  schedulingApi,
  type AppointmentStatus,
  type CalendarItem,
} from '../lib/admin-api';
import { branches } from '../lib/clinic';
import { cn } from '../lib/cn';
import { reasonLabel } from '../lib/treatments';
import { container } from '../lib/ui';
import { useStaff } from '../lib/use-staff';

export function meta() {
  return [
    { title: 'Calendar | Expressions Dental admin' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

const DAY_START = 8 * 60;
const DAY_END = 21 * 60;
const PX_PER_MIN = 1.2;
const SNAP = 15;
const MOVABLE: AppointmentStatus[] = ['pending', 'confirmed'];

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  pending: 'bg-[#FFF5EA] ring-[#E7A13B] text-[#6A4100]',
  confirmed: 'bg-primary-50 ring-primary-300 text-primary-900',
  checked_in: 'bg-secondary-50 ring-secondary-300 text-secondary-900',
  completed: 'bg-neutral-100 ring-neutral-300 text-neutral-700',
  no_show: 'bg-neutral-100 ring-neutral-300 text-neutral-500 line-through',
  cancelled: 'bg-white ring-neutral-200 text-neutral-400 line-through',
};

const todayInGoa = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Monday of the week containing `iso`. */
function weekStart(iso: string) {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return addDays(iso, -((day + 6) % 7));
}

/** Clinic-local date and minutes since midnight for an instant. */
function goaParts(iso: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const clock = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  return `${((h + 11) % 12) + 1}:${String(minutes % 60).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
};

const dayHeading = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));

interface Placed {
  item: CalendarItem;
  day: number;
  start: number;
  end: number;
  lane: number;
  lanes: number;
}

/** Side-by-side lanes for overlapping appointments within one day. */
function layout(items: CalendarItem[], days: string[]): Placed[] {
  const placed: Placed[] = [];
  days.forEach((date, day) => {
    const today = items
      .map((item) => ({ item, from: goaParts(item.startAt), to: goaParts(item.endAt) }))
      .filter(({ from }) => from.date === date)
      .map(({ item, from, to }) => ({
        item,
        day,
        start: from.minutes,
        end: Math.max(to.date === date ? to.minutes : DAY_END, from.minutes + SNAP),
        lane: 0,
        lanes: 1,
      }))
      .sort((a, b) => a.start - b.start || a.end - b.end);
    let group: Placed[] = [];
    let groupEnd = -1;
    const flush = () => {
      const lanes = Math.max(1, ...group.map((entry) => entry.lane + 1));
      for (const entry of group) entry.lanes = lanes;
      placed.push(...group);
      group = [];
    };
    for (const entry of today) {
      if (entry.start >= groupEnd && group.length) flush();
      const used = new Set(
        group.filter((other) => other.end > entry.start).map((other) => other.lane),
      );
      let lane = 0;
      while (used.has(lane)) lane += 1;
      entry.lane = lane;
      group.push(entry);
      groupEnd = Math.max(groupEnd, entry.end);
    }
    if (group.length) flush();
  });
  return placed;
}

function DetailsSheet({
  item,
  canWrite,
  onOpenChange,
  onChanged,
}: {
  item: CalendarItem | null;
  canWrite: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: (message: string) => void;
}) {
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    setError('');
    setConflict(false);
  }, [item]);
  if (!item) return null;
  const from = goaParts(item.startAt);
  const length = Math.round((Date.parse(item.endAt) - Date.parse(item.startAt)) / 60_000);
  const movable = canWrite && MOVABLE.includes(item.status);

  const move = async (force: boolean) => {
    const form = formRef.current;
    if (!form?.reportValidity()) return;
    const data = new FormData(form);
    try {
      await crmApi.move(item.id, {
        startAt: new Date(
          `${String(data.get('date'))}T${String(data.get('time'))}:00+05:30`,
        ).toISOString(),
        durationMinutes: Number(data.get('duration')),
        force,
      });
      onOpenChange(false);
      onChanged(`${item.reference} moved.`);
    } catch (caught) {
      setConflict(
        caught instanceof ApiError && ['slot_full', 'dentist_busy'].includes(caught.code),
      );
      setError(caught instanceof ApiError ? caught.message : 'Could not move it.');
    }
  };

  const setStatus = async (status: AppointmentStatus) => {
    try {
      await schedulingApi.setStatus(item.id, status);
      onOpenChange(false);
      onChanged(`${item.reference} marked ${status.replace('_', ' ')}.`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not update it.');
    }
  };

  return (
    <Sheet open onOpenChange={onOpenChange} title={item.patient?.name ?? item.reference}>
      <dl className="mt-4 grid gap-2 text-[0.95rem]">
        {[
          ['When', `${dayHeading(from.date)}, ${clock(from.minutes)} · ${length} min`],
          ['Visit for', reasonLabel(item.reason)],
          ['Clinic', item.location?.name ?? '—'],
          ['Dentist', item.dentist?.name ?? 'Not assigned'],
          ['Status', item.status.replace('_', ' ')],
          ['Reference', item.reference],
        ].map(([term, value]) => (
          <div key={term} className="flex justify-between gap-4">
            <dt className="text-muted">{term}</dt>
            <dd className="text-right font-semibold capitalize">{value}</dd>
          </div>
        ))}
      </dl>
      {item.notes && (
        <p className="mt-3 rounded-2xl bg-surface p-3 whitespace-pre-line">{item.notes}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {item.patient && (
          <Link
            to={`/admin/patients/${item.patient.id}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-50 px-4 font-semibold text-primary-700"
          >
            <ExternalLink size={16} />
            Patient record
          </Link>
        )}
        {canWrite && item.status === 'pending' && (
          <Button size="sm" onClick={() => void setStatus('confirmed')}>
            Confirm
          </Button>
        )}
        {canWrite && item.status === 'confirmed' && (
          <Button size="sm" onClick={() => void setStatus('checked_in')}>
            Check in
          </Button>
        )}
      </div>

      {movable && (
        <form
          ref={formRef}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void move(false);
          }}
          className="mt-6 border-t border-neutral-200 pt-5"
        >
          <h3 className="font-bold">Move</h3>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <label className="text-sm font-semibold">
              Date
              <input
                name="date"
                type="date"
                required
                defaultValue={from.date}
                className="mt-1 block min-h-11 w-full rounded-xl px-2 ring-1 ring-neutral-300"
              />
            </label>
            <label className="text-sm font-semibold">
              Time
              <input
                name="time"
                type="time"
                required
                step={300}
                defaultValue={hhmm(from.minutes)}
                className="mt-1 block min-h-11 w-full rounded-xl px-2 ring-1 ring-neutral-300"
              />
            </label>
            <label className="text-sm font-semibold">
              Length
              <select
                name="duration"
                defaultValue={length}
                className="mt-1 block min-h-11 w-full rounded-xl px-2 ring-1 ring-neutral-300"
              >
                {[...new Set([15, 20, 30, 45, 60, 90, 120, length])]
                  .sort((a, b) => a - b)
                  .map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} min
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {error && (
            <div
              role="alert"
              className="mt-3 rounded-2xl bg-[#FEF4F3] p-3 text-sm font-medium text-[#92020B]"
            >
              {error}
              {conflict && (
                <Button
                  className="mt-2"
                  size="sm"
                  variant="secondary"
                  onClick={() => void move(true)}
                >
                  Move anyway
                </Button>
              )}
            </div>
          )}
          <Button type="submit" size="sm" className="mt-4">
            Move appointment
          </Button>
        </form>
      )}
    </Sheet>
  );
}

/** Week (or, on phones, day) calendar. Drag to move; tap for details and a move form. */
export default function AdminCalendar() {
  const { me, can, problem } = useStaff();
  const [compact, setCompact] = useState(false);
  const [anchor, setAnchor] = useState(todayInGoa);
  const [branch, setBranch] = useState('');
  const [items, setItems] = useState<CalendarItem[] | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [booking, setBooking] = useState<BookingDefaults | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const from = compact ? anchor : weekStart(anchor);
  const dayCount = compact ? 1 : 7;
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => addDays(from, i)),
    [from, dayCount],
  );
  const canWrite = can('appointments.write');

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await crmApi.calendar(from, dayCount, branch || undefined);
      setItems(result.items);
    } catch (caught) {
      setError(problem(caught));
      setItems([]);
    }
  }, [from, dayCount, branch, problem]);

  useEffect(() => {
    if (me) void load();
  }, [me, load]);

  const placed = useMemo(() => layout(items ?? [], days), [items, days]);
  const today = todayInGoa();

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, item: CalendarItem) => {
    if (!canWrite || !MOVABLE.includes(item.status) || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { id: item.id, x: event.clientX, y: event.clientY, moved: false };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = dragStart.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) < 6) return;
    start.moved = true;
    setDrag({ id: start.id, dx, dy });
  };

  const onPointerUp = async (item: CalendarItem, entry: Placed) => {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start?.moved || !drag) {
      setDrag(null);
      setSelected(item);
      return;
    }
    const columnWidth = (grid.current?.clientWidth ?? 1) / dayCount;
    const dayShift = Math.round(drag.dx / columnWidth);
    const minuteShift = Math.round(drag.dy / PX_PER_MIN / SNAP) * SNAP;
    setDrag(null);
    if (!dayShift && !minuteShift) return;
    const length = entry.end - entry.start;
    const startMinutes = Math.min(Math.max(entry.start + minuteShift, DAY_START), DAY_END - length);
    const date = addDays(days[entry.day] ?? from, dayShift);
    try {
      await crmApi.move(item.id, {
        startAt: new Date(`${date}T${hhmm(startMinutes)}:00+05:30`).toISOString(),
      });
      setMessage(
        `${item.patient?.name ?? item.reference} moved to ${dayHeading(date)}, ${clock(startMinutes)}.`,
      );
    } catch (caught) {
      setMessage('');
      setError(
        caught instanceof ApiError
          ? `${caught.message} Open it to move anyway.`
          : 'Could not move it.',
      );
    }
    void load();
  };

  const newAt = (day: string, event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canWrite || event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const minutes = DAY_START + Math.floor((event.clientY - rect.top) / PX_PER_MIN / SNAP) * SNAP;
    setBooking({ date: day, time: hhmm(minutes), branch: branch || undefined });
  };

  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START + i * 60);
  const shift = compact ? 1 : 7;

  return (
    <AdminShell me={me}>
      <main className={`${container} py-8`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Calendar</h1>
            <p className="mt-1 text-muted">
              {compact
                ? dayHeading(from)
                : `${dayHeading(days[0] ?? from)} – ${dayHeading(days[6] ?? from)}`}
              {canWrite && ' · drag to move, tap for details'}
            </p>
          </div>
          {canWrite && (
            <Button
              size="sm"
              onClick={() =>
                setBooking({ date: compact ? from : today, branch: branch || undefined })
              }
            >
              <CalendarPlus size={16} />
              New appointment
            </Button>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            aria-label={compact ? 'Previous day' : 'Previous week'}
            onClick={() => setAnchor(addDays(from, -shift))}
          >
            <ChevronLeft size={18} />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            aria-label={compact ? 'Next day' : 'Next week'}
            onClick={() => setAnchor(addDays(from, shift))}
          >
            <ChevronRight size={18} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAnchor(today)}>
            Today
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void load()} aria-label="Refresh">
            <RefreshCw size={16} />
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
          <p role="alert" className="mt-4 rounded-2xl bg-[#FEF4F3] p-4 font-medium text-[#92020B]">
            {error}
          </p>
        )}
        <p
          role="status"
          className="mt-4 rounded-2xl bg-[#E8F7EE] p-4 font-medium text-[#0B5E31] empty:hidden"
        >
          {message}
        </p>

        <div className="mt-4 overflow-hidden rounded-3xl bg-white ring-1 ring-neutral-200">
          <div
            className="grid border-b border-neutral-200"
            style={{ gridTemplateColumns: `3.5rem repeat(${dayCount}, minmax(0, 1fr))` }}
          >
            <span />
            {days.map((day) => (
              <span
                key={day}
                className={cn(
                  'px-2 py-3 text-center text-sm font-semibold',
                  day === today && 'text-primary-700',
                )}
              >
                {dayHeading(day)}
              </span>
            ))}
          </div>
          <div className="max-h-[70dvh] overflow-y-auto">
            <div className="grid" style={{ gridTemplateColumns: `3.5rem 1fr` }}>
              <div
                aria-hidden="true"
                className="relative"
                style={{ height: (DAY_END - DAY_START) * PX_PER_MIN }}
              >
                {hours.map((minutes) => (
                  <span
                    key={minutes}
                    className="absolute right-2 -translate-y-1/2 text-xs text-muted"
                    style={{ top: (minutes - DAY_START) * PX_PER_MIN }}
                  >
                    {minutes > DAY_START && clock(minutes).replace(':00', '')}
                  </span>
                ))}
              </div>
              <div
                ref={grid}
                className="relative grid"
                style={{
                  gridTemplateColumns: `repeat(${dayCount}, minmax(0, 1fr))`,
                  height: (DAY_END - DAY_START) * PX_PER_MIN,
                }}
              >
                {days.map((day) => (
                  <div
                    key={day}
                    onPointerUp={(event) => newAt(day, event)}
                    className={cn(
                      'relative border-l border-neutral-200 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_71px,#eef0f2_71px,#eef0f2_72px)]',
                      canWrite && 'cursor-cell',
                      day === today && 'bg-primary-50/30',
                    )}
                  />
                ))}
                {placed.map((entry) => {
                  const { item } = entry;
                  const dragging = drag?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onPointerDown={(event) => onPointerDown(event, item)}
                      onPointerMove={onPointerMove}
                      onPointerUp={() => void onPointerUp(item, entry)}
                      onPointerCancel={() => {
                        dragStart.current = null;
                        setDrag(null);
                      }}
                      onClick={(event) => {
                        // Keyboard activation (Enter/Space) arrives as a click with no pointer.
                        if (event.detail === 0) setSelected(item);
                      }}
                      aria-label={`${item.patient?.name ?? item.reference}, ${clock(entry.start)}, ${item.status.replace('_', ' ')}`}
                      className={cn(
                        'absolute overflow-hidden rounded-xl px-2 py-1 text-left text-xs ring-1 touch-none select-none',
                        STATUS_STYLE[item.status],
                        canWrite && MOVABLE.includes(item.status) && 'cursor-grab',
                        dragging && 'z-10 cursor-grabbing shadow-lg ring-2',
                      )}
                      style={{
                        top: (entry.start - DAY_START) * PX_PER_MIN,
                        height: Math.max((entry.end - entry.start) * PX_PER_MIN - 2, 18),
                        left: `calc(${(entry.day + entry.lane / entry.lanes) * (100 / dayCount)}% + 2px)`,
                        width: `calc(${100 / dayCount / entry.lanes}% - 4px)`,
                        transform: dragging ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined,
                      }}
                    >
                      <span className="block font-semibold">
                        {clock(entry.start)} {item.patient?.name}
                      </span>
                      <span className="block truncate opacity-80">
                        {reasonLabel(item.reason)}
                        {item.dentist ? ` · ${item.dentist.name}` : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          Amber: waiting to be confirmed. Pink: confirmed. Blue: checked in. Grey: done, no-show or
          cancelled.
        </p>
      </main>

      <DetailsSheet
        item={selected}
        canWrite={canWrite}
        onOpenChange={(open) => !open && setSelected(null)}
        onChanged={(text) => {
          setMessage(text);
          void load();
        }}
      />
      <BookAppointmentSheet
        open={booking !== null}
        onOpenChange={(open) => !open && setBooking(null)}
        defaults={booking ?? undefined}
        onBooked={(reference) => {
          setMessage(`Booked and confirmed: ${reference}.`);
          void load();
        }}
      />
    </AdminShell>
  );
}
