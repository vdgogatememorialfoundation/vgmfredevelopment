import { normalizePickup } from "@/lib/pickup-address";
import type { Order, ReturnEvidenceKind } from "@/types";
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
export type WhatsAppSender = Exclude<WhatsAppProvider, "none">;
export const WHATSAPP_SENDERS: WhatsAppSender[] = ["meta", "aisensy", "zoho"];

type WhatsAppAlertSettings = Pick<IntegrationSettings["whatsapp"], "provider" | "providers" | "mapping" | "mappingByProvider">;

/** Providers that send alerts, in order. */
export function whatsAppSenders(whatsapp: WhatsAppAlertSettings): WhatsAppSender[] {
  const list = (whatsapp.providers ?? []).filter((item): item is WhatsAppSender => WHATSAPP_SENDERS.includes(item));
  if (list.length) return [...new Set(list)];
  return whatsapp.provider && whatsapp.provider !== "none" ? [whatsapp.provider] : [];
}

/** Template (Meta/Zoho) or campaign (AiSensy) mapped to an event for one provider. */
export function whatsAppTemplateFor(whatsapp: WhatsAppAlertSettings, provider: string, event: string) {
  const own = whatsapp.mappingByProvider?.[provider as WhatsAppSender]?.[event as NotificationEventId];
  if (own?.trim()) return own.trim();
  return whatsapp.provider === provider || !whatsapp.mappingByProvider?.[provider as WhatsAppSender] ? (whatsapp.mapping[event as NotificationEventId] ?? "").trim() : "";
}
export type SmsProvider = "none" | "msg91";
export type AggregatorId = "shiprocket" | "nimbuspost" | "ithink" | "shipyaari" | "goswift" | "ekart" | "shadowfax" | "envia" | "daakly" | "rapidshyp" | "vamaship" | "shipway";
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
  { id: "refund", label: "Refund initiated" },
  { id: "refund-processed", label: "Refund processed (refunded)" },
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
  { id: "order-packed", label: "Order packed" },
  { id: "order-shipped", label: "Order shipped" },
  { id: "order-out-for-delivery", label: "Out for delivery" },
  { id: "order-delivered", label: "Order delivered" },
  { id: "order-cancelled", label: "Order cancelled" },
  { id: "order-delivery-failed", label: "Delivery attempt failed" },
  { id: "order-return-update", label: "Return / replacement update" },
  { id: "refund-bank-reference", label: "Refund bank reference (RRN/ARN)" },
  { id: "preorder-placed", label: "Pre-order placed (advance paid)" },
  { id: "preorder-update", label: "Pre-order status changed" },
  { id: "preorder-ready", label: "Pre-order ready (balance link)" },
  { id: "order-call-missed", label: "We tried to reach you (missed call)" },
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
    /** Days a pre-order balance link stays valid. */
    balanceLinkDays?: number;
    /** Automatic email reminders for part-paid orders. */
    balanceReminders?: boolean;
    reminderEveryDays?: number;
    reminderMax?: number;
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
    /** Every provider switched on for alerts, in order. Empty = just `provider`. */
    providers?: WhatsAppSender[];
    /** Self-service menu (order books, my orders, my account, talk to us) answers new chats. Default on. */
    botEnabled?: boolean;
    /** Off: the bot and WhatsApp catalogue carts send customers to the website instead of taking orders. */
    orderingEnabled?: boolean;
    /** failover: first provider, the next one only if it fails. all: send through each. */
    sendMode?: "failover" | "all";
    /** Per-provider template/campaign names; falls back to `mapping`. */
    mappingByProvider?: Partial<Record<WhatsAppSender, Partial<Record<NotificationEventId, string>>>>;
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
    /** pickupLocation: the pickup nickname on the Shiprocket panel; blank uses the default pickup nickname. */
    shiprocket: { email: string; password: string; channelId: string; pickupLocation?: string; enabled: boolean };
    nimbuspost: { email: string; password: string; apiKey?: string; apiSecret?: string; warehouseId?: string; enabled: boolean };
    ithink: { accessToken: string; secretKey: string; pickupAddressId: string; host: string; enabled: boolean };
    shipyaari: { email: string; password: string; apiKey: string; enabled: boolean };
    /** GoSwift: client ID + API username/password. No rate API, so the desk sets the checkout charge and days. */
    goswift: { clientId: string; username: string; password: string; pickupAlias: string; rate: string; etaDays: string; service: string; enabled: boolean };
    /** Ekart Elite: client ID + login. Same API style as GoSwift; pickup address comes from the Ekart panel. */
    ekart: { clientId: string; username: string; password: string; pickupAlias: string; service: string; enabled: boolean };
    /** Shadowfax (developer.shadowfax.in): API token from the Shadowfax panel; staging or live. */
    shadowfax: { apiToken: string; environment: string; pickupPincode: string; rate: string; etaDays: string; service: string; enabled: boolean };
    /** Envia (docs.envia.com): API token; carriers is an optional comma list (blank = all Envia carriers for India). */
    envia: { apiToken: string; environment: string; carriers: string; enabled: boolean };
    /** Daakly (India Post contract rates): API key dk_live_… or dk_test_…; drop-off at a post office, prepaid only. */
    daakly: { apiKey: string; services: string; enabled: boolean };
    /** RapidShyp (docs.rapidshyp.com): API key from Settings → Configure API; pickupName = a pickup location saved on RapidShyp (blank = send ours). */
    rapidshyp: { apiKey: string; pickupName: string; enabled: boolean };
    /** Vamaship (docs.vamaship.com): Bearer API key; environment live or sandbox. */
    vamaship: { apiToken: string; environment: string; enabled: boolean };
    /** Shipway (apidocs.shipway.com): Basic Auth / JSON username + licenseKey; optional default carrierId. */
    shipway: { username: string; licenseKey: string; carrierId: string; enabled: boolean };
    tookan: { apiKey: string; teamId: string; hyperlocal: boolean; parcel: boolean };
    shipday: { apiKey: string; enabled: boolean };
    /** Fallback tracking service for couriers without an API account (their own site is read first). */
    tracker: { service: "aftership" | "trackingmore" | "17track"; apiKey: string; enabled: boolean };
    scooterImage: string;
    /** Google Cloud Map ID (vector) for the tilted 3D live map; blank = Google's demo map ID. */
    mapId: string;
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
    /** What the Foundation shipping label shows; editable in Settings → Shipping. */
    labelDesign?: Partial<LabelDesign>;
  };
}

