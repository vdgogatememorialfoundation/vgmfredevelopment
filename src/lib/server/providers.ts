import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Provider clients used by the API routes. Each call takes credentials from
 * the admin request first and falls back to environment variables, so the
 * public checkout works on any device once the keys are set on the host.
 */

type Json = Record<string, unknown>;

export class ProviderError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const env = (name: string) => process.env[name]?.trim() ?? "";
const pick = (value: unknown, envName: string) => (typeof value === "string" && value.trim() ? value.trim() : env(envName));

async function call(url: string, init: RequestInit & { json?: unknown } = {}) {
  const headers = new Headers(init.headers);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  const response = await fetch(url, { ...init, headers, body, signal: AbortSignal.timeout(20000), cache: "no-store" });
  const text = await response.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    /* plain-text reply */
  }
  if (!response.ok) {
    const message =
      (data as Json)?.message ??
      ((data as Json)?.error as Json)?.message ??
      (data as Json)?.error ??
      (typeof data === "string" ? data.slice(0, 200) : `HTTP ${response.status}`);
    throw new ProviderError(String(message), response.status);
  }
  return data as Json;
}

/* ---------------- Razorpay ---------------- */

export function razorpayCreds(input: Json) {
  const keyId = pick(input.keyId, "RAZORPAY_KEY_ID");
  const keySecret = pick(input.keySecret, "RAZORPAY_KEY_SECRET");
  return keyId && keySecret ? { keyId, keySecret } : null;
}

function razorpayAuth(creds: { keyId: string; keySecret: string }) {
  return `Basic ${Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64")}`;
}

export async function razorpayOrder(creds: { keyId: string; keySecret: string }, amountRupees: number, receipt: string) {
  const data = await call("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { authorization: razorpayAuth(creds) },
    json: { amount: Math.round(amountRupees * 100), currency: "INR", receipt: receipt.slice(0, 40) },
  });
  return { orderId: String(data.id), keyId: creds.keyId };
}

export function razorpayVerify(keySecret: string, orderId: string, paymentId: string, signature: string) {
  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function razorpayLink(
  creds: { keyId: string; keySecret: string },
  input: { amount: number; orderId: string; name: string; email?: string; phone?: string; description: string; callbackUrl?: string; expiryHours?: number }
) {
  const expireBy = Math.floor(Date.now() / 1000) + Math.max(1, input.expiryHours ?? 72) * 3600;
  const data = await call("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: { authorization: razorpayAuth(creds) },
    json: {
      amount: Math.round(input.amount * 100),
      currency: "INR",
      description: input.description.slice(0, 2048),
      reference_id: input.orderId.slice(0, 40),
      customer: { name: input.name, email: input.email || undefined, contact: input.phone || undefined },
      notify: { sms: Boolean(input.phone), email: Boolean(input.email) },
      reminder_enable: true,
      expire_by: expireBy,
      callback_url: input.callbackUrl,
      callback_method: input.callbackUrl ? "get" : undefined,
    },
  });
  return { id: String(data.id), url: String(data.short_url), status: String(data.status) };
}

export async function razorpayLinkStatus(creds: { keyId: string; keySecret: string }, linkId: string) {
  const data = await call(`https://api.razorpay.com/v1/payment_links/${encodeURIComponent(linkId)}`, {
    headers: { authorization: razorpayAuth(creds) },
  });
  const payments = (data.payments as Json[] | null) ?? [];
  return { status: String(data.status), paymentId: payments[0]?.payment_id ? String(payments[0].payment_id) : undefined };
}

export async function razorpayRefund(creds: { keyId: string; keySecret: string }, paymentId: string, amountRupees?: number) {
  const data = await call(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: "POST",
    headers: { authorization: razorpayAuth(creds) },
    json: amountRupees ? { amount: Math.round(amountRupees * 100) } : {},
  });
  return { refundId: String(data.id), status: String(data.status) };
}

/* ---------------- Email ---------------- */

export async function sendZeptoMail(input: Json, mail: { to: string; subject: string; html: string }) {
  const token = pick(input.zeptoToken, "ZEPTOMAIL_TOKEN");
  const from = pick(input.fromAddress, "MAIL_FROM_ADDRESS");
  if (!token || !from) return null;
  const host = typeof input.zeptoHost === "string" && input.zeptoHost ? input.zeptoHost : "api.zeptomail.in";
  const data = await call(`https://${host}/v1.1/email`, {
    method: "POST",
    headers: { authorization: token.startsWith("Zoho-enczapikey") ? token : `Zoho-enczapikey ${token}`, accept: "application/json" },
    json: {
      from: { address: from, name: String(input.fromName || "VGMF") },
      to: [{ email_address: { address: mail.to } }],
      subject: mail.subject,
      htmlbody: mail.html,
    },
  });
  return { id: String(data.request_id ?? ""), provider: "zeptomail" };
}

export async function sendZohoMail(input: Json, mail: { to: string; subject: string; html: string }) {
  const clientId = pick(input.zohoClientId, "ZOHO_CLIENT_ID");
  const clientSecret = pick(input.zohoClientSecret, "ZOHO_CLIENT_SECRET");
  const refreshToken = pick(input.zohoRefreshToken, "ZOHO_REFRESH_TOKEN");
  const accountId = pick(input.zohoAccountId, "ZOHO_ACCOUNT_ID");
  const from = pick(input.fromAddress, "MAIL_FROM_ADDRESS");
  if (!clientId || !clientSecret || !refreshToken || !accountId || !from) return null;
  const domain = typeof input.zohoDomain === "string" && input.zohoDomain ? input.zohoDomain : "zoho.in";
  const params = new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token" });
  const token = await call(`https://accounts.${domain}/oauth/v2/token?${params}`, { method: "POST" });
  if (!token.access_token) throw new ProviderError(String(token.error ?? "Zoho did not return an access token."));
  const data = await call(`https://mail.${domain}/api/accounts/${encodeURIComponent(accountId)}/messages`, {
    method: "POST",
    headers: { authorization: `Zoho-oauthtoken ${token.access_token}` },
    json: { fromAddress: from, toAddress: mail.to, subject: mail.subject, content: mail.html, mailFormat: "html" },
  });
  return { id: String((data.data as Json)?.messageId ?? ""), provider: "zoho" };
}

