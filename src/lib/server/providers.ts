import { createCipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { formatIndiaClock, tookanDeliveryInstant } from "@/lib/delivery-expectation";
import { shipdayActivity, shipdayLookupIds, shipdayOrderRow, shipdayOrderState } from "@/lib/shipday-status";

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

export async function razorpayOrder(
  creds: { keyId: string; keySecret: string },
  amountRupees: number,
  receipt: string,
  deviceMode?: "wired" | "wireless"
) {
  const headers: Record<string, string> = { authorization: razorpayAuth(creds) };
  if (deviceMode) headers["X-Razorpay-Device-Mode"] = deviceMode;
  const data = await call("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers,
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
  return razorpayRefundView(data);
}

function razorpayRefundView(data: Json) {
  const acquirer = (data.acquirer_data as Json) ?? {};
  const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));
  return {
    refundId: text(data.id),
    status: text(data.status),
    amount: Number(data.amount ?? 0) / 100,
    rrn: text(acquirer.rrn),
    arn: text(acquirer.arn),
    utr: text(acquirer.utr),
    speed: text(data.speed_processed || data.speed_requested),
    createdAt: data.created_at ? new Date(Number(data.created_at) * 1000).toISOString() : "",
  };
}

/** GET /v1/refunds/:id — status plus the bank's RRN/ARN/UTR once the refund is processed. */
export async function razorpayRefundStatus(creds: { keyId: string; keySecret: string }, refundId: string) {
  const data = await call(`https://api.razorpay.com/v1/refunds/${encodeURIComponent(refundId)}`, {
    headers: { authorization: razorpayAuth(creds) },
  });
  return razorpayRefundView(data);
}

export async function razorpayDeviceActivity(
  creds: { keyId: string; keySecret: string },
  input: {
    action: "initiate_checkout" | "close_checkout";
    deviceMode: "wired" | "wireless";
    deviceId?: string;
    amountRupees?: number;
    orderId?: string;
    name?: string;
    email?: string;
    phone?: string;
    method?: "upi" | "card";
    description?: string;
  }
) {
  if (input.deviceMode === "wireless" && !input.deviceId) {
    throw new ProviderError("Add the Razorpay POS device ID in Settings → Payments.");
  }
  const payload: Json = { action: input.action };
  if (input.deviceId) payload.device_id = input.deviceId;
  if (input.action === "initiate_checkout") {
    payload.initiate_checkout = {
      name: "Vaidya Gogate Memorial Foundation",
      amount: Math.round((input.amountRupees ?? 0) * 100),
      currency: "INR",
      description: (input.description ?? "POS sale").slice(0, 255),
      type: "in_person",
      order_id: input.orderId,
      prefill: {
        name: input.name || undefined,
        email: input.email || undefined,
        contact: input.phone || undefined,
        method: input.method,
      },
    };
  }
  const data = await call("https://api.razorpay.com/v1/devices/activity", {
    method: "POST",
    headers: { authorization: razorpayAuth(creds), "X-Razorpay-Device-Mode": input.deviceMode },
    json: payload,
  });
  const error = data.error as Json | undefined;
  return {
    activityId: String(data.id ?? ""),
    status: String(data.status ?? ""),
    error: error ? String(error.description ?? error.reason ?? error.code ?? "Device error") : undefined,
  };
}

export async function razorpayDeviceActivityStatus(
  creds: { keyId: string; keySecret: string },
  activityId: string,
  deviceMode: "wired" | "wireless"
) {
  const data = await call(`https://api.razorpay.com/v1/devices/activity/${encodeURIComponent(activityId)}`, {
    headers: { authorization: razorpayAuth(creds), "X-Razorpay-Device-Mode": deviceMode },
  });
  const error = data.error as Json | undefined;
  return {
    activityId: String(data.id ?? activityId),
    status: String(data.status ?? ""),
    error: error ? String(error.description ?? error.reason ?? error.code ?? "Device error") : undefined,
  };
}

