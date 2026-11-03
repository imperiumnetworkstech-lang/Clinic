import { absoluteUrl, SITE_INDEXABLE } from '../lib/seo';

/**
 * Until launch (VITE_SITE_INDEXABLE=true) the whole site is closed to crawlers, so preview
 * URLs never compete with the clinic's current site. Staff and API paths are always closed.
 */
export function loader() {
  const rules = SITE_INDEXABLE
    ? ['User-agent: *', 'Disallow: /admin', 'Disallow: /api/', 'Disallow: /portal', 'Allow: /']
    : ['User-agent: *', 'Disallow: /'];
  const body = `${rules.join('\n')}\n\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`;
  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
