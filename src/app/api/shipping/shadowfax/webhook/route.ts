import { NextRequest, NextResponse } from "next/server";
import { refreshStoredShipment } from "@/lib/server/live-track";
import { listShopShipments } from "@/lib/server/shop-shipments";
import { pushWebhook } from "@/lib/server/webhooks";

/**
 * Shadowfax status callbacks (payload template is set per client by Shadowfax).
 * The callback only names the parcel; the status itself is re-read from the tracking API.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const awb = String(body.awb_number ?? body.awb ?? body.request_id ?? "").trim();
  const clientOrderId = String(body.client_order_id ?? "").trim();
  pushWebhook({ source: "shadowfax", awb, orderId: clientOrderId, status: String(body.status_id ?? body.status ?? ""), payload: body });
  const shipment = listShopShipments().find(
    (row) => row.provider === "shadowfax" && row.note !== "Cancelled" && ((awb && row.awb === awb) || (!awb && clientOrderId && row.orderId === clientOrderId))
  );
  if (shipment) void refreshStoredShipment(shipment.orderId, shipment.id).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
