import { data, redirect } from 'react-router';
import { legacyRedirect } from '../lib/redirects';
import type { Route } from './+types/not-found';

/**
 * Catch-all: redirects old-site URLs, otherwise a real 404 status (never a soft 404). The
 * root ErrorBoundary renders the helpful not-found page.
 */
export function loader({ request }: Route.LoaderArgs) {
  const target = legacyRedirect(new URL(request.url).pathname);
  if (target) throw redirect(target.to, target.status);
  throw data(null, { status: 404 });
}

export default function NotFound() {
  return null;
}
