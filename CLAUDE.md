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
- **Hosting**: Railway (managed Postgres + git-push deploys).

## Email ingestion & parsing

- Webhook receives per-user tokenized requests (e.g.
  `/hooks/gmail/:userToken`) from each user's own `kwq_watcher` gscript
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
    support — Railway also has a PG18 template, so dev/prod match.
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
- **Logging**: `nestjs-pino` (`nestjs-pino` + `pino` + `pino-http`), with
  `pino-pretty` as a dev dependency only.
  - `LoggerModule.forRoot()` in `AppModule`: `pino-pretty` transport (colored,
    single-line) when `APP_ENV !== 'production'`; raw structured JSON
    otherwise, for Railway/log aggregators. Level from `LOG_LEVEL` env var,
    defaulting to `debug` in dev / `info` in prod.
  - `main.ts` calls `app.useLogger(app.get(Logger))` with `bufferLogs: true`
    so Nest's own bootstrap logs go through pino too, not just app logs.
- **`NODE_ENV` vs `APP_ENV`**: `NODE_ENV` is always `production` in every
  environment (local, staging, Railway) — nested packages (Nest, Fastify,
  etc.) get their production-optimized codepaths, no dev-mode overhead. A
  separate `APP_ENV` (`development` / `staging` / `production`) drives all
  app-specific lower-environment logic (currently just the pino-pretty
  switch above). Both live in `server/.env` / `.env.example`.

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
- **Webhook** (unchanged, per Email ingestion & parsing above)
  - `POST /hooks/gmail/:userToken` — per-user email ingestion
- **App** (session-authed)
  - `GET /` — redirects to `/app/dashboard` if authed, `/auth/login` if not
  - `GET /app/dashboard` — charts/summary
  - `GET /app/transactions` — list
  - `GET /app/transactions/:id` — detail + category-override control
  - `PATCH /app/transactions/:id` — update category
  - `GET /app/categories` — single management page: list + inline
    create/edit/delete
  - `POST /app/categories` / `PATCH /app/categories/:id` /
    `DELETE /app/categories/:id`
  - `GET /app/emails` — reserved, list only for now (no filter/detail yet)
- **Admin** (role-guarded, nested under `/app`)
  - `GET /app/admin/users` — single management page: list + inline
    create/edit/delete
  - `POST /app/admin/users` — create; generates a temp password shown once
    on-screen (not retrievable again). Additional tool alongside the CLI
    seed script, not a replacement for it.
  - `PATCH /app/admin/users/:id` — edit (role, deactivate, etc.)
  - `DELETE /app/admin/users/:id` — remove

Conventions: raw UUIDs in paths (matches Prisma PKs), no query-param
filtering on lists for v1.

## Open follow-ups (not yet decided)

- `kwq_watcher` needs to change from a single global `sharedSecret`/
  `webhookUrl` to a per-user token/URL once accounts exist.
- Invite-link UX details (expiry, password policy) for the CLI/seed script
  path — the web admin creation flow is now decided (see URL design above).
- Webhook endpoint hardening (rate limiting, payload size limits) — not
  discussed, default to sane Nest/Railway conventions unless revisited.
