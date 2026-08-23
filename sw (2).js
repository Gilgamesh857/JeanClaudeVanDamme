/* Service worker — deliberately network-first.
 *
 * The usual PWA pattern caches aggressively and serves the cached copy first,
 * which means a fresh deploy can take days to appear. That is the opposite of
 * what is wanted here: this app is rebuilt constantly, so the network copy
 * always wins and the cache exists only for when there is no network.
 *
 * Consequence: this file never needs editing. There is no version string and
 * no precache list, so deploying a new build is still just replacing
 * index.html. Nothing here has to be kept in step with it.
 */

const CACHE = 'diary-runtime';

self.addEventListener('install', (event) => {
  // Take over immediately rather than waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop any cache from an earlier naming scheme.
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle same-origin GETs. Google Drive, OAuth and font requests pass
  // straight through untouched — the worker must never sit in the middle of
  // an authenticated API call.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        // Always try the live version first, and never let the browser's own
        // HTTP cache hand back something stale.
        const fresh = await fetch(req, { cache: 'no-store' });
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (err) {
        // Offline: fall back to whatever was last seen.
        const cached = await caches.match(req);
        if (cached) return cached;
        // A navigation with nothing cached — try the app shell.
        if (req.mode === 'navigate') {
          const shell = await caches.match('./');
          if (shell) return shell;
        }
        throw err;
      }
    })()
  );
});
