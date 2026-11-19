import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { addTicket, bearerToken, listTickets, sessionFromToken, ticketRateLimited } from "@/lib/server/mobile-store";
import { findTicket, ownsTicket, replyToTicket } from "@/lib/server/support-tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { ...corsHeaders, "cache-control": "no-store" } });
}

function sessionOf(request: NextRequest, body?: Record<string, unknown> | null) {
  return sessionFromToken(bearerToken(request.headers.get("authorization")) ?? String(body?.token ?? ""));
}

export async function GET(request: NextRequest) {
  const session = sessionOf(request);
  if (!session) return json({ ok: false, error: "Sign in to view tickets." }, 401);
  return json({ ok: true, tickets: listTickets(session.email) });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const session = sessionOf(request, body);
  if (body?.action === "reply") {
    if (!session) return json({ ok: false, error: "Sign in to reply." }, 401);
    const ticket = findTicket(String(body.id ?? ""));
    const text = String(body.body ?? "").trim().slice(0, 5000);
    if (!ticket || !ownsTicket(ticket, session.email)) return json({ ok: false, error: "Ticket not found." }, 404);
    if (!text) return json({ ok: false, error: "Write a reply." }, 400);
    return json({ ok: true, ticket: replyToTicket(ticket.id, session.name || ticket.name || "Customer", text) });
  }
  const email = (session?.email || String(body?.email ?? "")).trim().toLowerCase();
  const name = (session ? session.name || String(body?.name ?? "").trim() : String(body?.name ?? "").trim());
  const subject = String(body?.subject ?? "").trim();
  const text = String(body?.body ?? "").trim();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return json({ ok: false, error: "Enter the email for this ticket." }, 400);
  if (!name) return json({ ok: false, error: "Enter your name." }, 400);
  if (!subject || !text) return json({ ok: false, error: "Add a subject and message." }, 400);
  if (ticketRateLimited(email)) return json({ ok: false, error: "Wait a few minutes before sending another ticket." }, 429);
  try {
    const ticket = addTicket({
      name,
      email,
      phone: body?.phone ? String(body.phone) : undefined,
      subject,
      body: text,
    });
    return json({ ok: true, ticket });
  } catch (error) {
    return json({ ok: false, error: (error as Error).message || "Could not create the ticket." }, 400);
  }
}
