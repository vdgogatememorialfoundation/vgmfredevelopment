-- Applied automatically on first connect. Safe to re-run.
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
