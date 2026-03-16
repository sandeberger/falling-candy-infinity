const CACHE_NAME = 'candy-v3';

self.addEventListener('install', (e) => {
  // Skip waiting so new SW activates immediately
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Delete all old caches
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;

  // Don't intercept cross-origin requests (e.g. Google Fonts)
  if (!e.request.url.startsWith(self.location.origin)) return;

  // Network-first: always try fresh, fall back to cache for offline
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (response.ok && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(e.request).then((cached) => {
          if (cached) return cached;
          // Fallback to index.html for navigation requests only
          if (e.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('', { status: 408, statusText: 'Offline' });
        })
      )
  );
});
