import { apiOrigin } from '../lib/api.server';
import type { Route } from './+types/api-proxy';

/**
 * Same-origin proxy for /api/* in production, so the admin's session cookies stay first-party
 * on the website's domain. In development Vite's proxy answers /api first.
 */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

function unavailable(title: string, status: number): Response {
  return Response.json(
    { title, status, code: 'api_unavailable' },
    { status, headers: { 'content-type': 'application/problem+json' } },
  );
}

async function forward(request: Request): Promise<Response> {
  const origin = apiOrigin();
  if (!origin) return unavailable('The API is not configured', 503);

  const url = new URL(request.url);
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  let upstream: Response;
  try {
    upstream = await fetch(`${origin}${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: 'manual',
    });
  } catch {
    return unavailable('The API could not be reached', 502);
  }

  // fetch() has already decompressed the body, so the upstream content-encoding no longer applies.
  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const name = key.toLowerCase();
    if (!HOP_BY_HOP.has(name) && name !== 'set-cookie' && name !== 'content-encoding') {
      responseHeaders.set(key, value);
    }
  });
  for (const cookie of upstream.headers.getSetCookie())
    responseHeaders.append('set-cookie', cookie);
  responseHeaders.set('cache-control', 'no-store');

  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const loader = ({ request }: Route.LoaderArgs) => forward(request);
export const action = ({ request }: Route.ActionArgs) => forward(request);
