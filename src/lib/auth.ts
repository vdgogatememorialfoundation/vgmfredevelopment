import type { User } from "@/types";

export const SESSION_KEY = "vgmf_session";
export const PORTAL_SESSION_KEY = "vgmf_admin_session";
export type SessionScope = "public" | "portal";

const ACCOUNTS_KEY = "vgmf_accounts";
const SECURITY_SETTINGS_KEY = "vgmf_settings_security";
/** Chrome caps Max-Age at 400 days; keep the cookie for that full window. */
const SESSION_COOKIE_MAX_AGE = 34560000;
const COOKIE_MAX_BYTES = 3500;

function browser() {
  return typeof globalThis.window !== "undefined" && typeof globalThis.window.localStorage !== "undefined";
}

export function isPortalRole(role?: string | null) {
  return role === "admin" || role === "coadmin" || role === "staff" || role === "doctor";
}

export function scopeFromPath(pathname = browser() ? globalThis.window.location.pathname : "") {
  if (pathname.startsWith("/admin") || pathname.startsWith("/staff") || pathname.startsWith("/doctor")) return "portal" as const;
  return "public" as const;
}

export function scopeForUser(user: Pick<User, "role">) {
  return isPortalRole(user.role) ? "portal" : "public";
}

function storageKey(scope: SessionScope) {
  return scope === "portal" ? PORTAL_SESSION_KEY : SESSION_KEY;
}

export function persistUntilLogoutEnabled() {
  if (!browser()) return true;
  try {
    const raw = globalThis.window.localStorage.getItem(SECURITY_SETTINGS_KEY);
    const saved = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    return saved.persistUntilLogout !== "false";
  } catch {
    return true;
  }
}

function parseUser(raw: string | null | undefined): User | null {
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as User;
    return user?.email ? user : null;
  } catch {
    return null;
  }
}

function stripPassword(user: User): User {
  const copy = { ...user };
  delete copy.password;
  return copy;
}

function readCookie(name: string) {
  if (typeof globalThis.document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of globalThis.document.cookie.split("; ")) {
    if (part.startsWith(prefix)) {
      try {
        return decodeURIComponent(part.slice(prefix.length));
      } catch {
        return part.slice(prefix.length);
      }
    }
  }
  return null;
}

