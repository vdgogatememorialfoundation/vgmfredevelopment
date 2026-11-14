import { getSession } from "@/lib/auth";

/** Best-effort audit trail; the server stamps staff identity from the portal sign-in. */
export function logAudit(action: string, target?: string, detail?: string) {
  if (typeof window === "undefined") return;
  void fetch("/api/audit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    keepalive: true,
    body: JSON.stringify({ action, target, detail, actor: getSession()?.email ?? "" }),
  }).catch(() => undefined);
}
