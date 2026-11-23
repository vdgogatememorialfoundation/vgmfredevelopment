import { NextRequest, NextResponse } from "next/server";
import { syncVoveIdKyc, verifyVoveWebhook } from "@/lib/server/agent-kyc";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const ok = verifyVoveWebhook(raw, {
    id: req.headers.get("svix-id") || "",
    timestamp: req.headers.get("svix-timestamp") || "",
    signature: req.headers.get("svix-signature") || "",
  });
  if (!ok) return new NextResponse(null, { status: 400 });
  let event: { refId?: string; userId?: string; status?: string } = {};
  try {
    event = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const refId = String(event.refId || event.userId || "");
  if (refId.startsWith("vgmf-rider-")) {
    await syncVoveIdKyc({ refId, webhookStatus: String(event.status || "") }).catch(() => null);
  }
  return new NextResponse(null, { status: 204 });
}
