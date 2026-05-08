// service-worker.js — PWA offline support
// Bump CACHE_VERSION whenever app files change to force a cache refresh.
const CACHE_VERSION = 'v1';
const CACHE_NAME    = `recepten-app-${CACHE_VERSION}`;

// All files that make up the app shell — cached on install for offline use
const CACHE_FILES = [
  './',
  './index.html',
  './css/style.css',
  './js/db.js',
  './js/recipes.js',
  './js/scheduler.js',
  './js/grocery.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Install: pre-cache the entire app shell
self.addEventListener('install', (event) => {
  console.log(`[SW] Installeren: ${CACHE_NAME}`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_FILES))
      .then(() => {
        console.log('[SW] App shell gecached');
        // Take control immediately instead of waiting for old SW to idle out
        return self.skipWaiting();
      })
  );
});

// Activate: delete any caches from older versions
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activeren: ${CACHE_NAME}`);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('recepten-app-') && key !== CACHE_NAME)
          .map(key => {
            console.log(`[SW] Oude cache verwijderen: ${key}`);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: serve from cache, fall back to network (cache-first strategy)
// IndexedDB requests go directly to the network and are never cached here —
// the browser handles IDB storage independently of the HTTP cache.
self.addEventListener('fetch', (event) => {
  // Only handle same-origin GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      // Not in cache — fetch from network and cache the response for next time
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      });
    })
  );
});
