import type {
  Book,
  CartItem,
  Order,
  ReturnKind,
  ReturnRequest,
  ShipmentEvent,
  ShipmentRecord,
} from "@/types";
import type { DeliveryAddress, ReturnEvidenceKind, ReturnResolution } from "@/types";
import { getSession, isPortalRole } from "@/lib/auth";
import { orderBelongsTo, phonesMatch, type AccountRef } from "@/lib/commerce-stamp";
import { buildTrackingStages as buildCourierStages, isSampleOrder } from "@/lib/order-pipeline";
export type { TrackingStage, TrackingStageId } from "@/lib/order-pipeline";
export { pickupOtp, pickupOtpReady } from "@/lib/order-pipeline";
import { storeConfig } from "@/lib/constants";
import { publishCartChange } from "@/lib/cart-store";
import { formatDate } from "@/lib/utils";
import { getLiveBook, isPurchasable, canPreorder, restockProduct } from "@/lib/product-data";
import { pushInbox } from "@/lib/inbox";
import { queueNotification } from "@/lib/notify";
import { checkPincode } from "@/lib/fulfillment";
import { commerceCharges, getOrderSettings, reasonOpen, shippingFeeFor } from "@/lib/integrations";

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
  window.localStorage.setItem("vgmf_cart_at", String(Date.now()));
  publishCartChange();
  window.dispatchEvent(new Event("vgmf-cart-edit"));
}

export function addToCart(bookId: string, quantity = 1) {
  const cart = getCart();
  const existing = cart.find((item) => item.bookId === bookId);
  const cap = quantityCap(bookId);
  const next = Math.min(cap, Math.max(1, Math.floor(quantity)));
  if (existing) {
    existing.quantity = Math.min(cap, existing.quantity + next);
  } else {
    cart.push({ bookId, quantity: next });
  }
  persistCart(cart);
}

/** Orders above this many copies of a title are taken by the Foundation desk, which contacts the customer. */
export const BULK_ORDER_LIMIT = 100;

export function quantityCap(bookId: string) {
  const book = getBookById(bookId);
  if (!book) return BULK_ORDER_LIMIT;
  if (isPurchasable(book)) return Math.min(BULK_ORDER_LIMIT, Math.max(1, book.stock));
  if (canPreorder(book)) return BULK_ORDER_LIMIT;
  return 1;
}

export function setCartQuantity(bookId: string, quantity: number) {
  if (quantity < 1) {
    removeFromCart(bookId);
    return;
  }
  const next = Math.min(quantityCap(bookId), Math.floor(quantity));
  const cart = getCart();
  const item = cart.find((entry) => entry.bookId === bookId);
  if (item) {
    item.quantity = next;
  } else {
    cart.push({ bookId, quantity: next });
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
  platformFee: number;
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
  const charges = commerceCharges(subtotal);
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  const shipping = subtotal === 0 ? 0 : shippingFeeFor(subtotal, units, undefined, getOrderSettings());
  const total = subtotal + charges.gst + charges.platformFee + shipping;
  return { mrp, subtotal, discount, gst: charges.gst, platformFee: charges.platformFee, shipping, total };
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

/** Keep a copy on this website so the clinic desk can find the order from another device. */
/** Customer cancels their own order; the server checks the desk's cancellation rules. */
export async function cancelMyOrder(orderId: string, reason: string, phone?: string): Promise<Order> {
  const response = await fetch("/api/shop/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ action: "cancel", orderId, reason, phone }),
  });
  const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; order?: Order } | null;
  if (!response.ok || !data?.ok || !data.order) throw new Error(data?.error || "Could not cancel the order.");
  const cancelled = data.order;
  const orders = getOrders();
  const next = orders.some((item) => item.id === orderId) ? orders.map((item) => (item.id === orderId ? { ...item, ...cancelled } : item)) : [cancelled, ...orders];
  window.localStorage.setItem(ORDERS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("vgmf-cms"));
  return cancelled;
}

export function publishShopOrder(order: Order) {
  if (typeof window === "undefined" || !order?.id) return;
  void fetch("/api/shop/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ order }),
  }).catch(() => undefined);
}

