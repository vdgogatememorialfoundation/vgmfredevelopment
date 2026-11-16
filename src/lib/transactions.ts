import type { Order } from "@/types";

/** A 12-digit VGMF transaction ID (payments, balance payments, refunds). */
export function vgmfTxnId() {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte, index) => (index === 0 ? 1 + (byte % 9) : byte % 10)).join("");
}

const SHIPPED = new Set(["Shipped", "Out for Delivery", "Delivered", "Failed"]);

/** What the customer has actually paid on the order so far. */
export function collectedAmount(order: Order) {
  const plan = order.preorderPayment;
  if (plan && !plan.balancePaidAt) return plan.advancePaidAt || order.paymentStatus !== "Pending" ? plan.advance : 0;
  if (order.paymentStatus === "Paid" || order.paymentStatus === "Partially Refunded" || order.paymentStatus === "Refunded") return order.total;
  if (order.paymentStatus === "Partially Paid") return order.amountPaid ?? 0;
  return 0;
}

/** Refund the server sends by itself after a cancellation before shipping (Razorpay payments only). */
export function cancellationAutoRefund(order: Order, amount: number): Order["autoRefund"] {
  const online = Boolean(order.razorpayPaymentId || order.preorderPayment?.balanceRef?.startsWith("pay_"));
  if (SHIPPED.has(order.status) || !online || !(amount > 0)) return undefined;
  return { status: "due", amount: Math.round(amount * 100) / 100, at: new Date().toISOString() };
}

/** Paid amount less the platform fee and earlier refunds: what a desk cancellation before shipping gives back. */
export function deskCancellationRefund(order: Order) {
  return Math.max(0, collectedAmount(order) - Math.max(0, order.platformFee ?? 0) - (order.refundAmount ?? 0));
}
