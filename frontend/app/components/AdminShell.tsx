import type { StaffProfile } from '@edc/shared';
import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { staffAuth } from '../lib/admin-api';
import { cn } from '../lib/cn';
import { container } from '../lib/ui';
import { Button } from './ui/Button';

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Owner',
  doctor: 'Doctor',
  receptionist: 'Front desk',
  assistant: 'Assistant',
};

const SECTIONS = [
  { to: '/admin', label: 'Dashboard', permission: 'dashboard.read' },
  { to: '/admin/calendar', label: 'Calendar', permission: 'appointments.read' },
  { to: '/admin/appointments', label: 'Day list', permission: 'appointments.read' },
  { to: '/admin/patients', label: 'Patients', permission: 'patients.read' },
  { to: '/admin/billing', label: 'Billing', permission: 'billing.read' },
  { to: '/admin/enquiries', label: 'Enquiries', permission: 'leads.read' },
  { to: '/admin/schedule', label: 'Schedule', permission: 'appointments.read' },
  { to: '/admin/staff', label: 'Staff', permission: 'staff.read' },
];

/** Staff page frame: brand, signed-in user, sign out, and the section tabs they can use. */
export function AdminShell({ me, children }: { me: StaffProfile | null; children: ReactNode }) {
  const navigate = useNavigate();
  const sections = SECTIONS.filter((section) => !me || me.permissions.includes(section.permission));

  const logout = async () => {
    await staffAuth.logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
        <div className={`${container} flex h-16 items-center justify-between gap-4`}>
          <div className="flex items-center gap-3">
            <img
              src="/images/brand/mark-192.png"
              alt=""
              width={36}
              height={36}
              className="rounded-lg"
            />
            <span className="font-display font-bold">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            {me && (
              <span className="hidden text-right text-sm sm:block">
                <span className="block font-semibold">{me.name}</span>
                <span className="block text-muted">{ROLE_LABEL[me.role] ?? me.role}</span>
              </span>
            )}
            <Button variant="secondary" size="sm" onClick={() => void logout()}>
              <LogOut size={16} />
              Sign out
            </Button>
          </div>
        </div>
        <nav
          aria-label="Admin sections"
          className={`${container} -mb-px flex gap-1 overflow-x-auto`}
        >
          {sections.map((section) => (
            <NavLink
              key={section.to}
              to={section.to}
              end={section.to === '/admin'}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 shrink-0 items-center border-b-2 px-3 font-semibold transition',
                  isActive
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-neutral-600 hover:text-neutral-950',
                )
              }
            >
              {section.label}
            </NavLink>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
