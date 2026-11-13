import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dataFile } from "@/lib/server/paths";
import { sendMobileEmail } from "@/lib/server/mobile-mail";
import { findShopOrder } from "@/lib/server/shop-orders";
import { listShopShipments } from "@/lib/server/shop-shipments";
import { siteConfig } from "@/lib/constants";
import type { Order } from "@/types";

export type InvoiceKind = "order" | "platform-fee" | "custom";
export type InvoiceLine = { title: string; quantity: number; price: number; batchNo?: string };
export type InvoiceParty = { name?: string; address?: string; phone?: string; email?: string };

export type IssuedInvoice = {
  number: string;
  issuedAt: string;
  emailedTo?: string;
  emailedAt?: string;
  kind?: InvoiceKind;
  orderId?: string;
  /** Secret for the customer's /api/invoice/{token} link. */
  token?: string;
  updatedAt?: string;
  /** Desk edits. Anything left blank falls back to the order. */
  to?: InvoiceParty;
  lines?: InvoiceLine[];
  shipping?: number;
  discount?: number;
  courier?: string;
  transport?: string;
  awb?: string;
  notes?: string;
};

export type InvoiceSettings = {
  /** Off stops automatic invoices after delivery. The desk can still create them. */
  enabled: boolean;
  separatePlatformFee: boolean;
  signatureUrl: string;
  signatoryName: string;
};

const DEFAULT_SETTINGS: InvoiceSettings = { enabled: true, separatePlatformFee: true, signatureUrl: "", signatoryName: "Authorised signatory" };

function file() {
  return dataFile("delivery-invoices.json");
}

function settingsFile() {
  return dataFile("invoice-settings.json");
}

