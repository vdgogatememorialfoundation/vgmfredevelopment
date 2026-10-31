import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { addTicket, bearerToken, sessionFromToken } from "@/lib/server/mobile-store";
import { portalSessionFrom } from "@/lib/server/portal-auth";
import {
  CHAT_DEPARTMENTS,
  closeChatThread,
  getChatThread,
  listChatThreads,
  markThreadTicket,
  nextAgentName,
  postLiveMessage,
  takeChatThread,
  transferChatThread,
  visitorTranscript,
} from "@/lib/server/live-chat-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { ...corsHeaders, "cache-control": "no-store" } });
}

function staffOf(request: NextRequest) {
  const portal = portalSessionFrom(request);
  if (portal?.email) {
    return { email: portal.email, name: portal.email.split("@")[0], staff: true };
  }
  const session = sessionFromToken(bearerToken(request.headers.get("authorization")) ?? "");
  if (session) return { email: session.email, name: session.name, staff: false, session };
  return null;
}

export async function GET(request: NextRequest) {
  const who = staffOf(request);
  const threadId = request.nextUrl.searchParams.get("threadId") || "";
  const portal = portalSessionFrom(request);
  if (!portal && !who?.email && !threadId) {
    return json({ ok: true, threads: [], departments: CHAT_DEPARTMENTS });
  }
  const threads = portal
    ? listChatThreads({ staff: true })
    : listChatThreads({ email: who?.email, id: threadId || undefined });
  return json({ ok: true, threads, departments: CHAT_DEPARTMENTS });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "post");
  const who = staffOf(request);
  const portal = portalSessionFrom(request);
  const agentName = String(body?.agentName ?? who?.name ?? "Foundation Support");
  const agentEmail = String(body?.agentEmail ?? who?.email ?? "");

  if (action === "list") {
    const threads = portal ? listChatThreads({ staff: true }) : listChatThreads({ email: who?.email, id: String(body?.threadId ?? "") || undefined });
    return json({ ok: true, threads, departments: CHAT_DEPARTMENTS });
  }

  if (action === "post") {
    const thread = postLiveMessage({
      threadId: String(body?.threadId ?? "") || undefined,
      from: portal ? "staff" : "visitor",
      name: String(body?.name ?? who?.name ?? "Member"),
      text: String(body?.text ?? ""),
      email: String(body?.email ?? who?.email ?? ""),
      phone: String(body?.phone ?? ""),
      page: String(body?.page ?? "app"),
      kind: (body?.kind as "text" | "image" | "video" | "voice") || "text",
      mediaUrl: String(body?.mediaUrl ?? "") || undefined,
    });
    return json({ ok: true, thread });
  }

  if (!portal) {
    return json({ ok: false, error: "Staff sign-in is required for this action." }, 401);
  }

  const threadId = String(body?.threadId ?? "");
  if (!threadId) return json({ ok: false, error: "Choose a chat." }, 400);

  if (action === "take") {
    return json({ ok: true, thread: takeChatThread(threadId, agentEmail, agentName) });
  }
  if (action === "close") {
    return json({ ok: true, thread: closeChatThread(threadId, agentName) });
  }
  if (action === "transfer") {
    const department = String(body?.department ?? "");
    const assignedName = String(body?.assignedName ?? (department ? `${department} desk` : "next agent"));
    return json({
      ok: true,
      thread: transferChatThread(threadId, String(body?.assignedTo ?? ""), assignedName, agentName, department || undefined),
    });
  }
  if (action === "next") {
    const agents = Array.isArray(body?.agents) ? (body?.agents as { email: string; name: string }[]) : [];
    const next = nextAgentName(agents);
    return json({
      ok: true,
      thread: transferChatThread(threadId, next.email, next.name, agentName),
      next,
    });
  }
  if (action === "ticket") {
    const thread = getChatThread(threadId);
    if (!thread) return json({ ok: false, error: "Chat not found." }, 404);
    const customerEmail = String(body?.customerEmail ?? thread.email ?? "").trim();
    if (!customerEmail) return json({ ok: false, error: "Customer email is required to raise a ticket." }, 400);
    const ticket = addTicket({
      name: String(body?.customerName ?? thread.name),
      email: customerEmail,
      phone: String(body?.customerPhone ?? thread.phone ?? ""),
      subject: String(body?.subject ?? `Chat ${thread.id}`),
      body: visitorTranscript(thread),
    });
    markThreadTicket(threadId, ticket.id);
    postLiveMessage({
      threadId,
      from: "staff",
      name: agentName,
      text: `Ticket ${ticket.id} was opened on your behalf. Updates will go to ${ticket.email}.`,
    });
    return json({ ok: true, ticket, thread: getChatThread(threadId) });
  }

  return json({ ok: false, error: "Unknown action." }, 400);
}
