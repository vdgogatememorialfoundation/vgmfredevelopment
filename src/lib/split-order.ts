import type { Order } from "@/types";

const round = (value: number) => Math.round(value * 100) / 100;
const OPEN_STATUSES: Order["status"][] = ["Processing", "Awaiting Confirmation", "Ordered", "Accepted", "Packed", "Ready to Ship", "To Ship", "Paid"];

export const isSplitParent = (order?: Pick<Order, "splitInto"> | null) => Boolean(order?.splitInto?.length);

/** Why this order cannot be split now, or "" when it can. */
export function splitBlocker(order: Order, hasShipment: boolean) {
  if (isSplitParent(order)) return "This order is already split.";
  if (order.splitFrom) return "This order is already a part of a split order.";
  if (!OPEN_STATUSES.includes(order.status)) return "Only open orders that have not left the store can be split.";
  if (order.items.reduce((sum, item) => sum + item.quantity, 0) < 2) return "The order needs at least 2 copies to split.";
  if (hasShipment) return "A courier is already booked. Cancel that shipment before splitting.";
  if (order.pick?.acceptedAt) return "Picking has started. Finish or reset pick & pack before splitting.";
  if ((order.refundAmount ?? 0) > 0 || order.refunds?.length) return "This order has a refund. It cannot be split.";
  if (order.extraCharges?.length || order.courierQuote || order.courierUpgrade) return "A courier or extra charge is already on this order. Split it before charging the courier.";
  const plan = order.preorderPayment;
  if (plan && !plan.balancePaidAt) {
    if (!plan.advancePaidAt && order.paymentStatus === "Pending") return "Split after the pre-order advance is paid.";
    if (plan.shippingDue === false) return "The courier charge is already on this order. Split it before charging the courier.";
  } else if (order.paymentStatus === "Partially Paid") {
    return "Collect the amount due before splitting.";
  }
  return "";
}

/**
 * Splits an order into two child orders. Items keep their price; the goods value (total less platform fee and shipping) is shared by book value.
 * A paid pre-order advance is shared by copy (token per book) or by value; the platform fee stays on the parent as already paid and is never charged again.
 * Child 1 keeps any shipping/packing already on the order; each child then gets its own courier + packing charge and payment link.
 */
