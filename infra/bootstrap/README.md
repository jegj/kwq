# Bootstrap (Ansible)

Provisions and hardens the kwq box (Ubuntu 26.04 LTS on Vultr). All playbooks are idempotent: safe to re-run.

## Playbooks

- `provision.yml`: SSH hardening, ufw, fail2ban, sysctl, chrony, AppArmor, unattended-upgrades, swap, journald cap. Installs Node, PostgreSQL and Caddy packages only.
- `postgres.yml`: tunes and binds PostgreSQL to localhost, creates the `kwq_migrator` (owns the DB, DDL) and `kwq` (app, DML only) roles, both without passwords, and the database. The app connects over the Unix socket with peer auth.
- `app.yml`: `kwq` service user, `/opt/kwq`, `/etc/kwq/kwq.env`, systemd unit.
- `caddy.yml`: Caddyfile (reverse proxy + TLS).

## Prerequisites

- Ansible >= 2.15 on your machine (needs `deb822_repository`).
- Box: Ubuntu 26.04, with `linuxuser` already holding your public key in `~/.ssh/authorized_keys` and sudo. The playbook refuses to disable password login otherwise.
- Collections: `ansible-galaxy collection install -r requirements.yml`
- Inventory: `cp inventory.example.ini inventory.ini`, then set the box IP and your private key path. `inventory.ini` is gitignored.
- Secrets (`app.yml` only): `cp secrets.example.yml secrets.yml`, set the JWT secret (`openssl rand -hex 32`), then `ansible-vault encrypt secrets.yml`.
- `vars.yml`: set `kwq_domain`. DNS A/AAAA must point at the box before running `caddy.yml`, or TLS won't issue.

## Run

From `infra/bootstrap/`, in this order:

```
ansible-playbook provision.yml
ansible-playbook postgres.yml
ansible-playbook app.yml --ask-vault-pass
ansible-playbook caddy.yml
```

- Dry run: add `--check`. A first `--check` can fail on tasks that need packages not installed yet.
- Subset: add `--tags ssh|firewall|fail2ban|upgrades|base|app|caddy`.
- Lint: `./lint.sh` (needs `ansible-lint`)

## After provisioning

- `kwq.service` is enabled but not started. Deploy `dist/` to `/opt/kwq` (see the root `CLAUDE.md`), then `sudo systemctl start kwq`.
- Run migrations as the migrator role (the admin user is mapped to it, no password): `DATABASE_URL="postgresql://kwq_migrator@/kwq?host=/var/run/postgresql&schema=public" npx prisma migrate deploy`. The app itself runs as the `kwq` role (data access only).
- Automatic reboot after updates runs at 04:00 America/Lima (09:00 UTC).
- Node, Postgres and Caddy come from third-party repos, so unattended-upgrades does not patch them automatically.
