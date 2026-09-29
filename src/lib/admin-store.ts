import type {
  DeliveryAddress,
  Order,
  OrderItem,
  OrderPlan,
  OutboxEmail,
  Seller,
  ShipmentRecord,
  SiteSettings,
  SupportMessage,
  SupportTicket,
  FAQItem,
  User,
} from "@/types";
import { storeConfig } from "@/lib/constants";
import { generateOrderId, getOrders, saveOrder } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import { findAccountByIdentifier, saveAccount } from "@/lib/auth";
import { getLiveBooks } from "@/lib/product-data";

export type OrderStatus = Order["status"];

const SETTINGS_KEY = "vgmf_settings";
const SHIPMENTS_KEY = "vgmf_shipments";
const SELLERS_KEY = "vgmf_sellers";
const SELLER_ORDERS_KEY = "vgmf_seller_orders";
const SUPPORT_KEY = "vgmf_support";
const TICKETS_KEY = "vgmf_tickets";
const FAQS_KEY = "vgmf_faqs";
const OUTBOX_KEY = "vgmf_outbox";
const BOOT_KEY = "vgmf_booted";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function defaultSettings(): SiteSettings {
  return {
    siteName: "Vaidya Gogate Memorial Foundation",
    tagline: "Preserving Ayurveda. Advancing Knowledge. Serving Society.",
    logoText: "VGMF",
    logoUrl: "",
    supportEmail: "support@vaidyagogate.org",
    supportPhone: "+91 20 1234 5678",
    maintenanceMode: false,
    maintenanceMessage:
      "The site is under scheduled maintenance. We will be back shortly.",
    apiKeys: {
      googleMaps: "",
      shiprocket: "",
      razorpay: "",
      zeptomail: "",
    },
    processing: {
      daysToPack: 1,
      daysToPickup: 2,
      daysInTransit: 4,
    },
    packagingOptions: [
      {
        id: "standard",
        label: "Standard cardboard box",
        description: "Single book, bubble wrap + cardboard mailer.",
      },
      {
        id: "rigid",
        label: "Rigid protective box",
        description: "Hardcover / bulk pack, corner protectors + water-resistant wrap.",
      },
      {
        id: "delicate",
        label: "Delicate handling",
        description: "Glass / fragile items, extra cushioning + FRAGILE tape.",
      },
    ],
    fulfillmentLocations: [
      {
        id: "fl-001",
        name: "Pune Fulfillment Hub",
        code: "PUN",
        address: "Vaidya Gogate Memorial Foundation, FC Road, Shivaji Nagar",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411005",
        phone: "+91 20 1234 5678",
        active: true,
      },
    ],
    pickupTimeslots: [
      { id: "ts-1", label: "Morning (9–11 AM)", from: "09:00", to: "11:00" },
      { id: "ts-2", label: "Midday (12–2 PM)", from: "12:00", to: "14:00" },
      { id: "ts-3", label: "Evening (4–6 PM)", from: "16:00", to: "18:00" },
    ],
    couriers: ["Shiprocket", "Ekart Logistics", "Delhivery", "Blue Dart", "DTDC"],
    outOfStockThreshold: 5,
  };
}

export function getSettings(): SiteSettings {
  const current = readJSON<SiteSettings | null>(SETTINGS_KEY, null);
  if (!current) {
    writeJSON(SETTINGS_KEY, defaultSettings());
    return defaultSettings();
  }
  return { ...defaultSettings(), ...current };
}

export function saveSettings(settings: SiteSettings) {
  writeJSON(SETTINGS_KEY, settings);
}

export function setMaintenanceMode(on: boolean, message?: string) {
  const settings = getSettings();
  saveSettings({
    ...settings,
    maintenanceMode: on,
    maintenanceMessage: message ?? settings.maintenanceMessage,
  });
}

/* ---------------- Seed admin / staff accounts ---------------- */

export function ensureBootstrapped() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(BOOT_KEY)) return;
  seedAccounts();
  writeJSON(BOOT_KEY, "1");
}

export const ADMIN_PASSWORD = "admin123";
export const STAFF_PASSWORD = "staff123";

export function ensureAdminCredentials() {
  if (typeof window === "undefined") return;
  ensureBootstrapped();
  const accounts = getAccounts().map((a) => {
    if (a.role === "admin" && !a.password) return { ...a, password: "admin123" };
    if (a.role === "staff" && !a.password) return { ...a, password: "staff123" };
    return a;
  });
  writeJSON("vgmf_accounts", accounts);
}

