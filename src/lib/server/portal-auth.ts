import { NextRequest, NextResponse } from "next/server";

const PORTAL_COOKIE = "vgmf_admin_session";
const PORTAL_ROLES = new Set(["admin", "coadmin", "staff", "doctor"]);

function parseSession(raw: string | undefined) {
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
      if (parsed?.email && PORTAL_ROLES.has(parsed.role || "")) return parsed;
    } catch {
      /* try the next encoding */
    }
  }
  return null;
}

export function portalSessionFrom(request: NextRequest) {
  return parseSession(request.cookies.get(PORTAL_COOKIE)?.value);
}

export function denyUnlessPortal(request: NextRequest) {
  if (portalSessionFrom(request)) return null;
  return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
}