export interface LabelDesign {
  showAwbQr: boolean;
  showOrderCodes: boolean;
  showRouting: boolean;
  showServiceMode: boolean;
  showDimensions: boolean;
  showInvoiceNo: boolean;
  showValue: boolean;
  showItems: boolean;
  showLogo: boolean;
  showTaxColumns: boolean;
  showGstin: boolean;
  showEwaybill: boolean;
  hsn: string;
  senderAltPhone: string;
  /** Printed before the order number to make the invoice number. */
  invoicePrefix: string;
  jurisdiction: string;
  footerText: string;
}

export const DEFAULT_LABEL_DESIGN: LabelDesign = {
  showAwbQr: true,
  showOrderCodes: true,
  showRouting: true,
  showServiceMode: true,
  showDimensions: true,
  showInvoiceNo: true,
  showValue: false,
  showItems: true,
  showLogo: true,
  showTaxColumns: true,
  showGstin: true,
  showEwaybill: true,
  hsn: "4901",
  senderAltPhone: "",
  invoicePrefix: "",
  jurisdiction: "Subject to Pune jurisdiction",
  footerText: "Handle books with care. Do not bend.",
};

export function labelDesign(shipping: { labelDesign?: Partial<LabelDesign> }): LabelDesign {
  return { ...DEFAULT_LABEL_DESIGN, ...(shipping.labelDesign ?? {}) };
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
  /** Packing charge, folded into the courier/shipping charge (never shown to customers on its own). */
  packingCharge: { enabled: boolean; amount: number; per: "order" | "copy"; tiers?: PackingTier[] };
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
  courierMarkup: { percent: number; rupees: number; minimum: number; chargeHighest: boolean; /** Most a customer is charged for the courier (₹, 0 = no limit). */ maxCharge?: number };
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
  /** Desk wording for courier scans the customer sees: when a scan contains `match` (and the courier name contains `courier`, if set), show `title`; `{city}` is the scan's city. */
  scanTitles?: { courier: string; match: string; title: string }[];
  /** Extra tracking updates the desk can add to an order; each shows inside one tracking step. */
  customStatuses: { id: string; label: string; stage: string }[];
  /** Pre-orders: pay in full, or an advance at order time and the balance later. */
  preorderPayment: {
    mode: "full" | "advance";
    advanceType: "percent" | "amount";
    advanceValue: number;
    balanceWhen: "before_dispatch" | "on_ready";
    disclaimerEnabled?: boolean;
    disclaimerText?: string;
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
    /** Reasons customers pick, with the evidence each needs and whether it qualifies for a free replacement. */
    reasonRules: ReturnReasonRule[];
    /** Customers may choose "Return for refund". Off: replacement only, as in the book terms. */
    returnForRefund: boolean;
    /** Let the customer give a different address for the replacement copy. */
    replacementAddressChange: boolean;
  };
  refunds: {
    enabled: boolean;
    method: "original" | "manual";
    processingDays: number;
    /** Customers are told the refund reaches their account this many days after it is processed. */
    creditDays: number;
    autoRefundOnReturnPickup: boolean;
    /** Store credit lapses this many days after it is added; 0 keeps it forever. */
    creditExpiryDays: number;
  };
  cancellation: {
    enabled: boolean;
    allowedUntil: "Ordered" | "Packed" | "Shipped";
    windowHours: number;
    fee: number;
    /** Days past a pre-order's announced date after which the customer may cancel for a full refund, platform fee included. 0 = off. */
    delayDays: number;
    /** Tick "Also refund the platform fee" by default when the desk cancels an order. */
    refundFeeOnDesk: boolean;
    /** Days a store pickup may wait uncollected before the desk is prompted to cancel and refund. 0 = off. */
    pickupHoldDays: number;
  };
  /** Time slots the desk offers for collecting a store-pickup order, e.g. "6:00 PM – 7:00 PM". */
  pickupSlots: string[];
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
    /** Last line of the printed invoice. {name}, {phone}, {email} and {invoice} are filled in when printing. */
    invoiceFooter: string;
  };
}

