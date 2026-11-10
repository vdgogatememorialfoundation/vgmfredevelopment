import type { Order } from "@/types";
import { readMobileFeed } from "@/lib/server/mobile-feed";
import { preorderAdvance, publicOrderSettings, type OrderSettings } from "@/lib/integrations";
import { findShopOrder, ordersForEmail, patchShopOrder, upsertShopOrder } from "@/lib/server/shop-orders";
import type { MobileOrder } from "@/lib/server/mobile-store";
import { ithinkRates, nimbusRates, shipyaariRates, shiprocketRates } from "@/lib/server/providers";
import { readShippingCreds } from "@/lib/server/shipping-vault";

type FeedBook = { id?: string; sku?: string; stock?: number; stockStatus?: string; preorder?: boolean | { enabled?: boolean } };

/** Out of stock with pre-booking switched on, the same test the website uses. */
export function feedPreorderable(book?: FeedBook) {
  if (!book) return false;
  const enabled = typeof book.preorder === "object" ? Boolean(book.preorder?.enabled) : Boolean(book.preorder);
  const purchasable = book.stockStatus !== "out_of_stock" && Number(book.stock ?? 0) > 0;
  return enabled && !purchasable;
}

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

/** The pre-order advance from Order settings (full amount or a part); the rest and the courier charge are paid later. */
function preorderPlan(subtotal: number) {
  const settings = publicOrderSettings(readMobileFeed().orderSettings as Partial<OrderSettings> | undefined);
  const advance = preorderAdvance(subtotal, settings);
  return {
    advance,
    balance: Math.round((subtotal - advance) * 100) / 100,
    balanceWhen: settings.preorderPayment.balanceWhen,
    shippingDue: true,
  };
}

/** Writes an app order into the main shop order list, so admin Orders, picking, couriers and tracking all see it. */
export function recordAppOrder(
  draft: MobileOrder,
  input: { name: string; phone: string; address: { line1: string; landmark?: string; city: string; state: string; pincode: string; country?: string; countryCode?: string }; pickup: boolean }
) {
  const books = (readMobileFeed().books ?? []) as FeedBook[];
  const quantity = draft.items.reduce((sum, item) => sum + item.quantity, 0);
  const preorder = draft.items.some((item) => feedPreorderable(books.find((row) => String(row.id) === item.id)));
  const shipping = preorder ? 0 : appShipping(draft.subtotal, quantity, input.pickup);
  const now = new Date().toISOString();
  const order: Order = {
    id: draft.id,
    userId: draft.email,
    accountEmail: draft.email,
    date: now,
    items: draft.items.map((item) => {
      const book = books.find((row) => String(row.id) === item.id);
      return { bookId: item.id, title: item.title, quantity: item.quantity, price: item.price, currency: "INR", sku: book?.sku, preorder: feedPreorderable(book) || undefined };
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
    preorderPayment: preorder && !input.pickup ? preorderPlan(draft.subtotal) : undefined,
    createdBy: "Android app",
    history: [{ at: now, status: "Pending", note: "Placed in the Android app; awaiting payment." }],
  };
  return upsertShopOrder(order) ?? order;
}

export function markAppOrderPaid(id: string, payment: { paymentId: string; razorpayOrderId: string }) {
  const order = findShopOrder(id);
  if (!order) return null;
  const at = new Date().toISOString();
  const plan = order.preorderPayment;
  return patchShopOrder(id, {
    paymentStatus: plan && (plan.shippingDue || plan.balance > 0) ? "Partially Paid" : "Paid",
    preorderPayment: plan ? { ...plan, advancePaidAt: at } : undefined,
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

/** Courier charge for a pre-order, worked out when the customer pays the balance (store pickup pays none). */
export async function preorderCourierFee(order: Order) {
  if (order.deliveryMode === "store_pickup") return 0;
  const fees = (readMobileFeed().orderSettings ?? {}) as Fees;
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
  if (fees.shippingFeeMode !== "courier_rate") return appShipping(order.subtotal, units, false);
  const stored = readShippingCreds() as Record<string, Record<string, unknown> | undefined> & { pickup?: { pincode?: string } };
  const pickupPincode = String(stored.pickup?.pincode ?? "");
  const deliveryPincode = order.deliveryAddress?.pincode ?? "";
  const flat = Math.max(0, Number(fees.flatFee) || 0);
  if (!/^\d{6}$/.test(pickupPincode) || !/^\d{6}$/.test(deliveryPincode)) return flat;
  const parcel = { pickupPincode, deliveryPincode, weightKg: Math.max(0.5, units * 0.5), cod: false, declaredValue: order.subtotal, length: 25, breadth: 18, height: Math.max(3, units * 3) };
  const keys = (id: string) => (stored[id] ?? {}) as Record<string, string>;
  const results = await Promise.all([
    shiprocketRates(keys("shiprocket"), parcel).catch(() => null),
    nimbusRates(keys("nimbuspost"), parcel).catch(() => null),
    ithinkRates(keys("ithink"), parcel).catch(() => null),
    shipyaariRates(keys("shipyaari"), parcel).catch(() => null),
  ]);
  const cheapest = results.flatMap((list) => list ?? []).map((rate) => Number(rate.rate)).filter((rate) => rate > 0).sort((a, b) => a - b)[0];
  return Math.round(cheapest ?? flat);
}

const NOT_PROCESSED = ["Pending", "Paid", "Awaiting Confirmation", "Ordered", "Cancelled"];

/** Adds the courier charge (once) and returns the balance the customer pays now. */
export async function preparePreorderBalance(id: string, email: string) {
  const order = findShopOrder(id);
  const owner = (order?.accountEmail || order?.userId || "").toLowerCase();
  if (!order || owner !== email.toLowerCase()) return { error: "This order was not found on your account." };
  const plan = order.preorderPayment;
  if (!plan || plan.balancePaidAt) return { error: "Nothing is due on this order." };
  if (NOT_PROCESSED.includes(order.status)) return { error: "You can pay the balance once your order is processed." };
  if (!plan.shippingDue) return { order, balance: plan.balance };
  const fee = await preorderCourierFee(order);
  const at = new Date().toISOString();
  const next = patchShopOrder(id, {
    shipping: (order.shipping || 0) + fee,
    total: Math.round((order.total + fee) * 100) / 100,
    preorderPayment: { ...plan, balance: Math.round((plan.balance + fee) * 100) / 100, shipping: fee, shippingDue: false },
    history: [...(order.history ?? []), { at, status: order.status, note: `Courier charge ₹${fee} added to the pre-order balance` }],
  }) ?? order;
  return { order: next, balance: next.preorderPayment?.balance ?? plan.balance + fee };
}

export function markPreorderBalancePaid(id: string, payment: { paymentId: string; razorpayOrderId: string }) {
  const order = findShopOrder(id);
  if (!order?.preorderPayment) return null;
  const at = new Date().toISOString();
  return patchShopOrder(id, {
    paymentStatus: "Paid",
    preorderPayment: { ...order.preorderPayment, balancePaidAt: at, balanceRef: payment.paymentId },
    history: [...(order.history ?? []), { at, status: order.status, note: `Pre-order balance paid through Razorpay in the app (${payment.paymentId}).` }],
  });
}
