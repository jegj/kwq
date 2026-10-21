# Deliver push alerts with Web Push, not in-page SSE

Push alerts must reach the user while no kwq tab is open, since the point is to categorize a transaction soon after the bank email arrives. We chose Web Push (service worker, VAPID keys, a push subscription table per device) over an SSE stream plus the Notification API, which is simpler but only fires while a tab is open.

## Consequences

- New `web-push` dependency, VAPID keys in `.env`, and a `push_subscription` table.
- The service worker is served from a root route (`/sw.js`, no-cache), not `/assets/`, so it controls `/app/*` and isn't pinned by the immutable asset cache header.
- Sending is best-effort after the DB commit: a push failure never changes the webhook response, and dead subscriptions (404/410) are pruned.
- Requires HTTPS (or localhost); iOS only delivers to an installed PWA.
