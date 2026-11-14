import { NextRequest, NextResponse } from "next/server";
import { listWebhooks, pushWebhook } from "@/lib/server/webhooks";
import { refreshStoredShipment } from "@/lib/server/live-track";
import { listShopShipments } from "@/lib/server/shop-shipments";

/**
 * Shiprocket Settings → API → Webhooks.
 * POST JSON tracking payload. Optional header x-api-key must match SHIPROCKET_WEBHOOK_TOKEN when that env is set.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.SHIPROCKET_WEBHOOK_TOKEN?.trim();
  const provided = request.headers.get("x-api-key") ?? "";
  if (expected && provided !== expected) {
    return NextResponse.json({ ok: false, error: "Invalid webhook token." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const awb = String(body.awb ?? "");
  const status = String(body.current_status ?? body.shipment_status ?? "");
  pushWebhook({
    source: "shiprocket",
    awb,
    orderId: String(body.order_id ?? body.sr_order_id ?? ""),
    status,
    payload: body,
  });
  // Undelivered, delivery failed, RTO and every other courier update reaches the order straight away.
  const shipment = awb ? listShopShipments().find((row) => row.awb === awb && row.note !== "Cancelled") : undefined;
  if (shipment) await refreshStoredShipment(shipment.orderId, shipment.id).catch(() => undefined);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, events: listWebhooks("shiprocket") });
}
