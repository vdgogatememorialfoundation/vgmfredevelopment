import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { dataFile } from "@/lib/server/paths";

/** Staff and co-admin logins Admin creates, kept on the server so /staff works on any device. */
export type PortalAccountRecord = Record<string, unknown> & {
  email: string;
  role: "staff" | "coadmin";
  passwordSalt?: string;
  passwordHash?: string;
  updatedAt?: string;
};

const FILE = dataFile("portal-accounts.json");
const ROLES = new Set(["staff", "coadmin"]);

function load(): PortalAccountRecord[] {
  try {
    const rows = JSON.parse(readFileSync(FILE, "utf8")) as PortalAccountRecord[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function save(rows: PortalAccountRecord[]) {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(rows, null, 2));
}

function hash(password: string, salt: string) {
  return scryptSync(password, salt, 32).toString("hex");
}

function strip(row: PortalAccountRecord) {
  const { passwordHash: _hash, passwordSalt: _salt, password: _password, ...rest } = row;
  void _hash;
  void _salt;
  void _password;
  return rest;
}

export function savePortalAccounts(incoming: unknown[]) {
  const rows = load();
  const at = new Date().toISOString();
  let saved = 0;
  for (const raw of incoming) {
    const input = (raw ?? {}) as Record<string, unknown>;
    const email = String(input.email ?? "").trim().toLowerCase();
    const role = String(input.role ?? "");
    if (!email || !ROLES.has(role)) continue;
    const index = rows.findIndex((row) => row.email === email);
    const current = index >= 0 ? rows[index] : undefined;
    const password = typeof input.password === "string" ? input.password : "";
    const { password: _password, ...profile } = input;
    void _password;
    const next: PortalAccountRecord = { ...current, ...profile, email, role: role as PortalAccountRecord["role"], updatedAt: at };
    if (password && !(current?.passwordHash && current.passwordSalt && hash(password, current.passwordSalt) === current.passwordHash)) {
      next.passwordSalt = randomBytes(16).toString("hex");
      next.passwordHash = hash(password, next.passwordSalt);
    }
    if (index >= 0) rows[index] = next;
    else rows.push(next);
    saved += 1;
  }
  if (saved) save(rows);
  return saved;
}

export function removePortalAccount(email: string) {
  const key = email.trim().toLowerCase();
  const rows = load();
  const kept = rows.filter((row) => row.email !== key);
  if (kept.length !== rows.length) save(kept);
}

export function checkPortalLogin(email: string, password: string) {
  const row = load().find((item) => item.email === email.trim().toLowerCase());
  if (!row?.passwordHash || !row.passwordSalt || !password) return null;
  const expected = Buffer.from(row.passwordHash, "hex");
  const actual = Buffer.from(hash(password, row.passwordSalt), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return strip(row);
}
