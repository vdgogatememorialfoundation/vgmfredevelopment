import type { Order } from "@/types";
import { getIntegrations, paytmKeys, razorpayKeys } from "@/lib/integrations";
import { getOrder, patchOrder, recordPayment, refundOrder, sendEmail } from "@/lib/admin-store";

type RazorpayResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, handler: (response: unknown) => void) => void };
  }
}

async function api<T>(body: Record<string, unknown>): Promise<T & { ok: boolean; configured?: boolean; error?: string }> {
  const keys = razorpayKeys();
  const response = await fetch("/api/payments/razorpay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ keyId: keys.keyId, keySecret: keys.keySecret, ...body }),
  });
  return response.json();
}

async function paytmApi<T>(body: Record<string, unknown>): Promise<T & { ok: boolean; configured?: boolean; error?: string }> {
  const keys = paytmKeys();
  const response = await fetch("/api/payments/paytm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...keys, ...body }),
  });
  return response.json();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function simulatePayment(): CheckoutOutcome {
  return { kind: "demo", paymentId: `pay_demo_${Date.now()}`, live: false };
}

export function paymentMode() {
  return getIntegrations().razorpay.mode;
}

/** Mode note for screens a customer sees; visitors without saved settings follow the host keys, so no note. */
export function paymentNotice() {
  if (typeof window === "undefined" || !window.localStorage.getItem("vgmf_integrations")) return "";
  const mode = paymentMode();
  if (mode === "demo") return "Demo mode: the payment is simulated and no money is charged.";
  if (mode === "test") return "Razorpay test mode: use Razorpay test cards or UPI test IDs.";
  return "";
}

function loadCheckoutScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Razorpay checkout could not load."));
    document.body.appendChild(script);
  });
}

export type CheckoutOutcome =
  | { kind: "paid"; paymentId: string; razorpayOrderId: string; live: true }
  | { kind: "demo"; paymentId: string; live: false };

/** Opens Razorpay Checkout in test/live mode; demo mode returns a simulated payment id. */
export async function payWithRazorpay(input: {
  amount: number;
  receipt: string;
  name: string;
  email?: string;
  phone?: string;
  description: string;
  method?: "upi" | "card";
  /** POS always tries to create a Razorpay order, even if this browser is in demo mode. */
  skipDemo?: boolean;
}): Promise<CheckoutOutcome> {
  const simulate = async (): Promise<CheckoutOutcome> => {
    await sleep(900);
    return simulatePayment();
  };
  // A visitor's browser has no saved admin settings; the host's env keys decide whether checkout is live.
  const hasLocalSettings = Boolean(window.localStorage.getItem("vgmf_integrations"));
  if (paymentMode() === "demo" && hasLocalSettings && !input.skipDemo) return simulate();
  const order = await api<{ orderId: string; keyId: string }>({ action: "order", amount: input.amount, receipt: input.receipt });
  if (!order.ok && order.configured === false && (!hasLocalSettings || paymentMode() === "demo")) return simulate();
  if (!order.ok) {
    if (order.configured === false) {
      throw new Error("Razorpay keys are missing for this mode. Add them in Settings → Payments, or switch to demo mode.");
    }
    throw new Error(order.error ?? "Razorpay could not create the payment.");
  }
  await loadCheckoutScript();
  const methodBlock =
    input.method === "upi"
      ? {
          display: {
            blocks: { upi: { name: "Pay via UPI", instruments: [{ method: "upi" }] } },
            hide: [{ method: "upi", flows: ["collect"] }],
            sequence: ["block.upi"],
            preferences: { show_default_blocks: false },
          },
        }
      : input.method === "card"
        ? {
            display: {
              blocks: { cards: { name: "Pay via card", instruments: [{ method: "card" }] } },
              sequence: ["block.cards"],
              preferences: { show_default_blocks: false },
            },
          }
        : undefined;
  const response = await new Promise<RazorpayResponse>((resolve, reject) => {
    const checkout = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: Math.round(input.amount * 100),
      currency: "INR",
      name: "Vaidya Gogate Memorial Foundation",
      description: input.description,
      prefill: { name: input.name, email: input.email, contact: input.phone, method: input.method },
      config: methodBlock,
      theme: { color: "#0B1F3A" },
      handler: (result: RazorpayResponse) => resolve(result),
      modal: { ondismiss: () => reject(new Error("Payment window closed before paying.")) },
    });
    checkout.on("payment.failed", (failure) => {
      const error = (failure as { error?: { description?: string } }).error;
      reject(new Error(error?.description ?? "Payment failed."));
    });
    checkout.open();
  });
  const verified = await api<{ verified: boolean }>({
    action: "verify",
    orderId: response.razorpay_order_id,
    paymentId: response.razorpay_payment_id,
    signature: response.razorpay_signature,
  });
  if (!verified.ok || !verified.verified) throw new Error("Payment signature could not be verified. Do not ship until Razorpay shows it captured.");
  return { kind: "paid", paymentId: response.razorpay_payment_id, razorpayOrderId: response.razorpay_order_id, live: true };
}

