import type { Order } from "@/types";
import { requiresLiveCommerce } from "@/lib/platform";

const INTEGRATIONS_KEY = "vgmf_integrations";
const ORDER_SETTINGS_KEY = "vgmf_order_settings";

export type PaymentMode = "demo" | "test" | "live";
export type HostedGatewayId = "payu" | "easebuzz" | "cashfree" | "phonepe";
export type HostedGatewaySettings = {
  enabled: boolean;
  mode: "test" | "live";
  key: string;
  salt: string;
  merchantId: string;
  saltIndex: string;
};
export type EmailProvider = "cpaas" | "zeptomail" | "zoho";
export type MessageCopy = {
  emailSubject: string;
  emailBody: string;
  smsBody: string;
};
export type WhatsAppProvider = "none" | "meta" | "aisensy" | "zoho";
export type SmsProvider = "none" | "msg91";
export type AggregatorId = "shiprocket" | "nimbuspost" | "ithink" | "shipyaari";
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
  { id: "otp", label: "One-time password" },
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
  payu: HostedGatewaySettings;
  easebuzz: HostedGatewaySettings;
  cashfree: HostedGatewaySettings;
  phonepe: HostedGatewaySettings;
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
  messages: Partial<Record<NotificationEventId, MessageCopy>>;
  whatsapp: {
    provider: WhatsAppProvider;
    metaAppId: string;
    metaWabaId: string;
    metaPhoneNumberId: string;
    /** Customers message this WhatsApp number. Inbox replies go out on it through Meta. */
    metaDisplayNumber: string;
    metaAccessToken: string;
    metaApiVersion: string;
    /** Same value pasted into Meta → WhatsApp → Configuration → Verify token. */
    metaVerifyToken: string;
    /** Optional. When set, webhook posts must carry X-Hub-Signature-256. */
    metaAppSecret: string;
    /** Approved template with one variable, used after the 24-hour reply window. */
    metaReplyTemplate: string;
    aisensyApiKey: string;
    aisensyProjectId: string;
    /** Customers message this second WhatsApp number. Inbox replies go out on it through AiSensy. */
    aisensyDisplayNumber: string;
    /** Project API app password. Unlocks free-text replies inside 24 hours. */
    aisensyAppPassword: string;
    /** Live API campaign with one variable, used after the 24-hour window. */
    aisensyReplyCampaign: string;
    /** Optional. Appended to the AiSensy webhook URL as ?token= */
    aisensyWebhookToken: string;
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
  sms: {
    provider: SmsProvider;
    msg91AuthKey: string;
    msg91SenderId: string;
    msg91TemplateId: string;
    mapping: Partial<Record<NotificationEventId, string>>;
  };
  shipping: {
    shiprocket: { email: string; password: string; channelId: string; enabled: boolean };
    nimbuspost: { email: string; password: string; enabled: boolean };
    ithink: { accessToken: string; secretKey: string; pickupAddressId: string; host: string; enabled: boolean };
    shipyaari: { email: string; password: string; apiKey: string; enabled: boolean };
    tookan: { apiKey: string; teamId: string; hyperlocal: boolean; parcel: boolean };
    shipday: { apiKey: string; enabled: boolean };
    /** Fallback tracking service for couriers without an API account (their own site is read first). */
    tracker: { service: "aftership" | "trackingmore" | "17track"; apiKey: string; enabled: boolean };
    scooterImage: string;
    hyperlocalPingSeconds: number;
    minWalletRupees: number;
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
  /** "auto" confirms an order at once when every item is in stock; "manual" waits for the desk. */
  confirmMode: "auto" | "manual";
  shippingFeeMode: "free" | "flat" | "per_item" | "free_above" | "courier_rate";
  flatFee: number;
  perItemFee: number;
  freeAbove: number;
  showCourierChoice: boolean;
  /** Keep our own Tookan / Shipday fleet off the checkout courier list. */
  hideTookanAtCheckout: boolean;
  hideShipdayAtCheckout: boolean;
  /** Customer-facing names for statuses and tracking steps, keyed by the built-in name. */
  statusLabels: Record<string, string>;
  /** Extra tracking updates the desk can add to an order; each shows inside one tracking step. */
  customStatuses: { id: string; label: string; stage: string }[];
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
  platformFee: {
    enabled: boolean;
    amount: number;
    /** Off keeps the platform fee when an order is refunded. On lets the desk refund it too. */
    refundable: boolean;
  };
  gst: {
    enabled: boolean;
    ratePercent: number;
    invoiceEnabled: boolean;
    legalName: string;
    gstin: string;
    stateName: string;
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
  payu: { enabled: false, mode: "test", key: "", salt: "", merchantId: "", saltIndex: "1" },
  easebuzz: { enabled: false, mode: "test", key: "", salt: "", merchantId: "", saltIndex: "1" },
  cashfree: { enabled: false, mode: "test", key: "", salt: "", merchantId: "", saltIndex: "1" },
  phonepe: { enabled: false, mode: "test", key: "", salt: "", merchantId: "", saltIndex: "1" },
  paytm: {
    mode: "demo",
    mid: "",
    merchantKey: "",
    tid: "",
    channelId: "",
  },
  email: {
    provider: "cpaas",
    fromAddress: "noreply@vaidyagogate.org",
    fromName: "Vaidya Gogate Memorial Foundation",
    zeptoToken: "",
    zeptoHost: "cpaas.zoho.in",
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
    metaDisplayNumber: "",
    metaAccessToken: "",
    metaApiVersion: "v21.0",
    metaVerifyToken: "",
    metaAppSecret: "",
    metaReplyTemplate: "",
    aisensyApiKey: "",
    aisensyProjectId: "",
    aisensyDisplayNumber: "",
    aisensyAppPassword: "",
    aisensyReplyCampaign: "",
    aisensyWebhookToken: "",
    zohoCpaasApiKey: "",
    zohoCpaasFrom: "",
    zohoCpaasDomain: "zoho.in",
    templates: [],
    templatesSyncedAt: "",
    mapping: {},
  },
  sms: {
    provider: "none",
    msg91AuthKey: "",
    msg91SenderId: "VGMFIN",
    msg91TemplateId: "",
    mapping: {},
  },
  messages: {},
  shipping: {
    shiprocket: { email: "", password: "", channelId: "", enabled: true },
    nimbuspost: { email: "", password: "", enabled: true },
    ithink: { accessToken: "", secretKey: "", pickupAddressId: "", host: "https://my.ithinklogistics.com/api_v3/", enabled: false },
    shipyaari: { email: "", password: "", apiKey: "", enabled: false },
    tookan: { apiKey: "", teamId: "", hyperlocal: true, parcel: true },
    shipday: { apiKey: "", enabled: true },
    tracker: { service: "aftership", apiKey: "", enabled: true },
    scooterImage: "",
    hyperlocalPingSeconds: 8,
    minWalletRupees: 50,
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
  confirmMode: "auto",
  shippingFeeMode: "free_above",
  flatFee: 49,
  perItemFee: 25,
  freeAbove: 499,
  showCourierChoice: true,
  hideTookanAtCheckout: false,
  hideShipdayAtCheckout: false,
  statusLabels: {},
  customStatuses: [],
  returns: {
    enabled: false,
    windowDays: 7,
    pickupCharge: 0,
    replacementAllowed: true,
    reasons: ["Damaged or defective item"],
  },
  refunds: { enabled: true, method: "original", processingDays: 7, autoRefundOnReturnPickup: false },
  cancellation: { enabled: false, allowedUntil: "Packed", windowHours: 0, fee: 0 },
  adminActions: { processAfterDelivery: true },
  platformFee: { enabled: false, amount: 0, refundable: false },
  gst: { enabled: false, ratePercent: 0, invoiceEnabled: false, legalName: "", gstin: "", stateName: "Maharashtra" },
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
  if (id === "shiprocket" || id === "nimbuspost" || id === "ithink" || id === "shipyaari" || id === "tookan" || id === "shipday") return id;
  return null;
}

function credentialFingerprint(shipping: IntegrationSettings["shipping"], provider: ShippingProviderId) {
  if (provider === "shiprocket") return `${shipping.shiprocket.email}\0${shipping.shiprocket.password}\0${shipping.shiprocket.channelId}`;
  if (provider === "nimbuspost") return `${shipping.nimbuspost.email}\0${shipping.nimbuspost.password}`;
  if (provider === "ithink") return `${shipping.ithink.accessToken}\0${shipping.ithink.secretKey}\0${shipping.ithink.host}`;
  if (provider === "shipyaari") return `${shipping.shipyaari.email}\0${shipping.shipyaari.password}\0${shipping.shipyaari.apiKey}`;
  if (provider === "tookan") return `${shipping.tookan.apiKey}\0${shipping.tookan.teamId}`;
  return shipping.shipday.apiKey;
}

export function hasShippingCredentials(provider: ShippingProviderId, settings = getIntegrations()) {
  const shipping = settings.shipping;
  if (provider === "shiprocket") return Boolean(shipping.shiprocket.email && shipping.shiprocket.password);
  if (provider === "nimbuspost") return Boolean(shipping.nimbuspost.email && shipping.nimbuspost.password);
  if (provider === "ithink") return Boolean(shipping.ithink.accessToken && shipping.ithink.secretKey);
  if (provider === "shipyaari") return Boolean(shipping.shipyaari.apiKey || (shipping.shipyaari.email && shipping.shipyaari.password));
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

function persistMailStatus(settings: IntegrationSettings) {
  if (typeof window === "undefined") return;
  const email = settings.email;
  const ready = Boolean(
    email.zeptoToken.trim() ||
      settings.whatsapp.zohoCpaasApiKey.trim() ||
      (email.provider === "zoho" && email.zohoRefreshToken.trim())
  );
  window.localStorage.setItem("vgmf_mail_ready", ready ? "true" : "false");
  window.dispatchEvent(new Event("vgmf-cms"));
  void fetch("/api/auth/mail-status", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...email,
      zohoCpaasApiKey: settings.whatsapp.zohoCpaasApiKey,
      zohoCpaasDomain: settings.whatsapp.zohoCpaasDomain,
    }),
  }).catch(() => undefined);
  void fetch("/api/notify", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "save-creds",
      email: { ...email, zohoCpaasApiKey: settings.whatsapp.zohoCpaasApiKey, zohoCpaasDomain: settings.whatsapp.zohoCpaasDomain },
      whatsapp: settings.whatsapp,
      sms: settings.sms,
      messages: settings.messages,
    }),
  }).catch(() => undefined);
}

