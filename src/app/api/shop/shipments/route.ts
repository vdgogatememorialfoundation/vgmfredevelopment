import { NextRequest, NextResponse } from "next/server";
import { phonesMatch } from "@/lib/commerce-stamp";
import { commerceViewer } from "@/lib/server/commerce-viewer";
import { refreshStoredShipment } from "@/lib/server/live-track";
import { findShopOrder, orderPhoneMatches } from "@/lib/server/shop-orders";
import { findShopShipment, listShopShipments, upsertShopShipment } from "@/lib/server/shop-shipments";
import type { Order, ShipmentRecord } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function allowed(request: NextRequest, order: Order | undefined, shipment: ShipmentRecord | undefined, phone: string) {
  const viewer = commerceViewer(request);
  if (viewer.portal) return true;
  if (phone && order && orderPhoneMatches(order, phone)) return true;
  if (phone && shipment && phonesMatch(shipment.toAddress?.phone, phone)) return true;
  if (viewer.email && order && (order.deliveryAddress?.email ?? "").toLowerCase() === viewer.email) return true;
  return false;
}

export async function GET(request: NextRequest) {
  const viewer = commerceViewer(request);
  const orderId = request.nextUrl.searchParams.get("orderId") ?? "";
  const phone = request.nextUrl.searchParams.get("phone") ?? "";
  const sync = request.nextUrl.searchParams.get("sync");
  if (sync) {
    if (viewer.portal) return NextResponse.json({ ok: true, shipments: listShopShipments() }, { headers: { "cache-control": "no-store" } });
    if (viewer.email) {
      const mine = listShopShipments().filter((shipment) => {
        const order = findShopOrder(shipment.orderId);
        return (order?.deliveryAddress?.email ?? "").toLowerCase() === viewer.email;
      });
      return NextResponse.json({ ok: true, shipments: mine }, { headers: { "cache-control": "no-store" } });
    }
    return NextResponse.json({ ok: true, shipments: [] }, { headers: { "cache-control": "no-store" } });
  }
  if (!orderId) return NextResponse.json({ ok: true, shipment: null });
  const order = findShopOrder(orderId);
  const shipment = findShopShipment(orderId) ?? null;
  if (!allowed(request, order, shipment ?? undefined, phone)) {
    return NextResponse.json({ ok: false, error: "Sign in, or enter the mobile number on the order." }, { status: 403 });
  }
  return NextResponse.json({ ok: true, shipment }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { shipment?: ShipmentRecord; action?: string; orderId?: string; phone?: string }
    | null;
  if (body?.action === "refresh") {
    const orderId = body.orderId ?? "";
    if (!orderId) return NextResponse.json({ ok: false, error: "Send the order id." }, { status: 400 });
    const order = findShopOrder(orderId);
    const shipment = findShopShipment(orderId) ?? undefined;
    if (!allowed(request, order, shipment, body.phone ?? "")) {
      return NextResponse.json({ ok: false, error: "Sign in, or enter the mobile number on the order." }, { status: 403 });
    }
    const result = await refreshStoredShipment(orderId);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  }
  const shipment = body?.shipment;
  if (!shipment || typeof shipment.id !== "string" || typeof shipment.orderId !== "string") {
    return NextResponse.json({ ok: false, error: "Send the shipment." }, { status: 400 });
  }
  upsertShopShipment(shipment);
  return NextResponse.json({ ok: true });
}
