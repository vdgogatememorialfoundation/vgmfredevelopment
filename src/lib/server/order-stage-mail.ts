import { hideShipping, shippingSplit } from "@/lib/order-charges";
import { readFileSync, writeFileSync } from "node:fs";
import { siteConfig } from "@/lib/constants";
import { dataFile } from "@/lib/server/paths";
import { sendMobileEmail } from "@/lib/server/mobile-mail";
import { pushToCustomer } from "@/lib/server/fcm";
import { savedAdminIntegrations } from "@/lib/server/admin-integrations";
import { readKv } from "@/lib/server/db";
import { findShopShipment } from "@/lib/server/shop-shipments";
import { applyTemplateVars, defaultMessageCopy } from "@/lib/message-templates";
import type { NotificationEventId } from "@/lib/integrations";
import type { Order, RefundRecord } from "@/types";

type Stage = { key: string; subject: string; intro: string; next: string[]; vars?: Record<string, string> };

const SIGN = "Vaidya Gogate Memorial Foundation";
const CARE = "care@vaidyagogate.org";

function sentFile() {
  return dataFile("order-stage-mail.json");
}

function readSent(): Record<string, string[]> {
  try {
    const parsed = JSON.parse(readFileSync(sentFile(), "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function markSent(orderId: string, key: string) {
  const all = readSent();
  all[orderId] = [...new Set([...(all[orderId] ?? []), key])];
  try {
    writeFileSync(sentFile(), JSON.stringify(all));
  } catch {
    /* read-only host */
  }
}

const rupees = (value: number | undefined) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

function when(iso?: string) {
  const time = Date.parse(iso || "");
  if (!Number.isFinite(time)) return "";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(time);
}

function placedReady(order: Order) {
  return order.status !== "Pending" && order.status !== "Failed" && order.status !== "Cancelled";
}

function isCod(order: Order) {
  return /cod|cash/i.test(order.paymentMethod || "") && order.paymentStatus !== "Paid";
}

function isPreorder(order: Order) {
  return Boolean(order.preorderPayment) || order.items.some((item) => item.preorder);
}

const STAGE_EVENTS: [RegExp, NotificationEventId][] = [
  [/^status:Packed$/, "order-packed"],
  [/^status:Shipped$/, "order-shipped"],
  [/^status:Out for Delivery$/, "order-out-for-delivery"],
  [/^status:Delivered$/, "order-delivered"],
  [/^status:Cancelled$/, "order-cancelled"],
  [/^status:Failed$/, "order-delivery-failed"],
  [/^return:/, "order-return-update"],
  [/^refund:.*:rrn$/, "refund-bank-reference"],
];

/** The Admin's edited copy for this stage (Settings → Templates), when it differs from the default. */
async function editedCopy(stageKey: string) {
  const id = STAGE_EVENTS.find(([pattern]) => pattern.test(stageKey))?.[1];
  if (!id) return null;
  const fromFile = (savedAdminIntegrations().messages ?? {}) as Record<string, { emailSubject?: string; emailBody?: string }>;
  const kv = ((await readKv<Record<string, unknown>>("admin", "notify-creds").catch(() => null))?.messages ?? {}) as typeof fromFile;
  const saved = fromFile[id] ?? kv[id];
  const fallback = defaultMessageCopy[id];
  const subject = saved?.emailSubject?.trim() || "";
  const body = saved?.emailBody?.trim() || "";
  if ((!subject || subject === fallback.emailSubject) && (!body || body === fallback.emailBody.trim())) return null;
  return { subject: subject || fallback.emailSubject, body: body || fallback.emailBody };
}

function refundKey(refund: RefundRecord) {
  return `refund:${refund.id}:${refund.status === "processed" ? "processed" : refund.status === "failed" ? "failed" : "initiated"}`;
}

function stagesFor(prev: Order | undefined, next: Order): Stage[] {
  const stages: Stage[] = [];
  const pre = next.preorderPayment;
  const track = next.trackingId ? `Courier: ${next.courierName || "Courier"} · AWB ${next.trackingId}` : "";
  if (placedReady(next) && (!prev || !placedReady(prev))) {
    stages.push({
      key: "placed",
      subject: `Order ${next.id} placed · ${rupees(next.total)}`,
      intro: `Thank you for ordering from ${SIGN}. We have received your order ${next.id}.`,
      next: [
        pre
          ? `This is a pre-order. You have paid the advance of ${rupees(pre.advance)}. Before dispatch we will email you a payment link for the balance ${rupees(pre.balance)}${pre.shippingDue ? " plus the courier charge" : ""}. The order ships once the balance is paid.`
          : isCod(next)
            ? `Please keep ${rupees(next.total)} ready to pay at delivery.`
            : "Your payment is received. We will email you when the order is packed and shipped.",
        next.deliveryMode === "store_pickup"
          ? `You chose pickup from the store (${siteConfig.address}). We will email you when it is ready; bring your order ID.`
          : "Keep your phone reachable so the courier can contact you.",
      ],
    });
  }
  if (prev && prev.status !== next.status) {
    const map: Partial<Record<Order["status"], Omit<Stage, "key">>> = {
      Packed: {
        subject: `Order ${next.id} is packed`,
        intro: `Your order ${next.id} is packed.`,
        next: [pre && !pre.balancePaidAt ? "Please pay the pre-order balance from the payment link we send, so we can hand it to the courier." : "It will be handed to the courier shortly. We will email the tracking number."],
      },
      Shipped: {
        subject: `Order ${next.id} has been shipped`,
        intro: `Your order ${next.id} has been handed to the courier.`,
        next: [track || "Tracking details will appear in My Orders shortly.", "Follow the live status in My Orders. Keep your phone reachable for the courier."],
      },
      "Out for Delivery": {
        subject: `Order ${next.id} is out for delivery`,
        intro: `Your order ${next.id} is out for delivery today.`,
        next: [isCod(next) ? `Please keep ${rupees(next.total)} ready to pay the courier.` : "No payment is due at the door.", "Keep your phone reachable. Check the parcel is sealed before accepting it."],
      },
      Delivered: {
        subject: `Order ${next.id} delivered`,
        intro: `Your order ${next.id} has been delivered. We hope the books serve you well.`,
        next: ["If any item arrived damaged, open the order in My Orders and request a replacement with photos.", "Your invoice is available in My Orders."],
      },
      Cancelled: {
        subject: `Order ${next.id} cancelled`,
        intro: `Your order ${next.id} has been cancelled.`,
        next: [next.paymentStatus === "Paid" || next.paymentStatus === "Partially Paid" || next.paymentStatus === "Refunded" ? "Any amount you paid online is refunded to the original payment method. We will email you when the refund is initiated and processed." : "No payment was taken for this order."],
      },
      Failed: {
        subject: `Delivery attempt failed for order ${next.id}`,
        intro: `The courier could not deliver order ${next.id}.`,
        next: [`Please reply to this email or write to ${CARE} with a convenient time and your phone number, so we can arrange another attempt.`],
      },
    };
    if (next.status === "Ready to Ship" && next.deliveryMode === "store_pickup") {
      map["Ready to Ship"] = {
        subject: `Order ${next.id} is ready for pickup`,
        intro: `Your order ${next.id} is ready to collect.`,
        next: [`Pickup address: ${siteConfig.address}.`, "Bring your order ID and the pickup code shown in My Orders."],
      };
    }
    const stage = map[next.status];
    if (stage) stages.push({ key: `status:${next.status}`, ...stage });
  }
  if (prev) {
    const before = new Set((prev.refunds ?? []).map(refundKey));
    for (const refund of next.refunds ?? []) {
      const key = refundKey(refund);
      const bankRef = refund.arn || refund.rrn || refund.utr;
      const earlier = prev.refunds?.find((item) => item.id === refund.id);
      if (before.has(key)) {
        // The bank reference often arrives after the refund was initiated: tell the customer as soon as it does.
        if (bankRef && earlier && !(earlier.arn || earlier.rrn || earlier.utr)) {
          stages.push({
            key: `refund:${refund.id}:rrn`,
            subject: `Bank reference for your refund on order ${next.id}`,
            intro: `Your bank has issued a reference number for the refund of ${rupees(refund.amount)} on order ${next.id}.`,
            next: [
              `Bank reference (RRN/ARN): ${bankRef}`,
              refund.vgmfId ? `VGMF transaction ID: ${refund.vgmfId}` : "",
              refund.gatewayRefundId ? `Refund ID: ${refund.gatewayRefundId}` : "",
              "Open your bank statement, and look for this credit. If it has not arrived within 5–7 working days, quote this reference to your bank.",
            ].filter(Boolean),
            vars: { amount: rupees(refund.amount), bankRef, vgmfId: refund.vgmfId || "", refundId: refund.gatewayRefundId || "" },
          });
        }
        continue;
      }
      const store = refund.destination === "store_credit";
      stages.push({
        key,
        subject: key.endsWith("processed") ? `Refund of ${rupees(refund.amount)} processed for order ${next.id}` : key.endsWith("failed") ? `Refund update for order ${next.id}` : `Refund of ${rupees(refund.amount)} initiated for order ${next.id}`,
        intro: key.endsWith("processed")
          ? `Your refund of ${rupees(refund.amount)} for order ${next.id} has been processed by the bank.`
          : key.endsWith("failed")
            ? `The refund of ${rupees(refund.amount)} for order ${next.id} could not be completed. Our team will retry and write to you.`
            : `A refund of ${rupees(refund.amount)} for order ${next.id} has been initiated${store ? " as store credit" : " to your original payment method"}.`,
        next: [
          refund.vgmfId ? `VGMF transaction ID: ${refund.vgmfId}` : "",
          refund.gatewayRefundId ? `Refund ID: ${refund.gatewayRefundId}` : "",
          bankRef ? `Bank reference (ARN/RRN): ${bankRef}` : "",
          store ? "The store credit is available on your next order." : key.endsWith("processed") ? "The amount is usually credited to your account within 5–7 working days of processing. Quote the bank reference to your bank if it does not appear." : "Banks usually take 3–5 working days to process, then 5–7 working days to credit. Follow it in My Orders.",
        ].filter(Boolean),
      });
    }
    const ret = next.returnRequest;
    if (ret && (ret.status !== prev.returnRequest?.status || ret.id !== prev.returnRequest?.id)) {
      const word = ret.kind === "replacement" ? "replacement" : "return";
      const text: Partial<Record<typeof ret.status, string>> = {
        "Pending Review": `We have received your ${word} request for order ${next.id}. Our team will review it within 2 working days.`,
        "Return Requested": `We have received your ${word} request for order ${next.id}. Our team will review it within 2 working days.`,
        Accepted: `Your ${word} request for order ${next.id} has been approved.`,
        "Return Approved": `Your ${word} request for order ${next.id} has been approved.`,
        Rejected: `We could not approve the ${word} request for order ${next.id}.${ret.decisionNote ? ` Reason: ${ret.decisionNote}` : ""}`,
        "Pickup Scheduled": `A courier pickup has been scheduled for the ${word} on order ${next.id}. Please keep the parcel packed and ready.`,
        "Picked Up": `The courier has picked up the ${word} parcel for order ${next.id}. We will update you once it reaches us.`,
        Refunded: `The return for order ${next.id} is complete and your refund has been initiated.`,
        "Replacement Created": `Your replacement for order ${next.id} has been created${ret.replacementOrderId ? ` as order ${ret.replacementOrderId}` : ""}. We will email you when it ships.`,
      };
      const intro = text[ret.status];
      if (intro) {
        stages.push({
          key: `return:${ret.id}:${ret.status}`,
          subject: `${word === "return" ? "Return" : "Replacement"} update for order ${next.id}: ${ret.status}`,
          intro,
          next: [ret.reason ? `Reason given: ${ret.reason}` : "", "Follow the request in My Orders."].filter(Boolean),
          vars: { status: ret.status },
        });
      }
    }
    if (pre?.link?.createdAt && pre.link.createdAt !== prev.preorderPayment?.link?.createdAt && !pre.balancePaidAt) {
      stages.push({
        key: `balance:${pre.link.createdAt}`,
        subject: `Pay the balance for pre-order ${next.id}`,
        intro: `Your pre-order ${next.id} is ready to dispatch. Please pay the balance to ship it.`,
        next: [`Balance due: ${rupees(pre.balance)}${pre.shipping ? ` (includes courier charge ${rupees(pre.shipping)})` : ""}`, `Pay here: ${pre.link.url}`, "The order updates by itself once you pay; we then hand it to the courier."],
      });
    }
    if (pre?.balancePaidAt && !prev.preorderPayment?.balancePaidAt) {
      stages.push({
        key: "balance-paid",
        subject: `Balance received for pre-order ${next.id}`,
        intro: `We have received the balance for pre-order ${next.id}. Thank you.`,
        next: ["Your order is now fully paid and will be shipped. We will email the tracking number."],
      });
    }
  }
  return stages;
}

/** Pre-order dispatch depends on the book's arrival: the courier's date is shared only once it has picked the parcel up. */
function preorderDateLine(order: Order) {
  const courierDate = ["Shipped", "Out for Delivery"].includes(order.status) ? findShopShipment(order.id)?.expectedBy : "";
  return courierDate ? `Expected delivery: ${when(courierDate)}` : "Delivery date: calculated once shipped";
}

function details(order: Order) {
  const address = order.deliveryAddress;
  const pre = order.preorderPayment;
  const refunded = (order.refunds ?? []).reduce((sum, refund) => sum + (Number(refund.amount) || 0), 0);
  const paid = pre ? (pre.balancePaidAt ? order.total : pre.advance) : order.paymentStatus === "Paid" ? order.total : 0;
  const lines = [
    "ORDER DETAILS",
    `Order ID: ${order.id}`,
    `Placed: ${when(order.date)}`,
    `Status: ${order.status}`,
    "",
    "Items:",
    ...order.items.map((item) => `• ${item.title} × ${item.quantity} — ${rupees(item.price * item.quantity)}`),
    "",
    `Subtotal: ${rupees(order.subtotal)}`,
    order.discount ? `Discount: − ${rupees(order.discount)}` : "",
    order.gst ? `GST: ${rupees(order.gst)}` : "",
    order.platformFee ? `Platform fee: ${rupees(order.platformFee)}` : "",
    hideShipping(order) ? "" : `Shipping: ${pre?.shippingDue && !pre.balancePaidAt ? "added to the balance" : shippingSplit(order).courier ? rupees(shippingSplit(order).courier) : order.deliveryMode === "store_pickup" ? "Store pickup" : order.shippingDue || pre ? "calculated once packed" : "Free"}`,
    shippingSplit(order).packing ? `Packing charge: ${rupees(shippingSplit(order).packing)}` : "",
    order.storeCreditUsed ? `Store credit used: − ${rupees(order.storeCreditUsed)}` : "",
    `Order total: ${rupees(order.total)}`,
    "",
    "PAYMENT",
    `Payment status: ${order.paymentStatus}`,
    order.paymentMethod ? `Method: ${order.paymentMethod}` : "",
    order.razorpayPaymentId || order.paymentRef ? `Payment ID: ${order.razorpayPaymentId || order.paymentRef}` : "",
    `Amount paid: ${rupees(paid)}`,
    pre && !pre.balancePaidAt ? `Pre-order balance due: ${rupees(pre.balance)}${pre.shippingDue ? " + courier charge" : ""}` : "",
    refunded ? `Refunded: ${rupees(refunded)}` : "",
    "",
    "DELIVERY",
    order.deliveryMode === "store_pickup"
      ? `Pickup from store: ${siteConfig.address}`
      : `Deliver to: ${[address?.fullName, address?.line1, address?.landmark, address?.city, address?.state, address?.pincode].filter(Boolean).join(", ")}`,
    address?.phone ? `Phone: ${[address.phone, address.altPhone].filter(Boolean).join(" / ")}` : "",
    order.trackingId ? `Courier: ${order.courierName || "Courier"} · AWB ${order.trackingId}` : "",
    order.status === "Delivered" ? "" : !isPreorder(order) ? (order.eta ? `Expected delivery: ${order.eta}` : "") : preorderDateLine(order),
  ];
  return lines.filter((line, index, all) => line !== "" || (all[index - 1] !== "" && index > 0)).join("\n");
}

/** Emails the customer at each main stage of an order, once per stage. */
export async function notifyOrderStage(prev: Order | undefined, next: Order, options: { statusOnly?: boolean } = {}) {
  const to = next.deliveryAddress?.email || next.accountEmail || "";
  const sent = new Set(readSent()[next.id] ?? []);
  for (const stage of stagesFor(prev, next)) {
    if (options.statusOnly && !stage.key.startsWith("status:")) continue;
    if (sent.has(stage.key)) continue;
    markSent(next.id, stage.key);
    const name = next.deliveryAddress?.fullName || "Reader";
    const trackUrl = `${siteConfig.url}/account/orders/${encodeURIComponent(next.id)}`;
    const nextLines = stage.next.filter(Boolean).map((line) => `• ${line}`).join("\n");
    const edited = await editedCopy(stage.key);
    if (edited) {
      const vars = {
        name,
        orderId: next.id,
        status: next.status,
        amount: rupees(next.total),
        link: next.preorderPayment?.link?.url || next.paymentLink?.url || "",
        intro: stage.intro,
        next: nextLines,
        details: details(next),
        trackUrl,
        courier: next.courierName || "",
        awb: next.trackingId || "",
        ...stage.vars,
      };
      const subject = applyTemplateVars(edited.subject, vars);
      void pushToCustomer(
        { email: to || undefined, phone: next.deliveryAddress?.phone, accountId: next.userId },
        { title: subject, body: stage.intro, url: `/account/orders/${encodeURIComponent(next.id)}` }
      ).catch(() => undefined);
      if (to) await sendMobileEmail(to, subject, applyTemplateVars(edited.body, vars)).catch(() => undefined);
      continue;
    }
    const body = [
      `Dear ${name},`,
      "",
      `Namaste, and greetings from ${SIGN}.`,
      "",
      stage.intro,
      ...(nextLines ? ["", nextLines] : []),
      "",
      details(next),
      "",
      `Track your order: ${trackUrl}`,
      `Questions? Reply to this email or write to ${CARE} with your order ID.`,
      "",
      "With warm regards,",
      SIGN,
    ].join("\n");
    void pushToCustomer(
      { email: to || undefined, phone: next.deliveryAddress?.phone, accountId: next.userId },
      { title: stage.subject, body: stage.intro, url: `/account/orders/${encodeURIComponent(next.id)}` }
    ).catch(() => undefined);
    if (to) await sendMobileEmail(to, stage.subject, body).catch(() => undefined);
  }
}
