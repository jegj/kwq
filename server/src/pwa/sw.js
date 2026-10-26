// Served from the root (/sw.js) so it can control /app/*; see
// docs/adr/0001-web-push-over-sse.md.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim()),
);

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
