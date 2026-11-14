import type { CourierRate, Order } from "@/types";
import { customerCourierRates, highestCourierRate } from "@/lib/checkout-couriers";
import { readMobileFeed } from "@/lib/server/mobile-feed";
import { redeemPromo } from "@/lib/server/promotions";
import { packingChargeFor, preorderAdvance, publicOrderSettings, type OrderSettings } from "@/lib/integrations";
import { findShopOrder, ordersForEmail, patchShopOrder, upsertShopOrder } from "@/lib/server/shop-orders";
import type { MobileOrder } from "@/lib/server/mobile-store";
import { goswiftRates, ithinkRates, nimbusRates, shipyaariRates, shiprocketRates } from "@/lib/server/providers";
import { readShippingCreds } from "@/lib/server/shipping-vault";
import { sendMobileEmail } from "@/lib/server/mobile-mail";

type FeedBook = { id?: string; sku?: string; batchNo?: string; stock?: number; stockStatus?: string; preorder?: boolean | { enabled?: boolean } };

/** Out of stock with pre-booking switched on, the same test the website uses. */
export function feedPreorderable(book?: FeedBook) {
  if (!book) return false;
  const enabled = typeof book.preorder === "object" ? Boolean(book.preorder?.enabled) : Boolean(book.preorder);
  const purchasable = book.stockStatus !== "out_of_stock" && Number(book.stock ?? 0) > 0;
  return enabled && !purchasable;
}

type Fees = { shippingFeeMode?: string; flatFee?: number; perItemFee?: number; freeAbove?: number; deliveryEnabled?: boolean; pickupEnabled?: boolean };

function appPacking(quantity: number) {
  return packingChargeFor(quantity, publicOrderSettings(readMobileFeed().orderSettings as Partial<OrderSettings> | undefined));
}

/** Shipping for an app order (packing charge included), using the same fee rule as the website checkout. Store pickup is free. */
export function appShipping(subtotal: number, quantity: number, pickup: boolean) {
  if (pickup) return 0;
  return appCourierOnly(subtotal, quantity) + appPacking(quantity);
}

