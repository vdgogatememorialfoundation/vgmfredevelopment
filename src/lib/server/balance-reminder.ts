import { siteConfig } from "@/lib/constants";
import { findShopOrder, listShopOrders, patchShopOrder } from "@/lib/server/shop-orders";
import { razorpayCreds, razorpayLink, razorpayLinkCancel, razorpayLinkStatus } from "@/lib/server/providers";
import { sendWhatsAppAlert } from "@/lib/server/whatsapp-inbox";
import { sendMobileEmail } from "@/lib/server/mobile-mail";
import type { Order } from "@/types";

export type ReminderChannel = "whatsapp" | "email";

const PACKED_STATUSES = new Set(["Packed", "Ready to Ship", "To Ship"]);

/** Remaining balance due on an order in INR (0 when fully paid or cancelled). */
export function orderBalanceDue(order: Order): number {
  if (order.status === "Cancelled") return 0;
  if (order.paymentStatus === "Paid") {
    if (order.courierUpgrade && !order.courierUpgrade.paidAt && order.courierUpgrade.amount > 0) {
      return Math.round(order.courierUpgrade.amount * 100) / 100;
    }
    return 0;
  }
  if (order.preorderPayment && !order.preorderPayment.balancePaidAt) {
    return Math.max(0, Math.round(Number(order.preorderPayment.balance || 0) * 100) / 100);
  }
  const advance = order.preorderPayment?.advancePaidAt ? Number(order.preorderPayment.advance || 0) : 0;
  const paid = order.paymentStatus === "Partially Paid" && order.amountPaid !== undefined ? Number(order.amountPaid) : advance;
  return Math.max(0, Math.round((Number(order.total || 0) - paid) * 100) / 100);
}

export function isPackedBalanceDue(order: Order): boolean {
  if (order.splitInto?.length) return false;
  return PACKED_STATUSES.has(order.status) && orderBalanceDue(order) > 0;
}

export function listPackedUnpaidOrders(): Order[] {
  return listShopOrders().filter(isPackedBalanceDue);
}

function itemsLine(order: Order) {
  const list = (order.items ?? []).map((item) => `${item.title} × ${item.quantity}`).filter(Boolean);
  const joined = list.join(", ") || "VGMF Publication";
  return joined.length > 110 ? `${joined.slice(0, 107)}…` : joined;
}

function isLinkStillValid(link?: { url?: string; expiresAt?: string }) {
  if (!link?.url) return false;
  if (!link.expiresAt) return true;
  const exp = Date.parse(link.expiresAt);
  return Number.isFinite(exp) && exp > Date.now() + 10 * 60_000;
}

/** Reuse a valid existing payment link, else create a fresh Razorpay link (or fallback to My Orders URL). */
async function ensureBalancePayUrl(order: Order, due: number): Promise<{ url: string; alreadyPaid?: boolean }> {
  const fallbackUrl = `${siteConfig.url}/account/orders/${encodeURIComponent(order.id)}`;
  const isPreorder = Boolean(order.preorderPayment && !order.preorderPayment.balancePaidAt);
  const existing = isPreorder ? order.preorderPayment?.link : order.paymentLink;
  const creds = razorpayCreds({});

  if (existing?.provider === "razorpay" && existing.id && creds) {
    try {
      const check = await razorpayLinkStatus(creds, existing.id);
      if (check.status === "paid") {
        const at = new Date().toISOString();
        if (isPreorder && order.preorderPayment) {
          patchShopOrder(order.id, {
            paymentStatus: "Paid",
            preorderPayment: { ...order.preorderPayment, balancePaidAt: at, balanceRef: check.paymentId },
            history: [...(order.history ?? []), { at, status: order.status, note: `Balance link already paid on Razorpay (${check.paymentId || existing.id}).` }],
          });
        } else {
          patchShopOrder(order.id, {
            paymentStatus: "Paid",
            paidAt: at,
            paymentRef: check.paymentId || order.paymentRef,
            history: [...(order.history ?? []), { at, status: order.status, note: `Payment link already paid on Razorpay (${check.paymentId || existing.id}).` }],
          });
        }
        return { url: existing.url, alreadyPaid: true };
      }
      if (check.status === "created" && isLinkStillValid(existing)) {
        return { url: existing.url };
      }
      // Old 2-day link expired or near expiry: cancel it cleanly before issuing a fresh 2-day Razorpay link.
      if (check.status === "created") {
        await razorpayLinkCancel(creds, existing.id).catch(() => undefined);
      }
    } catch {
      if (isLinkStillValid(existing)) return { url: existing.url };
    }
  } else if (isLinkStillValid(existing)) {
    return { url: existing!.url };
  }

  if (!creds) return { url: fallbackUrl };

  try {
    const address = order.deliveryAddress;
    const expiryMinutes = 48 * 60;
    const refSuffix = Date.now().toString(36).slice(-5);
    const created = await razorpayLink(creds, {
      amount: due,
      orderId: `${order.id}-R${refSuffix}`.slice(0, 40),
      name: address?.fullName || "Customer",
      email: address?.email || order.accountEmail,
      phone: address?.phone,
      description: `Remaining balance for packed VGMF order ${order.id}`,
      callbackUrl: `${siteConfig.url}/pay/${order.id}${isPreorder ? "?part=balance&done=1" : "?done=1"}`,
      expiryMinutes,
    });
    const savedLink = {
      url: created.url,
      id: created.id,
      provider: "razorpay" as const,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiryMinutes * 60_000).toISOString(),
    };
    if (isPreorder && order.preorderPayment) {
      patchShopOrder(order.id, { preorderPayment: { ...order.preorderPayment, link: savedLink } });
    } else {
      patchShopOrder(order.id, { paymentLink: { ...savedLink, amount: due } });
    }
    return { url: created.url };
  } catch {
    return { url: existing?.url || fallbackUrl };
  }
}

