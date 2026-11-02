import { useCallback, useEffect, useState } from 'react';

export type TextSize = 'normal' | 'large' | 'larger';

export interface AccessibilitySettings {
  textSize: TextSize;
  highContrast: boolean;
}

const STORAGE_KEY = 'edc-a11y';
const DEFAULTS: AccessibilitySettings = { textSize: 'normal', highContrast: false };

/**
 * Inline script for <head>: applies saved settings before first paint so the page never
 * flashes at the wrong size or contrast. Kept tiny and dependency-free.
 */
export const ACCESSIBILITY_BOOT_SCRIPT = `try{var s=JSON.parse(localStorage.getItem('${STORAGE_KEY}')||'{}');var d=document.documentElement;if(s.textSize&&s.textSize!=='normal')d.dataset.textSize=s.textSize;if(s.highContrast)d.dataset.contrast='high'}catch(e){}`;

function read(): AccessibilitySettings {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '{}',
    ) as Partial<AccessibilitySettings>;
    return {
      textSize:
        parsed.textSize === 'large' || parsed.textSize === 'larger' ? parsed.textSize : 'normal',
      highContrast: parsed.highContrast === true,
    };
  } catch {
    return DEFAULTS;
  }
}

export function applyAccessibility(settings: AccessibilitySettings): void {
  const root = document.documentElement;
  if (settings.textSize === 'normal') delete root.dataset.textSize;
  else root.dataset.textSize = settings.textSize;
  if (settings.highContrast) root.dataset.contrast = 'high';
  else delete root.dataset.contrast;
}

/** Reads and updates the visitor's accessibility preferences (stored in this browser only). */
export function useAccessibilitySettings() {
  const [settings, setSettings] = useState<AccessibilitySettings>(DEFAULTS);

  useEffect(() => {
    setSettings(read());
  }, []);

  const update = useCallback((patch: Partial<AccessibilitySettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      applyAccessibility(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Private mode or blocked storage: the setting still applies for this visit.
      }
      return next;
    });
  }, []);

  return { settings, update };
}
