import {
  AlertTriangle,
  ArrowLeft,
  CalendarPlus,
  Check,
  ClipboardList,
  Pencil,
  Phone,
  Plus,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { BillingPanel } from '../components/admin/BillingPanel';
import { FilesPanel } from '../components/admin/FilesPanel';
import { AdminShell } from '../components/AdminShell';
import { BookAppointmentSheet } from '../components/BookAppointmentSheet';
import { WhatsAppIcon } from '../components/icons';
import { Button } from '../components/ui/Button';
import { Badge, Skeleton, TextField } from '../components/ui/primitives';
import { Sheet } from '../components/ui/Sheet';
import {
  ApiError,
  crmApi,
  type MedicalHistory,
  type PatientRecord,
  type PlanStatus,
  type TreatmentPlan,
} from '../lib/admin-api';
import { branches } from '../lib/clinic';
import { cn } from '../lib/cn';
import { reasonLabel, treatments } from '../lib/treatments';
import { container } from '../lib/ui';
import { useStaff } from '../lib/use-staff';

export function meta() {
  return [
    { title: 'Patient | Expressions Dental admin' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

const fieldClass =
  'mt-2 block w-full rounded-2xl bg-white px-4 ring-1 ring-neutral-300 outline-none focus:ring-2 focus:ring-secondary-500';

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));

const dateOnly = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));

const PLAN_STATUS: Record<
  PlanStatus,
  { label: string; tone: 'brand' | 'info' | 'success' | 'neutral' | 'warning' }
> = {
  proposed: { label: 'Proposed', tone: 'warning' },
  accepted: { label: 'Accepted', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'brand' },
  completed: { label: 'Completed', tone: 'success' },
  declined: { label: 'Declined', tone: 'neutral' },
};

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-neutral-200 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mt-3 rounded-2xl bg-[#FEF4F3] p-3 text-sm font-medium text-[#92020B]"
    >
      {message}
    </p>
  );
}

/* ------------------------------------------------------------------ details */

function EditDetailsSheet({
  record,
  open,
  onOpenChange,
  onSaved,
}: {
  record: PatientRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState('');
  const { patient } = record;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? '').trim();
    try {
      await crmApi.updatePatient(patient.id, {
        name: value('name'),
        phone: value('phone'),
        email: value('email'),
        dateOfBirth: value('dateOfBirth'),
        ...(value('gender') ? { gender: value('gender') } : {}),
        ...(value('homeBranch') ? { homeBranch: value('homeBranch') } : {}),
      });
      onOpenChange(false);
      onSaved();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? (caught.fieldErrors[0]?.message ?? caught.message)
          : 'Could not save.',
      );
    }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Edit details">
      <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-5">
        <TextField label="Full name" name="name" required defaultValue={patient.name} />
        <TextField
          label="Mobile number"
          name="phone"
          type="tel"
          required
          defaultValue={patient.phone}
        />
        <TextField label="Email" name="email" type="email" defaultValue={patient.email ?? ''} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Date of birth"
            name="dateOfBirth"
            type="date"
            defaultValue={patient.dateOfBirth ?? ''}
          />
          <label className="block font-semibold">
            Gender
            <select
              name="gender"
              defaultValue={patient.gender ?? ''}
              className={`${fieldClass} min-h-12`}
            >
              <option value="">Not recorded</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
              <option value="undisclosed">Prefer not to say</option>
            </select>
          </label>
          <label className="block font-semibold sm:col-span-2">
            Home clinic
            <select
              name="homeBranch"
              defaultValue={patient.homeBranch?.slug ?? ''}
              className={`${fieldClass} min-h-12`}
            >
              <option value="">Not set</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.shortName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ErrorNote message={error} />
        <Button type="submit" size="lg" className="w-full">
          Save details
        </Button>
      </form>
    </Sheet>
  );
}

