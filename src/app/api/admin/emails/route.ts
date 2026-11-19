import { NextRequest, NextResponse } from "next/server";
import { denyUnlessPortal } from "@/lib/server/portal-auth";
import { loggedEmail, recentEmails } from "@/lib/server/email-log";
import { sendHtmlEmail } from "@/lib/server/mobile-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every email the server sent (newest first), searchable by recipient, subject or order id. */
export async function GET(request: NextRequest) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;
  const q = String(request.nextUrl.searchParams.get("q") ?? "").slice(0, 120);
  const emails = recentEmails(q, 300).map((entry) => ({ ...entry, resendable: Boolean(entry.id && loggedEmail(entry.id)) }));
  return NextResponse.json({ ok: true, emails }, { headers: { "cache-control": "no-store" } });
}

/** Resends a logged email exactly as it was sent, optionally to another address. */
export async function POST(request: NextRequest) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { id?: string; to?: string } | null;
  const found = loggedEmail(String(body?.id ?? ""));
  if (!found) return NextResponse.json({ ok: false, error: "This email was sent before resend was available, so it can't be resent." }, { status: 404 });
  const to = String(body?.to ?? "").trim() || found.entry.to;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  try {
    const sent = await sendHtmlEmail(to, found.entry.subject, found.html);
    if (!sent) return NextResponse.json({ ok: false, error: "No email provider is set up." }, { status: 502 });
    return NextResponse.json({ ok: true, to });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not send." }, { status: 502 });
  }
}
