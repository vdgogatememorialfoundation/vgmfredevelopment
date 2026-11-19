import { NextRequest, NextResponse } from "next/server";
import { denyUnlessPortal, portalSessionFrom } from "@/lib/server/portal-auth";
import { addApproval, decideApproval, listApprovals } from "@/lib/server/desk-approvals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function desk(request: NextRequest) {
  const portal = portalSessionFrom(request);
  if (!portal?.email || portal.role === "doctor") return null;
  return { email: portal.email, admin: portal.role === "admin" || portal.role === "coadmin" };
}

export async function GET(request: NextRequest) {
  const viewer = desk(request);
  if (!viewer) return denyUnlessPortal(request) ?? NextResponse.json({ ok: false, error: "Sign in to the desk." }, { status: 401 });
  const rows = listApprovals();
  return NextResponse.json({ ok: true, admin: viewer.admin, approvals: viewer.admin ? rows : rows.filter((row) => row.requestedBy === viewer.email) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const viewer = desk(request);
  if (!viewer) return denyUnlessPortal(request) ?? NextResponse.json({ ok: false, error: "Sign in to the desk." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { action?: string; kind?: string; orderId?: string; amount?: number; reason?: string; id?: string; decision?: string; note?: string } | null;
  if (body?.action === "request") {
    const kind = body.kind === "refund" || body.kind === "cancel" || body.kind === "return" ? body.kind : null;
    const orderId = String(body.orderId || "").trim();
    if (!kind || !orderId) return NextResponse.json({ ok: false, error: "Choose an order and an action." }, { status: 400 });
    const amount = kind === "refund" ? Math.max(0, Number(body.amount) || 0) : undefined;
    const row = addApproval({ kind, orderId, amount, reason: String(body.reason || "").slice(0, 500), requestedBy: viewer.email });
    return NextResponse.json({ ok: true, approval: row });
  }
  if (body?.action === "decide") {
    if (!viewer.admin) return NextResponse.json({ ok: false, error: "Only Admin can approve." }, { status: 403 });
    const decision = body.decision === "approved" ? "approved" : "rejected";
    const row = decideApproval(String(body.id || ""), decision, viewer.email, body.note ? String(body.note).slice(0, 500) : undefined);
    if (!row) return NextResponse.json({ ok: false, error: "This request was already decided." }, { status: 409 });
    return NextResponse.json({ ok: true, approval: row });
  }
  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
