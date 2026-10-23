// Served from the root (/sw.js) so it can control /app/*; see
// docs/adr/0001-web-push-over-sse.md. Push handlers land with Web Push.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim()),
);
