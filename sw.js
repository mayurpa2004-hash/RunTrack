const CACHE_NAME = "runtrack-v4";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use individual adds to prevent one failure blocking all
      return Promise.allSettled(
        APP_SHELL.map(url => cache.add(url).catch(err => {
          console.warn('Failed to cache:', url, err);
        }))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Skip cross-origin requests (CDN, tiles) from cache-first
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Return cached version if offline for same-origin navigations
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request)
          .then((response) => {
            if (response && response.status === 200 && response.type === "basic") {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, clone);
              });
            }
            return response;
          })
          .catch(() => {
            if (event.request.mode === "navigate") {
              return caches.match("./index.html");
            }
          })
      );
    })
  );
});
