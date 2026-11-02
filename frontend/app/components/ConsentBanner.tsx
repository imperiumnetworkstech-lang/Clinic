import { Cookie } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../lib/cn';
import { Button } from './ui/Button';

/**
 * Privacy-first analytics consent (DPDP Act / Consent Mode v2). Only essential storage is
 * used without consent. The banner exists only when analytics are configured, so the site
 * never asks permission for tracking it doesn't do.
 */
export const ANALYTICS_ENABLED = Boolean(import.meta.env.VITE_GA_MEASUREMENT_ID);

export type ConsentChoice = 'granted' | 'denied';

const STORAGE_KEY = 'edc-consent';
const CONSENT_VERSION = 1;
const REOPEN_EVENT = 'edc:consent-reopen';
export const CONSENT_CHANGE_EVENT = 'edc:consent-change';

export function readConsent(): ConsentChoice | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as {
      analytics?: ConsentChoice;
      version?: number;
    } | null;
    return saved?.version === CONSENT_VERSION ? (saved.analytics ?? null) : null;
  } catch {
    return null;
  }
}

function saveConsent(analytics: ConsentChoice): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ analytics, version: CONSENT_VERSION, at: new Date().toISOString() }),
    );
  } catch {
    // Storage blocked: the choice applies for this visit only.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: analytics }));
}

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ANALYTICS_ENABLED) return;
    setVisible(readConsent() === null);
    const reopen = () => setVisible(true);
    window.addEventListener(REOPEN_EVENT, reopen);
    return () => window.removeEventListener(REOPEN_EVENT, reopen);
  }, []);

  if (!visible) return null;

  const choose = (choice: ConsentChoice) => {
    saveConsent(choice);
    setVisible(false);
  };

  return (
    <section
      aria-label="Cookie consent"
      className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 rounded-3xl bg-white p-5 shadow-[0_24px_60px_-20px_rgb(31_36_43/0.45)] ring-1 ring-neutral-200 md:inset-x-auto md:right-6 md:bottom-6 md:max-w-md"
    >
      <p className="flex items-center gap-2 font-semibold">
        <Cookie size={18} className="text-primary-600" />
        Help us improve this website
      </p>
      <p className="mt-2 text-[0.95rem] text-muted">
        We’d like to use analytics cookies to see which pages help patients most. No medical
        information is ever shared. You can change this any time.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variant="secondary" size="sm" onClick={() => choose('denied')}>
          Decline
        </Button>
        <Button size="sm" onClick={() => choose('granted')}>
          Accept analytics
        </Button>
      </div>
    </section>
  );
}

/** Footer link that reopens the banner; hidden when analytics aren't configured. */
export function ConsentSettingsLink({ className }: { className?: string }) {
  if (!ANALYTICS_ENABLED) return null;
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(REOPEN_EVENT))}
      className={cn('inline-flex items-center', className)}
    >
      Cookie settings
    </button>
  );
}
