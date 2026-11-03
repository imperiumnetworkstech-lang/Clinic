import { absoluteUrl } from '../lib/seo';
import { posts } from '../lib/blog';
import { treatments } from '../lib/treatments';

/** XML sitemap of every public, indexable page. Staff, API and portal paths are excluded. */
const STATIC_PATHS = [
  { path: '/', priority: '1.0' },
  { path: '/treatments', priority: '0.9' },
  { path: '/book', priority: '0.9' },
  { path: '/contact', priority: '0.8' },
  { path: '/about', priority: '0.7' },
  { path: '/emergency-dentist-goa', priority: '0.7' },
  { path: '/faq', priority: '0.5' },
  { path: '/reviews', priority: '0.6' },
  { path: '/international-patients', priority: '0.6' },
  { path: '/symptom-checker', priority: '0.6' },
  { path: '/blog', priority: '0.6' },
  { path: '/privacy-policy', priority: '0.2' },
  { path: '/medical-disclaimer', priority: '0.2' },
];

export function loader() {
  const entries = [
    ...STATIC_PATHS,
    ...treatments.map((treatment) => ({ path: `/treatments/${treatment.slug}`, priority: '0.8' })),
    ...posts.map((post) => ({ path: `/blog/${post.slug}`, priority: '0.5' })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) =>
      `  <url><loc>${absoluteUrl(entry.path)}</loc><priority>${entry.priority}</priority></url>`,
  )
  .join('\n')}
</urlset>
`;
  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
