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
export type CustomMessageTemplate = MessageCopy & {
  id: string;
  label: string;
  smsTemplateId: string;
  whatsappTemplate: string;
};
export type WhatsAppProvider = "none" | "meta" | "aisensy" | "zoho";
export type SmsProvider = "none" | "msg91";
export type AggregatorId = "shiprocket" | "nimbuspost" | "ithink" | "shipyaari" | "goswift";
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
    /** Minutes a payment link stays valid (Razorpay needs at least 15). */
    linkExpiryMinutes: number;
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
  customTemplates: CustomMessageTemplate[];
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
  firebase: {
    serviceAccountSecret: string;
    androidConfig: string;
    iosConfig: string;
  };
  shipping: {
    shiprocket: { email: string; password: string; channelId: string; enabled: boolean };
    nimbuspost: { email: string; password: string; enabled: boolean };
    ithink: { accessToken: string; secretKey: string; pickupAddressId: string; host: string; enabled: boolean };
    shipyaari: { email: string; password: string; apiKey: string; enabled: boolean };
    /** GoSwift: client ID + API username/password. No rate API, so the desk sets the checkout charge and days. */
    goswift: { clientId: string; username: string; password: string; pickupAlias: string; rate: string; etaDays: string; service: string; enabled: boolean };
    tookan: { apiKey: string; teamId: string; hyperlocal: boolean; parcel: boolean };
    shipday: { apiKey: string; enabled: boolean };
    /** Fallback tracking service for couriers without an API account (their own site is read first). */
    tracker: { service: "aftership" | "trackingmore" | "17track"; apiKey: string; enabled: boolean };
    scooterImage: string;
    hyperlocalPingSeconds: number;
    minWalletRupees: number;
    connection: Partial<Record<ShippingProviderId, ShippingConnection>>;
    pickup: PickupAddress;
    /** Extra dispatch points added from Quick shipment; also registered with Shiprocket when it is connected. */
    pickupAddresses?: PickupAddress[];
    defaultWeightKg: number;
    packageCm: { length: number; breadth: number; height: number };
    autoBookOnPack: boolean;
    autoSchedulePickup: boolean;
    rateChoice: "customer" | "cheapest" | "fastest";
    /** "aggregator" opens the courier's own label PDF (paper size set in its panel) when it has one. */
    labelSource: "aggregator" | "foundation";
    /** Default paper for the Foundation label; "printer" lets the print dialog choose. */
    labelSize: "printer" | "4x6" | "a4" | "a5" | "roll";
  };
}

export interface ScanRules {
  pick: { orderCode: boolean; productCode: boolean; sku: boolean };
  pack: { boxCode: boolean; orderCode: boolean; sku: boolean; isbn: boolean; photos: boolean; confirm: boolean };
}

