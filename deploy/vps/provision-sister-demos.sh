#!/usr/bin/env bash
# Clone live fellowship + autism into demo hosts on this VPS.
# Run as root on srv1787209.hstgr.cloud. Does not print secrets.
set -euo pipefail

ROOT=/VGMF-PLATFORM
PGHOST=127.0.0.1
PGUSER=postgres
export PGHOST PGUSER
export PGPASSWORD="${PGPASSWORD:-}"

FELLOW_SRC=/var/www/vgmf-fellowship
FELLOW_DST=/var/www/demo.fellowship.vaidyagogate.org
AUTISM_SRC=/var/www/vaidyagogate-autism
AUTISM_DST=/var/www/demo.autism.vaidyagogate.org
FELLOW_HOST=demo.fellowship.vaidyagogate.org
AUTISM_HOST=demo.autism.vaidyagogate.org
FELLOW_PORT=3013
AUTISM_PORT=3014
FELLOW_DB=vgmf_demo_fellowship
AUTISM_DB=vgmf_demo_autism
SSL_EMAIL=admin@vaidyagogate.org
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"

log() { printf '[sister-demo] %s\n' "$*"; }

require_dir() {
  local path="$1"
  if [[ ! -d "$path" ]]; then
    echo "missing $path" >&2
    exit 1
  fi
}

require_dir "$FELLOW_SRC"
require_dir "$AUTISM_SRC"

mkdir -p "$ROOT/postgres/demo/fellowship" "$ROOT/postgres/demo/autism" "$ROOT/secrets" /var/www/html
chown postgres:postgres "$ROOT/postgres/demo/fellowship" "$ROOT/postgres/demo/autism"
chmod 700 "$ROOT/postgres/demo/fellowship" "$ROOT/postgres/demo/autism"

ensure_tablespace() {
  local name="$1"
  local loc="$2"
  local owner="$3"
  local exists
  exists="$(psql -tAc "SELECT 1 FROM pg_tablespace WHERE spcname = '${name}'")"
  if [[ "$exists" != "1" ]]; then
    psql -v ON_ERROR_STOP=1 -c "CREATE TABLESPACE ${name} OWNER ${owner} LOCATION '${loc}';"
  fi
}

ensure_db() {
  local name="$1"
  local ts="$2"
  local owner="$3"
  local exists
  exists="$(psql -tAc "SELECT 1 FROM pg_database WHERE datname = '${name}'")"
  if [[ "$exists" != "1" ]]; then
    psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${name} OWNER ${owner} TABLESPACE ${ts};"
  fi
  psql -v ON_ERROR_STOP=1 -c "GRANT ALL PRIVILEGES ON DATABASE ${name} TO ${owner};"
}

log "creating tablespaces and empty databases"
ensure_tablespace vgmf_demo_fellowship "$ROOT/postgres/demo/fellowship" vgmf_user
ensure_tablespace vgmf_demo_autism "$ROOT/postgres/demo/autism" autism_user
ensure_db "$FELLOW_DB" vgmf_demo_fellowship vgmf_user
ensure_db "$AUTISM_DB" vgmf_demo_autism autism_user

DUMP_DIR="$(mktemp -d /tmp/vgmf-sister-dump.XXXXXX)"
cleanup() { rm -rf "$DUMP_DIR"; }
trap cleanup EXIT

log "dumping live databases (no owners, restore into demo DBs)"
pg_dump -h 127.0.0.1 -U postgres --no-owner --no-acl -Fc -f "$DUMP_DIR/fellowship.dump" vgmf_fellowship
pg_dump -h 127.0.0.1 -U postgres --no-owner --no-acl -Fc -f "$DUMP_DIR/autism.dump" autism_portal

