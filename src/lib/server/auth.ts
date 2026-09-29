import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db, isDbConfigured } from "@/lib/server/db";
import { getModule, permissionOf, type AccountRole } from "@/lib/cms/modules";

import { readSessionToken, SESSION_COOKIE, SESSION_HOURS } from "@/lib/server/session-token";

export { createSessionToken, SESSION_COOKIE } from "@/lib/server/session-token";

export interface Account {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: AccountRole;
  permissions: string[];
  active: boolean;
  notes: string;
  createdAt: string;
  lastLoginAt: string | null;
}

interface AccountRow {
  id: string;
  account_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: AccountRole;
  permissions: string[];
  active: boolean;
  notes: string;
  created_at: Date;
  last_login_at: Date | null;
  password_hash?: string;
}

export function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    accountId: row.account_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    permissions: row.permissions ?? [],
    active: row.active,
    notes: row.notes ?? "",
    createdAt: new Date(row.created_at).toISOString(),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
  };
}

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = scryptSync(password, Buffer.from(saltB64, "base64url"), expected.length);
  return timingSafeEqual(expected, actual);
}

export function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_HOURS * 3600,
};

export async function getCurrentAccount(): Promise<Account | null> {
  if (!isDbConfigured()) return null;
  const store = await cookies();
  const id = readSessionToken(store.get(SESSION_COOKIE)?.value)?.sub;
  if (!id) return null;
  const sql = await db();
  const rows = await sql<AccountRow[]>`select * from vgmf.accounts where id = ${id} and active = true`;
  return rows[0] ? toAccount(rows[0]) : null;
}

export function canAccess(account: Account, permission: string) {
  if (account.role === "admin") return true;
  if (account.role !== "staff") return false;
  return account.permissions.includes(permission);
}

export function canAccessModule(account: Account, moduleKey: string) {
  const m = getModule(moduleKey);
  return m ? canAccess(account, permissionOf(m)) : false;
}

/** Staff with the "accounts" permission may manage customer, seller and delivery accounts; only admins manage admin/staff. */
export function canManageRole(actor: Account, role: string) {
  if (actor.role === "admin") return true;
  return canAccess(actor, "accounts") && ["customer", "seller", "delivery"].includes(role);
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireAccount(check?: (a: Account) => boolean): Promise<Account> {
  const account = await getCurrentAccount();
  if (!account) throw new HttpError(401, "Please sign in.");
  if (check && !check(account)) throw new HttpError(403, "You do not have access to this module.");
  return account;
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  const message = error instanceof Error ? error.message : "Unexpected error";
  return Response.json({ error: message }, { status: 500 });
}

export async function nextAccountId(role: AccountRole) {
  const prefix = { admin: "ADM", staff: "STF", seller: "SLR", delivery: "DLV", customer: "CUS" }[role];
  const sql = await db();
  const rows = await sql<{ n: number }[]>`select count(*)::int as n from vgmf.accounts where role = ${role}`;
  return `VGMF-${prefix}-${String((rows[0]?.n ?? 0) + 1001)}`;
}

export async function audit(actor: string, action: string, target = "") {
  const sql = await db();
  await sql`insert into vgmf.audit (actor, action, target) values (${actor}, ${action}, ${target})`;
}
