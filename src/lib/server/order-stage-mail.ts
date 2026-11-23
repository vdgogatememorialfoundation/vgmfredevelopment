import { sendWhatsAppAlert } from "@/lib/server/whatsapp-inbox";
import { hideShipping, shippingSplit } from "@/lib/order-charges";
import { readFileSync, writeFileSync } from "node:fs";
import { siteConfig } from "@/lib/constants";
import { dataFile } from "@/lib/server/paths";
import { sendMobileEmail } from "@/lib/server/mobile-mail";
import { pushToCustomer } from "@/lib/server/fcm";
import { renderOrderStageNotification, stageKeyFromEvent } from "@/lib/server/mobile-notifications";
import { savedAdminIntegrations } from "@/lib/server/admin-integrations";
import { readKv } from "@/lib/server/db";
import { readMobileFeed } from "@/lib/server/mobile-feed";
import { publicOrderSettings, whatsAppSenders, whatsAppTemplateFor, type OrderSettings } from "@/lib/integrations";
import { findShopShipment } from "@/lib/server/shop-shipments";
import { isOwnFleet } from "@/lib/courier-label";
import { findShopOrder } from "@/lib/server/shop-orders";
import { applyTemplateVars, defaultMessageCopy } from "@/lib/message-templates";
import type { NotificationEventId } from "@/lib/integrations";
import type { Order, RefundRecord } from "@/types";

/** The desk's credit date, else processed date + Order settings' credit days (default 5). */
function creditDay(refund: RefundRecord) {
  const days = publicOrderSettings(readMobileFeed().orderSettings as Partial<OrderSettings> | undefined).refunds.creditDays ?? 5;
  const fixed = Date.parse(refund.creditBy || "");
  const base = Date.parse(refund.processedAt || "") || Date.now();
  const at = Number.isFinite(fixed) ? fixed : base + days * 86_400_000;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(at));
}

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
  [/^refund:.*:processed$/, "refund-processed"],
  [/^refund:.*:initiated$/, "refund"],
  [/^refund:.*:rrn$/, "refund-bank-reference"],
  [/^call-missed:/, "order-call-missed"],
];

/** Shipped, out for delivery and delivered carry the courier, tracking ID and dates; the general update is the fallback. */
const COURIER_STAGES: Record<string, NotificationEventId> = { Shipped: "order-shipped", "Out for Delivery": "order-out-for-delivery", Delivered: "order-delivered" };

function day(iso?: string) {
  const time = Date.parse(iso || "");
  return Number.isFinite(time) ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(time) : "";
}

function itemsSummary(order: Order) {
  const list = (order.items ?? []).map((item) => `${item.title} × ${item.quantity}`).filter(Boolean);
  const joined = list.join(", ") || "VGMF Publication";
  return joined.length > 115 ? `${joined.slice(0, 112)}…` : joined;
}

function trackLink(order: Order) {
  return `${siteConfig.url}/account/orders/${encodeURIComponent(order.id)}`;
}

function courierParams(order: Order, status: string, name: string): { params: string[]; legacy: string[] } {
  const shipment = findShopShipment(order.id);
  const courier = order.courierName || shipment?.courier || "our courier";
  const awb = order.trackingId || shipment?.awb || "shared in My Orders shortly";
  const items = itemsSummary(order);
  const url = trackLink(order);
  if (status === "Shipped") {
    const exp = day(shipment?.expectedBy) || order.eta || "shared by the courier soon";
    return {
      params: [name, order.id, items, courier, awb, exp, url],
      legacy: [name, order.id, courier, awb, exp, url],
    };
  }
  if (status === "Out for Delivery") {
    const basePay = isCod(order) ? `Please keep ${rupees(order.total)} ready to pay the courier.` : "Paid — no payment due at the door.";
    const own = Boolean(shipment) && (isOwnFleet(shipment?.provider) || shipment?.provider === "local" || /vaidya gogate|vgmf express/i.test(String(shipment?.courier || "")));
    const otp = own ? String(shipment?.deliveryOtp || "") : "";
    const payNote = otp ? `${basePay} Delivery OTP: ${otp} (share it only with our delivery partner at your door).` : basePay;
    return {
      params: [name, order.id, items, courier, awb, payNote, url],
      legacy: [name, order.id, courier, awb, payNote],
    };
  }
  const delivered = [...(order.history ?? [])].reverse().find((entry) => entry.status === "Delivered")?.at;
  const deliveredDate = day(delivered) || day(new Date().toISOString());
  const feedbackUrl = `${url}#feedback`;
  return {
    params: [name, order.id, items, deliveredDate, `${courier} · ${awb}`, feedbackUrl],
    legacy: [name, order.id, deliveredDate, courier, awb, feedbackUrl],
  };
}

