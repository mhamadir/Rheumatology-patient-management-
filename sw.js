const CACHE_NAME = 'rheuma-clinical-record-v5';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing iOS-compatible Service Worker v5');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[SW] Caching failed on install:', err))
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker v5');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // iOS Safari compatibility: Do not intercept cross-origin requests
  if (requestUrl.origin !== location.origin) return;

  const isNavigation = event.request.mode === 'navigate' ||
                       event.request.destination === 'document' ||
                       requestUrl.pathname.endsWith('index.html') ||
                       requestUrl.pathname === '/' ||
                       requestUrl.pathname.endsWith('/');

  if (isNavigation) {
    // Cache-First for navigation / HTML requests to guarantee offline loading on iOS
    event.respondWith(
      caches.match('./index.html').then((cachedResponse) => {
        if (cachedResponse) {
          // Fetch updated version in background when online
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', networkResponse));
            }
          }).catch(() => {/* Ignore network errors offline */});
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const respClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', respClone));
          }
          return networkResponse;
        });
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Network-First with Cache Fallback for static assets
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const respClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});