/* ---------------- WhatsApp ---------------- */

/** Meta Cloud API wants country code + number, no plus sign or leading zeros. */
function waCloudTo(raw: string) {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return raw.trim();
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export async function sendMetaTemplate(
  input: Json,
  message: { to: string; template: string; language?: string; params: string[] }
) {
  const token = pick(input.metaAccessToken, "META_WA_TOKEN");
  const phoneId = pick(input.metaPhoneNumberId, "META_WA_PHONE_ID");
  if (!token || !phoneId) return null;
  const version = typeof input.metaApiVersion === "string" && input.metaApiVersion ? input.metaApiVersion : "v21.0";
  const data = await call(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    json: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: waCloudTo(message.to),
      type: "template",
      template: {
        name: message.template,
        language: { code: message.language || "en" },
        components: message.params.length
          ? [{ type: "body", parameters: message.params.map((text) => ({ type: "text", text: String(text).slice(0, 1024) })) }]
          : undefined,
      },
    },
  });
  const messages = (data.messages as Json[] | undefined) ?? [];
  return { id: String(messages[0]?.id ?? ""), provider: "meta" };
}

export async function listMetaTemplates(input: Json) {
  const token = pick(input.metaAccessToken, "META_WA_TOKEN");
  const wabaId = pick(input.metaWabaId, "META_WA_WABA_ID");
  if (!token || !wabaId) throw new ProviderError("Add the WhatsApp Business Account ID and access token first.");
  const version = typeof input.metaApiVersion === "string" && input.metaApiVersion ? input.metaApiVersion : "v21.0";
  const fields = "name,status,category,language,components";
  const data = await call(`https://graph.facebook.com/${version}/${wabaId}/message_templates?limit=200&fields=${fields}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return ((data.data as Json[]) ?? []).map((template) => {
    const components = (template.components as Json[]) ?? [];
    const body = String(components.find((component) => component.type === "BODY")?.text ?? "");
    return {
      name: String(template.name),
      language: String(template.language),
      status: String(template.status),
      category: String(template.category),
      body,
      variables: (body.match(/\{\{\d+\}\}/g) ?? []).length,
    };
  });
}

export async function sendAiSensy(input: Json, message: { to: string; campaign: string; name: string; params: string[] }) {
  const apiKey = pick(input.aisensyApiKey, "AISENSY_API_KEY");
  if (!apiKey) return null;
  await call("https://backend.aisensy.com/campaign/t1/api/v2", {
    method: "POST",
    json: {
      apiKey,
      campaignName: message.campaign,
      destination: message.to.replace(/\D/g, ""),
      userName: message.name || "Customer",
      templateParams: message.params,
      source: "vaidyagogate.org",
    },
  });
  return { id: "", provider: "aisensy" };
}

/* ---------------- Shipping ---------------- */

export type RateOut = {
  provider: string;
  courierId: string;
  courierName: string;
  rate: number;
  etaDays: number;
  live: true;
  cod?: boolean;
};

type Parcel = {
  pickupPincode: string;
  deliveryPincode: string;
  weightKg: number;
  cod: boolean;
  declaredValue: number;
  length: number;
  breadth: number;
  height: number;
};

const shiprocketTokens = new Map<string, { token: string; at: number }>();

async function shiprocketToken(input: Json) {
  const email = pick(input.email, "SHIPROCKET_EMAIL");
  const password = pick(input.password, "SHIPROCKET_PASSWORD");
  if (!email || !password) return null;
  const cached = shiprocketTokens.get(email);
  if (cached && Date.now() - cached.at < 8 * 24 * 36e5) return cached.token;
  const data = await call("https://apiv2.shiprocket.in/v1/external/auth/login", { method: "POST", json: { email, password } });
  if (!data.token) throw new ProviderError("Shiprocket rejected the API user email or password.", 401);
  shiprocketTokens.set(email, { token: String(data.token), at: Date.now() });
  return String(data.token);
}

const nimbusTokens = new Map<string, { token: string; at: number }>();

async function nimbusToken(input: Json) {
  const email = pick(input.email, "NIMBUSPOST_EMAIL");
  const password = pick(input.password, "NIMBUSPOST_PASSWORD");
  if (!email || !password) return null;
  const cached = nimbusTokens.get(email);
  if (cached && Date.now() - cached.at < 6 * 36e5) return cached.token;
  const data = await call("https://api.nimbuspost.com/v1/users/login", { method: "POST", json: { email, password } });
  if (!data.status || !data.data) throw new ProviderError(String(data.message ?? "Nimbuspost rejected the login."), 401);
  nimbusTokens.set(email, { token: String(data.data), at: Date.now() });
  return String(data.data);
}

export async function shiprocketRates(input: Json, parcel: Parcel): Promise<RateOut[] | null> {
  const token = await shiprocketToken(input);
  if (!token) return null;
  const params = new URLSearchParams({
    pickup_postcode: parcel.pickupPincode,
    delivery_postcode: parcel.deliveryPincode,
    weight: String(parcel.weightKg),
    cod: parcel.cod ? "1" : "0",
    declared_value: String(Math.round(parcel.declaredValue)),
    length: String(parcel.length),
    breadth: String(parcel.breadth),
    height: String(parcel.height),
  });
  const data = await call(`https://apiv2.shiprocket.in/v1/external/courier/serviceability/?${params}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const list = ((data.data as Json)?.available_courier_companies as Json[]) ?? [];
  return list.map((courier) => ({
    provider: "shiprocket",
    courierId: String(courier.courier_company_id),
    courierName: String(courier.courier_name),
    rate: Number(courier.rate ?? courier.freight_charge ?? 0),
    etaDays: Number(courier.estimated_delivery_days ?? 5),
    cod: Boolean(courier.cod),
    live: true as const,
  }));
}

export async function nimbusRates(input: Json, parcel: Parcel): Promise<RateOut[] | null> {
  const token = await nimbusToken(input);
  if (!token) return null;
  const data = await call("https://api.nimbuspost.com/v1/courier/serviceability", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    json: {
      origin: parcel.pickupPincode,
      destination: parcel.deliveryPincode,
      payment_type: parcel.cod ? "cod" : "prepaid",
      order_amount: String(Math.round(parcel.declaredValue)),
      weight: String(Math.round(parcel.weightKg * 1000)),
      length: String(parcel.length),
      breadth: String(parcel.breadth),
      height: String(parcel.height),
    },
  });
  if (!data.status) throw new ProviderError(String(data.message ?? "Nimbuspost could not price this pincode."));
  return ((data.data as Json[]) ?? []).map((courier) => ({
    provider: "nimbuspost",
    courierId: String(courier.id),
    courierName: String(courier.name),
    rate: Number(courier.total_charges ?? courier.freight_charges ?? 0),
    etaDays: daysUntil(String(courier.edd ?? "")) ?? 5,
    live: true as const,
  }));
}

