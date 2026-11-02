import { createHash } from "node:crypto";
import type { HostedGatewayId } from "@/lib/integrations";
import { gatewayCreds, type VaultGateway } from "@/lib/server/payment-vault";

export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
  }
}

type StartInput = {
  gateway: HostedGatewayId;
  amount: number;
  orderId: string;
  name: string;
  email: string;
  phone: string;
  product: string;
  returnUrl: string;
};

export type HostedStart =
  | { kind: "redirect"; url: string }
  | { kind: "form"; url: string; fields: Record<string, string> }
  | { kind: "cashfree"; session: string; mode: "test" | "live" };

function sha512(value: string) {
  return createHash("sha512").update(value).digest("hex");
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function money(amount: number) {
  return Math.max(0, amount).toFixed(2);
}

function payuHash(creds: VaultGateway, fields: { txnid: string; amount: string; productinfo: string; firstname: string; email: string }) {
  return sha512(`${creds.key}|${fields.txnid}|${fields.amount}|${fields.productinfo}|${fields.firstname}|${fields.email}|||||||||||${creds.salt}`);
}

function easebuzzBase(mode: VaultGateway["mode"]) {
  return mode === "live" ? "https://pay.easebuzz.in" : "https://testpay.easebuzz.in";
}

function cashfreeBase(mode: VaultGateway["mode"]) {
  return mode === "live" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
}

function phonepeBase(mode: VaultGateway["mode"]) {
  return mode === "live" ? "https://api.phonepe.com/apis/hermes" : "https://api-preprod.phonepe.com/apis/pg-sandbox";
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return { raw: text.slice(0, 180) };
  }
}

export async function startHostedPayment(input: StartInput): Promise<HostedStart> {
  const creds = gatewayCreds(input.gateway);
  if (!creds) throw new PaymentError("This payment method is not switched on yet.");
  const amount = money(input.amount);
  const firstname = input.name.trim().slice(0, 60) || "Customer";
  const email = input.email.trim() || "care@vaidyagogate.org";
  const phone = input.phone.replace(/\D/g, "").slice(-10) || "9999999999";
  const product = input.product.slice(0, 100) || "Foundation shop order";

  if (input.gateway === "payu") {
    const fields = {
      key: creds.key,
      txnid: input.orderId,
      amount,
      productinfo: product,
      firstname,
      email,
      phone,
      surl: input.returnUrl,
      furl: input.returnUrl,
      hash: payuHash(creds, { txnid: input.orderId, amount, productinfo: product, firstname, email }),
    };
    return { kind: "form", url: creds.mode === "live" ? "https://secure.payu.in/_payment" : "https://test.payu.in/_payment", fields };
  }

  if (input.gateway === "easebuzz") {
    const hash = sha512(`${creds.key}|${input.orderId}|${amount}|${product}|${firstname}|${email}|||||||||||${creds.salt}`);
    const body = new URLSearchParams({
      key: creds.key,
      txnid: input.orderId,
      amount,
      productinfo: product,
      firstname,
      phone,
      email,
      surl: input.returnUrl,
      furl: input.returnUrl,
      hash,
    });
    const response = await fetch(`${easebuzzBase(creds.mode)}/payment/initiateLink`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(20000),
    });
    const data = await readJson(response);
    const access = String(data.data || "");
    if (!response.ok || data.status !== 1 || !access) throw new PaymentError("Easebuzz did not open the payment.");
    return { kind: "redirect", url: `${easebuzzBase(creds.mode)}/pay/${access}` };
  }

  if (input.gateway === "cashfree") {
    const response = await fetch(`${cashfreeBase(creds.mode)}/orders`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-version": "2023-08-01",
        "x-client-id": creds.key,
        "x-client-secret": creds.salt,
      },
      body: JSON.stringify({
        order_id: input.orderId,
        order_amount: Number(amount),
        order_currency: "INR",
        customer_details: { customer_id: input.orderId, customer_phone: phone, customer_email: email, customer_name: firstname },
        order_meta: { return_url: `${input.returnUrl}${input.returnUrl.includes("?") ? "&" : "?"}order_id=${input.orderId}` },
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await readJson(response);
    const session = String(data.payment_session_id || "");
    if (!response.ok || !session) throw new PaymentError("Cashfree did not open the payment.");
    return { kind: "cashfree", session, mode: creds.mode };
  }

  const payload = Buffer.from(JSON.stringify({
    merchantId: creds.merchantId,
    merchantTransactionId: input.orderId,
    merchantUserId: phone,
    amount: Math.round(Number(amount) * 100),
    redirectUrl: input.returnUrl,
    redirectMode: "POST",
    paymentInstrument: { type: "PAY_PAGE" },
  })).toString("base64");
  const path = "/pg/v1/pay";
  const checksum = `${sha256(payload + path + creds.salt)}###${creds.saltIndex || "1"}`;
  const response = await fetch(`${phonepeBase(creds.mode)}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-VERIFY": checksum },
    body: JSON.stringify({ request: payload }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await readJson(response);
  const nested = (data.data && typeof data.data === "object" ? data.data : {}) as Record<string, unknown>;
  const instrument = (nested.instrumentResponse && typeof nested.instrumentResponse === "object" ? nested.instrumentResponse : {}) as Record<string, unknown>;
  const redirect = (instrument.redirectInfo && typeof instrument.redirectInfo === "object" ? instrument.redirectInfo : {}) as Record<string, unknown>;
  const url = String(redirect.url || "");
  if (!response.ok || !url) throw new PaymentError("PhonePe did not open the payment.");
  return { kind: "redirect", url };
}

export async function pollHostedPayment(gateway: HostedGatewayId, orderId: string): Promise<"confirmed" | "failed" | "holding"> {
  const creds = gatewayCreds(gateway);
  if (!creds || !orderId) return "holding";
  try {
    if (gateway === "cashfree") {
      const response = await fetch(`${cashfreeBase(creds.mode)}/orders/${encodeURIComponent(orderId)}`, {
        headers: { "x-api-version": "2023-08-01", "x-client-id": creds.key, "x-client-secret": creds.salt },
        signal: AbortSignal.timeout(20000),
      });
      const data = await readJson(response);
      const status = String(data.order_status || "").toUpperCase();
      if (status === "PAID") return "confirmed";
      if (status === "EXPIRED" || status === "TERMINATED") return "failed";
      return "holding";
    }
    if (gateway === "phonepe") {
      const path = `/pg/v1/status/${creds.merchantId}/${orderId}`;
      const checksum = `${sha256(path + creds.salt)}###${creds.saltIndex || "1"}`;
      const response = await fetch(`${phonepeBase(creds.mode)}${path}`, {
        headers: { "content-type": "application/json", "X-VERIFY": checksum, "X-MERCHANT-ID": creds.merchantId },
        signal: AbortSignal.timeout(20000),
      });
      const data = await readJson(response);
      const code = String(data.code || "");
      if (code === "PAYMENT_SUCCESS") return "confirmed";
      if (code === "PAYMENT_ERROR" || code === "PAYMENT_DECLINED") return "failed";
      return "holding";
    }
    if (gateway === "payu") {
      const command = "verify_payment";
      const hash = sha512(`${creds.key}|${command}|${orderId}|${creds.salt}`);
      const response = await fetch(creds.mode === "live" ? "https://info.payu.in/merchant/postservice.php" : "https://test.payu.in/merchant/postservice.php", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ key: creds.key, command, var1: orderId, hash }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await readJson(response);
      const details = (data.transaction_details && typeof data.transaction_details === "object" ? data.transaction_details : {}) as Record<string, unknown>;
      const row = (details[orderId] && typeof details[orderId] === "object" ? details[orderId] : {}) as Record<string, unknown>;
      const status = String(row.status || "").toLowerCase();
      if (status === "success") return "confirmed";
      if (status === "failure" || status === "failed") return "failed";
      return "holding";
    }
    const hash = sha512(`${creds.key}|${orderId}|${creds.salt}`);
    const response = await fetch(creds.mode === "live" ? "https://dashboard.easebuzz.in/transaction/v1/retrieve" : "https://testdashboard.easebuzz.in/transaction/v1/retrieve", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ key: creds.key, txnid: orderId, hash }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await readJson(response);
    const nested = (data.msg && typeof data.msg === "object" ? data.msg : data) as Record<string, unknown>;
    const status = String(nested.status || data.status || "").toLowerCase();
    if (status === "success") return "confirmed";
    if (status === "failure" || status === "failed" || status === "usercancelled") return "failed";
    return "holding";
  } catch {
    return "holding";
  }
}

