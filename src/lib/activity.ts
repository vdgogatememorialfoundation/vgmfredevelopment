import { getSession } from "@/lib/auth";
import { emailAccountActivity } from "@/lib/account-mail";

const KEY = "vgmf_account_activity";

export type ActivityKind = "login" | "logout" | "created" | "updated" | "disabled" | "banned" | "reactivated" | "deleted" | "password";

export interface AccountActivity {
  id: string;
  email: string;
  at: string;
  kind: ActivityKind;
  detail?: string;
  by?: string;
  userAgent?: string;
}

function read(): AccountActivity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AccountActivity[]) : [];
  } catch {
    return [];
  }
}

function write(rows: AccountActivity[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 2000)));
}

export function recordActivity(input: Omit<AccountActivity, "id" | "at" | "userAgent"> & { at?: string }) {
  const row: AccountActivity = {
    id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    at: input.at ?? new Date().toISOString(),
    userAgent: typeof navigator === "undefined" ? undefined : navigator.userAgent,
    email: input.email,
    kind: input.kind,
    detail: input.detail,
    by: input.by,
  };
  write([row, ...read()]);
  try {
    emailAccountActivity(row);
  } catch {
    /* mail is best-effort */
  }
  return row;
}

export function activitiesFor(email: string) {
  return read().filter((row) => row.email.toLowerCase() === email.toLowerCase());
}

export function currentActorEmail() {
  if (typeof window === "undefined") return "system";
  return getSession()?.email ?? "system";
}
