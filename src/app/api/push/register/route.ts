import { NextRequest, NextResponse } from "next/server";
import { commerceViewer } from "@/lib/server/commerce-viewer";
import { savePushDevice } from "@/lib/server/push-devices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { token?: string; platform?: string } | null;
  const token = String(body?.token ?? "").trim();
  if (!token || token.length > 4096) return NextResponse.json({ ok: false, error: "Send the device token." }, { status: 400 });
  const viewer = commerceViewer(request);
  savePushDevice({
    token,
    platform: String(body?.platform ?? "unknown").slice(0, 20),
    email: viewer.email || undefined,
    phone: viewer.phone || undefined,
    accountId: viewer.id || undefined,
    updatedAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}
