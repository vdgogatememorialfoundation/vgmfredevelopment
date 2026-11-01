import type { NextRequest } from "next/server";
import { portalSessionFrom } from "@/lib/server/portal-auth";

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
      const parsed = JSON.parse(value) as { email?: string; role?: string };
      if (parsed?.email) return parsed;
    } catch {
      /* next encoding */
    }
  }
  return null;
}

export function commerceViewer(request: NextRequest) {
  const portal = portalSessionFrom(request);
  if (portal?.email) return { portal: true, email: portal.email.toLowerCase() };
  for (const name of ["vgmf_session", "vgmf_admin_session"]) {
    const parsed = parseCookie(request.cookies.get(name)?.value);
    if (!parsed?.email) continue;
    const role = parsed.role ?? "";
    const isPortal = role === "admin" || role === "coadmin" || role === "staff" || role === "doctor";
    return { portal: isPortal, email: parsed.email.toLowerCase() };
  }
  return { portal: false, email: "" };
}