function daysUntil(value: string) {
  const time = Date.parse(value);
  if (Number.isNaN(time)) return null;
  return Math.max(1, Math.ceil((time - Date.now()) / 864e5));
}

type BookInput = {
  orderId: string;
  orderDate: string;
  courierId: string;
  cod: boolean;
  total: number;
  subtotal: number;
  shippingCharge: number;
  weightKg: number;
  length: number;
  breadth: number;
  height: number;
  customer: { name: string; phone: string; email?: string; line1: string; line2?: string; city: string; state: string; pincode: string };
  pickup: { nickname: string; contactName: string; phone: string; email: string; line1: string; line2: string; city: string; state: string; pincode: string };
  items: { name: string; sku: string; units: number; price: number }[];
};

export type BookOut = {
  provider: string;
  awb: string;
  courierName: string;
  providerOrderId?: string;
  providerShipmentId?: string;
  labelUrl?: string;
  invoiceUrl?: string;
  manifestUrl?: string;
  pickupScheduledFor?: string;
  pickupReference?: string;
  courierCost?: number;
  trackingUrl?: string;
};

export async function shiprocketBook(input: Json, order: BookInput): Promise<BookOut | null> {
  const token = await shiprocketToken(input);
  if (!token) return null;
  const auth = { authorization: `Bearer ${token}` };
  const [firstName, ...rest] = order.customer.name.split(" ");
  const created = await call("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", {
    method: "POST",
    headers: auth,
    json: {
      order_id: order.orderId,
      order_date: order.orderDate.slice(0, 16).replace("T", " "),
      pickup_location: order.pickup.nickname,
      channel_id: typeof input.channelId === "string" && input.channelId ? input.channelId : undefined,
      billing_customer_name: firstName || order.customer.name,
      billing_last_name: rest.join(" ") || ".",
      billing_address: order.customer.line1,
      billing_address_2: order.customer.line2 ?? "",
      billing_city: order.customer.city,
      billing_pincode: order.customer.pincode,
      billing_state: order.customer.state,
      billing_country: "India",
      billing_email: order.customer.email || order.pickup.email,
      billing_phone: order.customer.phone.replace(/\D/g, "").slice(-10),
      shipping_is_billing: true,
      order_items: order.items.map((item) => ({ name: item.name, sku: item.sku, units: item.units, selling_price: item.price })),
      payment_method: order.cod ? "COD" : "Prepaid",
      shipping_charges: order.shippingCharge,
      sub_total: order.subtotal,
      length: order.length,
      breadth: order.breadth,
      height: order.height,
      weight: order.weightKg,
    },
  });
  const shipmentId = String(created.shipment_id ?? "");
  if (!shipmentId) throw new ProviderError(String(created.message ?? "Shiprocket did not create the shipment."));
  const assigned = await call("https://apiv2.shiprocket.in/v1/external/courier/assign/awb", {
    method: "POST",
    headers: auth,
    json: { shipment_id: shipmentId, courier_id: order.courierId || undefined },
  });
  const awbData = ((assigned.response as Json)?.data as Json) ?? {};
  if (!awbData.awb_code) throw new ProviderError(String(assigned.message ?? "Shiprocket could not assign an AWB. Check the wallet balance."));
  return {
    provider: "shiprocket",
    awb: String(awbData.awb_code),
    courierName: String(awbData.courier_name ?? ""),
    providerOrderId: String(created.order_id ?? ""),
    providerShipmentId: shipmentId,
    courierCost: Number(awbData.freight_charges ?? awbData.applied_weight_amount ?? 0) || undefined,
  };
}

export async function shiprocketPickup(input: Json, shipmentId: string, date?: string) {
  const token = await shiprocketToken(input);
  if (!token) return null;
  const data = await call("https://apiv2.shiprocket.in/v1/external/courier/generate/pickup", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    json: { shipment_id: [Number(shipmentId)], pickup_date: date ? [date] : undefined },
  });
  const response = (data.response as Json) ?? {};
  return {
    pickupScheduledFor: String(response.pickup_scheduled_date ?? date ?? ""),
    pickupReference: String(response.pickup_token_number ?? ""),
  };
}