export async function razorpayOrderPayments(
  creds: { keyId: string; keySecret: string },
  orderId: string,
  deviceMode?: "wired" | "wireless"
) {
  const headers: Record<string, string> = { authorization: razorpayAuth(creds) };
  if (deviceMode) headers["X-Razorpay-Device-Mode"] = deviceMode;
  const data = await call(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}?expand[]=payments`, { headers });
  const collection = data.payments as Json | undefined;
  const items = (Array.isArray(collection) ? collection : (collection?.items as Json[] | undefined)) ?? [];
  const paid = items.find((item) => item.status === "captured" || item.status === "authorized");
  return {
    status: String(data.status ?? ""),
    amountPaid: Number(data.amount_paid ?? 0),
    paymentId: paid?.id ? String(paid.id) : undefined,
    method: paid?.method ? String(paid.method) : undefined,
  };
}

/* ---------------- Paytm EDC ---------------- */

export function paytmCreds(input: Json) {
  const mid = pick(input.mid, "PAYTM_MID");
  const merchantKey = pick(input.merchantKey, "PAYTM_MERCHANT_KEY");
  const tid = pick(input.tid, "PAYTM_TID");
  const channelId = pick(input.channelId, "PAYTM_CHANNEL_ID") || "WEB";
  const mode = pick(input.mode, "PAYTM_MODE") || "staging";
  return mid && merchantKey && tid ? { mid, merchantKey, tid, channelId, mode } : null;
}

function paytmHost(mode: string) {
  return mode === "live" ? "https://securegw-edc.paytmpayments.in" : "https://securestage.paytmpayments.com";
}

function paytmStamp(date = new Date()) {
  const ist = new Date(date.getTime() + 330 * 60 * 1000);
  return ist.toISOString().slice(0, 19).replace("T", " ");
}

function paytmChecksum(body: unknown, key: string) {
  const params = typeof body === "string" ? body : JSON.stringify(body);
  const salt = randomBytes(2).toString("hex");
  const hashedString = createHash("sha256").update(`${params}|${salt}`).digest("hex") + salt;
  const key16 = key.length >= 16 ? key.slice(0, 16) : key.padEnd(16, " ");
  const cipher = createCipheriv("aes-128-cbc", key16, "@@@@&&&&####$$$$");
  return cipher.update(hashedString, "utf8", "base64") + cipher.final("base64");
}

export async function paytmEdcSale(
  creds: { mid: string; merchantKey: string; tid: string; channelId: string; mode: string },
  input: { amountRupees: number; merchantTransactionId: string; merchantReferenceNo?: string }
) {
  const transactionDateTime = paytmStamp();
  const body = {
    paytmMid: creds.mid,
    paytmTid: creds.tid,
    transactionDateTime,
    merchantTransactionId: input.merchantTransactionId.replace(/[^A-Za-z0-9]/g, "").slice(0, 32),
    merchantReferenceNo: input.merchantReferenceNo?.replace(/[^A-Za-z0-9]/g, "").slice(0, 32),
    transactionAmount: String(Math.round(input.amountRupees * 100)),
    merchantExtendedInfo: { PaymentMode: "All" },
    timeoutConfig: "60",
  };
  const payload = {
    head: {
      requestTimeStamp: transactionDateTime,
      channelId: creds.channelId,
      checksum: paytmChecksum(body, creds.merchantKey),
      version: "3.1",
    },
    body,
  };
  const data = await call(`${paytmHost(creds.mode)}/ecr/payment/request`, { method: "POST", json: payload });
  const result = ((data.body as Json)?.resultInfo as Json) ?? (data.resultInfo as Json) ?? {};
  const status = String(result.resultStatus ?? "").toUpperCase();
  const failed = status === "F" || status === "FAILED" || String(result.resultCode ?? "").includes("FAIL");
  if (failed) throw new ProviderError(String(result.resultMsg ?? result.resultCode ?? "Paytm EDC refused the sale."));
  return {
    merchantTransactionId: body.merchantTransactionId,
    transactionDateTime,
    status: status || "A",
    message: String(result.resultMsg ?? "Accepted. Complete the payment on the Paytm EDC."),
  };
}

export async function paytmEdcStatus(
  creds: { mid: string; merchantKey: string; tid: string; channelId: string; mode: string },
  input: { merchantTransactionId: string; transactionDateTime: string }
) {
  const body = {
    paytmMid: creds.mid,
    paytmTid: creds.tid,
    transactionDateTime: input.transactionDateTime,
    merchantTransactionId: input.merchantTransactionId,
  };
  const requestTimeStamp = paytmStamp();
  const payload = {
    head: {
      requestTimeStamp,
      channelId: creds.channelId,
      checksum: paytmChecksum(body, creds.merchantKey),
      version: "3.1",
    },
    body,
  };
  const data = await call(`${paytmHost(creds.mode)}/ecr/V2/payment/status`, { method: "POST", json: payload });
  const resultBody = (data.body as Json) ?? data;
  const result = (resultBody.resultInfo as Json) ?? {};
  const status = String(result.resultStatus ?? "").toUpperCase();
  const code = String(result.resultCode ?? result.resultCodeId ?? "");
  const paid = status === "S" || status === "SUCCESS" || code === "0000" || code === "SUCCESS";
  const failed = status === "F" || status === "FAILED" || code === "0011" || code === "FAIL";
  return {
    paid,
    failed,
    pending: !paid && !failed,
    status,
    message: String(result.resultMsg ?? result.resultCode ?? "Pending on the EDC."),
    paymentId: resultBody.acquirementId ? String(resultBody.acquirementId) : undefined,
    reference: resultBody.retrievalReferenceNo ? String(resultBody.retrievalReferenceNo) : undefined,
    method: resultBody.payMethod ? String(resultBody.payMethod) : undefined,
  };
}

/* ---------------- Email ---------------- */

function emailApiHost(input: Json) {
  const raw = String(input.zeptoHost || input.zohoCpaasDomain || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (raw.includes("cpaas.zoho.in") || raw === "zoho.in") return "cpaas.zoho.in";
  if (raw.includes("cpaas.zoho.eu") || raw === "zoho.eu") return "cpaas.zoho.eu";
  if (raw.includes("cpaas.zoho.com") || raw === "zoho.com") return "cpaas.zoho.com";
  if (raw.includes("zeptomail")) return raw;
  if (String(input.provider || "") === "zeptomail" && raw) return raw;
  return "cpaas.zoho.in";
}

export async function sendZeptoMail(input: Json, mail: { to: string; subject: string; html: string; replyTo?: string }) {
  const token = pick(input.zeptoToken, "ZEPTOMAIL_TOKEN") || pick(input.zohoCpaasApiKey, "ZOHO_CPAAS_API_KEY");
  const from = pick(input.fromAddress, "MAIL_FROM_ADDRESS") || "noreply@vaidyagogate.org";
  if (!token || !from) return null;
  const hosts = [...new Set([emailApiHost(input), "cpaas.zoho.in", "api.zeptomail.in"])];
  const payload = {
    from: { address: from, name: String(input.fromName || "Vaidya Gogate Memorial Foundation") },
    to: [{ email_address: { address: mail.to, name: mail.to } }],
    subject: mail.subject,
    htmlbody: mail.html,
    ...(mail.replyTo ? { reply_to: [{ address: mail.replyTo }] } : {}),
  };
  const headers = { authorization: token.startsWith("Zoho-enczapikey") ? token : `Zoho-enczapikey ${token}`, accept: "application/json" };
  let lastError: unknown;
  for (const host of hosts) {
    try {
      const data = await call(`https://${host}/v1.1/email`, { method: "POST", headers, json: payload });
      return { id: String(data.request_id ?? data.data ?? ""), provider: host.includes("cpaas") ? "cpaas" : "zeptomail" };
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  return null;
}

export async function sendTransactionalEmail(input: Json, mail: { to: string; subject: string; html: string; replyTo?: string }) {
  const provider = String(input.provider || "cpaas");
  if (provider === "zoho") {
    const zoho = await sendZohoMail(input, mail);
    if (zoho) return zoho;
  }
  const cpaas = await sendZeptoMail(input, mail);
  if (cpaas) return cpaas;
  if (provider !== "zoho") return sendZohoMail(input, mail);
  return null;
}

