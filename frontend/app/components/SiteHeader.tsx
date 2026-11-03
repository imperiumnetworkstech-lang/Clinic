import * as NavigationMenu from '@radix-ui/react-navigation-menu';
import { ArrowRight, ChevronDown, Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CLINIC_NAME, primaryPhone, whatsappLink } from '../lib/clinic';
import { cn } from '../lib/cn';
import { NAV_LINKS } from '../lib/navigation';
import { treatmentCategories, treatmentHref } from '../lib/treatments';
import { container } from '../lib/ui';
import { WhatsAppIcon } from './icons';
import { buttonVariants } from './ui/Button';
import { Link } from 'react-router';

/** On phones the bar slides away while scrolling down and returns on any scroll up. */
function useHideOnScroll(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 6) return;
      setHidden(y > last && y > 96 && window.innerWidth < 768);
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return hidden;
}

const navLink =
  'inline-flex min-h-11 items-center gap-1 rounded-full px-3 font-medium whitespace-nowrap lg:px-4 text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950 data-[state=open]:bg-neutral-100 data-[state=open]:text-neutral-950';

function TreatmentsMenu() {
  return (
    <NavigationMenu.Item>
      <NavigationMenu.Trigger className={cn(navLink, 'group')}>
        Treatments
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="transition duration-200 group-data-[state=open]:rotate-180"
        />
      </NavigationMenu.Trigger>
      <NavigationMenu.Content className="mega-content absolute top-full left-0 w-full pt-3">
        <div
          className={`${container} grid grid-cols-2 gap-6 rounded-3xl bg-white p-6 lg:grid-cols-[1fr_1fr_1fr_0.9fr] lg:gap-8 lg:p-8 shadow-[0_24px_60px_-24px_rgb(31_36_43/0.35)] ring-1 ring-neutral-200`}
        >
          {treatmentCategories.map((category) => (
            <div key={category.id}>
              <p className="text-sm font-bold tracking-[0.12em] text-primary-600 uppercase">
                {category.title}
              </p>
              <ul className="mt-3 space-y-0.5">
                {category.treatments.map((treatment) => (
                  <li key={treatment.slug}>
                    <NavigationMenu.Link asChild>
                      <Link
                        to={treatmentHref(treatment.slug)}
                        prefetch="intent"
                        viewTransition
                        className="-mx-3 flex min-h-10 items-center rounded-xl px-3 font-medium text-neutral-800 hover:bg-primary-50 hover:text-primary-700"
                      >
                        {treatment.name}
                      </Link>
                    </NavigationMenu.Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-primary-50 to-secondary-50 p-6">
            <div>
              <NavigationMenu.Link asChild>
                <Link
                  to="/treatments"
                  viewTransition
                  className="mb-5 inline-flex min-h-11 items-center gap-1 font-semibold text-link hover:underline"
                >
                  All treatments
                  <ArrowRight size={16} />
                </Link>
              </NavigationMenu.Link>
              <p className="font-display text-lg font-bold">Not sure what you need?</p>
              <p className="mt-2 text-[0.95rem] text-muted">
                Tell us what’s bothering you and we’ll suggest the right next step.
              </p>
            </div>
            <NavigationMenu.Link asChild>
              <a
                href={whatsappLink('Hello, I am not sure which treatment I need. Can you help?')}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 font-semibold text-link hover:underline"
              >
                <WhatsAppIcon size={18} className="text-[#128C4A]" />
                Ask us on WhatsApp
                <ArrowRight size={16} />
              </a>
            </NavigationMenu.Link>
          </div>
        </div>
      </NavigationMenu.Content>
    </NavigationMenu.Item>
  );
}

export function SiteHeader() {
  const hidden = useHideOnScroll();

  // Always opaque: content must never show through the sticky bar, with or without JS.
  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-neutral-200/80 bg-white shadow-[0_8px_24px_-18px_rgb(31_36_43/0.3)] transition-transform duration-300 ease-[var(--ease-out-soft)]',
        hidden && '-translate-y-full',
      )}
    >
      <div
        className={`${container} relative flex h-16 items-center justify-between gap-3 md:h-20 lg:gap-6`}
      >
        <Link
          to="/"
          viewTransition
          className="flex min-h-11 shrink-0 items-center"
          aria-label={`${CLINIC_NAME}, home`}
        >
          <img
            src="/images/brand/logo.png"
            alt=""
            width={458}
            height={152}
            className="h-10 w-auto lg:h-12"
          />
        </Link>

        <NavigationMenu.Root
          aria-label="Main"
          className="static hidden md:block"
          delayDuration={80}
        >
          <NavigationMenu.List className="flex items-center gap-1">
            <TreatmentsMenu />
            {NAV_LINKS.slice(1).map((link) => (
              <NavigationMenu.Item key={link.href}>
                <NavigationMenu.Link asChild>
                  <Link to={link.href} prefetch="intent" viewTransition className={navLink}>
                    {link.label}
                  </Link>
                </NavigationMenu.Link>
              </NavigationMenu.Item>
            ))}
          </NavigationMenu.List>
          <NavigationMenu.Viewport className="absolute top-full left-0 w-full" />
        </NavigationMenu.Root>

        <div className="hidden items-center gap-2 md:flex lg:gap-4">
          <a
            href={primaryPhone.href}
            aria-label={`Call ${primaryPhone.display}`}
            className="flex min-h-11 min-w-11 items-center justify-center gap-2 font-semibold text-neutral-800 hover:text-primary-700"
          >
            <Phone size={18} className="text-primary-600" />
            <span className="hidden xl:inline">{primaryPhone.display}</span>
          </a>
          <Link to="/book" prefetch="intent" viewTransition className={buttonVariants()}>
            <span className="lg:hidden">Book</span>
            <span className="hidden lg:inline">Book appointment</span>
          </Link>
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
