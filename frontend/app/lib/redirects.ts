import { posts } from './blog';
import { treatments } from './treatments';

/**
 * Old-site URLs → new pages (docs/SITEMAP_IA.md §5). All permanent (301) so search engines
 * transfer rankings; old blog posts go to their rewritten replacements.
 */
const EXACT: Record<string, { to: string; status: 301 | 302 }> = {
  '/service': { to: '/treatments', status: 301 },
  '/service/view/1': { to: '/treatments#general', status: 301 },
  '/service/view/2': { to: '/treatments#advanced', status: 301 },
  '/service/view/19': { to: '/treatments#cosmetic', status: 301 },
  '/photo-gallery': { to: '/about', status: 301 },
  '/single-blog.html': { to: '/blog', status: 301 },
  '/news': { to: '/blog', status: 301 },
  ...Object.fromEntries(
    posts.map((post) => [post.legacyPath, { to: `/blog/${post.slug}`, status: 301 as const }]),
  ),
};

const PREFIXES: Array<{ prefix: string; to: string; status: 301 | 302 }> = [
  { prefix: '/service/view/', to: '/treatments', status: 301 },
  { prefix: '/news/view/', to: '/blog', status: 301 },
  { prefix: '/category/', to: '/blog', status: 301 },
];

const BY_LEGACY_SLUG = new Map(treatments.map((t) => [t.legacySlug, t.slug]));

export function legacyRedirect(pathname: string): { to: string; status: 301 | 302 } | null {
  const path = pathname.replace(/^\/index\.php(?=\/)/, '').replace(/\/+$/, '') || '/';
  if (path !== pathname && path !== '/') {
    const target = legacyRedirect(path);
    return target ?? { to: path, status: 301 };
  }

  const exact = EXACT[path];
  if (exact) return exact;

  // Old-style or renamed treatment slugs (e.g. /treatments/dental-bleaching).
  const treatment = path.match(/^\/treatments\/([^/]+)$/)?.[1];
  const renamed = treatment ? BY_LEGACY_SLUG.get(treatment) : undefined;
  if (renamed && renamed !== treatment) return { to: `/treatments/${renamed}`, status: 301 };

  const prefix = PREFIXES.find((entry) => path.startsWith(entry.prefix));
  return prefix ? { to: prefix.to, status: prefix.status } : null;
}
