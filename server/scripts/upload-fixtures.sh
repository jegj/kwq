#!/usr/bin/env bash
# Posts every bank's fixtures to the dev webhook.
# Usage: KWQ_TOKEN=<webhook token> [KWQ_URL=http://localhost:3000] scripts/upload-fixtures.sh
set -euo pipefail

: "${KWQ_TOKEN:?Set KWQ_TOKEN to your webhook token (Settings page)}"
url="${KWQ_URL:-http://localhost:3000}/hooks/email"
dir="$(dirname "$0")/../src/hooks/parser"

for file in "$dir"/*/__fixtures__/*.json; do
  status=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$url" \
    -H 'Content-Type: application/json' \
    -H "X-Kwq-Token: $KWQ_TOKEN" \
    --data-binary "@$file")
  echo "$status $(basename "$(dirname "$(dirname "$file")")")/$(basename "$file")"
done