export interface OrderSettings {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  codEnabled: boolean;
  /** Store-pickup orders may be paid in cash at the counter. */
  cashAtStoreEnabled: boolean;
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
  /** Courier names (or parts of names) never offered to customers, e.g. "Ekart". */
  hiddenCouriers: string[];
  /** Hides every delivery date on the site: product cards, product page, bag, checkout and tracking. */
  hideDeliveryDates: boolean;
  /** Pre-order tracking shows expected packing / delivery dates and On time labels (off: hidden until a courier is booked). */
  showPreorderStepDates: boolean;
  /** Store pickup shows a ready date (off: the desk tells the customer when it is ready). */
  pickupDates: { inStock: boolean; preorder: boolean };
  /** Buffer added to aggregator rates shown on the site, in case a courier does not pick up and a costlier one is used. */
  courierMarkup: { percent: number; rupees: number; minimum: number };
  /** Hours the desk needs to pack an order before the courier can collect it. */
  processingHours: number;
  /** Orders packed after this India time (HH:MM) are dispatched the next day. */
  dispatchCutoff: string;
  /** Days the store processes, packs and hands over orders. Holidays are YYYY-MM-DD. */
  workingDays: { saturday: boolean; sunday: boolean; holidays: string[] };
  /** Minutes a picker / packer has after being assigned. */
  pickSchedule: { pickMinutes: number; packMinutes: number };
  /** Which picker / packer scans are required (true) or optional (false). */
  scanRules: ScanRules;
  /** Show the coupon / gift card box to customers (off by default). */
  promoCodes: { coupons: boolean; giftCards: boolean };
  /** Customer-facing names for statuses and tracking steps, keyed by the built-in name. */
  statusLabels: Record<string, string>;
  /** Extra tracking updates the desk can add to an order; each shows inside one tracking step. */
  customStatuses: { id: string; label: string; stage: string }[];
  /** Pre-orders: pay in full, or an advance at order time and the balance later. */
  preorderPayment: {
    mode: "full" | "advance";
    advanceType: "percent" | "amount";
    advanceValue: number;
    balanceWhen: "on_ready" | "before_dispatch";
  };
  returns: {
    enabled: boolean;
    windowDays: number;
    pickupCharge: number;
    replacementAllowed: boolean;
    /** Store-pickup orders may be returned / replaced only when these are on. */
    pickupReturns: boolean;
    pickupReplacement: boolean;
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
    linkExpiryMinutes: 30,
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
  firebase: {
    serviceAccountSecret: "",
    androidConfig: "",
    iosConfig: "",
  },
  messages: {},
  customTemplates: [],
  shipping: {
    shiprocket: { email: "", password: "", channelId: "", enabled: true },
    nimbuspost: { email: "", password: "", enabled: true },
    ithink: { accessToken: "", secretKey: "", pickupAddressId: "", host: "https://my.ithinklogistics.com/api_v3/", enabled: false },
    shipyaari: { email: "", password: "", apiKey: "", enabled: false },
    goswift: { clientId: "", username: "", password: "", pickupAlias: "", rate: "", etaDays: "", service: "SURFACE", enabled: false },
    tookan: { apiKey: "", teamId: "", hyperlocal: true, parcel: true },
    shipday: { apiKey: "", enabled: true },
    tracker: { service: "aftership", apiKey: "", enabled: true },
    scooterImage: "",
    hyperlocalPingSeconds: 8,
    minWalletRupees: 50,
    connection: {},
    pickup: {
      nickname: "VGMF-PUNE",
      contactName: "Vaidya Gogate Memorial Foundation Dispatch",
      phone: "9000000001",
      email: "dispatch@vaidyagogate.org",
      line1: "Vaidya Gogate Memorial Foundation, 102, Ramprasad Chamber, 368/1",
      line2: "Jawaharlal Nehru Road, Nana Peth",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411002",
      country: "India",
    },
    defaultWeightKg: 0.5,
    packageCm: { length: 25, breadth: 20, height: 5 },
    autoBookOnPack: true,
    autoSchedulePickup: true,
    rateChoice: "customer",
    labelSource: "aggregator",
    labelSize: "4x6",
  },
};

export const defaultOrderSettings: OrderSettings = {
  deliveryEnabled: true,
  pickupEnabled: true,
  codEnabled: false,
  cashAtStoreEnabled: true,
  codFee: 30,
  confirmMode: "auto",
  shippingFeeMode: "free_above",
  flatFee: 49,
  perItemFee: 25,
  freeAbove: 499,
  showCourierChoice: true,
  hideTookanAtCheckout: false,
  hideShipdayAtCheckout: false,
  hiddenCouriers: [],
  hideDeliveryDates: false,
  showPreorderStepDates: false,
  pickupDates: { inStock: false, preorder: false },
  courierMarkup: { percent: 0, rupees: 0, minimum: 0 },
  processingHours: 4,
  dispatchCutoff: "17:00",
  workingDays: { saturday: false, sunday: false, holidays: [] },
  pickSchedule: { pickMinutes: 30, packMinutes: 30 },
  scanRules: {
    pick: { orderCode: true, productCode: true, sku: true },
    pack: { boxCode: true, orderCode: true, sku: true, isbn: true, photos: true, confirm: true },
  },
  promoCodes: { coupons: false, giftCards: false },
  statusLabels: {},
  customStatuses: [],
  preorderPayment: { mode: "advance", advanceType: "percent", advanceValue: 50, balanceWhen: "before_dispatch" },
  returns: {
    enabled: false,
    windowDays: 7,
    pickupCharge: 0,
    replacementAllowed: true,
    pickupReturns: false,
    pickupReplacement: false,
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
  if (id === "shiprocket" || id === "nimbuspost" || id === "ithink" || id === "shipyaari" || id === "goswift" || id === "tookan" || id === "shipday") return id;
  return null;
}

function credentialFingerprint(shipping: IntegrationSettings["shipping"], provider: ShippingProviderId) {
  if (provider === "shiprocket") return `${shipping.shiprocket.email}\0${shipping.shiprocket.password}\0${shipping.shiprocket.channelId}`;
  if (provider === "nimbuspost") return `${shipping.nimbuspost.email}\0${shipping.nimbuspost.password}`;
  if (provider === "ithink") return `${shipping.ithink.accessToken}\0${shipping.ithink.secretKey}\0${shipping.ithink.host}`;
  if (provider === "shipyaari") return `${shipping.shipyaari.email}\0${shipping.shipyaari.password}\0${shipping.shipyaari.apiKey}`;
  if (provider === "goswift") return `${shipping.goswift.clientId}\0${shipping.goswift.username}\0${shipping.goswift.password}`;
  if (provider === "tookan") return `${shipping.tookan.apiKey}\0${shipping.tookan.teamId}`;
  return shipping.shipday.apiKey;
}

export function hasShippingCredentials(provider: ShippingProviderId, settings = getIntegrations()) {
  const shipping = settings.shipping;
  if (provider === "shiprocket") return Boolean(shipping.shiprocket.email && shipping.shiprocket.password);
  if (provider === "nimbuspost") return Boolean(shipping.nimbuspost.email && shipping.nimbuspost.password);
  if (provider === "ithink") return Boolean(shipping.ithink.accessToken && shipping.ithink.secretKey);
  if (provider === "shipyaari") return Boolean(shipping.shipyaari.apiKey || (shipping.shipyaari.email && shipping.shipyaari.password));
  if (provider === "goswift") return Boolean(shipping.goswift.clientId && shipping.goswift.username && shipping.goswift.password);
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
  // Old saves had only `enabled`. Both modes switched off by the admin now stay off.
  if (tookan.enabled === true && tookan.hyperlocal === undefined && tookan.parcel === undefined) {
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
      customTemplates: settings.customTemplates,
    }),
  }).catch(() => undefined);
}

