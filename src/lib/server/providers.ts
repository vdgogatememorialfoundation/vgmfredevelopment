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
      to: message.to.replace(/\D/g, ""),
      type: "template",
      template: {
        name: message.template,
        language: { code: message.language || "en" },
        components: message.params.length
          ? [{ type: "body", parameters: message.params.map((text) => ({ type: "text", text })) }]
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
  const apiKey = pick(input.apiKey, "TOOKAN_API_KEY");
  if (!apiKey) return null;
  const when = new Date(Date.now() + 4 * 36e5).toISOString().slice(0, 16).replace("T", " ");
  const data = await call("https://api.tookanapp.com/v2/create_task", {
    method: "POST",
    json: {
      api_key: apiKey,
      order_id: order.orderId,
      team_id: typeof input.teamId === "string" ? input.teamId : "",
      auto_assignment: "1",
      job_description: order.items.map((item) => `${item.units} x ${item.name}`).join(", "),
      job_pickup_phone: order.pickup.phone,
      job_pickup_name: order.pickup.contactName,
      job_pickup_address: `${order.pickup.line1}, ${order.pickup.city} ${order.pickup.pincode}`,
      job_pickup_datetime: when,
      customer_email: order.customer.email ?? "",
      customer_username: order.customer.name,
      customer_phone: order.customer.phone,
      customer_address: `${order.customer.line1}, ${order.customer.city} ${order.customer.pincode}`,
      job_delivery_datetime: when,
      has_pickup: "1",
      has_delivery: "1",
      layout_type: "0",
      tracking_link: 1,
      timezone: "-330",
    },
  });
  if (Number(data.status) !== 200) throw new ProviderError(String(data.message ?? "Tookan did not create the task."));
  const task = (data.data as Json) ?? {};
  return {
    provider: "tookan",
    awb: String(task.delivery_job_id ?? task.job_id ?? ""),
    courierName: "Tookan rider",
    providerOrderId: String(task.job_id ?? ""),
    trackingUrl: String(task.delivery_tracing_link ?? task.tracking_link ?? ""),
    pickupScheduledFor: when,
  };
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
