import { readFileSync, writeFileSync } from "node:fs";
import { dataFile } from "@/lib/server/paths";
import { sendMobileEmail } from "@/lib/server/mobile-mail";
import { findShopOrder } from "@/lib/server/shop-orders";
import type { Order } from "@/types";

export type IssuedInvoice = { number: string; issuedAt: string; emailedTo?: string };

function file() {
  return dataFile("delivery-invoices.json");
}

function readAll(): Record<string, IssuedInvoice> {
  try {
    const parsed = JSON.parse(readFileSync(file(), "utf8")) as Record<string, IssuedInvoice>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function issuedInvoice(orderId: string): IssuedInvoice | undefined {
  return readAll()[orderId];
}

function rupees(value: number) {
  return `₹${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;
}

function esc(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function day(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

function siteUrl() {
  return (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
}

export function invoiceLink(order: Order) {
  const base = siteUrl();
  return base && order.trackToken ? `${base}/api/shop/invoice/${order.trackToken}` : "";
}

/** Printable tax invoice for a delivered order. */
export function deliveryInvoiceHtml(order: Order, invoice: IssuedInvoice) {
  const address = order.deliveryAddress;
  const rows = order.items
    .map(
      (item, index) =>
        `<tr><td>${index + 1}</td><td>${esc(item.title)}</td><td class="r">${item.quantity}</td><td class="r">${rupees(item.price)}</td><td class="r">${rupees(item.price * item.quantity)}</td></tr>`
    )
    .join("");
  const line = (label: string, value: number, bold = false) =>
    `<tr><td>${bold ? `<b>${label}</b>` : label}</td><td class="r">${bold ? `<b>${rupees(value)}</b>` : rupees(value)}</td></tr>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${esc(invoice.number)}</title>
<style>
body{font-family:Georgia,"Times New Roman",serif;color:#0B1F3A;margin:0;background:#f7f3ea}
.page{max-width:760px;margin:24px auto;background:#fff;border:1px solid #e4d8c4;padding:36px}
h1{font-size:22px;margin:0;color:#6A1F1F}.muted{color:#5C5648;font-size:13px}
.head{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #B8953A;padding-bottom:16px}
.grid{display:flex;justify-content:space-between;gap:24px;margin-top:18px;font-size:14px}
table{width:100%;border-collapse:collapse;margin-top:18px;font-size:14px}
th{background:#fffaf0;text-align:left;border-bottom:1px solid #e4d8c4;padding:8px}
td{border-bottom:1px solid #eee7da;padding:8px}.r{text-align:right}
.totals{width:50%;margin-left:auto}.foot{margin-top:28px;font-size:12px;color:#5C5648;text-align:center}
.print{display:inline-block;margin:16px auto 0;padding:8px 16px;background:#8F2D2D;color:#fff;border:0;border-radius:8px;font:inherit;cursor:pointer}
@media print{body{background:#fff}.page{border:0;margin:0}.print{display:none}}
</style></head><body><div class="page">
<div class="head"><div style="display:flex;gap:12px;align-items:center"><img src="${siteUrl()}/uploads/site-logo.png" alt="" style="height:56px;width:auto;max-width:160px;object-fit:contain" onerror="this.style.display='none'"/><div><h1>Vaidya Gogate Memorial Foundation</h1><p class="muted">Pune, Maharashtra, India</p></div></div>
<div style="text-align:right"><p style="margin:0;font-size:18px"><b>Tax invoice</b></p>
<p class="muted">Invoice no. ${esc(invoice.number)}<br>Invoice date ${esc(day(invoice.issuedAt))}<br>Order no. ${esc(order.id)}<br>Order date ${esc(day(order.date))}</p></div></div>
<div class="grid"><div><b>Billed and shipped to</b><br>${esc(address?.fullName)}<br>${esc(address?.line1)}${address?.landmark ? `, ${esc(address.landmark)}` : ""}<br>${esc(address?.city)}, ${esc(address?.state)} ${esc(address?.pincode)}</div>
<div style="text-align:right"><b>Payment</b><br>${esc(order.paymentStatus)}${order.paymentMethod ? ` · ${esc(order.paymentMethod)}` : ""}<br>${order.courierName ? `Delivered by ${esc(order.courierName)}` : ""}</div></div>
<table><thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<table class="totals">${line("Subtotal", order.subtotal)}${order.discount ? line("Discount", -order.discount) : ""}${order.gst ? line("GST", order.gst) : ""}${order.platformFee ? line("Platform fee", order.platformFee) : ""}${line("Shipping", order.shipping)}${line("Total", order.total, true)}</table>
<p class="foot">This is a computer-generated invoice and needs no signature.<br>Thank you for supporting the Vaidya Gogate Memorial Foundation.</p>
<div style="text-align:center"><button class="print" onclick="window.print()">Print or save as PDF</button></div>
</div></body></html>`;
}

let issuing = false;

/** Issues the invoice once, the first time an order is seen as Delivered, and emails the customer. */
export async function issueDeliveryInvoice(orderId: string) {
  if (issuing) return;
  issuing = true;
  try {
    const order = findShopOrder(orderId);
    if (!order || order.status !== "Delivered") return;
    const all = readAll();
    if (all[orderId]) return;
    const issuedAt = new Date().toISOString();
    const invoice: IssuedInvoice = { number: `${issuedAt.slice(0, 4)}${order.id}`, issuedAt };
    const to = order.deliveryAddress?.email || order.accountEmail || "";
    if (to) invoice.emailedTo = to;
    all[orderId] = invoice;
    writeFileSync(file(), JSON.stringify(all));
    if (!to) return;
    const link = invoiceLink(order);
    const body = [
      `Namaskar ${order.deliveryAddress?.fullName || ""},`,
      "",
      `Your order ${order.id} has been delivered. Your invoice ${invoice.number} is ready.`,
      "",
      ...order.items.map((item) => `${item.title} × ${item.quantity}: ${rupees(item.price * item.quantity)}`),
      `Total: ${rupees(order.total)}`,
      "",
      link ? `View, print or save the invoice: ${link}` : "You can print the invoice from My Orders.",
    ].join("\n");
    await sendMobileEmail(to, `Invoice ${invoice.number} for order ${order.id}`, body).catch(() => undefined);
  } finally {
    issuing = false;
  }
}
