import { Accessibility, Mail, MapPin, Phone } from 'lucide-react';
import { useState } from 'react';
import { branches, CLINIC_NAME, email, phones, social } from '../lib/clinic';
import { Link } from 'react-router';
import { LEGAL_LINKS, NAV_LINKS } from '../lib/navigation';
import { container } from '../lib/ui';
import { AccessibilityPanel } from './AccessibilityPanel';
import { ConsentSettingsLink } from './ConsentBanner';
import { FacebookIcon, XIcon, YouTubeIcon } from './icons';
import { Sheet } from './ui/Sheet';

const SOCIAL_ICONS = { Facebook: FacebookIcon, YouTube: YouTubeIcon, 'X (Twitter)': XIcon };

export function SiteFooter() {
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  return (
    <footer className="bg-neutral-950 pb-28 text-neutral-300 md:pb-0">
      <div className={`${container} grid gap-12 py-16 md:grid-cols-12`}>
        <div className="md:col-span-4">
          <div className="flex items-center gap-3">
            <img
              src="/images/brand/mark-192.png"
              alt=""
              width={44}
              height={44}
              className="rounded-xl"
            />
            <span className="font-display text-lg font-bold text-white">{CLINIC_NAME}</span>
          </div>
          <p className="mt-4 max-w-xs text-[0.95rem] leading-relaxed text-neutral-400">
            Family, advanced and cosmetic dentistry in Duler (Mapusa) and Candolim, North Goa.
          </p>
          <ul className="mt-6 flex gap-2">
            {social.map((item) => {
              const Icon = SOCIAL_ICONS[item.label];
              return (
                <li key={item.label}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.label}
                    className="grid size-11 place-items-center rounded-full bg-white/5 text-neutral-300 transition hover:bg-white/10 hover:text-white"
                  >
                    <Icon />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="md:col-span-2">
          <h2 className="text-sm font-semibold tracking-wide text-white uppercase">Explore</h2>
          <ul className="mt-3 space-y-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  to={link.href}
                  viewTransition
                  className="inline-flex min-h-11 items-center hover:text-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-3">
          <h2 className="text-sm font-semibold tracking-wide text-white uppercase">Contact</h2>
          <ul className="mt-3 space-y-1">
            {phones.map((phone) => (
              <li key={phone.href}>
                <a
                  href={phone.href}
                  className="flex min-h-11 items-center gap-2.5 hover:text-white"
                >
                  <Phone size={16} className="text-primary-400" />
                  {phone.display}
                </a>
              </li>
            ))}
            <li>
              <a
                href={`mailto:${email}`}
                className="flex min-h-11 items-center gap-2.5 [overflow-wrap:anywhere] hover:text-white"
              >
                <Mail size={16} className="shrink-0 text-primary-400" />
                {email}
              </a>
            </li>
          </ul>
        </div>

        <div className="md:col-span-3">
          <h2 className="text-sm font-semibold tracking-wide text-white uppercase">Clinics</h2>
          <ul className="mt-3 space-y-1">
            {branches.map((branch) => (
              <li key={branch.id}>
                <a
                  href={branch.directionsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center gap-2.5 hover:text-white"
                >
                  <MapPin size={16} className="shrink-0 text-primary-400" />
                  {branch.shortName}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div
          className={`${container} flex flex-col gap-2 py-4 text-sm text-neutral-400 sm:flex-row sm:items-center sm:justify-between`}
        >
          <p>
            © {new Date().getFullYear()} {CLINIC_NAME}. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <button
              type="button"
              onClick={() => setAccessibilityOpen(true)}
              className="inline-flex min-h-11 items-center gap-2 hover:text-white"
            >
              <Accessibility size={16} />
              Accessibility
            </button>
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="inline-flex min-h-11 items-center hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <ConsentSettingsLink className="min-h-11 hover:text-white" />
            <p>Designed & developed by Imperium Networks</p>
          </div>
        </div>
      </div>
      <Sheet
        open={accessibilityOpen}
        onOpenChange={setAccessibilityOpen}
        title="Accessibility"
        description="Make text bigger or increase contrast. Saved on this device."
      >
        <AccessibilityPanel />
      </Sheet>
    </footer>
  );
}
