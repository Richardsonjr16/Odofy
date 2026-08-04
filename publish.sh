#!/usr/bin/env bash
# Rebuild the site and (re)start the production server on port 3000.
# Build runs in the foreground so errors surface; the server is launched in a new
# session (setsid) so it keeps running after this script — and your shell — exits.
set -euo pipefail
cd "$(dirname "$0")"

# Group-writable so any team member can publish over another member's build.
umask 002
mkdir -p .run

# ── Express backend (port 3001) — start it BEFORE the frontend, since the site
# proxies every /api/* request to it and would otherwise serve 503s.

# Free port 3001 across user boundaries.
for _ in $(seq 1 25); do
  pids=$(sudo lsof -t -iTCP:3001 -sTCP:LISTEN 2>/dev/null || true)
  if [ -z "$pids" ]; then break; fi
  sudo kill $pids 2>/dev/null || true
  sleep 0.2
done

# Install backend deps (in case they're missing) and start the backend detached.
# The backend must be run from its own directory (code uses relative paths) and
# with `bun` (it uses CommonJS require() while package.json is "type": "module").
(
  cd /home/team/shared/odofy-backend
  mkdir -p .run
  bun install
  setsid nohup bun run src/-server.js > .run/backend.log 2>&1 < /dev/null &
)

# Wait for the backend to actually answer before starting the frontend.
backend_up=""
for _ in $(seq 1 50); do
  if curl -sf -o /dev/null http://localhost:3001/; then
    backend_up=1
    break
  fi
  sleep 0.2
done
if [ -z "$backend_up" ]; then
  echo "warning: backend isn't responding on port 3001 — check odofy-backend/.run/backend.log" >&2
  exit 1
fi
echo "backend up on port 3001"

# Free port 3000 across user boundaries.
for _ in $(seq 1 25); do
  pids=$(sudo lsof -t -iTCP:3000 -sTCP:LISTEN 2>/dev/null || true)
  if [ -z "$pids" ]; then break; fi
  sudo kill $pids 2>/dev/null || true
  sleep 0.2
done

# Install deps and build.
bun install
bun run build

# Start the server detached.
setsid nohup bun run start > .run/server.log 2>&1 < /dev/null &

# Wait for the new server to actually answer before reporting success.
for _ in $(seq 1 50); do
  if curl -sf -o /dev/null http://localhost:3000; then
    echo "site published; serving on port 3000"
    exit 0
  fi
  sleep 0.2
done
echo "warning: published, but the server isn't responding — check .run/server.log" >&2
exit 1