export async function shiprocketLabel(input: Json, shipmentId: string) {
  const token = await shiprocketToken(input);
  if (!token) return null;
  const data = await call("https://apiv2.shiprocket.in/v1/external/courier/generate/label", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    json: { shipment_id: [Number(shipmentId)] },
  });
  return { labelUrl: String(data.label_url ?? "") };
}

export async function shiprocketInvoice(input: Json, providerOrderId: string) {
  const token = await shiprocketToken(input);
  if (!token) return null;
  const data = await call("https://apiv2.shiprocket.in/v1/external/orders/print/invoice", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    json: { ids: [Number(providerOrderId)] },
  });
  return { invoiceUrl: String(data.invoice_url ?? "") };
}

export async function shiprocketManifest(input: Json, shipmentId: string) {
  const token = await shiprocketToken(input);
  if (!token) return null;
  const data = await call("https://apiv2.shiprocket.in/v1/external/manifests/generate", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    json: { shipment_id: [Number(shipmentId)] },
  });
  return { manifestUrl: String(data.manifest_url ?? "") };
}

export async function shiprocketPickupLocations(input: Json) {
  const token = await shiprocketToken(input);
  if (!token) return null;
  const data = await call("https://apiv2.shiprocket.in/v1/external/settings/company/pickup", {
    headers: { authorization: `Bearer ${token}` },
  });
  const addresses = ((data.data as Json)?.shipping_address as Json[]) ?? [];
  return {
    locations: addresses.map((address) => ({
      nickname: String(address.pickup_location ?? address.location_name ?? ""),
      city: String(address.city ?? ""),
      pincode: String(address.pin_code ?? address.pincode ?? ""),
      phone: String(address.phone ?? ""),
      address: String(address.address ?? ""),
    })),
  };
}

export async function shiprocketTrack(input: Json, awb: string) {
  const token = await shiprocketToken(input);
  if (!token) return null;
  const data = await call(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${encodeURIComponent(awb)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const tracking = (data.tracking_data as Json) ?? {};
  const activities = (tracking.shipment_track_activities as Json[]) ?? [];
  return {
    status: String(((tracking.shipment_track as Json[]) ?? [])[0]?.current_status ?? tracking.shipment_status ?? ""),
    events: activities.map((activity) => ({ at: String(activity.date), status: String(activity.activity), location: String(activity.location ?? "") })),
    trackingUrl: String(tracking.track_url ?? ""),
  };
}

export async function shiprocketCancel(input: Json, providerOrderId: string) {
  const token = await shiprocketToken(input);
  if (!token) return null;
  await call("https://apiv2.shiprocket.in/v1/external/orders/cancel", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    json: { ids: [Number(providerOrderId)] },
  });
  return { cancelled: true };
}

export async function shiprocketAddPickup(input: Json, pickup: BookInput["pickup"]) {
  const token = await shiprocketToken(input);
  if (!token) return null;
  await call("https://apiv2.shiprocket.in/v1/external/settings/company/addpickup", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    json: {
      pickup_location: pickup.nickname,
      name: pickup.contactName,
      email: pickup.email,
      phone: pickup.phone.replace(/\D/g, "").slice(-10),
      address: pickup.line1,
      address_2: pickup.line2,
      city: pickup.city,
      state: pickup.state,
      country: "India",
      pin_code: pickup.pincode,
    },
  });
  return { saved: true };
}

export async function nimbusBook(input: Json, order: BookInput): Promise<BookOut | null> {
  const token = await nimbusToken(input);
  if (!token) return null;
  const data = await call("https://api.nimbuspost.com/v1/shipments", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    json: {
      order_number: order.orderId,
      shipping_charges: order.shippingCharge,
      discount: 0,
      cod_charges: 0,
      payment_type: order.cod ? "cod" : "prepaid",
      order_amount: order.total,
      package_weight: Math.round(order.weightKg * 1000),
      package_length: order.length,
      package_breadth: order.breadth,
      package_height: order.height,
      request_auto_pickup: "yes",
      courier_id: order.courierId || undefined,
      consignee: {
        name: order.customer.name,
        address: order.customer.line1,
        address_2: order.customer.line2 ?? "",
        city: order.customer.city,
        state: order.customer.state,
        pincode: order.customer.pincode,
        phone: order.customer.phone.replace(/\D/g, "").slice(-10),
      },
      pickup: {
        warehouse_name: order.pickup.nickname,
        name: order.pickup.contactName,
        address: order.pickup.line1,
        address_2: order.pickup.line2,
        city: order.pickup.city,
        state: order.pickup.state,
        pincode: order.pickup.pincode,
        phone: order.pickup.phone.replace(/\D/g, "").slice(-10),
      },
      order_items: order.items.map((item) => ({ name: item.name, qty: item.units, price: item.price, sku: item.sku })),
    },
  });
  if (!data.status) throw new ProviderError(String(data.message ?? "Nimbuspost could not book the shipment."));
  const shipment = (data.data as Json) ?? {};
  return {
    provider: "nimbuspost",
    awb: String(shipment.awb_number ?? ""),
    courierName: String(shipment.courier_name ?? ""),
    providerOrderId: String(shipment.order_id ?? ""),
    providerShipmentId: String(shipment.shipment_id ?? ""),
    labelUrl: String(shipment.label ?? ""),
    pickupScheduledFor: "Auto pickup requested",
    courierCost: Number(shipment.total_charges ?? 0) || undefined,
  };
}

