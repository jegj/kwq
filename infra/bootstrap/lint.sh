#!/usr/bin/env bash
# Lint all bootstrap playbooks (run from anywhere). app.yml loads the vault-encrypted
# secrets.yml, so the vault password is needed: set ANSIBLE_VAULT_PASSWORD_FILE or get prompted.
set -euo pipefail
cd "$(dirname "$0")"

if [[ -z "${ANSIBLE_VAULT_PASSWORD_FILE:-}" ]] && head -c 14 secrets.yml 2>/dev/null | grep -q '^\$ANSIBLE_VAULT'; then
  read -rsp "Vault password: " vault_password && echo
  vault_password_file=$(mktemp)
  trap 'rm -f "$vault_password_file"' EXIT
  printf '%s' "$vault_password" > "$vault_password_file"
  export ANSIBLE_VAULT_PASSWORD_FILE="$vault_password_file"
fi

ansible-lint provision.yml postgres.yml app.yml caddy.yml
