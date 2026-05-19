/* ELOquence service worker
 *
 * Strategies (cf. Workbox / PWA lecture slides):
 *   - App shell + immutable static assets  -> Cache-First
 *   - HTML navigations                     -> Network-First, falling back to cache, then offline.html
 *   - GET /api/words/* + /leaderboard      -> Stale-While-Revalidate (safe, cheap re-fetches)
 *   - All other /api/*                     -> Network-Only (rated state must be authoritative)
 *
 * Bump SW_VERSION on every meaningful change so the new worker installs and the
 * old cache is purged on activate.
 */

const SW_VERSION = 'v1';
const STATIC_CACHE = `eloquence-static-${SW_VERSION}`;
const RUNTIME_CACHE = `eloquence-runtime-${SW_VERSION}`;
const SWR_CACHE = `eloquence-swr-${SW_VERSION}`;
const ALL_CACHES = [STATIC_CACHE, RUNTIME_CACHE, SWR_CACHE];

const APP_SHELL = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

const SWR_PATHS = [
  '/api/words/',
  '/api/leaderboard',
];

// ---------- install ----------------------------------------------------------

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // Use individual adds so one missing entry doesn't fail the whole install.
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => console.warn('[sw] precache skip', url, err)),
        ),
      ),
    ),
  );
  // Activate immediately on first install so users get offline support without a reload.
  self.skipWaiting();
});

// ---------- activate ---------------------------------------------------------

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('eloquence-') && !ALL_CACHES.includes(key))
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

// ---------- helpers ----------------------------------------------------------

function isSameOrigin(url) {
  return new URL(url).origin === self.location.origin;
}

function isSwrPath(pathname) {
  return SWR_PATHS.some((p) => pathname.startsWith(p));
}

function isImmutableAsset(url) {
  const u = new URL(url);
  // Next.js fingerprints these so content never changes for a given URL.
  return (
    u.pathname.startsWith('/_next/static/') ||
    u.pathname.startsWith('/_next/image') ||
    /\.(?:woff2?|ttf|otf|png|jpg|jpeg|gif|svg|ico|webp|avif)$/.test(u.pathname)
  );
}

function isHtmlRequest(request) {
  return (
    request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'))
  );
}

// Limit runtime cache growth so we don't hoard megabytes forever.
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await Promise.all(keys.slice(0, keys.length - maxEntries).map((k) => cache.delete(k)));
  }
}

async function networkFirst(request, fallbackUrl) {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, fresh.clone());
      trimCache(RUNTIME_CACHE, 60);
    }
    return fresh;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SWR_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((res) => {
      if (res && res.ok) {
        cache.put(request, res.clone());
        trimCache(SWR_CACHE, 40);
      }
      return res;
    })
    .catch(() => undefined);
  return cached || (await networkPromise) || new Response('Offline', { status: 503 });
}

// ---------- fetch ------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // SW only handles GET. Everything else (POST/PUT/DELETE -> ELO writes) goes
  // straight to the network so we never lie about persisted state.
  if (request.method !== 'GET') return;

  // Cross-origin requests (e.g. Google Fonts) -> SWR if we own the cache.
  if (!isSameOrigin(request.url)) {
    const url = new URL(request.url);
    if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
      event.respondWith(staleWhileRevalidate(request));
    }
    return;
  }

  const url = new URL(request.url);

  // 1. Whitelisted GET API endpoints -> SWR
  if (url.pathname.startsWith('/api/')) {
    if (isSwrPath(url.pathname)) {
      event.respondWith(staleWhileRevalidate(request));
    }
    // Anything else under /api/ is network-only (default browser behavior).
    return;
  }

  // 2. Immutable static assets (Next.js hashed) -> Cache-First
  if (isImmutableAsset(request.url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 3. HTML navigations -> Network-First with offline.html fallback
  if (isHtmlRequest(request)) {
    event.respondWith(networkFirst(request, '/offline.html'));
    return;
  }

  // Default: try network, fall back to cache if we have it.
  event.respondWith(networkFirst(request));
});

// ---------- messages ---------------------------------------------------------
// Lets the page trigger an immediate activation when a new SW is waiting
// (used by <ServiceWorkerRegister> when the user opts in to update).

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
