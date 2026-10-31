import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, readMobileFeed } from "@/lib/server/mobile-feed";
import { bearerToken, listTickets, sessionFromToken } from "@/lib/server/mobile-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { ...corsHeaders, "cache-control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const token = bearerToken(request.headers.get("authorization"));
  const session = sessionFromToken(token ?? "");
  if (!session) return json({ ok: false, error: "Sign in again." }, 401);
  const feed = readMobileFeed();
  const items: { id: string; title: string; body: string; href: string; at: string; kind: string }[] = [];

  for (const notice of feed.notices ?? []) {
    items.push({
      id: `notice-${notice.id}`,
      title: String(notice.title || "Notice"),
      body: String(notice.description || notice.title || ""),
      href: "/notices",
      at: String(notice.date || notice.publishAt || feed.publishedAt || new Date().toISOString()),
      kind: "notice",
    });
  }
  for (const event of feed.events ?? []) {
    items.push({
      id: `event-${event.id}`,
      title: String(event.name || "Event"),
      body: [event.venue, event.startDate].filter(Boolean).join(" · "),
      href: `/event/${event.id}`,
      at: String(event.startDate || event.publishAt || feed.publishedAt || new Date().toISOString()),
      kind: "event",
    });
  }
  for (const row of feed.announcements ?? []) {
    items.push({
      id: `announcement-${row.id}`,
      title: String(row.title || "Announcement"),
      body: String(row.description || row.title || ""),
      href: "/announcements",
      at: String(row.date || row.publishAt || feed.publishedAt || new Date().toISOString()),
      kind: "announcement",
    });
  }
  for (const ticket of listTickets(session.email)) {
    items.push({
      id: `ticket-${ticket.id}`,
      title: `Ticket ${ticket.id}`,
      body: ticket.subject,
      href: "/account/tickets",
      at: ticket.createdAt,
      kind: "ticket",
    });
  }

  items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return json({ ok: true, items: items.slice(0, 80) });
}