log "restoring into demo databases"
# Drop cloned objects first so re-runs replace data instead of colliding.
psql -v ON_ERROR_STOP=1 -d "$FELLOW_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO vgmf_user; GRANT ALL ON SCHEMA public TO public;"
psql -v ON_ERROR_STOP=1 -d "$AUTISM_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO autism_user; GRANT ALL ON SCHEMA public TO public;"
restore_ok() {
  local db="$1"
  local dump="$2"
  local role="$3"
  local rc=0
  pg_restore -h 127.0.0.1 -U postgres --no-owner --no-acl --role="$role" -d "$db" "$dump" || rc=$?
  if [[ "$rc" -gt 1 ]]; then
    echo "pg_restore failed for $db (exit $rc)" >&2
    exit "$rc"
  fi
}
restore_ok "$FELLOW_DB" "$DUMP_DIR/fellowship.dump" vgmf_user
restore_ok "$AUTISM_DB" "$DUMP_DIR/autism.dump" autism_user
psql -v ON_ERROR_STOP=1 -d "$FELLOW_DB" -c "GRANT ALL ON SCHEMA public TO vgmf_user; ALTER SCHEMA public OWNER TO vgmf_user;"
psql -v ON_ERROR_STOP=1 -d "$AUTISM_DB" -c "GRANT ALL ON SCHEMA public TO autism_user; ALTER SCHEMA public OWNER TO autism_user;"

log "cloning application trees"
rsync -a --delete \
  --exclude '.env' --exclude '.env.production' --exclude '.env.local' \
  --exclude '.next' --exclude '.git' \
  "$FELLOW_SRC/" "$FELLOW_DST/"
rsync -a --delete \
  --exclude '.env' --exclude '.env.production' --exclude '.env.local' \
  --exclude '.git' \
  "$AUTISM_SRC/" "$AUTISM_DST/"

python3 - <<'PY'
from pathlib import Path
import re

def parse_env(path):
    data = {}
    text = Path(path).read_text()
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        data[key.strip()] = value
    return data

def quote(value):
    return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"').replace("$", "\\$").replace("`", "\\`") + '"'

def write_env(path, rows):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    body = "".join(f"{k}={quote(v)}\n" for k, v in rows)
    path.write_text(body)
    path.chmod(0o600)

fellow_src = parse_env("/var/www/vgmf-fellowship/.env.production")
autism_src = parse_env("/var/www/vaidyagogate-autism/.env")

def swap_db(url, new_db):
    return re.sub(r"/[^/?]+(\?.*)?$", "/" + new_db + r"\1", url)

fellow_rows = []
for key in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_ENDPOINT"):
    if key in fellow_src:
        fellow_rows.append((key, fellow_src[key]))
fellow_rows = [
    ("NODE_ENV", "production"),
    ("PORT", "3013"),
    ("HOSTNAME", "127.0.0.1"),
    ("DEMO_MODE", "1"),
    ("SEO_INDEXING_ENABLED", "false"),
    ("NEXT_PUBLIC_APP_URL", "https://demo.fellowship.vaidyagogate.org"),
    ("PUBLIC_BASE_URL", "https://demo.fellowship.vaidyagogate.org"),
    ("DATABASE_URL", swap_db(fellow_src["DATABASE_URL"], "vgmf_demo_fellowship")),
] + fellow_rows

autism_rows = [
    ("NODE_ENV", "production"),
    ("PORT", "3014"),
    ("HOSTNAME", "127.0.0.1"),
    ("DEMO_MODE", "1"),
    ("APPLICANT_HOST", "demo.autism.vaidyagogate.org"),
    ("PUBLIC_BASE_URL", "https://demo.autism.vaidyagogate.org"),
    ("MAIN_SITE_URL", "https://demo.autism.vaidyagogate.org"),
    ("DATABASE_URL", swap_db(autism_src["DATABASE_URL"], "vgmf_demo_autism")),
]

write_env("/VGMF-PLATFORM/secrets/fellowship-demo.env", fellow_rows)
write_env("/VGMF-PLATFORM/secrets/autism-demo.env", autism_rows)
Path("/var/www/demo.fellowship.vaidyagogate.org/.env").write_text(Path("/VGMF-PLATFORM/secrets/fellowship-demo.env").read_text())
Path("/var/www/demo.fellowship.vaidyagogate.org/.env.production").write_text(Path("/VGMF-PLATFORM/secrets/fellowship-demo.env").read_text())
Path("/var/www/demo.autism.vaidyagogate.org/.env").write_text(Path("/VGMF-PLATFORM/secrets/autism-demo.env").read_text())
for p in [
    "/var/www/demo.fellowship.vaidyagogate.org/.env",
    "/var/www/demo.fellowship.vaidyagogate.org/.env.production",
    "/var/www/demo.autism.vaidyagogate.org/.env",
]:
    Path(p).chmod(0o600)
