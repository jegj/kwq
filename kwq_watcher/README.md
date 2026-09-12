# KWQ GScript watcher

A small Google Apps Script that watches selected senders in a Gmail inbox and
POSTs each matching message to a webhook. It runs on a time-based trigger,
de-duplicates messages it has already sent, and skips your own replies inside a
watched thread.

This is the `apps/gscript` component of the **kwq** monorepo. It does no parsing
itself — it only forwards raw emails to the webhook server, which is responsible
for extracting and storing anything useful.

## How it works

- A time-driven trigger runs `checkMail()` every few minutes.
- It searches recent mail from the configured senders, POSTs anything new to the
  webhook, and records the message ID so it is never sent twice.
- Sent IDs are stored in Script Properties (a bounded list), not as a Gmail
  label, so replies within an existing thread still fire.

## Prerequisites

- A Google account with the target inbox.
- [Node.js](https://nodejs.org/) 24+ and npm (only needed for the clasp workflow).
- The Apps Script API enabled for your account:
  <https://script.google.com/home/usersettings> → turn **Apps Script API** on.

## Install & deploy with clasp

[`clasp`](https://github.com/google/clasp) is Google's CLI for pushing local
Apps Script code up to a project.

```bash
# 1. Install clasp globally
npm install -g @google/clasp

# 2. Log in (opens a browser for Google auth)
clasp login

# 3. ...or link to an existing script instead of creating one
clasp clone <scriptId>

# 4. Make your changes and push your local files up to the project
clasp push
```

## Configure

Edit the `CONFIG` block in `config.gs`:

```javascript
const CONFIG = {
  senders: ['alerts@yourbank.com'],      // addresses to watch
  webhookUrl: 'https://your-server/hooks/gmail',
  sharedSecret: 'a-long-random-string',  // sent as X-Webhook-Secret
  lookbackWindow: '2d',                  // how far back each run searches
  maxThreads: 25,                        // per-run safety cap
  maxSeenIds: 400,
  bodyCharLimit: 10000,
  pollMinutes: 5,                        // 1, 5, 10, 15 or 30
  dryRun: true,                          // flip to false to actually POST
};
```

## Run

In the Apps Script editor (`clasp open`), run these once, authorizing when
prompted:

1. `markExistingAsSeen()` — marks all current matching mail as already sent, so
   the first real run doesn't POST your whole history.
2. `installTrigger()` — schedules `checkMail()` to run every `pollMinutes`.

## Verify it's running

- **Triggers** panel (alarm-clock icon) → one `checkMail` time-driven row.
- **Executions** panel (clock-with-arrow icon) → a new `checkMail` run appears
  every few minutes. "Every 5 minutes" is best-effort, so 4–7 minute gaps are
  normal.

## License

MIT
