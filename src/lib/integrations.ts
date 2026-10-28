import type { Order } from "@/types";

const INTEGRATIONS_KEY = "vgmf_integrations";
const ORDER_SETTINGS_KEY = "vgmf_order_settings";

export type PaymentMode = "demo" | "test" | "live";
export type EmailProvider = "zeptomail" | "zoho";
export type WhatsAppProvider = "none" | "meta" | "aisensy";
export type AggregatorId = "shiprocket" | "nimbuspost" | "shipyaari";
export type HyperlocalId = "tookan" | "shipday";

export interface WhatsAppTemplate {
  name: string;
  language: string;
  status: string;
  category: string;
  body: string;
  variables: number;
}

export const notificationEvents = [
  { id: "order-placed", label: "Order placed" },
  { id: "order-status", label: "Order status changed" },
  { id: "payment-link", label: "Payment link" },
  { id: "refund", label: "Refund issued" },
  { id: "shipment-booked", label: "Shipment booked" },
  { id: "account-created", label: "Account created" },
  { id: "support-reply", label: "Support reply" },
  { id: "ticket-update", label: "Ticket update" },
  { id: "abandoned-cart", label: "Abandoned cart" },
] as const;

export type NotificationEventId = (typeof notificationEvents)[number]["id"];

export interface PickupAddress {
  nickname: string;
  contactName: string;
  phone: string;
  email: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface IntegrationSettings {
  razorpay: {
    mode: PaymentMode;
    testKeyId: string;
    testKeySecret: string;
    liveKeyId: string;
    liveKeySecret: string;
    webhookSecret: string;
    linkExpiryHours: number;
  };
  email: {
    provider: EmailProvider;
    fromAddress: string;
    fromName: string;
    zeptoToken: string;
    zeptoHost: string;
    zohoClientId: string;
    zohoClientSecret: string;
    zohoRefreshToken: string;
    zohoAccountId: string;
    zohoDomain: string;
  };
  whatsapp: {
    provider: WhatsAppProvider;
    metaAppId: string;
    metaWabaId: string;
    metaPhoneNumberId: string;
    metaAccessToken: string;
    metaApiVersion: string;
    aisensyApiKey: string;
    aisensyProjectId: string;
    templates: WhatsAppTemplate[];
    templatesSyncedAt: string;
    /** Site event → template (Meta) or campaign (AiSensy) name. */
    mapping: Partial<Record<NotificationEventId, string>>;
  };
  shipping: {
    shiprocket: { email: string; password: string; channelId: string; enabled: boolean };
    nimbuspost: { email: string; password: string; enabled: boolean };
    shipyaari: { apiKey: string; secret: string; clientId: string; enabled: boolean };
    tookan: { apiKey: string; teamId: string; enabled: boolean };
    shipday: { apiKey: string; enabled: boolean };
    pickup: PickupAddress;
    defaultWeightKg: number;
    packageCm: { length: number; breadth: number; height: number };
    autoBookOnPack: boolean;
    autoSchedulePickup: boolean;
    rateChoice: "customer" | "cheapest" | "fastest";
  };
}

export interface OrderSettings {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  codEnabled: boolean;
  codFee: number;
  shippingFeeMode: "free" | "flat" | "per_item" | "free_above" | "courier_rate";
  flatFee: number;
  perItemFee: number;
  freeAbove: number;
  showCourierChoice: boolean;
  returns: {
    enabled: boolean;
    windowDays: number;
    pickupCharge: number;
    replacementAllowed: boolean;
    reasons: string[];
  };
  refunds: {
    method: "original" | "manual";
    processingDays: number;
    autoRefundOnReturnPickup: boolean;
  };
  cancellation: {
    enabled: boolean;
    allowedUntil: "Ordered" | "Packed" | "Shipped";
    windowHours: number;
    fee: number;
  };
}

export const defaultIntegrations: IntegrationSettings = {
  razorpay: {
    mode: "demo",
    testKeyId: "",
    testKeySecret: "",
    liveKeyId: "",
    liveKeySecret: "",
    webhookSecret: "",
    linkExpiryHours: 72,
  },
  email: {
    provider: "zeptomail",
    fromAddress: "noreply@vaidyagogate.org",
    fromName: "Vaidya Gogate Memorial Foundation",
    zeptoToken: "",
    zeptoHost: "api.zeptomail.in",
    zohoClientId: "",
    zohoClientSecret: "",
    zohoRefreshToken: "",
    zohoAccountId: "",
    zohoDomain: "zoho.in",
  },
  whatsapp: {
    provider: "none",
    metaAppId: "",
    metaWabaId: "",
    metaPhoneNumberId: "",
    metaAccessToken: "",
    metaApiVersion: "v21.0",
    aisensyApiKey: "",
    aisensyProjectId: "",
    templates: [],
    templatesSyncedAt: "",
    mapping: {},
  },
  shipping: {
    shiprocket: { email: "", password: "", channelId: "", enabled: true },
    nimbuspost: { email: "", password: "", enabled: true },
    shipyaari: { apiKey: "", secret: "", clientId: "", enabled: false },
    tookan: { apiKey: "", teamId: "", enabled: false },
    shipday: { apiKey: "", enabled: false },
    pickup: {
      nickname: "VGMF-PUNE",
      contactName: "VGMF Dispatch",
      phone: "9000000001",
      email: "dispatch@vaidyagogate.org",
      line1: "Vaidya Gogate Memorial Foundation, FC Road",
      line2: "Shivaji Nagar",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411005",
      country: "India",
    },
    defaultWeightKg: 0.5,
    packageCm: { length: 25, breadth: 20, height: 5 },
    autoBookOnPack: true,
    autoSchedulePickup: true,
    rateChoice: "customer",
  },
};

export const defaultOrderSettings: OrderSettings = {
  deliveryEnabled: true,
  pickupEnabled: true,
  codEnabled: false,
  codFee: 30,
  shippingFeeMode: "free_above",
  flatFee: 49,
  perItemFee: 25,
  freeAbove: 499,
  showCourierChoice: true,
  returns: {
    enabled: true,
    windowDays: 7,
    pickupCharge: 50,
    replacementAllowed: true,
    reasons: ["Damaged or defective item", "Wrong item delivered", "Edition or size mismatch", "No longer needed"],
  },
  refunds: { method: "original", processingDays: 7, autoRefundOnReturnPickup: false },
  cancellation: { enabled: true, allowedUntil: "Packed", windowHours: 24, fee: 0 },
};

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("vgmf-cms"));
}

