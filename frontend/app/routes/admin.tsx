import { CalendarDays, CalendarPlus, ClipboardList, Inbox, RefreshCw, Users } from 'lucide-react';
import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { Link } from 'react-router';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AdminShell } from '../components/AdminShell';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/primitives';
import { crmApi, type Dashboard } from '../lib/admin-api';
import { container } from '../lib/ui';
import { useStaff } from '../lib/use-staff';

export function meta() {
  return [
    { title: 'Dashboard | Expressions Dental admin' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

const shortDay = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  );

function Stat({
  label,
  value,
  hint,
  to,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  to?: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-sm font-semibold text-muted">
        <Icon size={16} className="text-primary-600" />
        {label}
      </span>
      <span className="mt-2 block text-3xl font-bold tabular-nums">{value}</span>
      {hint && <span className="mt-1 block text-sm text-muted">{hint}</span>}
    </>
  );
  const className = 'block rounded-3xl bg-white p-5 ring-1 ring-neutral-200';
  return to ? (
    <Link to={to} className={`${className} transition hover:ring-neutral-300`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Staff home: today at a glance, what needs attention, and booking trends. */
export default function AdminDashboard() {
  const { me, can, problem } = useStaff();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await crmApi.dashboard());
    } catch (caught) {
      setError(problem(caught));
    }
  }, [problem]);

  useEffect(() => {
    if (me && can('dashboard.read')) void load();
  }, [me, can, load]);

  const noDashboard = me && !can('dashboard.read');
  const noShow =
    data?.noShowRate90d === null || data === null
      ? '—'
      : `${Math.round(data.noShowRate90d * 100)}%`;

  return (
    <AdminShell me={me}>
      <main className={`${container} py-8`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">
              {me ? `Hello, ${me.name.split(' ')[0]}` : 'Dashboard'}
            </h1>
            <p className="mt-1 text-muted">Today at the clinic, and what needs attention.</p>
          </div>
          {!noDashboard && (
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              <RefreshCw size={16} />
              Refresh
            </Button>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-6 rounded-2xl bg-[#FEF4F3] p-4 font-medium text-[#92020B]">
            {error}
          </p>
        )}

        {noDashboard ? (
          <p className="mt-8 rounded-3xl bg-white p-6 ring-1 ring-neutral-200">
            Go to the{' '}
            <Link to="/admin/appointments" className="font-semibold text-link underline">
              day list
            </Link>{' '}
            to see today’s appointments.
          </p>
        ) : !data ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((key) => (
              <Skeleton key={key} className="h-32 rounded-3xl" />
            ))}
          </div>
        ) : (
          <>
            <section aria-labelledby="today-heading" className="mt-8">
              <h2 id="today-heading" className="sr-only">
                Today
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  icon={CalendarDays}
                  label="Booked today"
                  value={data.today.total}
                  hint={`${data.today.checkedIn} here now · ${data.today.completed} done`}
                  to="/admin/appointments"
                />
                <Stat
                  icon={ClipboardList}
                  label="To confirm"
                  value={data.toConfirm}
                  hint="Upcoming online bookings"
                  to="/admin/calendar"
                />
                <Stat
                  icon={Inbox}
                  label="New enquiries"
                  value={data.newEnquiries}
                  hint="Waiting for a reply"
                  to={can('leads.read') ? '/admin/enquiries' : undefined}
                />
                <Stat
                  icon={Users}
                  label="Recalls due"
                  value={data.recallsDue}
                  hint="Overdue or in the next 30 days"
                  to={can('patients.read') ? '/admin/patients?recall=due' : undefined}
                />
              </div>
            </section>

            <section
              aria-labelledby="trend-heading"
              className="mt-6 grid gap-4 lg:grid-cols-[1fr_18rem]"
            >
              <div className="rounded-3xl bg-white p-5 ring-1 ring-neutral-200 sm:p-6">
                <h2 id="trend-heading" className="font-bold">
                  Bookings made, last 30 days
                </h2>
                <div
                  className="mt-4 h-64"
                  role="img"
                  aria-label={`Bookings in the last 30 days: ${data.bookings30d.reduce((sum, day) => sum + day.online, 0)} online, ${data.bookings30d.reduce((sum, day) => sum + day.staff, 0)} by staff.`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.bookings30d}
                      margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} stroke="#e5e7eb" />
                      <XAxis
                        dataKey="day"
                        tickFormatter={shortDay}
                        interval={6}
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                      />
                      <Tooltip labelFormatter={(value) => shortDay(String(value))} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                      <Bar
                        dataKey="online"
                        name="Online"
                        stackId="b"
                        fill="#d2027f"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="staff"
                        name="Front desk"
                        stackId="b"
                        fill="#0083a1"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="grid gap-4">
                <Stat
                  icon={CalendarPlus}
                  label="New patients"
                  value={data.newPatients30d}
                  hint="Last 30 days"
                />
                <Stat icon={CalendarDays} label="No-show rate" value={noShow} hint="Last 90 days" />
              </div>
            </section>
          </>
        )}
      </main>
    </AdminShell>
  );
}
