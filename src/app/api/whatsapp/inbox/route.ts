import { addTicket } from "@/lib/server/mobile-store";
import { findAccount } from "@/lib/server/accounts";
import { NextRequest, NextResponse } from "next/server";
import { denyUnlessPortal, portalSessionFrom } from "@/lib/server/portal-auth";
import { addWhatsAppInternalNote, closeWhatsApp, findWhatsAppThread, listWhatsAppThreads, markWhatsAppRead, markWhatsAppTicket, replyOnWhatsApp, sendOrderingFlowFromDesk, startNewWhatsAppChat, transferWhatsApp, waRef } from "@/lib/server/whatsapp-inbox";
import { buildMetaOrderingFlowJson } from "@/lib/server/whatsapp-bot";

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
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    threadId?: string;
    text?: string;
    department?: string;
    assignedTo?: string;
    assignedName?: string;
    name?: string;
    customerEmail?: string;
    subject?: string;
    description?: string;
  } | null;
  const threadId = String(body?.threadId || "");
  const byName = String(body?.name || portal.email || "Desk");
  try {
    if (body?.action === "flow-json") {
      return NextResponse.json({ ok: true, flowJson: buildMetaOrderingFlowJson() });
    }
    if (body?.action === "send-flow") {
      const thread = await sendOrderingFlowFromDesk(threadId, byName);
      return NextResponse.json({ ok: true, thread });
    }
    if (body?.action === "note") {
      const thread = addWhatsAppInternalNote(threadId, String(body.text || ""), byName);
      return NextResponse.json({ ok: true, thread });
    }
    if (body?.action === "start-chat") {
      const thread = await startNewWhatsAppChat({
        phone: String((body as Record<string, unknown>).phone || ""),
        name: String(body.name || ""),
        text: String(body.text || ""),
        sendFlow: Boolean((body as Record<string, unknown>).sendFlow),
        by: byName,
      });
      return NextResponse.json({ ok: true, thread });
    }
    if (body?.action === "read") {
      return NextResponse.json({ ok: true, thread: markWhatsAppRead(threadId) });
    }
    if (body?.action === "reply") {
      const thread = await replyOnWhatsApp(threadId, String(body.text || ""), portal.email || "desk");
      return NextResponse.json({ ok: true, thread });
    }
    if (body?.action === "transfer" || body?.action === "take") {
      const result = await transferWhatsApp({
        threadId,
        department: body.action === "take" ? "" : String(body.department || ""),
        assignedTo: body.action === "take" ? portal.email || "" : String(body.assignedTo || ""),
        assignedName: body.action === "take" ? byName : String(body.assignedName || ""),
        byName,
        byEmail: portal.email || "desk",
      });
      return NextResponse.json({ ok: true, thread: result.thread, noticeSent: result.noticeSent, error: result.noticeError });
    }
    if (body?.action === "close") {
      const result = await closeWhatsApp(threadId, byName, portal.email || "desk");
      return NextResponse.json({ ok: true, thread: result.thread, error: result.noticeError || undefined });
    }
    if (body?.action === "ticket") {
      const thread = findWhatsAppThread(threadId);
      if (!thread) return NextResponse.json({ ok: false, error: "Chat not found." }, { status: 404 });
      const account = findAccount(thread.phone);
      const email = String(body.customerEmail || account?.email || "").trim();
      if (!email) return NextResponse.json({ ok: false, error: "Type the customer's email to raise a ticket." }, { status: 400 });
      const ref = waRef(thread);
      const transcript = thread.messages.filter((m) => !m.system).slice(-40).map((m) => `${m.direction === "in" ? thread.name : m.by || "Desk"}: ${m.text}`).join("\n");
      const ticket = addTicket({
        name: thread.name,
        email,
        phone: `+${thread.phone}`,
        subject: String(body.subject || `WhatsApp chat ${ref}`).slice(0, 160),
        body: `${body.description ? `${String(body.description)}\n\n` : ""}WhatsApp chat ${ref} (raised by ${byName}):\n${transcript}`,
      });
      markWhatsAppTicket(threadId, ticket.id);
      await replyOnWhatsApp(threadId, `Ticket ${ticket.id} was opened for you (chat ref ${ref}). Updates will go to ${ticket.email}.`, portal.email || "desk", { keepUnread: true }).catch(() => null);
      return NextResponse.json({ ok: true, ticket, thread: findWhatsAppThread(threadId) });
    }
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
  }
}