export function saveIntegrations(settings: IntegrationSettings) {
  const previous = getIntegrations();
  const next = merge(defaultIntegrations, settings);
  const providers: ShippingProviderId[] = ["shiprocket", "nimbuspost", "ithink", "shipyaari", "tookan", "shipday"];
  const connection = { ...next.shipping.connection, ...previous.shipping.connection };
  for (const provider of providers) {
    if (credentialFingerprint(previous.shipping, provider) !== credentialFingerprint(next.shipping, provider)) {
      connection[provider] = { status: "untested", message: "", at: "" };
    }
  }
  next.shipping.connection = connection;
  writeJSON(INTEGRATIONS_KEY, next);
  persistMailStatus(next);
}

function finiteNumber(value: unknown, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

const SHIPPING_FEE_MODES = new Set<OrderSettings["shippingFeeMode"]>(["free", "flat", "per_item", "free_above", "courier_rate"]);

/** Checkout rules that are safe to publish. No payment or courier secrets. */
export function publicOrderSettings(input?: Partial<OrderSettings> | null): OrderSettings {
  const merged = merge(defaultOrderSettings, input ?? null);
  const mode = SHIPPING_FEE_MODES.has(merged.shippingFeeMode) ? merged.shippingFeeMode : defaultOrderSettings.shippingFeeMode;
  const until = merged.cancellation?.allowedUntil;
  return {
    deliveryEnabled: Boolean(merged.deliveryEnabled),
    pickupEnabled: Boolean(merged.pickupEnabled),
    codEnabled: Boolean(merged.codEnabled),
    codFee: Math.max(0, finiteNumber(merged.codFee, defaultOrderSettings.codFee)),
    confirmMode: merged.confirmMode === "manual" ? "manual" : "auto",
    shippingFeeMode: mode,
    flatFee: Math.max(0, finiteNumber(merged.flatFee, defaultOrderSettings.flatFee)),
    perItemFee: Math.max(0, finiteNumber(merged.perItemFee, defaultOrderSettings.perItemFee)),
    freeAbove: Math.max(0, finiteNumber(merged.freeAbove, defaultOrderSettings.freeAbove)),
    showCourierChoice: Boolean(merged.showCourierChoice),
    hideTookanAtCheckout: Boolean(merged.hideTookanAtCheckout),
    hideShipdayAtCheckout: Boolean(merged.hideShipdayAtCheckout),
    statusLabels: Object.fromEntries(
      Object.entries(merged.statusLabels && typeof merged.statusLabels === "object" ? merged.statusLabels : {})
        .map(([key, text]) => [key, String(text ?? "").trim()])
        .filter(([, text]) => text)
    ),
    customStatuses: Array.isArray(merged.customStatuses)
      ? merged.customStatuses
          .filter((row) => row && typeof row === "object")
          .map((row, index) => ({ id: String(row.id || index + 1), label: String(row.label ?? ""), stage: String(row.stage || "shipped") }))
      : [],
    returns: {
      enabled: false,
      windowDays: Math.max(0, finiteNumber(merged.returns?.windowDays, defaultOrderSettings.returns.windowDays)),
      pickupCharge: Math.max(0, finiteNumber(merged.returns?.pickupCharge, defaultOrderSettings.returns.pickupCharge)),
      replacementAllowed: true,
      reasons: Array.isArray(merged.returns?.reasons)
        ? merged.returns.reasons.map((item) => String(item ?? "").trim()).filter(Boolean)
        : defaultOrderSettings.returns.reasons,
    },
    refunds: {
      enabled: Boolean(merged.refunds?.enabled),
      method: merged.refunds?.method === "manual" ? "manual" : "original",
      processingDays: Math.max(1, finiteNumber(merged.refunds?.processingDays, defaultOrderSettings.refunds.processingDays)),
      autoRefundOnReturnPickup: Boolean(merged.refunds?.autoRefundOnReturnPickup),
    },
    cancellation: {
      enabled: false,
      allowedUntil: until === "Ordered" || until === "Shipped" || until === "Packed" ? until : "Packed",
      windowHours: Math.max(0, finiteNumber(merged.cancellation?.windowHours, 0)),
      fee: Math.max(0, finiteNumber(merged.cancellation?.fee, 0)),
    },
    adminActions: {
      processAfterDelivery: merged.adminActions?.processAfterDelivery !== false,
    },
    platformFee: {
      enabled: Boolean(merged.platformFee?.enabled),
      amount: Math.max(0, finiteNumber(merged.platformFee?.amount, 0)),
      refundable: Boolean(merged.platformFee?.refundable),
    },
    gst: {
      enabled: Boolean(merged.gst?.enabled),
      ratePercent: Math.max(0, finiteNumber(merged.gst?.ratePercent, 0)),
      invoiceEnabled: Boolean(merged.gst?.invoiceEnabled),
      legalName: String(merged.gst?.legalName ?? "").trim(),
      gstin: String(merged.gst?.gstin ?? "").trim().toUpperCase(),
      stateName: String(merged.gst?.stateName ?? "Maharashtra").trim() || "Maharashtra",
    },
  };
}

export function commerceCharges(subtotal: number, settings = getOrderSettings()) {
  const base = Math.max(0, subtotal);
  const gst = settings.gst.enabled ? Math.round(base * (settings.gst.ratePercent / 100)) : 0;
  const platformFee = settings.platformFee.enabled ? Math.round(settings.platformFee.amount) : 0;
  return { gst, platformFee };
}

export function getOrderSettings(): OrderSettings {
  return publicOrderSettings(readJSON<Partial<OrderSettings> | null>(ORDER_SETTINGS_KEY, null));
}

/** The admin's name for a status or tracking step (case-insensitive), or the built-in name. */
export function orderStatusText(status: string, labels = getOrderSettings().statusLabels) {
  const key = Object.keys(labels ?? {}).find((name) => name.toLowerCase() === String(status).toLowerCase());
  return (key && labels[key]) || status;
}

export function saveOrderSettings(settings: OrderSettings) {
  writeJSON(ORDER_SETTINGS_KEY, settings);
}

export function razorpayKeys(settings = getIntegrations()) {
  const stored = settings.razorpay.mode;
  const liveReady = Boolean(settings.razorpay.liveKeyId && settings.razorpay.liveKeySecret);
  const testReady = Boolean(settings.razorpay.testKeyId && settings.razorpay.testKeySecret);
  const mode = stored === "demo" && requiresLiveCommerce() ? (liveReady ? "live" : testReady ? "test" : stored) : stored;
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

export function canCustomerCancel(_order?: Order, _settings = getOrderSettings(), _now = Date.now()) {
  return false;
}

export function canCustomerReturn(_order?: Order, _settings = getOrderSettings()) {
  return false;
}

export function canCustomerRequestReplacement(order: Order, settings = getOrderSettings()) {
  if (!settings.returns.replacementAllowed || order.status !== "Delivered" || order.returnRequest) return false;
  const deliveredAt = order.history?.slice().reverse().find((entry) => entry.status === "Delivered")?.at ?? order.date;
  return (Date.now() - Date.parse(deliveredAt)) / 864e5 <= (order.returnableDays || settings.returns.windowDays);
}

export function customerOrderPolicyCopy() {
  return {
    title: "Replacements",
    body: "Orders cannot be cancelled or returned from your account. If an item arrives damaged, share photos and request a replacement. The Foundation desk accepts or rejects the request, and an accepted request is fulfilled with a new free order.",
  };
}

export function mask(value: string) {
  if (!value) return "";
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 4)}${"•".repeat(Math.min(12, value.length - 8))}${value.slice(-4)}`;
}
