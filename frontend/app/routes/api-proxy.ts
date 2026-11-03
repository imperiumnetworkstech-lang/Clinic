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

async function forward(request: Request): Promise<Response> {
  const origin = apiOrigin();
  if (!origin) {
    return Response.json(
      { title: 'The API is not configured', status: 503, code: 'api_unavailable' },
      { status: 503, headers: { 'content-type': 'application/problem+json' } },
    );
  }

  const url = new URL(request.url);
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const upstream = await fetch(`${origin}${url.pathname}${url.search}`, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: 'manual',
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase()) && key.toLowerCase() !== 'set-cookie') {
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
