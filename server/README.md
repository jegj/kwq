# kwq webhook server

NestJS service that receives forwarded emails from `kwq_watcher`, parses
them, classifies expenses, and displays them.

## Stack

- **Backend**: NestJS
- **Database**: PostgreSQL + Prisma
- **Views**: server-rendered (Nest + template engine), Alpine.js, Chart.js
- **Hosting**: Railway

## Overview

- Multi-user, invite-only (accounts created via admin CLI/seed script, no email service in v1).
- Auth: email + password, session cookies.
- Each user's `kwq_watcher` instance posts to a per-user tokenized webhook (e.g. `/hooks/gmail/:userToken`).
- Raw email content is stored permanently so parsers can be re-run against history later.
- Parsers are pluggable strategy classes per sender (shared `parse(email): Transaction` interface, registered via Nest DI).
- Classification is rule-based (keyword/merchant matching) with manual override in the UI.
- Transactions are multi-currency (amount + ISO currency code).

See `../specs/webhook-server.md` for the full design notes and open follow-ups.

## Project setup

```bash
npm install
```

## Compile and run the project

```bash
# development
npm run start

# watch mode
npm run start:dev

# production mode
npm run start:prod
```

## Run tests

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# test coverage
npm run test:cov
```

## Lint & format

```bash
npm run lint
npm run format
```
