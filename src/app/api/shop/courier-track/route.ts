import { NextRequest, NextResponse } from "next/server";
import { findShopOrder, listShopOrders } from "@/lib/server/shop-orders";
import { findShopShipment, listShopShipments } from "@/lib/server/shop-shipments";
import { refreshStoredShipment } from "@/lib/server/live-track";
import { isVgmfOwnShipment } from "@/lib/server/vgmf-logistics";
import { customerCourierLabel, isOwnFleet } from "@/lib/courier-label";
import { buildTrackingStages, isHyperlocalProvider, shipmentScans } from "@/lib/order-pipeline";
import type { ShipmentRecord } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const normal = (value: unknown) => String(value ?? "").replace(/\s+/g, "").toUpperCase();
const lastRead = new Map<string, number>();
const headers = { "cache-control": "no-store" };

const inHouse = (s: ShipmentRecord) => s.provider === "local" || isVgmfOwnShipment(s) || isOwnFleet(s.provider) || isHyperlocalProvider(s.provider, undefined, s.courier);

async function publicView(shipment: ShipmentRecord) {
  const order = findShopOrder(shipment.orderId);
  if (!order) return null;
  const terminal = ["Delivered", "Cancelled", "Returned"].includes(shipment.status);
  if (!terminal && Date.now() - (lastRead.get(shipment.id) ?? 0) > 60_000) {
    lastRead.set(shipment.id, Date.now());
    await refreshStoredShipment(order.id, shipment.id).catch(() => null);
    shipment = findShopShipment(order.id, shipment.id) ?? shipment;
  }
  const { stages } = buildTrackingStages(order, shipmentScans(shipment), shipment);
  const last = [...(shipment.tracking ?? [])].pop();
  return {
    orderId: order.id,
    courier: customerCourierLabel({ provider: shipment.provider, courier: shipment.courier }),
    awb: shipment.awb,
    status: shipment.status,
    expectedBy: shipment.status === "Delivered" ? "" : shipment.expectedBy || "",
    destination: [order.deliveryAddress?.city, order.deliveryAddress?.state].filter(Boolean).join(", "),
    lastEvent: last ? { at: last.at, status: last.status, location: last.location || "" } : null,
    stages: stages.map((stage) => ({
      id: stage.id,
      label: stage.label,
      caption: stage.caption,
      reached: stage.reached,
      partial: stage.partial,
      events: stage.events.map((event) => ({ id: event.id, title: event.title, at: event.at, reached: event.reached, location: event.location })),
    })),
  };
}

/** Public tracking for outside couriers by AWB or order ID. Our own deliveries (own logistics, Tookan, Shipday) are not shown. No personal details are returned. */
export async function GET(request: NextRequest) {
  const q = normal(request.nextUrl.searchParams.get("q") || request.nextUrl.searchParams.get("awb") || request.nextUrl.searchParams.get("order"));
  if (q.length < 6) return NextResponse.json({ ok: false, error: "Enter your AWB (tracking number) or order ID." }, { status: 400, headers });
  const all = listShopShipments().filter((item) => item.note !== "Cancelled");
  const byAwb = all.filter((item) => normal(item.awb) === q);
  let found = byAwb;
  if (!found.length) {
    const order = findShopOrder(q) ?? listShopOrders().find((row) => normal(row.id) === q);
    if (order) {
      const ids = new Set([order.id, ...(order.splitInto ?? []).map((part) => part.id)]);
      found = all.filter((item) => ids.has(item.orderId));
      if (!found.length) {
        return NextResponse.json({ ok: false, error: "This order hasn't been handed to a courier yet. You'll get the tracking number by WhatsApp and email once it ships.", orderFound: true }, { status: 404, headers });
      }
    }
  }
  if (!found.length) return NextResponse.json({ ok: false, error: "No shipment matches that AWB or order ID. Check the number in your shipping message." }, { status: 404, headers });
  const outside = found.filter((item) => !inHouse(item));
  if (!outside.length) {
    return NextResponse.json({ ok: false, error: "This order is delivered by our own delivery team. Sign in and open My Orders to see live tracking.", ownFleet: true }, { status: 404, headers });
  }
  const shipments = (await Promise.all(outside.map(publicView))).filter(Boolean);
  return NextResponse.json({ ok: true, query: q, shipments, checkedAt: new Date().toISOString() }, { headers });
}
