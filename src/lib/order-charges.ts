import type { Order } from "@/types";

type Charged = Pick<Order, "shipping" | "packing" | "shippingDue" | "preorderPayment">;

/** An order's shipping split into the courier part and the part the desk marked as packing. */
export function shippingSplit(order: Pick<Order, "shipping" | "packing">) {
  const total = Math.max(0, order.shipping || 0);
  const packing = Math.min(total, Math.max(0, order.packing || 0));
  return { packing, courier: Math.round((total - packing) * 100) / 100 };
}

/** All of the shipping is packing and no courier charge is pending, so no separate Shipping line. */
export function hideShipping(order: Charged) {
  const { packing, courier } = shippingSplit(order);
  return packing > 0 && courier === 0 && !order.shippingDue && !order.preorderPayment?.shippingDue;
}
