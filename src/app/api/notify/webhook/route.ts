import { NextRequest, NextResponse } from "next/server";
import { metaSignatureOk } from "@/lib/server/providers";
import { pushWebhook } from "@/lib/server/webhooks";
import { applyWhatsAppWebhook, metaAppSecret, whatsAppVerifyToken } from "@/lib/server/whatsapp-inbox";

/**
 * Meta Cloud API webhook. Incoming chats are stored for the admin WhatsApp inbox.
 * Verify token: the value saved under Settings → WhatsApp, or META_WA_VERIFY_TOKEN.
 */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  const allowed = whatsAppVerifyToken();
  const matches = Boolean(token && (token === allowed.env || token === allowed.file));
  if (mode === "subscribe" && matches && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ ok: false }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const secret = metaAppSecret();
  if (!metaSignatureOk(raw, request.headers.get("x-hub-signature-256"), secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ ok: true });
  }
  const entry = Array.isArray(body.entry) ? (body.entry[0] as Record<string, unknown>) : undefined;
  const changes = Array.isArray(entry?.changes) ? (entry.changes[0] as Record<string, unknown>) : undefined;
  const value = (changes?.value as Record<string, unknown>) ?? {};
  const statuses = Array.isArray(value.statuses) ? (value.statuses as Record<string, unknown>[]) : [];
  for (const status of statuses) {
    pushWebhook({
      source: "meta",
      orderId: String(status.id ?? ""),
      status: String(status.status ?? ""),
      payload: status,
    });
  }
  let accepted = { messages: 0, statuses: 0, threads: 0 };
  try {
    accepted = applyWhatsAppWebhook("meta", body);
  } catch {
    /* a bad payload must still return 200 so Meta does not retry forever */
  }
  return NextResponse.json({ ok: true, ...accepted });
}