export async function sendZohoMail(input: Json, mail: { to: string; subject: string; html: string; replyTo?: string }) {
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
    json: {
      fromAddress: from,
      toAddress: mail.to,
      subject: mail.subject,
      content: mail.html,
      mailFormat: "html",
      ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
    },
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

/** Free-form reply inside the 24-hour customer-care window. */
export async function sendMetaText(input: Json, message: { to: string; body: string }) {
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
      type: "text",
      text: { preview_url: false, body: message.body.slice(0, 4096) },
    },
  });
  const messages = (data.messages as Json[] | undefined) ?? [];
  return { id: String(messages[0]?.id ?? ""), provider: "meta" as const };
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

/** Session reply through the AiSensy Project API. Needs the project id and app password. */
export async function sendAiSensySession(input: Json, message: { to: string; body: string }) {
  const projectId = pick(input.aisensyProjectId, "AISENSY_PROJECT_ID");
  const password = pick(input.aisensyAppPassword, "AISENSY_APP_PASSWORD");
  if (!projectId || !password) return null;
  const data = await call(`https://apis.aisensy.com/project-apis/v1/project/${encodeURIComponent(projectId)}/messages`, {
    method: "POST",
    headers: { "X-AiSensy-Project-API-Pwd": password },
    json: {
      to: waCloudTo(message.to),
      type: "text",
      recipient_type: "individual",
      text: { body: message.body.slice(0, 4096) },
    },
  });
  const id = String(data.id ?? (data.messages as Json[] | undefined)?.[0]?.id ?? "");
  return { id, provider: "aisensy" as const };
}

export function metaSignatureOk(raw: string, header: string | null, secret: string) {
  if (!secret) return true;
  if (!header?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  const left = Buffer.from(header);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
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
  /** The courier's own expected delivery date, when it gives one. */
  deliverBy?: string;
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

const shiprocketOrigins = new Map<string, { pins: string[]; at: number }>();

/** Rates must be asked from a pincode Shiprocket has as an active pickup address, or it returns far fewer couriers. */
async function shiprocketOrigin(token: string, wanted: string) {
  let cached = shiprocketOrigins.get(token);
  if (!cached || Date.now() - cached.at > 10 * 60 * 1000) {
    try {
      const data = await call("https://apiv2.shiprocket.in/v1/external/settings/company/pickup", { headers: { authorization: `Bearer ${token}` } });
      const rows = ((data.data as Json)?.shipping_address as Json[]) ?? [];
      const active = rows.filter((row) => Number(row.status ?? 1) === 1);
      const primary = active.filter((row) => Number(row.is_primary_location ?? 0) === 1);
      const pins = [...primary, ...active].map((row) => String(row.pin_code ?? row.pincode ?? "")).filter(Boolean);
      cached = { pins: [...new Set(pins)], at: Date.now() };
      shiprocketOrigins.set(token, cached);
    } catch {
      return wanted;
    }
  }
  return !cached.pins.length || cached.pins.includes(wanted) ? wanted : cached.pins[0];
}

export async function shiprocketRates(input: Json, parcel: Parcel): Promise<RateOut[] | null> {
  const token = await shiprocketToken(input);
  if (!token) return null;
  const params = new URLSearchParams({
    pickup_postcode: await shiprocketOrigin(token, parcel.pickupPincode),
    delivery_postcode: parcel.deliveryPincode,
    weight: String(parcel.weightKg),
    cod: parcel.cod ? "1" : "0",
    declared_value: String(Math.round(parcel.declaredValue)),
    length: String(parcel.length),
    breadth: String(parcel.breadth),
    height: String(parcel.height),
  });
  // Without `mode` Shiprocket returns only its recommended subset, so ask for Surface and Air too and merge.
  const replies = await Promise.allSettled(
    ["", "Surface", "Air"].map((mode) =>
      call(`https://apiv2.shiprocket.in/v1/external/courier/serviceability/?${params}${mode ? `&mode=${mode}` : ""}`, {
        headers: { authorization: `Bearer ${token}` },
      })
    )
  );
  const ok = replies.filter((reply): reply is PromiseFulfilledResult<Json> => reply.status === "fulfilled");
  if (!ok.length) throw (replies[0] as PromiseRejectedResult).reason;
  const byId = new Map<string, Json>();
  for (const reply of ok) {
    for (const courier of ((reply.value.data as Json)?.available_courier_companies as Json[]) ?? []) {
      const id = String(courier.courier_company_id);
      if (!byId.has(id)) byId.set(id, courier);
    }
  }
  const list = [...byId.values()];
  return list.map((courier) => ({
    provider: "shiprocket",
    courierId: String(courier.courier_company_id),
    courierName: String(courier.courier_name),
    rate: Number(courier.rate ?? courier.freight_charge ?? 0),
    etaDays: Number(courier.estimated_delivery_days ?? 5),
    cod: Boolean(courier.cod),
    live: true as const,
    deliverBy: courier.etd ? String(courier.etd) : undefined,
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
  const sheet = await shiprocketLabelSheet(input, shipmentId);
  return sheet ? { labelUrl: sheet.labelUrl ?? "" } : null;
}

export type LabelSheet = {
  labelUrl?: string;
  routingCode?: string;
  destination?: string;
  courierName?: string;
  awb?: string;
};

function labelText(source: Json, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim() && value !== "null" && value !== "undefined") return value.trim();
  }
  return "";
}

function labelSheetFrom(source: Json | null | undefined): LabelSheet {
  if (!source) return {};
  const nested = source.data && typeof source.data === "object" ? (source.data as Json) : source;
  const directUrl = typeof source.data === "string" ? source.data : "";
  const track = (nested.tracking_data as Json) ?? nested;
  const row = (Array.isArray(track.shipment_track) ? (track.shipment_track[0] as Json) : track) ?? nested;
  const bag = { ...nested, ...row };
  return {
    labelUrl: directUrl || labelText(bag, ["label_url", "label", "pdf_url", "pdf", "shipping_label"]),
    routingCode: labelText(bag, ["routing_code", "routingCode", "route_code", "sort_code"]),
    destination: labelText(bag, ["destination", "destination_hub", "destination_code"]),
    courierName: labelText(bag, ["courier_name", "courier", "courierName"]),
    awb: labelText(bag, ["awb", "awb_code", "awb_number", "awbNumber"]),
  };
}

/** Shiprocket label PDF plus the routing code printed on that label. */
export async function shiprocketLabelSheet(input: Json, shipmentId: string, awb = ""): Promise<LabelSheet | null> {
  const token = await shiprocketToken(input);
  if (!token) return null;
  const headers = { authorization: `Bearer ${token}` };
  let sheet: LabelSheet = {};
  if (awb) {
    try {
      const tracked = await call(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${encodeURIComponent(awb)}`, { headers });
      sheet = labelSheetFrom(tracked);
    } catch {
      /* the generate call below can still return a label */
    }
  }
  if (shipmentId) {
    try {
      const data = await call("https://apiv2.shiprocket.in/v1/external/courier/generate/label", {
        method: "POST",
        headers,
        json: { shipment_id: [Number(shipmentId)] },
      });
      const generated = labelSheetFrom(data);
      sheet = { ...sheet, ...Object.fromEntries(Object.entries(generated).filter(([, value]) => value)) };
    } catch (error) {
      if (!sheet.routingCode && !sheet.labelUrl) throw error;
    }
    try {
      const details = await call(`https://apiv2.shiprocket.in/v1/external/shipments/${encodeURIComponent(shipmentId)}`, { headers });
      const extra = labelSheetFrom(details);
      sheet = { ...extra, ...Object.fromEntries(Object.entries(sheet).filter(([, value]) => value)) };
    } catch {
      /* routing is optional */
    }
  }
  return sheet;
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

/** Courier clocks are India time unless the value already carries a zone. A value with a clock wins over a date alone. */
function expectedBy(...values: unknown[]): string | undefined {
  const formatted: { text: string; timed: boolean }[] = [];
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (!text || text === "null" || text === "undefined" || text === "0") continue;
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
    const clock = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(text) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(text);
    let parsed = Number.NaN;
    if (dateOnly) parsed = Date.parse(`${text}T12:00:00+05:30`);
    else if (clock) {
      const iso = text.replace(" ", "T");
      parsed = Date.parse(iso.length === 16 ? `${iso}:00+05:30` : `${iso}+05:30`);
    } else parsed = Date.parse(text);
    if (!Number.isFinite(parsed)) continue;
    const timed = !dateOnly && (clock || /[T ]\d{2}:\d{2}/.test(text) || /\d:\d{2}/.test(text));
    formatted.push({
      timed,
      text: new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        day: "numeric",
        month: "short",
        ...(timed ? { hour: "numeric", minute: "2-digit" } : { year: "numeric" }),
      }).format(new Date(parsed)),
    });
  }
  return formatted.find((item) => item.timed)?.text ?? formatted[0]?.text;
}

function clockFields(value: unknown, found: string[] = [], depth = 0): string[] {
  if (depth > 5 || value == null) return found;
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 4)) clockFields(item, found, depth + 1);
    return found;
  }
  if (typeof value !== "object") return found;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/history|scans|activities|shipment_track_activities|task_history/i.test(key)) continue;
    if (/(^edd$|^etd$|expected|promised|estimated|delivery_date|deliverydate|delivery_time|deliverytime|job_delivery_datetime)/i.test(key) && !/delivered|picked|created|updated/i.test(key)) {
      if (typeof child === "string" || typeof child === "number") found.push(String(child));
    } else if (child && typeof child === "object") clockFields(child, found, depth + 1);
  }
  return found;
}