function statusText(order: Order, status: string) {
  if (!COURIER_STAGES[status]) return status;
  const shipment = findShopShipment(order.id);
  const courier = order.courierName || shipment?.courier;
  const awb = order.trackingId || shipment?.awb;
  if (!courier || !awb) return status;
  if (status === "Shipped") {
    const expected = day(shipment?.expectedBy) || order.eta;
    return `Shipped with ${courier}, tracking ID ${awb}${expected ? `, expected delivery ${expected}` : ""}`;
  }
  return status === "Out for Delivery" ? `Out for delivery with ${courier}, tracking ID ${awb}` : `Delivered by ${courier}, tracking ID ${awb}`;
}

function statusDetail(order: Order, status: string) {
  if (status === "Packed") {
    return order.preorderPayment && !order.preorderPayment.balancePaidAt
      ? "Please complete the pre-order balance so we can dispatch your parcel."
      : "Packed and waiting for courier pickup.";
  }
  if (status === "Cancelled") {
    return order.paymentStatus === "Paid" || order.paymentStatus === "Partially Paid" || order.paymentStatus === "Refunded"
      ? "Any online payment will be refunded to your original payment method."
      : "Order cancelled. No payment was collected.";
  }
  if (status === "Failed") return "The courier could not deliver your parcel. Please contact care@vaidyagogate.org to reschedule.";
  return statusText(order, status);
}

/** Sends the courier-detail template when one is mapped for this status; null when the status has none. */
async function courierAlert(order: Order, phone: string, name: string, status: string) {
  const event = COURIER_STAGES[status];
  if (!event) return null;
  const { params, legacy } = courierParams(order, status, name);
  const wa = savedAdminIntegrations().whatsapp as (Parameters<typeof whatsAppTemplateFor>[0] & { templates?: { name: string; variables?: number }[] }) | undefined;
  const dedicated = Boolean(wa) && whatsAppSenders(wa!).some((provider) => {
    const template = whatsAppTemplateFor(wa!, provider, event);
    const saved = (wa!.templates ?? []).find((item) => item.name === template);
    return Boolean(template) && Number(saved?.variables) >= legacy.length;
  });
  if (!dedicated) return null;
  return sendWhatsAppAlert(event, { phone, name, params, fallbackEvent: "order-status", fallbackParams: legacy }).catch(() => false);
}

/** Pre-orders get their own WhatsApp templates (advance and balance shown); false when none is mapped, so the normal one goes instead. */
async function preorderAlert(kind: "placed" | "update", order: Order, phone: string, name: string, status: string = order.status) {
  const plan = order.preorderPayment;
  if (!plan || (kind === "placed" && !plan.advancePaidAt)) return false;
  const due = plan.balancePaidAt
    ? "Nil (fully paid)"
    : `${rupees(plan.balance + (plan.shipping ?? 0))}${plan.shippingDue && !plan.shipping ? " + courier when ready" : ""}`;
  const items = itemsSummary(order);
  const url = trackLink(order);
  return kind === "placed"
    ? sendWhatsAppAlert("preorder-placed", {
        phone,
        name,
        params: [name, order.id, items, rupees(plan.advance), due, url],
        fallbackParams: [name, order.id, rupees(plan.advance), due],
      }).catch(() => false)
    : sendWhatsAppAlert("preorder-update", {
        phone,
        name,
        params: [name, order.id, items, status, due, url],
        fallbackParams: [name, order.id, status, due],
      }).catch(() => false);
}

