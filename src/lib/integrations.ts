import type { Order } from "@/types";

const INTEGRATIONS_KEY = "vgmf_integrations";
const ORDER_SETTINGS_KEY = "vgmf_order_settings";

export type PaymentMode = "demo" | "test" | "live";
export type EmailProvider = "zeptomail" | "zoho";
export type WhatsAppProvider = "none" | "meta" | "aisensy" | "zoho";
export type AggregatorId = "shiprocket" | "nimbuspost" | "ithink";
export type HyperlocalId = "tookan" | "shipday";
export type ShippingProviderId = AggregatorId | HyperlocalId;
export type ShippingConnection = { status: "success" | "failed" | "untested"; message: string; at: string };

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
  { id: "account-details", label: "Account details resent" },
  { id: "back-in-stock", label: "Back in stock" },
  { id: "store-credit", label: "Store credit issued" },
  { id: "return-created", label: "Return created" },
  { id: "pos-receipt", label: "In-store receipt" },
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
    posDeviceId: string;
    posDeviceMode: "wired" | "wireless";
  };
  paytm: {
    mode: PaymentMode | "staging";
    mid: string;
    merchantKey: string;
    tid: string;
    channelId: string;
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
    /** Agent API key from CPaaS → Agent → SMTP/API. WhatsApp send uses this, not OAuth. */
    zohoCpaasApiKey: string;
    /** WhatsApp sender number for the Agent, including country code (e.g. +9198…). */
    zohoCpaasFrom: string;
    zohoCpaasDomain: string;
    templates: WhatsAppTemplate[];
    templatesSyncedAt: string;
    /** Site event → template (Meta) or campaign (AiSensy) name. */
    mapping: Partial<Record<NotificationEventId, string>>;
  };
  shipping: {
    shiprocket: { email: string; password: string; channelId: string; enabled: boolean };
    nimbuspost: { email: string; password: string; enabled: boolean };
    ithink: { accessToken: string; secretKey: string; pickupAddressId: string; host: string; enabled: boolean };
    tookan: { apiKey: string; teamId: string; hyperlocal: boolean; parcel: boolean };
    shipday: { apiKey: string; enabled: boolean };
    connection: Partial<Record<ShippingProviderId, ShippingConnection>>;
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
    enabled: boolean;
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
  adminActions: {
    processAfterDelivery: boolean;
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
    posDeviceId: "",
    posDeviceMode: "wireless",
  },
  paytm: {
    mode: "demo",
    mid: "",
    merchantKey: "",
    tid: "",
    channelId: "",
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
    zohoCpaasApiKey: "",
    zohoCpaasFrom: "",
    zohoCpaasDomain: "zoho.com",
    templates: [],
    templatesSyncedAt: "",
    mapping: {},
  },
  shipping: {
    shiprocket: { email: "", password: "", channelId: "", enabled: true },
    nimbuspost: { email: "", password: "", enabled: true },
    ithink: { accessToken: "", secretKey: "", pickupAddressId: "", host: "https://my.ithinklogistics.com/api_v3/", enabled: false },
    tookan: { apiKey: "", teamId: "", hyperlocal: true, parcel: true },
    shipday: { apiKey: "", enabled: true },
    connection: {},
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
  refunds: { enabled: true, method: "original", processingDays: 7, autoRefundOnReturnPickup: false },
  cancellation: { enabled: true, allowedUntil: "Packed", windowHours: 24, fee: 0 },
  adminActions: { processAfterDelivery: true },
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

export function shippingProviderId(id: string): ShippingProviderId | null {
  if (id === "tookan-parcel") return "tookan";
  if (id === "shiprocket" || id === "nimbuspost" || id === "ithink" || id === "tookan" || id === "shipday") return id;
  return null;
}

function credentialFingerprint(shipping: IntegrationSettings["shipping"], provider: ShippingProviderId) {
  if (provider === "shiprocket") return `${shipping.shiprocket.email}\0${shipping.shiprocket.password}\0${shipping.shiprocket.channelId}`;
  if (provider === "nimbuspost") return `${shipping.nimbuspost.email}\0${shipping.nimbuspost.password}`;
  if (provider === "ithink") return `${shipping.ithink.accessToken}\0${shipping.ithink.secretKey}\0${shipping.ithink.host}`;
  if (provider === "tookan") return `${shipping.tookan.apiKey}\0${shipping.tookan.teamId}`;
  return shipping.shipday.apiKey;
}

export function hasShippingCredentials(provider: ShippingProviderId, settings = getIntegrations()) {
  const shipping = settings.shipping;
  if (provider === "shiprocket") return Boolean(shipping.shiprocket.email && shipping.shiprocket.password);
  if (provider === "nimbuspost") return Boolean(shipping.nimbuspost.email && shipping.nimbuspost.password);
  if (provider === "ithink") return Boolean(shipping.ithink.accessToken && shipping.ithink.secretKey);
  if (provider === "tookan") return Boolean(shipping.tookan.apiKey);
  if (provider === "shipday") return Boolean(shipping.shipday.apiKey);
  return false;
}

export function getShippingConnection(provider: ShippingProviderId): ShippingConnection {
  return getIntegrations().shipping.connection[provider] ?? { status: "untested", message: "", at: "" };
}

export function getIntegrations(): IntegrationSettings {
  const merged = merge(defaultIntegrations, readJSON<Partial<IntegrationSettings> | null>(INTEGRATIONS_KEY, null));
  const tookan = merged.shipping.tookan as typeof merged.shipping.tookan & { enabled?: boolean };
  if ((tookan.enabled || tookan.apiKey) && !tookan.hyperlocal && !tookan.parcel) {
    tookan.hyperlocal = true;
    tookan.parcel = true;
  }
  if (merged.shipping.shipday.apiKey && merged.shipping.shipday.enabled === false) {
    /* keep an explicit off; empty key stays available to turn on */
  }
  if (!merged.shipping.connection) merged.shipping.connection = {};
  return merged;
}

export function recordShippingConnection(provider: ShippingProviderId, status: ShippingConnection["status"], message: string) {
  const settings = getIntegrations();
  settings.shipping.connection = {
    ...settings.shipping.connection,
    [provider]: { status, message, at: new Date().toISOString() },
  };
  writeJSON(INTEGRATIONS_KEY, settings);
  return settings.shipping.connection[provider]!;
}

export function saveIntegrations(settings: IntegrationSettings) {
  const previous = getIntegrations();
  const next = merge(defaultIntegrations, settings);
  const providers: ShippingProviderId[] = ["shiprocket", "nimbuspost", "ithink", "tookan", "shipday"];
  const connection = { ...next.shipping.connection, ...previous.shipping.connection };
  for (const provider of providers) {
    if (credentialFingerprint(previous.shipping, provider) !== credentialFingerprint(next.shipping, provider)) {
      connection[provider] = { status: "untested", message: "", at: "" };
    }
  }
  next.shipping.connection = connection;
  writeJSON(INTEGRATIONS_KEY, next);
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

export function paytmKeys(settings = getIntegrations()) {
  const { mode } = settings.paytm;
  return {
    mode,
    mid: settings.paytm.mid,
    merchantKey: settings.paytm.merchantKey,
    tid: settings.paytm.tid,
    channelId: settings.paytm.channelId,
  };
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