function promisedFrom(payload: unknown, ...first: unknown[]) {
  return expectedBy(...first, ...clockFields(payload));
}

/** Agent name, phone, OTP and GPS when the courier portal sends them (Shiprocket hyperlocal, Porter, and the others). */
function riderFrom(payload: unknown) {
  const found = { name: "", phone: "", otp: "", lat: undefined as number | undefined, lng: undefined as number | undefined };
  const walk = (value: unknown, depth: number) => {
    if (depth > 6 || value == null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 6)) walk(item, depth + 1);
      return;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const k = key.toLowerCase();
      if (typeof child === "string" || typeof child === "number") {
        const text = String(child).trim();
        if (!text || text === "null" || text === "undefined") continue;
        if (!found.name && /(rider|agent|driver|delivery_boy|fe)_?name$/.test(k) && /[a-z]/i.test(text)) found.name = text;
        if (!found.phone && /(rider|agent|driver|delivery_boy|fe)_?(phone|mobile|contact)$/.test(k)) found.phone = text;
        if (!found.otp && /(delivery_otp|^otp$|door_code|verification_code)/.test(k) && /^\d{4,8}$/.test(text)) found.otp = text;
        if (found.lat == null && /(rider|agent|driver|fe)_?lat(itude)?$/.test(k)) {
          const n = Number(text);
          if (Math.abs(n) > 0.01) found.lat = n;
        }
        if (found.lng == null && /(rider|agent|driver|fe)_?(lng|long|longitude)$/.test(k)) {
          const n = Number(text);
          if (Math.abs(n) > 0.01) found.lng = n;
        }
      } else walk(child, depth + 1);
    }
  };
  walk(payload, 0);
  return found;
}

function riderHit(payload: unknown, status: string) {
  const rider = riderFrom(payload);
  const moving = /picked up|out for|in transit|on the way|started|deliver/i.test(status);
  return {
    agentName: rider.name,
    agentPhone: rider.phone,
    otp: rider.otp,
    lat: rider.lat,
    lng: rider.lng,
    accepted: rider.name ? true : undefined,
    agentLeg: (moving ? "delivery" : "pickup") as "delivery" | "pickup",
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
  const trackRow = ((tracking.shipment_track as Json[]) ?? [])[0] ?? {};
  return {
    status: String(trackRow.current_status ?? tracking.shipment_status ?? ""),
    courierName: String(trackRow.courier_name ?? ""),
    awb: String(trackRow.awb_code ?? awb),
    events: activities.map((activity) => ({ at: String(activity.date), status: String(activity.activity), location: String(activity.location ?? "") })),
    trackingUrl: String(tracking.track_url ?? `https://shiprocket.co/tracking/${awb}`),
    expectedBy: promisedFrom(data, trackRow.edd, trackRow.etd, tracking.edd, tracking.etd),
    ...riderHit(data, String(trackRow.current_status ?? tracking.shipment_status ?? "")),
  };
}

export async function shiprocketWallet(input: Json) {
  const token = await shiprocketToken(input);
  if (!token) return null;
  const data = await call("https://apiv2.shiprocket.in/v1/external/account/details/wallet-balance", {
    headers: { authorization: `Bearer ${token}` },
  });
  const nested = (data.data as Json) ?? data;
  const balance = Number(nested.balance_amount ?? nested.balance ?? nested.wallet_balance ?? 0);
  return { provider: "shiprocket", balance, currency: "INR" };
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
    courierName: String(shipment.courier_name ?? shipment.courier ?? ""),
    awb,
    events: history.map((event) => ({ at: String(event.event_time), status: String(event.message ?? event.status_code), location: String(event.location ?? "") })),
    trackingUrl: String(shipment.tracking_url ?? `https://ship.nimbuspost.com/?awb=${awb}`),
    expectedBy: promisedFrom(data, shipment.edd, shipment.expected_delivery_date, shipment.expected_delivery, shipment.delivery_date),
    ...riderHit(data, String(shipment.status ?? "")),
  };
}

