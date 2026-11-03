import { useEffect, useRef, useState } from 'react';
import { ApiError, crmApi, type PatientRow } from '../lib/admin-api';
import { branches } from '../lib/clinic';
import { treatmentCategories, VISIT_REASONS } from '../lib/treatments';
import { Button } from './ui/Button';
import { Sheet } from './ui/Sheet';

const fieldClass = 'mt-2 block min-h-12 w-full rounded-2xl bg-white px-4 ring-1 ring-neutral-300';

export interface BookingDefaults {
  date?: string;
  time?: string;
  branch?: string;
}

/**
 * Front desk booking (phone, walk-in, WhatsApp). Confirmed straight away. If the time is full
 * or the dentist is busy, staff see why and can book anyway on purpose.
 */
export function BookAppointmentSheet({
  open,
  onOpenChange,
  patient,
  defaults,
  onBooked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Known patient (from their record); otherwise staff search for one. */
  patient?: { id: string; name: string; code: string };
  defaults?: BookingDefaults;
  onBooked: (reference: string) => void;
}) {
  const [dentists, setDentists] = useState<Array<{ id: string; name: string }>>([]);
  const [chosen, setChosen] = useState(patient ?? null);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<PatientRow[]>([]);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!open) return;
    setChosen(patient ?? null);
    setError('');
    setConflict(false);
    crmApi
      .dentists()
      .then(setDentists)
      .catch(() => setDentists([]));
  }, [open, patient]);

  useEffect(() => {
    if (chosen || query.trim().length < 2) {
      setMatches([]);
      return;
    }
    const timer = setTimeout(() => {
      crmApi
        .patients({ q: query.trim() })
        .then((result) => setMatches(result.items.slice(0, 6)))
        .catch(() => setMatches([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, chosen]);

  const submit = async (force: boolean) => {
    const element = formRef.current;
    if (!element || !element.reportValidity()) return;
    if (!chosen) {
      setError('Choose the patient first.');
      return;
    }
    const form = new FormData(element);
    const value = (key: string) => String(form.get(key) ?? '');
    setSaving(true);
    setError('');
    try {
      const booked = await crmApi.book({
        patientId: chosen.id,
        branch: value('branch'),
        startAt: new Date(`${value('date')}T${value('time')}:00+05:30`).toISOString(),
        durationMinutes: Number(value('duration')),
        reason: value('reason'),
        notes: value('notes'),
        dentistId: value('dentistId') || null,
        source: value('source') as 'phone' | 'walk_in' | 'whatsapp' | 'admin',
        force,
      });
      onBooked(booked.reference);
      onOpenChange(false);
    } catch (caught) {
      const clash =
        caught instanceof ApiError && ['slot_full', 'dentist_busy'].includes(caught.code);
      setConflict(clash);
      setError(caught instanceof ApiError ? caught.message : 'Could not book.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Book an appointment">
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          void submit(false);
        }}
        className="mt-4 space-y-5"
      >
        {chosen ? (
          <p className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4">
            <span>
              <span className="block font-semibold">{chosen.name}</span>
              <span className="text-sm text-muted">{chosen.code}</span>
            </span>
            {!patient && (
              <Button size="sm" variant="ghost" onClick={() => setChosen(null)}>
                Change
              </Button>
            )}
          </p>
        ) : (
          <div>
            <label htmlFor="book-patient" className="block font-semibold">
              Patient
            </label>
            <input
              id="book-patient"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, mobile or code"
              className={fieldClass}
              autoComplete="off"
            />
            {matches.length > 0 && (
              <ul className="mt-2 divide-y divide-neutral-200 rounded-2xl ring-1 ring-neutral-200">
                {matches.map((match) => (
                  <li key={match.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setChosen({ id: match.id, name: match.name, code: match.code })
                      }
                      className="flex min-h-12 w-full flex-col items-start px-4 py-2 text-left hover:bg-neutral-50"
                    >
                      <span className="font-semibold">{match.name}</span>
                      <span className="text-sm text-muted">
                        {match.code} · {match.phone}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-sm text-muted">
              New patient? Register them on the Patients page first.
            </p>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block font-semibold">
            Clinic
            <select
              name="branch"
              defaultValue={defaults?.branch ?? 'mapusa'}
              className={fieldClass}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.shortName}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-semibold">
            Dentist
            <select name="dentistId" defaultValue="" className={fieldClass}>
              <option value="">Not assigned</option>
              {dentists.map((dentist) => (
                <option key={dentist.id} value={dentist.id}>
                  {dentist.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-semibold">
            Date
            <input
              name="date"
              type="date"
              required
              defaultValue={defaults?.date}
              className={fieldClass}
            />
          </label>
          <label className="block font-semibold">
            Time
            <input
              name="time"
              type="time"
              required
              step={300}
              defaultValue={defaults?.time ?? '10:00'}
              className={fieldClass}
            />
          </label>
          <label className="block font-semibold">
            Length
            <select name="duration" defaultValue="30" className={fieldClass}>
              {[15, 20, 30, 45, 60, 90, 120].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
          </label>
          <label className="block font-semibold">
            Booked by
            <select name="source" defaultValue="phone" className={fieldClass}>
              <option value="phone">Phone call</option>
              <option value="walk_in">Walk-in</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="admin">Other</option>
            </select>
          </label>
        </div>
        <label className="block font-semibold">
          Visit for
          <select name="reason" required defaultValue="checkup" className={fieldClass}>
            <optgroup label="Most common">
              {VISIT_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </optgroup>
            {treatmentCategories.map((category) => (
              <optgroup key={category.id} label={category.title}>
                {category.treatments.map((treatment) => (
                  <option key={treatment.slug} value={treatment.slug}>
                    {treatment.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="block font-semibold">
          Note for the team <span className="font-normal text-muted">(optional)</span>
          <textarea name="notes" rows={2} maxLength={500} className={`${fieldClass} py-3`} />
        </label>

        {error && (
          <div role="alert" className="rounded-2xl bg-[#FEF4F3] p-4 font-medium text-[#92020B]">
            <p>{error}</p>
            {conflict && (
              <Button
                className="mt-3"
                size="sm"
                variant="secondary"
                disabled={saving}
                onClick={() => void submit(true)}
              >
                Book anyway
              </Button>
            )}
          </div>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving ? 'Booking…' : 'Book and confirm'}
        </Button>
      </form>
    </Sheet>
  );
}
