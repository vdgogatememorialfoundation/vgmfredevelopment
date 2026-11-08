import type { Order } from "@/types";
import { readMobileFeed } from "@/lib/server/mobile-feed";
import { findShopOrder, ordersForEmail, patchShopOrder, upsertShopOrder } from "@/lib/server/shop-orders";
import type { MobileOrder } from "@/lib/server/mobile-store";

type Fees = { shippingFeeMode?: string; flatFee?: number; perItemFee?: number; freeAbove?: number; deliveryEnabled?: boolean; pickupEnabled?: boolean };

/** Shipping for an app order, using the same fee rule as the website checkout. Store pickup is free. */
export function appShipping(subtotal: number, quantity: number, pickup: boolean) {
  if (pickup) return 0;
  const fees = (readMobileFeed().orderSettings ?? {}) as Fees;
  const flat = Math.max(0, Number(fees.flatFee) || 0);
  switch (fees.shippingFeeMode) {
    case "free":
      return 0;
    case "per_item":
      return Math.max(0, Number(fees.perItemFee) || 0) * quantity;
    case "free_above":
      return subtotal >= (Number(fees.freeAbove) || 0) ? 0 : flat;
    default:
      return flat;
  }
}

export function appPickupAllowed() {
  return ((readMobileFeed().orderSettings ?? {}) as Fees).pickupEnabled !== false;
}

/** Writes an app order into the main shop order list, so admin Orders, picking, couriers and tracking all see it. */
export function recordAppOrder(
  draft: MobileOrder,
  input: { name: string; phone: string; address: { line1: string; landmark?: string; city: string; state: string; pincode: string; country?: string; countryCode?: string }; pickup: boolean }
) {
  const books = (readMobileFeed().books ?? []) as { id?: string; sku?: string; preorder?: boolean }[];
  const quantity = draft.items.reduce((sum, item) => sum + item.quantity, 0);
  const shipping = appShipping(draft.subtotal, quantity, input.pickup);
  const now = new Date().toISOString();
  const order: Order = {
    id: draft.id,
    userId: draft.email,
    accountEmail: draft.email,
    date: now,
    items: draft.items.map((item) => {
      const book = books.find((row) => String(row.id) === item.id);
      return { bookId: item.id, title: item.title, quantity: item.quantity, price: item.price, currency: "INR", sku: book?.sku, preorder: Boolean(book?.preorder) || undefined };
    }),
    subtotal: draft.subtotal,
    discount: 0,
    gst: 0,
    shipping,
    total: draft.subtotal + shipping,
    currency: "INR",
    paymentStatus: "Pending",
    status: "Pending",
    channel: "online",
    deliveryMode: input.pickup ? "store_pickup" : "delivery",
    deliveryAddress: {
      fullName: input.name,
      phone: input.phone,
      email: draft.email,
      line1: input.address.line1,
      landmark: input.address.landmark,
      city: input.address.city,
      state: input.address.state,
      pincode: input.address.pincode,
      country: input.address.country || "India",
      countryCode: input.address.countryCode || "IN",
    },
    paymentMethod: "Razorpay",
    createdBy: "Android app",
    history: [{ at: now, status: "Pending", note: "Placed in the Android app; awaiting payment." }],
  };
  return upsertShopOrder(order) ?? order;
}

export function markAppOrderPaid(id: string, payment: { paymentId: string; razorpayOrderId: string }) {
  const order = findShopOrder(id);
  if (!order) return null;
  const at = new Date().toISOString();
  return patchShopOrder(id, {
    paymentStatus: "Paid",
    status: "Paid",
    paidAt: at,
    paymentRef: payment.paymentId,
    razorpayPaymentId: payment.paymentId,
    razorpayOrderId: payment.razorpayOrderId,
    history: [...(order.history ?? []), { at, status: "Paid", note: "Paid through Razorpay in the Android app." }],
  });
}

export function appOrdersFor(email: string) {
  return ordersForEmail(email);
}
