import { NextRequest, NextResponse } from "next/server";
import { appendAudit, listAudit } from "@/lib/server/audit-log";
import { portalSessionFrom } from "@/lib/server/portal-auth";

export async function GET(request: NextRequest) {
  if (!portalSessionFrom(request)) return NextResponse.json({ ok: false, error: "Staff sign-in is required." }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const rows = listAudit({
    q: params.get("q") || undefined,
    actorType: params.get("type") || undefined,
    limit: Number(params.get("limit")) || 500,
  });
  return NextResponse.json({ ok: true, rows });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "").slice(0, 120);
  if (!action) return NextResponse.json({ ok: false, error: "Action is required." }, { status: 400 });
  const portal = portalSessionFrom(request);
  const claimed = String(body?.actor ?? "").trim().toLowerCase().slice(0, 160);
  const row = appendAudit({
    actor: portal?.email || claimed || "guest",
    actorType: portal ? "staff" : claimed ? "customer" : "guest",
    role: portal?.role,
    action,
    target: String(body?.target ?? "").slice(0, 200) || undefined,
    detail: String(body?.detail ?? "").slice(0, 500) || undefined,
    ip: (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || undefined,
  });
  return NextResponse.json({ ok: true, id: row.id });
}
