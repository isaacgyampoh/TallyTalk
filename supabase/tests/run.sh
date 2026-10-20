#!/usr/bin/env bash
# =============================================================================
# Apply the real migrations to a throwaway Postgres cluster and run the
# assertions in supabase/tests/*.test.sql against it.
#
# The cluster is created fresh in a temporary directory, listens on a unix
# socket only, and is removed afterwards — it never touches a Postgres you
# already run, and no test can reach the hosted project.
#
# Usage: npm run test:db  [-- 10_rls]   (optional substring filter)
# =============================================================================
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
filter="${1:-}"

# Find server binaries: PATH first, then a Postgres.app install.
if command -v initdb >/dev/null 2>&1; then
  PGBIN="$(dirname "$(command -v initdb)")"
elif [ -x /Applications/Postgres.app/Contents/Versions/latest/bin/initdb ]; then
  PGBIN=/Applications/Postgres.app/Contents/Versions/latest/bin
else
  echo "No Postgres server binaries found (need initdb, pg_ctl, psql)." >&2
  echo "macOS: install Postgres.app.  Linux: apt-get install postgresql." >&2
  exit 127
fi

work="$(mktemp -d "${TMPDIR:-/tmp}/tasktally-db-XXXXXX")"
data="$work/data"
sock="$work/sock"
log="$work/postgres.log"
mkdir -p "$sock"

cleanup() {
  "$PGBIN/pg_ctl" -D "$data" -s -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

echo "→ creating a throwaway cluster ($("$PGBIN/postgres" --version))"
"$PGBIN/initdb" -D "$data" -U postgres --no-sync -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$data" -l "$log" -o "-k '$sock' -c listen_addresses='' -c fsync=off" -w start >/dev/null
export PGHOST="$sock" PGUSER=postgres PGDATABASE=tasktally_test
"$PGBIN/createdb" tasktally_test

psql_q() { "$PGBIN/psql" -v ON_ERROR_STOP=1 -q --no-psqlrc -c 'set client_min_messages = warning' "$@"; }

echo "→ applying the Supabase shim"
psql_q -f "$here/00_shim.sql" >/dev/null

echo "→ applying migrations"
for m in "$repo"/supabase/migrations/*.sql; do
  echo "   $(basename "$m")"
  psql_q -f "$m" >/dev/null
done

psql_q -f "$here/01_grants.sql" >/dev/null
psql_q -f "$here/02_helpers.sql" >/dev/null

status=0
total=0
for t in "$here"/*.test.sql; do
  name="$(basename "$t")"
  if [ -n "$filter" ] && [[ "$name" != *"$filter"* ]]; then continue; fi
  echo
  echo "→ $name"
  if out="$("$PGBIN/psql" -v ON_ERROR_STOP=1 -q --no-psqlrc -f "$t" 2>&1)"; then
    passed="$(grep -c 'ok — ' <<<"$out" || true)"
    total=$((total + passed))
    grep 'ok — ' <<<"$out" | sed 's/^NOTICE:  /   /'
    echo "   $passed passed"
  else
    grep -E 'ok — |FAIL|ERROR' <<<"$out" | sed 's/^NOTICE:  /   /' | tail -25
    status=1
  fi
done

echo
if [ "$status" -eq 0 ]; then
  echo "✓ $total database assertions passed against PostgreSQL $("$PGBIN/postgres" --version | awk '{print $3}')"
else
  echo "✗ database assertions failed"
fi
exit "$status"
