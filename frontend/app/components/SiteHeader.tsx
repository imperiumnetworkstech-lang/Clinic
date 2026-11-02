import { Phone } from 'lucide-react';
import { CLINIC_NAME, primaryPhone, whatsappLink } from '../lib/clinic';
import { button, container } from '../lib/ui';
import { useBooking } from './BookingSheet';
import { WhatsAppIcon } from './icons';

export const NAV_LINKS = [
  { href: '#treatments', label: 'Treatments' },
  { href: '#clinic', label: 'Our clinic' },
  { href: '#reviews', label: 'Reviews' },
  { href: '#locations', label: 'Locations' },
];

export function SiteHeader() {
  const { openBooking } = useBooking();

  // Always opaque: content must never show through the sticky bar, with or without JS.
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white shadow-[0_8px_24px_-18px_rgb(31_36_43/0.3)]">
      <div className={`${container} flex h-16 items-center justify-between gap-6 md:h-20`}>
        <a href="#top" className="shrink-0" aria-label={`${CLINIC_NAME}, home`}>
          <img
            src="/images/brand/logo.png"
            alt=""
            width={458}
            height={152}
            className="h-10 w-auto md:h-12"
          />
        </a>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="rounded-full px-4 py-2 font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <a
            href={primaryPhone.href}
            className="flex items-center gap-2 font-semibold text-neutral-800 hover:text-primary-700"
          >
            <Phone size={18} className="text-primary-600" />
            {primaryPhone.display}
          </a>
          <button type="button" onClick={openBooking} className={button.primary}>
            Book appointment
          </button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <a
            href={whatsappLink('Hello Expressions Dental Clinic, I have a question.')}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp us"
            className="grid size-11 place-items-center rounded-full bg-[#E8F7EE] text-[#128C4A]"
          >
            <WhatsAppIcon size={22} />
          </a>
          <a
            href={primaryPhone.href}
            aria-label={`Call ${primaryPhone.display}`}
            className="grid size-11 place-items-center rounded-full bg-primary-50 text-primary-600"
          >
            <Phone size={20} />
          </a>
        </div>
      </div>
    </header>
  );
}