export function seedAccounts() {
  const admin: User = {
    id: "usr-admin-001",
    firstName: "Admin",
    lastName: "VGMF",
    email: "admin@vaidyagogate.org",
    phone: "+91 90000 00001",
    whatsapp: "+91 90000 00001",
    accountId: "100000000001",
    role: "admin",
    password: ADMIN_PASSWORD,
  };
  const staff: User = {
    id: "usr-staff-001",
    firstName: "Customer",
    lastName: "Care",
    email: "care@vaidyagogate.org",
    phone: "+91 90000 00002",
    whatsapp: "+91 90000 00002",
    accountId: "100000000002",
    role: "staff",
    password: STAFF_PASSWORD,
  };
  if (!findAccountByIdentifier(admin.email)) saveAccount(admin);
  if (!findAccountByIdentifier(staff.email)) saveAccount(staff);
}

export function getAccounts(): User[] {
  if (typeof window === "undefined") return [];
  return readJSON<User[]>("vgmf_accounts", []);
}

export function createUserAccount(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: "customer" | "admin" | "staff";
}) {
  const account: User = {
    id: `usr-${Date.now()}`,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    whatsapp: input.phone,
    accountId: String(Math.floor(100000000000 + Math.random() * 900000000000)),
    role: input.role,
    password:
      input.role === "admin"
        ? ADMIN_PASSWORD
        : input.role === "staff"
          ? STAFF_PASSWORD
          : undefined,
  };
  saveAccount(account);
  sendEmail({
    to: account.email,
    subject: `Your VGMF account for ${input.role} panel`,
    template: "account-created",
    body: `Hi ${account.firstName},\n\nAn account has been created for you on the VGMF portal.\n\nAccount ID: ${account.accountId}\nRole: ${input.role}\nPassword: ${account.password}\n\nSign in at ${input.role === "customer" ? "/login" : `/${input.role}/login`} using your email and password.\n\n– VGMF Team`,
  });
  return account;
}

/* ---------------- Order planning ---------------- */

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

export function computeOrderPlan(order: Order): OrderPlan {
  const settings = getSettings();
  const placed = new Date(order.date);
  const packedBy = addDays(placed, settings.processing.daysToPack);
  const pickedUpBy = addDays(packedBy, settings.processing.daysToPickup);
  const shippedBy = addDays(pickedUpBy, 1);
  const deliveredBy = addDays(placed, settings.processing.daysToPack + settings.processing.daysToPickup + settings.processing.daysInTransit);

  const heavy = order.items.length > 2;
  const packaging =
    settings.packagingOptions.find((p) =>
      heavy ? p.id === "rigid" : p.id === "standard"
    ) ?? settings.packagingOptions[0];

  return {
    packedBy: packedBy.toISOString(),
    pickedUpBy: pickedUpBy.toISOString(),
    shippedBy: shippedBy.toISOString(),
    deliveredBy: deliveredBy.toISOString(),
    packagingId: packaging.id,
    packagingLabel: packaging.label,
  };
}

export function createAdminOrder(input: {
  userEmail?: string;
  deliverTo: DeliveryAddress;
  items: { bookId: string; quantity: number }[];
  deliveryMode?: "delivery" | "store_pickup";
  sellerId?: string;
}) {
  const live = getLiveBooks();
  const orderItems: OrderItem[] = input.items
    .map((entry) => {
      const book = live.find((b) => b.id === entry.bookId);
      if (!book) return null;
      return {
        bookId: book.id,
        title: book.title,
        quantity: entry.quantity,
        price: book.price,
        originalPrice: book.originalPrice,
        currency: book.currency,
      };
    })
    .filter(Boolean) as OrderItem[];

  if (orderItems.length === 0) throw new Error("No valid items selected.");

  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = orderItems.reduce(
    (sum, item) => sum + ((item.originalPrice ?? item.price) - item.price) * item.quantity,
    0
  );
  const gst = Math.round(subtotal * storeConfig.gstRate);
  const shipping = input.deliveryMode === "store_pickup" ? 0 : storeConfig.shippingFee;
  const order: Order = {
    id: generateOrderId(),
    userId: "admin",
    date: new Date().toISOString(),
    items: orderItems,
    subtotal,
    discount,
    gst,
    shipping,
    total: subtotal + gst + shipping,
    currency: storeConfig.currency,
    paymentStatus: "Paid",
    status: "Ordered",
    deliveryMode: input.deliveryMode ?? "delivery",
    deliveryAddress: {
      ...input.deliverTo,
      email: input.deliverTo.email ?? input.userEmail ?? "",
    },
    sellerId: input.sellerId,
  };
  order.plan = computeOrderPlan(order);
  saveOrder(order);
  sendEmail({
    to: order.deliveryAddress?.email || input.userEmail || "",
    subject: `Order ${order.id} placed`,
    template: "order-placed",
    body: `Your order ${order.id} is confirmed.\n\nExpected delivery: ${formatDate(order.plan.deliveredBy)}\nPackaging: ${order.plan.packagingLabel}\n\n– VGMF Store`,
  });
  return order;
}

