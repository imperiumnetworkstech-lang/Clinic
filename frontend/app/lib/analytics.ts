import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { CONSENT_CHANGE_EVENT, readConsent } from '../components/ConsentBanner';

/**
 * Google Analytics 4, privacy-first: nothing loads and nothing is sent until the visitor
 * accepts analytics in the consent banner (and only when VITE_GA_MEASUREMENT_ID is set).
 * Events never contain names, phone numbers, symptoms or treatment choices.
 */
const GA_ID: string | undefined = import.meta.env.VITE_GA_MEASUREMENT_ID;

type ConversionEvent =
  | 'book_appointment_start'
  | 'book_appointment_complete'
  | 'click_to_call'
  | 'whatsapp_click'
  | 'directions_click';

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

let loaded = false;

function load(): void {
  if (loaded || !GA_ID) return;
  loaded = true;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() {
    // gtag.js expects the Arguments object itself, not an array.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments);
  };
  window.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { send_page_view: false });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
}

function enabled(): boolean {
  return Boolean(GA_ID) && readConsent() === 'granted';
}

export function trackEvent(name: ConversionEvent, params: Record<string, string> = {}): void {
  if (!enabled()) return;
  load();
  window.gtag?.('event', name, params);
}

/** Classifies outbound contact links so taps count as conversions without per-link wiring. */
export function contactEventFor(href: string): ConversionEvent | null {
  if (href.startsWith('tel:')) return 'click_to_call';
  if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(href)) return 'whatsapp_click';
  if (/^https:\/\/(www\.)?google\.[a-z.]+\/maps/.test(href)) return 'directions_click';
  return null;
}

/** Mount once in the root layout: page views on navigation and contact-link conversions. */
export function useAnalytics(): void {
  const location = useLocation();

  useEffect(() => {
    if (!GA_ID) return;
    const onConsent = () => {
      if (enabled()) load();
    };
    onConsent();
    window.addEventListener(CONSENT_CHANGE_EVENT, onConsent);

    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[href]');
      const name = link ? contactEventFor(link.getAttribute('href') ?? '') : null;
      if (name) trackEvent(name);
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => {
      window.removeEventListener(CONSENT_CHANGE_EVENT, onConsent);
      document.removeEventListener('click', onClick, { capture: true });
    };
  }, []);

  useEffect(() => {
    if (!enabled()) return;
    load();
    // Only the path: query strings could carry a treatment choice.
    window.gtag?.('event', 'page_view', {
      page_path: location.pathname,
      page_location: `${window.location.origin}${location.pathname}`,
    });
  }, [location.pathname]);
}
