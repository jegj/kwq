# KWQ

kwq (Qhawaq) is a Peruvian bank spending analyzer: it watches your gmail(for now) email for bank notifications via a Google Apps Script, forwards matching messages to a backend, and records them for analysis.

## Scope & users

- Multi-user, invite-only. New accounts are created via an admin CLI/seed
  script (temp password shared manually) — no email service in v1.
- Auth: email + password, session cookies.
- Forgot-password: handled by admin manually for v1 (no reset-email flow).

## Stack

- **Backend**: NestJS, wired into the root repo as an npm workspace
  (`server/`, alongside `kwq_watcher/`).
- **Database**: PostgreSQL + Prisma ORM.
- **Views**: server-rendered (Nest + template engine), Alpine.js for
  interactivity, Chart.js for charts.

## Email ingestion & parsing

- Webhook receives per-user tokenized requests via an `X-Kwq-Token` header
  (see Auth implementation below) from each user's own `kwq_watcher` gscript
  instance — no shared global secret, no email-address lookup needed.
- Raw email content (`body` / `bodyHtml`) is stored permanently, so parsers
  can be re-run against history later if improved.
- Parsers: pluggable strategy classes per sender, shared
  `parse(email): Transaction` interface, registered via Nest DI.

## Classification & data

- Categories: preset defaults (Food, Transport, etc.) + user-defined custom
  categories.
- Classification: rule-based (keyword/merchant matching) first, with manual
  override in the UI; LLM-assisted categorization can be added later behind
  an interface if needed.
- Multi-currency from the start — each transaction stores an amount + ISO
  currency code.

## Process

- TDD for the logic that actually branches and matters (bank parsers,
  classification rules); views/CRUD scaffolding built more loosely and
  covered by tests after.

## Dev environment

- **Server**: runs natively (`npm run dev` from repo root, or
  `npm run start:dev` inside `server/`) — not containerized. Only the
  database runs in Docker.
- **Database**: `postgres:18-alpine` via `server/docker-compose.yml`, single
  `postgres` service, port `5432`, named volume (`kwq_postgres_data`) for
  persistence. Started with `npm run db:up` from repo root.
  - Pinned to PG18 (not 17) specifically for native `uuidv7()`/`uuidv4()`
    support.
  - Creds via `server/.env` (gitignored; `server/.env.example` committed):
    `POSTGRES_USER=kwq`, `POSTGRES_PASSWORD=kwq`, `POSTGRES_DB=kwq_dev`.
- **npm workspaces**: root `package.json` has
  `"workspaces": ["server", "kwq_watcher"]`.
  - Dependency versions are pinned exact (no `^`/`~`) in `server/package.json`.
    Enforced via `save-exact=true` in the root `.npmrc` — npm ignores
    per-workspace `.npmrc` files, so it has to live at the repo root, not
    `server/.npmrc`.
- **Prisma**: `prisma` + `@prisma/client` + `@prisma/adapter-pg` (7.10.0).
  - Prisma 7 moved connection config out of `schema.prisma` — the
    `datasource` block only has `provider`, the URL lives in
    `server/prisma.config.ts` (reads `DATABASE_URL` from `.env`), and
    `PrismaClient` requires an explicit driver adapter
    (`new PrismaPg({ connectionString })`) instead of connecting straight
    off the schema URL.
  - `PrismaService` (`server/src/prisma/prisma.service.ts`) wraps
    `PrismaClient` with the adapter, connects on `onModuleInit`. Exposed via
    a `@Global()` `PrismaModule`, imported once in `AppModule`.
  - Convention: only repository classes inject `PrismaService` directly —
    everything else depends on the repository's interface, not Prisma.
  - Data model: see `server/prisma/schema.prisma`.
  - Naming: Prisma models/fields stay camelCase; the underlying DB tables and
    columns are snake_case via `@@map`/`@map`.
