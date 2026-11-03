import { ChevronRight, Download, Mail, Navigation, Phone, Share } from 'lucide-react';
import { branches, email, phones } from '../lib/clinic';
import { Link } from 'react-router';
import { NAV_LINKS } from '../lib/navigation';
import { useInstallPrompt } from '../lib/pwa';
import { AccessibilityPanel } from './AccessibilityPanel';
import { Button } from './ui/Button';
import { Sheet, SheetSectionLabel } from './ui/Sheet';

const row =
  'flex min-h-14 items-center justify-between gap-3 rounded-2xl px-4 font-semibold hover:bg-neutral-50';

/** Phone "More" tab: everything that doesn't fit in the tab bar, one thumb-reach away. */
export function MoreSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const close = () => onOpenChange(false);
  const { installed, canPrompt, showIosHint, install } = useInstallPrompt();

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="More">
      <nav aria-label="More pages" className="mt-4 -mx-2">
        {NAV_LINKS.map((link) => (
          <Link key={link.href} to={link.href} viewTransition onClick={close} className={row}>
            {link.label}
            <ChevronRight size={18} className="text-neutral-400" />
          </Link>
        ))}
      </nav>

      <SheetSectionLabel>Contact</SheetSectionLabel>
      <div className="mt-2 -mx-2">
        {phones.map((phone) => (
          <a key={phone.href} href={phone.href} className={row}>
            <span className="flex items-center gap-3">
              <Phone size={18} className="text-primary-600" />
              {phone.display}
            </span>
          </a>
        ))}
        <a href={`mailto:${email}`} className={row}>
          <span className="flex items-center gap-3">
            <Mail size={18} className="shrink-0 text-primary-600" />
            <span>
              Email us
              <span className="block text-sm font-normal text-muted">{email}</span>
            </span>
          </span>
        </a>
        {branches.map((branch) => (
          <a
            key={branch.id}
            href={branch.directionsHref}
            target="_blank"
            rel="noopener noreferrer"
            className={row}
          >
            <span className="flex items-center gap-3">
              <Navigation size={18} className="text-primary-600" />
              Directions to {branch.shortName}
            </span>
          </a>
        ))}
      </div>

      <SheetSectionLabel>Accessibility</SheetSectionLabel>
      <AccessibilityPanel />

      {!installed && (canPrompt || showIosHint) && (
        <>
          <SheetSectionLabel>App</SheetSectionLabel>
          {canPrompt ? (
            <Button variant="secondary" className="mt-3 w-full" onClick={() => void install()}>
              <Download size={18} className="text-primary-600" />
              Add Expressions Dental to your home screen
            </Button>
          ) : (
            <p className="mt-3 flex items-start gap-3 rounded-2xl bg-surface p-4 text-[0.95rem]">
              <Share size={18} className="mt-0.5 shrink-0 text-primary-600" />
              <span>
                To add this app to your home screen, tap <strong>Share</strong> in Safari, then{' '}
                <strong>Add to Home Screen</strong>.
              </span>
            </p>
          )}
        </>
      )}
    </Sheet>
  );
}