export async function nimbusWallet(input: Json) {
  const token = await nimbusToken(input);
  if (!token) return null;
  const data = await call("https://api.nimbuspost.com/v1/wallet", {
    headers: { authorization: `Bearer ${token}` },
  });
  const nested = (data.data as Json) ?? data;
  const balance = Number(nested.balance ?? nested.wallet_balance ?? nested.amount ?? 0);
  return { provider: "nimbuspost", balance, currency: "INR" };
}

export async function nimbusLabel(input: Json, awb: string): Promise<LabelSheet | null> {
  const token = await nimbusToken(input);
  if (!token) return null;
  const headers = { authorization: `Bearer ${token}` };
  const data = await call("https://api.nimbuspost.com/v1/shipments/label", {
    method: "POST",
    headers,
    json: { awbs: [awb] },
  });
  let sheet = labelSheetFrom(data);
  try {
    const tracked = await call(`https://api.nimbuspost.com/v1/shipments/track/${encodeURIComponent(awb)}`, { headers });
    const extra = labelSheetFrom(tracked);
    sheet = { ...extra, ...Object.fromEntries(Object.entries(sheet).filter(([, value]) => value)) };
  } catch {
    /* the label URL is the part the desk needs */
  }
  if (!sheet.awb) sheet.awb = awb;
  return sheet;
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
    courierName: "Gogate Products-Shipday",
    providerOrderId: String(data.orderId ?? ""),
  };
}

function shipdayAuth(apiKey: string) {
  return { authorization: `Basic ${apiKey}` };
}

/** Gogate Products on Shipday. deliveryAt is an India wall clock, YYYY-MM-DD HH:MM:SS. */
export async function shipdayReschedule(input: Json, orderId: string, deliveryAt: string) {
  const apiKey = pick(input.apiKey, "SHIPDAY_API_KEY");
  if (!apiKey) return null;
  const [date, time] = deliveryAt.split(" ");
  const data = await call(`https://api.shipday.com/order/edit/${encodeURIComponent(orderId)}`, {
    method: "PUT",
    headers: shipdayAuth(apiKey),
    json: {
      expectedDeliveryDate: date,
      expectedDeliveryTime: time,
    },
  });
  if (data.success === false) throw new ProviderError(String(data.response ?? "Shipday could not reschedule the delivery."));
  return { updated: true };
}

function shipdayOrders(data: unknown): Json[] {
  if (Array.isArray(data)) return data as Json[];
  const wrapped = data as Json;
  if (Array.isArray(wrapped.orders)) return wrapped.orders as Json[];
  if (wrapped && typeof wrapped === "object") return [wrapped];
  return [];
}

export async function shipdayTrack(input: Json, orderNumber: string, providerOrderId = "") {
  const apiKey = pick(input.apiKey, "SHIPDAY_API_KEY");
  if (!apiKey) return null;
  let match: Json | null = null;
  for (const id of shipdayLookupIds(orderNumber, providerOrderId)) {
    try {
      const one = await call(`https://api.shipday.com/orders/${encodeURIComponent(id)}`, { headers: shipdayAuth(apiKey) });
      match = shipdayOrderRow(one) as Json | null;
      if (match) break;
    } catch {
      /* the numeric Shipday id is not the lookup key; try the order number */
    }
  }
  if (!match) {
    try {
      const data = await call("https://api.shipday.com/orders", { headers: shipdayAuth(apiKey) });
      const wanted = new Set(shipdayLookupIds(orderNumber, providerOrderId));
      match =
        shipdayOrders(data).find((order) => wanted.has(String(order.orderId)) || wanted.has(String(order.orderNumber)) || wanted.has(String(order.id))) ??
        null;
    } catch {
      match = null;
    }
  }
  if (!match) {
    return { status: "Not found", events: [] as { at: string; status: string; location: string }[] };
  }
  const status = shipdayOrderState(match);
  const carrier = (match.assignedCarrier as Json | undefined) ?? (match.carrier as Json | undefined) ?? {};
  const carrierName = String(carrier.name ?? "");
  const lat = Number(match.carrierLatitude ?? match.latitude ?? carrier.latitude);
  const lng = Number(match.carrierLongitude ?? match.longitude ?? carrier.longitude);
  const pickupLat = Number(match.pickupLatitude ?? match.restaurantLatitude ?? (match.restaurant as Json | undefined)?.latitude);
  const pickupLng = Number(match.pickupLongitude ?? match.restaurantLongitude ?? (match.restaurant as Json | undefined)?.longitude);
  const dropLat = Number(match.deliveryLatitude ?? match.customerLatitude ?? (match.delivery as Json | undefined)?.latitude);
  const dropLng = Number(match.deliveryLongitude ?? match.customerLongitude ?? (match.delivery as Json | undefined)?.longitude);
  const feed = shipdayActivity(match).filter((entry) => entry.status);
  if (status && !feed.some((entry) => entry.status.toLowerCase() === status.toLowerCase())) {
    feed.push({ at: new Date().toISOString(), status, location: "" });
  }
  const delivered = /\b(already delivered|delivered|successful|completed)\b/.test(status.toLowerCase().replace(/[_-]+/g, " "));
  return {
    status,
    courierName: "Gogate Products-Shipday",
    awb: String(match.orderId ?? (providerOrderId || orderNumber)),
    events: feed.length ? feed : [{ at: new Date().toISOString(), status, location: "" }],
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    agentName: carrierName,
    agentPhone: String(carrier.phoneNumber ?? carrier.phone ?? ""),
    pickupLat: Number.isFinite(pickupLat) ? pickupLat : undefined,
    pickupLng: Number.isFinite(pickupLng) ? pickupLng : undefined,
    dropLat: Number.isFinite(dropLat) ? dropLat : undefined,
    dropLng: Number.isFinite(dropLng) ? dropLng : undefined,
    trackingUrl: String(match.trackingLink ?? match.trackingUrl ?? ""),
    expectedBy: delivered ? "" : promisedFrom(match, match.expectedDeliveryDate, match.expectedDeliveryTime, match.etaTime, match.deliveryTime, match.expected_delivery),
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

/** Tookan's message, plus what to do when no hub covers the address. */
function tookanError(data: Json, fallback: string) {
  const message = String(data.message ?? fallback);
  return /hub/i.test(message)
    ? `${message}. No Tookan hub covers this address: in Tookan, open Hubs and add a hub (linked to your team) whose radius covers the pickup and delivery pincodes.`
    : message;
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
            barcode: order.orderId,
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
            barcode: order.orderId,
          },
        ],
      },
    });
    if (Number(data.status) !== 200) throw new ProviderError(tookanError(data, "Tookan did not create the parcel task."));
    const task = (data.data as Json) ?? {};
    return {
      provider: "tookan-parcel",
      awb: String(task.delivery_job_id ?? task.job_id ?? ""),
      courierName: "Gogate Products-Tookan",
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
      has_pickup: 1,
      has_delivery: 1,
      layout_type: 0,
      tracking_link: 1,
      timezone: -330,
    },
  });
  if (Number(data.status) !== 200) throw new ProviderError(tookanError(data, "Tookan did not create the hyperlocal task."));
  const task = (data.data as Json) ?? {};
  const pickupId = String(task.pickup_job_id ?? task.job_id ?? "");
  const deliveryId = String(task.delivery_job_id ?? task.job_id ?? "");
  return {
    provider: "tookan",
    awb: deliveryId || pickupId,
    courierName: "Gogate Products-Tookan",
    providerOrderId: pickupId || deliveryId,
    providerShipmentId: deliveryId,
    trackingUrl: String(task.delivery_tracing_link ?? task.tracking_link ?? ""),
    pickupScheduledFor: pickupAt,
  };
}

