import type { ReactNode } from 'react';
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router';
import type { Route } from './+types/root';
import './app.css';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* Not indexable until launch; Phase 3 replaces this with per-page SEO tags. */}
        <meta name="robots" content="noindex, nofollow" />
        <link rel="icon" href="/images/original/favicon.png" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">{notFound ? 'Page not found' : 'Something went wrong'}</h1>
      <p className="mt-4 text-muted">
        Call us on{' '}
        <a className="text-link underline" href="tel:+919657061122">
          +91 96570 61122
        </a>{' '}
        or go back to the{' '}
        <a className="text-link underline" href="/">
          home page
        </a>
        .
      </p>
    </main>
  );
}