function cookieFlags(maxAge: number) {
  const secure = browser() && globalThis.window.location.protocol === "https:" ? "; Secure" : "";
  return `Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function writeSessionCookie(scope: SessionScope, user: User) {
  if (typeof globalThis.document === "undefined") return;
  const value = encodeURIComponent(JSON.stringify(stripPassword(user)));
  if (value.length > COOKIE_MAX_BYTES) return;
  globalThis.document.cookie = `${storageKey(scope)}=${value}; ${cookieFlags(SESSION_COOKIE_MAX_AGE)}`;
}

function clearSessionCookie(scope: SessionScope) {
  if (typeof globalThis.document === "undefined") return;
  globalThis.document.cookie = `${storageKey(scope)}=; ${cookieFlags(0)}`;
}

let notifyingSession = false;

function notifySessionChanged() {
  if (!browser() || notifyingSession) return;
  notifyingSession = true;
  try {
    globalThis.window.dispatchEvent(new Event("vgmf-cms"));
  } finally {
    notifyingSession = false;
  }
}

function mergeAccount(user: User): User {
  const account = getAllAccounts().find((item) => item.email.toLowerCase() === user.email.toLowerCase());
  return account ? { ...account, ...user, password: account.password } : user;
}

let migrated = false;

function migrateLegacyAdminSession() {
  if (!browser() || migrated) return;
  migrated = true;
  const legacy = parseUser(globalThis.window.localStorage.getItem(SESSION_KEY)) ?? parseUser(readCookie(SESSION_KEY));
  if (!legacy || !isPortalRole(legacy.role)) return;
  if (parseUser(globalThis.window.localStorage.getItem(PORTAL_SESSION_KEY)) || parseUser(readCookie(PORTAL_SESSION_KEY))) {
    globalThis.window.localStorage.removeItem(SESSION_KEY);
    clearSessionCookie("public");
    return;
  }
  try {
    globalThis.window.localStorage.setItem(PORTAL_SESSION_KEY, JSON.stringify(legacy));
  } catch {
    /* quota */
  }
  writeSessionCookie("portal", legacy);
  globalThis.window.localStorage.removeItem(SESSION_KEY);
  clearSessionCookie("public");
}

function restoreFromCookie(scope: SessionScope): User | null {
  const fromCookie = parseUser(readCookie(storageKey(scope)));
  if (!fromCookie) return null;
  if (scope === "public" && isPortalRole(fromCookie.role)) return null;
  if (scope === "portal" && !isPortalRole(fromCookie.role)) return null;
  const restored = mergeAccount(fromCookie);
  try {
    globalThis.window.localStorage.setItem(storageKey(scope), JSON.stringify(stripPassword(restored)));
  } catch {
    /* quota / private mode — cookie still holds the session */
  }
  return restored;
}

export function getSession(scope?: SessionScope): User | null {
  if (!browser()) return null;
  migrateLegacyAdminSession();
  const resolved = scope ?? scopeFromPath();
  const fromStorage = parseUser(globalThis.window.localStorage.getItem(storageKey(resolved)));
  if (fromStorage) {
    if (resolved === "public" && isPortalRole(fromStorage.role)) {
      migrateLegacyAdminSession();
      return null;
    }
    if (resolved === "portal" && !isPortalRole(fromStorage.role)) return null;
    if (persistUntilLogoutEnabled() && !readCookie(storageKey(resolved))) writeSessionCookie(resolved, fromStorage);
    return fromStorage;
  }
  return persistUntilLogoutEnabled() ? restoreFromCookie(resolved) : null;
}

export function setSession(user: User, scope?: SessionScope) {
  if (!browser()) return;
  let resolved = scope ?? scopeForUser(user);
  if (isPortalRole(user.role)) resolved = "portal";
  else if (resolved === "portal") resolved = "public";
  const stored = stripPassword(user);
  globalThis.window.localStorage.setItem(storageKey(resolved), JSON.stringify(stored));
  writeSessionCookie(resolved, stored);
  notifySessionChanged();
}

export function clearSession(scope?: SessionScope) {
  if (!browser()) return;
  const resolved = scope ?? scopeFromPath();
  globalThis.window.localStorage.removeItem(storageKey(resolved));
  clearSessionCookie(resolved);
  notifySessionChanged();
}

export function getAllAccounts(): User[] {
  if (!browser()) return [];
  try {
    const raw = globalThis.window.localStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as User[]) : [];
  } catch {
    return [];
  }
}

export function findAccountByIdentifier(identifier: string): User | null {
  const value = identifier.trim().toLowerCase();
  return (
    getAllAccounts().find(
      (account) =>
        account.email.toLowerCase() === value ||
        (account.phone ?? "").replace(/\D/g, "") === value.replace(/\D/g, "") ||
        account.accountId === identifier.trim()
    ) ?? null
  );
}

/** Why this account may not sign in, or null when it can. */
export function loginBlockReason(user: Pick<User, "status" | "statusReason"> | null | undefined) {
  if (!user || !user.status || user.status === "active") return null;
  const base =
    user.status === "banned"
      ? "This account has been banned."
      : "This account is disabled.";
  return `${base}${user.statusReason ? ` Reason: ${user.statusReason}.` : ""} Contact support@vaidyagogate.org for help.`;
}

export function saveAccount(user: User) {
  if (!browser()) return;
  const accounts = getAllAccounts().filter(
    (account) => account.email.toLowerCase() !== user.email.toLowerCase()
  );
  accounts.push(user);
  globalThis.window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  globalThis.window.dispatchEvent(new Event("vgmf-cms"));
}

export function demoAccountId() {
  return Math.floor(100000000000 + Math.random() * 900000000000).toString();
}

export function demoApplicationId() {
  const year = new Date().getFullYear();
  const suffix = Math.floor(100000 + Math.random() * 900000);
  return `VGMF-${year}-${suffix}`;
}