export async function nimbusTrack(input: Json, awb: string) {
  const token = await nimbusToken(input);
  if (!token) return null;
  const data = await call(`https://api.nimbuspost.com/v1/shipments/track/${encodeURIComponent(awb)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const shipment = (data.data as Json) ?? {};
  const history = (shipment.history as Json[]) ?? [];
  return {
    status: String(shipment.status ?? ""),
    events: history.map((event) => ({ at: String(event.event_time), status: String(event.message ?? event.status_code), location: String(event.location ?? "") })),
    trackingUrl: "",
  };
}

export async function nimbusCancel(input: Json, awb: string) {
  const token = await nimbusToken(input);
  if (!token) return null;
  await call("https://api.nimbuspost.com/v1/shipments/cancel", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    json: { awb },
  });
  return { cancelled: true };
}

export async function tookanBook(input: Json, order: BookInput): Promise<BookOut | null> {
  return tookanBookMode(input, order, "parcel");
}

export async function shipdayBook(input: Json, order: BookInput): Promise<BookOut | null> {
  const apiKey = pick(input.apiKey, "SHIPDAY_API_KEY");
  if (!apiKey) return null;
  const data = await call("https://api.shipday.com/orders", {
    method: "POST",
    headers: { authorization: `Basic ${apiKey}` },
    json: {
      orderNumber: order.orderId,
      customerName: order.customer.name,
      customerAddress: `${order.customer.line1}, ${order.customer.city} ${order.customer.pincode}`,
      customerEmail: order.customer.email ?? "",
      customerPhoneNumber: order.customer.phone,
      restaurantName: order.pickup.contactName,
      restaurantAddress: `${order.pickup.line1}, ${order.pickup.city} ${order.pickup.pincode}`,
      restaurantPhoneNumber: order.pickup.phone,
      orderItem: order.items.map((item) => ({ name: item.name, unitPrice: item.price, quantity: item.units })),
      totalOrderCost: order.total,
      paymentMethod: order.cod ? "cash" : "credit_card",
    },
  });
  if (data.success === false) throw new ProviderError(String(data.response ?? "Shipday did not accept the order."));
  return {
    provider: "shipday",
    awb: String(data.orderId ?? order.orderId),
    courierName: "Shipday driver",
    providerOrderId: String(data.orderId ?? ""),
  };
}

function shipdayAuth(apiKey: string) {
  return { authorization: `Basic ${apiKey}` };
}

function shipdayOrders(data: unknown): Json[] {
  if (Array.isArray(data)) return data as Json[];
  const wrapped = data as Json;
  if (Array.isArray(wrapped.orders)) return wrapped.orders as Json[];
  if (wrapped && typeof wrapped === "object") return [wrapped];
  return [];
}

export async function shipdayTrack(input: Json, orderId: string) {
  const apiKey = pick(input.apiKey, "SHIPDAY_API_KEY");
  if (!apiKey) return null;
  let match: Json | null = null;
  try {
    const one = await call(`https://api.shipday.com/orders/${encodeURIComponent(orderId)}`, { headers: shipdayAuth(apiKey) });
    match = Array.isArray(one) ? (one[0] as Json) : (one as Json);
  } catch {
    const data = await call("https://api.shipday.com/orders", { headers: shipdayAuth(apiKey) });
    match =
      shipdayOrders(data).find(
        (order) => String(order.orderId) === orderId || String(order.orderNumber) === orderId || String(order.id) === orderId
      ) ?? null;
  }
  if (!match) {
    return { status: "Not found", events: [] as { at: string; status: string; location: string }[] };
  }
  const status = String(match.orderStatus ?? match.status ?? "");
  const carrier = (match.assignedCarrier as { name?: string } | undefined)?.name ?? "";
  return {
    status,
    events: [{ at: new Date().toISOString(), status, location: String(carrier) }],
  };
}

export async function shipdayCancel(input: Json, orderId: string) {
  const apiKey = pick(input.apiKey, "SHIPDAY_API_KEY");
  if (!apiKey) return null;
  await call(`https://api.shipday.com/orders/${encodeURIComponent(orderId)}`, {
    method: "DELETE",
    headers: shipdayAuth(apiKey),
  });
  return { cancelled: true };
}

export async function shipdayTest(input: Json) {
  const apiKey = pick(input.apiKey, "SHIPDAY_API_KEY");
  if (!apiKey) return null;
  const data = await call("https://api.shipday.com/orders", { headers: shipdayAuth(apiKey) });
  const count = shipdayOrders(data).length;
  return { message: `Connected. Shipday returned ${count} order${count === 1 ? "" : "s"}.` };
}

/* ---------------- Tookan: hyperlocal vs parcel ---------------- */