export const DEFAULT_INVOICE_FOOTER = "This invoice is issued by {name}. Books are supplied as listed. For a correction, contact {phone} or {email} with invoice {invoice}.";

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
    balanceLinkDays: 2,
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
    ekart: { clientId: "", username: "", password: "", pickupAlias: "", service: "SURFACE", enabled: true },
    shadowfax: { apiToken: "", environment: "live", pickupPincode: "", rate: "", etaDays: "", service: "Regular", enabled: false },
    envia: { apiToken: "", environment: "live", carriers: "", enabled: false },
    daakly: { apiKey: "", services: "", enabled: false },
    rapidshyp: { apiKey: "", pickupName: "", enabled: false },
    vamaship: { apiToken: "", environment: "live", enabled: false },
    shipway: { username: "", licenseKey: "", carrierId: "", enabled: false },
    tookan: { apiKey: "", teamId: "", hyperlocal: true, parcel: true },
    shipday: { apiKey: "", enabled: true },
    tracker: { service: "aftership", apiKey: "", enabled: true },
    scooterImage: "",
    mapId: "",
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
    autoBookOnPack: false,
    autoSchedulePickup: true,
    rateChoice: "customer",
    labelSource: "foundation",
    labelSize: "4x6",
  },
};

export interface ReturnReasonRule {
  label: string;
  require: ReturnEvidenceKind[];
  /** Our fault (wrong, damaged or defective item): a free replacement can be chosen. */
  replacement: boolean;
  /** Hours after delivery to report this reason; 0 uses the return window. */
  windowHours: number;
}

export const RETURN_EVIDENCE: { id: ReturnEvidenceKind; label: string }[] = [
  { id: "product", label: "Product photos" },
  { id: "packaging", label: "Packaging photos" },
  { id: "label", label: "Shipping label photo" },
  { id: "video", label: "Unboxing video" },
];

