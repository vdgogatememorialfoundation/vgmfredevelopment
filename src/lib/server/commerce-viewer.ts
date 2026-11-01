import type { NextRequest } from "next/server";
import { portalSessionFrom } from "@/lib/server/portal-auth";

type CookieUser = { email?: string; role?: string; id?: string; phone?: string; accountId?: string };

function parseCookie(raw: string | undefined) {
  if (!raw) return null;
  const candidates = [raw];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch {
    /* already decoded */
  }
  for (const value of candidates) {
    try {
      const parsed = JSON.parse(value) as CookieUser;
      if (parsed?.email) return parsed;
    } catch {
      /* next encoding */
    }
  }
  return null;
}

function viewerFrom(parsed: CookieUser, portal: boolean) {
  return {
    portal,
    email: (parsed.email ?? "").toLowerCase(),
    phone: parsed.phone ?? "",
    id: parsed.id || parsed.accountId || "",
  };
}

export function commerceViewer(request: NextRequest) {
  const portal = portalSessionFrom(request);
  if (portal?.email) return viewerFrom(portal, true);
  for (const name of ["vgmf_session", "vgmf_admin_session"]) {
    const parsed = parseCookie(request.cookies.get(name)?.value);
    if (!parsed?.email) continue;
    const role = parsed.role ?? "";
    const isPortal = role === "admin" || role === "coadmin" || role === "staff" || role === "doctor";
    return viewerFrom(parsed, isPortal);
  }
  return { portal: false, email: "", phone: "", id: "" };
}
