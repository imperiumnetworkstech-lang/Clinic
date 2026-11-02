import { Phone } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { branches, phones, whatsappLink } from '../lib/clinic';
import { WhatsAppIcon } from './icons';
import { Sheet, SheetSectionLabel } from './ui/Sheet';

/**
 * Appointment requests go to the front desk by WhatsApp or phone (client decision: manual
 * WhatsApp, same flow as the old site). Any CTA calls `openBooking()` to show this sheet.
 */
const BookingContext = createContext<{ openBooking: () => void }>({ openBooking: () => undefined });

export const useBooking = () => useContext(BookingContext);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openBooking = useCallback(() => setOpen(true), []);

  return (
    <BookingContext.Provider value={{ openBooking }}>
      {children}
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Book an appointment"
        description="Message or call us and our front desk will find a time that suits you."
      >
        <SheetSectionLabel>WhatsApp the clinic</SheetSectionLabel>
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

        <SheetSectionLabel>Or call our helpdesk</SheetSectionLabel>
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
      </Sheet>
    </BookingContext.Provider>
  );
}
