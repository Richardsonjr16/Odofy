#!/usr/bin/env bash
# Deploy/update the Odofy backend service on Render via the Render API.
#
# Usage:
#   scripts/deploy-render.sh [RENDER_API_KEY] [ENV_FILE]
#
#   RENDER_API_KEY  Render API key (https://dashboard.render.com/api-keys).
#                   Also read from $RENDER_API_KEY when the arg is omitted.
#   ENV_FILE        Path to a dotenv-style file (default: ./env) holding the
#                   backend env values, one KEY=VALUE per line. PORT and
#                   comment/blank lines are skipped. Values are NEVER printed.
#
# Behavior:
#   - If service "odofy-backend" already exists, its env vars are upserted
#     (PATCH per var; Render redeploys automatically on change).
#   - If it does not exist, the service is created from the connected GitHub
#     repo (Richardsonjr16/Odofy) with the same settings as render.yaml. The
#     repo must already be connected to the Render account; otherwise the
#     script prints dashboard instructions and exits non-zero.
#   - On success the live service URL is printed as the FINAL line:
#       RENDER_URL=https://odofy-backend.onrender.com
#     Paste that URL into Vercel as the BACKEND_URL environment variable.
#
# Requires: curl, jq
set -euo pipefail

API_BASE="https://api.render.com/v1"
SERVICE_NAME="odofy-backend"
REPO="Richardsonjr16/Odofy"

RENDER_API_KEY="${RENDER_API_KEY:-${1:-}}"
ENV_FILE="${2:-./env}"

die() { echo "error: $*" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || die "curl is required"
command -v jq >/dev/null 2>&1 || die "jq is required"

[ -n "$RENDER_API_KEY" ] || die "RENDER_API_KEY is required (set the env var or pass it as the first argument)"
[ -f "$ENV_FILE" ] || die "env file not found: $ENV_FILE (pass the path as the second argument)"

# --- Parse the env file: KEY=VALUE lines; skip PORT, comments, and blanks.
env_pairs=()
while IFS= read -r line || [ -n "$line" ]; do
  trimmed="${line#"${line%%[![:space:]]*}"}"
  case "$trimmed" in
    '' | '#'*) continue ;;
  esac
  key="${trimmed%%=*}"
  value="${trimmed#*=}"
  [ "$key" = "PORT" ] && continue
  case "$key" in
    '' | *[!A-Za-z0-9_]*) continue ;; # only sane env var names
  esac
  env_pairs+=("$key" "$value")
done < "$ENV_FILE"

[ "${#env_pairs[@]}" -gt 0 ] || die "no usable KEY=VALUE lines found in $ENV_FILE"

# --- HTTP helper. Sets HTTP_STATUS (status code) and HTTP_BODY (response body).
http_request() {
  local method="$1" url="$2" data="${3:-}"
  local args=(-sS -X "$method" -H "Authorization: Bearer ${RENDER_API_KEY}" -H "Content-Type: application/json")
  [ -n "$data" ] && args+=(-d "$data")
  HTTP_BODY="$(curl "${args[@]}" -w $'\n%{http_code}' "$url")"
  HTTP_STATUS="$(printf '%s' "$HTTP_BODY" | tail -n1)"
  HTTP_BODY="$(printf '%s' "$HTTP_BODY" | sed '$d')"
}

# Build the envVars JSON array from parsed pairs (values JSON-escaped by jq).
env_vars_json="$(jq -nc --args '$ARGS.positional | [range(0; length; 2) as $i | {key: .[$i], value: .[$i+1]}]' "${env_pairs[@]}")"

# --- Step 1: does the service already exist?
http_request GET "${API_BASE}/services?name=${SERVICE_NAME}"
if [ "$HTTP_STATUS" != "200" ]; then
  die "failed to list Render services (HTTP $HTTP_STATUS): $(printf '%s' "$HTTP_BODY" | head -c 400) — check RENDER_API_KEY"
fi
SERVICE_ID="$(printf '%s' "$HTTP_BODY" | jq -r 'if type == "array" and length > 0 then .[0].id else empty end')"

if [ -n "$SERVICE_ID" ]; then
  echo ">> Service '${SERVICE_NAME}' already exists (id ${SERVICE_ID}); updating env vars..."
  for ((i = 0; i < ${#env_pairs[@]}; i += 2)); do
    key="${env_pairs[$i]}"
    value="${env_pairs[$((i + 1))]}"
    payload="$(jq -nc --arg v "$value" '{value: $v}')"
    http_request PATCH "${API_BASE}/services/${SERVICE_ID}/env-vars/${key}" "$payload"
    if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
      echo "  ok   ${key}"
    else
      echo "  FAIL ${key} (HTTP ${HTTP_STATUS}): $(printf '%s' "$HTTP_BODY" | head -c 300)" >&2
      exit 1
    fi
  done
  echo ">> Env vars updated — Render redeploys automatically."
else
  echo ">> Service '${SERVICE_NAME}' not found; creating from ${REPO}..."
  create_payload="$(jq -nc \
    --arg name "$SERVICE_NAME" \
    --arg repo "$REPO" \
    --argjson envVars "$env_vars_json" \
    '{type: "web", name: $name, env: "bun", plan: "free", region: "oregon", branch: "main", autoDeploy: true, buildCommand: "bun install", startCommand: "bun run src/-server.js", healthCheckPath: "/health", repo: $repo, envVars: $envVars}')"
  http_request POST "${API_BASE}/services" "$create_payload"
  if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
    SERVICE_ID="$(printf '%s' "$HTTP_BODY" | jq -r '.id // empty')"
    echo ">> Created service '${SERVICE_NAME}' (id ${SERVICE_ID}); first deploy is running."
  else
    err="$(printf '%s' "$HTTP_BODY" | jq -r '.message // .error // .' 2>/dev/null | head -c 500)"
    echo "!! Render API create failed (HTTP ${HTTP_STATUS}): ${err:-unknown}" >&2
    case "${err:-}" in
      *[Rr]epo* | *[Cc]onnect* | *[Nn]ot* | *[Ff]ound* | *404*)
        cat >&2 <<'MSG'

The GitHub repo must be connected to your Render account before the API can
create the service from it. Please create the service via the Render dashboard:
  1. Dashboard -> New -> Blueprint -> select this repo (render.yaml), OR
     New -> Web Service -> repo Richardsonjr16/Odofy.
  2. Name: odofy-backend | Runtime: Bun | Branch: main | Region: Oregon
     Build: bun install | Start: bun run src/-server.js | Health path: /health
  3. Paste the env vars from your .env file (see render.yaml for the names).
  4. After the deploy finishes, copy the service URL
     (https://odofy-backend.onrender.com) and re-run this script to sync env
     vars, or paste it into Vercel directly as BACKEND_URL.
MSG
        exit 1
        ;;
      *) die "create failed; fix the error above and re-run." ;;
    esac
  fi
fi

# --- Step 2: fetch the live service URL.
[ -n "$SERVICE_ID" ] || die "no service id; cannot resolve URL"
http_request GET "${API_BASE}/services/${SERVICE_ID}"
if [ "$HTTP_STATUS" != "200" ]; then
  die "failed to fetch service details (HTTP ${HTTP_STATUS})"
fi
SERVICE_URL="$(printf '%s' "$HTTP_BODY" | jq -r '.serviceDetails.serviceUrl // empty')"
[ -n "$SERVICE_URL" ] || die "could not determine the service URL for '${SERVICE_NAME}'"

echo ">> Done. Paste the URL below into Vercel as BACKEND_URL."
echo "RENDER_URL=${SERVICE_URL}"
