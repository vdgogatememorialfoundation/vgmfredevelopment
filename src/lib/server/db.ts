import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { PLATFORM_APPS, type PlatformApp } from "@/lib/platform";
import { sanitizeDomainSettings, type DomainSettings } from "@/lib/domains";
import { dataFile } from "@/lib/server/paths";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS app_kv (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS published_feed (
  id text PRIMARY KEY DEFAULT 'live',
  feed jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS domain_settings (
  id text PRIMARY KEY DEFAULT 'platform',
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`;

type PoolKey = "platform" | PlatformApp;

const pools = new Map<PoolKey, Pool>();
const ready = new Set<PoolKey>();

function urlFor(key: PoolKey) {
  if (key === "platform") return process.env.DATABASE_URL || process.env.VGMF_DB_PLATFORM || "";
  const specific = process.env[`VGMF_DB_${key.toUpperCase()}`] || process.env[`DATABASE_URL_${key.toUpperCase()}`];
  return specific || process.env.DATABASE_URL || "";
}

function poolFor(key: PoolKey) {
  const url = urlFor(key);
  if (!url) return null;
  const existing = pools.get(key);
  if (existing) return existing;
  const pool = new Pool({ connectionString: url, max: 4, idleTimeoutMillis: 10_000 });
  pools.set(key, pool);
  return pool;
}

async function ensureSchema(key: PoolKey) {
  if (ready.has(key)) return;
  const pool = poolFor(key);
  if (!pool) return;
  await pool.query(SCHEMA);
  ready.add(key);
}

export function postgresConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.VGMF_DB_PLATFORM);
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  key: PoolKey,
  text: string,
  values?: unknown[]
): Promise<QueryResult<T> | null> {
  const pool = poolFor(key);
  if (!pool) return null;
  await ensureSchema(key);
  return pool.query<T>(text, values);
}

export async function withClient<T>(key: PoolKey, fn: (client: PoolClient) => Promise<T>) {
  const pool = poolFor(key);
  if (!pool) return null;
  await ensureSchema(key);
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

const DOMAIN_FILE = () => dataFile("domain-settings.json");

function readDomainFile(): DomainSettings | null {
  try {
    return sanitizeDomainSettings(JSON.parse(readFileSync(DOMAIN_FILE(), "utf8")));
  } catch {
    return null;
  }
}

function writeDomainFile(settings: DomainSettings) {
  const file = DOMAIN_FILE();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(settings, null, 2));
}

export async function readDomainSettingsFromStore(): Promise<DomainSettings | null> {
  const result = await query<{ payload: DomainSettings }>("platform", "SELECT payload FROM domain_settings WHERE id = $1", [
    "platform",
  ]);
  const payload = result?.rows[0]?.payload;
  if (payload) return sanitizeDomainSettings(payload);
  return readDomainFile();
}

export async function writeDomainSettingsToStore(settings: DomainSettings) {
  const next = sanitizeDomainSettings({ ...settings, updatedAt: new Date().toISOString() });
  writeDomainFile(next);
  await query(
    "platform",
    `INSERT INTO domain_settings (id, payload, updated_at)
     VALUES ('platform', $1::jsonb, now())
     ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
    [JSON.stringify(next)]
  );
  return next;
}

export async function writeKv(app: PlatformApp, key: string, value: unknown) {
  await query(
    app,
    `INSERT INTO app_kv (key, value, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)]
  );
}

export async function readKv<T = unknown>(app: PlatformApp, key: string): Promise<T | null> {
  const result = await query<{ value: T }>(app, "SELECT value FROM app_kv WHERE key = $1", [key]);
  return result?.rows[0]?.value ?? null;
}

export async function writePublishedFeed(feed: unknown) {
  const body = JSON.stringify(feed);
  await Promise.all(
    PLATFORM_APPS.map((app) =>
      query(
        app,
        `INSERT INTO published_feed (id, feed, published_at)
         VALUES ('live', $1::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET feed = EXCLUDED.feed, published_at = now()`,
        [body]
      )
    )
  );
}

export async function pingPostgres() {
  const result = await query<{ now: string; db: string }>("platform", "SELECT now()::text AS now, current_database() AS db");
  return result?.rows[0] ?? null;
}
