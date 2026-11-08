import { NextRequest, NextResponse } from "next/server";
import { commerceViewer } from "@/lib/server/commerce-viewer";
import { allTickets, findTicket, normalizeTicket, ownsTicket, saveTicket, ticketsFor } from "@/lib/server/support-tickets";
import type { SupportTicket } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const viewer = commerceViewer(request);
  if (viewer.portal) return json({ ok: true, tickets: allTickets() });
  if (!viewer.email && !viewer.id) return json({ ok: false, error: "Sign in to see your tickets." }, 401);
  return json({ ok: true, tickets: ticketsFor(viewer.email, viewer.id) });
}

export async function POST(request: NextRequest) {
  const viewer = commerceViewer(request);
  const body = (await request.json().catch(() => null)) as { ticket?: Partial<SupportTicket> } | null;
  const incoming = body?.ticket;
  if (!incoming?.id) return json({ ok: false, error: "Send the ticket." }, 400);
  if (viewer.portal) return json({ ok: true, ticket: saveTicket(incoming) });
  const clean = normalizeTicket(incoming);
  const existing = findTicket(clean.id);
  if (existing) {
    if (!ownsTicket(existing, viewer.email, viewer.id)) return json({ ok: false, error: "This ticket belongs to another account." }, 403);
    const closed = existing.status === "Resolved" || existing.status === "Closed";
    return json({
      ok: true,
      ticket: saveTicket({ ...existing, responses: clean.responses, status: closed && clean.status === "Open" ? "Open" : existing.status, updatedAt: clean.updatedAt }),
    });
  }
  if (viewer.email && clean.email !== viewer.email) return json({ ok: false, error: "This ticket belongs to another account." }, 403);
  if (!clean.email || !clean.subject || !clean.body) return json({ ok: false, error: "Add a subject and message." }, 400);
  return json({ ok: true, ticket: saveTicket({ ...clean, status: "Open", assignedTo: undefined, portal: clean.portal ?? "customer" }) });
}
