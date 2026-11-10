import { refreshStoredShipment } from "@/lib/server/live-track";
import { listShopShipments } from "@/lib/server/shop-shipments";
import { listShopOrders, patchShopOrder } from "@/lib/server/shop-orders";
import { razorpayCreds, razorpayRefundStatus } from "@/lib/server/providers";
import type { RefundRecord } from "@/types";

const EVERY_MS = 3 * 60 * 1000;
const DONE = new Set(["Delivered", "Failed", "Cancelled", "RTO Delivered"]);

let started = false;
let running = false;

/** Polls every open courier shipment (provider APIs and manual courier websites) so orders move even when nobody has the page open. */
export async function syncOpenShipments() {
  if (running) return;
  running = true;
  try {
    const open = listShopShipments().filter(
      (shipment) =>
        shipment.awb &&
        shipment.note !== "Cancelled" &&
        !DONE.has(String(shipment.status)) &&
        (shipment.directCourier || (shipment.live && shipment.provider && shipment.provider !== "local"))
    );
    for (const shipment of open) {
      try {
        await refreshStoredShipment(shipment.orderId, shipment.id);
      } catch {
        /* one courier failing must not stop the rest */
      }
    }
  } finally {
    running = false;
  }
}

/** Reads open Razorpay refunds back from the gateway, so the status and bank RRN/ARN reach the customer without anyone pressing "Check status". */
export async function syncOpenRefunds() {
  const creds = razorpayCreds({});
  if (!creds) return;
  const open = (refund: RefundRecord) => refund.gatewayRefundId && refund.status !== "processed" && refund.status !== "failed";
  for (const order of listShopOrders().filter((item) => item.refunds?.some(open))) {
    try {
      const now = new Date().toISOString();
      const history = [...(order.history ?? [])];
      const refunds: RefundRecord[] = [];
      for (const refund of order.refunds ?? []) {
        if (!open(refund)) {
          refunds.push(refund);
          continue;
        }
        const result = await razorpayRefundStatus(creds, refund.gatewayRefundId!);
        const status = result.status === "processed" || result.status === "failed" ? result.status : "pending";
        const next: RefundRecord = {
          ...refund,
          status,
          rrn: result.rrn || refund.rrn,
          arn: result.arn || refund.arn,
          utr: result.utr || refund.utr,
          speed: result.speed || refund.speed,
          processedAt: status === "processed" ? refund.processedAt || now : refund.processedAt,
          checkedAt: now,
        };
        if (status !== refund.status) {
          const bank = [next.rrn && `RRN ${next.rrn}`, next.arn && `ARN ${next.arn}`].filter(Boolean).join(" · ");
          history.push({ at: now, status: order.status, note: [`Refund ${status} · ₹${refund.amount}`, bank].filter(Boolean).join(" · ") });
        }
        refunds.push(next);
      }
      patchShopOrder(order.id, { refunds, history });
    } catch {
      /* one refund lookup failing must not stop the rest */
    }
  }
}

export function startShipmentSync() {
  if (started) return;
  started = true;
  const tick = () => {
    void syncOpenShipments();
    void syncOpenRefunds();
  };
  setTimeout(tick, 20_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}
