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

- **CSS**: Pico.css, slate color-theme variant, loaded via version-pinned CDN
  `<link>`. Dark-only — hardcoded `data-theme="dark"` on `<html>` (no
  light/dark toggle, no `prefers-color-scheme` fallback).
- **JS**: Alpine.js, loaded via version-pinned CDN `<script>`. No bundler/npm
  package — matches the CSS's zero-build-step approach.
- **Templates**: full layout wrapper (`views/layout.ejs`) that owns
  `<html>/<head>/<body>` (Pico + Alpine CDN tags, structural header/footer),
  pulling in each page via a dynamic include — `<%- include(page) %>`, where
  `page` is passed as a render local from the controller per request.
- **Nav/footer**: structural chrome only for now (no nav links) — nothing
  else exists to link to yet; add real nav items once a second page lands.
- **Responsive**: pages must render usably on phones. Pico's fluid
  `.container` and form-element sizing handle this without any custom
  media queries — verified overflow-free down to 320px width on the login
  page.
- **File structure**:

  ```
  views/
    layout.ejs          (shell: CDN tags, header/footer, <%- include(page) %>)
    app-layout.ejs      (shell for /app/* pages, includes layout.ejs)
    partials/
      head.ejs           (<head> contents, included by layout.ejs)
    pages/
      login.ejs           (page markup only, no <html>/<head> of its own)
  ```

- `login.ejs` moves under `views/pages/` and is stripped down to just the
  form markup, losing its own `<html>/<head>/<body>`.

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

- `kwq_watcher` needs to change from a single global `sharedSecret`/
  `webhookUrl` to sending the per-user `X-Kwq-Token` header (see Auth
  implementation above) once accounts exist.
- Invite-link UX details (expiry, password policy) for the CLI/seed script
  path — the web admin creation flow is now decided (see URL design above).
- Webhook endpoint hardening (rate limiting, payload size limits) — not
  discussed, default to sane Nest conventions unless revisited.
