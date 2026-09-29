// Usage: DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/create-admin.mjs
// Creates (or resets the password of) the first administrator account.
import { randomBytes, scryptSync } from "node:crypto";
import postgres from "postgres";

const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = "Foundation Admin" } = process.env;
if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("DATABASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 8) {
  console.error("ADMIN_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = `scrypt$${salt.toString("base64url")}$${scryptSync(ADMIN_PASSWORD, salt, 64).toString("base64url")}`;
const [firstName, ...rest] = ADMIN_NAME.split(" ");
const sql = postgres(DATABASE_URL, { ssl: "require", prepare: false, max: 1 });

await sql`create schema if not exists vgmf`;
await sql`create table if not exists vgmf.accounts (
  id uuid primary key default gen_random_uuid(), account_id text unique not null, first_name text not null,
  last_name text not null default '', email text unique not null, phone text not null default '', role text not null,
  permissions text[] not null default '{}', password_hash text not null, active boolean not null default true,
  notes text not null default '', created_by uuid, created_at timestamptz not null default now(), last_login_at timestamptz)`;
const email = ADMIN_EMAIL.trim().toLowerCase();
const [{ n }] = await sql`select count(*)::int as n from vgmf.accounts where role = 'admin'`;
await sql`
  insert into vgmf.accounts (account_id, first_name, last_name, email, role, password_hash)
  values (${`VGMF-ADM-${1001 + n}`}, ${firstName}, ${rest.join(" ")}, ${email}, 'admin', ${hash})
  on conflict (email) do update set password_hash = excluded.password_hash, role = 'admin', active = true`;
console.log(`Administrator ready: ${email}`);
await sql.end();