function appCourierOnly(subtotal: number, quantity: number) {
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
function preorderPlan(total: number, copies: number, platformFee: number) {
  const settings = publicOrderSettings(readMobileFeed().orderSettings as Partial<OrderSettings> | undefined);
  const advance = preorderAdvance(total, settings, { copies, platformFee });
  return {
    advance,
    balance: Math.round((total - advance) * 100) / 100,
    balanceWhen: settings.preorderPayment.balanceWhen,
    shippingDue: true,
  };
}

/** Writes an app order into the main shop order list, so admin Orders, picking, couriers and tracking all see it. */
export function recordAppOrder(
  draft: MobileOrder,
  input: { name: string; phone: string; address: { line1: string; landmark?: string; city: string; state: string; pincode: string; country?: string; countryCode?: string }; pickup: boolean; promo?: { code: string; kind: "coupon" | "gift"; amount: number; label: string }; courierFee?: number | null }
) {
  const books = (readMobileFeed().books ?? []) as FeedBook[];
  const quantity = draft.items.reduce((sum, item) => sum + item.quantity, 0);
  const preorder = draft.items.some((item) => feedPreorderable(books.find((row) => String(row.id) === item.id)));
  const courierLater = !preorder && !input.pickup && input.courierFee === null;
  const shipping = preorder || courierLater ? 0 : typeof input.courierFee === "number" && !input.pickup ? input.courierFee + appPacking(quantity) : appShipping(draft.subtotal, quantity, input.pickup);
  const fees = publicOrderSettings(readMobileFeed().orderSettings as Partial<OrderSettings> | undefined).platformFee;
  const platformFee = fees.enabled ? Math.max(0, Math.round(fees.amount)) : 0;
  const total = Math.max(0, draft.subtotal - (input.promo?.amount ?? 0)) + platformFee + shipping;
  const now = new Date().toISOString();
  const order: Order = {
    id: draft.id,
    userId: draft.email,
    accountEmail: draft.email,
    date: now,
    items: draft.items.map((item) => {
      const book = books.find((row) => String(row.id) === item.id);
      return { bookId: item.id, title: item.title, quantity: item.quantity, price: item.price, currency: "INR", sku: book?.sku, batchNo: book?.batchNo, preorder: feedPreorderable(book) || undefined };
    }),
    subtotal: draft.subtotal,
    discount: input.promo?.amount ?? 0,
    promo: input.promo,
    gst: 0,
    platformFee: platformFee || undefined,
    shipping,
    shippingDue: courierLater || undefined,
    total,
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
    preorderPayment: preorder && !input.pickup ? preorderPlan(total, quantity, platformFee) : undefined,
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
  if (order.paymentStatus === "Pending") void mailDeskNewOrder(order, payment.paymentId);
  redeemPromo(order);
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

const DESK_EMAILS = ["care@vaidyagogate.org", "vd.gogatememorialfoundation@gmail.com"];

/** App orders reach the desk inbox with the full details, like site orders. */
async function mailDeskNewOrder(order: Order, paymentId: string) {
  const address = order.deliveryAddress;
  const body = [
    `New order ${order.id} from the Android app`,
    "",
    `Customer: ${address?.fullName || "—"}`,
    `Phone: ${address?.phone || "—"}`,
    `Email: ${address?.email || order.accountEmail || "—"}`,
    order.deliveryMode === "store_pickup" ? "Delivery: Pickup from store" : `Deliver to: ${[address?.line1, address?.landmark, address?.city, address?.state, address?.pincode].filter(Boolean).join(", ")}`,
    "",
    "Items:",
    ...order.items.map((item) => `- ${item.title}${item.sku ? ` (SKU ${item.sku})` : ""} × ${item.quantity} @ ₹${item.price} = ₹${item.price * item.quantity}`),
    "",
    `Subtotal: ₹${order.subtotal}`,
    `Shipping: ${order.shipping ? `₹${order.shipping}` : order.deliveryMode === "store_pickup" ? "Store pickup" : order.shippingDue || order.preorderPayment ? "Calculated once packed" : "Free"}`,
    `Total: ₹${order.total}`,
    `Payment: Razorpay · ${paymentId}`,
  ].join("\n");
  for (const to of DESK_EMAILS) {
    try {
      await sendMobileEmail(to, `New order ${order.id} · ₹${order.total} · ${address?.fullName || "Customer"}`, body);
    } catch {
      /* the order still stands if the alert mail fails */
    }
  }
}

export function appOrdersFor(email: string) {
  return ordersForEmail(email);
}

/** Courier charge (packing charge included) for a pre-order, worked out when the customer pays the balance (store pickup pays none). */
export async function preorderCourierFee(order: Order) {
  if (order.deliveryMode === "store_pickup") return 0;
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
  if (((readMobileFeed().orderSettings ?? {}) as Fees).shippingFeeMode !== "courier_rate") return appShipping(order.subtotal, units, false);
  return (await preorderCourierOnly(order)) + appPacking(units);
}

async function preorderCourierOnly(order: Order) {
  const fees = (readMobileFeed().orderSettings ?? {}) as Fees;
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
  if (fees.shippingFeeMode !== "courier_rate") return appShipping(order.subtotal, units, false);
  const flat = Math.max(0, Number(fees.flatFee) || 0);
  return (await appCourierEstimate(order.subtotal, units, order.deliveryAddress?.pincode ?? "")) ?? flat;
}

/** What checkout charges for the courier: the highest rate among the couriers for the pincode, with the admin's markup. Undefined when no courier quotes. */
export async function appCourierEstimate(subtotal: number, units: number, deliveryPincode: string) {
  const stored = readShippingCreds() as Record<string, Record<string, unknown> | undefined> & { pickup?: { pincode?: string } };
  const pickupPincode = String(stored.pickup?.pincode ?? "");
  if (!/^\d{6}$/.test(pickupPincode) || !/^\d{6}$/.test(deliveryPincode)) return undefined;
  const parcel = { pickupPincode, deliveryPincode, weightKg: Math.max(0.5, units * 0.5), cod: false, declaredValue: subtotal, length: 25, breadth: 18, height: Math.max(3, units * 3) };
  const keys = (id: string) => (stored[id] ?? {}) as Record<string, string>;
  const results = await Promise.all([
    shiprocketRates(keys("shiprocket"), parcel).catch(() => null),
    nimbusRates(keys("nimbuspost"), parcel).catch(() => null),
    ithinkRates(keys("ithink"), parcel).catch(() => null),
    shipyaariRates(keys("shipyaari"), parcel).catch(() => null),
    goswiftRates(keys("goswift"), parcel).catch(() => null),
  ]);
  const rates = results.flatMap((list) => list ?? []).filter((rate) => Number(rate.rate) > 0) as unknown as CourierRate[];
  const settings = publicOrderSettings(readMobileFeed().orderSettings as Partial<OrderSettings> | undefined);
  const highest = highestCourierRate(customerCourierRates(rates, settings));
  return highest > 0 ? highest : undefined;
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
  if (plan.shippingDue) return { error: "We will send you the payment link once we select the courier for your parcel. Its charge is added to the balance then." };
  return { order, balance: plan.balance };
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