export const DEFAULT_RETURN_REASONS: ReturnReasonRule[] = [
  { label: "Received wrong book/product", require: ["product"], replacement: true, windowHours: 72 },
  { label: "Received a different language", require: ["product"], replacement: true, windowHours: 72 },
  { label: "Product damaged", require: ["video", "product"], replacement: true, windowHours: 48 },
  { label: "Product defective", require: ["product"], replacement: true, windowHours: 72 },
  { label: "Other eligible issue", require: [], replacement: false, windowHours: 0 },
];

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
  packingCharge: { enabled: false, amount: 0, per: "order" },
  showCourierChoice: true,
  hideTookanAtCheckout: false,
  hideShipdayAtCheckout: false,
  hiddenCouriers: [],
  hideDeliveryDates: false,
  showPreorderStepDates: false,
  pickupDates: { inStock: false, preorder: false },
  courierMarkup: { percent: 0, rupees: 0, minimum: 0, chargeHighest: false, maxCharge: 0 },
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
  preorderPayment: { mode: "advance", advanceType: "percent", advanceValue: 50, balanceWhen: "before_dispatch", disclaimerEnabled: true, disclaimerText: "Pre-Order Notice: Shipping and delivery for pre-order items will begin by the end of December." },
  returns: {
    enabled: false,
    windowDays: 7,
    pickupCharge: 0,
    replacementAllowed: true,
    pickupReturns: false,
    pickupReplacement: false,
    reasons: ["Damaged or defective item"],
    reasonRules: DEFAULT_RETURN_REASONS,
    returnForRefund: true,
    replacementAddressChange: true,
  },
  refunds: { enabled: true, method: "original", processingDays: 7, creditDays: 5, autoRefundOnReturnPickup: false, creditExpiryDays: 0 },
  cancellation: { enabled: false, allowedUntil: "Packed", windowHours: 0, fee: 0, delayDays: 30, refundFeeOnDesk: true, pickupHoldDays: 30 },
  pickupSlots: ["6:00 PM – 7:00 PM", "7:00 PM – 8:00 PM", "8:00 PM – 9:00 PM", "9:00 PM – 10:00 PM"],
  adminActions: { processAfterDelivery: true },
  platformFee: { enabled: false, amount: 0, refundable: false },
  gst: { enabled: false, ratePercent: 0, invoiceEnabled: false, legalName: "", gstin: "", stateName: "Maharashtra", invoiceFooter: DEFAULT_INVOICE_FOOTER },
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
  if (id === "shiprocket" || id === "nimbuspost" || id === "ithink" || id === "shipyaari" || id === "goswift" || id === "ekart" || id === "shadowfax" || id === "envia" || id === "daakly" || id === "rapidshyp" || id === "vamaship" || id === "shipway" || id === "tookan" || id === "shipday") return id;
  return null;
}

function credentialFingerprint(shipping: IntegrationSettings["shipping"], provider: ShippingProviderId) {
  if (provider === "shiprocket") return `${shipping.shiprocket.email}\0${shipping.shiprocket.password}\0${shipping.shiprocket.channelId}`;
  if (provider === "nimbuspost") return `${shipping.nimbuspost.email}\0${shipping.nimbuspost.password}\0${shipping.nimbuspost.apiKey ?? ""}\0${shipping.nimbuspost.apiSecret ?? ""}\0${shipping.nimbuspost.warehouseId ?? ""}`;
  if (provider === "ithink") return `${shipping.ithink.accessToken}\0${shipping.ithink.secretKey}\0${shipping.ithink.host}`;
  if (provider === "shipyaari") return `${shipping.shipyaari.email}\0${shipping.shipyaari.password}\0${shipping.shipyaari.apiKey}`;
  if (provider === "goswift") return `${shipping.goswift.clientId}\0${shipping.goswift.username}\0${shipping.goswift.password}`;
  if (provider === "ekart") return `${shipping.ekart.clientId}\0${shipping.ekart.username}\0${shipping.ekart.password}`;
  if (provider === "shadowfax") return `${shipping.shadowfax?.apiToken ?? ""}\0${shipping.shadowfax?.environment ?? ""}`;
  if (provider === "envia") return `${shipping.envia?.apiToken ?? ""}\0${shipping.envia?.environment ?? ""}`;
  if (provider === "daakly") return shipping.daakly?.apiKey ?? "";
  if (provider === "rapidshyp") return shipping.rapidshyp?.apiKey ?? "";
  if (provider === "vamaship") return `${shipping.vamaship?.apiToken ?? ""}\0${shipping.vamaship?.environment ?? ""}`;
  if (provider === "shipway") return `${shipping.shipway?.username ?? ""}\0${shipping.shipway?.licenseKey ?? ""}`;
  if (provider === "tookan") return `${shipping.tookan.apiKey}\0${shipping.tookan.teamId}`;
  return shipping.shipday.apiKey;
}

