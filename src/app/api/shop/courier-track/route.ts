import { NextRequest, NextResponse } from "next/server";
import { findShopOrder } from "@/lib/server/shop-orders";
import { findShopShipment, listShopShipments } from "@/lib/server/shop-shipments";
import { refreshStoredShipment } from "@/lib/server/live-track";
import { isVgmfOwnShipment } from "@/lib/server/vgmf-logistics";
import { customerCourierLabel, isOwnFleet } from "@/lib/courier-label";
import { buildTrackingStages, isHyperlocalProvider, shipmentScans } from "@/lib/order-pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const normal = (value: unknown) => String(value ?? "").replace(/\s+/g, "").toUpperCase();
const lastRead = new Map<string, number>();

/** Public tracking by courier AWB only. Our own deliveries (own logistics, Tookan, Shipday) are not listed here. No personal details are returned. */
export async function GET(request: NextRequest) {
  const awb = normal(request.nextUrl.searchParams.get("awb"));
  const headers = { "cache-control": "no-store" };
  if (awb.length < 6) return NextResponse.json({ ok: false, error: "Enter the courier tracking (AWB) number." }, { status: 400, headers });
  const notFound = NextResponse.json({ ok: false, error: "No courier shipment matches that tracking number." }, { status: 404, headers });
  let shipment = listShopShipments().find((item) => normal(item.awb) === awb && item.note !== "Cancelled");
  if (!shipment) return notFound;
  const inHouse =
    shipment.provider === "local" ||
    isVgmfOwnShipment(shipment) ||
    isOwnFleet(shipment.provider) ||
    isHyperlocalProvider(shipment.provider, undefined, shipment.courier);
  if (inHouse) return notFound;
  const order = findShopOrder(shipment.orderId);
  if (!order) return notFound;
  const terminal = ["Delivered", "Cancelled", "Returned"].includes(shipment.status);
  if (!terminal && Date.now() - (lastRead.get(shipment.id) ?? 0) > 60_000) {
    lastRead.set(shipment.id, Date.now());
    await refreshStoredShipment(order.id, shipment.id).catch(() => null);
    shipment = findShopShipment(order.id, shipment.id) ?? shipment;
  }
  const { stages } = buildTrackingStages(order, shipmentScans(shipment), shipment);
  const place = [order.deliveryAddress?.city, order.deliveryAddress?.state].filter(Boolean).join(", ");
  return NextResponse.json(
    {
      ok: true,
      courier: customerCourierLabel({ provider: shipment.provider, courier: shipment.courier }),
      awb: shipment.awb,
      status: shipment.status,
      expectedBy: shipment.status === "Delivered" ? "" : shipment.expectedBy || "",
      destination: place,
      stages: stages.map((stage) => ({
        id: stage.id,
        label: stage.label,
        caption: stage.caption,
        reached: stage.reached,
        partial: stage.partial,
        events: stage.events.map((event) => ({ id: event.id, title: event.title, at: event.at, reached: event.reached, location: event.location })),
      })),
    },
    { headers }
  );
}
