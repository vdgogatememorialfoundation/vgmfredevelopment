import { NextRequest, NextResponse } from "next/server";
import { commerceViewer } from "@/lib/server/commerce-viewer";
import { issueDeliveryInvoice } from "@/lib/server/delivery-invoice";
import { deleteShopOrder, deletedShopOrderIds, findShopOrder, listShopOrders, orderPhoneMatches, ordersForAccount, searchShopOrders, upsertShopOrder } from "@/lib/server/shop-orders";
import { deleteShopShipments } from "@/lib/server/shop-shipments";
import { redeemPromo } from "@/lib/server/promotions";
import type { Order } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q) {
    if (!commerceViewer(request).portal) return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
    return NextResponse.json({ ok: true, orders: searchShopOrders(q) }, { headers: { "cache-control": "no-store" } });
  }
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const phone = request.nextUrl.searchParams.get("phone") ?? "";
  if (id && phone) {
    const order = findShopOrder(id);
    const match = order && orderPhoneMatches(order, phone) ? [order] : [];
    return NextResponse.json({ ok: true, orders: match }, { headers: { "cache-control": "no-store" } });
  }
  if (request.nextUrl.searchParams.get("sync")) {
    const viewer = commerceViewer(request);
    const orders = viewer.portal
      ? listShopOrders()
      : viewer.email || viewer.phone || viewer.id
        ? ordersForAccount(viewer)
        : [];
    return NextResponse.json({ ok: true, orders, deleted: deletedShopOrderIds() }, { headers: { "cache-control": "no-store" } });
  }
  return NextResponse.json({ ok: true, orders: [] }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { order?: Order; action?: string; orderId?: string } | null;
  if (body?.action === "delete") {
    const viewer = commerceViewer(request);
    if (!viewer.portal) return NextResponse.json({ ok: false, error: "Sign in to the desk." }, { status: 403 });
    const orderId = body.orderId ?? "";
    if (!orderId) return NextResponse.json({ ok: false, error: "Send the order id." }, { status: 400 });
    deleteShopOrder(orderId);
    deleteShopShipments(orderId);
    return NextResponse.json({ ok: true });
  }
  const order = body?.order;
  if (!order || typeof order.id !== "string" || !Array.isArray(order.items)) {
    return NextResponse.json({ ok: false, error: "Send the order." }, { status: 400 });
  }
  upsertShopOrder(order);
  if (order.promo?.code && order.paymentStatus !== "Pending") redeemPromo(order);
  if (order.status === "Delivered") void issueDeliveryInvoice(order.id);
  return NextResponse.json({ ok: true });
}
