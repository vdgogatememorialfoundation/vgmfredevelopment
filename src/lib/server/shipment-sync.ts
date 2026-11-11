import { refreshStoredShipment } from "@/lib/server/live-track";
import { listShopShipments } from "@/lib/server/shop-shipments";
import { findShopOrder, listShopOrders, patchShopOrder, upsertShopOrder } from "@/lib/server/shop-orders";
import { listHolds, saveHold } from "@/lib/server/payment-holds";
import { razorpayCreds, razorpayLinkStatus, razorpayOrderPayments, razorpayRefundStatus } from "@/lib/server/providers";
import type { Order, RefundRecord } from "@/types";

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

const LINK_WINDOW_MS = 48 * 60 * 60 * 1000;
const recent = (createdAt?: string) => Date.now() - (Date.parse(createdAt || "") || 0) < LINK_WINDOW_MS;

/** Marks orders paid when the customer pays a Razorpay link (order link or pre-order balance link), even if no one opens the order. */
export async function syncOpenPaymentLinks() {
  const creds = razorpayCreds({});
  if (!creds) return;
  for (const order of listShopOrders()) {
    if (order.status === "Cancelled") continue;
    const plan = order.preorderPayment;
    try {
      const back = order.returnShipment;
      if (back?.chargeLink?.provider === "razorpay" && back.chargeLink.id && !back.chargePaidAt && recent(back.chargeLink.createdAt)) {
        const result = await razorpayLinkStatus(creds, back.chargeLink.id);
        if (result.status === "paid") {
          const at = new Date().toISOString();
          patchShopOrder(order.id, {
            returnShipment: { ...back, chargePaidAt: at, chargeRef: result.paymentId },
            history: [...(order.history ?? []), { at, status: "Return courier charge paid", note: `₹${back.charge ?? 0} · Razorpay payment link${result.paymentId ? ` · ${result.paymentId}` : ""}` }],
          });
        }
      }
      if (plan?.link?.provider === "razorpay" && plan.link.id && !plan.balancePaidAt && recent(plan.link.createdAt)) {
        const result = await razorpayLinkStatus(creds, plan.link.id);
        if (result.status === "paid") {
          const at = new Date().toISOString();
          patchShopOrder(order.id, {
            paymentStatus: "Paid",
            paidAt: order.paidAt ?? at,
            preorderPayment: { ...plan, balancePaidAt: at, balanceRef: result.paymentId },
            history: [...(order.history ?? []), paidNote(order, at, `Pre-order balance ₹${plan.balance} · Razorpay payment link${result.paymentId ? ` · ${result.paymentId}` : ""}`)],
          });
        }
        continue;
      }
      const link = order.paymentLink;
      if (link?.provider === "razorpay" && link.id && order.paymentStatus !== "Paid" && recent(link.createdAt)) {
        const result = await razorpayLinkStatus(creds, link.id);
        if (result.status === "paid") {
          const at = new Date().toISOString();
          patchShopOrder(order.id, {
            paymentStatus: "Paid",
            paymentMethod: "Razorpay payment link",
            paymentRef: result.paymentId,
            razorpayPaymentId: order.razorpayPaymentId || result.paymentId,
            paidAt: at,
            status: order.status === "Pending" ? "Ordered" : order.status,
            preorderPayment: plan && !plan.balancePaidAt ? { ...plan, balancePaidAt: at, balanceRef: result.paymentId } : plan,
            history: [...(order.history ?? []), paidNote(order, at, `Razorpay payment link${link.amount ? ` · ₹${link.amount}` : ""}${result.paymentId ? ` · ${result.paymentId}` : ""}`)],
          });
        }
      }
    } catch {
      /* one link lookup failing must not stop the rest */
    }
  }
}

function paidNote(order: Order, at: string, note: string) {
  return { at, status: order.preorderPayment ? "Balance paid" : "Payment received", note };
}

/** A customer paid on Razorpay but the browser closed or dropped before the order was saved: confirm it from Razorpay. */
export async function syncRazorpayHolds() {
  const creds = razorpayCreds({});
  if (!creds) return;
  const now = Date.now();
  for (const hold of listHolds()) {
    if (hold.gateway !== "razorpay" || hold.status !== "holding" || !hold.reference || !hold.order) continue;
    const age = now - (Date.parse(hold.createdAt) || now);
    // Give the browser two minutes to finish normally first.
    if (age < 2 * 60_000) continue;
    try {
      const payment = await razorpayOrderPayments(creds, hold.reference);
      const at = new Date().toISOString();
      if (payment.status === "paid" || payment.paymentId) {
        const existing = findShopOrder(hold.id);
        if (!existing || existing.paymentStatus === "Pending") {
          const base = existing ?? hold.order;
          upsertShopOrder({
            ...base,
            paymentStatus: base.preorderPayment ? "Partially Paid" : "Paid",
            paymentMethod: "Online",
            paidAt: at,
            razorpayOrderId: hold.reference,
            razorpayPaymentId: payment.paymentId || base.razorpayPaymentId,
            preorderPayment: base.preorderPayment ? { ...base.preorderPayment, advancePaidAt: at } : undefined,
            history: [
              ...(base.history ?? []),
              { at, status: base.status, note: `Payment confirmed from Razorpay ${payment.paymentId ?? ""}`.trim(), by: "Razorpay sync" },
            ],
          });
        }
        saveHold({ ...hold, status: "confirmed", updatedAt: at });
      } else if (age > 2 * 60 * 60_000) {
        saveHold({ ...hold, status: "failed", updatedAt: at });
      }
    } catch {
      /* try again next round */
    }
  }
}

export function startShipmentSync() {
  if (started) return;
  started = true;
  const tick = () => {
    void syncOpenShipments();
    void syncOpenRefunds();
    void syncOpenPaymentLinks();
    void syncRazorpayHolds();
  };
  setTimeout(tick, 20_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}