export function hasShippingCredentials(provider: ShippingProviderId, settings = getIntegrations()) {
  const shipping = settings.shipping;
  if (provider === "shiprocket") return Boolean(shipping.shiprocket.email && shipping.shiprocket.password);
  if (provider === "nimbuspost") return Boolean((shipping.nimbuspost.apiKey && shipping.nimbuspost.apiSecret) || (shipping.nimbuspost.email && shipping.nimbuspost.password));
  if (provider === "ithink") return Boolean(shipping.ithink.accessToken && shipping.ithink.secretKey);
  if (provider === "shipyaari") return Boolean(shipping.shipyaari.apiKey || (shipping.shipyaari.email && shipping.shipyaari.password));
  if (provider === "goswift") return Boolean(shipping.goswift.clientId && shipping.goswift.username && shipping.goswift.password);
  if (provider === "ekart") return Boolean(shipping.ekart.clientId && shipping.ekart.username && shipping.ekart.password);
  if (provider === "shadowfax") return Boolean(shipping.shadowfax?.apiToken);
  if (provider === "envia") return Boolean(shipping.envia?.apiToken);
  if (provider === "daakly") return Boolean(shipping.daakly?.apiKey);
  if (provider === "rapidshyp") return Boolean(shipping.rapidshyp?.apiKey);
  if (provider === "vamaship") return Boolean(shipping.vamaship?.apiToken);
  if (provider === "shipway") return Boolean(shipping.shipway?.username && shipping.shipway?.licenseKey);
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
  merged.shipping.pickup = normalizePickup(merged.shipping.pickup);
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

function persistMailStatus(settings: IntegrationSettings): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
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
  return fetch("/api/notify", {
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
  })
    .then((response) => response.ok)
    .catch(() => false);
}

/** Resolves true once the server has stored the settings; false means saved on this device only. */
export function saveIntegrations(settings: IntegrationSettings): Promise<boolean> {
  const previous = getIntegrations();
  const next = merge(defaultIntegrations, settings);
  const providers: ShippingProviderId[] = ["shiprocket", "nimbuspost", "ithink", "shipyaari", "goswift", "ekart", "shadowfax", "envia", "daakly", "rapidshyp", "vamaship", "shipway", "tookan", "shipday"];
  const connection = { ...next.shipping.connection, ...previous.shipping.connection };
  for (const provider of providers) {
    if (credentialFingerprint(previous.shipping, provider) !== credentialFingerprint(next.shipping, provider)) {
      connection[provider] = { status: "untested", message: "", at: "" };
    }
  }
  next.shipping.connection = connection;
  writeJSON(INTEGRATIONS_KEY, next);
  return Promise.all([persistMailStatus(next), pushAdminIntegrations(next)]).then(([mail, admin]) => mail && admin);
}

const INTEGRATIONS_AT = "vgmf_integrations_at";