export async function tookanTrack(input: Json, jobId: string, extraId = "") {
  const apiKey = pick(input.apiKey, "TOOKAN_API_KEY");
  if (!apiKey) return null;
  const ids = [...new Set([jobId, extraId].map((id) => id.trim()).filter(Boolean))];
  const jobs: Json[] = [];
  for (const id of ids) {
    const data = await call("https://api.tookanapp.com/v2/get_job_details", {
      method: "POST",
      json: { api_key: apiKey, job_ids: [Number(id) || id], include_task_history: 1 },
    });
    const job = ((data.data as Json[]) ?? [])[0];
    if (job) jobs.push(job);
  }
  const coord = (value: number) => (Number.isFinite(value) && Math.abs(value) > 0.001 ? value : undefined);
  const details = jobs.map((job) => {
    const code = Number(job.job_status ?? job.status);
    const fleet = (job.fleet as Json) ?? {};
    const pickupTask = Number(job.job_type) === 0;
    return { job, code, fleet, pickupTask };
  });
  const pickup = details.find((item) => item.pickupTask) ?? null;
  const delivery = details.find((item) => !item.pickupTask) ?? details[0] ?? null;
  const pickupOpen = Boolean(pickup && pickup.code !== 2 && pickup.code !== 9);
  const active = pickupOpen && pickup ? pickup : delivery;
  const code = active?.code ?? NaN;
  const currentLabel = tookanStatusLabel[code] ?? String(active?.job.job_status ?? active?.job.status ?? "");
  const fleet = active?.fleet ?? {};
  const job = active?.job ?? {};
  const accepted = Boolean(active) && ![6, 8, 9].includes(code) && (Boolean(String(job.fleet_name ?? fleet.name ?? fleet.fleet_name ?? "").trim()) || [0, 1, 4, 7].includes(code));
  const history = details.flatMap((item) =>
    ((item.job.task_history as Json[]) ?? []).map((entry) => ({ entry, pickupTask: item.pickupTask }))
  );
  const storeJob = pickup?.job ?? job;
  const dropSource = delivery?.job ?? job;
  const pickupLat = coord(Number(storeJob.job_pickup_latitude ?? storeJob.pickup_latitude));
  const pickupLng = coord(Number(storeJob.job_pickup_longitude ?? storeJob.pickup_longitude));
  const dropLat = coord(Number(dropSource.job_latitude ?? dropSource.customer_latitude ?? dropSource.delivery_latitude));
  const dropLng = coord(Number(dropSource.job_longitude ?? dropSource.customer_longitude ?? dropSource.delivery_longitude));
  const lat = coord(Number(job.fleet_latitude ?? fleet.latitude));
  const lng = coord(Number(job.fleet_longitude ?? fleet.longitude));
  return {
    status: currentLabel,
    courierName: "Gogate Products-Tookan",
    awb: String(delivery?.job.job_id ?? jobId),
    accepted,
    agentLeg: pickupOpen ? "pickup" : "delivery",
    agentName: accepted ? String(job.fleet_name ?? fleet.name ?? fleet.fleet_name ?? "") : "",
    agentPhone: accepted ? String(job.fleet_phone ?? fleet.phone ?? fleet.fleet_phone ?? job.fleet_mobile ?? "") : "",
    otp: String(job.job_otp ?? job.order_otp ?? delivery?.job.job_otp ?? ""),
    lat: accepted ? lat : undefined,
    lng: accepted ? lng : undefined,
    pickupLat,
    pickupLng,
    dropLat,
    dropLng,
    events: [
      ...history.map(({ entry, pickupTask }) => {
        const entryCode = Number(entry.job_status ?? entry.type);
        const label =
          entryCode === 2 && pickupTask
            ? "Picked up from seller"
            : entryCode === 2
              ? "Delivered"
              : tookanStatusLabel[entryCode] ?? "";
        const text = String(entry.description ?? entry.label ?? entry.status ?? "");
        return {
          at: String(entry.creation_datetime ?? entry.timestamp ?? ""),
          status: [label, text].filter(Boolean).join(" · "),
          location: String(entry.latitude && entry.longitude ? `${entry.latitude},${entry.longitude}` : ""),
        };
      }),
      ...(pickup && pickup.code === 2 ? [{ at: new Date().toISOString(), status: "Picked up from seller", location: "" }] : []),
      ...(currentLabel ? [{ at: new Date().toISOString(), status: currentLabel, location: "" }] : []),
    ],
    trackingUrl: String(job.tracking_link ?? job.delivery_tracing_link ?? delivery?.job.tracking_link ?? ""),
    expectedBy: tookanExpected(dropSource),
  };
}