export function planOrderSplit(order: Order, secondQty: Record<string, number>, options: { perCopyAdvance: boolean; now: string }) {
  const clamp = (item: Order["items"][number]) => Math.max(0, Math.min(item.quantity, Math.floor(Number(secondQty[item.bookId]) || 0)));
  const parts = [1, 2].map((part) =>
    order.items.map((item) => ({ ...item, quantity: part === 2 ? clamp(item) : item.quantity - clamp(item) })).filter((item) => item.quantity > 0)
  );
  if (!parts[0].length || !parts[1].length) throw new Error("Put at least one copy in each order.");
  const sub = parts.map((items) => round(items.reduce((sum, item) => sum + item.price * item.quantity, 0)));
  const copies = parts.map((items) => items.reduce((sum, item) => sum + item.quantity, 0));
  const share = sub[0] + sub[1] > 0 ? sub[0] / (sub[0] + sub[1]) : copies[0] / (copies[0] + copies[1]);
  const fee = Math.max(0, order.platformFee ?? 0);
  const shipping = Math.max(0, order.shipping ?? 0);
  const goods = Math.max(0, round(order.total - fee - shipping));
  const goods1 = round(goods * share);
  const plan = order.preorderPayment;
  const openPlan = plan && !plan.balancePaidAt ? plan : undefined;
  const fullyPaid = (plan && plan.balancePaidAt) || (!plan && (order.paymentStatus === "Paid" || order.paymentStatus === "Partially Refunded"));
  const nothingPaid = !plan && order.paymentStatus === "Pending";
  // Platform fee: kept on the parent as paid; only when nothing was paid yet does order 1 carry it (e.g. cash on delivery).
  const feeOnChild = nothingPaid ? fee : 0;
  const totals = [round(goods1 + shipping + feeOnChild), round(goods - goods1)];
  const prepaid = Math.max(0, openPlan?.prepaidShipping ?? 0);
  const bookAdvance = openPlan ? Math.max(0, round(openPlan.advance - fee - prepaid)) : 0;
  const advance1 = round(options.perCopyAdvance ? (bookAdvance * copies[0]) / (copies[0] + copies[1]) : bookAdvance * share);
  const advances = [round(advance1 + prepaid), round(bookAdvance - advance1)];
  const ids = [`${order.id}-1`, `${order.id}-2`];
  const label = (items: Order["items"]) => items.map((item) => `${item.title} × ${item.quantity}`).join(", ");
  const children: Order[] = parts.map((items, index) => {
    const part = index + 1;
    const total = totals[index];
    const paid = openPlan ? advances[index] : fullyPaid ? total : 0;
    const child: Order = {
      ...order,
      id: ids[index],
      items,
      subtotal: sub[index],
      discount: round((order.discount ?? 0) * (index ? 1 - share : share)),
      gst: round((order.gst ?? 0) * (index ? 1 - share : share)),
      shipping: index ? 0 : shipping,
      packing: index ? undefined : order.packing,
      platformFee: index === 0 && feeOnChild ? feeOnChild : undefined,
      total,
      paymentStatus: openPlan ? (paid > 0 ? "Partially Paid" : "Pending") : fullyPaid ? "Paid" : order.paymentStatus,
      amountPaid: openPlan || fullyPaid ? paid : undefined,
      shippingDue: index === 0 ? order.shippingDue : order.deliveryMode === "delivery" && (fullyPaid || !openPlan) ? true : order.shippingDue,
      preorderPayment: plan
        ? openPlan
          ? { advance: advances[index], balance: round(total - advances[index]), balanceWhen: plan.balanceWhen, advancePaidAt: plan.advancePaidAt, shippingDue: plan.shippingDue, prepaidShipping: index === 0 && prepaid ? prepaid : undefined, shipping: index === 0 ? plan.shipping : undefined }
          : { ...plan, advance: total, balance: 0, link: undefined, balanceTxnId: undefined, shippingDue: index === 0 ? plan.shippingDue : undefined }
        : undefined,
      status: ["Packed", "Ready to Ship", "To Ship"].includes(order.status) ? "Accepted" : order.status,
      splitFrom: order.id,
      splitPart: part,
      splitAdvance: openPlan ? advances[index] : undefined,
      splitInto: undefined,
      history: [
        ...(order.history ?? []),
        {
          at: options.now,
          status: "Split order",
          note: `Order ${part} of 2 from order ${order.id}: ${label(items)}.${openPlan ? ` Advance ₹${advances[index]} allocated from the advance paid on ${order.id}.` : ""}${fee && !feeOnChild ? ` Platform fee ₹${fee} was paid once on ${order.id} and is not charged again.` : ""} Packing, courier and the payment link are handled on this order.`,
        },
      ],
    };
    for (const key of ["refunds", "refundAmount", "autoRefund", "returnRequest", "returnShipment", "approval", "paymentLink", "extraCharges", "courierQuote", "courierUpgrade", "pick", "packPhotos", "awbPhotos", "weightKg", "parcel", "promo", "storeCreditUsed", "paymentTxnId", "feedbackInvitedAt", "trackingId", "trackToken", "courierName", "shipmentId"] as const) {
      delete (child as Partial<Order>)[key];
    }
    if (!child.preorderPayment) delete child.preorderPayment;
    return child;
  });
  const parentPatch: Partial<Order> = {
    splitInto: children.map((child) => ({ id: child.id, label: label(child.items) })),
    splitAt: options.now,
    // Stock already taken for the parent moves to the child orders (no second deduction, no release on the parent).
    stockCommitted: false,
    preorderStockCommitted: false,
  };
  return { children, parentPatch };
}

export type SplitLedgerRow = { id: string; label: string; status: string; total: number; advance: number; collected: number; due: number; courier: number; packing: number; extra: number };

/** Consolidated money view of a split parent and its child orders. */
export function splitLedger(parent: Order, children: Order[], collected: (order: Order) => number) {
  const rows: SplitLedgerRow[] = children.map((child) => {
    const got = collected(child);
    const extras = child.extraCharges ?? [];
    const packing = Math.max(0, child.packing ?? 0);
    return {
      id: child.id,
      label: child.items.map((item) => `${item.title} × ${item.quantity}`).join(", "),
      status: child.status,
      total: child.total,
      advance: child.splitAdvance ?? 0,
      collected: got,
      due: Math.max(0, round(child.total - got)),
      courier: round(Math.max(0, (child.shipping ?? 0) - packing)),
      packing,
      extra: round(extras.filter((row) => row.kind === "other").reduce((sum, row) => sum + row.amount, 0)),
    };
  });
  const fee = Math.max(0, parent.platformFee ?? 0);
  const feeOnChild = children.some((child) => (child.platformFee ?? 0) > 0);
  return {
    original: parent.total,
    fee,
    feePaidOnParent: !feeOnChild && fee > 0,
    advance: parent.preorderPayment ? parent.preorderPayment.advance : 0,
    rows,
    childTotal: round(rows.reduce((sum, row) => sum + row.total, 0)),
    collected: round((feeOnChild ? 0 : fee) + rows.reduce((sum, row) => sum + row.collected, 0)),
    due: round(rows.reduce((sum, row) => sum + row.due, 0)),
  };
}
