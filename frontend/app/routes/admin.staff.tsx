import { ShieldCheck, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AdminShell } from '../components/AdminShell';
import { Button } from '../components/ui/Button';
import { Badge, Skeleton, TextField } from '../components/ui/primitives';
import { Sheet } from '../components/ui/Sheet';
import { ApiError, crmApi, type StaffRow } from '../lib/admin-api';
import { container } from '../lib/ui';
import { useStaff } from '../lib/use-staff';

export function meta() {
  return [
    { title: 'Staff | Expressions Dental admin' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

const ROLES = [
  { value: 'super_admin', label: 'Owner' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'receptionist', label: 'Front desk' },
  { value: 'assistant', label: 'Assistant' },
];

const lastSeen = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
      }).format(new Date(iso))
    : 'Never';

function AddStaffSheet({
  open,
  onOpenChange,
  isOwner,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOwner: boolean;
  onAdded: (name: string) => void;
}) {
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? '').trim();
    try {
      await crmApi.createStaff({
        name: value('name'),
        email: value('email'),
        role: value('role'),
        password: String(form.get('password') ?? ''),
        ...(value('phone') ? { phone: value('phone') } : {}),
      });
      onOpenChange(false);
      onAdded(value('name'));
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? (caught.fieldErrors[0]?.message ?? caught.message)
          : 'Could not add this person.',
      );
    }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add a staff member">
      <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-5">
        <TextField label="Full name" name="name" required minLength={2} />
        <TextField label="Work email" name="email" type="email" required autoComplete="off" />
        <TextField label="Mobile (optional)" name="phone" type="tel" />
        <label className="block font-semibold">
          Role
          <select
            name="role"
            defaultValue="receptionist"
            className="mt-2 block min-h-12 w-full rounded-2xl bg-white px-4 ring-1 ring-neutral-300"
          >
            {ROLES.filter((role) => isOwner || role.value !== 'super_admin').map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
        <TextField
          label="Temporary password"
          name="password"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          hint="At least 12 characters. Share it in person; owners and doctors set up 2-step sign-in when they first log in."
        />
        {error && (
          <p role="alert" className="rounded-2xl bg-[#FEF4F3] p-4 font-medium text-[#92020B]">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full">
          Add staff member
        </Button>
      </form>
    </Sheet>
  );
}

/** Who can sign in to the admin, with which role. Owners manage owners. */
export default function AdminStaff() {
  const { me, can, problem } = useStaff();
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setStaff(await crmApi.staff());
    } catch (caught) {
      setError(problem(caught));
      setStaff([]);
    }
  }, [problem]);

  useEffect(() => {
    if (me) void load();
  }, [me, load]);

  const update = async (row: StaffRow, body: { role?: string; status?: 'active' | 'disabled' }) => {
    setError('');
    setMessage('');
    try {
      await crmApi.updateStaff(row.id, body);
      setMessage(
        body.status === 'disabled'
          ? `${row.name} can no longer sign in.`
          : body.status === 'active'
            ? `${row.name} can sign in again.`
            : `${row.name}’s role is changed. They’ll need to sign in again.`,
      );
      void load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not update.');
    }
  };

  const canWrite = can('staff.write');
  const isOwner = me?.role === 'super_admin';

  return (
    <AdminShell me={me}>
      <main className={`${container} py-8`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Staff</h1>
            <p className="mt-1 text-muted">Everyone who can sign in to this admin.</p>
          </div>
          {canWrite && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <UserPlus size={16} />
              Add staff
            </Button>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-6 rounded-2xl bg-[#FEF4F3] p-4 font-medium text-[#92020B]">
            {error}
          </p>
        )}
        <p
          role="status"
          className="mt-6 rounded-2xl bg-[#E8F7EE] p-4 font-medium text-[#0B5E31] empty:hidden"
        >
          {message}
        </p>

        <ul className="mt-6 divide-y divide-neutral-200 overflow-hidden rounded-3xl bg-white ring-1 ring-neutral-200">
          {staff === null && (
            <li className="p-5">
              <Skeleton className="h-12 w-full" />
            </li>
          )}
          {staff?.map((row) => {
            const self = row.id === me?.id;
            const locked = self || !canWrite || (row.role === 'super_admin' && !isOwner);
            return (
              <li key={row.id} className="flex flex-wrap items-center gap-4 p-4 sm:px-6">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-semibold">
                    {row.name}
                    {self && <span className="font-normal text-muted"> (you)</span>}
                  </p>
                  <p className="text-sm break-all text-muted">{row.email}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                    Last sign-in {lastSeen(row.lastLoginAt)}
                    {row.twoFactorEnabled && (
                      <span className="inline-flex items-center gap-1 text-[#0B5E31]">
                        <ShieldCheck size={14} />
                        2-step on
                      </span>
                    )}
                  </p>
                </div>
                {row.status === 'disabled' && <Badge tone="neutral">Deactivated</Badge>}
                <label className="text-sm font-semibold">
                  <span className="sr-only">Role for {row.name}</span>
                  <select
                    value={row.role}
                    disabled={locked}
                    onChange={(event) => void update(row, { role: event.target.value })}
                    className="min-h-11 rounded-full bg-white px-4 ring-1 ring-neutral-300 disabled:bg-neutral-50"
                  >
                    {ROLES.filter(
                      (role) =>
                        isOwner || role.value !== 'super_admin' || row.role === 'super_admin',
                    ).map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </label>
                {!locked && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void update(row, {
                        status: row.status === 'disabled' ? 'active' : 'disabled',
                      })
                    }
                  >
                    {row.status === 'disabled' ? 'Reactivate' : 'Deactivate'}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </main>
      <AddStaffSheet
        open={adding}
        onOpenChange={setAdding}
        isOwner={isOwner}
        onAdded={(name) => {
          setMessage(`${name} added. They can sign in now.`);
          void load();
        }}
      />
    </AdminShell>
  );
}