- **Logging**: `nestjs-pino` (`nestjs-pino` + `pino` + `pino-http`), with
  `pino-pretty` as a dev dependency only.
  - `LoggerModule.forRoot()` in `AppModule`: `pino-pretty` transport (colored,
    single-line) when `APP_ENV !== 'production'`; raw structured JSON
    otherwise, for log aggregators. Level from `LOG_LEVEL` env var,
    defaulting to `debug` in dev / `info` in prod.
  - `main.ts` calls `app.useLogger(app.get(Logger))` with `bufferLogs: true`
    so Nest's own bootstrap logs go through pino too, not just app logs.
- **`NODE_ENV` vs `APP_ENV`**: `NODE_ENV` is always `production` in every
  environment (local, staging, prod) — nested packages (Nest, Fastify,
  etc.) get their production-optimized codepaths, no dev-mode overhead. A
  separate `APP_ENV` (`development` / `staging` / `production`) drives all
  app-specific lower-environment logic (currently just the pino-pretty
  switch above). Both live in `server/.env` / `.env.example`.

## Timezone

- All DB timestamps are `timestamptz` (`@db.Timestamptz(3)`): real instants,
  no zone ambiguity in storage.
- `APP_TIMEZONE` (default `America/Lima`, in `server/.env`) is the zone of the
  bank emails and their readers. `server/src/common/timezone.util.ts` is the
  only code that knows it; it's used where zone-less text is read (BCP
  parser's "Fecha y hora", `datetime-local` form values) or where local time
  is shown/bucketed (month boundaries, display formatting, dashboard daily
  grouping via `AT TIME ZONE` in SQL). DST-safe, no hardcoded offsets.
- The browser never converts zones: forms send zone-less `YYYY-MM-DDTHH:mm`
  and the server interprets it in `APP_TIMEZONE`.

## Auth implementation

- Session cookie named `session`, httpOnly, `SameSite=Lax`, holding a JWT
  signed with `JWT_SECRET`. Payload is `{ id, role, email }`, 7-day expiry.
  Signing/verifying lives in `server/src/auth/util/jwt.util.ts`.
- `SessionGuard` (protects `/app/*`) and `GuestGuard` (protects `/auth/login`
  from already-logged-in visitors) don't return `false` — they throw
  `RedirectException` (`server/src/auth/redirect/redirect.exception.ts`),
  caught by a global `RedirectExceptionFilter` that does the actual
  `reply.redirect()`. Returning `false` from a guard fights Nest's default
  403 response instead of cleanly redirecting.
- Request validation via DTOs (`server/src/auth/dto/`) with `class-validator`
  decorators + a global `ValidationPipe({ whitelist: true })` — controllers
  stay thin, no manual field checks.
- `server/src/auth/` layout: `dto/`, `guard/`, `redirect/`, `types/`,
  `util/` — new auth code should land in the matching subfolder.
