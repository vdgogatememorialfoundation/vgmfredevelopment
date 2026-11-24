import { readFileSync, writeFileSync } from "node:fs";
import type { Order } from "@/types";
import { savedAdminIntegrations } from "@/lib/server/admin-integrations";
import { sendMobileEmail } from "@/lib/server/mobile-mail";
import { dataFile } from "@/lib/server/paths";
import { listShopOrders, patchShopOrder } from "@/lib/server/shop-orders";

const FILE = dataFile("payment-reminders.json");
const DAY = 24 * 60 * 60 * 1000;
let started = false;
let running = false;

type Log = Record<string, { count: number; last: string; due: number }>;

function readLog(): Log {
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as Log;
  } catch {
    return {};
  }
}

export function reminderSettings() {
  const razorpay = (savedAdminIntegrations().razorpay ?? {}) as Record<string, unknown>;
  return {
    enabled: razorpay.balanceReminders !== false,
    everyDays: Math.min(30, Math.max(0.5, Number(razorpay.reminderEveryDays) || 1)),
    max: Math.min(10, Math.max(1, Math.round(Number(razorpay.reminderMax) || 3))),
  };
}

function dueOn(order: Order) {
  const plan = order.preorderPayment;
  const paid = order.amountPaid ?? (plan?.advancePaidAt ? plan.advance : 0);
  return Math.max(0, Math.round((order.total - paid) * 100) / 100);
}

function activeLink(order: Order, now: number) {
  const link = order.preorderPayment?.link ?? order.paymentLink;
  if (!link?.url) return "";
  const expires = Date.parse(("expiresAt" in link && link.expiresAt) || "");
  return Number.isFinite(expires) && expires < now + 60 * 60 * 1000 ? "" : link.url;
}

function siteUrl() {
  return (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://vaidyagogate.org").replace(/\/+$/, "");
}

/** Emails customers with a part-paid order about the balance, every few days, up to a set number of times (9 am – 8 pm IST). */
export async function sendPaymentReminders(now = new Date()) {
  if (running) return;
  running = true;
  try {
    const hourIst = new Date(now.getTime() + 330 * 60 * 1000).getUTCHours();
    if (hourIst < 9 || hourIst >= 20) return;
    const settings = reminderSettings();
    if (!settings.enabled) return;
    const log = readLog();
    let changed = false;
    for (const order of listShopOrders()) {
      if (order.paymentStatus !== "Partially Paid" || ["Cancelled", "Failed", "Refunded"].includes(order.status) || order.splitInto?.length) continue;
      // A pre-order balance is due only once the balance link has gone out (the book is ready).
      if (order.preorderPayment && !order.preorderPayment.link) continue;
      const due = dueOn(order);
      const email = order.deliveryAddress?.email || order.accountEmail;
      if (due <= 0 || !email) continue;
      const entry = log[order.id]?.due === due ? log[order.id] : { count: 0, last: "", due };
      if (entry.count >= settings.max) continue;
      const since = Date.parse(entry.last || order.preorderPayment?.link?.createdAt || order.paymentLink?.createdAt || order.paidAt || order.date);
      if (Number.isFinite(since) && now.getTime() - since < settings.everyDays * DAY) continue;
      const link = activeLink(order, now.getTime());
      const name = order.deliveryAddress?.fullName || "Customer";
      const body = [
        `Dear ${name},`,
        "",
        `This is a reminder that ₹${due} is still due on your order ${order.id} (total ₹${order.total}).`,
        link
          ? `Pay securely here: ${link}`
          : `Please reply to this email or contact us for a fresh payment link. You can see the order at ${siteUrl()}/orders`,
        "",
        "Your order is dispatched once the full amount is paid. If you have already paid, please ignore this email.",
        "",
        "Warm regards,",
        "Vaidya Gogate Memorial Foundation",
      ].join("\n");
      const sent = await sendMobileEmail(email, `Payment reminder: ₹${due} due on order ${order.id}`, body).catch(() => null);
      if (!sent) continue;
      log[order.id] = { count: entry.count + 1, last: now.toISOString(), due };
      changed = true;
      patchShopOrder(order.id, {
        history: [
          ...(order.history ?? []),
          { at: now.toISOString(), status: order.status, note: `Payment reminder ${entry.count + 1} of ${settings.max} emailed · ₹${due} due${link ? " · with payment link" : " · link expired, asked to contact us"}` },
        ],
      });
    }
    if (changed) writeFileSync(FILE, JSON.stringify(log, null, 2));
  } finally {
    running = false;
  }
}

export function startPaymentReminders() {
  if (started) return;
  started = true;
  setInterval(() => void sendPaymentReminders(), 30 * 60 * 1000).unref?.();
  setTimeout(() => void sendPaymentReminders(), 90_000).unref?.();
}
