# Bootstrap (Ansible)

Provisions and hardens the kwq box (Ubuntu 26.04 LTS on Vultr). All playbooks are idempotent: safe to re-run.

## Playbooks

- `provision.yml`: SSH hardening, ufw, fail2ban, sysctl, chrony, AppArmor, unattended-upgrades, swap, journald cap. Installs Node, PostgreSQL and Caddy packages only.
- `postgres.yml`: binds PostgreSQL to localhost, creates the `kwq` role and database.
- `app.yml`: `kwq` service user, `/opt/kwq`, `/etc/kwq/kwq.env`, systemd unit.
- `caddy.yml`: Caddyfile (reverse proxy + TLS).

## Prerequisites

- Ansible >= 2.15 on your machine (needs `deb822_repository`).
- Box: Ubuntu 26.04, with `linuxuser` already holding your public key in `~/.ssh/authorized_keys` and sudo. The playbook refuses to disable password login otherwise.
- Collections: `ansible-galaxy collection install -r requirements.yml`
- Inventory: `cp inventory.example.ini inventory.ini`, then set the box IP and your private key path. `inventory.ini` is gitignored.
- Secrets (`postgres.yml` and `app.yml` only):
  - `cp secrets.example.yml secrets.yml`, fill it in, then `ansible-vault encrypt secrets.yml`.
  - Use alphanumeric/hex values only (the DB password goes into `DATABASE_URL` unescaped).
  - `openssl rand -hex 24` for the DB password, `openssl rand -hex 32` for the JWT secret.
- `vars.yml`: set `kwq_domain`. DNS A/AAAA must point at the box before running `caddy.yml`, or TLS won't issue.

## Run

From `infra/bootstrap/`, in this order:

```
ansible-playbook provision.yml
ansible-playbook postgres.yml --ask-vault-pass
ansible-playbook app.yml --ask-vault-pass
ansible-playbook caddy.yml
```

- Dry run: add `--check`. A first `--check` can fail on tasks that need packages not installed yet.
- Subset: add `--tags ssh|firewall|fail2ban|upgrades|base|app|caddy`.
- Lint: `ansible-lint provision.yml postgres.yml app.yml caddy.yml`

## After provisioning

- `kwq.service` is enabled but not started. Deploy `dist/` to `/opt/kwq` (see the root `CLAUDE.md`), then `sudo systemctl start kwq`.
- Automatic reboot after updates runs at 04:00 America/Lima (09:00 UTC).
- Node, Postgres and Caddy come from third-party repos, so unattended-upgrades does not patch them automatically.