/** Tookan expects YYYY-MM-DD HH:MM:SS in the account timezone (IST = -330). */
function tookanDatetime(from = new Date(), extraHours = 4) {
  const when = new Date(from.getTime() + extraHours * 36e5);
  const ist = new Date(when.getTime() + 330 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())} ${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:${pad(ist.getUTCSeconds())}`;
}

const tookanStatusLabel: Record<number, string> = {
  0: "Assigned",
  1: "Started",
  2: "Successful",
  3: "Failed",
  4: "In progress",
  6: "Unassigned",
  7: "Accepted",
  8: "Declined",
  9: "Cancelled",
};

export async function tookanBookMode(input: Json, order: BookInput, mode: "hyperlocal" | "parcel"): Promise<BookOut | null> {
  const apiKey = pick(input.apiKey, "TOOKAN_API_KEY");
  if (!apiKey) return null;
  const pickupAt = tookanDatetime(new Date(), 2);
  const deliverAt = tookanDatetime(new Date(), 4);
  const parcel = mode === "parcel";
  const teamId = typeof input.teamId === "string" ? input.teamId.trim() : "";
  const description = order.items.map((item) => `${item.units} x ${item.name}`).join(", ");
  const pickupAddress = `${order.pickup.line1}, ${order.pickup.city} ${order.pickup.pincode}`;
  const dropAddress = `${order.customer.line1}, ${order.customer.city} ${order.customer.pincode}`;

  if (parcel) {
    const data = await call("https://api.tookanapp.com/v2/create_multiple_tasks", {
      method: "POST",
      json: {
        api_key: apiKey,
        ...(teamId ? { team_id: Number(teamId) || teamId } : {}),
        timezone: -330,
        has_pickup: 1,
        has_delivery: 1,
        layout_type: 0,
        geofence: 0,
        auto_assignment: 1,
        tags: "parcel",
        pickups: [
          {
            address: pickupAddress,
            time: pickupAt,
            phone: order.pickup.phone,
            job_description: description,
            job_pickup_name: order.pickup.contactName,
            job_pickup_phone: order.pickup.phone,
            order_id: order.orderId,
          },
        ],
        deliveries: [
          {
            address: dropAddress,
            time: deliverAt,
            phone: order.customer.phone,
            job_description: description,
            customer_username: order.customer.name,
            customer_phone: order.customer.phone,
            customer_email: order.customer.email ?? "",
            order_id: order.orderId,
          },
        ],
      },
    });
    if (Number(data.status) !== 200) throw new ProviderError(String(data.message ?? "Tookan did not create the parcel task."));
    const task = (data.data as Json) ?? {};
    return {
      provider: "tookan-parcel",
      awb: String(task.delivery_job_id ?? task.job_id ?? ""),
      courierName: "Tookan parcel",
      providerOrderId: String(task.pickup_job_id ?? task.job_id ?? ""),
      providerShipmentId: String(task.delivery_job_id ?? ""),
      trackingUrl: String(task.delivery_tracing_link ?? task.tracking_link ?? ""),
      pickupScheduledFor: pickupAt,
    };
  }

  const data = await call("https://api.tookanapp.com/v2/create_task", {
    method: "POST",
    json: {
      api_key: apiKey,
      order_id: order.orderId,
      ...(teamId ? { team_id: Number(teamId) || teamId } : {}),
      auto_assignment: 1,
      job_description: description,
      job_pickup_phone: order.pickup.phone,
      job_pickup_name: order.pickup.contactName,
      job_pickup_address: pickupAddress,
      job_pickup_datetime: pickupAt,
      customer_email: order.customer.email ?? "",
      customer_username: order.customer.name,
      customer_phone: order.customer.phone,
      customer_address: dropAddress,
      job_delivery_datetime: deliverAt,
      has_pickup: 0,
      has_delivery: 1,
      layout_type: 0,
      tracking_link: 1,
      timezone: -330,
    },
  });
  if (Number(data.status) !== 200) throw new ProviderError(String(data.message ?? "Tookan did not create the hyperlocal task."));
  const task = (data.data as Json) ?? {};
  return {
    provider: "tookan",
    awb: String(task.job_id ?? task.delivery_job_id ?? ""),
    courierName: "Tookan hyperlocal",
    providerOrderId: String(task.job_id ?? ""),
    trackingUrl: String(task.tracking_link ?? task.delivery_tracing_link ?? ""),
    pickupScheduledFor: pickupAt,
  };
}

export async function tookanTrack(input: Json, jobId: string) {
  const apiKey = pick(input.apiKey, "TOOKAN_API_KEY");
  if (!apiKey) return null;
  const data = await call("https://api.tookanapp.com/v2/get_job_details", {
    method: "POST",
    json: { api_key: apiKey, job_ids: [Number(jobId) || jobId], include_task_history: 1 },
  });
  const job = ((data.data as Json[]) ?? [])[0] ?? {};
  const history = (job.task_history as Json[]) ?? [];
  const code = Number(job.job_status ?? job.status);
  return {
    status: tookanStatusLabel[code] ?? String(job.job_status ?? job.status ?? ""),
    events: history.map((entry) => ({
      at: String(entry.creation_datetime ?? entry.timestamp ?? ""),
      status: String(entry.description ?? entry.status ?? ""),
      location: String(entry.latitude && entry.longitude ? `${entry.latitude},${entry.longitude}` : ""),
    })),
  };
}

export async function tookanCancel(input: Json, jobId: string) {
  const apiKey = pick(input.apiKey, "TOOKAN_API_KEY");
  if (!apiKey) return null;
  const data = await call("https://api.tookanapp.com/v2/cancel_task", {
    method: "POST",
    json: { api_key: apiKey, job_id: Number(jobId) || jobId, job_status: 9 },
  });
  if (Number(data.status) !== 200) throw new ProviderError(String(data.message ?? "Tookan could not cancel the task."));
  return { cancelled: true };
}

export async function tookanTest(input: Json) {
  const apiKey = pick(input.apiKey, "TOOKAN_API_KEY");
  if (!apiKey) return null;
  const data = await call("https://api.tookanapp.com/v2/get_all_fleets", {
    method: "POST",
    json: { api_key: apiKey },
  });
  if (Number(data.status) !== 200) throw new ProviderError(String(data.message ?? "Tookan rejected the API key."));
  const fleets = Array.isArray(data.data) ? data.data : [];
  return { message: `Connected. Tookan returned ${fleets.length} fleet${fleets.length === 1 ? "" : "s"}.` };
}

/* ---------------- iThink Logistics ---------------- */

function ithinkAuth(input: Json) {
  const accessToken = pick(input.accessToken, "ITHINK_ACCESS_TOKEN");
  const secretKey = pick(input.secretKey, "ITHINK_SECRET_KEY");
  if (!accessToken || !secretKey) return null;
  return { access_token: accessToken, secret_key: secretKey, host: pick(input.host, "ITHINK_HOST") || "https://my.ithinklogistics.com/api_v3/" };
}

async function ithinkPost(path: string, payload: Json & { host?: string }) {
  const host = String(payload.host ?? "https://my.ithinklogistics.com/api_v3/").replace(/\/?$/, "/");
  const body = { ...payload };
  delete body.host;
  const data = await call(`${host}${path.replace(/^\//, "")}`, { method: "POST", json: { data: body } });
  const status = String(data.status ?? data.status_code ?? "").toLowerCase();
  if (status && status !== "success" && status !== "200" && Number(data.status_code) >= 400) {
    throw new ProviderError(String(data.message ?? data.remark ?? "iThink Logistics rejected the request."));
  }
  return data;
}

export async function ithinkRates(input: Json, parcel: Parcel): Promise<RateOut[] | null> {
  const auth = ithinkAuth(input);
  if (!auth) return null;
  const data = await ithinkPost("rate/check.json", {
    ...auth,
    from_pincode: parcel.pickupPincode,
    to_pincode: parcel.deliveryPincode,
    shipping_length_cms: String(parcel.length),
    shipping_width_cms: String(parcel.breadth),
    shipping_height_cms: String(parcel.height),
    shipping_weight_kg: String(parcel.weightKg),
    order_type: "forward",
    payment_type: parcel.cod ? "cod" : "prepaid",
  });
  const rates = ((data.data as Json)?.rate as Json[]) ?? (data.data as Json[]) ?? [];
  return rates.map((courier) => ({
    provider: "ithink",
    courierId: String(courier.logistic_id ?? courier.id ?? courier.logistic_name ?? ""),
    courierName: String(courier.logistic_name ?? courier.name ?? "iThink courier"),
    rate: Number(courier.total_charges ?? courier.rate ?? courier.freight_charge ?? 0),
    etaDays: daysUntil(String(courier.edd ?? courier.estimated_delivery ?? "")) ?? Number(courier.tat ?? 5),
    live: true as const,
  }));
}

export async function ithinkBook(input: Json, order: BookInput): Promise<BookOut | null> {
  const auth = ithinkAuth(input);
  if (!auth) return null;
  const pickupId = typeof input.pickupAddressId === "string" ? input.pickupAddressId : "";
  const data = await ithinkPost("order/add.json", {
    ...auth,
    pickup_address_id: pickupId,
    shipments: [
      {
        waybill: "",
        order: order.orderId,
        sub_order: `${order.orderId}-1`,
        order_date: order.orderDate.slice(0, 10),
        total_amount: String(order.total),
        name: order.customer.name,
        company_name: "",
        add: order.customer.line1,
        add2: order.customer.line2 ?? "",
        pin: order.customer.pincode,
        city: order.customer.city,
        state: order.customer.state,
        country: "India",
        phone: order.customer.phone.replace(/\D/g, "").slice(-10),
        email: order.customer.email ?? order.pickup.email,
        products: order.items.map((item) => item.name).join(", "),
        quantity: String(order.items.reduce((sum, item) => sum + item.units, 0)),
        payment_mode: order.cod ? "COD" : "Prepaid",
        shipping_charges: String(order.shippingCharge),
        cod_charges: "0",
        discount: "0",
        order_type: "forward",
        return_address: order.pickup.line1,
        return_pin: order.pickup.pincode,
        return_city: order.pickup.city,
        return_state: order.pickup.state,
        return_country: "India",
        return_phone: order.pickup.phone.replace(/\D/g, "").slice(-10),
        shipping_length_cms: String(order.length),
        shipping_width_cms: String(order.breadth),
        shipping_height_cms: String(order.height),
        shipping_weight_kg: String(order.weightKg),
        logistic: order.courierId || undefined,
      },
    ],
  });
  const shipment = (((data.data as Json)?.shipments as Json[]) ?? [data.data as Json])[0] ?? {};
  const awb = String(shipment.waybill ?? shipment.awb ?? shipment.awb_number ?? "");
  if (!awb) throw new ProviderError(String(data.message ?? "iThink Logistics did not assign an AWB."));
  return {
    provider: "ithink",
    awb,
    courierName: String(shipment.logistic_name ?? shipment.courier ?? "iThink Logistics"),
    providerOrderId: String(shipment.order_id ?? order.orderId),
    providerShipmentId: String(shipment.shipment_id ?? ""),
    labelUrl: String(shipment.shipping_label ?? shipment.label ?? ""),
    courierCost: Number(shipment.total_charges ?? 0) || undefined,
  };
}

export async function ithinkTrack(input: Json, awb: string) {
  const auth = ithinkAuth(input);
  if (!auth) return null;
  const data = await ithinkPost("order/track.json", { ...auth, awb_number_list: awb });
  const tracking = ((data.data as Json) ?? {})[awb] as Json | undefined;
  const scans = (tracking?.scans as Json[]) ?? (tracking?.history as Json[]) ?? [];
  return {
    status: String(tracking?.current_status ?? tracking?.status ?? ""),
    events: scans.map((scan) => ({
      at: String(scan.date ?? scan.time ?? scan.updated_date ?? ""),
      status: String(scan.status ?? scan.activity ?? ""),
      location: String(scan.location ?? scan.city ?? ""),
    })),
  };
}

export async function ithinkCancel(input: Json, awb: string) {
  const auth = ithinkAuth(input);
  if (!auth) return null;
  await ithinkPost("order/cancel.json", { ...auth, awbs: [awb] });
  return { cancelled: true };
}

export async function ithinkLabel(input: Json, awb: string) {
  const auth = ithinkAuth(input);
  if (!auth) return null;
  const data = await ithinkPost("shipping/label.json", { ...auth, awb_numbers: awb, page_size: "A4" });
  return { labelUrl: String((data.data as Json)?.label ?? data.label_url ?? "") };
}

export async function ithinkInvoice(input: Json, awb: string) {
  const auth = ithinkAuth(input);
  if (!auth) return null;
  const data = await ithinkPost("shipping/invoice.json", { ...auth, awb_numbers: awb });
  return { invoiceUrl: String((data.data as Json)?.invoice ?? data.invoice_url ?? "") };
}

export async function ithinkManifest(input: Json, awb: string) {
  const auth = ithinkAuth(input);
  if (!auth) return null;
  const data = await ithinkPost("shipping/manifest.json", { ...auth, awb_numbers: awb });
  return { manifestUrl: String((data.data as Json)?.manifest ?? data.manifest_url ?? "") };
}

export async function ithinkPincode(input: Json, pincode: string) {
  const auth = ithinkAuth(input);
  if (!auth) return null;
  const data = await ithinkPost("pincode/check.json", { ...auth, pincode });
  const nested = (data.data as Json) ?? {};
  const serviceable =
    Boolean(nested.serviceable) ||
    nested.status === "success" ||
    nested.status === 200 ||
    data.status === "success" ||
    data.status === 200;
  return { serviceable, raw: data };
}

/* ---------------- Shiprocket return ---------------- */

export async function shiprocketReturn(input: Json, order: BookInput): Promise<BookOut | null> {
  const token = await shiprocketToken(input);
  if (!token) return null;
  const auth = { authorization: `Bearer ${token}` };
  const [firstName, ...rest] = order.customer.name.split(" ");
  const created = await call("https://apiv2.shiprocket.in/v1/external/orders/create/return", {
    method: "POST",
    headers: auth,
    json: {
      order_id: `RET-${order.orderId}`,
      order_date: new Date().toISOString().slice(0, 16).replace("T", " "),
      channel_id: typeof input.channelId === "string" && input.channelId ? input.channelId : undefined,
      pickup_customer_name: firstName || order.customer.name,
      pickup_last_name: rest.join(" ") || ".",
      pickup_address: order.customer.line1,
      pickup_address_2: order.customer.line2 ?? "",
      pickup_city: order.customer.city,
      pickup_state: order.customer.state,
      pickup_country: "India",
      pickup_pincode: order.customer.pincode,
      pickup_email: order.customer.email || order.pickup.email,
      pickup_phone: order.customer.phone.replace(/\D/g, "").slice(-10),
      pickup_isd_code: "91",
      shipping_customer_name: order.pickup.contactName,
      shipping_address: order.pickup.line1,
      shipping_address_2: order.pickup.line2,
      shipping_city: order.pickup.city,
      shipping_country: "India",
      shipping_pincode: order.pickup.pincode,
      shipping_state: order.pickup.state,
      shipping_email: order.pickup.email,
      shipping_isd_code: "91",
      shipping_phone: order.pickup.phone.replace(/\D/g, "").slice(-10),
      order_items: order.items.map((item) => ({ name: item.name, sku: item.sku, units: item.units, selling_price: item.price, qc_enable: false })),
      payment_method: "PREPAID",
      sub_total: order.subtotal,
      length: order.length,
      breadth: order.breadth,
      height: order.height,
      weight: order.weightKg,
    },
  });
  const shipmentId = String(created.shipment_id ?? "");
  if (!shipmentId) throw new ProviderError(String(created.message ?? "Shiprocket did not create the return shipment."));
  const assigned = await call("https://apiv2.shiprocket.in/v1/external/courier/assign/awb", {
    method: "POST",
    headers: auth,
    json: { shipment_id: shipmentId, is_return: 1, courier_id: order.courierId || undefined },
  });
  const awbData = ((assigned.response as Json)?.data as Json) ?? {};
  return {
    provider: "shiprocket",
    awb: String(awbData.awb_code ?? created.awb_code ?? ""),
    courierName: String(awbData.courier_name ?? "Return courier"),
    providerOrderId: String(created.order_id ?? ""),
    providerShipmentId: shipmentId,
    courierCost: Number(awbData.freight_charges ?? 0) || undefined,
  };
}

/* ---------------- Zoho CPaaS WhatsApp ---------------- */

function cpaasHost(domain: string) {
  if (domain === "zoho.in") return "cpaas.zoho.in";
  if (domain === "zoho.eu") return "cpaas.zoho.eu";
  return "cpaas.zoho.com";
}

function waE164(raw: string) {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

export async function sendZohoCpaas(
  input: Json,
  message: { to: string; template: string; language?: string; params: string[] }
) {
  const apiKey = pick(input.zohoCpaasApiKey, "ZOHO_CPAAS_API_KEY");
  const from = pick(input.zohoCpaasFrom, "ZOHO_CPAAS_FROM");
  if (!apiKey || !from) return null;
  const domain = typeof input.zohoCpaasDomain === "string" && input.zohoCpaasDomain ? input.zohoCpaasDomain : "zoho.com";
  const template = message.template.trim();
  if (!template) throw new ProviderError("Map this notification to a Zoho CPaaS template alias or template key.");
  const mergeInfo: Record<string, string> = {};
  message.params.forEach((value, index) => {
    mergeInfo[String(index + 1)] = value;
  });
  const named = ["name", "order_id", "status", "amount"] as const;
  named.forEach((key, index) => {
    if (message.params[index]) mergeInfo[key] = message.params[index];
  });
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(template);
  const data = await call(`https://${cpaasHost(domain)}/v1.1/whatsapp`, {
    method: "POST",
    headers: { authorization: apiKey.startsWith("Zoho-enczapikey") ? apiKey : `Zoho-enczapikey ${apiKey}` },
    json: {
      from: waE164(from),
      to: waE164(message.to),
      ...(uuid ? { template_key: template } : { template_alias: template }),
      merge_info: mergeInfo,
    },
  });
  const payload = (data.data as Json) ?? data;
  return { id: String(payload.message_id ?? data.message_id ?? ""), provider: "zoho" };
}
