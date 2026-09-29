import { submitPublic } from "@/lib/public-submit";
import type {
  Book,
  CartItem,
  Order,
  ReturnKind,
  ReturnRequest,
  ShipmentEvent,
} from "@/types";
import { storeConfig } from "@/lib/constants";
import { publishCartChange } from "@/lib/cart-store";
import { formatDate } from "@/lib/utils";
import { getLiveBook } from "@/lib/product-data";

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
  const shipping =
    subtotal === 0 || subtotal >= storeConfig.freeShippingThreshold
      ? 0
      : storeConfig.shippingFee;
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
 * Simulates Shiprocket serviceability + transit lookup for a pincode.
 * Transit is derived from the postal zone of the pincode's first digit.
 */
export function getDeliveryEstimateForPincode(
  pincode: string
): DeliveryEstimate {
  const normalized = pincode.replace(/\D/g, "");
  const processingDays = storeConfig.orderPreparationDays;

  if (!/^\d{6}$/.test(normalized)) {
    return {
      serviceable: false,
      pincode: normalized,
      processingDays,
      transitDays: 0,
      totalDaysMin: 0,
      totalDaysMax: 0,
      from: "",
      to: "",
      courier: storeConfig.shippingGateway,
      note: "Enter a valid 6-digit pincode to check delivery dates.",
    };
  }

  const zone = Number(normalized[0]);
  if (zone === 0 || zone === 9) {
    return {
      serviceable: false,
      pincode: normalized,
      processingDays,
      transitDays: 0,
      totalDaysMin: 0,
      totalDaysMax: 0,
      from: "",
      to: "",
      courier: storeConfig.shippingGateway,
      note: "Shipping to this pincode is currently unavailable.",
    };
  }

  // Simulated Shiprocket transit (business days) by postal zone.
  const transit =
    zone === 1 ? 2 : zone === 2 ? 3 : zone <= 4 ? 4 : zone <= 6 ? 5 : 6;

  const totalDaysMin = processingDays + transit;
  const totalDaysMax = totalDaysMin + 2;

  return {
    serviceable: true,
    pincode: normalized,
    processingDays,
    transitDays: transit,
    totalDaysMin,
    totalDaysMax,
    from: formatDate(daysFromNow(totalDaysMin)),
    to: formatDate(daysFromNow(totalDaysMax)),
    courier: storeConfig.shippingGateway,
    note: "Deliveries originate from our Pune facility.",
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
  const address = order.deliveryAddress;
  void submitPublic("orders", {
    orderNumber: order.id,
    customerName: address?.fullName ?? "",
    email: address?.email ?? "",
    phone: address?.phone ?? "",
    total: order.total,
    paymentMethod: `${order.deliveryMode === "store_pickup" ? "Store pickup" : "Delivery"} · ${order.paymentStatus}`,
    address: address
      ? [address.line1, address.landmark, address.city, address.state, address.pincode].filter(Boolean).join(", ")
      : "",
    items: order.items,
  });
}

export function getOrdersByEmail(email?: string) {
  if (!email) return [];
  const value = email.toLowerCase();
  return getOrders().filter(
    (order) =>
      order.deliveryAddress?.email?.toLowerCase() === value ||
      order.deliveryAddress?.phone?.replace(/\D/g, "") === value.replace(/\D/g, "")
  );
}

// ---------- Tracking ----------

const COURIERS = ["Ekart Logistics", "Delhivery", "Blue Dart", "DTDC"];

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

export type TrackingStageId =
  | "ordered"
  | "packed"
  | "shipped"
  | "out"
  | "delivered"
  | "ready"
  | "picked"
  | "cancelled";

export interface TrackingStage {
  id: TrackingStageId;
  label: string;
  caption: string;
  events: ShipmentEvent[];
  reached: boolean;
  partial: boolean;
}

const STATUS_ORDER: Order["status"][] = [
  "Pending",
  "Paid",
  "Ordered",
  "Processing",
  "Packed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
];

function statusRank(status: Order["status"]) {
  const rank = STATUS_ORDER.indexOf(status);
  if (status === "Cancelled" || status === "Pending" || status === "Paid") {
    return 2; // behave like "Ordered" — only the placed event is reached
  }
  return rank;
}

/** Deterministic 6-digit pickup OTP derived from the order id. */
export function pickupOtp(orderId: string): string {
  let hash = 0;
  for (const char of orderId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return String(100000 + (hash % 900000));
}

/**
 * Builds the parcel tracking feed grouped by pipeline stage. Event timestamps
 * are simulated relative to the order placed date; swap this for live
 * Shiprocket API scan events when integrated.
 */
export function buildTrackingStages(order: Order): {
  stages: TrackingStage[];
  reachedEvents: number;
  totalEvents: number;
} {
  const placed = new Date(order.date);
  const at = (offsetMinutes: number) =>
    new Date(placed.getTime() + offsetMinutes * 60000).toISOString();

  const courier = order.courierName ?? storeConfig.courierName;
  const trackingId = order.trackingId ?? "-";
  const orderRank = statusRank(order.status);

  // A cancelled order jumps straight from Ordered → Cancelled.
  if (order.status === "Cancelled") {
    return {
      stages: [
        {
          id: "ordered",
          label: "Ordered",
          caption: "Order placed",
          reached: true,
          partial: false,
          events: [
            {
              id: "placed",
              title: "Your order has been placed",
              at: order.date,
              location: "Pune, Maharashtra, India",
              reached: true,
            },
          ],
        },
        {
          id: "cancelled",
          label: "Cancelled",
          caption: "Order cancelled",
          reached: true,
          partial: false,
          events: [
            {
              id: "cancelled",
              title: "Your order was cancelled",
              at: at(120),
              location: "Pune, Maharashtra, India",
              reached: true,
              detail:
                "Refund will be initiated to your original payment method within 3–5 business days.",
            },
          ],
        },
      ],
      reachedEvents: 2,
      totalEvents: 2,
    };
  }

  const makeStage = (
    id: TrackingStageId,
    label: string,
    caption: string,
    entries: Array<{ reachedAt: Order["status"]; event: ShipmentEvent }>
  ): TrackingStage => {
    const events = entries.map((entry) => ({
      ...entry.event,
      reached: orderRank >= statusRank(entry.reachedAt),
    }));
    const reached = events.every((event) => event.reached);
    const partial = !reached && events.some((event) => event.reached);
    return { id, label, caption, events, reached, partial };
  };

  const stages: TrackingStage[] = [];

  if (order.deliveryMode === "store_pickup") {
    stages.push(
      makeStage(
        "ordered",
        "Ordered",
        "Order placed",
        [
          {
            reachedAt: "Ordered",
            event: {
              id: "placed",
              title: "Your order has been placed",
              at: order.date,
              location: "Pune, Maharashtra, India",
            },
          },
        ]
      ),
      makeStage("packed", "Packed", "Packing at store", [
        {
          reachedAt: "Processing",
          event: {
            id: "processing",
            title: "Seller is processing your order",
            at: at(150),
            location: "Pune, Maharashtra, India",
          },
        },
        {
          reachedAt: "Packed",
          event: {
            id: "dispatched",
            title: "Your item is dispatched from seller facility",
            at: at(1470),
            location: "Pune, Maharashtra, India",
          },
        },
      ]),
      makeStage("ready", "Ready for Pickup", "Ready at store", [
        {
          reachedAt: "Packed",
          event: {
            id: "ready",
            title: "Your item is ready for store pickup",
            at: at(1500),
            location:
              "Vaidya Gogate Memorial Foundation, Pune, Maharashtra, India",
            detail: `Pickup OTP: ${pickupOtp(order.id)} — share it with the front desk to collect your order. Your item is held for ${storeConfig.pickupHoldingDays} days from this date. Carry a valid ID.`,
          },
        },
      ]),
      makeStage("picked", "Picked Up", "Collected from store", [
        {
          reachedAt: "Delivered",
          event: {
            id: "picked-up",
            title: "Item collected from store",
            at: at(3090),
            location: "Pune, Maharashtra, India",
            detail: "Thank you for shopping with us.",
          },
        },
      ])
    );
  } else {
    const destCity = order.deliveryAddress?.city || "Pune";
    const destState = order.deliveryAddress?.state || "Maharashtra";
    const dest = `${destCity}, ${destState}, India`;
    const pincode = order.deliveryAddress?.pincode;

    stages.push(
      makeStage("ordered", "Ordered", "Order placed", [
        {
          reachedAt: "Ordered",
          event: {
            id: "placed",
            title: "Your order has been placed",
            at: order.date,
            location: "Pune, Maharashtra, India",
          },
        },
      ]),
      makeStage(
        "packed",
        "Packed",
        "Packed & dispatched by seller",
        [
          {
            reachedAt: "Processing",
            event: {
              id: "processing",
              title: "Seller is processing your order",
              at: at(150),
              location: "Pune, Maharashtra, India",
            },
          },
          {
            reachedAt: "Packed",
            event: {
              id: "dispatched",
              title: "Your item has been dispatched from seller facility",
              at: at(1470),
              location: "Pune, Maharashtra, India",
            },
          },
        ]
      ),
      makeStage(
        "shipped",
        "Shipped",
        "Handed to courier",
        [
          {
            reachedAt: "Shipped",
            event: {
              id: "shipped",
              title: "Your item has been shipped",
              at: at(1590),
              location: "Pune, Maharashtra, India",
              detail: `Courier: ${courier} · Tracking id: ${trackingId}`,
            },
          },
          {
            reachedAt: "Shipped",
            event: {
              id: "arrive-hub",
              title: "Item arrived at Courier Facility",
              at: at(1680),
              location: "Pune, Maharashtra, India",
            },
          },
          {
            reachedAt: "Shipped",
            event: {
              id: "left-hub",
              title: "Item left a Courier Facility",
              at: at(2370),
              location: "Nagpur, Maharashtra, India",
            },
          },
          {
            reachedAt: "Shipped",
            event: {
              id: "arrive-dest",
              title: "Item arrived at Courier Facility",
              at: at(2940),
              location: dest,
            },
          },
        ]
      ),
      makeStage("out", "Out for Delivery", "Agent on the way", [
        {
          reachedAt: "Out for Delivery",
          event: {
            id: "out",
            title: "Your order is Out for delivery",
            at: at(3030),
            location: dest,
            agent: { name: "Ramesh Kumar", phone: "+91 98220 14487" },
            otp: pincode ? pincode.slice(-4) : "2981",
          },
        },
      ]),
      makeStage(
        "delivered",
        "Delivered",
        "Delivered",
        [
          {
            reachedAt: "Delivered",
            event: {
              id: "pod",
              title: "Shipment delivery update",
              at: at(3050),
              location: dest,
              detail:
                "Delivery confirmed at the address. Agent details are now hidden after delivery.",
            },
          },
          {
            reachedAt: "Delivered",
            event: {
              id: "delivered",
              title: "Item is Delivered",
              at: at(3090),
              location: dest,
              detail:
                "Updated on the courier site · delivered within the expected delivery timeline.",
            },
          },
        ]
      )
    );
  }

  const totalEvents = stages.reduce((sum, stage) => sum + stage.events.length, 0);
  const reachedEvents = stages.reduce(
    (sum, stage) => sum + stage.events.filter((event) => event.reached).length,
    0
  );

  return { stages, reachedEvents, totalEvents };
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
    input.kind === "return" ? storeConfig.returnPickupCharges : 0;
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