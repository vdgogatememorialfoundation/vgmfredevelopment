#!/usr/bin/env bash
# Creates /VGMF-PLATFORM Postgres tablespaces and databases for staging + demo × four apps.
# Run as root on the VPS. Does not print the generated password after writing secrets.
set -euo pipefail

ROOT=/VGMF-PLATFORM
PGHOST=127.0.0.1
PGUSER=postgres
export PGHOST PGUSER
export PGPASSWORD="${PGPASSWORD:-}"

APPS=(customer admin staff support)
ENVS=(staging demo)

mkdir -p "$ROOT/apps/staging" "$ROOT/apps/demo" \
  "$ROOT/data/staging" "$ROOT/data/demo" "$ROOT/secrets"

for env in "${ENVS[@]}"; do
  mkdir -p "$ROOT/postgres/$env/platform"
  for app in "${APPS[@]}"; do
    mkdir -p "$ROOT/postgres/$env/$app"
  done
done

chown -R postgres:postgres "$ROOT/postgres"
chmod 700 "$ROOT/postgres"
find "$ROOT/postgres" -type d -exec chmod 700 {} \;

if [[ ! -f "$ROOT/secrets/postgres.env" ]]; then
  PASS="$(openssl rand -base64 36 | tr -d '\n/+=')"
  umask 077
  cat > "$ROOT/secrets/postgres.env" <<EOF
VGMF_PG_USER=vgmf
VGMF_PG_PASSWORD=$PASS
VGMF_PG_HOST=127.0.0.1
VGMF_PG_PORT=5432
EOF
  chmod 600 "$ROOT/secrets/postgres.env"
fi

# shellcheck disable=SC1091
source "$ROOT/secrets/postgres.env"
SQL_PASS="${VGMF_PG_PASSWORD//\'/\'\'}"

psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vgmf') THEN
    CREATE ROLE vgmf LOGIN PASSWORD '${SQL_PASS}';
  ELSE
    ALTER ROLE vgmf WITH LOGIN PASSWORD '${SQL_PASS}';
  END IF;
END
\$\$;
SQL

ensure_tablespace() {
  local name="$1"
  local loc="$2"
  local exists
  exists="$(psql -tAc "SELECT 1 FROM pg_tablespace WHERE spcname = '${name}'")"
  if [[ "$exists" != "1" ]]; then
    psql -v ON_ERROR_STOP=1 -c "CREATE TABLESPACE ${name} OWNER vgmf LOCATION '${loc}';"
  fi
}

ensure_db() {
  local name="$1"
  local ts="$2"
  local exists
  exists="$(psql -tAc "SELECT 1 FROM pg_database WHERE datname = '${name}'")"
  if [[ "$exists" != "1" ]]; then
    psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${name} OWNER vgmf TABLESPACE ${ts};"
  fi
  psql -v ON_ERROR_STOP=1 -c "GRANT ALL PRIVILEGES ON DATABASE ${name} TO vgmf;"
}

ensure_tablespace vgmf_staging_platform "$ROOT/postgres/staging/platform"
ensure_tablespace vgmf_demo_platform "$ROOT/postgres/demo/platform"
ensure_db vgmf_staging_platform vgmf_staging_platform
ensure_db vgmf_demo_platform vgmf_demo_platform

for env in "${ENVS[@]}"; do
  for app in "${APPS[@]}"; do
    ts="vgmf_${env}_${app}"
    db="vgmf_${env}_${app}"
    ensure_tablespace "$ts" "$ROOT/postgres/$env/$app"
    ensure_db "$db" "$ts"
  done
done

SCHEMA_FILE="$(dirname "$0")/schema.sql"
if [[ -f "$SCHEMA_FILE" ]]; then
  for env in "${ENVS[@]}"; do
    PGPASSWORD="$VGMF_PG_PASSWORD" psql -h 127.0.0.1 -U vgmf -d "vgmf_${env}_platform" -v ON_ERROR_STOP=1 -f "$SCHEMA_FILE"
    for app in "${APPS[@]}"; do
      PGPASSWORD="$VGMF_PG_PASSWORD" psql -h 127.0.0.1 -U vgmf -d "vgmf_${env}_${app}" -v ON_ERROR_STOP=1 -f "$SCHEMA_FILE"
    done
  done
fi

write_env() {
  local env="$1"
  local port="$2"
  local site="$3"
  local file="$ROOT/secrets/${env}.env"
  umask 077
  cat > "$file" <<EOF
NODE_ENV=production
VGMF_ENV=${env}
NEXT_PUBLIC_VGMF_ENV=${env}
NEXT_PUBLIC_SITE_URL=https://${site}
SITE_URL=https://${site}
HOSTNAME=127.0.0.1
PORT=${port}
VGMF_DATA_DIR=${ROOT}/data/${env}
DATABASE_URL=postgresql://vgmf:${VGMF_PG_PASSWORD}@127.0.0.1:5432/vgmf_${env}_platform
VGMF_DB_PLATFORM=postgresql://vgmf:${VGMF_PG_PASSWORD}@127.0.0.1:5432/vgmf_${env}_platform
VGMF_DB_CUSTOMER=postgresql://vgmf:${VGMF_PG_PASSWORD}@127.0.0.1:5432/vgmf_${env}_customer
VGMF_DB_ADMIN=postgresql://vgmf:${VGMF_PG_PASSWORD}@127.0.0.1:5432/vgmf_${env}_admin
VGMF_DB_STAFF=postgresql://vgmf:${VGMF_PG_PASSWORD}@127.0.0.1:5432/vgmf_${env}_staff
VGMF_DB_SUPPORT=postgresql://vgmf:${VGMF_PG_PASSWORD}@127.0.0.1:5432/vgmf_${env}_support
EOF
  chmod 600 "$file"
}

write_env staging 3005 staging.vaidyagogate.org
write_env demo 3012 demo.vaidyagogate.org

echo "VGMF-PLATFORM postgres ready."
psql -c "SELECT spcname, pg_tablespace_location(oid) AS location FROM pg_tablespace WHERE spcname LIKE 'vgmf_%' ORDER BY 1;"
psql -c "SELECT datname, pg_tablespace_location(dattablespace) AS tablespace FROM pg_database WHERE datname LIKE 'vgmf_%' ORDER BY 1;"
