import type { StaffProfile } from '@edc/shared';
import { CalendarOff, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { AdminShell } from '../components/AdminShell';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/primitives';
import {
  adminApi,
  ApiError,
  schedulingApi,
  type BranchSchedule,
  type ScheduleSettings,
  type Weekly,
} from '../lib/admin-api';
import { container } from '../lib/ui';

export function meta() {
  return [
    { title: 'Schedule | Expressions Dental admin' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

const DAYS: Array<{ key: keyof Weekly; label: string }> = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const SLOT_LENGTHS = [10, 15, 20, 30, 45, 60, 90, 120];
const NOTICE = [
  { value: 0, label: 'No minimum' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
  { value: 1440, label: '1 day' },
  { value: 2880, label: '2 days' },
];

/** Starting point when a branch has no schedule yet; saved switched off until reviewed. */
const NEW_SCHEDULE: ScheduleSettings = {
  active: false,
  slotMinutes: 30,
  capacity: 1,
  minNoticeMinutes: 120,
  maxDaysAhead: 60,
  weekly: {
    monday: [{ open: '10:00', close: '20:00' }],
    tuesday: [{ open: '10:00', close: '20:00' }],
    wednesday: [{ open: '10:00', close: '20:00' }],
    thursday: [{ open: '10:00', close: '20:00' }],
    friday: [{ open: '10:00', close: '20:00' }],
    saturday: [{ open: '10:00', close: '20:00' }],
    sunday: [],
  },
};

const fieldClass = 'mt-1 block min-h-11 w-full rounded-xl bg-white px-3 ring-1 ring-neutral-300';

const holidayDate = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));

function ScheduleEditor({
  branch,
  canEdit,
  onSaved,
}: {
  branch: BranchSchedule;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [settings, setSettings] = useState<ScheduleSettings | null>(
    branch.schedule
      ? {
          active: branch.schedule.active,
          slotMinutes: branch.schedule.slotMinutes,
          capacity: branch.schedule.capacity,
          minNoticeMinutes: branch.schedule.minNoticeMinutes,
          maxDaysAhead: branch.schedule.maxDaysAhead,
          weekly: branch.schedule.weekly,
        }
      : null,
  );
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [holiday, setHoliday] = useState({ date: '', reason: '' });

  if (!settings) {
    return (
      <div className="mt-4 rounded-2xl bg-surface p-5">
        <p className="font-semibold">Online booking isn’t set up for this clinic.</p>
        <p className="mt-1 text-muted">
          Patients use the request form and the front desk confirms by phone or WhatsApp.
        </p>
        {canEdit && (
          <Button className="mt-4" size="sm" onClick={() => setSettings(NEW_SCHEDULE)}>
            Set up online booking
          </Button>
        )}
      </div>
    );
  }

  const update = (patch: Partial<ScheduleSettings>) => setSettings({ ...settings, ...patch });
  const setDay = (day: keyof Weekly, intervals: Weekly[keyof Weekly]) =>
    update({ weekly: { ...settings.weekly, [day]: intervals } });

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await schedulingApi.saveSchedule(branch.id, settings);
      setMessage({ tone: 'ok', text: 'Saved. Patients see the new times straight away.' });
      onSaved();
    } catch (caught) {
      const detail =
        caught instanceof ApiError && caught.fieldErrors[0]
          ? caught.fieldErrors[0].message
          : caught instanceof ApiError
            ? caught.message
            : 'Could not save.';
      setMessage({ tone: 'error', text: detail });
    } finally {
      setSaving(false);
    }
  };

  const addHoliday = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await schedulingApi.addHoliday(branch.id, holiday.date, holiday.reason);
      setHoliday({ date: '', reason: '' });
      onSaved();
    } catch (caught) {
      setMessage({
        tone: 'error',
        text: caught instanceof ApiError ? caught.message : 'Could not add the closed day.',
      });
    }
  };

  const removeHoliday = async (id: string) => {
    try {
      await schedulingApi.removeHoliday(id);
      onSaved();
    } catch {
      setMessage({ tone: 'error', text: 'Could not remove the closed day.' });
    }
  };

  return (
    <div className="mt-4 space-y-8">
      <form onSubmit={save}>
        <fieldset disabled={!canEdit || saving} className="space-y-6">
          <legend className="sr-only">Online booking settings for {branch.name}</legend>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
            <input
              type="checkbox"
              checked={settings.active}
              onChange={(event) => update({ active: event.target.checked })}
              className="size-5 accent-primary-600"
            />
            Take online bookings
          </label>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-semibold">
              Appointment length
              <select
                value={settings.slotMinutes}
                onChange={(event) => update({ slotMinutes: Number(event.target.value) })}
                className={fieldClass}
              >
                {SLOT_LENGTHS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Patients at the same time
              <input
                type="number"
                min={1}
                max={10}
                value={settings.capacity}
                onChange={(event) => update({ capacity: Number(event.target.value) })}
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-semibold">
              Book at least
              <select
                value={settings.minNoticeMinutes}
                onChange={(event) => update({ minNoticeMinutes: Number(event.target.value) })}
                className={fieldClass}
              >
                {NOTICE.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                    {option.value ? ' ahead' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Book up to (days ahead)
              <input
                type="number"
                min={1}
                max={180}
                value={settings.maxDaysAhead}
                onChange={(event) => update({ maxDaysAhead: Number(event.target.value) })}
                className={fieldClass}
              />
            </label>
          </div>

          <div>
            <h3 className="font-semibold">Opening hours for bookings</h3>
            <p className="text-sm text-muted">
              Add a second block to leave a lunch break. Times are Goa time.
            </p>
            <div className="mt-3 divide-y divide-neutral-200 rounded-2xl ring-1 ring-neutral-200">
              {DAYS.map(({ key, label }) => {
                const intervals = settings.weekly[key];
                return (
                  <div key={key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="w-28 font-semibold">{label}</span>
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      {intervals.length === 0 && <span className="text-muted">Closed</span>}
                      {intervals.map((interval, index) => (
                        <span key={index} className="flex items-center gap-1">
                          <input
                            type="time"
                            aria-label={`${label} block ${index + 1} opens`}
                            value={interval.open}
                            onChange={(event) =>
                              setDay(
                                key,
                                intervals.map((item, i) =>
                                  i === index ? { ...item, open: event.target.value } : item,
                                ),
                              )
                            }
                            className="min-h-11 rounded-xl bg-white px-2 ring-1 ring-neutral-300"
                          />
                          <span aria-hidden="true">–</span>
                          <input
                            type="time"
                            aria-label={`${label} block ${index + 1} closes`}
                            value={interval.close}
                            onChange={(event) =>
                              setDay(
                                key,
                                intervals.map((item, i) =>
                                  i === index ? { ...item, close: event.target.value } : item,
                                ),
                              )
                            }
                            className="min-h-11 rounded-xl bg-white px-2 ring-1 ring-neutral-300"
                          />
                          <button
                            type="button"
                            aria-label={`Remove ${label} block ${index + 1}`}
                            onClick={() =>
                              setDay(
                                key,
                                intervals.filter((_, i) => i !== index),
                              )
                            }
                            className="grid size-11 place-items-center rounded-full text-neutral-600 hover:bg-neutral-100"
                          >
                            <X size={18} />
                          </button>
                        </span>
                      ))}
                    </div>
                    {intervals.length < 4 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setDay(key, [
                            ...intervals,
                            intervals.length
                              ? { open: '14:00', close: '20:00' }
                              : { open: '10:00', close: '20:00' },
                          ])
                        }
                      >
                        <Plus size={16} />
                        {intervals.length ? 'Add block' : 'Open'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {canEdit && (
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save schedule'}
            </Button>
          )}
        </fieldset>
      </form>

      {message && (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={
            message.tone === 'error'
              ? 'rounded-2xl bg-[#FEF4F3] p-4 font-medium text-[#92020B]'
              : 'rounded-2xl bg-[#E8F7EE] p-4 font-medium text-[#0B5E31]'
          }
        >
          {message.text}
        </p>
      )}

      {branch.schedule && (
        <div>
          <h3 className="font-semibold">Closed days</h3>
          <p className="text-sm text-muted">Holidays and other days with no online bookings.</p>
          <ul className="mt-3 space-y-2">
            {branch.holidays.length === 0 && <li className="text-muted">None coming up.</li>}
            {branch.holidays.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-2"
              >
                <span>
                  <span className="font-semibold">{holidayDate(entry.date)}</span>
                  {entry.reason && <span className="text-muted"> · {entry.reason}</span>}
                </span>
                {canEdit && (
                  <button
                    type="button"
                    aria-label={`Remove closed day ${holidayDate(entry.date)}`}
                    onClick={() => void removeHoliday(entry.id)}
                    className="grid size-11 place-items-center rounded-full text-neutral-600 hover:bg-neutral-100"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {canEdit && (
            <form onSubmit={addHoliday} className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-sm font-semibold">
                Date
                <input
                  type="date"
                  required
                  value={holiday.date}
                  onChange={(event) => setHoliday({ ...holiday, date: event.target.value })}
                  className={fieldClass}
                />
              </label>
              <label className="flex-1 text-sm font-semibold">
                Reason <span className="font-normal text-muted">(optional)</span>
                <input
                  maxLength={120}
                  value={holiday.reason}
                  onChange={(event) => setHoliday({ ...holiday, reason: event.target.value })}
                  placeholder="e.g. Diwali"
                  className={fieldClass}
                />
              </label>
              <Button type="submit" variant="secondary">
                <CalendarOff size={16} />
                Add closed day
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

/** Per-branch booking hours, appointment length, chairs and closed days. */
export default function AdminSchedule() {
  const navigate = useNavigate();
  const [me, setMe] = useState<StaffProfile | null>(null);
  const [branches, setBranches] = useState<BranchSchedule[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const profile = await adminApi.me();
      setMe(profile);
      if (!profile.permissions.includes('appointments.read')) {
        setBranches([]);
        return;
      }
      setBranches(await schedulingApi.schedules());
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        navigate('/admin/login', { replace: true });
        return;
      }
      setError(caught instanceof ApiError ? caught.message : 'Could not reach the server.');
      setBranches([]);
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = me?.permissions.includes('settings.write') ?? false;

  return (
    <AdminShell me={me}>
      <main className={`${container} py-8`}>
        <h1 className="text-2xl font-bold sm:text-3xl">Schedule</h1>
        <p className="mt-1 text-muted">
          When patients can book online at each clinic.
          {me && !canEdit && ' Only the owner can change these settings.'}
        </p>

        {error && (
          <p role="alert" className="mt-6 rounded-2xl bg-[#FEF4F3] p-4 font-medium text-[#92020B]">
            {error}
          </p>
        )}

        <div className="mt-6 space-y-6">
          {branches === null && <Skeleton className="h-96 rounded-3xl" />}
          {branches?.map((branch) => (
            <section
              key={branch.id}
              className="rounded-3xl bg-white p-5 ring-1 ring-neutral-200 sm:p-7"
            >
              <h2 className="text-xl font-bold">{branch.name}</h2>
              <ScheduleEditor branch={branch} canEdit={canEdit} onSaved={() => void load()} />
            </section>
          ))}
        </div>
      </main>
    </AdminShell>
  );
}
