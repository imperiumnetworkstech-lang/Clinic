import { BellRing, ChevronRight, Search, UserPlus, Users } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AdminShell } from '../components/AdminShell';
import { Button } from '../components/ui/Button';
import { EmptyState, Skeleton, TextField } from '../components/ui/primitives';
import { Sheet } from '../components/ui/Sheet';
import { ApiError, crmApi, type PatientRow } from '../lib/admin-api';
import { branches } from '../lib/clinic';
import { cn } from '../lib/cn';
import { container } from '../lib/ui';
import { useStaff } from '../lib/use-staff';

export function meta() {
  return [
    { title: 'Patients | Expressions Dental admin' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

const shortDate = (iso: string | null, utc = false) =>
  iso
    ? new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: utc ? 'UTC' : 'Asia/Kolkata',
      }).format(new Date(utc ? `${iso}T00:00:00Z` : iso))
    : '—';

const selectClass = 'mt-2 block min-h-12 w-full rounded-2xl bg-white px-4 ring-1 ring-neutral-300';

function RegisterSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [existing, setExisting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? '').trim();
    setSaving(true);
    setError('');
    setExisting(null);
    try {
      const created = await crmApi.createPatient({
        name: value('name'),
        phone: value('phone'),
        email: value('email'),
        dateOfBirth: value('dateOfBirth'),
        ...(value('gender') ? { gender: value('gender') } : {}),
        ...(value('homeBranch') ? { homeBranch: value('homeBranch') } : {}),
        ...(value('source') ? { source: value('source') } : {}),
      });
      navigate(`/admin/patients/${created.id}`);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'patient_exists') {
        setExisting(caught.details?.id ?? null);
      }
      setError(
        caught instanceof ApiError
          ? (caught.fieldErrors[0]?.message ?? caught.message)
          : 'Could not save.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Register a patient">
      <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-5">
        <TextField label="Full name" name="name" required minLength={2} autoComplete="off" />
        <TextField
          label="Mobile number"
          name="phone"
          type="tel"
          required
          hint="Indian numbers without +91 are fine."
        />
        <TextField label="Email (optional)" name="email" type="email" />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Date of birth (optional)" name="dateOfBirth" type="date" />
          <label className="block font-semibold">
            Gender (optional)
            <select name="gender" defaultValue="" className={selectClass}>
              <option value="">Not recorded</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
              <option value="undisclosed">Prefer not to say</option>
            </select>
          </label>
          <label className="block font-semibold">
            Home clinic
            <select name="homeBranch" defaultValue="" className={selectClass}>
              <option value="">Not set</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.shortName}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-semibold">
            How they found us
            <select name="source" defaultValue="" className={selectClass}>
              <option value="">Not recorded</option>
              <option value="walk_in">Walk-in</option>
              <option value="phone">Phone</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="referral">Referral</option>
              <option value="google">Google</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="website">Website</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>
        {error && (
          <p role="alert" className="rounded-2xl bg-[#FEF4F3] p-4 font-medium text-[#92020B]">
            {error}{' '}
            {existing && (
              <Link to={`/admin/patients/${existing}`} className="underline">
                Open their record
              </Link>
            )}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving ? 'Saving…' : 'Register patient'}
        </Button>
      </form>
    </Sheet>
  );
}

