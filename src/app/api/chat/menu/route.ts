import { NextRequest, NextResponse } from "next/server";
import { customerViewer } from "@/lib/server/commerce-viewer";
import { findAccount } from "@/lib/server/accounts";
import { chatBotReply } from "@/lib/server/whatsapp-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The chat self-service menu (same as WhatsApp) for a signed-in website customer. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { text?: string } | null;
  const text = String(body?.text ?? "").trim().slice(0, 500);
  if (!text) return NextResponse.json({ ok: false, error: "Type a message." }, { status: 400 });
  const viewer = customerViewer(request);
  if (!viewer?.email) {
    return NextResponse.json({ ok: true, signIn: true, reply: "Please sign in (top right → Sign in) to order books, see your orders or your account here. You can also message us on WhatsApp." });
  }
  const account = findAccount(viewer.email);
  const phone = (account?.whatsapp || account?.phone || "").replace(/\D/g, "");
  const reply = await chatBotReply(`web:${viewer.email.toLowerCase()}`, phone, text, account?.firstName);
  return NextResponse.json({ ok: true, reply: reply ?? "Our team has this chat. Use the Live tab to talk to them, or type menu." });
}