/** Sends detailed WhatsApp notifications for refund initiated, refund processed (refunded), bank reference (RRN/ARN), and refund failed. */
async function refundAlert(key: string, order: Order, phone: string, name: string) {
  const refund = (order.refunds ?? []).find((item) => key.startsWith(`refund:${item.id}`)) ?? order.refunds?.at(-1);
  if (!refund) return false;
  const amount = rupees(refund.amount);
  const dest = refund.destination === "store_credit" ? "Foundation Wallet (Store Credit)" : "Original payment method";
  const bankRef = refund.arn || refund.rrn || refund.utr || "";
  const refId = refund.gatewayRefundId || refund.vgmfId || refund.id;
  const url = trackLink(order);
  const legacy = [name, order.id, amount];

  if (key.endsWith(":rrn") && bankRef) {
    return sendWhatsAppAlert("refund-bank-reference", {
      phone,
      name,
      params: [name, order.id, amount, bankRef, refund.vgmfId || refId, url],
      fallbackEvent: "refund",
      fallbackParams: legacy,
    }).catch(() => false);
  }
  if (key.endsWith(":processed") || refund.status === "processed") {
    const creditNote = refund.destination === "store_credit"
      ? "Credited immediately to your wallet"
      : `By ${creditDay(refund)} (5–7 working days)`;
    return sendWhatsAppAlert("refund-processed", {
      phone,
      name,
      params: [name, order.id, amount, dest, bankRef || refId, creditNote, url],
      fallbackEvent: "refund",
      fallbackParams: legacy,
    }).catch(() => false);
  }
  if (key.endsWith(":failed") || refund.status === "failed") {
    return sendWhatsAppAlert("order-status", {
      phone,
      name,
      params: [name, order.id, itemsSummary(order), "Refund Attention Needed", `Automatic refund of ${amount} could not complete. Our team will contact you.`, url],
      fallbackParams: [name, order.id, `Refund of ${amount} failed — our team will contact you`],
    }).catch(() => false);
  }
  const timeline = refund.destination === "store_credit" ? "Instant credit to wallet" : "5–7 working days";
  return sendWhatsAppAlert("refund", {
    phone,
    name,
    params: [name, order.id, amount, dest, refId, timeline, url],
    fallbackParams: legacy,
  }).catch(() => false);
}

function callMissedAlert(order: Order, phone: string, name: string) {
  const call = order.callAttempt;
  if (!call) return false;
  const calledOn = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(Date.parse(call.at) || Date.now());
  return sendWhatsAppAlert("order-call-missed", {
    phone,
    name,
    params: [name, order.id, itemsSummary(order), call.reason, calledOn, call.action, trackLink(order)],
    fallbackEvent: "order-status",
    fallbackParams: [name, order.id, `We tried to call you: ${call.reason}. ${call.action}`],
  }).catch(() => false);
}

/** Admin "Resend WhatsApp": sends that stage's WhatsApp update again for any order. */
export async function resendWhatsAppStage(orderId: string, key: string) {
  const order = findShopOrder(orderId);
  if (!order) throw new Error("Order not found.");
  const phone = order.deliveryAddress?.phone;
  if (!phone) throw new Error("This order has no phone number.");
  const name = order.deliveryAddress?.fullName || "Reader";
  const event = STAGE_EVENTS.find(([pattern]) => pattern.test(key))?.[1];
  const items = itemsSummary(order);
  const url = trackLink(order);
  if (key === "placed") {
    return (
      (await preorderAlert("placed", order, phone, name)) ||
      sendWhatsAppAlert("order-placed", {
        phone,
        name,
        params: [name, order.id, items, rupees(order.total), order.paymentStatus || "Pending", url],
        fallbackParams: [name, order.id, rupees(order.total)],
      })
    );
  }
  if (key.startsWith("refund:")) return refundAlert(key, order, phone, name);
  if (key.startsWith("call-missed:")) return callMissedAlert(order, phone, name);
  if (key.startsWith("return:")) {
    const retStatus = `Return ${order.returnRequest?.status ?? "updated"}`;
    return sendWhatsAppAlert("order-return-update", {
      phone,
      name,
      params: [name, order.id, items, retStatus, order.returnRequest?.note || "Check My Orders for the latest return details.", url],
      fallbackEvent: "order-status",
      fallbackParams: [name, order.id, retStatus],
    });
  }
  const status = key.startsWith("status:") ? key.slice(7) : order.status;
  const courier = await courierAlert(order, phone, name, status);
  if (courier !== null) return courier;
  if (await preorderAlert("update", order, phone, name, statusText(order, status))) return true;
  if (status === "Packed") {
    return sendWhatsAppAlert("order-packed", {
      phone,
      name,
      params: [name, order.id, items, statusDetail(order, status), url],
      fallbackEvent: "order-status",
      fallbackParams: [name, order.id, statusText(order, status)],
    });
  }
  return sendWhatsAppAlert(event ?? "order-status", {
    phone,
    name,
    params: [name, order.id, items, status, statusDetail(order, status), url],
    fallbackEvent: "order-status",
    fallbackParams: [name, order.id, statusText(order, status)],
  });
}

