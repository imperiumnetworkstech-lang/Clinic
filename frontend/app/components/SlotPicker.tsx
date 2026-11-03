import type { AvailabilityDay, AvailableSlot } from '@edc/shared';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../lib/cn';
import { formatDate, goaDate, slotLabel } from '../lib/goa-time';

const DAY_PARTS = [
  { label: 'Morning', from: 0, to: 12 },
  { label: 'Afternoon', from: 12, to: 17 },
  { label: 'Evening', from: 17, to: 24 },
];

const chipClass =
  'relative flex cursor-pointer flex-col items-center justify-center rounded-2xl bg-white ring-1 ring-neutral-200 transition hover:bg-neutral-50 has-[:checked]:bg-primary-600 has-[:checked]:text-white has-[:checked]:ring-primary-600 has-[:disabled]:cursor-not-allowed has-[:disabled]:bg-neutral-50 has-[:disabled]:text-neutral-500 has-[:disabled]:hover:bg-neutral-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-secondary-500';

/**
 * Live slot picker: a strip of the next days with free times, then that day's slots. Both are
 * native radio groups, so arrow keys and screen readers work without extra code.
 */
export function SlotPicker({
  branch,
  days,
  initialSlot,
  error,
  refresh = 0,
  footnote,
}: {
  branch: string;
  days: AvailabilityDay[];
  initialSlot?: string;
  error?: string;
  refresh?: number;
  footnote?: string;
}) {
  const firstOpen = days.find((day) => day.availableCount > 0)?.date ?? '';
  const [date, setDate] = useState(initialSlot ? goaDate(initialSlot) : firstOpen);
  const [slots, setSlots] = useState<AvailableSlot[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setSlots(null);
    setLoadFailed(false);
    fetch(`/api/v1/public/availability/${branch}/${date}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((body: { slots: AvailableSlot[] }) => {
        if (!cancelled) setSlots(body.slots);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [branch, date, refresh]);

  const dayLabel = (iso: string) => {
    const value = new Date(`${iso}T00:00:00Z`);
    const part = (options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat('en-IN', { ...options, timeZone: 'UTC' }).format(value);
    return {
      weekday: part({ weekday: 'short' }),
      day: part({ day: 'numeric' }),
      month: part({ month: 'short' }),
    };
  };

  return (
    <div className="space-y-8">
      <fieldset className="min-w-0">
        <legend className="font-semibold">Choose a day</legend>
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
          {days.map((day) => {
            const label = dayLabel(day.date);
            const full = day.availableCount === 0;
            return (
              <label
                key={day.date}
                className={cn(chipClass, 'min-h-20 min-w-[4.5rem] shrink-0 px-2')}
              >
                <input
                  type="radio"
                  name="slotDate"
                  value={day.date}
                  checked={date === day.date}
                  disabled={full}
                  onChange={() => setDate(day.date)}
                  className="sr-only"
                />
                <span className="text-xs font-semibold uppercase">{label.weekday}</span>
                <span className="text-xl leading-tight font-bold">{label.day}</span>
                <span className="text-xs">
                  {full ? (day.open ? 'Full' : 'Closed') : label.month}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset aria-describedby={error ? 'slotStart-error' : undefined} aria-busy={!slots}>
        <legend className="font-semibold">
          Choose a time
          {date && <span className="font-normal text-muted"> · {formatDate(date)}</span>}
        </legend>
        {loadFailed ? (
          <p className="mt-3 text-[0.95rem] text-muted">
            We couldn’t load times for this day. Please pick another day, or call us.
          </p>
        ) : !slots ? (
          <p className="mt-3 flex items-center gap-2 text-[0.95rem] text-muted">
            <Loader2 size={18} className="animate-spin motion-reduce:animate-none" />
            Checking free times…
          </p>
        ) : (
          DAY_PARTS.map((part) => {
            const inPart = slots.filter((slot) => {
              const hour = Number(slot.time.slice(0, 2));
              return hour >= part.from && hour < part.to;
            });
            if (inPart.length === 0) return null;
            return (
              <div key={part.label} className="mt-4">
                <p className="text-sm font-semibold text-muted">{part.label}</p>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {inPart.map((slot) => (
                    <label key={slot.start} className={cn(chipClass, 'min-h-12 px-2')}>
                      <input
                        type="radio"
                        name="slotStart"
                        value={slot.start}
                        defaultChecked={slot.start === initialSlot && slot.available}
                        disabled={!slot.available}
                        required={slot.available}
                        className="sr-only"
                      />
                      <span className={cn('font-semibold', !slot.available && 'line-through')}>
                        {slotLabel(slot.time)}
                      </span>
                      {!slot.available && <span className="sr-only"> (taken)</span>}
                    </label>
                  ))}
                </div>
              </div>
            );
          })
        )}
        {error && (
          <p id="slotStart-error" role="alert" className="mt-2 text-sm font-medium text-[#B60411]">
            {error}
          </p>
        )}
      </fieldset>
      {footnote && <p className="text-sm text-muted">{footnote}</p>}
    </div>
  );
}
