const CACHE_NAME = 'runtrack-v2';
const LOCAL_ASSETS = [
  './index.html',
  './manifest.json',
  './sw.js'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Only cache local files during install to prevent CORS/CDN failures from breaking the SW
      return cache.addAll(LOCAL_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  try {
    const url = new URL(event.request.url);

    // 1. Map tiles (cartocdn.com): network-first, silent fail offline
    if (url.hostname.includes('basemaps.cartocdn.com')) {
      event.respondWith(
        fetch(event.request).catch(() => new Response(''))
      );
      return;
    }

    // 2. CDN requests (unpkg.com, cdn.tailwindcss.com): try network first, then cache
    if (url.hostname.includes('unpkg.com') || url.hostname.includes('cdn.tailwindcss.com')) {
      event.respondWith(
        fetch(event.request)
          .then((networkResponse) => {
            // Cache successful network responses dynamically
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
            return networkResponse;
          })
          .catch(() => {
            // Fallback to cache if offline
            return caches.match(event.request);
          })
      );
      return;
    }

    // 3. Local requests: cache-first strategy (cache then network fallback)
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(event.request).then((networkResponse) => {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
            return networkResponse;
          });
        })
        .catch(() => {
          // Navigation requests offline fallback
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('');
        })
    );
  } catch (error) {
    // Never let an uncaught error crash the fetch handler
    console.error('Fetch handler error:', error);
    if (event.request.mode === 'navigate') {
      event.respondWith(caches.match('./index.html'));
    }
  }
});