print("wrote demo env files")
PY

python3 - <<'PY'
from pathlib import Path

layout = Path("/var/www/demo.fellowship.vaidyagogate.org/src/app/layout.tsx")
text = layout.read_text()
if "demo-mode-banner" not in text:
    banner = '''      {process.env.NEXT_PUBLIC_APP_URL?.includes("demo.fellowship.") ? (
        <div id="demo-mode-banner" style={{position:"fixed",left:0,right:0,bottom:0,zIndex:2147483000,background:"#b45309",color:"#fff",font:"600 13px/1.4 system-ui,sans-serif",textAlign:"center",padding:"6px 12px"}}>
          DEMO MODE — demo.fellowship.vaidyagogate.org · test data only · nothing here affects the live site
        </div>
      ) : null}
'''
    if "<body" in text and "{children}" in text:
        text = text.replace("{children}", "{children}\n" + banner, 1)
        layout.write_text(text)
        print("patched fellowship layout banner")
    else:
        raise SystemExit("could not patch fellowship layout")
else:
    print("fellowship layout already patched")

keepalive = Path("/var/www/demo.fellowship.vaidyagogate.org/scripts/start-with-keepalive.mjs")
ks = keepalive.read_text()
if 'const host = process.env.HOSTNAME' not in ks:
    ks = ks.replace(
        'const child = spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", port], {',
        'const host = process.env.HOSTNAME || "127.0.0.1";\nconst child = spawn("npx", ["next", "start", "-H", host, "-p", port], {',
    )
    keepalive.write_text(ks)
    print("patched fellowship bind host")

server = Path("/var/www/demo.autism.vaidyagogate.org/server.js")
st = server.read_text()
marker = "const DEMO_MODE = /^(1|true|yes)$/i.test(String(process.env.DEMO_MODE || ''));"
if marker not in st:
    inject = '''
const DEMO_MODE = /^(1|true|yes)$/i.test(String(process.env.DEMO_MODE || ''));
if (DEMO_MODE) {
    const DEMO_BANNER =
        '<div id="demo-mode-banner" style="position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:#b45309;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center;padding:6px 12px;">' +
        'DEMO MODE — demo.autism.vaidyagogate.org · test data only · nothing here affects the live site</div>';
    app.use((req, res, next) => {
        res.setHeader('X-Site-Mode', 'demo');
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        const origSend = res.send.bind(res);
        res.send = (body) => {
            const type = String(res.getHeader('Content-Type') || '');
            if (typeof body === 'string' && /text\\/html/i.test(type) && body.includes('</body>')) {
                body = body.replace('</body>', DEMO_BANNER + '</body>');
            }
            return origSend(body);
        };
        next();
    });
    app.get('/api/public/site-mode', (req, res) => res.json({ mode: 'demo', demo: true }));
}
'''
    needle = "const app = express();\n"
    if needle not in st:
        raise SystemExit("could not find express app in autism server.js")
    st = st.replace(needle, needle + inject, 1)
    st = st.replace("app.listen(PORT, () => {", "app.listen(PORT, process.env.HOSTNAME || '127.0.0.1', () => {", 1)
    server.write_text(st)
    print("patched autism DEMO_MODE")
else:
    print("autism DEMO_MODE already patched")

seo = Path("/var/www/demo.autism.vaidyagogate.org/lib/site-seo.js")
seo_text = seo.read_text()
old = "robotsIndex: o.robotsIndex !== false && o.robotsIndex !== 0 && String(o.robotsIndex) !== 'false',"
new = "robotsIndex: /^(1|true|yes)$/i.test(String(process.env.DEMO_MODE || '')) ? false : (o.robotsIndex !== false && o.robotsIndex !== 0 && String(o.robotsIndex) !== 'false'),"
if old in seo_text:
    seo.write_text(seo_text.replace(old, new, 1))
    print("patched autism robotsIndex")
