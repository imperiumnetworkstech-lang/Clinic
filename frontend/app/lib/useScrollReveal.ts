import { useEffect } from 'react';

/**
 * Animates every `[data-reveal]` element in as it scrolls into view. Server-rendered content is
 * always visible: only elements still below the fold after hydration are hidden, so nothing
 * flashes and pages work without JavaScript. Skipped entirely for reduced motion.
 *
 * `data-reveal` picks the entrance ("up" by default, "left", "right", "zoom"); a
 * `--reveal-delay` style staggers siblings.
 */
export function useScrollReveal() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          observer.unobserve(element);
          element.classList.remove('reveal-pending');
          // Once in, drop the stagger delay so hover transitions respond immediately.
          element.addEventListener(
            'transitionend',
            () => element.setAttribute('data-reveal-done', ''),
            { once: true },
          );
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );

    for (const element of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
      if (element.getBoundingClientRect().top < window.innerHeight * 0.92) continue;
      element.classList.add('reveal-pending');
      observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);
}
