import type {
  Book,
  CartItem,
  Order,
  ReturnKind,
  ReturnRequest,
  ShipmentEvent,
} from "@/types";
import { buildTrackingStages as buildCourierStages, isSampleOrder } from "@/lib/order-pipeline";
export type { TrackingStage, TrackingStageId } from "@/lib/order-pipeline";
export { pickupOtp } from "@/lib/order-pipeline";
import { storeConfig } from "@/lib/constants";
import { publishCartChange } from "@/lib/cart-store";
import { formatDate } from "@/lib/utils";
import { getLiveBook } from "@/lib/product-data";
import { checkPincode } from "@/lib/fulfillment";
import { getOrderSettings, shippingFeeFor } from "@/lib/integrations";

const CART_KEY = "vgmf_cart";
const ORDERS_KEY = "vgmf_orders";
const WISHLIST_KEY = "vgmf_wishlist";

export function getBookById(id: string) {
  return getLiveBook(id);
}

export function getEffectivePrice(book: Book) {
  return book.price;
}

export function getDiscountPercent(book: Book) {
  if (!book.originalPrice || book.originalPrice <= book.price) return 0;
  return Math.round(((book.originalPrice - book.price) / book.originalPrice) * 100);
}

// ---------- Cart ----------

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function persistCart(cart: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  publishCartChange();
}

export function addToCart(bookId: string, quantity = 1) {
  const cart = getCart();
  const existing = cart.find((item) => item.bookId === bookId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ bookId, quantity });
  }
  persistCart(cart);
}

export function setCartQuantity(bookId: string, quantity: number) {
  if (quantity < 1) {
    removeFromCart(bookId);
    return;
  }
  const cart = getCart();
  const item = cart.find((entry) => entry.bookId === bookId);
  if (item) {
    item.quantity = quantity;
  } else {
    cart.push({ bookId, quantity });
  }
  persistCart(cart);
}

export function removeFromCart(bookId: string) {
  persistCart(getCart().filter((entry) => entry.bookId !== bookId));
}

export function clearCart() {
  persistCart([]);
}

export function getCartItemCount() {
  return getCart().reduce((sum, item) => sum + item.quantity, 0);
}

export interface PriceBreakup {
  mrp: number;
  subtotal: number;
  discount: number;
  gst: number;
  shipping: number;
  total: number;
}

export function computeTotals(
  items: { price: number; originalPrice?: number; quantity: number }[]
): PriceBreakup {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const mrp = items.reduce(
    (sum, item) => sum + (item.originalPrice ?? item.price) * item.quantity,
    0
  );
  const discount = Math.max(0, mrp - subtotal);
  const gst = Math.round(subtotal * storeConfig.gstRate);
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  const shipping = subtotal === 0 ? 0 : shippingFeeFor(subtotal, units, undefined, getOrderSettings());
  const total = subtotal + gst + shipping;
  return { mrp, subtotal, discount, gst, shipping, total };
}

export function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: storeConfig.currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ---------- Delivery ----------

export function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function getEstimatedDeliveryDate(maxDays = 5) {
  return formatDate(daysFromNow(maxDays));
}

export interface DeliveryEstimate {
  serviceable: boolean;
  pincode: string;
  processingDays: number;
  transitDays: number;
  totalDaysMin: number;
  totalDaysMax: number;
  from: string;
  to: string;
  courier: string;
  note?: string;
}

/**
 * Expected delivery from the admin processing timeline, product rules,
 * and the courier partners enabled for this pincode.
 */
export function getDeliveryEstimateForPincode(
  pincode: string,
  bookId?: string
): DeliveryEstimate {
  const quote = checkPincode(pincode, bookId);
  const processingDays = quote.processingDays + quote.handoffDays;
  return {
    serviceable: quote.serviceable,
    pincode: quote.pincode,
    processingDays: quote.processingDays,
    transitDays: quote.transitDays,
    totalDaysMin: processingDays + quote.transitDays,
    totalDaysMax: processingDays + quote.transitDays + (quote.serviceable ? 1 : 0),
    from: quote.deliverFrom,
    to: quote.deliverBy,
    courier: quote.courier ?? storeConfig.shippingGateway,
    note: quote.note,
  };
}

// ---------- Orders ----------

export function generateOrderId(): string {
  return String(Math.floor(100000000000 + Math.random() * 900000000000));
}

export function getOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ORDERS_KEY);
    return raw ? (JSON.parse(raw) as Order[]) : [];
  } catch {
    return [];
  }
}

export function saveOrder(order: Order) {
  if (typeof window === "undefined") return;
  const orders = getOrders();
  orders.unshift(order);
  window.localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  window.dispatchEvent(new Event("vgmf-cms"));
}

export function getOrdersByEmail(email?: string) {
  if (!email) return [];
  const value = email.toLowerCase();
  return getOrders().filter(
    (order) =>
      !isSampleOrder(order) &&
      (order.deliveryAddress?.email?.toLowerCase() === value ||
        order.deliveryAddress?.phone?.replace(/\D/g, "") === value.replace(/\D/g, ""))
  );
}

export function purgeSampleOrders() {
  if (typeof window === "undefined") return;
  const kept = getOrders().filter((order) => !isSampleOrder(order));
  if (kept.length === getOrders().length) return;
  window.localStorage.setItem(ORDERS_KEY, JSON.stringify(kept));
  window.dispatchEvent(new Event("vgmf-cms"));
}

// ---------- Tracking ----------

const COURIERS = ["Shiprocket Surface", "Shiprocket Express", "iThink Logistics"];

