import { index, route, type RouteConfig } from '@react-router/dev/routes';

const devOnly =
  process.env.NODE_ENV === 'production' ? [] : [route('__ui', 'routes/dev.ui-gallery.tsx')];

export default [index('routes/home.tsx'), ...devOnly] satisfies RouteConfig;
