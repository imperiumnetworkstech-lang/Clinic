import '@fontsource-variable/inter';
import '@fontsource-variable/plus-jakarta-sans';
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
import { BookingProvider } from './components/BookingSheet';
import { BottomTabBar } from './components/BottomTabBar';
import { SiteFooter } from './components/SiteFooter';
import { SiteHeader } from './components/SiteHeader';
import { primaryPhone } from './lib/clinic';
import { button, container } from './lib/ui';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#ffffff" />
        {/* Not indexable until launch; Phase 3 replaces this with per-page SEO tags. */}
        <meta name="robots" content="noindex, nofollow" />
        <link rel="icon" href="/images/brand/favicon-48.png" sizes="48x48" />
        <link rel="apple-touch-icon" href="/images/brand/apple-touch-icon.png" />
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
  return (
    <BookingProvider>
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-white px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">
        <Outlet />
      </main>
      <SiteFooter />
      <BottomTabBar />
    </BookingProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main className={`${container} py-24 text-center`}>
      <h1 className="text-4xl font-bold">{notFound ? 'Page not found' : 'Something went wrong'}</h1>
      <p className="mx-auto mt-4 max-w-md text-muted">
        {notFound
          ? 'The page you were looking for has moved or no longer exists.'
          : 'Please try again in a moment.'}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a href="/" className={button.primary}>
          Go to the home page
        </a>
        <a href={primaryPhone.href} className={button.secondary}>
          Call {primaryPhone.display}
        </a>
      </div>
    </main>
  );
}