function RecallForm({
  record,
  canEdit,
  onSaved,
}: {
  record: PatientRecord;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(record.patient.nextRecallOn ?? '');
  const [note, setNote] = useState(record.patient.recallNote);
  const [status, setStatus] = useState('');
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await crmApi.updatePatient(record.patient.id, {
        nextRecallOn: date || null,
        recallNote: note,
      });
      setStatus('Saved.');
      onSaved();
    } catch {
      setStatus('Could not save the recall.');
    }
  };
  return (
    <form onSubmit={(event) => void save(event)} className="grid gap-3">
      <fieldset disabled={!canEdit} className="contents">
        <label className="text-sm font-semibold">
          Next recall
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={`${fieldClass} min-h-11`}
          />
        </label>
        <label className="text-sm font-semibold">
          Reason
          <input
            value={note}
            maxLength={120}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. 6-month check-up and cleaning"
            className={`${fieldClass} min-h-11`}
          />
        </label>
        {canEdit && (
          <Button type="submit" size="sm" variant="secondary">
            Save
          </Button>
        )}
      </fieldset>
      <p role="status" className="text-sm text-muted empty:hidden">
        {status}
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ clinical */

function HistoryForm({
  patientId,
  history,
  canEdit,
}: {
  patientId: string;
  history: MedicalHistory;
  canEdit: boolean;
}) {
  const [value, setValue] = useState(history);
  const [status, setStatus] = useState('');
  const fields: Array<{ key: keyof MedicalHistory; label: string; rows: number }> = [
    { key: 'allergies', label: 'Allergies', rows: 2 },
    { key: 'conditions', label: 'Medical conditions', rows: 2 },
    { key: 'medications', label: 'Current medicines', rows: 2 },
    { key: 'notes', label: 'Other notes', rows: 2 },
  ];
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await crmApi.saveHistory(patientId, value);
      setStatus('Medical history saved.');
    } catch {
      setStatus('Could not save the medical history.');
    }
  };
  return (
    <form onSubmit={(event) => void save(event)}>
      <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">Medical history</legend>
        {fields.map((field) => (
          <label key={field.key} className="text-sm font-semibold">
            {field.label}
            <textarea
              rows={field.rows}
              value={value[field.key]}
              onChange={(event) => setValue({ ...value, [field.key]: event.target.value })}
              className={`${fieldClass} py-2 font-normal`}
            />
          </label>
        ))}
      </fieldset>
      {canEdit && (
        <div className="mt-4 flex items-center gap-3">
          <Button type="submit" size="sm" variant="secondary">
            Save history
          </Button>
          <p role="status" className="text-sm text-muted">
            {status}
          </p>
        </div>
      )}
    </form>
  );
}

