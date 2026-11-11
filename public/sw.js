/**
 * SYNCROZZ DEPLOYMENT RELIABILITY (SDR) — SERVICE WORKER
 * Application: BookBK KPMBP
 * Engineering Standard: SES v4.4
 *
 * Provides safe offline shell caching, PWA installation, and strict anti-stale
 * deployment lifecycle. Never caches /version.json or dynamic API calls.
 */

const CACHE_NAME = 'bookbk-kpmbp-shell-v2';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Installation: Do not prematurely hijack clients until activated
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SDR SW] Precache non-critical warning:', err);
      });
    })
  );
});

// Controlled update message from client updater
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activation: Clean up stale shell caches, claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key.startsWith('bookbk-') || key.startsWith('kpmbp-')) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch handling: Strict network-first for version.json and navigations
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. CRITICAL: Never intercept or cache version endpoint, APIs, Firebase or websockets
  if (
    event.request.method !== 'GET' ||
    url.pathname === '/version.json' ||
    url.pathname.startsWith('/api') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('identitytoolkit') ||
    url.protocol === 'chrome-extension:' ||
    url.search.includes('_sdr_')
  ) {
    return; // Pass directly to network
  }

  // 2. Navigation requests: Network-first to always load latest deployed HTML
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy).catch(() => {});
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const fallback = await caches.match('/index.html') || await caches.match('/');
          if (fallback) return fallback;
          return new Response('Luar talian (Offline) — Sila sambung semula ke internet.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        })
    );
    return;
  }

  // 3. Static assets: Network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (url.origin === location.origin || url.hostname.includes('fonts.gstatic.com'))
        ) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copy).catch(() => {});
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response('', { status: 408, statusText: 'Request timed out or offline' });
      })
  );
});
