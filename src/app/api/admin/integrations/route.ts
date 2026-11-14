import { NextRequest, NextResponse } from "next/server";
import { portalSessionFrom } from "@/lib/server/portal-auth";
import { publicAdminIntegrations, saveAdminIntegrations } from "@/lib/server/admin-integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function admin(request: NextRequest) {
  const session = portalSessionFrom(request);
  return session?.role === "admin" || session?.role === "coadmin";
}

export async function GET(request: NextRequest) {
  if (!admin(request)) return NextResponse.json({ ok: false, error: "Sign in as admin." }, { status: 401 });
  return NextResponse.json({ ok: true, ...publicAdminIntegrations() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!admin(request)) return NextResponse.json({ ok: false, error: "Sign in as admin." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { settings?: unknown; at?: string } | null;
  const at = typeof body?.at === "string" && body.at ? body.at : new Date().toISOString();
  const saved = saveAdminIntegrations(body?.settings, at);
  return NextResponse.json({ ok: true, updatedAt: saved.updatedAt });
}
