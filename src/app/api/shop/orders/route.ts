import { NextRequest, NextResponse } from "next/server";
import { commerceViewer } from "@/lib/server/commerce-viewer";
import { findShopOrder, listShopOrders, orderPhoneMatches, ordersForEmail, searchShopOrders, upsertShopOrder } from "@/lib/server/shop-orders";
import type { Order } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q) return NextResponse.json({ ok: true, orders: searchShopOrders(q) }, { headers: { "cache-control": "no-store" } });
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const phone = request.nextUrl.searchParams.get("phone") ?? "";
  if (id && phone) {
    const order = findShopOrder(id);
    const match = order && orderPhoneMatches(order, phone) ? [order] : [];
    return NextResponse.json({ ok: true, orders: match }, { headers: { "cache-control": "no-store" } });
  }
  if (request.nextUrl.searchParams.get("sync")) {
    const viewer = commerceViewer(request);
    const orders = viewer.portal ? listShopOrders() : viewer.email ? ordersForEmail(viewer.email) : [];
    return NextResponse.json({ ok: true, orders }, { headers: { "cache-control": "no-store" } });
  }
  return NextResponse.json({ ok: true, orders: [] }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { order?: Order } | null;
  const order = body?.order;
  if (!order || typeof order.id !== "string" || !Array.isArray(order.items)) {
    return NextResponse.json({ ok: false, error: "Send the order." }, { status: 400 });
  }
  upsertShopOrder(order);
  return NextResponse.json({ ok: true });
}
