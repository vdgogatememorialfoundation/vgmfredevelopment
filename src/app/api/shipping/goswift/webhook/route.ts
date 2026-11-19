import { NextRequest, NextResponse } from "next/server";
import { refreshStoredShipment } from "@/lib/server/live-track";
import { listShopShipments } from "@/lib/server/shop-shipments";
import { pushWebhook } from "@/lib/server/webhooks";

/**
 * GoSwift track_updated / shipment_created events. The payload is only a nudge: the shipment is
 * re-read from GoSwift's tracking API, so a forged post cannot change an order.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id ?? "").trim();
  const wbn = String(body.wbn ?? "").trim();
  pushWebhook({ source: "goswift", awb: id || wbn, orderId: String(body.orderNumber ?? ""), status: String(body.status ?? ""), payload: body });
  const shipment = listShopShipments().find(
    (row) => row.provider === "goswift" && row.note !== "Cancelled" && ((id && row.awb === id) || (wbn && row.providerShipmentId === wbn))
  );
  if (shipment) await refreshStoredShipment(shipment.orderId, shipment.id).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
