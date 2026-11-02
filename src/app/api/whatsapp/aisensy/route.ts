import { NextRequest, NextResponse } from "next/server";
import { aisensyWebhookToken, applyWhatsAppWebhook } from "@/lib/server/whatsapp-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const expected = aisensyWebhookToken();
  const provided = request.nextUrl.searchParams.get("token") || request.headers.get("x-aisensy-token") || "";
  if (expected && provided !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const result = applyWhatsAppWebhook("aisensy", body);
  return NextResponse.json({ ok: true, ...result });
}