/** Keep the booked courier on this website so phones see the same tracking. */
export function publishShipment(shipment: ShipmentRecord) {
  if (typeof window === "undefined" || !shipment?.id) return;
  void fetch("/api/shop/shipments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ shipment }),
  }).catch(() => undefined);
}

/** Keep the shopper's login on the order so another signed-in device can find it. */
export function withAccountEmail(order: Order): Order {
  if (order.accountEmail?.includes("@")) return order;
  const session = getSession();
  const delivery = order.deliveryAddress?.email?.trim().toLowerCase() || "";
  const created = (order.createdBy ?? "").trim().toLowerCase();
  const sessionEmail = session?.email?.trim().toLowerCase() || "";
  const portal = isPortalRole(session?.role);
  if (portal) {
    if (delivery && delivery !== sessionEmail) return { ...order, accountEmail: delivery };
    if (created.includes("@") && created !== sessionEmail) return { ...order, accountEmail: created };
    return delivery ? { ...order, accountEmail: delivery } : order;
  }
  const owns =
    !sessionEmail ||
    delivery === sessionEmail ||
    order.userId === session?.id ||
    order.userId?.toLowerCase() === sessionEmail ||
    phonesMatch(order.deliveryAddress?.phone, session?.phone ?? "");
  if (sessionEmail && owns) return { ...order, accountEmail: sessionEmail };
  return delivery ? { ...order, accountEmail: delivery } : order;
}

export function saveOrder(order: Order) {
  if (typeof window === "undefined") return;
  const stored = withAccountEmail(order);
  const orders = getOrders();
  orders.unshift(stored);
  window.localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  window.dispatchEvent(new Event("vgmf-cms"));
  publishShopOrder(stored);
}

export function getOrdersForAccount(account?: (AccountRef & { alternatePhone?: string; whatsapp?: string; accountId?: string }) | null) {
  if (!account) return [];
  return getOrders().filter(
    (order) =>
      !isSampleOrder(order) &&
      orderBelongsTo(order, {
        email: account.email,
        phone: account.phone,
        phones: [account.alternatePhone, account.whatsapp].filter((value): value is string => Boolean(value)),
        id: account.id,
        ids: account.accountId ? [account.accountId] : [],
      })
  );
}

export function getOrdersByEmail(email?: string) {
  return getOrdersForAccount(email ? { email } : null);
}

export function purgeSampleOrders() {
  if (typeof window === "undefined") return;
  const kept = getOrders().filter((order) => !isSampleOrder(order));
  if (kept.length === getOrders().length) return;
  window.localStorage.setItem(ORDERS_KEY, JSON.stringify(kept));
  window.dispatchEvent(new Event("vgmf-cms"));
}

// ---------- Tracking ----------

const COURIERS = ["Shiprocket Surface", "Nimbuspost", "iThink Logistics"];

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

/** The desk records the returned item's condition; only a good copy goes back into stock. */
export function recordReturnInspection(orderId: string, condition: NonNullable<ReturnRequest["inspection"]>["condition"], note?: string, by?: string) {
  const current = getReturnRequest(orderId);
  if (!current) throw new Error("No return is open on this order.");
  const inspection = { at: new Date().toISOString(), condition, note: note?.trim() || undefined, restock: condition === "Good", by };
  updateReturnRequest(orderId, { inspection });
  return advanceReturnRequest(orderId, current.status, "inspected", `Checked: ${condition}${inspection.note ? ` · ${inspection.note}` : ""}`);
}

/** The customer sends a declined request back to the desk for another look. */
export function resendCustomerRequest(orderId: string, note?: string) {
  const current = getReturnRequest(orderId);
  if (!current || current.status !== "Rejected") throw new Error("Only a declined request can be sent again.");
  return updateReturnRequest(orderId, {
    status: "Pending Review",
    requestedAt: new Date().toISOString(),
    note: note?.trim() || current.note,
    stages: current.stages.map((stage) => (stage.id === "decision" ? { ...stage, reached: false, detail: undefined } : stage)),
  });
}