function encodeSummary(order: Order) {
  const summary = {
    id: order.id,
    amount: order.total,
    name: order.deliveryAddress?.fullName ?? "",
    email: order.deliveryAddress?.email ?? "",
    phone: order.deliveryAddress?.phone ?? "",
    items: order.items.map((item) => `${item.quantity} × ${item.title}`),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(summary));
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeSummary(value: string) {
  try {
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as { id: string; amount: number; name: string; email: string; phone: string; items: string[] };
  } catch {
    return null;
  }
}

/** Razorpay Payment Link in test/live mode, otherwise a /pay link on this site. */
export async function createPaymentLink(orderId: string) {
  const order = getOrder(orderId);
  if (!order) throw new Error("Order not found.");
  const settings = getIntegrations();
  let link: NonNullable<Order["paymentLink"]>;
  if (settings.razorpay.mode === "demo") {
    link = {
      url: `${window.location.origin}/pay/${order.id}?d=${encodeSummary(order)}`,
      provider: "demo",
      createdAt: new Date().toISOString(),
    };
  } else {
    const result = await api<{ id: string; url: string }>({
      action: "link",
      amount: order.total,
      orderId: order.id,
      name: order.deliveryAddress?.fullName ?? "Customer",
      email: order.deliveryAddress?.email,
      phone: order.deliveryAddress?.phone,
      description: `VGMF order ${order.id}`,
      callbackUrl: `${window.location.origin}/pay/${order.id}?done=1`,
      expiryHours: settings.razorpay.linkExpiryHours,
    });
    if (!result.ok) throw new Error(result.error ?? "Razorpay could not create the payment link.");
    link = { url: result.url, id: result.id, provider: "razorpay", createdAt: new Date().toISOString() };
  }
  patchOrder(order.id, { paymentLink: link, paymentStatus: order.paymentStatus === "Paid" ? "Paid" : "Pending" }, "Payment link created");
  sendEmail({
    to: order.deliveryAddress?.email ?? "",
    phone: order.deliveryAddress?.phone,
    name: order.deliveryAddress?.fullName,
    params: [order.deliveryAddress?.fullName ?? "Customer", order.id, `₹${order.total}`, link.url],
    subject: `Pay for your VGMF order ${order.id}`,
    template: "payment-link",
    body: `Dear ${order.deliveryAddress?.fullName || "Guest"},\n\nNamaste, and greetings from Vaidya Gogate Memorial Foundation.\n\nPlease complete the payment of ₹${order.total.toLocaleString("en-IN")} for order ${order.id}:\n${link.url}\n\nWith warm regards,\nVaidya Gogate Memorial Foundation`,
  });
  return link;
}

export async function refreshPaymentLink(orderId: string) {
  const order = getOrder(orderId);
  if (!order?.paymentLink) throw new Error("This order has no payment link.");
  if (order.paymentLink.provider !== "razorpay" || !order.paymentLink.id) {
    return order.paymentStatus === "Paid" ? "Paid." : "Demo links are marked paid when the customer pays in this browser, or record the payment manually.";
  }
  const result = await api<{ status: string; paymentId?: string }>({ action: "link-status", linkId: order.paymentLink.id });
  if (!result.ok) throw new Error(result.error ?? "Could not read the link status.");
  if (result.status === "paid") {
    recordPayment(order.id, { method: "Razorpay payment link", reference: result.paymentId, razorpayPaymentId: result.paymentId });
    return "Paid on Razorpay. The order is confirmed.";
  }
  return `Razorpay link status: ${result.status}.`;
}

export async function refundThroughGateway(orderId: string, amount?: number) {
  const order = getOrder(orderId);
  if (!order) throw new Error("Order not found.");
  const value = amount ?? order.total;
  if (order.razorpayPaymentId && !order.razorpayPaymentId.startsWith("pay_demo") && paymentMode() !== "demo") {
    const result = await api<{ refundId: string; status: string }>({ action: "refund", paymentId: order.razorpayPaymentId, amount: value });
    if (!result.ok) throw new Error(result.error ?? "Razorpay refused the refund.");
    refundOrder(order.id, value, `Razorpay refund ${result.refundId} (${result.status})`);
    return `Refund ${result.refundId} created on Razorpay.`;
  }
  refundOrder(order.id, value, order.razorpayPaymentId ? "Demo refund" : "Refund recorded");
  return order.razorpayPaymentId ? "Demo refund recorded." : "Refund recorded. Pay it back through the original method.";
}

export async function testRazorpay() {
  return api<{ message?: string }>({ action: "test" });
}

export async function testPaytmEdc() {
  return paytmApi<{ message?: string }>({ action: "test" });
}

export type CounterPayment = {
  method: string;
  paymentId?: string;
  razorpayOrderId?: string;
  reference?: string;
  live: boolean;
};

async function waitForRazorpayEdc(input: {
  activityId: string;
  orderId: string;
  deviceId?: string;
  deviceMode: "wired" | "wireless";
}) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    await sleep(2500);
    const status = await api<{
      paid?: boolean;
      failed?: boolean;
      paymentId?: string;
      method?: string;
      error?: string;
      orderId?: string;
    }>({
      action: "edc-status",
      activityId: input.activityId,
      orderId: input.orderId,
      deviceMode: input.deviceMode,
    });
    if (status.paid && status.paymentId) {
      return { paymentId: status.paymentId, method: status.method };
    }
    if (status.failed) throw new Error(status.error ?? "The Razorpay EDC payment failed.");
  }
  await api({ action: "edc-close", deviceId: input.deviceId, deviceMode: input.deviceMode }).catch(() => undefined);
  throw new Error("Timed out waiting for the Razorpay EDC. Complete or cancel the charge on the machine and try again.");
}

