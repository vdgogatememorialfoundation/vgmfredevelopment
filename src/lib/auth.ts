import type { User } from "@/types";

export const SESSION_KEY = "vgmf_session";
const ACCOUNTS_KEY = "vgmf_accounts";
const SECURITY_SETTINGS_KEY = "vgmf_settings_security";
/** Chrome caps Max-Age at 400 days; keep the cookie for that full window. */
const SESSION_COOKIE_MAX_AGE = 34560000;
const COOKIE_MAX_BYTES = 3500;

function browser() {
  return typeof globalThis.window !== "undefined" && typeof globalThis.window.localStorage !== "undefined";
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
  const { password: _password, ...rest } = user;
  return rest;
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

function writeSessionCookie(user: User) {
  if (typeof globalThis.document === "undefined") return;
  const value = encodeURIComponent(JSON.stringify(stripPassword(user)));
  if (value.length > COOKIE_MAX_BYTES) return;
  globalThis.document.cookie = `${SESSION_KEY}=${value}; ${cookieFlags(SESSION_COOKIE_MAX_AGE)}`;
}

function clearSessionCookie() {
  if (typeof globalThis.document === "undefined") return;
  globalThis.document.cookie = `${SESSION_KEY}=; ${cookieFlags(0)}`;
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

function restoreFromCookie(): User | null {
  const fromCookie = parseUser(readCookie(SESSION_KEY));
  if (!fromCookie) return null;
  const account = getAllAccounts().find(
    (item) => item.email.toLowerCase() === fromCookie.email.toLowerCase()
  );
  const restored = account ? { ...account, ...fromCookie, password: account.password } : fromCookie;
  try {
    globalThis.window.localStorage.setItem(SESSION_KEY, JSON.stringify(restored));
  } catch {
    /* quota / private mode — cookie still holds the session */
  }
  return restored;
}

export function getSession(): User | null {
  if (!browser()) return null;
  const fromStorage = parseUser(globalThis.window.localStorage.getItem(SESSION_KEY));
  if (fromStorage) {
    if (persistUntilLogoutEnabled() && !readCookie(SESSION_KEY)) writeSessionCookie(fromStorage);
    return fromStorage;
  }
  return persistUntilLogoutEnabled() ? restoreFromCookie() : null;
}

export function setSession(user: User) {
  if (!browser()) return;
  globalThis.window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  writeSessionCookie(user);
  notifySessionChanged();
}

export function clearSession() {
  if (!browser()) return;
  globalThis.window.localStorage.removeItem(SESSION_KEY);
  clearSessionCookie();
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