function merge<T extends object>(base: T, saved: Partial<T> | null | undefined): T {
  if (!saved) return structuredClone(base);
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(saved)) {
    const current = (base as Record<string, unknown>)[key];
    if (value && typeof value === "object" && !Array.isArray(value) && current && typeof current === "object" && !Array.isArray(current)) {
      out[key] = merge(current as object, value as object);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as T;
}

export function getIntegrations(): IntegrationSettings {
  return merge(defaultIntegrations, readJSON<Partial<IntegrationSettings> | null>(INTEGRATIONS_KEY, null));
}

export function saveIntegrations(settings: IntegrationSettings) {
  writeJSON(INTEGRATIONS_KEY, settings);
}

export function getOrderSettings(): OrderSettings {
  return merge(defaultOrderSettings, readJSON<Partial<OrderSettings> | null>(ORDER_SETTINGS_KEY, null));
}

export function saveOrderSettings(settings: OrderSettings) {
  writeJSON(ORDER_SETTINGS_KEY, settings);
}

export function razorpayKeys(settings = getIntegrations()) {
  const { mode } = settings.razorpay;
  if (mode === "live") return { mode, keyId: settings.razorpay.liveKeyId, keySecret: settings.razorpay.liveKeySecret };
  if (mode === "test") return { mode, keyId: settings.razorpay.testKeyId, keySecret: settings.razorpay.testKeySecret };
  return { mode, keyId: "", keySecret: "" };
}

export function shippingFeeFor(
  subtotal: number,
  itemCount: number,
  courierRate: number | undefined,
  settings = getOrderSettings()
) {
  switch (settings.shippingFeeMode) {
    case "free":
      return 0;
    case "flat":
      return settings.flatFee;
    case "per_item":
      return settings.perItemFee * Math.max(1, itemCount);
    case "free_above":
      return subtotal >= settings.freeAbove ? 0 : settings.flatFee;
    case "courier_rate":
      return Math.round(courierRate ?? settings.flatFee);
  }
}

export function shippingFeeSummary(settings = getOrderSettings()) {
  switch (settings.shippingFeeMode) {
    case "free":
      return "Free shipping";
    case "flat":
      return `Shipping ₹${settings.flatFee} per order`;
    case "per_item":
      return `Shipping ₹${settings.perItemFee} per item`;
    case "free_above":
      return `Shipping ₹${settings.flatFee} · free above ₹${settings.freeAbove}`;
    case "courier_rate":
      return "Shipping at the courier's rate for your pincode";
  }
}

const cancellableOrder: Order["status"][] = ["Pending", "Paid", "Processing", "Ordered", "Packed", "Shipped"];

export function canCustomerCancel(order: Order, settings = getOrderSettings(), now = Date.now()) {
  if (!settings.cancellation.enabled) return false;
  const limit = cancellableOrder.indexOf(settings.cancellation.allowedUntil);
  const at = cancellableOrder.indexOf(order.status);
  if (at === -1 || at > limit) return false;
  const hours = (now - Date.parse(order.date)) / 36e5;
  return settings.cancellation.windowHours <= 0 || hours <= settings.cancellation.windowHours;
}

export function canCustomerReturn(order: Order, settings = getOrderSettings()) {
  if (!settings.returns.enabled || order.status !== "Delivered" || order.returnRequest) return false;
  const deliveredAt = order.history?.slice().reverse().find((entry) => entry.status === "Delivered")?.at ?? order.date;
  return (Date.now() - Date.parse(deliveredAt)) / 864e5 <= settings.returns.windowDays;
}

export function mask(value: string) {
  if (!value) return "";
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 4)}${"•".repeat(Math.min(12, value.length - 8))}${value.slice(-4)}`;
}