export async function verifyHostedReturn(gateway: HostedGatewayId, fields: Record<string, string>) {
  const creds = gatewayCreds(gateway);
  if (!creds) return { ok: false, orderId: fields.txnid || fields.order_id || fields.transactionId || "" };
  if (gateway === "payu" || gateway === "easebuzz") {
    const status = (fields.status || "").toLowerCase();
    const posted = (fields.hash || "").toLowerCase();
    const reverse = sha512(`${creds.salt}|${fields.status}|||||||||||${fields.email}|${fields.firstname}|${fields.productinfo}|${fields.amount}|${fields.txnid}|${creds.key}`);
    const paid = (status === "success" || status === "captured") && posted === reverse;
    return { ok: paid, orderId: fields.txnid || "", paymentId: fields.mihpayid || fields.easepayid || fields.txnid || "" };
  }
  if (gateway === "cashfree") {
    const orderId = fields.order_id || fields.orderId || "";
    const response = await fetch(`${cashfreeBase(creds.mode)}/orders/${encodeURIComponent(orderId)}`, {
      headers: { "x-api-version": "2023-08-01", "x-client-id": creds.key, "x-client-secret": creds.salt },
      signal: AbortSignal.timeout(20000),
    });
    const data = await readJson(response);
    return { ok: response.ok && String(data.order_status || "") === "PAID", orderId, paymentId: String(data.cf_order_id || orderId) };
  }
  const orderId = fields.transactionId || fields.merchantTransactionId || fields.orderId || "";
  const path = `/pg/v1/status/${creds.merchantId}/${orderId}`;
  const checksum = `${sha256(path + creds.salt)}###${creds.saltIndex || "1"}`;
  const response = await fetch(`${phonepeBase(creds.mode)}${path}`, {
    headers: { "content-type": "application/json", "X-VERIFY": checksum, "X-MERCHANT-ID": creds.merchantId },
    signal: AbortSignal.timeout(20000),
  });
  const data = await readJson(response);
  const code = String(data.code || "");
  return { ok: response.ok && code === "PAYMENT_SUCCESS", orderId, paymentId: orderId };
}
