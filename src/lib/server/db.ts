import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

const globalForDb = globalThis as unknown as { vgmfSql?: Sql; vgmfSchema?: Promise<void> };

export function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function sql(): Sql {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!globalForDb.vgmfSql) {
    globalForDb.vgmfSql = postgres(process.env.DATABASE_URL, {
      ssl: "require",
      prepare: false,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => undefined,
    });
  }
  return globalForDb.vgmfSql;
}

const SCHEMA = `
create schema if not exists vgmf;
create table if not exists vgmf.accounts (
  id uuid primary key default gen_random_uuid(),
  account_id text unique not null,
  first_name text not null,
  last_name text not null default '',
  email text unique not null,
  phone text not null default '',
  role text not null,
  permissions text[] not null default '{}',
  password_hash text not null,
  active boolean not null default true,
  notes text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
create table if not exists vgmf.items (
  id uuid primary key default gen_random_uuid(),
  collection text not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'published',
  sort_order integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists items_collection_idx on vgmf.items (collection, sort_order, created_at desc);
create table if not exists vgmf.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists vgmf.audit (
  id bigserial primary key,
  actor text not null default '',
  action text not null,
  target text not null default '',
  at timestamptz not null default now()
);
alter table vgmf.accounts enable row level security;
alter table vgmf.items enable row level security;
alter table vgmf.settings enable row level security;
alter table vgmf.audit enable row level security;
`;

export function ensureSchema(): Promise<void> {
  if (!globalForDb.vgmfSchema) {
    globalForDb.vgmfSchema = sql()
      .unsafe(SCHEMA)
      .then(() => undefined)
      .catch((error: unknown) => {
        globalForDb.vgmfSchema = undefined;
        throw error;
      });
  }
  return globalForDb.vgmfSchema;
}

export async function db(): Promise<Sql> {
  await ensureSchema();
  return sql();
}
