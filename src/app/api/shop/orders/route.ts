import { NextRequest, NextResponse } from "next/server";
import { commerceViewer, customerViewer } from "@/lib/server/commerce-viewer";
import { issueDeliveryInvoice } from "@/lib/server/delivery-invoice";
import { deleteShopOrder, deletedShopOrderIds, findShopOrder, patchShopOrder, listShopOrders, orderPhoneMatches, ordersForAccount, searchShopOrders, upsertShopOrder, forCustomer } from "@/lib/server/shop-orders";
import { deleteShopShipments } from "@/lib/server/shop-shipments";
import { redeemPromo } from "@/lib/server/promotions";
import { ensureGuestAccount } from "@/lib/server/guest-account";
import { inviteOrderFeedback } from "@/lib/server/forms";
import { readMobileFeed } from "@/lib/server/mobile-feed";
import { canCustomerCancel, customerCancellationRefund, preorderLate, publicOrderSettings, type OrderSettings } from "@/lib/integrations";
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
    const match = order && orderPhoneMatches(order, phone) ? [forCustomer(order)] : [];
    return NextResponse.json({ ok: true, orders: match }, { headers: { "cache-control": "no-store" } });
  }
  if (request.nextUrl.searchParams.get("sync")) {
    const viewer = commerceViewer(request);
    const orders = viewer.portal
      ? listShopOrders()
      : viewer.email || viewer.phone || viewer.id
        ? ordersForAccount(viewer).map(forCustomer)
        : [];
    return NextResponse.json({ ok: true, orders, deleted: deletedShopOrderIds() }, { headers: { "cache-control": "no-store" } });
  }
  return NextResponse.json({ ok: true, orders: [] }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { order?: Order; action?: string; orderId?: string; reason?: string; phone?: string } | null;
  if (body?.action === "cancel") {
    const orderId = String(body.orderId ?? "");
    const order = findShopOrder(orderId);
    // A staff sign-in in the same browser must not hide the customer's own session.
    const viewers = [customerViewer(request), commerceViewer(request)].filter((viewer) => viewer && (viewer.email || viewer.phone || viewer.id));
    const owns = Boolean(
      order &&
        (viewers.some((viewer) => ordersForAccount(viewer!).some((item) => item.id === orderId)) ||
          (body.phone && orderPhoneMatches(order, String(body.phone))))
    );
    if (!order || !owns) return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
    const settings = publicOrderSettings(readMobileFeed().orderSettings as Partial<OrderSettings> | undefined);
    if (!canCustomerCancel(order, settings)) {
      return NextResponse.json({ ok: false, error: "This order can no longer be cancelled from your account. Please contact the Foundation desk." }, { status: 400 });
    }
    const refund = customerCancellationRefund(order, settings);
    const late = preorderLate(order, settings);
    const fee = late ? 0 : settings.cancellation.fee;
    const reason = String(body.reason ?? "").trim().slice(0, 300) || "Cancelled by the customer";
    const note = refund > 0
      ? `Cancelled by the customer. A refund of ₹${refund} will be sent to the original payment method${late ? " (pre-order delayed: full refund including the platform fee)" : fee > 0 ? ` (₹${fee} cancellation fee kept)` : ""}.`
      : "Cancelled by the customer.";
    const next = patchShopOrder(order.id, {
      status: "Cancelled",
      cancelReason: reason,
      history: [...(order.history ?? []), { at: new Date().toISOString(), status: "Cancelled", note, by: "Customer" }],
    });
    return NextResponse.json({ ok: true, order: next ? forCustomer(next) : undefined });
  }
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
  const isNew = !findShopOrder(order.id);
  upsertShopOrder(order, { quiet: commerceViewer(request).portal });
  if (isNew && !commerceViewer(request).portal && (!order.userId || order.userId === "guest")) void ensureGuestAccount(order);
  if (order.promo?.code && order.paymentStatus !== "Pending") redeemPromo(order);
  if (order.status === "Delivered") {
    void issueDeliveryInvoice(order.id);
    void inviteOrderFeedback(order.id);
  }
  return NextResponse.json({ ok: true });
}
