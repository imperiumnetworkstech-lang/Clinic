import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useInstallPrompt } from '../lib/pwa';
import { Button } from './ui/Button';

const DISMISS_KEY = 'edc-install-dismissed';
const SNOOZE_DAYS = 14;

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() - at < SNOOZE_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Gentle "Add to home screen" card for phones. Appears only when the browser offers
 * installation, after the visitor has scrolled (shown interest), and at most once every
 * 14 days after a dismissal. iOS instructions live in the More sheet instead.
 */
export function InstallPrompt() {
  const { canPrompt, installed, install } = useInstallPrompt();
  const [engaged, setEngaged] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(snoozed());
    const onScroll = () => {
      if (window.scrollY > window.innerHeight) setEngaged(true);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!canPrompt || installed || dismissed || !engaged) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Storage blocked: hide for this visit only.
    }
    setDismissed(true);
  };

  return (
    <section
      aria-label="Install app"
      className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-3 rounded-3xl bg-white p-3 pl-4 shadow-[0_24px_60px_-20px_rgb(31_36_43/0.45)] ring-1 ring-neutral-200 md:hidden"
    >
      <img src="/images/brand/mark-192.png" alt="" width={44} height={44} className="rounded-xl" />
      <p className="flex-1 text-sm leading-snug font-semibold">
        Add Expressions Dental to your home screen
      </p>
      <Button size="sm" onClick={() => void install()} className="px-3">
        <Download size={16} />
        Add
      </Button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Not now"
        className="grid size-11 place-items-center rounded-full text-muted"
      >
        <X size={18} />
      </button>
    </section>
  );
}
