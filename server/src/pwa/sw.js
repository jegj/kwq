// Served from the root (/sw.js) so it can control /app/*; see
// docs/adr/0001-web-push-over-sse.md.
// Bump when /offline changes: it is only fetched on install.
const CACHE = 'qhawaq-v1';
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) =>
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);

// Pages are never cached (they hold the user's data); only /assets/, whose
// URLs are content-hashed, and the offline fallback for failed navigations.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (!new URL(request.url).pathname.startsWith('/assets/')) return;
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});

// Payload is { title, body, url } from PushService; url is an in-app path.
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const { title, body, url } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/assets/icon-192.png',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url } = event.notification.data;
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((windows) => {
      const open = windows[0];
      if (!open) return self.clients.openWindow(url);
      return open.navigate(url).then((client) => client?.focus());
    }),
  );
});
