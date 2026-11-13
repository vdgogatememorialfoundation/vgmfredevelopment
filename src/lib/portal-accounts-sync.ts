import type { User } from "@/types";

const URL = "/api/admin/portal-accounts";

function localPortalAccounts(): User[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem("vgmf_accounts") || "[]") as User[];
    return rows.filter((row) => row?.email && (row.role === "staff" || row.role === "coadmin"));
  } catch {
    return [];
  }
}

/** Sends Admin's staff and co-admin logins to the server so they can sign in from any device. */
export function pushPortalAccounts() {
  const accounts = localPortalAccounts();
  if (!accounts.length) return;
  void fetch(URL, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save", accounts }) }).catch(() => undefined);
}

export function dropPortalAccount(email: string) {
  void fetch(URL, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "remove", email }) }).catch(() => undefined);
}

export async function serverPortalLogin(email: string, password: string): Promise<User | null> {
  try {
    const response = await fetch(URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "login", email, password }) });
    const data = (await response.json().catch(() => null)) as { ok?: boolean; account?: User } | null;
    return response.ok && data?.ok && data.account ? data.account : null;
  } catch {
    return null;
  }
}