/** WhatsApp update for an order stage, using the template mapped to that event (or to "Order status changed"). */
async function whatsAppStage(key: string, order: Order, name: string) {
  const phone = order.deliveryAddress?.phone;
  if (!phone) return;
  const event = STAGE_EVENTS.find(([pattern]) => pattern.test(key))?.[1];
  const items = itemsSummary(order);
  const url = trackLink(order);
  // Website checkout sends its own "order placed" alert from the browser; app and chat orders get it here.
  if (key === "placed") {
    if (order.createdBy !== "WhatsApp" && order.createdBy !== "Android app") return;
    if (await preorderAlert("placed", order, phone, name)) return;
    await sendWhatsAppAlert("order-placed", {
      phone,
      name,
      params: [name, order.id, items, rupees(order.total), order.paymentStatus || "Pending", url],
      fallbackParams: [name, order.id, rupees(order.total)],
    }).catch(() => false);
    return;
  }
  if (key.startsWith("refund:")) {
    await refundAlert(key, order, phone, name);
    return;
  }
  if (key.startsWith("status:") && key !== "status:split") {
    const status = key.slice(7);
    if ((await courierAlert(order, phone, name, status)) !== null) return;
    if (await preorderAlert("update", order, phone, name, statusText(order, status))) return;
    if (status === "Packed") {
      await sendWhatsAppAlert("order-packed", {
        phone,
        name,
        params: [name, order.id, items, statusDetail(order, status), url],
        fallbackEvent: "order-status",
        fallbackParams: [name, order.id, statusText(order, status)],
      }).catch(() => false);
      return;
    }
    await sendWhatsAppAlert(event ?? "order-status", {
      phone,
      name,
      params: [name, order.id, items, status, statusDetail(order, status), url],
      fallbackEvent: "order-status",
      fallbackParams: [name, order.id, statusText(order, status)],
    }).catch(() => false);
    return;
  }
  if (key.startsWith("return:")) {
    const retStatus = `Return ${order.returnRequest?.status ?? "updated"}`;
    await sendWhatsAppAlert("order-return-update", {
      phone,
      name,
      params: [name, order.id, items, retStatus, order.returnRequest?.note || "Check My Orders for the latest return details.", url],
      fallbackEvent: "order-status",
      fallbackParams: [name, order.id, retStatus],
    }).catch(() => false);
  }
}

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

