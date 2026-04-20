/* FORM service worker.
 *
 * Strategy:
 *   - App shell (HTML, CSS, JS, manifest, icons) → cache-first with
 *     network revalidation. Lets the app open instantly and offline.
 *   - Static data (src/data/*.json)           → stale-while-revalidate.
 *   - ESPN scoreboard / Supabase API calls    → network-first, no cache.
 *   - Everything else                          → network with cache fallback.
 *
 * Bump CACHE_VERSION whenever shell assets change so old caches are
 * cleared on activate.
 */

const CACHE_VERSION = 'form-v1-2026-04-19-config-bypass';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

const SHELL_ASSETS = [
  './',
  './index.html',
  './you.html',
  './wall.html',
  './atlas.html',
  './atlas-admin.html',
  './styles.css',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
  './icons/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(SHELL_ASSETS).catch((err) => {
        console.warn('[sw] shell precache failed', err);
      }),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

function isApiRequest(url) {
  return (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('site.api.espn.com') ||
    url.pathname.startsWith('/api/')
  );
}

function isDataRequest(url) {
  return url.pathname.includes('/src/data/') && url.pathname.endsWith('.json');
}

function isShellRequest(url) {
  if (url.origin !== self.location.origin) return false;
  // config.js is env-injected at deploy time (see scripts/build-config.mjs).
  // It must never be cache-first — otherwise rotating the Supabase anon key
  // in Vercel env vars would leave installed PWAs stuck on the old key.
  if (url.pathname === '/config.js' || url.pathname.endsWith('/config.js')) {
    return false;
  }
  return (
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webmanifest') ||
    url.pathname === '/' ||
    url.pathname === ''
  );
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => null);
  return cached || fetchPromise || new Response(null, { status: 504 });
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) {
    fetch(req)
      .then((res) => { if (res && res.ok) cache.put(req, res.clone()); })
      .catch(() => {});
    return cached;
  }
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone()).catch(() => {});
    return fresh;
  } catch (err) {
    if (req.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }

  if (isApiRequest(url)) return; // pass through, no cache

  if (isDataRequest(url)) {
    event.respondWith(staleWhileRevalidate(req, DATA_CACHE));
    return;
  }

  if (isShellRequest(url)) {
    event.respondWith(cacheFirst(req, SHELL_CACHE));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || event.notification.url || './you.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    }),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