export function updateOrderInStore(order: Order) {
  const orders = getOrders();
  const idx = orders.findIndex((o) => o.id === order.id);
  if (idx === -1) {
    saveOrder(order);
    return;
  }
  orders[idx] = order;
  writeJSON("vgmf_orders", orders);
}

export function getOrder(orderId: string) {
  return getOrders().find((o) => o.id === orderId);
}

export function setOrderStatus(orderId: string, status: OrderStatus) {
  const order = getOrder(orderId);
  if (!order) return;
  const next: Order = { ...order, status };
  if (status === "Out for Delivery" && order.deliveryMode === "delivery") {
    next.paymentStatus = "Paid";
  }
  if (status === "Delivered") {
    next.paymentStatus = "Paid";
  }
  updateOrderInStore(next);
  sendOrderStatusEmail(next, status);
}

export function cancelOrder(orderId: string) {
  const order = getOrder(orderId);
  if (!order) return;
  const next: Order = { ...order, status: "Cancelled" };
  updateOrderInStore(next);
  sendOrderStatusEmail(next, "Cancelled");
}

export function refundOrder(orderId: string) {
  const order = getOrder(orderId);
  if (!order) return;
  const next: Order = { ...order, paymentStatus: "Refunded" };
  updateOrderInStore(next);
  sendEmail({
    to: order.deliveryAddress?.email || "",
    subject: `Refund initiated for order ${order.id}`,
    template: "refund",
    body: `A refund of ₹${order.total.toLocaleString("en-IN")} has been initiated for order ${order.id} to your original payment method. It reflects within 5–7 business days.\n\n– VGMF Store`,
  });
}

export function createReplacement(orderId: string) {
  const order = getOrder(orderId);
  if (!order) return;
  const replacement = {
    ...order,
    id: generateOrderId(),
    date: new Date().toISOString(),
    status: "Ordered" as OrderStatus,
    paymentStatus: "Paid" as const,
    replacementOf: order.id,
    returnRequest: undefined,
    shipmentId: undefined,
  };
  replacement.plan = computeOrderPlan(replacement);
  updateOrderInStore(replacement);
  sendOrderStatusEmail(replacement, "Ordered");
  return replacement;
}

/* ---------------- Shipments & couriers ---------------- */

export function getShipments(): ShipmentRecord[] {
  return readJSON<ShipmentRecord[]>(SHIPMENTS_KEY, []);
}

export function courierPrefix(courier: string) {
  const initials = courier
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return initials || "TRK";
}

export function generateAWB(courier: string) {
  return `${courierPrefix(courier)}${Math.floor(
    100000000000 + Math.random() * 900000000000
  )}`;
}

export function createShipment(input: {
  orderId: string;
  courier: string;
  charges: number;
  sellerId?: string;
}) {
  const order = getOrder(input.orderId);
  if (!order || order.deliveryMode !== "delivery") return;

  const shipment: ShipmentRecord = {
    id: `SHP${Date.now()}`,
    orderId: order.id,
    sellerId: input.sellerId,
    courier: input.courier,
    awb: generateAWB(input.courier),
    charges: input.charges,
    toAddress: { ...(order.deliveryAddress as DeliveryAddress) },
    items: order.items.map((item) => ({
      sku: item.bookId,
      title: item.title,
      quantity: item.quantity,
      barcode: getLiveBooks().find((b) => b.id === item.bookId)?.sku,
    })),
    status: "Booked",
    generatedAt: new Date().toISOString(),
  };
  const list = getShipments().filter((s) => s.orderId !== order.id);
  list.push(shipment);
  writeJSON(SHIPMENTS_KEY, list);

  const next = { ...order, shipmentId: shipment.id, status: "Shipped" as OrderStatus };
  updateOrderInStore(next);
  sendOrderStatusEmail(next, "Shipped");
  return shipment;
}