function pickupDay(date: string) {
  const day = new Date(`${date}T12:00:00+05:30`);
  return Number.isNaN(day.getTime()) ? date : day.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

function stagesFor(prev: Order | undefined, next: Order): Stage[] {
  const stages: Stage[] = [];
  // Child orders of a split are announced once, by the parent's split email.
  if (next.splitFrom && !prev) return stages;
  if (next.splitInto?.length && !prev?.splitInto?.length) {
    const fee = Math.max(0, next.platformFee ?? 0);
    const openPlan = next.preorderPayment && !next.preorderPayment.balancePaidAt;
    stages.push({
      key: "status:split",
      subject: `Your order ${next.id} will be sent in ${next.splitInto.length} parts`,
      intro: `To send what is ready sooner, your order ${next.id} is now split into ${next.splitInto.length} orders.`,
      next: [
        ...next.splitInto.map((row) => `Order ${row.id}: ${row.label}`),
        "Each part has its own order number in My Orders, with its own packing, courier charge, payment link and tracking.",
        openPlan ? "Your advance is shared across the parts by book. Each part's payment link asks only for that part's remaining book balance plus its packing and courier." : "",
        fee ? `The platform fee (${rupees(fee)}) was charged once on order ${next.id} and is not charged again.` : "",
      ],
    });
    return stages;
  }
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
  const ask = next.addressRequest;
  if (ask && !ask.doneAt && ask.at !== prev?.addressRequest?.at) {
    stages.push({
      key: `address-request:${ask.at}`,
      subject: ask.fix ? `Please check your delivery address for order ${next.id}` : `Add your delivery address for order ${next.id}`,
      intro: ask.fix
        ? `The delivery address on your order ${next.id} looks incomplete or incorrect, so we have held the parcel before sending it to the courier.`
        : `As requested, your order ${next.id} will now be sent by courier instead of store pickup.`,
      next: ask.fix
        ? [
            `Please correct your delivery address, phone and PIN code here: ${siteConfig.url}/account/orders/${encodeURIComponent(next.id)}#add-address`,
            "We will send your order as soon as it is updated.",
          ]
        : [
            `Please add your full delivery address, phone and PIN code here: ${siteConfig.url}/account/orders/${encodeURIComponent(next.id)}#add-address`,
            "We will pack it and send the courier charge as a balance payment link. The order ships once that is paid.",
          ],
    });
  }
  const call = next.callAttempt;
  if (call && call.at !== prev?.callAttempt?.at) {
    stages.push({
      key: `call-missed:${call.at}`,
      subject: `We tried to reach you about order ${next.id}`,
      intro: `Our team tried to call you about your order ${next.id}, but we could not reach you.`,
      next: [`Reason for our call: ${call.reason}.`, `${call.action}.`],
    });
  }
  const pickup = next.deliveryMode === "store_pickup";
  const windowLine = next.pickupWindow ? `Your pickup slot: ${pickupDay(next.pickupWindow.date)}, ${next.pickupWindow.slot}.` : "";
  const win = next.pickupWindow;
  if (pickup && win && win.at !== prev?.pickupWindow?.at && !["Cancelled", "Delivered"].includes(next.status)) {
    stages.push({
      key: `pickup-window:${win.at}`,
      subject: `Order ${next.id}: pickup on ${pickupDay(win.date)}, ${win.slot}`,
      intro: `Your order ${next.id} ${next.status === "Packed" || next.status === "Ready to Ship" ? "is ready to collect" : "will be ready to collect"}.`,
      next: [windowLine, `Pickup address: ${siteConfig.address}.`, "Bring your order ID and the pickup code shown in My Orders. If the slot does not suit you, reply to this email."],
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
        next: [track || "Tracking details will appear in My Orders shortly.", findShopShipment(next.id)?.expectedBy ? `Expected delivery: ${day(findShopShipment(next.id)?.expectedBy)}` : "", "Follow the live status in My Orders. Keep your phone reachable for the courier."],
      },
      "Out for Delivery": {
        subject: `Order ${next.id} is out for delivery`,
        intro: `Your order ${next.id} is out for delivery today.`,
        next: [isCod(next) ? `Please keep ${rupees(next.total)} ready to pay the courier.` : "No payment is due at the door.", "Keep your phone reachable. Check the parcel is sealed before accepting it."],
      },
      Delivered: {
        subject: `Order ${next.id} delivered`,
        intro: `Your order ${next.id} has been delivered. We hope the books serve you well.`,
        next: [`Please rate our delivery and the books here: ${siteConfig.url}/account/orders/${encodeURIComponent(next.id)}#feedback`, "If any item arrived damaged, open the order in My Orders and request a replacement with photos.", "Your invoice is available in My Orders."],
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
    if (pickup) {
      const ready = {
        subject: `Order ${next.id} is ready for pickup`,
        intro: `Your order ${next.id} is ready to collect.`,
        next: [windowLine, `Pickup address: ${siteConfig.address}.`, "Bring your order ID and the pickup code shown in My Orders."],
      };
      map.Packed = ready;
      map["Ready to Ship"] = ready;
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
          store ? "The store credit is available on your next order." : key.endsWith("processed") ? `Expected in your account by ${creditDay(refund)}. Quote the bank reference to your bank if it does not appear by then.` : "Banks usually take 3–5 working days to process the refund. Follow it in My Orders.",
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
  const phone = next.deliveryAddress?.phone;
  // Refund alerts go from the server for every refund, whichever desk issued it.
  for (const refund of next.refunds ?? []) {
    const key = `refund:${refund.id}`;
    if (!phone || sent.has(key) || (prev?.refunds ?? []).some((item) => item.id === refund.id)) continue;
    markSent(next.id, key);
    const name = next.deliveryAddress?.fullName || "Reader";
    void sendWhatsAppAlert("refund", { phone, name, params: [name, next.id, rupees(refund.amount)] }).catch(() => false);
  }
  for (const stage of stagesFor(prev, next)) {
    if (options.statusOnly && !/^(status|address-request|call-missed|pickup-window):/.test(stage.key)) continue;
    if (sent.has(stage.key)) continue;
    markSent(next.id, stage.key);
    const name = next.deliveryAddress?.fullName || "Reader";
    void whatsAppStage(stage.key, next, name);
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
      const appStage = stageKeyFromEvent(stage.key);
      const appCopy = appStage ? renderOrderStageNotification(appStage, next) : { enabled: true, title: subject, body: stage.intro };
      if (appCopy.enabled) {
        void pushToCustomer(
          { email: to || undefined, phone: next.deliveryAddress?.phone, accountId: next.userId },
          { title: appCopy.title, body: appCopy.body, url: `/account/orders/${encodeURIComponent(next.id)}` }
        ).catch(() => undefined);
      }
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
    const appStage = stageKeyFromEvent(stage.key);
    const appCopy = appStage ? renderOrderStageNotification(appStage, next) : { enabled: true, title: stage.subject, body: stage.intro };
    if (appCopy.enabled) {
      void pushToCustomer(
        { email: to || undefined, phone: next.deliveryAddress?.phone, accountId: next.userId },
        { title: appCopy.title, body: appCopy.body, url: `/account/orders/${encodeURIComponent(next.id)}` }
      ).catch(() => undefined);
    }
    if (to) await sendMobileEmail(to, stage.subject, body).catch(() => undefined);
  }
}
