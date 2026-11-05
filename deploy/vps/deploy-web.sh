#!/usr/bin/env bash
# Build a branch of vgmfredevelopment on the VPS and deploy it to staging and/or demo.
#   curl -fsSL https://raw.githubusercontent.com/vdgogatememorialfoundation/vgmfredevelopment/<branch>/deploy/vps/deploy-web.sh | bash -s -- <branch> [staging] [demo]
# The running app dir is kept as apps/<env>.prev-<stamp> and the data dir is archived under backups/; a failed health check rolls back.
set -euo pipefail

BRANCH="${1:-cursor/delivery-status-9792}"
[ $# -gt 0 ] && shift
if [ $# -gt 0 ]; then ENVS=("$@"); else ENVS=(staging demo); fi

ROOT="${VGMF_ROOT:-/VGMF-PLATFORM}"
REPO="https://github.com/vdgogatememorialfoundation/vgmfredevelopment.git"
SRC="$ROOT/src/vgmfredevelopment"
STAMP="$(date +%Y%m%d-%H%M%S)"
BK="$ROOT/backups/web-$STAMP"
mkdir -p "$BK" "$ROOT/src" "$ROOT/apps"
exec > >(tee -a "$BK/deploy.log") 2>&1

say() { printf '\n==> %s\n' "$*"; }
port_of() { case "$1" in staging) echo 3005 ;; demo) echo 3012 ;; *) echo "Unknown env $1" >&2; exit 1 ;; esac; }

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
[ "$NODE_MAJOR" -ge 20 ] || { echo "Node 20+ is required (found $(node -v 2>/dev/null || echo none))."; exit 1; }

say "Fetching $BRANCH"
if [ -d "$SRC/.git" ]; then
  git -C "$SRC" fetch --depth 1 origin "$BRANCH"
  git -C "$SRC" checkout -q -B deploy FETCH_HEAD
else
  git clone -q --depth 1 --branch "$BRANCH" "$REPO" "$SRC"
fi
COMMIT="$(git -C "$SRC" log -1 --format='%h %s')"
echo "Commit: $COMMIT"

cd "$SRC"
say "Installing dependencies"
npm ci --no-audit --no-fund

restart() {
  local env="$1"
  [ "${SKIP_PM2:-}" = 1 ] && return 0
  if [ -f "$ROOT/ecosystem.config.cjs" ]; then
    pm2 startOrReload "$ROOT/ecosystem.config.cjs" --only "vgmf-$env" --update-env
  else
    pm2 restart "vgmf-$env" --update-env
  fi
}

for ENV in "${ENVS[@]}"; do
  PORT="$(port_of "$ENV")"
  APP="$ROOT/apps/$ENV"
  ENVFILE="$ROOT/secrets/$ENV.env"

  say "[$ENV] Backing up data"
  [ -d "$ROOT/data/$ENV" ] && tar -C "$ROOT/data" -czf "$BK/data-$ENV.tgz" "$ENV"
  [ -f "$APP/.next/BUILD_ID" ] && echo "Previous build: $(cat "$APP/.next/BUILD_ID")"

  say "[$ENV] Building"
  (
    export VGMF_ENV="$ENV" NEXT_PUBLIC_VGMF_ENV="$ENV" NEXT_PUBLIC_SITE_URL="https://$ENV.vaidyagogate.org"
    if [ -f "$ENVFILE" ]; then
      while IFS= read -r line; do
        case "$line" in NEXT_PUBLIC_*=*|VGMF_ENV=*) export "${line%%=*}=${line#*=}" ;; esac
      done < "$ENVFILE"
    fi
    rm -rf .next
    NODE_OPTIONS=--max-old-space-size=4096 NEXT_TELEMETRY_DISABLED=1 npx next build
  )

  SERVER_JS="$(find .next/standalone -maxdepth 4 -name server.js -not -path '*/node_modules/*' | head -1)"
  [ -n "$SERVER_JS" ] || { echo "No standalone server.js after build."; exit 1; }
  OUT_SRC="$(dirname "$SERVER_JS")"
  NEW="$ROOT/apps/$ENV.new"
  rm -rf "$NEW"
  cp -a "$OUT_SRC" "$NEW"
  [ "$OUT_SRC" = ".next/standalone" ] || cp -a .next/standalone/node_modules "$NEW/" 2>/dev/null || true
  mkdir -p "$NEW/.next"
  cp -a .next/static "$NEW/.next/static"
  cp -a public "$NEW/public"
  if [ -d "$APP" ]; then
    for keep in .env .env.local .env.production data; do
      [ -e "$APP/$keep" ] && [ ! -e "$NEW/$keep" ] && cp -a "$APP/$keep" "$NEW/$keep"
    done
  fi

  say "[$ENV] Switching to the new build"
  PREV=""
  if [ -d "$APP" ]; then PREV="$APP.prev-$STAMP"; mv "$APP" "$PREV"; fi
  mv "$NEW" "$APP"
  restart "$ENV"

  if [ "${SKIP_PM2:-}" != 1 ]; then
    ok=0
    for _ in $(seq 1 30); do
      code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/" || true)"
      [ "$code" = 200 ] && { ok=1; break; }
      sleep 2
    done
    if [ "$ok" != 1 ]; then
      echo "[$ENV] Home page did not return 200 (last: $code). Rolling back."
      rm -rf "$APP"
      [ -n "$PREV" ] && mv "$PREV" "$APP"
      restart "$ENV"
      exit 1
    fi
    for path in / /support /admin /admin/articles/approvals /articles /account/orders; do
      printf '[%s] %-28s %s\n' "$ENV" "$path" "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT$path")"
    done
  fi
  echo "[$ENV] Live build: $(cat "$APP/.next/BUILD_ID") ($COMMIT). Rollback copy: ${PREV:-none}"
done

[ "${SKIP_PM2:-}" = 1 ] || pm2 save >/dev/null

say "Who serves vaidyagogate.org (not changed by this script)"
nginx -T 2>/dev/null | awk '/server_name[^;]*[ \t]vaidyagogate\.org[ ;]/{f=1} f&&/(proxy_pass|root) /{print; n++} n>=2{exit}' || true

say "Done. Log: $BK/deploy.log"
