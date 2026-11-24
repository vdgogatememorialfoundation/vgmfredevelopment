import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, readMobileFeed } from "@/lib/server/mobile-feed";
import { bearerToken, listTickets, sessionFromToken } from "@/lib/server/mobile-store";
import { listMobileNotifications, renderOrderStageNotification, type OrderStageKey } from "@/lib/server/mobile-notifications";
import { ordersForEmail } from "@/lib/server/shop-orders";
import type { Order } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { ...corsHeaders, "cache-control": "no-store" } });
}

const STAGE_ORDER: { key: OrderStageKey; statuses: string[] }[] = [
  { key: "ordered", statuses: ["Paid", "Ordered", "Accepted", "Processing", "Awaiting Confirmation", "Packed", "Ready to Ship", "To Ship", "Shipped", "Out for Delivery", "Delivered"] },
  { key: "packed", statuses: ["Packed", "Ready to Ship", "To Ship", "Shipped", "Out for Delivery", "Delivered"] },
  { key: "shipped", statuses: ["Shipped", "Out for Delivery", "Delivered"] },
  { key: "out_for_delivery", statuses: ["Out for Delivery", "Delivered"] },
  { key: "delivered", statuses: ["Delivered"] },
];

function stageTimestamp(order: Order, key: OrderStageKey): string {
  const hist = order.history ?? [];
  const matcher: Record<OrderStageKey, RegExp> = {
    ordered: /^(Paid|Ordered|Accepted|Processing)$/i,
    packed: /^(Packed|Ready to Ship|To Ship)$/i,
    shipped: /^Shipped$/i,
    out_for_delivery: /^Out for Delivery$/i,
    delivered: /^Delivered$/i,
  };
  const found = hist.find((h) => matcher[key].test(String(h.status || "")));
  return found?.at || order.paidAt || order.date || new Date().toISOString();
}

export async function GET(request: NextRequest) {
  const token = bearerToken(request.headers.get("authorization"));
  const session = sessionFromToken(token ?? "");
  if (!session) return json({ ok: false, error: "Sign in again." }, 401);
  const feed = readMobileFeed();
  const email = session.email.trim().toLowerCase();
  const pinnedItems: { id: string; title: string; body: string; href: string; at: string; kind: string }[] = [];
  const items: { id: string; title: string; body: string; href: string; at: string; kind: string }[] = [];

  // 1. Custom Admin-published mobile notifications
  for (const n of listMobileNotifications()) {
    if (!n.active) continue;
    if (n.target !== "all" && n.target !== email) continue;
    const row = {
      id: n.id,
      title: n.title,
      body: n.body,
      href: n.href || "/",
      at: n.updatedAt || n.createdAt,
      kind: n.category || "announcement",
    };
    if (n.pinned) pinnedItems.push(row);
    else items.push(row);
  }

  // 2. Customer's Order Event Notifications: Ordered, Packed, Shipped, Out for Delivery, Delivered
  const myOrders = ordersForEmail(email).filter((o) => !o.splitInto?.length && o.status !== "Pending" && o.status !== "Cancelled").slice(0, 20);
  for (const order of myOrders) {
    for (const def of STAGE_ORDER) {
      if (!def.statuses.includes(order.status)) continue;
      const rendered = renderOrderStageNotification(def.key, order);
      if (!rendered.enabled) continue;
      items.push({
        id: `order-${order.id}-${def.key}`,
        title: rendered.title,
        body: rendered.body,
        href: `/order/${order.id}`,
        at: stageTimestamp(order, def.key),
        kind: "order",
      });
    }
  }

  // 3. Notices, Events, Announcements & Tickets
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
  return json({ ok: true, items: [...pinnedItems, ...items].slice(0, 100) });
}
