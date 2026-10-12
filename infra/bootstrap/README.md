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

## Database roles and migrations

No role has a password: everything connects over the Unix socket (`/var/run/postgresql`) with peer auth.

| Role | Used by | Can do |
| --- | --- | --- |
| `postgres` | admin | everything (`sudo -u postgres psql`) |
| `kwq_migrator` (`kwq_db_migrator_user`) | you, deploying | owns the `kwq` database, DDL (create/alter tables) |
| `kwq` (`kwq_db_user`) | the app (`kwq.service`) | `SELECT/INSERT/UPDATE/DELETE` on tables the migrator creates |

Run as the migrator (your admin user, e.g. `linuxuser`, is mapped to `kwq_migrator` via `pg_ident`, only for the `kwq` database):

```
psql -U kwq_migrator -d kwq                  # interactive shell
DATABASE_URL="postgresql://kwq_migrator@/kwq?host=/var/run/postgresql&schema=public" \
  npx prisma migrate deploy                  # from /opt/kwq/server
```

- Always run migrations as `kwq_migrator`, never as `kwq`: the app role can't create tables, and tables created by another role aren't covered by the app's default privileges.
- The app keeps using `kwq` (its `DATABASE_URL` is in `/etc/kwq/kwq.env`).
- The mapping applies to the user in `inventory.ini` (`ansible_user`). Other OS users can't act as the migrator.
- Check the setup: `psql -U kwq_migrator -d kwq -c '\conninfo'` should connect without a password prompt, and `psql -U kwq_migrator -d postgres` should be refused.
- Unverified: whether Prisma's migrate CLI accepts the `host=` socket URL. Test it on the first deploy.

## After provisioning

- `kwq.service` is enabled but not started. Deploy `dist/` to `/opt/kwq` (see the root `CLAUDE.md`), then `sudo systemctl start kwq`.
- Automatic reboot after updates runs at 04:00 America/Lima (09:00 UTC).
- Node, Postgres and Caddy come from third-party repos, so unattended-upgrades does not patch them automatically.
