import { Sparkle } from 'lucide-react';
import { treatments } from '../lib/treatments';

/**
 * A slowly scrolling strip of treatment names under the hero. Decorative only: the full,
 * linked list is in the Treatments section, so screen readers skip it. Pauses on hover and
 * stands still for reduced motion.
 */
export function TreatmentMarquee() {
  const names = treatments.map((treatment) => treatment.name);
  // Two identical halves make the loop seamless: the track slides by exactly one half.
  const loop = [...names, ...names];

  return (
    <div
      aria-hidden="true"
      className="marquee relative overflow-hidden border-y border-primary-700/30 bg-primary-600 py-4 text-white"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-primary-600 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-primary-600 to-transparent" />
      <ul className="marquee-track flex w-max items-center">
        {loop.map((name, index) => (
          <li
            key={`${name}-${index}`}
            className="flex items-center gap-6 px-3 font-display text-lg font-semibold whitespace-nowrap"
          >
            {name}
            <Sparkle size={16} className="text-primary-200" fill="currentColor" strokeWidth={0} />
          </li>
        ))}
      </ul>
    </div>
  );
}