elif "DEMO_MODE" in seo_text:
    print("autism robotsIndex already patched")
else:
    print("warning: autism robotsIndex pattern not found")

gen = Path("/var/www/demo.fellowship.vaidyagogate.org/scripts/generate-seo-static.mjs")
gt = gen.read_text()
if "if (base !== official)" not in gt:
    gt = gt.replace(
        "function buildRobotsTxt(base) {\n  return `# VGMF Fellowship Portal — allow all public pages",
        "function buildRobotsTxt(base) {\n  const official = OFFICIAL_PRODUCTION_BASE.replace(/\\/$/, \"\");\n  if (base !== official) {\n    return `User-agent: *\\nDisallow: /\\n`;\n  }\n  return `# VGMF Fellowship Portal — allow all public pages",
    )
    gen.write_text(gt)
    print("patched fellowship generate-seo-static")
else:
    print("fellowship generate-seo-static already patched")
PY

log "installing nginx site files"
install_nginx() {
  local name="$1"
  local src="$2"
  local dest="/etc/nginx/sites-available/${name}"
  if [[ ! -f "$dest" ]]; then
    cp "$src" "$dest"
  fi
  ln -sfn "$dest" "/etc/nginx/sites-enabled/${name}"
}
install_nginx demo.fellowship.vaidyagogate.org "$DEPLOY_DIR/nginx-demo-fellowship.conf"
install_nginx demo.autism.vaidyagogate.org "$DEPLOY_DIR/nginx-demo-autism.conf"
cp "$DEPLOY_DIR/ecosystem-sister-demos.config.cjs" "$ROOT/ecosystem-sister-demos.config.cjs"
nginx -t
systemctl reload nginx

log "issuing TLS certificates if HTTP is reachable"
certbot --nginx --non-interactive --agree-tos --email "$SSL_EMAIL" -d "$FELLOW_HOST" || log "certbot fellowship deferred"
certbot --nginx --non-interactive --agree-tos --email "$SSL_EMAIL" -d "$AUTISM_HOST" || log "certbot autism deferred"
python3 "$DEPLOY_DIR/patch-sister-nginx.py"
nginx -t
systemctl reload nginx

log "starting autism demo (runtime env, no rebuild)"
if pm2 describe autism-demo >/dev/null 2>&1; then
  pm2 restart autism-demo --update-env
else
  pm2 start "$ROOT/ecosystem-sister-demos.config.cjs" --only autism-demo
fi

log "rebuilding fellowship demo so NEXT_PUBLIC_APP_URL bakes the demo host"
cd "$FELLOW_DST"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=3072}"
set +o histexpand
set -a
# shellcheck disable=SC1091
source /VGMF-PLATFORM/secrets/fellowship-demo.env
set +a
if [[ ! -d node_modules ]]; then
  npm ci --omit=dev
fi
npx prisma generate
npm run build
printf 'User-agent: *\nDisallow: /\n' > "$FELLOW_DST/public/robots.txt"

if pm2 describe fellowship-demo >/dev/null 2>&1; then
  pm2 restart fellowship-demo --update-env
else
  pm2 start "$ROOT/ecosystem-sister-demos.config.cjs" --only fellowship-demo
fi
pm2 save

log "sister demos ready"
psql -c "SELECT datname, pg_size_pretty(pg_database_size(datname)), pg_tablespace_location(dattablespace) AS tablespace FROM pg_database WHERE datname IN ('vgmf_demo_fellowship','vgmf_demo_autism') ORDER BY 1;"
pm2 list
curl -sS -o /dev/null -w "fellowship-demo http %{http_code}\n" -H "Host: $FELLOW_HOST" http://127.0.0.1/ || true
curl -sS -o /dev/null -w "autism-demo http %{http_code}\n" -H "Host: $AUTISM_HOST" http://127.0.0.1/ || true