export function saveIntegrations(settings: IntegrationSettings) {
  const previous = getIntegrations();
  const next = merge(defaultIntegrations, settings);
  const providers: ShippingProviderId[] = ["shiprocket", "nimbuspost", "ithink", "shipyaari", "goswift", "tookan", "shipday"];
  const connection = { ...next.shipping.connection, ...previous.shipping.connection };
  for (const provider of providers) {
    if (credentialFingerprint(previous.shipping, provider) !== credentialFingerprint(next.shipping, provider)) {
      connection[provider] = { status: "untested", message: "", at: "" };
    }
  }
  next.shipping.connection = connection;
  writeJSON(INTEGRATIONS_KEY, next);
  persistMailStatus(next);
  pushAdminIntegrations(next);
}

const INTEGRATIONS_AT = "vgmf_integrations_at";

function pushAdminIntegrations(settings: IntegrationSettings, at = new Date().toISOString()) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INTEGRATIONS_AT, at);
  void fetch("/api/admin/integrations", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ settings, at }),
  }).catch(() => undefined);
}

function withoutBlanks(value: unknown): unknown {
  if (Array.isArray(value) || !value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string" && !entry.trim()) continue;
    out[key] = withoutBlanks(entry);
  }
  return out;
}

/** Secret paths saved on the server (they stay off other devices). */
export function serverSavedSecrets(): string[] {
  return readJSON<string[]>("vgmf_integrations_saved", []);
}

/**
 * Admin settings live on the server, so a phone or new browser opens with the same configuration
 * and never sends its empty defaults over it. Secret values stay on the server and are filled in there.
 */
