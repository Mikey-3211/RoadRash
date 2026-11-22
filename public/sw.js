const CACHE_NAME = 'arcade-hub-v6';

self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch('/cache-manifest.json')
      .then((res) => {
        if (!res.ok) throw new Error('Could not load cache-manifest.json');
        return res.json();
      })
      .then(async (assets) => {
        const cache = await caches.open(CACHE_NAME);
        console.log(`[SW] Pre-caching ${assets.length} arcade files for offline play...`);
        const batchSize = 25;
        let failedUrls = [];

        for (let i = 0; i < assets.length; i += batchSize) {
          const batch = assets.slice(i, i + batchSize);
          await Promise.all(
            batch.map((url) =>
              fetch(url)
                .then((resp) => {
                  if (resp.ok) return cache.put(url, resp);
                  failedUrls.push({ url, status: resp.status });
                })
                .catch((err) => {
                  failedUrls.push({ url, error: err.message });
                })
            )
          );
        }

        if (failedUrls.length > 0) {
          console.warn(`[SW] Pre-cached with ${failedUrls.length} failed assets:`, failedUrls.slice(0, 10));
        } else {
          console.log('[SW] 100% of arcade files successfully cached! Offline ready.');
        }
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Manifest caching error (will fallback dynamically):', err);
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key.startsWith('arcade-hub-') && key !== CACHE_NAME) {
            console.log('[SW] Purging outdated arcade cache:', key);
            return caches.delete(key);
          }
          if (key === 'roadrash-full-v1' || key === 'roadrash-full-v2') {
            console.log('[SW] Upgrading legacy cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // External requests handled by browser network
  if (url.origin !== self.location.origin) {
    return;
  }

  // Never intercept local VCop2 assets - let them stream directly from server
  if (url.pathname.startsWith('/games/vcop2/local/')) {
    return;
  }

  // Navigation requests
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;

          if (url.pathname.startsWith('/games/road-rash')) {
            const rr = await caches.match('/games/road-rash/index.html');
            if (rr) return rr;
          }
          if (url.pathname.startsWith('/games/dangerous-dave') || url.pathname.startsWith('/dave')) {
            const dd = await caches.match('/dave/index.html');
            if (dd) return dd;
          }
          if (url.pathname.startsWith('/games/hotd2')) {
            const hd = await caches.match('/games/hotd2/index.html');
            if (hd) return hd;
          }
          if (url.pathname.startsWith('/games/vcop2')) {
            const vc = await caches.match('/games/vcop2/index.html');
            if (vc) return vc;
          }

          const hub = await caches.match('/index.html') || await caches.match('/');
          if (hub) return hub;

          return new Response('<h1>Offline - Page Not Cached</h1><p><a href="/">Return to Arcade Hub</a></p>', {
            headers: { 'Content-Type': 'text/html' },
            status: 503
          });
        })
    );
    return;
  }

  // Static Assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          return new Response('', { status: 404, statusText: 'Offline Asset Unavailable' });
        });
    })
  );
});