- Webhook auth (separate from session auth above, lives in `server/src/hooks/`
  not `server/src/auth/` since it's webhook-specific): each `User` has a
  `webhookToken` column storing a sha256 hash of an opaque random token
  (`crypto.randomUUID()`), generated once at account creation (CLI/seed
  script) alongside the temp password and printed once — not retrievable
  again. Callers send it as `X-Kwq-Token: <token>`. `WebhookTokenGuard`
  (`server/src/hooks/guard/webhook-token.guard.ts`) hashes the header and
  looks up the user, throwing a plain `401 Unauthorized` on a missing/
  unknown token; no redirect, unlike session auth. Resolved user is attached
  to `request.webhookUser` (distinct from `request.user`, which is
  session-auth only; type lives in `server/src/hooks/types/hooks.types.ts`).
  Applied per-route via `@UseGuards(WebhookTokenGuard)` on `HooksController`.
- Gotchas:
  - Nest's Fastify adapter already registers urlencoded body parsing by
    default — don't add `@fastify/formbody`, it collides
    ("Content type parser already present").
  - `@fastify/cookie`'s own type augmentation (adds `cookies`/`setCookie`/
    `clearCookie` to Fastify's types) doesn't merge in this npm-workspace
    setup — hoisting means it resolves a different copy of `fastify`'s types
    than our code imports. Worked around with a local declaration merge in
    `server/src/auth/types/fastify-request.d.ts` instead of relying on the
    package's own types.

## UI

- **CSS**: Pico.css (slate variant) bundled from npm (`@picocss/pico`, exact
  version) together with our own styles — no CDN. Dark-only — hardcoded
  `data-theme="dark"` on `<html>` (no light/dark toggle, no
  `prefers-color-scheme` fallback).
- **JS**: Alpine.js and Chart.js bundled from npm (exact versions), not CDN.
- **Templates**: full layout wrapper (`views/layout.ejs`) that owns
  `<html>/<head>/<body>` (header/footer; asset tags live in
  `partials/head.ejs`), pulling in each page via a dynamic include —
  `<%- include(page) %>`, where `page` is passed as a render local from the
  controller per request.
- **Nav/footer**: structural chrome only for now (no nav links) — nothing
  else exists to link to yet; add real nav items once a second page lands.
- **Responsive**: pages must render usably on phones. Pico's fluid
  `.container` and form-element sizing handle this without any custom
  media queries — verified overflow-free down to 320px width on the login
  page.
- **File structure**:

  ```
  views/
    layout.ejs          (shell: header/footer, <%- include(page) %>)
    app-layout.ejs      (shell for /app/* pages, includes layout.ejs)
    partials/
      head.ejs           (<head>: title + /assets links, included by layout.ejs)
    pages/
      login.ejs           (page markup only, no <html>/<head> of its own)
  ```

- `login.ejs` moves under `views/pages/` and is stripped down to just the
  form markup, losing its own `<html>/<head>/<body>`.

## Frontend assets

- Source lives in `server/assets/` (outside `src/`, so `nest build` ignores
  it); `server/scripts/build-assets.mjs` (esbuild) bundles it into
  `server/dist/public/`, served by `@fastify/static` at `/assets/`.
  - `assets/css/main.css` imports Pico, then `base`, `components`,
    `responsive`, `polish`, `dashboard` — order matters (`polish.css`
    overrides earlier rules and must stay last).
  - `assets/js/app.js` registers every Alpine component
    (`assets/js/components/*.js`) via `Alpine.data()` before
    `Alpine.start()`. Templates reference them by name:
    `x-data="categoryManager"`. Server data goes in as arguments:
    `x-data="dashboard(<%= JSON.stringify(summaries) %>)"`. Trivial
    one-liner state (`{ open: false }`) stays inline.
    `components/crud-dialog.js` is the shared add/edit/delete dialog logic
    behind `category-manager.js` and `user-manager.js`; new list-page
    dialogs should call `crudDialog({...})` instead of copying it.
  - `assets/js/dashboard.js` is a separate entry (Chart.js + the dashboard
    component), loaded only by `dashboard.ejs` so other pages skip it.
- Templates link files with `<%= asset('app.css') %>`, which yields
  `/assets/app.css?v=<content hash>`. The build writes the hashes to
  `dist/public/manifest.json`; `createAssetUrl`
  (`server/src/common/asset-url.util.ts`) reads it (re-reading when its
  mtime changes) and is set as the `asset` view `defaultContext` helper in
  `main.ts` and `test/bootstrap.ts`. URLs only change when a file's bytes
  do, so a long proxy `expires` on `/assets/` is safe. A missing manifest
  falls back to the plain URL.
- Commands (inside `server/`): `npm run build:assets` (minified, cleans
  `dist/public` first), `npm run build:assets:watch` (unminified +
  sourcemaps), `npm run build` (`rm -rf dist` + `nest build` + assets;
  copy `dist/` to the deploy box). `npm run start:dev` runs the asset
  watcher next to `nest start --watch` — no live reload, refresh manually.
- `nest-cli.json` has `deleteOutDir: false` so Nest doesn't wipe
  `dist/public`; `build` cleans `dist` (and `tsconfig.build.tsbuildinfo`,
  otherwise `tsc` skips emitting) itself.
- `npm run lint` also covers `assets/js` and `scripts/`.

## Deployment (Caddy reverse proxy)

- Nest stays the origin for everything, `/assets/*` included. Caddy only
  adds TLS, compression and browser-cache headers; it does not cache
  responses itself (that needs a plugin).

  ```
  yourdomain.com {
      encode zstd gzip

      @assets path /assets/*
      header @assets >Cache-Control "public, max-age=31536000, immutable"

      reverse_proxy localhost:3000
  }
  ```

  - `>` on the header sets it after the upstream replies, so it overrides
    whatever Nest sent instead of duplicating it.
  - The year-long `immutable` is safe because asset URLs carry a content
    hash (`?v=`, see Frontend assets) that changes with the file's bytes.
- **TLS**: automatic. Using a real domain name as the site address makes
  Caddy obtain a Let's Encrypt (or ZeroSSL) certificate itself, redirect
  HTTP to HTTPS, and renew it in the background (~30 days before expiry) —
  no certbot or cron. Requirements:
  - DNS `A`/`AAAA` record for the domain points at the box.
  - Ports 80 and 443 are open (80 is used for the ACME challenge).
  - Caddy's data dir (`/var/lib/caddy`, or the `/data` volume in Docker)
    is persistent — losing it means re-issuing and risks rate limits.
  - Optional `{ email you@example.com }` global block for expiry notices.
- The `session` cookie is `Secure` outside `APP_ENV=development`, so prod
  must be reached over HTTPS (Caddy does that); plain-HTTP prod logins
  won't stick.

## URL design

Rendering model: GETs are full server-rendered pages (data baked in via EJS,
per the stack decision above); JSON endpoints exist only for mutations
(PATCH/DELETE/POST-that-returns-JSON), called from Alpine. No separate
`/api` layer.

- **Auth**
  - `GET /auth/login` — login form
  - `POST /auth/login` — submit credentials
  - `POST /auth/logout` — clear session
- **Webhook** (per Email ingestion & parsing above)
  - `POST /hooks/email` — per-user email ingestion, authed via `X-Kwq-Token`
    header (see Auth implementation below)
- **App** (session-authed)
  - `GET /` — redirects to `/app/dashboard` if authed, `/auth/login` if not
  - `GET /app/dashboard` — charts/summary
  - `GET /app/transactions` — list. Same keyset pagination/`month` filter as
    `/app/emails`, on `(transactionDate DESC, id DESC)`; shared helpers in
    `server/src/common/pagination.util.ts`. Rows link to their source email.
  - `GET /app/transactions/:id` — detail (links to source email if any) +
    edit/delete dialogs
  - `POST /app/transactions` / `PATCH /app/transactions/:id` /
    `DELETE /app/transactions/:id` — JSON; `PATCH` takes the full body and sets
    `isManuallyCategorized` only when `categoryId` changed
  - `GET /app/categories` — single management page: list + inline
    create/edit/delete
  - `POST /app/categories` / `PATCH /app/categories/:id` /
    `DELETE /app/categories/:id`
  - `GET /app/emails` — read-only list, own rows only. Keyset-paginated on
    `(createdAt DESC, id DESC)`, 20 per page: `?before=<cursor>` (older) /
    `?after=<cursor>` (newer), cursor = `<createdAtMs>_<id>`. Optional
    `?month=YYYY-MM` filter, boundaries in `APP_TIMEZONE` (see Timezone).
  - `GET /app/emails/:id` — metadata + sandboxed-iframe preview of `bodyHtml`
    (falls back to plain `body`); 404 for other users' emails; links to its
    transaction if parsed
- **Admin** (role-guarded, nested under `/app`)
  - `GET /app/admin/users` — single management page: list + inline
    create/edit/delete
  - `POST /app/admin/users` — create; generates a temp password shown once
    on-screen (not retrievable again). Additional tool alongside the CLI
    seed script, not a replacement for it.
  - `PATCH /app/admin/users/:id` — edit (role, deactivate, etc.)
  - `DELETE /app/admin/users/:id` — remove

Conventions: raw UUIDs in paths (matches Prisma PKs), no query-param
filtering on lists for v1 (exception: `/app/emails` cursor + `month`).

## Open follow-ups (not yet decided)

- Invite-link UX details (expiry, password policy) for the CLI/seed script
  path — the web admin creation flow is now decided (see URL design above).
- Webhook endpoint hardening (rate limiting, payload size limits) — not
  discussed, default to sane Nest conventions unless revisited.