export function updateShipmentStatus(shipmentId: string, status: ShipmentRecord["status"]) {
  const list = getShipments();
  const shipment = list.find((s) => s.id === shipmentId);
  if (!shipment) return;
  shipment.status = status;
  if (status === "Picked Up") shipment.pickedUpAt = new Date().toISOString();
  const idx = list.findIndex((s) => s.id === shipmentId);
  list[idx] = shipment;
  writeJSON(SHIPMENTS_KEY, list);

  const order = getOrder(shipment.orderId);
  if (order) {
    const next: Order = { ...order, status: status === "Delivered" ? "Delivered" : "Shipped" };
    updateOrderInStore(next);
  }

  const sellerOrders = readJSON<Order[]>(SELLER_ORDERS_KEY, []);
  const sellerIdx = sellerOrders.findIndex((o) => o.id === shipment.orderId);
  if (sellerIdx !== -1) {
    const next: Order = {
      ...sellerOrders[sellerIdx],
      status: status === "Delivered" ? "Delivered" : "Shipped",
    };
    sellerOrders[sellerIdx] = next;
    writeJSON(SELLER_ORDERS_KEY, sellerOrders);
  }
}

export function setSellerOrderStatus(orderId: string, status: OrderStatus) {
  const orders = readJSON<Order[]>(SELLER_ORDERS_KEY, []);
  const order = orders.find((o) => o.id === orderId);
  if (!order) return;
  const next = { ...order, status };
  orders[orders.findIndex((o) => o.id === orderId)] = next;
  writeJSON(SELLER_ORDERS_KEY, orders);
  if (status === "Shipped") {
    const shipment = createShipment({
      orderId,
      courier: order.courierName ?? "Shiprocket",
      charges: 0,
      sellerId: order.sellerId,
    });
    return shipment;
  }
}

export function shipSellerOrder(orderId: string, courier: string, charges: number) {
  const orders = readJSON<Order[]>(SELLER_ORDERS_KEY, []);
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return;
  const order = orders[idx];

  const shipment: ShipmentRecord = {
    id: `SHP${Date.now()}`,
    orderId: order.id,
    sellerId: order.sellerId,
    courier,
    awb: generateAWB(courier),
    charges,
    toAddress: { ...(order.deliveryAddress as DeliveryAddress) },
    items: order.items.map((item) => ({
      sku: item.bookId,
      title: item.title,
      quantity: item.quantity,
      barcode: getLiveBooks().find((b) => b.id === item.bookId)?.sku,
    })),
    status: "Booked",
    generatedAt: new Date().toISOString(),
  };
  const list = getShipments().filter((s) => s.orderId !== order.id);
  list.push(shipment);
  writeJSON(SHIPMENTS_KEY, list);

  const next: Order = { ...order, status: "Shipped" as OrderStatus, shipmentId: shipment.id };
  orders[idx] = next;
  writeJSON(SELLER_ORDERS_KEY, orders);
  sendOrderStatusEmail(next, "Shipped");
  return shipment;
}

/* ---------------- Printables ---------------- */

