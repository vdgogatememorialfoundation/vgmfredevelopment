import { NextRequest, NextResponse } from "next/server";
import { denyUnlessPortal, portalSessionFrom } from "@/lib/server/portal-auth";
import { listWhatsAppThreads, markWhatsAppRead, replyOnWhatsApp } from "@/lib/server/whatsapp-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function desk(request: NextRequest) {
  const portal = portalSessionFrom(request);
  if (!portal || portal.role === "doctor") return null;
  return portal;
}

export async function GET(request: NextRequest) {
  if (!desk(request)) return denyUnlessPortal(request) ?? NextResponse.json({ ok: false, error: "Sign in to the desk." }, { status: 401 });
  return NextResponse.json(
    { ok: true, threads: listWhatsAppThreads() },
    { headers: { "cache-control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const portal = desk(request);
  if (!portal) return denyUnlessPortal(request) ?? NextResponse.json({ ok: false, error: "Sign in to the desk." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { action?: string; threadId?: string; text?: string } | null;
  const threadId = String(body?.threadId || "");
  try {
    if (body?.action === "read") {
      return NextResponse.json({ ok: true, thread: markWhatsAppRead(threadId) });
    }
    if (body?.action === "reply") {
      const thread = await replyOnWhatsApp(threadId, String(body.text || ""), portal?.email || "desk");
      return NextResponse.json({ ok: true, thread });
    }
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
  }
}