/** Prefer Tookan's real UTC field. The Z on job_delivery_datetime is the India wall clock. */
function tookanExpected(job: Json) {
  const instant = tookanDeliveryInstant(
    String(job.job_time_utc ?? ""),
    String(job.job_delivery_datetime ?? job.job_time ?? "")
  );
  return instant == null ? undefined : formatIndiaClock(instant);
}

/** Move a Gogate Products Tookan delivery to a new India wall-clock time (YYYY-MM-DD HH:MM:SS). */
export async function tookanReschedule(input: Json, jobId: string, extraId: string, deliveryAt: string) {
  const apiKey = pick(input.apiKey, "TOOKAN_API_KEY");
  if (!apiKey) return null;
  const deliveryId = jobId.trim() || extraId.trim();
  if (!deliveryId) throw new ProviderError("Tookan job id is missing.");
  const data = await call("https://api.tookanapp.com/v2/edit_task", {
    method: "POST",
    json: { api_key: apiKey, job_id: Number(deliveryId) || deliveryId, job_delivery_datetime: deliveryAt },
  });
  if (Number(data.status) !== 200) throw new ProviderError(String(data.message ?? "Tookan could not reschedule the delivery."));
  return { updated: true };
}

export async function tookanCancel(input: Json, jobId: string, extraId = "") {
  const apiKey = pick(input.apiKey, "TOOKAN_API_KEY");
  if (!apiKey) return null;
  const ids = [...new Set([jobId, extraId].map((id) => id.trim()).filter(Boolean))];
  for (const id of ids) {
    const data = await call("https://api.tookanapp.com/v2/cancel_task", {
      method: "POST",
      json: { api_key: apiKey, job_id: Number(id) || id, job_status: 9 },
    });
    if (Number(data.status) !== 200) throw new ProviderError(String(data.message ?? "Tookan could not cancel the task."));
  }
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
  return { message: `Connected from this site. Tookan returned ${fleets.length} fleet${fleets.length === 1 ? "" : "s"}. Each booking creates a pickup task and a delivery task.` };
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
    courierName: String(tracking?.logistic_name ?? tracking?.courier_name ?? tracking?.courier ?? ""),
    awb,
    events: scans.map((scan) => ({
      at: String(scan.date ?? scan.time ?? scan.updated_date ?? ""),
      status: String(scan.status ?? scan.activity ?? ""),
      location: String(scan.location ?? scan.city ?? ""),
    })),
    trackingUrl: String(tracking?.tracking_url ?? `https://www.ithinklogistics.com/track-order?awb=${awb}`),
    expectedBy: promisedFrom(tracking, tracking?.expected_delivery_date, tracking?.edd, tracking?.expected_delivery, tracking?.delivery_date),
    ...riderHit(tracking ?? data, String(tracking?.current_status ?? tracking?.status ?? "")),
  };
}