function readAll(): Record<string, IssuedInvoice> {
  try {
    const parsed = JSON.parse(readFileSync(file(), "utf8")) as Record<string, IssuedInvoice>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, IssuedInvoice>) {
  writeFileSync(file(), JSON.stringify(all));
}

export function readInvoiceSettings(): InvoiceSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(readFileSync(settingsFile(), "utf8")) as Partial<InvoiceSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveInvoiceSettings(input: Partial<InvoiceSettings>) {
  const next: InvoiceSettings = {
    enabled: input.enabled !== false,
    separatePlatformFee: input.separatePlatformFee !== false,
    signatureUrl: String(input.signatureUrl ?? "").trim(),
    signatoryName: String(input.signatoryName ?? "").trim() || DEFAULT_SETTINGS.signatoryName,
  };
  writeFileSync(settingsFile(), JSON.stringify(next));
  return next;
}

const keyOf = (kind: InvoiceKind, orderId: string, number = "") =>
  kind === "order" ? orderId : kind === "platform-fee" ? `${orderId}:pf` : `custom:${number}`;

function normalized(key: string, invoice: IssuedInvoice): IssuedInvoice {
  const kind = invoice.kind ?? (key.startsWith("custom:") ? "custom" : key.endsWith(":pf") ? "platform-fee" : "order");
  const orderId = invoice.orderId ?? (kind === "custom" ? "" : key.replace(/:pf$/, ""));
  return { ...invoice, kind, orderId };
}

export function issuedInvoice(orderId: string, kind: InvoiceKind = "order"): IssuedInvoice | undefined {
  const key = keyOf(kind, orderId);
  const found = readAll()[key];
  return found ? normalized(key, found) : undefined;
}

function rupees(value: number) {
  const amount = Math.round(Number(value) || 0);
  return `${amount < 0 ? "−" : ""}₹${Math.abs(amount).toLocaleString("en-IN")}`;
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

function tokenLink(invoice: IssuedInvoice) {
  const base = siteUrl();
  return base && invoice.token ? `${base}/api/invoice/${invoice.token}` : "";
}

function shipmentFacts(order: Order) {
  const shipment = listShopShipments()
    .filter((row) => row.orderId === order.id && row.awb && row.note !== "Cancelled")
    .at(-1);
  const pickup = order.deliveryMode === "store_pickup";
  const local = shipment?.provider === "tookan" || shipment?.provider === "shipday" || shipment?.provider === "tookan-parcel";
  return {
    courier: pickup ? "Collected from the Foundation store" : shipment?.directCourier || shipment?.courier || order.courierName || "",
    awb: shipment?.awb || "",
    transport: pickup ? "Store pickup" : local ? "Road (local delivery)" : shipment ? "Road (courier surface)" : "",
  };
}

type Resolved = {
  invoice: IssuedInvoice;
  order?: Order;
  title: string;
  to: InvoiceParty;
  lines: InvoiceLine[];
  discount: number;
  platformFee: number;
  shipping: number;
  total: number;
  courier: string;
  transport: string;
  awb: string;
};

function resolve(invoice: IssuedInvoice, settings = readInvoiceSettings()): Resolved {
  const order = invoice.orderId ? findShopOrder(invoice.orderId) : undefined;
  const address = order?.deliveryAddress;
  const fromOrder: InvoiceParty = order
    ? {
        name: address?.fullName,
        address: [address?.line1, address?.landmark, [address?.city, address?.state, address?.pincode].filter(Boolean).join(" ")].filter(Boolean).join(", "),
        phone: address?.phone,
        email: address?.email || order.accountEmail,
      }
    : {};
  const to: InvoiceParty = {
    name: invoice.to?.name || fromOrder.name,
    address: invoice.to?.address || fromOrder.address,
    phone: invoice.to?.phone || fromOrder.phone,
    email: invoice.to?.email || fromOrder.email,
  };
  const facts = order ? shipmentFacts(order) : { courier: "", awb: "", transport: "" };
  const shipped = {
    courier: invoice.courier ?? facts.courier,
    transport: invoice.transport ?? facts.transport,
    awb: invoice.awb ?? facts.awb,
  };
  if (invoice.kind === "platform-fee") {
    const fee = invoice.lines?.length ? 0 : Number(order?.platformFee) || 0;
    const lines = invoice.lines?.length ? invoice.lines : [{ title: `Platform fee for order ${invoice.orderId}`, quantity: 1, price: fee }];
    const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    return { invoice, order, title: "Platform fee invoice", to, lines, discount: 0, platformFee: 0, shipping: 0, total, ...shipped };
  }
  const orderLines = !invoice.lines?.length;
  const lines = !orderLines
    ? invoice.lines!
    : [
        ...(order?.items ?? []).map((item) => ({ title: item.title, quantity: item.quantity, price: Math.max(item.price, Number(item.originalPrice) || 0), batchNo: item.batchNo })),
        ...(order?.extraCharges ?? []).filter((extra) => extra.kind === "other").map((extra) => ({ title: extra.reason, quantity: 1, price: extra.amount, batchNo: undefined })),
      ];
  const listed = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  // Lines are at MRP; the discount is whatever makes the invoice match what the order actually charged.
  const derived = order && orderLines ? Math.max(0, Math.round((listed + (order.shipping || 0) + (Number(order.platformFee) || 0) + (order.gst || 0) - order.total) * 100) / 100) : undefined;
  const discount = invoice.discount ?? derived ?? order?.discount ?? 0;
  const shipping = invoice.shipping ?? order?.shipping ?? 0;
  const platformFee = invoice.kind === "order" && !settings.separatePlatformFee ? Number(order?.platformFee) || 0 : 0;
  const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0) - discount + shipping + platformFee;
  return { invoice, order, title: "Invoice", to, lines, discount, platformFee, shipping, total, ...shipped };
}

/** Printable invoice. The Foundation is not GST-registered, so no tax lines. */
export function invoiceHtml(invoice: IssuedInvoice) {
  const settings = readInvoiceSettings();
  const view = resolve(invoice, settings);
  const { order, to } = view;
  const rows = view.lines
    .map(
      (item, index) =>
        `<tr><td>${index + 1}</td><td>${esc(item.title)}${item.batchNo ? `<br><small>Batch ${esc(item.batchNo)}</small>` : ""}</td><td class="r">${item.quantity}</td><td class="r">${rupees(item.price)}</td><td class="r">${rupees(item.price * item.quantity)}</td></tr>`
    )
    .join("");
  const line = (label: string, value: number, bold = false) =>
    `<tr><td>${bold ? `<b>${label}</b>` : label}</td><td class="r">${bold ? `<b>${rupees(value)}</b>` : rupees(value)}</td></tr>`;
  const subtotal = view.lines.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const ship = [
    view.courier ? `<div><span>Shipped by courier</span><b>${esc(view.courier)}</b></div>` : "",
    view.transport ? `<div><span>Mode of transport</span><b>${esc(view.transport)}</b></div>` : "",
    view.awb ? `<div><span>AWB no.</span><b>${esc(view.awb)}</b></div>` : "",
  ].join("");
  const signature = settings.signatureUrl
    ? `<div class="sign"><img src="${esc(settings.signatureUrl)}" alt="Signature"/><div>${esc(settings.signatoryName)}<br><small>${esc(siteConfig.name)}</small></div></div>`
    : "";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(view.title)} ${esc(invoice.number)}</title>
<style>
body{font-family:Georgia,"Times New Roman",serif;color:#0B1F3A;margin:0;background:#f7f3ea}
.page{max-width:760px;margin:24px auto;background:#fff;border:1px solid #e4d8c4;padding:36px}
h1{font-size:22px;margin:0;color:#6A1F1F}.muted{color:#5C5648;font-size:13px}
.head{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #B8953A;padding-bottom:16px}
.grid{display:flex;justify-content:space-between;gap:24px;margin-top:18px;font-size:14px}
.ship{display:flex;flex-wrap:wrap;gap:8px 24px;margin-top:14px;padding:10px 12px;background:#fffaf0;border:1px solid #eee2c8;font-size:13px}
.ship span{display:block;color:#5C5648;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
table{width:100%;border-collapse:collapse;margin-top:18px;font-size:14px}
th{background:#fffaf0;text-align:left;border-bottom:1px solid #e4d8c4;padding:8px}
td{border-bottom:1px solid #eee7da;padding:8px}.r{text-align:right}
.totals{width:50%;margin-left:auto}.foot{margin-top:28px;font-size:12px;color:#5C5648;text-align:center}
.sign{margin-top:28px;margin-left:auto;width:220px;text-align:center;font-size:13px}.sign img{max-width:200px;max-height:80px;object-fit:contain;display:block;margin:0 auto 4px;border-bottom:1px solid #0B1F3A}
.print{display:inline-block;margin:16px auto 0;padding:8px 16px;background:#8F2D2D;color:#fff;border:0;border-radius:8px;font:inherit;cursor:pointer}
@media print{body{background:#fff}.page{border:0;margin:0}.print{display:none}}
</style></head><body><div class="page">
<div class="head"><div style="display:flex;gap:12px;align-items:center"><img src="${siteUrl()}/uploads/site-logo.png" alt="" style="height:56px;width:auto;max-width:160px;object-fit:contain" onerror="this.style.display='none'"/><div><h1>${esc(siteConfig.name)}</h1><p class="muted">Pune, Maharashtra, India</p></div></div>
<div style="text-align:right"><p style="margin:0;font-size:18px"><b>${esc(view.title)}</b></p>
<p class="muted">Invoice no. ${esc(invoice.number)}<br>Invoice date ${esc(day(invoice.issuedAt))}${order ? `<br>Order no. ${esc(order.id)}<br>Order date ${esc(day(order.date))}` : ""}</p></div></div>
<div class="grid"><div><b>From</b><br>${esc(siteConfig.name)}<br>${esc(siteConfig.address)}<br>Phone ${esc(siteConfig.phone)} · ${esc(siteConfig.email)}</div>
<div style="text-align:right"><b>To</b><br>${esc(to.name)}<br>${esc(to.address)}${to.phone ? `<br>Phone ${esc(to.phone)}` : ""}${to.email ? `<br>${esc(to.email)}` : ""}</div></div>
${ship ? `<div class="ship">${ship}</div>` : ""}
${order ? `<p class="muted" style="margin-top:12px">Payment: ${esc(order.paymentStatus)}${order.paymentMethod ? ` · ${esc(order.paymentMethod)}` : ""}</p>` : ""}
<table><thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<table class="totals">${line("Subtotal", subtotal)}${view.discount ? line("Discount", -view.discount) : ""}${view.platformFee ? line("Platform fee", view.platformFee) : ""}${view.shipping ? line("Shipping", view.shipping) : ""}${line("Total", view.total, true)}</table>
${invoice.notes ? `<p class="muted" style="margin-top:16px">${esc(invoice.notes)}</p>` : ""}
${signature}
<p class="foot">${signature ? "" : "This is a computer-generated invoice and needs no signature.<br>"}Thank you for supporting the ${esc(siteConfig.name)}.</p>
<div style="text-align:center"><button class="print" onclick="window.print()">Print or save as PDF</button></div>
</div></body></html>`;
}

export function deliveryInvoiceHtml(_order: Order, invoice: IssuedInvoice) {
  return invoiceHtml(invoice);
}

export function listInvoices() {
  const settings = readInvoiceSettings();
  return Object.entries(readAll())
    .map(([key, raw]) => {
      const invoice = normalized(key, raw);
      const view = resolve(invoice, settings);
      return { key, ...invoice, customer: view.to.name ?? "", email: view.to.email ?? "", total: view.total, title: view.title };
    })
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}

export function findInvoice(key: string) {
  const found = readAll()[key];
  return found ? normalized(key, found) : undefined;
}

export function findInvoiceByToken(token: string) {
  const entry = Object.entries(readAll()).find(([, invoice]) => invoice.token && invoice.token === token);
  return entry ? normalized(entry[0], entry[1]) : undefined;
}

function newNumber(kind: InvoiceKind, orderId: string, at: string) {
  if (kind === "order") return `${at.slice(0, 4)}${orderId}`;
  if (kind === "platform-fee") return `PF${at.slice(0, 4)}${orderId}`;
  return `INV${at.slice(2, 4)}${Date.now().toString().slice(-7)}`;
}

/** Desk: creates an invoice whatever the on/off switch says. Returns the existing one if already issued. */
export function createInvoice(input: { kind: InvoiceKind; orderId?: string } & Partial<IssuedInvoice>) {
  const all = readAll();
  const orderId = String(input.orderId ?? "").trim();
  if (input.kind !== "custom") {
    const order = orderId ? findShopOrder(orderId) : undefined;
    if (!order) throw new Error("Order not found.");
    if (input.kind === "platform-fee" && !(Number(order.platformFee) > 0) && !input.lines?.length) throw new Error("This order has no platform fee.");
  }
  const issuedAt = new Date().toISOString();
  const number = newNumber(input.kind, orderId, issuedAt);
  const key = keyOf(input.kind, orderId, number);
  if (all[key]) return { key, ...normalized(key, all[key]) };
  const invoice: IssuedInvoice = {
    ...pickEdits(input),
    number,
    issuedAt,
    kind: input.kind,
    orderId: orderId || undefined,
    token: randomBytes(12).toString("hex"),
  };
  all[key] = invoice;
  writeAll(all);
  return { key, ...invoice };
}

function pickEdits(input: Partial<IssuedInvoice>): Partial<IssuedInvoice> {
  const out: Partial<IssuedInvoice> = {};
  if (input.to) out.to = { name: input.to.name?.trim(), address: input.to.address?.trim(), phone: input.to.phone?.trim(), email: input.to.email?.trim() };
  if (Array.isArray(input.lines)) {
    out.lines = input.lines
      .map((row) => ({ title: String(row.title ?? "").trim(), quantity: Math.max(1, Math.round(Number(row.quantity) || 1)), price: Number(row.price) || 0, batchNo: row.batchNo ? String(row.batchNo) : undefined }))
      .filter((row) => row.title);
  }
  for (const field of ["shipping", "discount"] as const) if (input[field] !== undefined && input[field] !== null && String(input[field]) !== "") out[field] = Number(input[field]) || 0;
  for (const field of ["courier", "transport", "awb", "notes"] as const) if (typeof input[field] === "string") out[field] = input[field];
  if (input.issuedAt && !Number.isNaN(Date.parse(input.issuedAt))) out.issuedAt = new Date(input.issuedAt).toISOString();
  return out;
}

export function updateInvoice(key: string, patch: Partial<IssuedInvoice>) {
  const all = readAll();
  if (!all[key]) throw new Error("Invoice not found.");
  all[key] = { ...all[key], ...pickEdits(patch), updatedAt: new Date().toISOString() };
  writeAll(all);
  return { key, ...normalized(key, all[key]) };
}

export function deleteInvoice(key: string) {
  const all = readAll();
  delete all[key];
  writeAll(all);
}

export async function emailInvoice(key: string, toOverride = "") {
  const all = readAll();
  const raw = all[key];
  if (!raw) throw new Error("Invoice not found.");
  if (!raw.token) raw.token = randomBytes(12).toString("hex");
  const invoice = normalized(key, raw);
  const view = resolve(invoice);
  const to = toOverride.trim() || view.to.email || "";
  if (!to) throw new Error("No email address for this invoice.");
  const link = tokenLink(invoice) || (view.order && invoice.kind === "order" ? invoiceLink(view.order) : "");
  const body = [
    `Namaskar ${view.to.name || ""},`,
    "",
    view.order
      ? `Your ${view.title.toLowerCase()} ${invoice.number} for order ${view.order.id} is ready.`
      : `Your invoice ${invoice.number} is ready.`,
    "",
    ...view.lines.map((item) => `${item.title} × ${item.quantity}: ${rupees(item.price * item.quantity)}`),
    `Total: ${rupees(view.total)}`,
    "",
    link ? `View, print or save the invoice: ${link}` : "",
  ].join("\n");
  await sendMobileEmail(to, `${view.title} ${invoice.number}${view.order ? ` for order ${view.order.id}` : ""}`, body);
  all[key] = { ...raw, emailedTo: to, emailedAt: new Date().toISOString() };
  writeAll(all);
  return { key, ...normalized(key, all[key]) };
}

let issuing = false;

/** Issues the invoice once, the first time an order is seen as Delivered, and emails the customer. */
export async function issueDeliveryInvoice(orderId: string) {
  if (issuing) return;
  const settings = readInvoiceSettings();
  if (!settings.enabled) return;
  issuing = true;
  try {
    const order = findShopOrder(orderId);
    if (!order || order.status !== "Delivered") return;
    if (readAll()[orderId]) return;
    const created = [createInvoice({ kind: "order", orderId })];
    if (settings.separatePlatformFee && Number(order.platformFee) > 0) created.push(createInvoice({ kind: "platform-fee", orderId }));
    for (const invoice of created) await emailInvoice(invoice.key).catch(() => undefined);
  } finally {
    issuing = false;
  }
}
