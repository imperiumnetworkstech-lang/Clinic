import { Phone, X } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react';
import { branches, phones, whatsappLink } from '../lib/clinic';
import { WhatsAppIcon } from './icons';

/**
 * Appointment requests go to the front desk by WhatsApp or phone (client decision: manual
 * WhatsApp, same flow as the old site). Any CTA calls `openBooking()` to show this sheet.
 */
const BookingContext = createContext<{ openBooking: () => void }>({ openBooking: () => undefined });

export const useBooking = () => useContext(BookingContext);

export function BookingProvider({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const openBooking = useCallback(() => dialog.current?.showModal(), []);
  const close = () => dialog.current?.close();

  return (
    <BookingContext.Provider value={{ openBooking }}>
      {children}
      <dialog
        ref={dialog}
        className="sheet shadow-2xl"
        aria-labelledby="booking-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="px-6 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:p-8">
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-neutral-200 md:hidden" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="booking-title" className="text-2xl font-bold">
                Book an appointment
              </h2>
              <p className="mt-1.5 text-muted">
                Message or call us and our front desk will find a time that suits you.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-neutral-100"
              aria-label="Close"
            >
              <X size={22} />
            </button>
          </div>

          <p className="mt-6 text-sm font-semibold tracking-wide text-muted uppercase">
            WhatsApp the clinic
          </p>
          <div className="mt-3 grid gap-3">
            {branches.map((branch) => (
              <a
                key={branch.id}
                href={whatsappLink(
                  `Hello Expressions Dental Clinic, I'd like to book an appointment at your ${branch.shortName} clinic.`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex min-h-16 items-center gap-4 rounded-2xl bg-[#E8F7EE] px-4 text-[#0B5E31] ring-1 ring-[#BFE7CF] transition hover:bg-[#DDF3E6]"
              >
                <span className="grid size-10 place-items-center rounded-full bg-[#128C4A] text-white">
                  <WhatsAppIcon size={22} />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">{branch.shortName} clinic</span>
                  <span className="block text-sm opacity-80">
                    Opens WhatsApp with a message ready
                  </span>
                </span>
              </a>
            ))}
          </div>

          <p className="mt-6 text-sm font-semibold tracking-wide text-muted uppercase">
            Or call our helpdesk
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {phones.map((phone) => (
              <a
                key={phone.href}
                href={phone.href}
                className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-surface font-semibold ring-1 ring-border hover:bg-neutral-100"
              >
                <Phone size={18} className="text-primary-600" />
                <span className="text-[0.95rem]">{phone.display.replace('+91 ', '')}</span>
              </a>
            ))}
          </div>
        </div>
      </dialog>
    </BookingContext.Provider>
  );
}
