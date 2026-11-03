import { CalendarCheck, CalendarPlus, House, Menu, Stethoscope } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router';
import { cn } from '../lib/cn';
import { MoreSheet } from './MoreSheet';

const tab =
  'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold transition active:scale-95';

const tabState = ({ isActive }: { isActive: boolean }) =>
  cn(tab, isActive ? 'text-primary-700' : 'text-neutral-600');

/**
 * App-style navigation for phones (<768px), pinned to the thumb zone and safe-area aware.
 * Book sits raised in the centre; Portal is the patient's own appointments.
 */
export function BottomTabBar() {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Quick actions"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200/80 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
      >
        <div className="mx-auto flex max-w-lg items-end px-2">
          <NavLink to="/" end viewTransition className={tabState}>
            <House size={22} />
            Home
          </NavLink>
          <NavLink to="/treatments" viewTransition className={tabState}>
            <Stethoscope size={22} />
            Treatments
          </NavLink>
          <NavLink to="/book" viewTransition className={cn(tab, '-mt-6 text-primary-700')}>
            <span className="grid size-14 place-items-center rounded-full bg-brand text-white shadow-[0_10px_24px_-6px_rgb(210_2_127/0.6)] ring-4 ring-white">
              <CalendarPlus size={24} />
            </span>
            Book
          </NavLink>
          <NavLink to="/portal" viewTransition className={tabState}>
            <CalendarCheck size={22} />
            Portal
          </NavLink>
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(tab, 'text-neutral-600')}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
          >
            <Menu size={22} />
            More
          </button>
        </div>
      </nav>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
