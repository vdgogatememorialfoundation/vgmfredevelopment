import { NextRequest, NextResponse } from "next/server";
import { metaSignatureOk } from "@/lib/server/providers";
import { pushWebhook } from "@/lib/server/webhooks";
import { savedAdminIntegrations } from "@/lib/server/admin-integrations";
import { applyWhatsAppWebhook, loadWhatsAppCreds, metaAppSecret, whatsAppVerifyToken } from "@/lib/server/whatsapp-inbox";

/**
 * Meta Cloud API webhook. Incoming chats are stored for the admin WhatsApp inbox.
 * Verify token: the value saved under Settings → WhatsApp, or META_WA_VERIFY_TOKEN.
 */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  const allowed = whatsAppVerifyToken();
  const fromKv = await loadWhatsAppCreds().catch(() => ({}) as Record<string, string>);
  const fromSettings = (savedAdminIntegrations().whatsapp as Record<string, unknown> | undefined)?.metaVerifyToken;
  const tokens = [allowed.env, allowed.file, fromKv.metaVerifyToken, typeof fromSettings === "string" ? fromSettings : ""].map((item) => String(item || "").trim()).filter(Boolean);
  const matches = Boolean(token && tokens.includes(token.trim()));
  if (mode === "subscribe" && matches && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ ok: false }, { status: 403 });
}

/** A Meta app has one callback URL; the seminar portal shares the app, so it gets a copy of every event. */
const FORWARD_TO = (process.env.META_WA_FORWARD_URLS ?? "https://seminar.vaidyagogate.org/api/webhooks/whatsapp")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

function forwardWebhook(raw: string, signature: string | null) {
  for (const url of FORWARD_TO) {
    void fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(signature ? { "x-hub-signature-256": signature } : {}) },
      body: raw,
      signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);
  }
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const secret = metaAppSecret();
  const signature = request.headers.get("x-hub-signature-256");
  if (!metaSignatureOk(raw, signature, secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  forwardWebhook(raw, signature);
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
