import { CalendarPlus, House, MapPin, Phone, Stethoscope } from 'lucide-react';
import { primaryPhone } from '../lib/clinic';
import { useBooking } from './BookingSheet';

const tab =
  'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold text-neutral-600 transition active:scale-95';

/**
 * App-style navigation for phones (<768px), pinned to the thumb zone and safe-area aware.
 * Book sits raised in the centre. Portal joins once its login channel is decided (B2).
 */
export function BottomTabBar() {
  const { openBooking } = useBooking();
  return (
    <nav
      aria-label="Quick actions"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200/80 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
    >
      <div className="mx-auto flex max-w-lg items-end px-2">
        <a href="#top" className={tab}>
          <House size={22} />
          Home
        </a>
        <a href="#treatments" className={tab}>
          <Stethoscope size={22} />
          Treatments
        </a>
        <button type="button" onClick={openBooking} className={`${tab} -mt-6 text-primary-700`}>
          <span className="grid size-14 place-items-center rounded-full bg-brand text-white shadow-[0_10px_24px_-6px_rgb(210_2_127/0.6)] ring-4 ring-white">
            <CalendarPlus size={24} />
          </span>
          Book
        </button>
        <a href="#locations" className={tab}>
          <MapPin size={22} />
          Clinics
        </a>
        <a href={primaryPhone.href} className={tab}>
          <Phone size={22} />
          Call
        </a>
      </div>
    </nav>
  );
}
