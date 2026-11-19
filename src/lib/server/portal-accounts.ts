import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { dataFile } from "@/lib/server/paths";

/** Staff and co-admin logins Admin creates, kept on the server so /staff works on any device. */
export type PortalAccountRecord = Record<string, unknown> & {
  email: string;
  role: "staff" | "coadmin" | "admin";
  passwordSalt?: string;
  passwordHash?: string;
  updatedAt?: string;
};

const FILE = dataFile("portal-accounts.json");
const ROLES = new Set(["staff", "coadmin", "admin"]);
const ACCESS_FILE = dataFile("portal-access.json");
const OTP_FILE = dataFile("portal-otp.json");
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_MS = 30 * 1000;
const OTP_ATTEMPTS = 5;

type OtpRow = { salt: string; hash: string; expires: number; issued: number; attempts: number };

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2));
}

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

/** Staff role definitions and custom modules, so a new device knows what each staff role can open. */
export function savePortalAccess(input: { roles?: unknown; customModules?: unknown }) {
  const current = readJson<{ roles?: unknown[]; customModules?: unknown[] }>(ACCESS_FILE, {});
  writeJson(ACCESS_FILE, {
    roles: Array.isArray(input.roles) ? input.roles : current.roles ?? [],
    customModules: Array.isArray(input.customModules) ? input.customModules : current.customModules ?? [],
    updatedAt: new Date().toISOString(),
  });
}

export function readPortalAccess() {
  const access = readJson<{ roles?: unknown[]; customModules?: unknown[] }>(ACCESS_FILE, {});
  return { roles: access.roles ?? [], customModules: access.customModules ?? [] };
}

export function findPortalAccount(email: string) {
  const row = load().find((item) => item.email === email.trim().toLowerCase());
  return row ? strip(row) : null;
}

export function portalAccountBlocked(row: Record<string, unknown>) {
  return row.status === "banned" || row.status === "disabled";
}

/** Returns a fresh code, or "" when one was sent in the last 30 seconds. */
export function issuePortalOtp(email: string) {
  const key = email.trim().toLowerCase();
  const all = readJson<Record<string, OtpRow>>(OTP_FILE, {});
  const now = Date.now();
  for (const [id, row] of Object.entries(all)) if (row.expires < now) delete all[id];
  if (all[key] && now - all[key].issued < OTP_RESEND_MS) return "";
  const code = String(randomInt(100000, 1000000));
  const salt = randomBytes(8).toString("hex");
  all[key] = { salt, hash: hash(code, salt), expires: now + OTP_TTL_MS, issued: now, attempts: 0 };
  writeJson(OTP_FILE, all);
  return code;
}

export function verifyPortalOtp(email: string, code: string) {
  const key = email.trim().toLowerCase();
  const all = readJson<Record<string, OtpRow>>(OTP_FILE, {});
  const row = all[key];
  if (!row || row.expires < Date.now()) return "The code has expired. Send a new code.";
  if (row.attempts >= OTP_ATTEMPTS) return "Too many wrong codes. Send a new code.";
  if (hash(String(code).trim(), row.salt) !== row.hash) {
    row.attempts += 1;
    writeJson(OTP_FILE, all);
    return "Incorrect code. Please try again.";
  }
  delete all[key];
  writeJson(OTP_FILE, all);
  return null;
}