function printHtml(title: string, html: string) {
  if (typeof window === "undefined") return;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!doctype html><html><head><title>${title}</title>
  <style>
    body{font-family:Arial,sans-serif;color:#111;margin:32px;}
    h1{font-size:18px;} table{width:100%;border-collapse:collapse;margin-top:12px;}
    td,th{border:1px solid #bbb;padding:6px 8px;font-size:12px;text-align:left;}
    .muted{color:#666;font-size:11px;} .big{font-size:20px;font-weight:bold;}
    .row{display:flex;justify-content:space-between;gap:16px;margin-top:8px;}
    .box{border:1px solid #444;padding:14px;margin-top:14px;border-radius:6px;}
  </style></head><body>${html}</body></html>`);
  win.document.close();
  win.print();
}

function barcodeSvg(code: string) {
  return `<div style="font-family:monospace;letter-spacing:1px;font-size:14px;border:1px solid #999;display:inline-block;padding:6px 10px;">${code}</div>`;
}

export function printShippingLabel(shipment: ShipmentRecord) {
  const html = `<h1>Shipping Label</h1>
  <div class="row"><div><span class="muted">Courier</span><br/><span class="big">${shipment.courier}</span></div>
  <div><span class="muted">AWB / Tracking</span><br/><span class="big">${shipment.awb}</span></div></div>
  <div class="box"><b>Deliver to</b><br/>${shipment.toAddress.fullName} · ${shipment.toAddress.phone}<br/>
  ${shipment.toAddress.line1}${shipment.toAddress.landmark ? ", " + shipment.toAddress.landmark : ""}, ${shipment.toAddress.city} ${shipment.toAddress.state} ${shipment.toAddress.pincode}</div>
  <table><tr><th>SKU</th><th>Title</th><th>Qty</th><th>Barcode</th></tr>
  ${shipment.items.map((i) => `<tr><td>${i.sku}</td><td>${i.title}</td><td>${i.quantity}</td><td>${barcodeSvg(i.barcode ?? i.sku)}</td></tr>`).join("")}
  </table>
  <p class="muted">Generated ${formatDate(shipment.generatedAt)} · Return to sender if not delivered in 7 days.</p>`;
  printHtml("Shipping Label", html);
}

export function printOrderInvoice(order: Order, shipment?: ShipmentRecord) {
  const itemsHtml = order.items
    .map((i) => `<tr><td>${i.title}</td><td>${i.quantity}</td><td>${i.price.toLocaleString("en-IN")}</td><td>${(i.price * i.quantity).toLocaleString("en-IN")}</td></tr>`)
    .join("");
  const html = `<h1>Tax Invoice</h1>
  <p class="muted">VGMF Store · Invoice for order ${order.id}</p>
  <div class="row"><div><b>Billed to:</b><br/>${order.deliveryAddress?.fullName ?? "—"}<br/>${order.deliveryAddress?.line1 ?? ""}, ${order.deliveryAddress?.city ?? ""}</div>
  ${shipment ? `<div><b>Shipped via ${shipment.courier}</b><br/>AWB ${shipment.awb}</div>` : ""}</div>
  <table><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr>${itemsHtml}</table>
  <table style="border-collapse:collapse;margin-top:-1px;"><tr><th></th><th></th><th></th><th></th></tr>
  <tr><td></td><td></td><td>Subtotal</td><td>₹${order.subtotal.toLocaleString("en-IN")}</td></tr>
  <tr><td></td><td></td><td>Discount</td><td>−₹${order.discount.toLocaleString("en-IN")}</td></tr>
  <tr><td></td><td></td><td>GST</td><td>₹${order.gst.toLocaleString("en-IN")}</td></tr>
  <tr><td></td><td></td><td>Shipping</td><td>₹${order.shipping.toLocaleString("en-IN")}</td></tr>
  <tr><td></td><td></td><td><b>Total</b></td><td><b>₹${order.total.toLocaleString("en-IN")}</b></td></tr></table>`;
  printHtml("Invoice " + order.id, html);
}

export function printPackagingSlip(order: Order) {
  const title = `Packaging Slip — Order ${order.id}`;
  const html = `<h1>Packaging Slip</h1>
  <p class="muted">Order ${order.id} · ${formatDate(order.date)}</p>
  <div class="box"><b>Packaging recommended:</b> ${order.plan?.packagingLabel ?? "Standard cardboard box"}</div>
  <table><tr><th>SKU</th><th>Title</th><th>Qty</th></tr>
  ${order.items.map((i) => `<tr><td>${i.bookId}</td><td>${i.title}</td><td>${i.quantity}</td></tr>`).join("")}</table>
  <p class="muted">Pack, seal and attach the shipping label. Then book the courier pickup.</p>`;
  printHtml(title, html);
}

/* ---------------- Email (ZeptoMail mock) ---------------- */

export function getOutbox(): OutboxEmail[] {
  return readJSON<OutboxEmail[]>(OUTBOX_KEY, []);
}

export function sendEmail(input: {
  to: string;
  subject: string;
  template: string;
  body: string;
}) {
  const mail: OutboxEmail = {
    id: `MAIL${Date.now()}`,
    to: input.to,
    subject: input.subject,
    template: input.template,
    body: input.body,
    status: "Sent",
    sentAt: new Date().toISOString(),
  };
  const list = getOutbox();
  list.unshift(mail);
  writeJSON(OUTBOX_KEY, list);
  return mail;
}

export function sendOrderStatusEmail(order: Order, status: OrderStatus) {
  const to = order.deliveryAddress?.email || "";
  if (!to) return;
  sendEmail({
    to,
    subject: `Order ${order.id} — ${status}`,
    template: "order-status",
    body: `Your order ${order.id} is now ${status}.\n\n`,
  });
}

export function triggerOutOfStockEmails() {
  const live = getLiveBooks();
  const settings = getSettings();
  const low = live.filter((b) => b.stock <= settings.outOfStockThreshold);
  for (const book of low) {
    sendEmail({
      to: settings.supportEmail,
      subject: `Out of stock: ${book.title}`,
      template: "out-of-stock",
      body: `${book.title} (SKU ${book.sku}) has ${book.stock} units left. Please restock.\n\nStock level: ${book.stock}\nCategory: ${book.category}`,
    });
  }
  return low.length;
}

export function sendAbandonedCartEmail(email: string, items: string[]) {
  sendEmail({
    to: email,
    subject: "Did you forget something in your cart?",
    template: "abandoned-cart",
    body: `You left items in your cart: ${items.join(", ")}.\n\nComplete your order now before the deal ends.\n\n– VGMF Store`,
  });
  return true;
}

export function sendSupportReply(message: SupportMessage) {
  sendEmail({
    to: message.email,
    subject: `Re: ${message.subject}`,
    template: "support-reply",
    body: `Hi ${message.name},\n\n${message.reply ?? ""}\n\n– VGMF Support`,
  });
}

/* ---------------- Support ---------------- */

export function getSupportMessages(): SupportMessage[] {
  return readJSON<SupportMessage[]>(SUPPORT_KEY, []);
}

export function addSupportQuery(input: {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}) {
  const message: SupportMessage = {
    id: `Q${Date.now()}`,
    ...input,
    receivedAt: new Date().toISOString(),
    status: "New",
  };
  const list = getSupportMessages();
  list.push(message);
  writeJSON(SUPPORT_KEY, list);
  return message;
}

export function replyToQuery(id: string, reply: string) {
  const list = getSupportMessages();
  const message = list.find((m) => m.id === id);
  if (!message) return;
  message.status = "Replied";
  message.reply = reply;
  message.repliedAt = new Date().toISOString();
  writeJSON(SUPPORT_KEY, list);
  sendSupportReply(message);
}

export function getTickets(): SupportTicket[] {
  return readJSON<SupportTicket[]>(TICKETS_KEY, []);
}

export function addTicket(input: {
  name: string;
  email: string;
  subject: string;
  body: string;
}) {
  const now = new Date().toISOString();
  const ticket: SupportTicket = {
    id: `TK${Math.floor(100000 + Math.random() * 900000)}`,
    ...input,
    status: "Open",
    createdAt: now,
    updatedAt: now,
    responses: [],
  };
  const list = getTickets();
  list.push(ticket);
  writeJSON(TICKETS_KEY, list);
  return ticket;
}

export function respondToTicket(id: string, from: string, text: string) {
  const list = getTickets();
  const ticket = list.find((t) => t.id === id);
  if (!ticket) return;
  ticket.responses.push({ at: new Date().toISOString(), from, text });
  if (ticket.status === "Open") ticket.status = "In Progress";
  ticket.updatedAt = new Date().toISOString();
  writeJSON(TICKETS_KEY, list);
  sendEmail({
    to: ticket.email,
    subject: `Update on your ticket ${ticket.id}`,
    template: "ticket-update",
    body: `Hi ${ticket.name},\n\n${text}\n\n– VGMF Support`,
  });
}

export function updateTicketStatus(id: string, status: SupportTicket["status"]) {
  const list = getTickets();
  const ticket = list.find((t) => t.id === id);
  if (!ticket) return;
  ticket.status = status;
  ticket.updatedAt = new Date().toISOString();
  writeJSON(TICKETS_KEY, list);
}

export function getFaqs(): FAQItem[] {
  return readJSON<FAQItem[]>(FAQS_KEY, []);
}

export function saveFaq(faq: FAQItem) {
  const list = getFaqs().filter((f) => f.id !== faq.id);
  list.push(faq);
  writeJSON(FAQS_KEY, list);
}

export function deleteFaq(id: string) {
  writeJSON(FAQS_KEY, getFaqs().filter((f) => f.id !== id));
}

/* ---------------- Sellers ---------------- */

export function getSellers(): Seller[] {
  return readJSON<Seller[]>(SELLERS_KEY, []);
}

function sellerId12() {
  return String(Math.floor(100000000000 + Math.random() * 900000000000));
}

export function startSellerAccount(input: { email: string; password: string }) {
  const email = input.email.trim();
  const existing = getSellers().find(
    (s) => s.email.toLowerCase() === email.toLowerCase()
  );

  if (!findAccountByIdentifier(email)) {
    const account: User = {
      id: `usr-seller-${Date.now()}`,
      firstName: "",
      lastName: "",
      email,
      phone: "",
      whatsapp: "",
      accountId: sellerId12(),
      role: "seller",
      password: input.password,
    };
    saveAccount(account);
  }

  const seller: Seller = {
    id: existing?.id ?? `SLR-${Date.now()}`,
    brandName: existing?.brandName ?? "",
    firstName: existing?.firstName ?? "",
    middleName: existing?.middleName ?? "",
    lastName: existing?.lastName ?? "",
    phone: existing?.phone ?? "",
    email,
    emailVerified: true,
    category: existing?.category ?? "",
    description: existing?.description ?? "",
    kyc: existing?.kyc ?? { status: "Pending", docs: [] },
    agreement: existing?.agreement ?? { status: "Pending" },
    status: existing?.status ?? "Onboarding",
    payoutsReceived: existing?.payoutsReceived ?? 0,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  const list = getSellers().filter(
    (s) => s.email.toLowerCase() !== email.toLowerCase()
  );
  list.push(seller);
  writeJSON(SELLERS_KEY, list);
  sendEmail({
    to: email,
    subject: "Welcome to VGMF Marketplace — complete your seller onboarding",
    template: "seller-verified",
    body: `Hi,\n\nYour seller account is created. Please sign in to the seller portal and complete your brand details and digital KYC.\n\n– VGMF Marketplace`,
  });
  return seller;
}

export function submitSellerBrand(
  id: string,
  profile: {
    brandName: string;
    firstName: string;
    middleName: string;
    lastName: string;
    phone: string;
    category: string;
    description: string;
  }
) {
  const list = getSellers();
  const seller = list.find((s) => s.id === id);
  if (!seller) return;
  Object.assign(seller, { ...profile, status: "KYC Pending" as const });
  writeJSON(SELLERS_KEY, list);
}

export function submitSellerKyc(id: string, input: { docs: string[] }) {
  const list = getSellers();
  const seller = list.find((s) => s.id === id);
  if (!seller) return;
  Object.assign(seller, {
    kyc: {
      status: "Submitted" as const,
      submittedAt: new Date().toISOString(),
      docs: input.docs.map((d) => ({ kind: d, fileName: d, submittedAt: new Date().toISOString() })),
    },
    status: "Under Review" as const,
  });
  writeJSON(SELLERS_KEY, list);
  sendEmail({
    to: seller.email,
    subject: "KYC submitted — under review",
    template: "seller-kyc",
    body: "Your digital KYC is submitted. Our team will review and activate your seller account shortly.",
  });
}

export function approveSeller(id: string) {
  const list = getSellers();
  const seller = list.find((s) => s.id === id);
  if (!seller) return;
  seller.status = "Active";
  seller.kyc.status = "Verified";
  seller.agreement = { status: "Sent", sentAt: new Date().toISOString() };

  const existing = getAccounts().find(
    (a) => a.email.toLowerCase() === seller.email.toLowerCase()
  );
  const account: User = existing
    ? {
        ...existing,
        firstName: seller.firstName || existing.firstName,
        lastName: seller.lastName || existing.lastName,
        phone: seller.phone || existing.phone,
        whatsapp: seller.phone || existing.whatsapp,
        role: "seller",
        sellerId: seller.id,
      }
    : {
        id: `seller-${seller.id}`,
        firstName: seller.firstName,
        lastName: seller.lastName,
        email: seller.email,
        phone: seller.phone,
        whatsapp: seller.phone,
        accountId: sellerId12(),
        role: "seller",
        sellerId: seller.id,
        password: "seller123",
      };
  seller.accountId = account.accountId;
  writeJSON(SELLERS_KEY, list);
  saveAccount(account);

  sendEmail({
    to: seller.email,
    subject: "Your seller account is now active",
    template: "seller-activated",
    body: `Congratulations ${seller.firstName}!\n\nYour seller account is live.\nSeller ID: ${seller.accountId}\n\nPlease sign the seller agreement in your portal to start selling.\n\n– VGMF Marketplace`,
  });
}

export function rejectSeller(id: string) {
  const list = getSellers();
  const seller = list.find((s) => s.id === id);
  if (!seller) return;
  seller.status = "Rejected";
  seller.kyc.status = "Rejected" as SellerKycStatus;
  writeJSON(SELLERS_KEY, list);
  sendEmail({
    to: seller.email,
    subject: "Seller application update",
    template: "seller-rejected",
    body: "We could not approve your seller application at this time. Please contact support.",
  });
}

export function signSellerAgreement(id: string) {
  const list = getSellers();
  const seller = list.find((s) => s.id === id);
  if (!seller) return;
  seller.agreement = { status: "Signed", signedAt: new Date().toISOString() };
  writeJSON(SELLERS_KEY, list);
  sendEmail({
    to: seller.email,
    subject: "Seller agreement signed",
    template: "seller-agreement",
    body: `Your seller agreement is signed. You can now list products and fulfil orders.\n\n– VGMF Marketplace`,
  });
}

/* ---------------- Seller orders ---------------- */

export function getSellerOrders(): Order[] {
  return readJSON<Order[]>(SELLER_ORDERS_KEY, []);
}

export function seedSellerOrders(sellerId: string) {
  if (getSellerOrders().length > 0) return;
  const now = Date.now();
  const orders: Order[] = [
    {
      id: "521034987120",
      userId: "seller-cust-1",
      date: new Date(now - 6 * 864e5).toISOString(),
      items: [
        { bookId: "rasa-shastra", title: "Rasa Shastra Essentials", quantity: 2, price: 760, originalPrice: 899, currency: "INR" },
      ],
      subtotal: 1520, discount: 278, gst: 76, shipping: 0, total: 1596,
      currency: "INR", paymentStatus: "Paid", status: "Delivered", deliveryMode: "delivery",
      deliveryAddress: { fullName: "Dr. Anil Deshmukh", phone: "+91 98220 12345", line1: "12 Shivaji Nagar, FC Road", city: "Pune", state: "Maharashtra", pincode: "411005" },
      sellerId,
    },
    {
      id: "778904512345",
      userId: "seller-cust-2",
      date: new Date(now - 2 * 864e5).toISOString(),
      items: [
        { bookId: "clinical-guidelines", title: "Ayurveda Clinical Practice Guidelines", quantity: 1, price: 850, originalPrice: 1050, currency: "INR" },
        { bookId: "pharmacology-2", title: "Ayurveda Pharmacology Vol. 2", quantity: 1, price: 940, originalPrice: 1100, currency: "INR" },
      ],
      subtotal: 1790, discount: 360, gst: 90, shipping: 0, total: 1880,
      currency: "INR", paymentStatus: "Paid", status: "Packed", deliveryMode: "delivery",
      deliveryAddress: { fullName: "Smt. Radha Kulkarni", phone: "+91 99220 55321", line1: "22 FC Road", city: "Pune", state: "Maharashtra", pincode: "411004" },
      sellerId,
      plan: {
        packedBy: new Date(now - 1 * 864e5).toISOString(),
        pickedUpBy: new Date(now + 1 * 864e5).toISOString(),
        shippedBy: new Date(now + 2 * 864e5).toISOString(),
        deliveredBy: new Date(now + 5 * 864e5).toISOString(),
        packagingId: "rigid",
        packagingLabel: "Rigid protective box",
      },
    },
    {
      id: "902341236780",
      userId: "seller-cust-3",
      date: new Date(now - 1 * 864e5).toISOString(),
      items: [
        { bookId: "pharmacology-2", title: "Ayurveda Pharmacology Vol. 2", quantity: 1, price: 940, originalPrice: 1100, currency: "INR" },
      ],
      subtotal: 940, discount: 160, gst: 47, shipping: 0, total: 987,
      currency: "INR", paymentStatus: "Paid", status: "Ordered", deliveryMode: "delivery",
      deliveryAddress: { fullName: "Dr. Prakash Joshi", phone: "+91 97654 11223", line1: "7 Viman Nagar", city: "Pune", state: "Maharashtra", pincode: "411014" },
      sellerId,
      plan: {
        packedBy: new Date(now + 1 * 864e5).toISOString(),
        pickedUpBy: new Date(now + 3 * 864e5).toISOString(),
        shippedBy: new Date(now + 4 * 864e5).toISOString(),
        deliveredBy: new Date(now + 7 * 864e5).toISOString(),
        packagingId: "standard",
        packagingLabel: "Standard cardboard box",
      },
    },
  ];
  writeJSON(SELLER_ORDERS_KEY, orders);
}

type SellerKycStatus = Seller["kyc"]["status"];