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

/** The customer session alone, for shop actions taken while a portal session is also open in the browser. */
export function customerViewer(request: NextRequest) {
  const customer = parseCookie(request.cookies.get("vgmf_session")?.value);
  return customer?.email ? viewerFrom(customer, false) : null;
}

/** The signed-in shopper for carts: the customer session first, so staff shopping on the site keep one cart too. */
export function shopperEmail(request: NextRequest) {
  const customer = parseCookie(request.cookies.get("vgmf_session")?.value);
  if (customer?.email) return customer.email.toLowerCase();
  return commerceViewer(request).email;
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
