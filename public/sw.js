// AJOS Service Worker — Lean, Secure PWA Caching
// ponytail: stdlib Cache API only, zero third-party dependencies (no Workbox bloat)
const CACHE_NAME = 'ajos-v1.0.0';

// Safe, public, static assets required for the app shell
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/job-search.html',
  '/company-search.html',
  '/profile.html',
  '/login.html',
  '/register.html',
  '/terms.html',
  '/privacy.html',
  '/style.css',
  '/auth.css',
  '/manifest.json',
  '/favicon.svg'
];

// Install: Pre-cache static app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up any old caches from previous deployments
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strict 5-layer whitelist to prevent bad caching & session leakage
self.addEventListener('fetch', (event) => {
  // Layer 1: Only intercept GET requests. Auth, searches, updates (POST/DELETE) pass through directly.
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Layer 2: Only intercept same-origin requests.
  // 3rd-party traffic (Firebase, Google APIs, Cloudflare Turnstile) passes through natively.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Layer 3: Physical blocker on all backend API routes.
  // /api/* endpoints are NEVER cached.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Layer 4: Strict whitelist — only static asset file extensions or HTML navigation pages
  const isStaticAsset = /\.(css|js|svg|png|jpg|jpeg|webp|woff2|ico)$/i.test(url.pathname);
  const isHtmlPage = url.pathname.endsWith('.html') || url.pathname === '/';

  if (!isStaticAsset && !isHtmlPage) {
    return; // Pass anything unrecognized straight to network
  }

  // Layer 5: Safe Caching Strategies
  if (isHtmlPage) {
    // Network-First for HTML: user always gets the latest deployed page, falls back to cache if offline
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Stale-While-Revalidate for static assets (CSS, JS, icons): instant load with background refresh
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkRes;
        }).catch(() => {/* offline / fetch failed — return cached if available */});

        return cached || fetchPromise;
      })
    );
  }
});
