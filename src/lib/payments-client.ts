import type { CourierRate, Order } from "@/types";
import { getIntegrations, paytmKeys, razorpayKeys } from "@/lib/integrations";
import { requiresLiveCommerce } from "@/lib/platform";
import { getOrder, maxRefundable, patchOrder, recordBalancePayment, recordCourierPayment, recordPayment, refundOrder, sendEmail, updateRefund } from "@/lib/admin-store";

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
  if (mode === "demo" && !requiresLiveCommerce()) return "Demo mode: the payment is simulated and no money is charged.";
  if (mode === "test") return "Test mode: use test cards or UPI test IDs.";
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
  | { kind: "holding"; paymentId: string; razorpayOrderId: string; live: true }
  | { kind: "demo"; paymentId: string; live: false };

/** Asks Razorpay whether this order is captured. Empty string means it is still unconfirmed. */
export async function pollRazorpayOrder(orderId: string) {
  const status = await api<{ confirmed?: boolean; paymentId?: string }>({ action: "order-status", orderId });
  if (status.ok && status.confirmed) return status.paymentId || "paid";
  return "";
}

export async function waitForRazorpay(orderId: string, attempts = 12) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const paymentId = await pollRazorpayOrder(orderId).catch(() => "");
    if (paymentId) return paymentId;
    await sleep(5000);
  }
  return "";
}

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
  /** Called with the Razorpay order id before the payment window opens. */
  onCreated?: (razorpayOrderId: string) => void;
}): Promise<CheckoutOutcome> {
  const simulate = async (): Promise<CheckoutOutcome> => {
    await sleep(900);
    return simulatePayment();
  };
  // A visitor's browser has no saved admin settings; the host's env keys decide whether checkout is live.
  const hasLocalSettings = Boolean(window.localStorage.getItem("vgmf_integrations"));
  const liveHost = requiresLiveCommerce();
  if (paymentMode() === "demo" && hasLocalSettings && !input.skipDemo && !liveHost) return simulate();
  const order = await api<{ orderId: string; keyId: string }>({ action: "order", amount: input.amount, receipt: input.receipt });
  if (!order.ok && order.configured === false && !liveHost && (!hasLocalSettings || paymentMode() === "demo")) return simulate();
  if (!order.ok) {
    if (order.configured === false) {
      throw new Error("Razorpay keys are missing for this mode. Add them in Settings → Payments, or switch to demo mode.");
    }
    throw new Error(order.error ?? "Razorpay could not create the payment.");
  }
  input.onCreated?.(order.orderId);
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
  let response: RazorpayResponse;
  try {
    response = await new Promise<RazorpayResponse>((resolve, reject) => {
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
  } catch (problem) {
    // UPI apps sometimes finish after the window closes: ask Razorpay before calling it unpaid.
    const late = await waitForRazorpay(order.orderId, 2).catch(() => "");
    if (late) return { kind: "paid", paymentId: late, razorpayOrderId: order.orderId, live: true };
    throw problem;
  }
  const verified = await api<{ verified: boolean }>({
    action: "verify",
    orderId: response.razorpay_order_id,
    paymentId: response.razorpay_payment_id,
    signature: response.razorpay_signature,
  });
  if (verified.ok && verified.verified) {
    return { kind: "paid", paymentId: response.razorpay_payment_id, razorpayOrderId: response.razorpay_order_id, live: true };
  }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await sleep(4000);
    const status = await api<{ confirmed?: boolean; paymentId?: string }>({ action: "order-status", orderId: response.razorpay_order_id });
    if (status.ok && status.confirmed) {
      return { kind: "paid", paymentId: status.paymentId || response.razorpay_payment_id, razorpayOrderId: response.razorpay_order_id, live: true };
    }
  }
  return {
    kind: "holding",
    paymentId: response.razorpay_payment_id,
    razorpayOrderId: response.razorpay_order_id,
    live: true,
  };
}

function encodeSummary(order: Order, amount = order.total, items = order.items.map((item) => `${item.quantity} × ${item.title}`)) {
  const summary = {
    id: order.id,
    amount,
    name: order.deliveryAddress?.fullName ?? "",
    email: order.deliveryAddress?.email ?? "",
    phone: order.deliveryAddress?.phone ?? "",
    items,
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

const linkMinutes = () => Math.max(15, Number(getIntegrations().razorpay.linkExpiryMinutes) || 30);
const linkExpiry = () => new Date(Date.now() + linkMinutes() * 60_000).toISOString();

/** Amount still to collect on an order: the total less any advance already paid. */
export function remainingDue(order: Order) {
  if (order.paymentStatus === "Paid") return 0;
  const advance = order.preorderPayment?.advancePaidAt ? order.preorderPayment.advance : 0;
  const paid = order.paymentStatus === "Partially Paid" && order.amountPaid !== undefined ? order.amountPaid : advance;
  return Math.max(0, Math.round((order.total - paid) * 100) / 100);
}

/** Cancels every open Razorpay link on an order (used when the order is deleted). */
export async function cancelOrderPaymentLinks(orderId: string) {
  const order = getOrder(orderId);
  if (!order) return;
  const links = [order.paymentLink, order.courierUpgrade?.link, order.preorderPayment?.link];
  for (const link of links) {
    if (link?.provider !== "razorpay" || !link.id) continue;
    try {
      await api({ action: "link-cancel", linkId: link.id });
    } catch {
      /* already paid or expired */
    }
  }
}

/** Razorpay Payment Link in test/live mode, otherwise a /pay link on this site. `amount` defaults to the order total. */
export async function createPaymentLink(orderId: string, amountOverride?: number) {
  const order = getOrder(orderId);
  if (!order) throw new Error("Order not found.");
  const settings = getIntegrations();
  const amount = Math.round((amountOverride && amountOverride > 0 ? amountOverride : order.total) * 100) / 100;
  if (!(amount > 0)) throw new Error("Enter an amount above ₹0.");
  const expiresAt = linkExpiry();
  let link: NonNullable<Order["paymentLink"]>;
  if (settings.razorpay.mode === "demo" && !requiresLiveCommerce()) {
    link = {
      url: `${window.location.origin}/pay/${order.id}?d=${amount === order.total ? encodeSummary(order) : encodeSummary(order, amount, ["Payment"])}&x=${Date.parse(expiresAt)}`,
      provider: "demo",
      createdAt: new Date().toISOString(),
      amount,
      expiresAt,
    };
  } else {
    const result = await api<{ id: string; url: string }>({
      action: "link",
      amount,
      orderId: order.id,
      name: order.deliveryAddress?.fullName ?? "Customer",
      email: order.deliveryAddress?.email,
      phone: order.deliveryAddress?.phone,
      description: `Vaidya Gogate Memorial Foundation order ${order.id}`,
      callbackUrl: `${window.location.origin}/pay/${order.id}?done=1`,
      expiryMinutes: linkMinutes(),
    });
    if (!result.ok) throw new Error(result.error ?? "Razorpay could not create the payment link.");
    link = { url: result.url, id: result.id, provider: "razorpay", createdAt: new Date().toISOString(), amount, expiresAt };
  }
  const keep = order.paymentStatus === "Paid" || order.paymentStatus === "Partially Paid";
  patchOrder(order.id, { paymentLink: link, paymentStatus: keep ? order.paymentStatus : "Pending" }, "Payment link created");
  sendEmail({
    to: order.deliveryAddress?.email ?? "",
    phone: order.deliveryAddress?.phone,
    name: order.deliveryAddress?.fullName,
    params: [order.deliveryAddress?.fullName ?? "Customer", order.id, `₹${amount}`, link.url],
    subject: `Pay for your Vaidya Gogate Memorial Foundation order ${order.id}`,
    template: "payment-link",
    body: `Dear ${order.deliveryAddress?.fullName || "Guest"},\n\nNamaste, and greetings from Vaidya Gogate Memorial Foundation.\n\nPlease complete the payment of ₹${amount.toLocaleString("en-IN")} for order ${order.id}:\n${link.url}\n\nThis link is valid for ${linkMinutes()} minutes.\n\nWith warm regards,\nVaidya Gogate Memorial Foundation`,
  });
  return link;
}

/** Link for a store-pickup customer to pay only the courier charge; paying switches the order to courier delivery. */
export async function createCourierPaymentLink(orderId: string, rate: CourierRate) {
  const order = getOrder(orderId);
  if (!order) throw new Error("Order not found.");
  if (order.deliveryMode !== "store_pickup") throw new Error("Only store-pickup orders can be switched to courier delivery.");
  const address = order.deliveryAddress;
  if (!address?.line1 || !/^\d{6}$/.test(address.pincode ?? "")) throw new Error("Add the customer's full delivery address and pincode with Edit first.");
  const amount = Math.round(rate.rate * 100) / 100;
  if (!(amount > 0)) throw new Error("Pick a courier with a charge to collect.");
  const settings = getIntegrations();
  const label = `Courier delivery · ${rate.courierName}`;
  let link: NonNullable<NonNullable<Order["courierUpgrade"]>["link"]>;
  if (settings.razorpay.mode === "demo" && !requiresLiveCommerce()) {
    link = { url: `${window.location.origin}/pay/${order.id}?part=courier&d=${encodeSummary(order, amount, [label])}`, provider: "demo", createdAt: new Date().toISOString() };
  } else {
    const result = await api<{ id: string; url: string }>({
      action: "link",
      amount,
      orderId: `${order.id}-C`,
      name: address.fullName || "Customer",
      email: address.email,
      phone: address.phone,
      description: `Courier charge for Vaidya Gogate Memorial Foundation order ${order.id}`,
      callbackUrl: `${window.location.origin}/pay/${order.id}?part=courier&done=1`,
      expiryMinutes: linkMinutes(),
    });
    if (!result.ok) throw new Error(result.error ?? "Razorpay could not create the payment link.");
    link = { url: result.url, id: result.id, provider: "razorpay", createdAt: new Date().toISOString() };
  }
  patchOrder(order.id, { courierUpgrade: { amount, rate, link } }, `Courier payment link created · ${rate.courierName} ₹${amount}`);
  sendEmail({
    to: address.email ?? "",
    phone: address.phone,
    name: address.fullName,
    params: [address.fullName || "Customer", order.id, `₹${amount}`, link.url],
    subject: `Courier delivery for your Vaidya Gogate Memorial Foundation order ${order.id}`,
    template: "payment-link",
    body: `Dear ${address.fullName || "Guest"},\n\nNamaste, and greetings from Vaidya Gogate Memorial Foundation.\n\nAs requested, we can send order ${order.id} by courier (${rate.courierName}) instead of store pickup. Please pay only the courier charge of ₹${amount.toLocaleString("en-IN")}:\n${link.url}\n\nThe courier is booked once the payment is received.\n\nWith warm regards,\nVaidya Gogate Memorial Foundation`,
  });
  return link;
}

/** Link for the customer to pay the courier charge of a return pickup. */
export async function createReturnChargeLink(orderId: string, amount: number) {
  const order = getOrder(orderId);
  const back = order?.returnShipment;
  if (!order || !back) throw new Error("Create the return shipment first.");
  const value = Math.round(amount * 100) / 100;
  if (!(value > 0)) throw new Error("Enter the return courier charge above ₹0.");
  const address = order.deliveryAddress;
  const settings = getIntegrations();
  const expiresAt = linkExpiry();
  let link: NonNullable<NonNullable<Order["returnShipment"]>["chargeLink"]>;
  if (settings.razorpay.mode === "demo" && !requiresLiveCommerce()) {
    link = { url: `${window.location.origin}/pay/${order.id}?part=return&d=${encodeSummary(order, value, ["Return courier charge"])}&x=${Date.parse(expiresAt)}`, provider: "demo", createdAt: new Date().toISOString(), amount: value, expiresAt };
  } else {
    const result = await api<{ id: string; url: string }>({
      action: "link",
      amount: value,
      orderId: `${order.id}-R`,
      name: address?.fullName || "Customer",
      email: address?.email,
      phone: address?.phone,
      description: `Return courier charge for Vaidya Gogate Memorial Foundation order ${order.id}`,
      callbackUrl: `${window.location.origin}/pay/${order.id}?part=return&done=1`,
      expiryMinutes: linkMinutes(),
    });
    if (!result.ok) throw new Error(result.error ?? "Razorpay could not create the payment link.");
    link = { url: result.url, id: result.id, provider: "razorpay", createdAt: new Date().toISOString(), amount: value, expiresAt };
  }
  patchOrder(order.id, { returnShipment: { ...back, charge: value, chargePaidBy: "customer", chargeLink: link } }, `Return courier charge link · ₹${value}`);
  sendEmail({
    to: address?.email ?? "",
    phone: address?.phone,
    name: address?.fullName,
    params: [address?.fullName || "Customer", order.id, `₹${value}`, link.url],
    subject: `Return courier charge for order ${order.id}`,
    template: "payment-link",
    body: `Dear ${address?.fullName || "Guest"},\n\nNamaste, and greetings from Vaidya Gogate Memorial Foundation.\n\nPlease pay the return courier charge of ₹${value.toLocaleString("en-IN")} for order ${order.id}:\n${link.url}\n\nThis link is valid for ${linkMinutes()} minutes.\n\nWith warm regards,\nVaidya Gogate Memorial Foundation`,
  });
  return link;
}

/** Emails the customer the return AWB and label to paste on the parcel. */
export function emailReturnLabel(orderId: string) {
  const order = getOrder(orderId);
  const back = order?.returnShipment;
  if (!order || !back?.awb) throw new Error("Create the return shipment first.");
  const address = order.deliveryAddress;
  const page = `${window.location.origin}/account/orders/${encodeURIComponent(order.id)}`;
  const pay = back.chargePaidBy === "customer" && !back.chargePaidAt && back.chargeLink ? `\n\nReturn courier charge ₹${back.charge}: ${back.chargeLink.url}` : "";
  sendEmail({
    to: address?.email ?? "",
    phone: address?.phone,
    name: address?.fullName,
    params: [address?.fullName || "Customer", order.id, back.awb, back.labelUrl || page],
    subject: `Return label for order ${order.id} · AWB ${back.awb}`,
    template: "return-label",
    body: `Dear ${address?.fullName || "Guest"},\n\nNamaste, and greetings from Vaidya Gogate Memorial Foundation.\n\nYour return pickup is booked with ${back.courierName || "the courier"}. AWB ${back.awb}.\n\nDownload the label, paste it on the parcel and hand it to the courier:\n${back.labelUrl || page}${pay}\n\nYou can also download it any time from My Orders: ${page}\n\nWith warm regards,\nVaidya Gogate Memorial Foundation`,
  });
  patchOrder(order.id, { returnShipment: { ...back, labelEmailedAt: new Date().toISOString() } }, "Return label emailed to the customer");
}

/** Pre-orders sent by courier: works out the courier charge and adds it to the balance before the customer pays. */
export async function addPreorderShipping(orderId: string) {
  // The courier charge is added only when the desk selects the courier (selectPreorderCourier), never guessed.
  return getOrder(orderId);
}

/** Sends the pre-order customer a link for the remaining balance. */
export async function createBalancePaymentLink(orderId: string) {
  const order = getOrder(orderId);
  if (order?.preorderPayment?.shippingDue && !order.preorderPayment.balancePaidAt) {
    throw new Error("Select the courier first (Courier → Show couriers & rates). Its charge is added to the balance, then the link is sent.");
  }
  const plan = order?.preorderPayment;
  if (!order || !plan) throw new Error("This order has no pre-order balance.");
  if (plan.balancePaidAt) throw new Error("The balance is already paid.");
  const address = order.deliveryAddress;
  const amount = Math.round(plan.balance * 100) / 100;
  const settings = getIntegrations();
  let link: NonNullable<NonNullable<Order["preorderPayment"]>["link"]>;
  if (settings.razorpay.mode === "demo" && !requiresLiveCommerce()) {
    link = { url: `${window.location.origin}/pay/${order.id}?part=balance&d=${encodeSummary(order, amount, ["Pre-order balance"])}`, provider: "demo", createdAt: new Date().toISOString() };
  } else {
    const result = await api<{ id: string; url: string }>({
      action: "link",
      amount,
      orderId: `${order.id}-B`,
      name: address?.fullName || "Customer",
      email: address?.email,
      phone: address?.phone,
      description: `Balance for Vaidya Gogate Memorial Foundation pre-order ${order.id}`,
      callbackUrl: `${window.location.origin}/pay/${order.id}?part=balance&done=1`,
      expiryMinutes: linkMinutes(),
    });
    if (!result.ok) throw new Error(result.error ?? "Razorpay could not create the payment link.");
    link = { url: result.url, id: result.id, provider: "razorpay", createdAt: new Date().toISOString() };
  }
  patchOrder(order.id, { preorderPayment: { ...plan, link } }, `Balance payment link created · ₹${amount}`);
  sendEmail({
    to: address?.email ?? "",
    phone: address?.phone,
    name: address?.fullName,
    params: [address?.fullName || "Customer", order.id, `₹${amount}`, link.url],
    subject: `Your Vaidya Gogate Memorial Foundation pre-order ${order.id} is ready — balance due`,
    template: "payment-link",
    body: `Dear ${address?.fullName || "Guest"},\n\nNamaste, and greetings from Vaidya Gogate Memorial Foundation.\n\nYour pre-order ${order.id} is ready. Please pay the remaining balance of ₹${amount.toLocaleString("en-IN")}:\n${link.url}\n\nWe dispatch the order once the balance is received.\n\nWith warm regards,\nVaidya Gogate Memorial Foundation`,
  });
  return link;
}

export async function refreshBalancePaymentLink(orderId: string) {
  const order = getOrder(orderId);
  const link = order?.preorderPayment?.link;
  if (!order || !link) throw new Error("This order has no balance payment link.");
  if (order.preorderPayment?.balancePaidAt) return "Balance already paid.";
  if (link.provider !== "razorpay" || !link.id) return "Demo links are marked paid when the customer pays, or record the balance manually.";
  const result = await api<{ status: string; paymentId?: string }>({ action: "link-status", linkId: link.id });
  if (!result.ok) throw new Error(result.error ?? "Could not read the link status.");
  if (result.status === "paid") {
    recordBalancePayment(order.id, { method: "Razorpay payment link", reference: result.paymentId });
    return "Balance paid. The order is fully paid.";
  }
  return `Razorpay link status: ${result.status}.`;
}

export async function refreshCourierPaymentLink(orderId: string) {
  const order = getOrder(orderId);
  const link = order?.courierUpgrade?.link;
  if (!order || !link) throw new Error("This order has no courier payment link.");
  if (order.courierUpgrade?.paidAt) return "Courier charge already paid.";
  if (link.provider !== "razorpay" || !link.id) return "Demo links are marked paid when the customer pays, or record the courier payment manually.";
  const result = await api<{ status: string; paymentId?: string }>({ action: "link-status", linkId: link.id });
  if (!result.ok) throw new Error(result.error ?? "Could not read the link status.");
  if (result.status === "paid") {
    recordCourierPayment(order.id, { method: "Razorpay payment link", reference: result.paymentId });
    return "Courier charge paid. The order is now a courier delivery; book the courier below.";
  }
  return `Razorpay link status: ${result.status}.`;
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

export async function refundThroughGateway(orderId: string, amount?: number, options: { withPlatformFee?: boolean } = {}) {
  const order = getOrder(orderId);
  if (!order) throw new Error("Order not found.");
  const cap = maxRefundable(order, options);
  if (amount != null && !(Number.isFinite(amount) && amount > 0)) throw new Error("Enter a refund amount above ₹0.");
  if (amount != null && amount > cap + 0.001) throw new Error(`At most ₹${cap.toLocaleString("en-IN")} can still be refunded on this order.`);
  const value = Math.round(Math.min(amount ?? cap, cap) * 100) / 100;
  if (value <= 0) throw new Error("Nothing left to refund. The platform fee is kept unless you tick \"Also refund the platform fee\".");
  if (order.razorpayPaymentId && !order.razorpayPaymentId.startsWith("pay_demo") && paymentMode() !== "demo") {
    const result = await api<RefundView>({ action: "refund", paymentId: order.razorpayPaymentId, amount: value });
    if (!result.ok) throw new Error(result.error ?? "Razorpay refused the refund.");
    refundOrder(order.id, value, `Razorpay refund ${result.refundId} (${result.status})`, {
      gateway: "razorpay",
      gatewayRefundId: result.refundId,
      reference: result.refundId,
      status: refundState(result.status),
      rrn: result.rrn || undefined,
      arn: result.arn || undefined,
      utr: result.utr || undefined,
      speed: result.speed || undefined,
      checkedAt: new Date().toISOString(),
    }, options);
    return `Refund ${result.refundId} created on Razorpay (${result.status}).`;
  }
  refundOrder(order.id, value, order.razorpayPaymentId ? "Demo refund" : "Refund recorded", undefined, options);
  return order.razorpayPaymentId ? "Demo refund recorded." : "Refund recorded. Pay it back through the original method.";
}

type RefundView = { refundId: string; status: string; amount: number; rrn: string; arn: string; utr: string; speed: string; createdAt: string };

function refundState(status: string) {
  return status === "processed" || status === "failed" ? status : "pending";
}

/** Reads the refund back from Razorpay and stores its status and bank RRN/ARN on the order. */
export async function refreshRefundStatus(orderId: string, refundId: string) {
  const refund = getOrder(orderId)?.refunds?.find((item) => item.id === refundId);
  if (!refund?.gatewayRefundId) throw new Error("This refund was recorded by hand, so there is no gateway status to check.");
  const result = await api<RefundView>({ action: "refund-status", refundId: refund.gatewayRefundId });
  if (!result.ok) throw new Error(result.error ?? "Could not read the refund from Razorpay.");
  const status = refundState(result.status);
  updateRefund(orderId, refundId, {
    status,
    rrn: result.rrn || refund.rrn,
    arn: result.arn || refund.arn,
    utr: result.utr || refund.utr,
    speed: result.speed || refund.speed,
    processedAt: status === "processed" ? refund.processedAt || new Date().toISOString() : refund.processedAt,
    checkedAt: new Date().toISOString(),
  });
  return `Razorpay refund ${refund.gatewayRefundId}: ${status}${result.rrn ? ` · RRN ${result.rrn}` : ""}${result.arn ? ` · ARN ${result.arn}` : ""}.`;
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

export type ReadyGateway = { id: "payu" | "easebuzz" | "cashfree" | "phonepe"; mode: "test" | "live" };

export async function readyHostedGateways(): Promise<ReadyGateway[]> {
  const response = await fetch("/api/payments/hosted", { cache: "no-store" });
  const data = (await response.json().catch(() => ({}))) as { gateways?: ReadyGateway[] };
  return data.gateways ?? [];
}

export async function pushPaymentVault() {
  const settings = getIntegrations();
  await fetch("/api/payments/hosted", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "save",
      payments: { payu: settings.payu, easebuzz: settings.easebuzz, cashfree: settings.cashfree, phonepe: settings.phonepe },
    }),
  });
}

declare global {
  interface Window {
    Cashfree?: (options: { mode: "sandbox" | "production" }) => { checkout: (options: { paymentSessionId: string; redirectTarget: "_self" }) => Promise<unknown> };
  }
}

export async function openHostedCheckout(input: { gateway: ReadyGateway["id"]; amount: number; orderId: string; name: string; email?: string; phone?: string }) {
  const response = await fetch("/api/payments/hosted", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "start", ...input, product: `Vaidya Gogate Memorial Foundation order ${input.orderId}` }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    kind?: string;
    url?: string;
    fields?: Record<string, string>;
    session?: string;
    mode?: "test" | "live";
  };
  if (!response.ok || !data.ok) throw new Error(data.error || "The payment gateway did not open.");
  if (data.kind === "form" && data.url && data.fields) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = data.url;
    for (const [name, value] of Object.entries(data.fields)) {
      const field = document.createElement("input");
      field.type = "hidden";
      field.name = name;
      field.value = value;
      form.appendChild(field);
    }
    document.body.appendChild(form);
    form.submit();
    return;
  }
  if (data.kind === "cashfree" && data.session) {
    await new Promise<void>((resolve, reject) => {
      if (window.Cashfree) return resolve();
      const script = document.createElement("script");
      script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Cashfree checkout could not load."));
      document.body.appendChild(script);
    });
    const checkout = window.Cashfree?.({ mode: data.mode === "live" ? "production" : "sandbox" });
    if (!checkout) throw new Error("Cashfree checkout could not load.");
    await checkout.checkout({ paymentSessionId: data.session, redirectTarget: "_self" });
    return;
  }
  if (data.kind === "redirect" && data.url) {
    window.location.href = data.url;
    return;
  }
  throw new Error("The payment gateway did not return a checkout page.");
}
