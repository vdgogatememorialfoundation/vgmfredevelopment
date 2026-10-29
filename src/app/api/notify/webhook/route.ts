import { NextRequest, NextResponse } from "next/server";
import { listWebhooks, pushWebhook } from "@/lib/server/webhooks";

/**
 * Meta Cloud API webhook for WhatsApp message status.
 * Verify token: META_WA_VERIFY_TOKEN. App secret check is optional (META_WA_APP_SECRET).
 */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  const expected = process.env.META_WA_VERIFY_TOKEN?.trim();
  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ events: listWebhooks("meta") });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
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
  return NextResponse.json({ ok: true });
}