function NotesPanel({
  patientId,
  notes,
  canWrite,
  onAdded,
}: {
  patientId: string;
  notes: NonNullable<PatientRecord['clinical']>['notes'];
  canWrite: boolean;
  onAdded: () => void;
}) {
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await crmApi.addNote(patientId, body);
      setBody('');
      onAdded();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save the note.');
    }
  };
  return (
    <>
      {canWrite && (
        <form onSubmit={(event) => void add(event)} className="mb-5">
          <label htmlFor="new-note" className="text-sm font-semibold">
            New note
          </label>
          <textarea
            id="new-note"
            rows={3}
            required
            maxLength={5000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Findings, treatment done, advice given…"
            className={`${fieldClass} py-2`}
          />
          <ErrorNote message={error} />
          <Button type="submit" size="sm" className="mt-3">
            Add note
          </Button>
        </form>
      )}
      {notes.length === 0 ? (
        <p className="text-muted">No clinical notes yet.</p>
      ) : (
        <ol className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-2xl bg-surface p-4">
              <p className="text-sm text-muted">
                {when(note.createdAt)} · {note.author}
              </p>
              <p className="mt-1 whitespace-pre-line">{note.body}</p>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

const TREATMENT_OPTIONS = treatments.map((treatment) => ({
  value: treatment.slug,
  label: treatment.name,
}));

function NewPlanSheet({
  patientId,
  open,
  onOpenChange,
  onSaved,
}: {
  patientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const blank = { treatment: '', tooth: '', sessions: 1 };
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([blank]);
  const [error, setError] = useState('');
  const setItem = (index: number, patch: Partial<typeof blank>) =>
    setItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await crmApi.addPlan(patientId, { title, notes, items });
      setTitle('');
      setNotes('');
      setItems([blank]);
      onOpenChange(false);
      onSaved();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? (caught.fieldErrors[0]?.message ?? caught.message)
          : 'Could not save.',
      );
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="New treatment plan"
      className="md:max-w-[40rem]"
    >
      <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-5">
        <TextField
          label="Plan title"
          required
          maxLength={120}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Lower left molar"
        />
        <fieldset className="space-y-3">
          <legend className="font-semibold">Treatments</legend>
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-[1fr_5rem_4.5rem_auto] items-end gap-2">
              <label className="text-sm font-semibold">
                <span className={cn(index > 0 && 'sr-only')}>Treatment</span>
                <input
                  list="plan-treatments"
                  required
                  maxLength={80}
                  value={item.treatment}
                  onChange={(event) => setItem(index, { treatment: event.target.value })}
                  className={`${fieldClass} min-h-11`}
                />
              </label>
              <label className="text-sm font-semibold">
                <span className={cn(index > 0 && 'sr-only')}>Tooth</span>
                <input
                  maxLength={40}
                  value={item.tooth}
                  placeholder="36"
                  onChange={(event) => setItem(index, { tooth: event.target.value })}
                  className={`${fieldClass} min-h-11 px-2`}
                />
              </label>
              <label className="text-sm font-semibold">
                <span className={cn(index > 0 && 'sr-only')}>Visits</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={item.sessions}
                  onChange={(event) =>
                    setItem(index, { sessions: Number(event.target.value) || 1 })
                  }
                  className={`${fieldClass} min-h-11 px-2`}
                />
              </label>
              <button
                type="button"
                aria-label={`Remove treatment ${index + 1}`}
                disabled={items.length === 1}
                onClick={() => setItems(items.filter((_, i) => i !== index))}
                className="grid size-11 place-items-center rounded-full text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          <datalist id="plan-treatments">
            {TREATMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} label={option.label} />
            ))}
          </datalist>
          {items.length < 30 && (
            <Button size="sm" variant="ghost" onClick={() => setItems([...items, blank])}>
              <Plus size={16} />
              Add treatment
            </Button>
          )}
        </fieldset>
        <label className="block font-semibold">
          Notes <span className="font-normal text-muted">(optional)</span>
          <textarea
            rows={3}
            maxLength={2000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className={`${fieldClass} py-2`}
          />
        </label>
        <ErrorNote message={error} />
        <Button type="submit" size="lg" className="w-full">
          Save plan
        </Button>
      </form>
    </Sheet>
  );
}

function PlanCard({
  plan,
  canWrite,
  onChanged,
}: {
  plan: TreatmentPlan;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const status = PLAN_STATUS[plan.status];
  const [error, setError] = useState('');
  const run = async (action: () => Promise<unknown>) => {
    setError('');
    try {
      await action();
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not update the plan.');
    }
  };
  return (
    <article className="rounded-2xl ring-1 ring-neutral-200">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h3 className="font-bold">{plan.title}</h3>
          <p className="text-sm text-muted">Created {when(plan.createdAt)}</p>
        </div>
        {canWrite ? (
          <label className="flex items-center gap-2 text-sm font-semibold">
            <span className="sr-only">Plan status</span>
            <select
              value={plan.status}
              onChange={(event) =>
                void run(() =>
                  crmApi.updatePlan(plan.id, { status: event.target.value as PlanStatus }),
                )
              }
              className="min-h-11 rounded-full bg-white px-4 ring-1 ring-neutral-300"
            >
              {Object.entries(PLAN_STATUS).map(([value, option]) => (
                <option key={value} value={value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <Badge tone={status.tone}>{status.label}</Badge>
        )}
      </div>
      <ul className="divide-y divide-neutral-200 border-t border-neutral-200">
        {plan.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-2">
            {canWrite && item.status !== 'cancelled' ? (
              <input
                type="checkbox"
                checked={item.status === 'done'}
                aria-label={`${reasonLabel(item.treatment)} done`}
                onChange={(event) =>
                  void run(() =>
                    crmApi.setItemStatus(item.id, event.target.checked ? 'done' : 'planned'),
                  )
                }
                className="size-5 shrink-0 accent-primary-600"
              />
            ) : (
              <Check
                size={18}
                className={cn(
                  'shrink-0',
                  item.status === 'done' ? 'text-[#128C4A]' : 'text-transparent',
                )}
              />
            )}
            <span
              className={cn(
                'flex-1',
                item.status !== 'planned' && 'text-muted',
                item.status === 'cancelled' && 'line-through',
              )}
            >
              <span className="font-semibold">{reasonLabel(item.treatment)}</span>
              {item.tooth && <span className="text-muted"> · tooth {item.tooth}</span>}
              {item.sessions > 1 && <span className="text-muted"> · {item.sessions} visits</span>}
            </span>
            {item.completedAt && (
              <span className="text-sm text-muted">{when(item.completedAt)}</span>
            )}
          </li>
        ))}
      </ul>
      {plan.notes && (
        <p className="border-t border-neutral-200 p-4 text-[0.95rem] whitespace-pre-line">
          {plan.notes}
        </p>
      )}
      <div className="px-4 pb-3">
        <ErrorNote message={error} />
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ page */

export default function AdminPatient() {
  const { id = '' } = useParams();
  const { me, can, problem } = useStaff();
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [booking, setBooking] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      setRecord(await crmApi.patient(id));
    } catch (caught) {
      setError(problem(caught, 'Could not load this patient.'));
    }
  }, [id, problem]);

  useEffect(() => {
    if (me) void load();
  }, [me, load]);

  const patient = record?.patient;
  const clinical = record?.clinical;
  const bookingPatient = useMemo(
    () => (patient ? { id: patient.id, name: patient.name, code: patient.code } : undefined),
    [patient],
  );
  const allergies = clinical?.medicalHistory.allergies;

  return (
    <AdminShell me={me}>
      <main className={`${container} py-8`}>
        <Link
          to="/admin/patients"
          className="inline-flex min-h-11 items-center gap-2 font-semibold text-link hover:underline"
        >
          <ArrowLeft size={18} />
          All patients
        </Link>

        {error && <ErrorNote message={error} />}
        {!record && !error && <Skeleton className="mt-4 h-40 rounded-3xl" />}

        {record && patient && (
          <>
            <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted">
                  {patient.code} · registered {when(patient.createdAt)}
                </p>
                <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{patient.name}</h1>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`tel:${patient.phone}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-50 px-4 font-semibold text-primary-700"
                  >
                    <Phone size={16} />
                    {patient.phone}
                  </a>
                  <a
                    href={`https://wa.me/${patient.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#E8F7EE] px-4 font-semibold text-[#0B5E31]"
                  >
                    <WhatsAppIcon size={18} />
                    WhatsApp
                  </a>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {can('patients.write') && (
                  <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                    <Pencil size={16} />
                    Edit details
                  </Button>
                )}
                {can('appointments.write') && (
                  <Button size="sm" onClick={() => setBooking(true)}>
                    <CalendarPlus size={16} />
                    Book appointment
                  </Button>
                )}
              </div>
            </header>

            {allergies && (
              <p
                role="note"
                className="mt-5 flex items-start gap-3 rounded-2xl bg-[#FEF4F3] p-4 font-semibold text-[#92020B]"
              >
                <AlertTriangle size={20} className="mt-0.5 shrink-0" />
                Allergies: {allergies}
              </p>
            )}
            <p
              role="status"
              className="mt-4 rounded-2xl bg-[#E8F7EE] p-4 font-medium text-[#0B5E31] empty:hidden"
            >
              {message}
            </p>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
              <div className="space-y-6">
                <Section title="Appointments">
                  {record.appointments.length === 0 ? (
                    <p className="text-muted">No appointments yet.</p>
                  ) : (
                    <ul className="divide-y divide-neutral-200">
                      {record.appointments.map((appointment) => (
                        <li
                          key={appointment.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-3"
                        >
                          <span>
                            <span className="block font-semibold">{when(appointment.startAt)}</span>
                            <span className="text-sm text-muted">
                              {appointment.reference} · {reasonLabel(appointment.reason)}
                              {appointment.location
                                ? ` · ${appointment.location.name.split(', ').pop()}`
                                : ''}
                              {appointment.dentist ? ` · ${appointment.dentist.name}` : ''}
                            </span>
                          </span>
                          <Badge
                            tone={
                              appointment.status === 'confirmed' ||
                              appointment.status === 'completed'
                                ? 'success'
                                : appointment.status === 'pending'
                                  ? 'warning'
                                  : 'neutral'
                            }
                          >
                            {appointment.status.replace('_', ' ')}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                {can('billing.read') && (
                  <BillingPanel record={record} canWrite={can('billing.write')} />
                )}

                {clinical ? (
                  <>
                    <Section title="Medical history">
                      <HistoryForm
                        patientId={patient.id}
                        history={clinical.medicalHistory}
                        canEdit={can('clinical.write')}
                      />
                    </Section>
                    <Section
                      title="Treatment plans"
                      action={
                        can('clinical.write') && (
                          <Button size="sm" variant="secondary" onClick={() => setPlanning(true)}>
                            <ClipboardList size={16} />
                            New plan
                          </Button>
                        )
                      }
                    >
                      {clinical.plans.length === 0 ? (
                        <p className="text-muted">No treatment plans yet.</p>
                      ) : (
                        <div className="space-y-4">
                          {clinical.plans.map((plan) => (
                            <PlanCard
                              key={plan.id}
                              plan={plan}
                              canWrite={can('clinical.write')}
                              onChanged={() => void load()}
                            />
                          ))}
                        </div>
                      )}
                    </Section>
                    <FilesPanel patientId={patient.id} canWrite={can('clinical.write')} />
                    <Section title="Clinical notes">
                      <NotesPanel
                        patientId={patient.id}
                        notes={clinical.notes}
                        canWrite={can('clinical.write')}
                        onAdded={() => void load()}
                      />
                    </Section>
                  </>
                ) : (
                  <p className="rounded-3xl bg-white p-5 text-muted ring-1 ring-neutral-200">
                    Medical history, notes and treatment plans are visible to doctors and the owner.
                  </p>
                )}
              </div>

              <aside className="space-y-6">
                <Section title="Recall">
                  <RecallForm
                    record={record}
                    canEdit={can('patients.write')}
                    onSaved={() => void load()}
                  />
                </Section>
                <Section title="Details">
                  <dl className="space-y-2 text-[0.95rem]">
                    {[
                      ['Email', patient.email ?? '—'],
                      ['Date of birth', patient.dateOfBirth ? dateOnly(patient.dateOfBirth) : '—'],
                      ['Gender', patient.gender ?? '—'],
                      ['Home clinic', patient.homeBranch?.name ?? '—'],
                      ['Found us via', patient.source?.replace('_', ' ') ?? '—'],
                    ].map(([term, value]) => (
                      <div key={term} className="flex justify-between gap-3">
                        <dt className="text-muted">{term}</dt>
                        <dd className="text-right font-medium capitalize">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {record.consents.length > 0 && (
                    <ul className="mt-4 space-y-1 border-t border-neutral-200 pt-4 text-sm">
                      {record.consents.map((consent) => (
                        <li key={consent.type} className="flex justify-between gap-3">
                          <span className="text-muted">{consent.type.replace(/_/g, ' ')}</span>
                          <span
                            className={
                              consent.granted
                                ? 'font-semibold text-[#0B5E31]'
                                : 'font-semibold text-[#92020B]'
                            }
                          >
                            {consent.granted ? 'Yes' : 'Withdrawn'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
                <Section title="Timeline">
                  <ol className="relative space-y-4 border-l border-neutral-200 pl-5">
                    {record.timeline.slice(0, 30).map((event, index) => (
                      <li key={`${event.at}-${index}`} className="relative">
                        <span
                          aria-hidden="true"
                          className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full bg-primary-600 ring-4 ring-white"
                        />
                        <p className="text-sm text-muted">{when(event.at)}</p>
                        <p className="font-semibold">{event.title}</p>
                        {event.detail && <p className="text-sm text-muted">{event.detail}</p>}
                      </li>
                    ))}
                  </ol>
                </Section>
              </aside>
            </div>

            <EditDetailsSheet
              record={record}
              open={editing}
              onOpenChange={setEditing}
              onSaved={() => void load()}
            />
            <NewPlanSheet
              patientId={patient.id}
              open={planning}
              onOpenChange={setPlanning}
              onSaved={() => void load()}
            />
            <BookAppointmentSheet
              open={booking}
              onOpenChange={setBooking}
              patient={bookingPatient}
              defaults={{ branch: patient.homeBranch?.slug }}
              onBooked={(reference) => {
                setMessage(`Booked and confirmed: ${reference}.`);
                void load();
              }}
            />
          </>
        )}
      </main>
    </AdminShell>
  );
}