export function chooseReturnMethod(orderId: string, method: "pickup" | "self") {
  return updateReturnRequest(orderId, { returnMethod: method });
}

/** Records each replacement-order step on the original request and tells the customer. */
export function syncReplacementProgress(order: Order) {
  const parentId = order.replacementOf;
  if (!parentId || typeof window === "undefined") return;
  const request = getReturnRequest(parentId);
  if (!request || request.status === "Rejected") return;
  const now = new Date().toISOString();
  const id = `fulfill-${order.status.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const detail = `Replacement order ${order.id} is ${order.status}.${order.trackingId ? ` Tracking ${order.trackingId}.` : ""}`;
  const stage: ShipmentEvent = { id, title: order.status, at: now, reached: true, detail };
  const existing = request.stages ?? [];
  const stages = existing.some((item) => item.id === id)
    ? existing.map((item) => (item.id === id ? { ...item, ...stage } : item))
    : [...existing, stage];
  persistReturnRequest(parentId, { ...request, replacementOrderId: request.replacementOrderId || order.id, stages });
  const email = order.accountEmail || order.deliveryAddress?.email || "";
  if (email) {
    pushInbox({
      audience: "customer",
      email,
      kind: "order",
      title: `Replacement is ${order.status}`,
      body: detail,
      href: `/account/orders/${encodeURIComponent(parentId)}`,
    });
  }
  pushInbox({
    audience: "staff",
    kind: "order",
    title: `Replacement ${order.id} is ${order.status}`,
    body: `Original order ${parentId}. ${detail}`,
    href: "/admin/commerce/orders",
  });
}

function persistReturnRequest(orderId: string, request: ReturnRequest) {
  if (typeof window === "undefined") return;
  const map = getReturnRequests();
  map[orderId] = request;
  window.localStorage.setItem(RETURNS_KEY, JSON.stringify(map));
  const orders = getOrders();
  const index = orders.findIndex((order) => order.id === orderId);
  if (index !== -1) {
    orders[index] = { ...orders[index], returnRequest: request };
    window.localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  }
  window.dispatchEvent(new Event("vgmf-cms"));
}

function returnRequestId() {
  return `RTN${Math.floor(100000000000 + Math.random() * 900000000000)}`;
}

function generateReplacementOrder(source: Order, request?: ReturnRequest): Order {
  const id = generateOrderId();
  const chosen = new Map((request?.items ?? []).map((item) => [item.bookId, item.quantity]));
  const items = chosen.size
    ? source.items.filter((item) => chosen.has(item.bookId)).map((item) => ({ ...item, quantity: Math.min(item.quantity, chosen.get(item.bookId) ?? item.quantity) }))
    : source.items;
  const placedAt = new Date().toISOString();
  const courierName = source.deliveryMode === "delivery" ? pickCourier(id) : undefined;
  return {
    ...source,
    id,
    date: placedAt,
    status: "Ordered",
    paymentStatus: "Paid",
    paymentMethod: "Replacement",
    subtotal: 0,
    discount: 0,
    gst: 0,
    shipping: 0,
    total: 0,
    storeCreditUsed: 0,
    refundAmount: undefined,
    refunds: undefined,
    cancelReason: undefined,
    shipmentId: undefined,
    razorpayOrderId: undefined,
    razorpayPaymentId: undefined,
    paymentLink: undefined,
    paymentRef: undefined,
    paidAt: placedAt,
    eta: getEstimatedDeliveryDate(6),
    trackingId: courierName ? generateTrackingId(courierName) : undefined,
    trackToken: undefined,
    courierName,
    returnableDays: storeConfig.returnDays,
    replacementOf: source.id,
    items,
    deliveryAddress: request?.replacementAddress ?? source.deliveryAddress,
    returnRequest: undefined,
    returnShipment: undefined,
    history: [{ at: placedAt, status: "Ordered", note: `Free replacement for ${source.id}` }],
  };
}

const REPLACEMENT_STAGES: ShipmentEvent[] = [
  { id: "requested", title: "Replacement requested", at: "", reached: false },
  { id: "review", title: "Under review", at: "", reached: false },
  { id: "decision", title: "Decision", at: "", reached: false, detail: "Accepted requests get a return label for the defective item." },
  { id: "return-label", title: "Return label shared", at: "", reached: false, detail: "Download the return label, paste it on the parcel with the defective item and hand it to the courier." },
  { id: "return-pickup", title: "Defective item picked up", at: "", reached: false, detail: "The courier brings the defective item back to the Foundation." },
  { id: "inspected", title: "Received and checked", at: "", reached: false, detail: "The desk checks the returned item." },
  { id: "replacement", title: "Replacement order sent", at: "", reached: false, detail: "A new free order is placed after the check." },
];

/** Replacement steps in order: return of the defective item first, then the new order. */
function withReplacementStages(existing: ShipmentEvent[]) {
  const byId = new Map(existing.map((stage) => [stage.id, stage]));
  const base = REPLACEMENT_STAGES.map((stage) => {
    const found = byId.get(stage.id);
    return found ? { ...stage, ...found, title: stage.id === "replacement" ? stage.title : found.title } : stage;
  });
  const extra = existing.filter((stage) => !REPLACEMENT_STAGES.some((item) => item.id === stage.id));
  return [...base, ...extra];
}

/** Moves a replacement request to its next status and marks that step on the pipeline. */
export function advanceReturnRequest(orderId: string, status: ReturnRequest["status"], stageId: string, detail?: string) {
  const current = getReturnRequest(orderId) ?? getOrders().find((order) => order.id === orderId)?.returnRequest;
  if (!current) return undefined;
  const now = new Date().toISOString();
  const stages = (current.kind === "replacement" ? withReplacementStages(current.stages ?? []) : current.stages ?? []).map((stage) =>
    stage.id === stageId ? { ...stage, at: now, reached: true, detail: detail || stage.detail } : stage
  );
  const next: ReturnRequest = { ...current, status, stages };
  // Returned (or wrongly delivered) units go back on the shelf once, when the return is closed.
  if ((status === "Refunded" || status === "Replacement Created") && !current.restockedAt && current.inspection?.restock) {
    const original = getOrders().find((order) => order.id === orderId);
    for (const item of current.items ?? original?.items ?? []) restockProduct(item.bookId, item.quantity);
    next.restockedAt = now;
  }
  persistReturnRequest(orderId, next);
  const source = getOrders().find((order) => order.id === orderId);
  const title = stages.find((stage) => stage.id === stageId)?.title ?? status;
  if (source) notifyReplacement(source, `${current.kind === "replacement" ? "Replacement" : "Return"} ${current.id}: ${title}`, detail || title, "customer");
  return next;
}

/** After the defective item is back and checked, the free replacement order is placed. */
export function sendReplacementAfterInspection(orderId: string, by?: string) {
  const current = getReturnRequest(orderId) ?? getOrders().find((order) => order.id === orderId)?.returnRequest;
  if (!current || current.kind !== "replacement") throw new Error("No replacement is open on this order.");
  if (current.replacementOrderId) throw new Error(`Replacement order ${current.replacementOrderId} is already placed.`);
  if (!current.inspection) throw new Error("Record the inspection of the returned item first.");
  const source = getOrders().find((order) => order.id === orderId);
  if (!source) throw new Error("The original order could not be found.");
  const replacement = generateReplacementOrder(source, current);
  saveOrder(replacement);
  const now = new Date().toISOString();
  const request: ReturnRequest = {
    ...current,
    status: "Replacement Created",
    decidedBy: current.decidedBy || by,
    replacementOrderId: replacement.id,
    stages: withReplacementStages(current.stages ?? []).map((stage) => {
      if (stage.id === "return-pickup" && !stage.reached) return { ...stage, at: now, reached: true };
      if (stage.id === "inspected") return { ...stage, at: now, reached: true, detail: "The returned item was received and checked." };
      if (stage.id === "replacement") return { ...stage, at: now, reached: true, detail: `Free replacement order ${replacement.id} placed.` };
      return stage;
    }),
  };
  if (current.inspection.restock && !current.restockedAt) {
    for (const item of current.items ?? source.items) restockProduct(item.bookId, item.quantity);
    request.restockedAt = now;
  }
  persistReturnRequest(orderId, request);
  notifyReplacement(source, `Replacement order ${replacement.id} placed`, `We received and checked the returned item. Follow order ${replacement.id} until it is delivered.`, "both");
  return request;
}

export function requestDamagedReplacement(
  order: Order,
  input: { reason?: string; images: string[]; note?: string }
): ReturnRequest {
  if (getReturnRequest(order.id)) throw new Error("A replacement request is already open on this order.");
  if (!input.images.length) throw new Error("Share at least one photo of the damaged item.");
  const requestedAt = new Date().toISOString();
  const request: ReturnRequest = {
    id: returnRequestId(),
    orderId: order.id,
    kind: "replacement",
    reason: input.reason?.trim() || "Damaged or defective item",
    requestedAt,
    source: "customer",
    status: "Pending Review",
    returnCharges: 0,
    images: input.images,
    note: input.note?.trim() || undefined,
    stages: withReplacementStages([
      { id: "requested", title: "Replacement requested", at: requestedAt, reached: true, detail: "Photos received. The Foundation desk will review this request." },
      { id: "review", title: "Under review", at: requestedAt, reached: true, detail: "Admin will accept or reject after checking the images." },
    ]),
  };
  persistReturnRequest(order.id, request);
  notifyReplacement(order, `Replacement request ${request.id}`, "Photos received. The desk will accept or reject this request.", "customer");
  return request;
}

function notifyReplacement(order: Order, title: string, body: string, who: "customer" | "both") {
  const email = order.accountEmail || order.deliveryAddress?.email || "";
  if (email) {
    queueNotification({
      to: email,
      subject: title,
      template: "return-created",
      body: `Dear ${order.deliveryAddress?.fullName || "Reader"},\n\nNamaste, and greetings from Vaidya Gogate Memorial Foundation.\n\n${body}\n\nOrder ${order.id}. Follow each step in My Orders.\n\nWith warm regards,\nVaidya Gogate Memorial Foundation`,
    });
    pushInbox({
      audience: "customer",
      email,
      kind: "order",
      title,
      body,
      href: `/account/orders/${encodeURIComponent(order.id)}`,
    });
  }
  if (who === "both" || who === "customer") {
    pushInbox({
      audience: "staff",
      kind: "order",
      title,
      body: `Order ${order.id}. ${body}`,
      href: "/admin/commerce/orders",
    });
  }
}

export type CustomerRequestInput = {
  resolution: ReturnResolution;
  items: { bookId: string; quantity: number }[];
  reason: string;
  note?: string;
  evidence: Partial<Record<ReturnEvidenceKind, string[]>>;
  replacementAddress?: DeliveryAddress;
};

/**
 * Customer return or replacement of a delivered order. Nothing is refunded or sent here:
 * the desk approves first and, where the item comes back, checks it before the refund or new copy.
 */
export function submitCustomerRequest(order: Order, input: CustomerRequestInput): ReturnRequest {
  if (getReturnRequest(order.id) ?? order.returnRequest) throw new Error("A request is already open on this order.");
  const settings = getOrderSettings();
  const rule = settings.returns.reasonRules.find((item) => item.label === input.reason);
  if (!rule) throw new Error("Choose a reason.");
  if (!reasonOpen(rule, order, settings)) throw new Error("The time to report this issue has passed.");
  const items = input.items
    .map((pick) => {
      const line = order.items.find((item) => item.bookId === pick.bookId);
      const quantity = Math.min(line?.quantity ?? 0, Math.max(0, Math.floor(pick.quantity)));
      return line && quantity > 0 ? { bookId: line.bookId, title: line.title, quantity, price: line.price } : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (!items.length) throw new Error("Choose at least one product.");
  const missing = rule.require.filter((kind) => !input.evidence[kind]?.length);
  if (missing.length) throw new Error("Add the evidence marked required.");
  if (input.resolution === "replacement" && !(settings.returns.replacementAllowed && rule.replacement)) throw new Error("Replacement is not available for this reason.");
  if (input.resolution === "return_refund" && !(settings.returns.enabled && settings.returns.returnForRefund)) throw new Error("Returns for refund are not available.");
  if (input.resolution === "refund") throw new Error("The item has to be sent back first.");

  const requestedAt = new Date().toISOString();
  const value = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const refundable = Math.max(0, order.total - Math.max(0, order.platformFee ?? 0) - (order.refundAmount ?? 0));
  const refundAmount = input.resolution === "replacement" ? 0 : Math.min(value, refundable);
  const photos = (["product", "packaging", "label"] as const).flatMap((kind) => input.evidence[kind] ?? []);
  const step = (id: string, title: string, detail: string, reached = false) => ({ id, title, at: requestedAt, reached, detail });
  const stages =
    input.resolution === "replacement"
      ? withReplacementStages([
          step("requested", "Replacement requested", "Evidence received. The Foundation desk will review this request.", true),
          step("review", "Under review", "You will get an email once the desk accepts or rejects it."),
        ])
      : [
          step("requested", "Return requested", "Evidence received. The Foundation desk will review this request.", true),
          step("decision", "Decision", "You will get an email once the desk accepts or cancels the request."),
          ...(input.resolution === "return_refund"
            ? [
                step("pickup", "Pickup", "Free pickup. The courier will call before collecting the parcel."),
                step("inspected", "Received and checked", "The desk checks the returned item before the refund."),
              ]
            : []),
          step("refund", "Refund", `Refund of ${formatPrice(refundAmount)} to your original payment method once approved${input.resolution === "return_refund" ? " and the item is checked" : ""}. The platform fee is non-refundable.`),
        ];
  const request: ReturnRequest = {
    id: returnRequestId(),
    orderId: order.id,
    kind: input.resolution === "replacement" ? "replacement" : "return",
    reason: rule.label,
    requestedAt,
    source: "customer",
    status: "Pending Review",
    returnCharges: 0,
    refundAmount: input.resolution === "replacement" ? undefined : refundAmount,
    items,
    resolution: input.resolution,
    evidence: input.evidence,
    images: photos.length ? photos : undefined,
    note: input.note?.trim() || undefined,
    replacementAddress: input.resolution === "replacement" ? input.replacementAddress : undefined,
    stages,
  };
  persistReturnRequest(order.id, request);
  const label = input.resolution === "replacement" ? "Replacement" : "Return";
  notifyReplacement(
    order,
    `${label} request ${request.id} received`,
    `We received your ${label.toLowerCase()} request ${request.id} for ${items.map((item) => `${item.quantity} × ${item.title}`).join(", ")}. The Foundation desk will review it and email you. There is no charge to you for this ${label.toLowerCase()}.`,
    "both"
  );
  return request;
}

/** Uploads one photo or video for a return / replacement request. */
export async function uploadReturnEvidence(file: File, orderId: string, phone?: string) {
  const body = new FormData();
  body.set("file", file, file.name);
  body.set("orderId", orderId);
  if (phone) body.set("phone", phone);
  const response = await fetch("/api/shop/evidence", { method: "POST", body, credentials: "same-origin" });
  const data = (await response.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
  if (!response.ok || !data.ok || !data.url) throw new Error(data.error || "Could not upload the file.");
  return data.url;
}

export function reviewReplacementRequest(
  orderId: string,
  input: { accept: boolean; note?: string; by?: string }
): ReturnRequest {
  const current = getReturnRequest(orderId);
  if (!current) throw new Error("No request is waiting on this order.");
  if (current.status !== "Pending Review" && current.status !== "Rejected") throw new Error("This request has already been reviewed.");
  const now = new Date().toISOString();
  if (current.kind === "return") {
    const source = getOrders().find((order) => order.id === orderId);
    const note = input.note?.trim();
    const request: ReturnRequest = {
      ...current,
      status: input.accept ? "Return Approved" : "Rejected",
      decidedAt: now,
      decidedBy: input.by,
      decisionNote: note || (input.accept ? "Return accepted." : "Return request cancelled."),
      stages: current.stages.map((stage) =>
        stage.id === "decision"
          ? { ...stage, at: now, reached: true, detail: input.accept ? (current.resolution === "refund" ? "Return accepted. The refund is on its way." : "Return accepted. A free pickup will be arranged.") : note || "The return request was cancelled by the desk." }
          : stage
      ),
    };
    persistReturnRequest(orderId, request);
    if (source) {
      notifyReplacement(
        source,
        input.accept ? `Return request ${request.id} accepted` : `Return request ${request.id} cancelled`,
        input.accept
          ? current.resolution === "refund"
            ? `Your return request has been accepted. A refund of ${formatPrice(current.refundAmount ?? 0)} will be sent to your original payment method.`
            : "Your return request has been accepted. There is no charge for the return; we will arrange the pickup and share the details. The refund is sent once the item is back with us and checked."
          : `Your return request was cancelled by the Foundation desk.${note ? ` Reason: ${note}` : ""}`,
        "both"
      );
    }
    return request;
  }
  if (!input.accept) {
    const request: ReturnRequest = {
      ...current,
      status: "Rejected",
      decidedAt: now,
      decidedBy: input.by,
      decisionNote: input.note?.trim() || "Rejected after reviewing the photos.",
      stages: current.stages.map((stage) =>
        stage.id === "decision"
          ? { ...stage, at: now, reached: true, detail: input.note?.trim() || "The replacement request was rejected." }
          : stage
      ),
    };
    persistReturnRequest(orderId, request);
    const source = getOrders().find((order) => order.id === orderId);
    if (source) notifyReplacement(source, `Replacement request ${request.id} was rejected`, request.decisionNote || "The desk rejected this request.", "both");
    return request;
  }
  const source = getOrders().find((order) => order.id === orderId);
  if (!source) throw new Error("The original order could not be found.");
  const request: ReturnRequest = {
    ...current,
    status: "Return Approved",
    decidedAt: now,
    decidedBy: input.by,
    decisionNote: input.note?.trim() || "Accepted. Send the defective item back with the return label; the replacement ships after the check.",
    stages: withReplacementStages(current.stages ?? []).map((stage) =>
      stage.id === "decision" ? { ...stage, at: now, reached: true, detail: "Accepted after reviewing the photos. A return label follows." } : stage
    ),
  };
  persistReturnRequest(orderId, request);
  notifyReplacement(source, `Replacement request ${request.id} accepted`, "Please send the defective item back first. We will share a return label; paste it on the parcel and hand it to the courier. The replacement ships once we have checked the item.", "both");
  return request;
}

export function initiateReturn(
  order: Order,
  input: { kind: ReturnKind; reason: string; source?: "customer" | "admin"; images?: string[] }
): ReturnRequest {
  const requestedAt = new Date().toISOString();
  const id = returnRequestId();
  const charges =
    input.kind === "return" ? getOrderSettings().returns.pickupCharge : 0;
  const at = (hours: number) =>
    new Date(new Date(requestedAt).getTime() + hours * 3600000).toISOString();

  if (input.kind === "replacement") {
    if (input.source === "customer") {
      return requestDamagedReplacement(order, { reason: input.reason, images: input.images ?? [], note: input.reason });
    }
    const stages = withReplacementStages([
      { id: "requested", title: "Replacement opened by the desk", at: requestedAt, reached: true },
      { id: "review", title: "Under review", at: requestedAt, reached: true },
      { id: "decision", title: "Decision", at: requestedAt, reached: true, detail: "Approved. A return label follows for the defective item." },
    ]);

    const request: ReturnRequest = {
      id,
      orderId: order.id,
      kind: "replacement",
      reason: input.reason,
      requestedAt,
      source: "admin",
      status: "Return Approved",
      returnCharges: 0,
      images: input.images,
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
    source: input.source ?? "admin",
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
  window.localStorage.setItem("vgmf_wishlist_at", String(Date.now()));
  window.dispatchEvent(new Event("vgmf-wishlist"));
}

export const TRACKING_STEPS = [
  "Ordered",
  "Packed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
] as const;