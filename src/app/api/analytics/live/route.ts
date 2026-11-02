import { NextRequest, NextResponse } from "next/server";
import { presenceReport, recordCustomerAction, recordPresence } from "@/lib/server/live-presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminCookie(request: NextRequest) {
  const raw = request.cookies.get("vgmf_admin_session")?.value || "";
  const candidates = [raw];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch {
    /* already decoded */
  }
  for (const value of candidates) {
    try {
      const parsed = JSON.parse(value) as { role?: string };
      if (parsed.role === "admin" || parsed.role === "coadmin" || parsed.role === "staff") return true;
    } catch {
      /* next */
    }
  }
  return false;
}

export async function GET(request: NextRequest) {
  if (!adminCookie(request)) return NextResponse.json({ ok: false, error: "Sign in to the admin desk." }, { status: 401 });
  return NextResponse.json({ ok: true, ...presenceReport() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });
  if (body.action === "activity") {
    recordCustomerAction({
      email: String(body.email || ""),
      kind: String(body.kind || ""),
      detail: String(body.detail || ""),
    });
    return NextResponse.json({ ok: true });
  }
  recordPresence({
    sessionId: String(body.sessionId || ""),
    path: String(body.path || ""),
    title: String(body.title || ""),
    city: String(body.city || ""),
    region: String(body.region || ""),
    country: String(body.country || ""),
    lat: typeof body.lat === "number" ? body.lat : undefined,
    lng: typeof body.lng === "number" ? body.lng : undefined,
    audience: body.audience === "customer" ? "customer" : "visitor",
    label: String(body.label || ""),
  });
  return NextResponse.json({ ok: true });
}
