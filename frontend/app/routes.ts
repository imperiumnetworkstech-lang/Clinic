import { index, route, type RouteConfig } from '@react-router/dev/routes';

const devOnly =
  process.env.NODE_ENV === 'production' ? [] : [route('__ui', 'routes/dev.ui-gallery.tsx')];

export default [
  index('routes/home.tsx'),
  route('book', 'routes/book.tsx'),
  route('treatments', 'routes/treatments.tsx'),
  route('treatments/:slug', 'routes/treatment.tsx'),
  route('about', 'routes/about.tsx'),
  route('contact', 'routes/contact.tsx'),
  route('faq', 'routes/faq.tsx'),
  route('emergency-dentist-goa', 'routes/emergency.tsx'),
  route('privacy-policy', 'routes/privacy-policy.tsx'),
  route('medical-disclaimer', 'routes/medical-disclaimer.tsx'),
  route('admin/login', 'routes/admin.login.tsx'),
  route('admin', 'routes/admin.tsx'),
  route('sitemap.xml', 'routes/sitemap.ts'),
  route('robots.txt', 'routes/robots.ts'),
  route('api/*', 'routes/api-proxy.ts'),
  ...devOnly,
  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig;