export async function syncAdminIntegrations() {
  if (typeof window === "undefined") return;
  const response = await fetch("/api/admin/integrations", { cache: "no-store", credentials: "same-origin" }).catch(() => undefined);
  if (!response?.ok) return;
  const data = (await response.json().catch(() => null)) as { settings?: Partial<IntegrationSettings>; saved?: string[]; updatedAt?: string } | null;
  if (!data) return;
  writeJSON("vgmf_integrations_saved", data.saved ?? []);
  const hasLocal = Boolean(window.localStorage.getItem(INTEGRATIONS_KEY));
  const localAt = window.localStorage.getItem(INTEGRATIONS_AT) || "";
  const serverAt = data.updatedAt || "";
  const serverHas = Boolean(data.settings && Object.keys(data.settings).length);
  if (serverHas && (!hasLocal || serverAt > localAt)) {
    const local = getIntegrations();
    const next = merge(local, withoutBlanks(data.settings) as Partial<IntegrationSettings>);
    next.shipping.connection = local.shipping.connection;
    writeJSON(INTEGRATIONS_KEY, next);
    window.localStorage.setItem(INTEGRATIONS_AT, serverAt);
    window.dispatchEvent(new Event("vgmf-cms"));
    return;
  }
  if (hasLocal && (!serverHas || localAt > serverAt)) pushAdminIntegrations(getIntegrations(), localAt || new Date().toISOString());
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
    cashAtStoreEnabled: merged.cashAtStoreEnabled !== false,
    codFee: Math.max(0, finiteNumber(merged.codFee, defaultOrderSettings.codFee)),
    confirmMode: merged.confirmMode === "manual" ? "manual" : "auto",
    shippingFeeMode: mode,
    flatFee: Math.max(0, finiteNumber(merged.flatFee, defaultOrderSettings.flatFee)),
    perItemFee: Math.max(0, finiteNumber(merged.perItemFee, defaultOrderSettings.perItemFee)),
    freeAbove: Math.max(0, finiteNumber(merged.freeAbove, defaultOrderSettings.freeAbove)),
    showCourierChoice: Boolean(merged.showCourierChoice),
    hideTookanAtCheckout: Boolean(merged.hideTookanAtCheckout),
    hideShipdayAtCheckout: Boolean(merged.hideShipdayAtCheckout),
    hideDeliveryDates: Boolean(merged.hideDeliveryDates),
    showPreorderStepDates: Boolean(merged.showPreorderStepDates),
    pickupDates: { inStock: Boolean(merged.pickupDates?.inStock), preorder: Boolean(merged.pickupDates?.preorder) },
    hiddenCouriers: Array.isArray(merged.hiddenCouriers) ? merged.hiddenCouriers.map((name) => String(name).trim()).filter(Boolean).slice(0, 50) : [],
    courierMarkup: {
      percent: Math.max(0, Number(merged.courierMarkup?.percent) || 0),
      rupees: Math.max(0, Number(merged.courierMarkup?.rupees) || 0),
      minimum: Math.max(0, Number(merged.courierMarkup?.minimum) || 0),
    },
    processingHours: Math.max(0, finiteNumber(merged.processingHours, defaultOrderSettings.processingHours)),
    dispatchCutoff: /^\d{1,2}:\d{2}$/.test(String(merged.dispatchCutoff ?? "")) ? String(merged.dispatchCutoff) : defaultOrderSettings.dispatchCutoff,
    scanRules: {
      pick: {
        orderCode: merged.scanRules?.pick?.orderCode !== false,
        productCode: merged.scanRules?.pick?.productCode !== false,
        sku: merged.scanRules?.pick?.sku !== false,
      },
      pack: {
        boxCode: merged.scanRules?.pack?.boxCode !== false,
        orderCode: merged.scanRules?.pack?.orderCode !== false,
        sku: merged.scanRules?.pack?.sku !== false,
        isbn: merged.scanRules?.pack?.isbn !== false,
        photos: merged.scanRules?.pack?.photos !== false,
        confirm: merged.scanRules?.pack?.confirm !== false,
      },
    },
    promoCodes: { coupons: merged.promoCodes?.coupons === true, giftCards: merged.promoCodes?.giftCards === true },
    pickSchedule: {
      pickMinutes: Math.max(1, finiteNumber(merged.pickSchedule?.pickMinutes, 30)),
      packMinutes: Math.max(1, finiteNumber(merged.pickSchedule?.packMinutes, 30)),
    },
    workingDays: {
      saturday: Boolean(merged.workingDays?.saturday),
      sunday: Boolean(merged.workingDays?.sunday),
      holidays: Array.isArray(merged.workingDays?.holidays)
        ? [...new Set(merged.workingDays.holidays.map((day) => String(day ?? "").trim()).filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)))].sort()
        : [],
    },
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
    preorderPayment: {
      // Pre-orders are always part-paid (1–99%, default 50%); the rest plus the courier charge is paid later by link.
      mode: "advance",
      advanceType: "percent",
      advanceValue: Math.min(99, Math.max(1, Math.round(finiteNumber(merged.preorderPayment?.advanceValue, defaultOrderSettings.preorderPayment.advanceValue)))),
      balanceWhen: merged.preorderPayment?.balanceWhen === "on_ready" ? "on_ready" : "before_dispatch",
    },
    returns: {
      enabled: false,
      windowDays: Math.max(0, finiteNumber(merged.returns?.windowDays, defaultOrderSettings.returns.windowDays)),
      pickupCharge: Math.max(0, finiteNumber(merged.returns?.pickupCharge, defaultOrderSettings.returns.pickupCharge)),
      replacementAllowed: true,
      pickupReturns: Boolean(merged.returns?.pickupReturns),
      pickupReplacement: Boolean(merged.returns?.pickupReplacement),
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

/** Pre-order dates show only when delivery dates are on and "show pre-order dates" is switched on. */
export function preorderDatesHidden(settings: Pick<OrderSettings, "hideDeliveryDates" | "showPreorderStepDates">) {
  return settings.hideDeliveryDates || !settings.showPreorderStepDates;
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

/** True only when the admin's shipping rule makes this order's shipping free. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** True when the store works on this India calendar day (weekend switches and the holiday list in Order settings). */
export function isStoreWorkingDay(at: Date | number, settings = getOrderSettings()) {
  const ist = new Date((typeof at === "number" ? at : at.getTime()) + IST_OFFSET_MS);
  const weekday = ist.getUTCDay();
  if (weekday === 6 && !settings.workingDays.saturday) return false;
  if (weekday === 0 && !settings.workingDays.sunday) return false;
  return !settings.workingDays.holidays.includes(ist.toISOString().slice(0, 10));
}

/** The same moment moved forward, a day at a time, to the next working day (unchanged if already one). */
export function nextStoreWorkingDay(at: number, settings = getOrderSettings()) {
  let value = at;
  for (let guard = 0; guard < 60 && !isStoreWorkingDay(value, settings); guard += 1) value += 24 * 60 * 60 * 1000;
  return value;
}

export function shippingIsFree(subtotal: number, settings = getOrderSettings()) {
  return settings.shippingFeeMode === "free" || (settings.shippingFeeMode === "free_above" && subtotal >= settings.freeAbove);
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
  if (order.deliveryMode === "store_pickup" && !settings.returns.pickupReplacement) return false;
  const deliveredAt = order.history?.slice().reverse().find((entry) => entry.status === "Delivered")?.at ?? order.date;
  return (Date.now() - Date.parse(deliveredAt)) / 864e5 <= (order.returnableDays || settings.returns.windowDays);
}

/** What a pre-order customer pays when ordering: the full total, or the advance set in Order settings. */
/** Pre-orders always take a part now (the admin's %, never the full amount); the balance and courier charge follow by payment link. */
export function preorderAdvance(total: number, settings = getOrderSettings()) {
  if (total <= 0) return total;
  const raw = Number(settings.preorderPayment?.advanceValue);
  const percent = Number.isFinite(raw) ? Math.min(99, Math.max(1, raw)) : 50;
  return Math.min(total, Math.max(1, Math.round((total * percent) / 100)));
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
