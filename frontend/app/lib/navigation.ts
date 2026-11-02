/**
 * Site navigation. Until the Phase 3 pages exist, items point at sections of the home page
 * (with a leading "/" so they also work from other routes).
 */
export const NAV_LINKS = [
  { href: '/#treatments', label: 'Treatments' },
  { href: '/#clinic', label: 'Our clinic' },
  { href: '/#reviews', label: 'Reviews' },
  { href: '/#locations', label: 'Locations' },
];

/** Anchor for one treatment row on the home page; opening it expands that row. */
export const treatmentHref = (slug: string) => `/#t-${slug}`;
