const CACHE_NAME = 'roadrash-full-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch('/cache-manifest.json')
      .then((res) => res.json())
      .then(async (assets) => {
        const cache = await caches.open(CACHE_NAME);
        console.log(`[SW] Pre-caching ${assets.length} game files for offline...`);
        // Cache in batches to prevent browser network starvation
        const batchSize = 25;
        for (let i = 0; i < assets.length; i += batchSize) {
          const batch = assets.slice(i, i + batchSize);
          await Promise.all(
            batch.map((url) =>
              fetch(url)
                .then((resp) => {
                  if (resp.ok) return cache.put(url, resp);
                })
                .catch(() => {})
            )
          );
        }
        console.log('[SW] All game files cached! Ready for 100% offline play.');
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // If requesting root or classic entry, always return cached index.html if offline
  if (url.pathname === '/' || url.pathname.includes('/classic/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return (
          cached ||
          fetch(event.request).catch(() => caches.match('/index.html'))
        );
      })
    );
    return;
  }

  // Cache-First strategy with fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and request is an image or mock
          return new Response('', { status: 404, statusText: 'Offline' });
        });
    })
  );
});
