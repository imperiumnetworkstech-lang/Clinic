import { describe, expect, it } from 'vitest';
import { openStatus, type WeeklyHours } from '../app/lib/hours';
import { legacyRedirect } from '../app/lib/redirects';
import { treatments } from '../app/lib/treatments';

describe('legacy URL redirects', () => {
  it.each([
    ['/service', '/treatments', 301],
    ['/service/view/1', '/treatments#general', 301],
    ['/service/view/19', '/treatments#cosmetic', 301],
    ['/service/view/7', '/treatments', 301],
    ['/photo-gallery', '/about', 301],
    ['/news/view/4', '/', 302],
    ['/index.php/service', '/treatments', 301],
    ['/treatments/dental-bleaching', '/treatments/teeth-whitening', 301],
  ])('%s → %s (%i)', (from, to, status) => {
    expect(legacyRedirect(from)).toEqual({ to, status });
  });

  it('leaves current pages and unknown paths alone', () => {
    expect(legacyRedirect('/treatments/teeth-whitening')).toBeNull();
    expect(legacyRedirect('/no-such-page')).toBeNull();
  });
});

describe('treatment content', () => {
  it('has 18 treatments with unique slugs and resolvable related links', () => {
    const slugs = new Set(treatments.map((t) => t.slug));
    expect(treatments).toHaveLength(18);
    expect(slugs.size).toBe(18);
    for (const treatment of treatments) {
      for (const related of treatment.related) expect(slugs.has(related)).toBe(true);
      expect(treatment.metaTitle.length).toBeLessThanOrEqual(60);
      expect(treatment.metaDescription.length).toBeLessThanOrEqual(155);
    }
  });
});

describe('open-now status (Goa time)', () => {
  const hours: WeeklyHours = {
    monday: [{ open: '10:00', close: '20:00' }],
    tuesday: [{ open: '10:00', close: '20:00' }],
    wednesday: [{ open: '10:00', close: '20:00' }],
    thursday: [{ open: '10:00', close: '20:00' }],
    friday: [{ open: '10:00', close: '20:00' }],
    saturday: [{ open: '10:00', close: '20:00' }],
    sunday: [],
  };
  // 2026-11-04 is a Wednesday. Times are given in UTC; Goa is UTC+5:30.
  const at = (isoUtc: string) => openStatus(hours, new Date(isoUtc));

  it('is open during hours', () => {
    expect(at('2026-11-04T06:00:00Z')).toEqual({ open: true, label: 'Open now · closes 8 pm' });
  });

  it('says when it opens later today', () => {
    expect(at('2026-11-04T02:00:00Z')).toEqual({ open: false, label: 'Closed · opens 10 am' });
  });

  it('rolls over to tomorrow after closing', () => {
    expect(at('2026-11-04T15:00:00Z').label).toBe('Closed · opens tomorrow 10 am');
  });

  it('skips the closed Sunday', () => {
    // Saturday 7 Nov 2026, 9 pm in Goa → next opening is Monday.
    expect(at('2026-11-07T15:30:00Z').label).toBe('Closed · opens Monday 10 am');
  });
});