export type BalanceReminderResult = {
  orderId: string;
  ok: boolean;
  alreadyPaid?: boolean;
  due: number;
  whatsapp: "sent" | "skipped" | "failed";
  email: "sent" | "skipped" | "failed";
  payUrl?: string;
  error?: string;
};

export async function sendBalanceDueReminder(
  orderId: string,
  options: { channels?: ReminderChannel[]; by?: string } = {}
): Promise<BalanceReminderResult> {
  const order = findShopOrder(orderId);
  if (!order) return { orderId, ok: false, due: 0, whatsapp: "skipped", email: "skipped", error: "Order not found." };
  const due = orderBalanceDue(order);
  if (due <= 0) {
    return { orderId, ok: false, due: 0, whatsapp: "skipped", email: "skipped", error: "No balance is due on this order." };
  }
  const channels = options.channels?.length ? options.channels : (["whatsapp", "email"] as ReminderChannel[]);
  const wantWa = channels.includes("whatsapp");
  const wantEmail = channels.includes("email");

  const { url: payUrl, alreadyPaid } = await ensureBalancePayUrl(order, due);
  if (alreadyPaid) {
    return { orderId, ok: true, alreadyPaid: true, due: 0, whatsapp: "skipped", email: "skipped", payUrl };
  }

  const name = order.deliveryAddress?.fullName || "Customer";
  const phone = order.deliveryAddress?.phone || "";
  const emailTo = order.deliveryAddress?.email || order.accountEmail || "";
  const dueText = `₹${due.toLocaleString("en-IN")}`;
  const paidSoFar = Math.max(0, Math.round((Number(order.total || 0) - due) * 100) / 100);
  const items = itemsLine(order);
  const isPreorder = Boolean(order.preorderPayment);

  let waStatus: "sent" | "skipped" | "failed" = "skipped";
  let emailStatus: "sent" | "skipped" | "failed" = "skipped";

  if (wantWa) {
    if (!phone) {
      waStatus = "failed";
    } else {
      const event = isPreorder ? "preorder-ready" : "payment-link";
      const sent = await sendWhatsAppAlert(event, {
        phone,
        name,
        params: [name, order.id, items, dueText, payUrl],
        fallbackEvent: isPreorder ? "payment-link" : "order-status",
        fallbackParams: [name, order.id, dueText, payUrl],
      }).catch(() => false);
      waStatus = sent ? "sent" : "failed";
    }
  }

  if (wantEmail) {
    if (!emailTo || !emailTo.includes("@")) {
      emailStatus = "failed";
    } else {
      const subject = `Payment reminder: Pay remaining balance ${dueText} for packed order ${order.id} for dispatch`;
      const body = [
        `Dear ${name},`,
        "",
        "Namaste, and greetings from Vaidya Gogate Memorial Foundation.",
        "",
        `Your order ${order.id} is packed and ready at our dispatch desk.`,
        `Please pay the remaining balance of ${dueText} so we can ship your parcel soon and get it delivered to you without delay.`,
        "",
        "Order summary:",
        `• Order ID: ${order.id}`,
        `• Items: ${items}`,
        `• Order Total: ₹${Number(order.total || 0).toLocaleString("en-IN")}`,
        paidSoFar > 0 ? `• Amount Paid: ₹${paidSoFar.toLocaleString("en-IN")}` : "",
        `• Remaining Balance Due: ${dueText}`,
        "",
        "Pay securely online here:",
        payUrl,
        "",
        "As soon as the remaining balance is received, your parcel will be handed over to our courier partner and tracking details will be shared with you.",
        "",
        "With warm regards,",
        "Vaidya Gogate Memorial Foundation",
      ]
        .filter((line, idx, arr) => line !== "" || arr[idx - 1] !== "")
        .join("\n");
      const sent = await sendMobileEmail(emailTo, subject, body).catch(() => false);
      emailStatus = sent ? "sent" : "failed";
    }
  }

  const deliveredChannels = [
    ...(waStatus === "sent" ? ["WhatsApp"] : []),
    ...(emailStatus === "sent" ? ["Email"] : []),
  ];
  const at = new Date().toISOString();
  if (deliveredChannels.length > 0) {
    const prevCount = order.balanceReminder?.count ?? 0;
    patchShopOrder(order.id, {
      balanceReminder: {
        lastAt: at,
        count: prevCount + 1,
        channels: deliveredChannels,
        due,
      },
      history: [
        ...(order.history ?? []),
        {
          at,
          status: order.status,
          by: options.by || "Desk",
          note: `Balance due reminder (${dueText}) sent via ${deliveredChannels.join(" & ")} so the packed parcel can ship soon.`,
        },
      ],
    });
  }

  return {
    orderId,
    ok: deliveredChannels.length > 0,
    due,
    whatsapp: waStatus,
    email: emailStatus,
    payUrl,
    error: deliveredChannels.length === 0 ? "Could not deliver reminder on WhatsApp or Email (check phone/email & gateway config)." : undefined,
  };
}