export async function ithinkWallet(input: Json) {
  const auth = ithinkAuth(input);
  if (!auth) return null;
  const data = await ithinkPost("wallet/balance.json", { ...auth });
  const nested = (data.data as Json) ?? data;
  const balance = Number(nested.balance ?? nested.wallet_balance ?? nested.amount ?? nested.credit ?? 0);
  return { provider: "ithink", balance, currency: "INR" };
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
  let labelUrl = "";
  try {
    const label = await call("https://apiv2.shiprocket.in/v1/external/courier/generate/label", {
      method: "POST",
      headers: auth,
      json: { shipment_id: [shipmentId] },
    });
    labelUrl = String(label.label_url ?? "");
  } catch {
    labelUrl = "";
  }
  return {
    provider: "shiprocket",
    awb: String(awbData.awb_code ?? created.awb_code ?? ""),
    labelUrl: labelUrl || undefined,
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

/* ---------------- Shipyaari ---------------- */

async function shipyaariToken(input: Json) {
  const apiKey = pick(input.apiKey, "SHIPYAARI_API_KEY");
  if (apiKey) return apiKey;
  const email = pick(input.email, "SHIPYAARI_EMAIL");
  const password = pick(input.password, "SHIPYAARI_PASSWORD");
  if (!email || !password) return null;
  const data = await call("https://api.shipyaari.com/api/login", {
    method: "POST",
    json: { email, password },
  });
  const token = String(data.token ?? data.access_token ?? (data.data as Json | undefined)?.token ?? "");
  if (!token) throw new ProviderError("Shipyaari rejected the login.");
  return token;
}

function shipyaariAuth(token: string) {
  return { authorization: `Bearer ${token}`, "api-token": token };
}

export async function shipyaariRates(input: Json, parcel: Parcel): Promise<RateOut[] | null> {
  const token = await shipyaariToken(input);
  if (!token) return null;
  try {
    const data = await call("https://api.shipyaari.com/api/v1/rate/check", {
      method: "POST",
      headers: shipyaariAuth(token),
      json: {
        pickup_pincode: parcel.pickupPincode,
        delivery_pincode: parcel.deliveryPincode,
        weight: parcel.weightKg,
        payment_type: parcel.cod ? "cod" : "prepaid",
        order_amount: parcel.declaredValue,
      },
    });
    const rows = (Array.isArray(data.data) ? data.data : Array.isArray(data.rates) ? data.rates : []) as Json[];
    if (rows.length) {
      return rows.map((row) => ({
        provider: "shipyaari",
        courierId: String(row.courier_id ?? row.id ?? "shipyaari"),
        courierName: String(row.courier_name ?? row.name ?? "Shipyaari"),
        rate: Number(row.total_charges ?? row.rate ?? row.freight ?? 0),
        etaDays: Number(row.edd ?? row.tat ?? 4) || 4,
        live: true as const,
      }));
    }
  } catch {
    /* fall through to a live-auth placeholder so booking can still run the wallet gate */
  }
  return [
    {
      provider: "shipyaari",
      courierId: "shipyaari",
      courierName: "Shipyaari",
      rate: 79,
      etaDays: 4,
      live: true as const,
    },
  ];
}

export async function shipyaariBook(input: Json, order: BookInput): Promise<BookOut | null> {
  const token = await shipyaariToken(input);
  if (!token) return null;
  const data = await call("https://api.shipyaari.com/api/v1/order/create", {
    method: "POST",
    headers: shipyaariAuth(token),
    json: {
      order_id: order.orderId,
      payment_type: order.cod ? "cod" : "prepaid",
      order_amount: order.total,
      weight: order.weightKg,
      pickup: {
        name: order.pickup.contactName,
        phone: order.pickup.phone,
        address: order.pickup.line1,
        city: order.pickup.city,
        state: order.pickup.state,
        pincode: order.pickup.pincode,
      },
      delivery: {
        name: order.customer.name,
        phone: order.customer.phone,
        address: order.customer.line1,
        city: order.customer.city,
        state: order.customer.state,
        pincode: order.customer.pincode,
      },
      items: order.items.map((item) => ({ name: item.name, sku: item.sku, quantity: item.units, price: item.price })),
    },
  });
  const nested = (data.data as Json) ?? data;
  const awb = String(nested.awb ?? nested.awb_number ?? nested.tracking_number ?? "");
  if (!awb) throw new ProviderError(String(data.message ?? nested.message ?? "Shipyaari did not assign an AWB. Check the wallet balance."));
  return {
    provider: "shipyaari",
    awb,
    courierName: String(nested.courier_name ?? "Shipyaari"),
    providerOrderId: String(nested.order_id ?? nested.id ?? order.orderId),
    trackingUrl: String(nested.tracking_url ?? `https://shipyaari.com/track/${awb}`),
    courierCost: Number(nested.charges ?? nested.freight ?? 0) || undefined,
  };
}

export async function shipyaariLabel(input: Json, awb: string): Promise<LabelSheet | null> {
  const token = await shipyaariToken(input);
  if (!token) return null;
  const data = await call("https://api.shipyaari.com/api/v1/order/label", {
    method: "POST",
    headers: shipyaariAuth(token),
    json: { awb, awbs: [awb] },
  });
  const sheet = labelSheetFrom(data);
  if (!sheet.awb) sheet.awb = awb;
  return sheet;
}

export async function shipyaariTrack(input: Json, awb: string) {
  const token = await shipyaariToken(input);
  if (!token) return null;
  const data = await call(`https://api.shipyaari.com/api/v1/track/${encodeURIComponent(awb)}`, {
    headers: shipyaariAuth(token),
  });
  const nested = (data.data as Json) ?? data;
  const history = (nested.history as Json[]) ?? (nested.scans as Json[]) ?? [];
  return {
    status: String(nested.status ?? nested.current_status ?? ""),
    courierName: String(nested.courier_name ?? nested.courier ?? ""),
    awb,
    events: history.map((entry) => ({
      at: String(entry.time ?? entry.date ?? ""),
      status: String(entry.status ?? entry.activity ?? ""),
      location: String(entry.location ?? ""),
    })),
    trackingUrl: String(nested.tracking_url ?? `https://shipyaari.com/track/${awb}`),
    expectedBy: promisedFrom(data, nested.expected_delivery_date, nested.edd, nested.eta, nested.expected_delivery),
    ...riderHit(data, String(nested.status ?? nested.current_status ?? "")),
  };
}

export async function shipyaariCancel(input: Json, awb: string) {
  const token = await shipyaariToken(input);
  if (!token) return null;
  await call("https://api.shipyaari.com/api/v1/order/cancel", {
    method: "POST",
    headers: shipyaariAuth(token),
    json: { awb },
  });
  return { cancelled: true };
}

export async function shipyaariWallet(input: Json) {
  const token = await shipyaariToken(input);
  if (!token) return null;
  const data = await call("https://api.shipyaari.com/api/v1/wallet", { headers: shipyaariAuth(token) });
  const nested = (data.data as Json) ?? data;
  const balance = Number(nested.balance ?? nested.wallet_balance ?? nested.credits ?? nested.amount ?? 0);
  return { provider: "shipyaari", balance, currency: "INR" };
}

export async function shipyaariTest(input: Json) {
  const wallet = await shipyaariWallet(input);
  if (!wallet) return null;
  return { message: `Connected. Shipyaari wallet ₹${wallet.balance}.` };
}

function msg91Mobile(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export async function sendMsg91Sms(
  creds: Json,
  input: { to: string; body: string; otp?: string }
) {
  const authkey = pick(creds.msg91AuthKey, "MSG91_AUTH_KEY") || pick(creds.authkey, "MSG91_AUTHKEY");
  if (!authkey) return null;
  const mobile = msg91Mobile(input.to);
  const sender = pick(creds.msg91SenderId, "MSG91_SENDER_ID") || "VGMFIN";
  const templateId = pick(creds.msg91TemplateId, "MSG91_TEMPLATE_ID");
  if (input.otp) {
    const data = await call("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: { authkey, accept: "application/json" },
      json: {
        template_id: templateId || undefined,
        mobile,
        otp: input.otp,
        sender,
        otp_expiry: 10,
      },
    });
    return { id: String(data.message ?? data.request_id ?? "msg91-otp") };
  }
  const params = new URLSearchParams({
    authkey,
    mobiles: mobile,
    message: input.body.slice(0, 1000),
    sender,
    route: "4",
    country: "91",
  });
  if (templateId) params.set("DLT_TE_ID", templateId);
  const data = await call(`https://control.msg91.com/api/sendhttp.php?${params.toString()}`, {
    method: "GET",
    headers: { accept: "application/json" },
  });
  return { id: String(data.message ?? data.request_id ?? "msg91") };
}

