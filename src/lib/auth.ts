import type { User } from "@/types";

const SESSION_KEY = "vgmf_session";
const ACCOUNTS_KEY = "vgmf_accounts";

export function getSession(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function setSession(user: User) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}

export function getAllAccounts(): User[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
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
  if (typeof window === "undefined") return;
  const accounts = getAllAccounts().filter(
    (account) => account.email.toLowerCase() !== user.email.toLowerCase()
  );
  accounts.push(user);
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  window.dispatchEvent(new Event("vgmf-cms"));
}

export function demoAccountId() {
  return Math.floor(100000000000 + Math.random() * 900000000000).toString();
}

export function demoApplicationId() {
  const year = new Date().getFullYear();
  const suffix = Math.floor(100000 + Math.random() * 900000);
  return `VGMF-${year}-${suffix}`;
}