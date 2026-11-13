import type { User } from "@/types";

const URL = "/api/admin/portal-accounts";
const PORTAL_ROLES = new Set(["staff", "coadmin", "admin"]);

type Access = { roles?: unknown[]; customModules?: unknown[] };
export type PortalLoginResult = { account: User } & Access;

function readLocal<T>(key: string): T | undefined {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function post(body: Record<string, unknown>) {
  return fetch(URL, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

/** Sends Admin's staff, co-admin and admin logins plus staff roles to the server, so they can sign in from any device. */
export function pushPortalAccounts() {
  if (typeof window === "undefined") return;
  const accounts = (readLocal<User[]>("vgmf_accounts") ?? []).filter((row) => row?.email && PORTAL_ROLES.has(row.role ?? ""));
  if (!accounts.length) return;
  void post({ action: "save", accounts, roles: readLocal<unknown[]>("vgmf_staff_roles"), customModules: readLocal<unknown[]>("vgmf_custom_modules") }).catch(() => undefined);
}

export function dropPortalAccount(email: string) {
  void post({ action: "remove", email }).catch(() => undefined);
}

/** Stores the server's staff role definitions on this device so module access matches Admin. */
export function applyPortalAccess(access: Access) {
  const merge = (key: string, incoming?: unknown[]) => {
    if (!Array.isArray(incoming) || !incoming.length) return;
    const byId = new Map<string, unknown>();
    for (const row of readLocal<Array<{ id?: string }>>(key) ?? []) if (row?.id) byId.set(row.id, row);
    for (const row of incoming as Array<{ id?: string }>) if (row?.id) byId.set(row.id, row);
    window.localStorage.setItem(key, JSON.stringify([...byId.values()]));
  };
  merge("vgmf_staff_roles", access.roles);
  merge("vgmf_custom_modules", access.customModules);
  window.dispatchEvent(new Event("vgmf-cms"));
}

async function read(response: Response) {
  return (await response.json().catch(() => null)) as ({ ok?: boolean; error?: string; account?: User } & Access) | null;
}

export async function serverPortalLogin(email: string, password: string): Promise<PortalLoginResult | null> {
  try {
    const data = await read(await post({ action: "login", email, password }));
    return data?.ok && data.account ? { account: data.account, roles: data.roles, customModules: data.customModules } : null;
  } catch {
    return null;
  }
}

/** "sent", "not-found" (no server copy of this login), or an error message. */
export async function serverPortalSendCode(email: string, portal: string) {
  try {
    const response = await post({ action: "otp-send", email, portal });
    const data = await read(response);
    if (response.ok && data?.ok) return "sent";
    return data?.error || "The code could not be sent. Try again.";
  } catch {
    return "not-found";
  }
}

export async function serverPortalVerify(email: string, code: string): Promise<PortalLoginResult | string> {
  try {
    const data = await read(await post({ action: "otp-verify", email, code }));
    if (data?.ok && data.account) return { account: data.account, roles: data.roles, customModules: data.customModules };
    return data?.error || "Incorrect code. Please try again.";
  } catch {
    return "Could not reach the server. Try again.";
  }
}