export function pickCourier(orderId: string) {
  let hash = 0;
  for (const char of orderId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COURIERS[hash % COURIERS.length];
}

export function courierPrefix(courierName: string) {
  const initials = courierName
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return initials || "TRK";
}

export function generateTrackingId(courierName?: string) {
  const courier = courierName ?? storeConfig.courierName;
  return `${courierPrefix(courier)}${Math.floor(
    100000000000 + Math.random() * 900000000000
  )}`;
}

export function buildTrackingStages(order: Order, scans?: Parameters<typeof buildCourierStages>[1], shipment?: Parameters<typeof buildCourierStages>[2]) {
  return buildCourierStages(order, scans, shipment);
}

// ---------- Returns & replacements ----------

const RETURNS_KEY = "vgmf_returns";

export function getReturnRequests(): Record<string, ReturnRequest> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(RETURNS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ReturnRequest>) : {};
  } catch {
    return {};
  }
}

export function getReturnRequest(orderId: string): ReturnRequest | undefined {
  return getReturnRequests()[orderId];
}

export function updateReturnRequest(orderId: string, update: Partial<ReturnRequest>) {
  const current = getReturnRequest(orderId);
  if (!current) return undefined;
  const next = { ...current, ...update };
  persistReturnRequest(orderId, next);
  return next;
}

function persistReturnRequest(orderId: string, request: ReturnRequest) {
  if (typeof window === "undefined") return;
  const map = getReturnRequests();
  map[orderId] = request;
  window.localStorage.setItem(RETURNS_KEY, JSON.stringify(map));
}

function returnRequestId() {
  return `RTN${Math.floor(100000000000 + Math.random() * 900000000000)}`;
}

function generateReplacementOrder(source: Order): Order {
  const id = generateOrderId();
  const courierName = source.deliveryMode === "delivery" ? pickCourier(id) : undefined;
  return {
    ...source,
    id,
    date: new Date().toISOString(),
    status: "Ordered",
    paymentStatus: "Paid",
    eta: getEstimatedDeliveryDate(6),
    trackingId: courierName ? generateTrackingId(courierName) : undefined,
    courierName,
    returnableDays: storeConfig.returnDays,
    replacementOf: source.id,
    returnRequest: undefined,
  };
}

export function initiateReturn(
  order: Order,
  input: { kind: ReturnKind; reason: string }
): ReturnRequest {
  const requestedAt = new Date().toISOString();
  const id = returnRequestId();
  const charges =
    input.kind === "return" ? getOrderSettings().returns.pickupCharge : 0;
  const at = (hours: number) =>
    new Date(new Date(requestedAt).getTime() + hours * 3600000).toISOString();

  if (input.kind === "replacement") {
    const replacement = generateReplacementOrder(order);
    saveOrder(replacement);

    const stages: ShipmentEvent[] = [
      {
        id: "requested",
        title: "Return Requested",
        at: requestedAt,
        reached: true,
      },
      {
        id: "approved",
        title: "Return Approved",
        at: at(1),
        location: "Pune, Maharashtra, India",
        reached: true,
        detail: `Replacement order ${replacement.id} created — no extra charge.`,
      },
      {
        id: "pickup",
        title: "Pickup of the original item",
        at: at(24),
        location: inputPicker(order),
        reached: false,
        detail: "The courier will collect the item you received; keep it packed.",
      },
      {
        id: "replacement-shipped",
        title: "Replacement planned",
        at: at(72),
        reached: false,
        detail:
          "Your replacement will be shipped once the pickup is verified at the facility.",
      },
    ];

    const request: ReturnRequest = {
      id,
      orderId: order.id,
      kind: "replacement",
      reason: input.reason,
      requestedAt,
      status: "Replacement Created",
      returnCharges: 0,
      replacementOrderId: replacement.id,
      stages,
    };
    persistReturnRequest(order.id, request);
    return request;
  }

  const refundAmount = order.total - charges;
  const stages: ShipmentEvent[] = [
    { id: "requested", title: "Return Requested", at: requestedAt, reached: true },
    {
      id: "approved",
      title: "Return Approved",
      at: at(1),
      reached: false,
      detail: "Approval is typically confirmed within 24–48 hours.",
    },
    {
      id: "pickup",
      title: "Pickup",
      at: at(48),
      location: inputPicker(order),
      reached: false,
      detail: "The courier will call you before the pickup slot.",
    },
    {
      id: "refund",
      title: "Refund",
      at: at(120),
      reached: false,
      detail: `Refund of ${formatPrice(refundAmount)} (₹${charges} pickup charges deducted) to your original payment method within 5–7 business days of pickup.`,
    },
  ];

  const request: ReturnRequest = {
    id,
    orderId: order.id,
    kind: "return",
    reason: input.reason,
    requestedAt,
    status: "Return Requested",
    returnCharges: charges,
    refundAmount,
    stages,
  };
  persistReturnRequest(order.id, request);
  return request;
}

function inputPicker(order: Order) {
  const city = order.deliveryAddress?.city;
  const state = order.deliveryAddress?.state;
  return city && state ? `${city}, ${state}, India` : undefined;
}

// ---------- Wishlist ----------

export function getWishlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WISHLIST_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function isInWishlist(bookId: string) {
  return getWishlist().includes(bookId);
}

export function toggleWishlist(bookId: string) {
  if (typeof window === "undefined") return;
  const wishlist = getWishlist();
  const index = wishlist.indexOf(bookId);
  if (index === -1) {
    wishlist.push(bookId);
  } else {
    wishlist.splice(index, 1);
  }
  window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
}

export const TRACKING_STEPS = [
  "Ordered",
  "Packed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
] as const;