export async function payOnRazorpayEdc(input: {
  amount: number;
  receipt: string;
  name: string;
  email?: string;
  phone?: string;
  description: string;
}): Promise<CounterPayment> {
  if (input.amount <= 0) return { method: "Razorpay EDC", live: false };
  const settings = getIntegrations().razorpay;
  if (settings.mode === "demo") {
    await sleep(900);
    const demo = simulatePayment();
    return { method: "Razorpay EDC (demo)", paymentId: demo.paymentId, reference: demo.paymentId, live: false };
  }
  const started = await api<{ orderId: string; activityId: string }>({
    action: "edc-start",
    amount: input.amount,
    receipt: input.receipt,
    name: input.name,
    email: input.email,
    phone: input.phone,
    description: input.description,
    deviceId: settings.posDeviceId,
    deviceMode: settings.posDeviceMode === "wired" ? "wired" : "wireless",
    method: "card",
  });
  if (!started.ok) {
    if (started.configured === false) {
      throw new Error("Razorpay keys are missing for this mode. Add them in Settings → Payments.");
    }
    throw new Error(started.error ?? "Razorpay could not send the amount to the EDC.");
  }
  const paid = await waitForRazorpayEdc({
    activityId: started.activityId,
    orderId: started.orderId,
    deviceId: settings.posDeviceId,
    deviceMode: settings.posDeviceMode === "wired" ? "wired" : "wireless",
  });
  return {
    method: "Razorpay EDC",
    paymentId: paid.paymentId,
    razorpayOrderId: started.orderId,
    reference: paid.paymentId,
    live: true,
  };
}

async function waitForPaytmEdc(input: { merchantTransactionId: string; transactionDateTime: string }) {
  await sleep(4000);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const status = await paytmApi<{
      paid?: boolean;
      failed?: boolean;
      paymentId?: string;
      reference?: string;
      method?: string;
      message?: string;
    }>({
      action: "status",
      merchantTransactionId: input.merchantTransactionId,
      transactionDateTime: input.transactionDateTime,
    });
    if (status.paid) {
      return { paymentId: status.paymentId, reference: status.reference ?? status.paymentId, method: status.method };
    }
    if (status.failed) throw new Error(status.message ?? "The Paytm EDC payment failed.");
    await sleep(4000);
  }
  throw new Error("Timed out waiting for the Paytm EDC. Check the machine and try again.");
}

export async function payOnPaytmEdc(input: {
  amount: number;
  receipt: string;
  description: string;
}): Promise<CounterPayment> {
  if (input.amount <= 0) return { method: "Paytm EDC", live: false };
  const settings = getIntegrations().paytm;
  if (settings.mode === "demo") {
    await sleep(900);
    return { method: "Paytm EDC (demo)", paymentId: `paytm_demo_${Date.now()}`, reference: input.receipt, live: false };
  }
  const merchantTransactionId = input.receipt.replace(/[^A-Za-z0-9]/g, "").slice(0, 32);
  const started = await paytmApi<{ merchantTransactionId: string; transactionDateTime: string }>({
    action: "sale",
    amount: input.amount,
    merchantTransactionId,
    merchantReferenceNo: merchantTransactionId,
  });
  if (!started.ok) {
    if (started.configured === false) {
      throw new Error("Paytm EDC MID, TID and merchant key are missing. Add them in Settings → Payments.");
    }
    throw new Error(started.error ?? "Paytm could not send the amount to the EDC.");
  }
  const paid = await waitForPaytmEdc({
    merchantTransactionId: started.merchantTransactionId,
    transactionDateTime: started.transactionDateTime,
  });
  return {
    method: paid.method ? `Paytm EDC · ${paid.method}` : "Paytm EDC",
    paymentId: paid.paymentId,
    reference: paid.reference ?? started.merchantTransactionId,
    live: true,
  };
}
