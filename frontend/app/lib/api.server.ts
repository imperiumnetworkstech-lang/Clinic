/**
 * Where the website's server reaches the API. Production sets API_ORIGIN (the API's Vercel
 * URL); development defaults to the local API. Server-only: never shipped to browsers.
 */
export function apiOrigin(): string | null {
  const configured = process.env.API_ORIGIN?.replace(/\/+$/, '');
  if (configured) return configured;
  // Vercel sets VERCEL on every build and function; the local API never exists there.
  const deployed = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  return deployed ? null : 'http://localhost:4000';
}
