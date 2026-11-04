import type { CSSProperties } from 'react';

/** Staggers siblings revealed by useScrollReveal: each one starts `step` ms after the last. */
export function revealDelay(index: number, step = 90): CSSProperties {
  return { '--reveal-delay': `${index * step}ms` } as CSSProperties;
}