function pushAdminIntegrations(settings: IntegrationSettings, at = new Date().toISOString()): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  window.localStorage.setItem(INTEGRATIONS_AT, at);
  return fetch("/api/admin/integrations", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ settings, at }),
  })
    .then((response) => response.ok)
    .catch(() => false);
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
  if (hasLocal && (!serverHas || localAt > serverAt)) void pushAdminIntegrations(getIntegrations(), localAt || new Date().toISOString());
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
    packingCharge: {
      enabled: Boolean(merged.packingCharge?.enabled),
      amount: Math.max(0, finiteNumber(merged.packingCharge?.amount, 0)),
      per: merged.packingCharge?.per === "copy" ? "copy" : "order",
      tiers: (Array.isArray(merged.packingCharge?.tiers) ? merged.packingCharge.tiers : [])
        .map((tier) => ({ upTo: Math.max(1, Math.floor(finiteNumber(tier?.upTo, 0))), amount: Math.max(0, finiteNumber(tier?.amount, 0)) }))
        .filter((tier) => tier.upTo > 0)
        .sort((a, b) => a.upTo - b.upTo),
    },
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
      chargeHighest: Boolean(merged.courierMarkup?.chargeHighest),
      maxCharge: Math.max(0, Number(merged.courierMarkup?.maxCharge) || 0),
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
    scanTitles: Array.isArray(merged.scanTitles)
      ? merged.scanTitles
          .filter((row) => row && typeof row.match === "string" && typeof row.title === "string")
          .map((row) => ({ courier: String(row.courier ?? ""), match: row.match, title: row.title }))
      : [],
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
      // Pre-orders are always part-paid: a % (1–99) or a fixed ₹ per copy; the rest plus the courier charge is paid later by link.
      mode: "advance",
      advanceType: merged.preorderPayment?.advanceType === "amount" ? "amount" : "percent",
      advanceValue:
        merged.preorderPayment?.advanceType === "amount"
          ? Math.max(1, Math.round(finiteNumber(merged.preorderPayment?.advanceValue, 100)))
          : Math.min(99, Math.max(1, Math.round(finiteNumber(merged.preorderPayment?.advanceValue, defaultOrderSettings.preorderPayment.advanceValue)))),
      balanceWhen: merged.preorderPayment?.balanceWhen === "on_ready" ? "on_ready" : "before_dispatch",
      disclaimerEnabled: merged.preorderPayment?.disclaimerEnabled !== false,
      disclaimerText: String(merged.preorderPayment?.disclaimerText ?? "Pre-Order Notice: Shipping and delivery for pre-order items will begin by the end of December.").trim() || "Pre-Order Notice: Shipping and delivery for pre-order items will begin by the end of December.",
    },
    returns: {
      enabled: Boolean(merged.returns?.enabled),
      windowDays: Math.max(0, finiteNumber(merged.returns?.windowDays, defaultOrderSettings.returns.windowDays)),
      pickupCharge: Math.max(0, finiteNumber(merged.returns?.pickupCharge, defaultOrderSettings.returns.pickupCharge)),
      replacementAllowed: merged.returns?.replacementAllowed !== false,
      pickupReturns: Boolean(merged.returns?.pickupReturns),
      pickupReplacement: Boolean(merged.returns?.pickupReplacement),
      reasons: Array.isArray(merged.returns?.reasons)
        ? merged.returns.reasons.map((item) => String(item ?? "").trim()).filter(Boolean)
        : defaultOrderSettings.returns.reasons,
      reasonRules: Array.isArray(merged.returns?.reasonRules) && merged.returns.reasonRules.length
        ? merged.returns.reasonRules
            .map((rule) => ({
              label: String(rule?.label ?? "").trim(),
              require: (Array.isArray(rule?.require) ? rule.require : []).filter((kind): kind is ReturnEvidenceKind => RETURN_EVIDENCE.some((item) => item.id === kind)),
              replacement: Boolean(rule?.replacement),
              windowHours: Math.max(0, finiteNumber(rule?.windowHours, DEFAULT_RETURN_REASONS.find((item) => item.label === String(rule?.label ?? "").trim())?.windowHours ?? 0)),
            }))
            .filter((rule) => rule.label)
        : DEFAULT_RETURN_REASONS,
      returnForRefund: Boolean(merged.returns?.returnForRefund),
      replacementAddressChange: merged.returns?.replacementAddressChange !== false,
    },
    refunds: {
      enabled: Boolean(merged.refunds?.enabled),
      method: merged.refunds?.method === "manual" ? "manual" : "original",
      processingDays: Math.max(1, finiteNumber(merged.refunds?.processingDays, defaultOrderSettings.refunds.processingDays)),
      creditDays: Math.max(0, Math.round(finiteNumber(merged.refunds?.creditDays, defaultOrderSettings.refunds.creditDays))),
      autoRefundOnReturnPickup: Boolean(merged.refunds?.autoRefundOnReturnPickup),
      creditExpiryDays: Math.max(0, Math.round(finiteNumber(merged.refunds?.creditExpiryDays, 0))),
    },
    cancellation: {
      enabled: Boolean(merged.cancellation?.enabled),
      allowedUntil: until === "Ordered" || until === "Shipped" || until === "Packed" ? until : "Packed",
      windowHours: Math.max(0, finiteNumber(merged.cancellation?.windowHours, 0)),
      fee: Math.max(0, finiteNumber(merged.cancellation?.fee, 0)),
      delayDays: Math.max(0, finiteNumber(merged.cancellation?.delayDays, 30)),
      refundFeeOnDesk: merged.cancellation?.refundFeeOnDesk !== false,
      pickupHoldDays: Math.max(0, finiteNumber(merged.cancellation?.pickupHoldDays, 30)),
    },
    pickupSlots: Array.isArray(merged.pickupSlots) ? merged.pickupSlots.map((slot) => String(slot).trim()).filter(Boolean).slice(0, 30) : defaultOrderSettings.pickupSlots,
    adminActions: {
      processAfterDelivery: merged.adminActions?.processAfterDelivery !== false,
    },
    platformFee: {
      enabled: Boolean(merged.platformFee?.enabled),
      amount: Math.max(0, finiteNumber(merged.platformFee?.amount, 0)),
      // The platform fee is never refunded.
      refundable: false,
    },
    gst: {
      enabled: Boolean(merged.gst?.enabled),
      ratePercent: Math.max(0, finiteNumber(merged.gst?.ratePercent, 0)),
      invoiceEnabled: Boolean(merged.gst?.invoiceEnabled),
      legalName: String(merged.gst?.legalName ?? "").trim(),
      gstin: String(merged.gst?.gstin ?? "").trim().toUpperCase(),
      stateName: String(merged.gst?.stateName ?? "Maharashtra").trim() || "Maharashtra",
      invoiceFooter: String(merged.gst?.invoiceFooter ?? DEFAULT_INVOICE_FOOTER).trim().slice(0, 600),
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
  return courierOnlyFee(subtotal, itemCount, courierRate, settings) + packingChargeFor(itemCount, settings);
}

