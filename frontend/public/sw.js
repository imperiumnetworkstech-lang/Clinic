/*
 * Service worker: makes the site installable and usable offline.
 * - Page navigations: network first; offline falls back to the last cached copy of that
 *   page, then to /offline.html (call/WhatsApp still work without data).
 * - Built assets, images and fonts: served from cache, refreshed in the background.
 * - Never caches the API or anything cross-origin.
 * Bump VERSION whenever this file changes so old caches are dropped.
 */
const VERSION = 'v1';
const SHELL = `edc-shell-${VERSION}`;
const PAGES = `edc-pages-${VERSION}`;
const ASSETS = `edc-assets-${VERSION}`;

const PRECACHE = [
  '/offline.html',
  '/manifest.webmanifest',
  '/images/brand/logo.png',
  '/images/brand/mark-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL, PAGES, ASSETS]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

const isAsset = (url) =>
  url.pathname.startsWith('/assets/') ||
  url.pathname.startsWith('/images/') ||
  /\.(woff2?|css|js)$/.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGES).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) ?? caches.match('/offline.html')),
    );
    return;
  }

  if (isAsset(url)) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached ?? network;
      }),
    );
  }
});