/** Patient list with search, recall filter and registration. */
export default function AdminPatients() {
  const { me, can, problem } = useStaff();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const recall = params.get('recall') === 'due';
  const page = Number(params.get('page') ?? '1') || 1;
  const [search, setSearch] = useState(q);
  const [result, setResult] = useState<{ total: number; items: PatientRow[] } | null>(null);
  const [error, setError] = useState('');
  const [registering, setRegistering] = useState(false);

  const load = useCallback(async () => {
    setResult(null);
    setError('');
    try {
      setResult(
        await crmApi.patients({ q: q || undefined, recall: recall ? 'due' : undefined, page }),
      );
    } catch (caught) {
      setError(problem(caught));
      setResult({ total: 0, items: [] });
    }
  }, [q, recall, page, problem]);

  useEffect(() => {
    if (me) void load();
  }, [me, load]);

  // Search as you type, after a short pause.
  useEffect(() => {
    if (search === q) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (search) next.set('q', search);
      else next.delete('q');
      next.delete('page');
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, q, params, setParams]);

  const setFilter = (due: boolean) => {
    const next = new URLSearchParams(params);
    if (due) next.set('recall', 'due');
    else next.delete('recall');
    next.delete('page');
    setParams(next);
  };
  const pages = result ? Math.max(1, Math.ceil(result.total / 25)) : 1;

  return (
    <AdminShell me={me}>
      <main className={`${container} py-8`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Patients</h1>
            <p className="mt-1 text-muted">
              {result ? `${result.total} ${recall ? 'due for recall' : 'patients'}` : 'Loading…'}
            </p>
          </div>
          {can('patients.write') && (
            <Button size="sm" onClick={() => setRegistering(true)}>
              <UserPlus size={16} />
              Register patient
            </Button>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="relative min-w-0 flex-1 basis-64">
            <span className="sr-only">Search patients</span>
            <Search
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-neutral-500"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, mobile, email or EDC code"
              className="block min-h-12 w-full rounded-full bg-white pr-4 pl-11 ring-1 ring-neutral-300 outline-none focus:ring-2 focus:ring-secondary-500"
            />
          </label>
          <div className="flex gap-2" role="group" aria-label="Filter">
            {[
              { due: false, label: 'All' },
              { due: true, label: 'Recall due' },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={recall === option.due}
                onClick={() => setFilter(option.due)}
                className={cn(
                  'min-h-11 rounded-full px-4 font-semibold ring-1 transition',
                  recall === option.due
                    ? 'bg-neutral-950 text-white ring-neutral-950'
                    : 'bg-white ring-neutral-200 hover:bg-neutral-50',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-6 rounded-2xl bg-[#FEF4F3] p-4 font-medium text-[#92020B]">
            {error}
          </p>
        )}

        <ul className="mt-6 divide-y divide-neutral-200 overflow-hidden rounded-3xl bg-white ring-1 ring-neutral-200">
          {result === null &&
            [0, 1, 2, 3, 4].map((key) => (
              <li key={key} className="p-5">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="mt-2 h-4 w-72" />
              </li>
            ))}
          {result?.items.map((patient) => (
            <li key={patient.id}>
              <Link
                to={`/admin/patients/${patient.id}`}
                className="flex items-center gap-4 p-4 transition hover:bg-neutral-50 sm:px-6"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{patient.name}</span>
                  <span className="block text-sm text-muted">
                    {patient.code} · {patient.phone}
                    {patient.homeLocation
                      ? ` · ${patient.homeLocation.name.split(', ').pop()}`
                      : ''}
                  </span>
                </span>
                <span className="hidden text-right text-sm sm:block">
                  {recall && patient.nextRecallOn ? (
                    <span className="flex items-center gap-1.5 font-semibold text-[#865402]">
                      <BellRing size={14} />
                      Recall {shortDate(patient.nextRecallOn, true)}
                    </span>
                  ) : patient.nextVisitAt ? (
                    <span className="font-semibold">Next {shortDate(patient.nextVisitAt)}</span>
                  ) : (
                    <span className="text-muted">Last visit {shortDate(patient.lastVisitAt)}</span>
                  )}
                  {recall && patient.recallNote && (
                    <span className="block text-muted">{patient.recallNote}</span>
                  )}
                </span>
                <ChevronRight size={18} className="shrink-0 text-neutral-400" />
              </Link>
            </li>
          ))}
        </ul>

        {result?.items.length === 0 && !error && (
          <div className="mt-4">
            <EmptyState icon={Users} title={q ? 'No matching patients' : 'No patients yet'}>
              {recall
                ? 'Nobody is due for a recall in the next 30 days.'
                : 'Patients appear here when they book online or are registered by the front desk.'}
            </EmptyState>
          </div>
        )}

        {pages > 1 && (
          <nav aria-label="Pages" className="mt-6 flex items-center justify-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() =>
                setParams((prev) => ({ ...Object.fromEntries(prev), page: String(page - 1) }))
              }
            >
              Previous
            </Button>
            <span className="text-sm text-muted">
              Page {page} of {pages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= pages}
              onClick={() =>
                setParams((prev) => ({ ...Object.fromEntries(prev), page: String(page + 1) }))
              }
            >
              Next
            </Button>
          </nav>
        )}
      </main>
      <RegisterSheet open={registering} onOpenChange={setRegistering} />
    </AdminShell>
  );
}
