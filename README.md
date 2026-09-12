# kwq

kwq (Qhawaq) is a Peruvian bank spending analyzer: it watches your gmail(for now)
email for bank notifications via a Google Apps Script, forwards matching
messages to a backend, and records them for analysis.

## Repo layout

- [`kwq_watcher/`](kwq_watcher/README.md) — the Google Apps Script that watches
  Gmail for bank notification emails and POSTs them to a webhook. See its
  README for setup, configuration, and deployment with `clasp`.
- `server/` — backend that will receive the forwarded emails, parse them with
  per-sender parsers, and store the extracted transactions. Not built yet.

## License

MIT