/** Packing charge by book count: the first tier whose "up to" covers the order; larger orders use the last tier. */
export type PackingTier = { upTo: number; amount: number };

/** Packing charge for a delivery; it is added into the courier charge, never listed on its own. */
export function packingChargeFor(itemCount: number, settings: Pick<OrderSettings, "packingCharge"> = getOrderSettings()) {
  const packing = settings.packingCharge;
  if (!packing?.enabled) return 0;
  const tiers = [...(packing.tiers ?? [])].sort((a, b) => a.upTo - b.upTo);
  if (tiers.length) {
    const count = Math.max(1, itemCount);
    return (tiers.find((tier) => count <= tier.upTo) ?? tiers[tiers.length - 1]).amount;
  }
  if (!(packing.amount > 0)) return 0;
  return Math.round(packing.amount * (packing.per === "copy" ? Math.max(1, itemCount) : 1) * 100) / 100;
}

function courierOnlyFee(subtotal: number, itemCount: number, courierRate: number | undefined, settings: OrderSettings) {
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
  if (packingChargeFor(1, settings) > 0) return false;
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

const CANCEL_STAGE: Partial<Record<Order["status"], number>> = {
  Paid: 0,
  Processing: 0,
  "Awaiting Confirmation": 0,
  Ordered: 0,
  Accepted: 0,
  Packed: 1,
  "Ready to Ship": 1,
  "To Ship": 1,
};

/** A pre-order whose announced date has passed by more than the allowed delay. */
export function preorderLate(order: Order, settings = getOrderSettings(), now = Date.now()) {
  const days = settings.cancellation?.delayDays ?? 0;
  const dates = order.items.filter((item) => item.preorder && item.releaseDate).map((item) => Date.parse(item.releaseDate as string)).filter(Number.isFinite);
  return days > 0 && dates.length > 0 && now > Math.max(...dates) + days * 864e5;
}

export function canCustomerCancel(order?: Order, settings = getOrderSettings(), now = Date.now()) {
  if (!order || order.returnRequest || order.splitInto?.length) return false;
  const stage = CANCEL_STAGE[order.status];
  if (stage === undefined) return false;
  if (stage <= 1 && preorderLate(order, settings, now)) return true;
  if (!settings.cancellation?.enabled) return false;
  const until = settings.cancellation.allowedUntil;
  // Once handed to the courier an order can't be cancelled; "Shipped" means up to booking.
  if (order.trackingId || order.shipmentId) return false;
  if (stage > (until === "Ordered" ? 0 : 1)) return false;
  const hours = settings.cancellation.windowHours;
  return !(hours > 0) || (now - Date.parse(order.date)) / 36e5 <= hours;
}

/** What a customer gets back on cancelling: paid amount less the platform fee and the cancellation fee. */
export function customerCancellationRefund(order: Order, settings = getOrderSettings()) {
  const paid = order.preorderPayment && !order.preorderPayment.balancePaidAt
    ? order.paymentStatus === "Pending" ? 0 : order.preorderPayment.advance
    : order.paymentStatus === "Paid" || order.paymentStatus === "Partially Refunded" ? order.total : 0;
  if (preorderLate(order, settings)) return Math.max(0, paid - (order.refundAmount ?? 0));
  return Math.max(0, paid - Math.max(0, order.platformFee ?? 0) - (settings.cancellation?.fee ?? 0) - (order.refundAmount ?? 0));
}

function deliveredAt(order: Order) {
  return order.history?.slice().reverse().find((entry) => entry.status === "Delivered")?.at ?? order.date;
}

/** Whether a reason can still be reported: its own hours after delivery, else the return window. */
export function reasonOpen(rule: ReturnReasonRule, order: Order, settings = getOrderSettings(), now = Date.now()) {
  const hours = rule.windowHours > 0 ? rule.windowHours : (order.returnableDays || settings.returns.windowDays) * 24;
  return (now - Date.parse(deliveredAt(order))) / 36e5 <= hours;
}

export function canCustomerReturn(order?: Order, settings = getOrderSettings()) {
  if (!order || !settings.returns.enabled || !settings.returns.returnForRefund || order.status !== "Delivered" || order.returnRequest) return false;
  if (order.deliveryMode === "store_pickup" && !settings.returns.pickupReturns) return false;
  const deliveredAt = order.history?.slice().reverse().find((entry) => entry.status === "Delivered")?.at ?? order.date;
  return (Date.now() - Date.parse(deliveredAt)) / 864e5 <= (order.returnableDays || settings.returns.windowDays);
}

export function canCustomerRequestReplacement(order: Order, settings = getOrderSettings()) {
  if (!settings.returns.replacementAllowed || order.status !== "Delivered" || order.returnRequest) return false;
  if (order.deliveryMode === "store_pickup" && !settings.returns.pickupReplacement) return false;
  const deliveredAt = order.history?.slice().reverse().find((entry) => entry.status === "Delivered")?.at ?? order.date;
  return (Date.now() - Date.parse(deliveredAt)) / 864e5 <= (order.returnableDays || settings.returns.windowDays);
}

/**
 * What a pre-order customer pays now: the admin's % of the order, or a fixed ₹ per copy.
 * The platform fee is paid once, with this advance, and never again on the balance.
 */
export function preorderAdvance(total: number, settings = getOrderSettings(), options: { copies?: number; platformFee?: number } = {}) {
  if (total <= 0) return total;
  const fee = Math.min(total, Math.max(0, Number(options.platformFee) || 0));
  const rest = total - fee;
  const raw = Number(settings.preorderPayment?.advanceValue);
  const part =
    settings.preorderPayment?.advanceType === "amount"
      ? Math.max(1, Number.isFinite(raw) ? raw : 100) * Math.max(1, Math.floor(Number(options.copies) || 1))
      : Math.round((rest * (Number.isFinite(raw) ? Math.min(99, Math.max(1, raw)) : 50)) / 100);
  return Math.min(total, Math.max(1, Math.round((fee + Math.min(rest, part)) * 100) / 100));
}

function windowText(hours: number, settings: OrderSettings) {
  const total = hours > 0 ? hours : settings.returns.windowDays * 24;
  return total % 24 ? `${total} hours` : `${total / 24} day${total === 24 ? "" : "s"}`;
}

export function customerOrderPolicyCopy(settings = getOrderSettings()) {
  const rules = settings.returns.replacementAllowed ? settings.returns.reasonRules.filter((rule) => rule.replacement) : [];
  const replacement = rules.length
    ? [
        ...rules.map((rule) => {
          const proof = rule.require.map((kind) => RETURN_EVIDENCE.find((item) => item.id === kind)?.label.toLowerCase()).filter(Boolean).join(", ");
          return `${rule.label}: report within ${windowText(rule.windowHours, settings)} of delivery${proof ? ` with ${proof}` : ""}.`;
        }),
        "The desk accepts or rejects each request. An accepted request gets a free return pickup and, after the item is checked, a free replacement with no charge for the book or shipping.",
      ].join("\n")
    : "";
  const late = settings.cancellation.delayDays > 0 ? `If a pre-order is more than ${settings.cancellation.delayDays} days late, you can cancel it for a full refund, including the platform fee.` : "";
  const returns = settings.returns.enabled && settings.returns.returnForRefund
    ? "Delivered orders can be returned free of charge within the return window; the desk accepts or declines the request by email."
    : "Delivered books are not refunded; wrong or damaged copies are replaced as below.";
  if (!settings.cancellation?.enabled) {
    return { title: "Replacements", body: [`Orders cannot be cancelled from your account. ${returns}`, late, replacement].filter(Boolean).join("\n") };
  }
  const until = settings.cancellation.allowedUntil;
  const stage = until === "Ordered" ? "before it is packed" : "until the courier picks it up";
  const hours = settings.cancellation.windowHours > 0 ? ` and within ${settings.cancellation.windowHours} hours of ordering` : "";
  const fee = settings.cancellation.fee > 0 ? ` A cancellation fee of ₹${settings.cancellation.fee} and the platform fee are kept from the refund.` : " The platform fee is kept from the refund.";
  return { title: "Cancellations & replacements", body: [`You can cancel an order from its page ${stage}${hours}.${fee}`, late, returns, replacement].filter(Boolean).join("\n") };
}

export function mask(value: string) {
  if (!value) return "";
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 4)}${"•".repeat(Math.min(12, value.length - 8))}${value.slice(-4)}`;
}
