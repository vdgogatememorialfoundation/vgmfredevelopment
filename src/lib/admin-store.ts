import type {
  AccountStatus,
  DeliveryAddress,
  Order,
  OrderItem,
  OrderPlan,
  OutboxEmail,
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
import { commitStockForOrder, getLiveBooks, releaseStockForOrder } from "@/lib/product-data";
import { getNotifications, queueNotification } from "@/lib/notify";
import { getOrderSettings, shippingFeeFor } from "@/lib/integrations";
import { generatePassword } from "@/lib/passwords";
import { currentActorEmail, recordActivity } from "@/lib/activity";
import { emptySocial } from "@/lib/social";
import { staffReplyTo } from "@/lib/account-mail";

export type OrderStatus = Order["status"];

const SETTINGS_KEY = "vgmf_settings";
const SHIPMENTS_KEY = "vgmf_shipments";
const SUPPORT_KEY = "vgmf_support";
const TICKETS_KEY = "vgmf_tickets";
const FAQS_KEY = "vgmf_faqs";
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
  window.dispatchEvent(new Event("vgmf-cms"));
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
    social: emptySocial(),
    apiKeys: {
      googleMaps: "",
      googleAnalytics: "",
      shiprocket: "",
      razorpay: "",
      zeptomail: "",
    },
    liveChatEnabled: false,
    liveChatOnline: false,
    processing: {
      daysToPack: 1,
      daysToPickup: 1,
      daysInTransit: 4,
      orderCutoffHour: 14,
      storePickupEnabled: true,
      pickupHoldingDays: 3,
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
    couriers: ["Shiprocket Surface", "Shiprocket Express", "iThink Logistics"],
    outOfStockThreshold: 5,
  };
}

export function getSettings(): SiteSettings {
  const current = readJSON<SiteSettings | null>(SETTINGS_KEY, null);
  if (!current) return defaultSettings();
  const defaults = defaultSettings();
  return {
    ...defaults,
    ...current,
    apiKeys: { ...defaults.apiKeys, ...current.apiKeys },
    processing: { ...defaults.processing, ...current.processing },
    social: { ...defaults.social, ...current.social },
    liveChatEnabled: current.liveChatEnabled ?? defaults.liveChatEnabled,
    liveChatOnline: current.liveChatOnline ?? defaults.liveChatOnline,
    pickupTimeslots: current.pickupTimeslots?.length ? current.pickupTimeslots : defaults.pickupTimeslots,
  };
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

const CONTENT_RESET_KEY = "vgmf_content_cleared_v3";
const DEMO_CONTENT_KEYS = [
  "vgmf_orders",
  "vgmf_cart",
  "vgmf_wishlist",
  "vgmf_returns",
  "vgmf_shipments",
  "vgmf_event_edits",
  "vgmf_custom_events",
  "vgmf_article_edits",
  "vgmf_custom_articles",
  "vgmf_announcement_edits",
  "vgmf_custom_announcements",
  "vgmf_certificate_edits",
  "vgmf_custom_certificates",
  "vgmf_custom_books",
  "vgmf_admin_products",
  "vgmf_deleted_books",
  "vgmf_applications",
  "vgmf_store_credit",
  "vgmf_support",
  "vgmf_tickets",
  "vgmf_outbox",
  "vgmf_notice_edits",
  "vgmf_custom_notices",
  "vgmf_flyer_edits",
  "vgmf_custom_flyers",
  "vgmf_banner_edits",
  "vgmf_custom_banners",
  "vgmf_video_edits",
  "vgmf_custom_videos",
  "vgmf_clinic_edits",
  "vgmf_custom_clinics",
];

export function ensureBootstrapped() {
  if (typeof window === "undefined") return;
  if (!window.localStorage.getItem(CONTENT_RESET_KEY)) {
    DEMO_CONTENT_KEYS.forEach((key) => window.localStorage.removeItem(key));
    window.localStorage.setItem(CONTENT_RESET_KEY, "1");
  }
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

export function updateAccount(email: string, update: Partial<User>) {
  const accounts = getAccounts();
  const index = accounts.findIndex((account) => account.email.toLowerCase() === email.toLowerCase());
  if (index === -1) return;
  accounts[index] = { ...accounts[index], ...update };
  writeJSON("vgmf_accounts", accounts);
  if (typeof window !== "undefined") {
    const session = readJSON<User | null>("vgmf_session", null);
    if (session?.email.toLowerCase() === email.toLowerCase()) writeJSON("vgmf_session", { ...session, ...update });
  }
}

export function removeAccount(email: string) {
  recordActivity({ email, kind: "deleted", by: currentActorEmail() });
  writeJSON("vgmf_accounts", getAccounts().filter((account) => account.email.toLowerCase() !== email.toLowerCase()));
  const session = readJSON<User | null>("vgmf_session", null);
  if (session?.email.toLowerCase() === email.toLowerCase()) window.localStorage.removeItem("vgmf_session");
  notifyCms();
}

export function setAccountStatus(email: string, status: AccountStatus, reason?: string) {
  updateAccount(email, { status, statusReason: status === "active" ? undefined : reason });
  recordActivity({
    email,
    kind: status === "banned" ? "banned" : status === "disabled" ? "disabled" : "reactivated",
    by: currentActorEmail(),
    detail: reason,
  });
  notifyCms();
}

export function getAccounts(): User[] {
  if (typeof window === "undefined") return [];
  return readJSON<User[]>("vgmf_accounts", []);
}

export function getAccountByEmail(email?: string) {
  if (!email) return undefined;
  return getAccounts().find((account) => account.email.toLowerCase() === email.toLowerCase());
}

export function displayName(user: Pick<User, "salutation" | "firstName" | "middleName" | "lastName">, withSalutation = false) {
  return [withSalutation ? user.salutation : "", user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ");
}

function notifyCms() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("vgmf-cms"));
}

function uniqueAccountId() {
  const used = new Set(getAccounts().map((account) => account.accountId));
  let id = "";
  do id = String(Math.floor(100000000000 + Math.random() * 900000000000));
  while (used.has(id));
  return id;
}

export const SALUTATIONS = ["Mr.", "Mrs.", "Ms.", "Dr.", "Vaidya", "Prof.", "Shri", "Smt."];

export type CustomerInput = {
  salutation?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  phone: string;
  email: string;
  address?: User["address"];
};

export function createCustomerAccount(input: CustomerInput, options: { sendDetails?: boolean } = {}) {
  const email = input.email.trim();
  if (getAccountByEmail(email)) throw new Error("An account with this email already exists.");
  const phone = input.phone.trim();
  if (getAccounts().some((account) => account.phone.replace(/\D/g, "").slice(-10) === phone.replace(/\D/g, "").slice(-10))) {
    throw new Error("An account with this phone number already exists.");
  }
  const account: User = {
    id: `usr-${Date.now()}`,
    salutation: input.salutation || undefined,
    firstName: input.firstName.trim(),
    middleName: input.middleName?.trim() || undefined,
    lastName: input.lastName.trim(),
    email,
    phone,
    whatsapp: phone,
    accountId: uniqueAccountId(),
    role: "customer",
    status: "active",
    address: input.address,
    storeCredit: 0,
    createdAt: new Date().toISOString(),
    createdBy: currentActor(),
    password: generatePassword(),
  };
  saveAccount(account);
  recordActivity({ email: account.email, kind: "created", by: currentActorEmail(), detail: "Customer account created" });
  notifyCms();
  if (options.sendDetails !== false) sendAccountDetails(account.email, true);
  return getAccountByEmail(account.email) ?? account;
}

export function updateCustomer(email: string, update: Partial<User>) {
  const nextEmail = update.email?.trim();
  if (nextEmail && nextEmail.toLowerCase() !== email.toLowerCase() && getAccountByEmail(nextEmail)) {
    throw new Error("Another account already uses this email.");
  }
  updateAccount(email, { ...update, whatsapp: update.phone ?? update.whatsapp });
  recordActivity({ email: nextEmail || email, kind: "updated", by: currentActorEmail(), detail: "Account details updated" });
  notifyCms();
}

function siteOrigin() {
  return typeof window === "undefined" ? "" : window.location.origin;
}

/** Emails the customer (or staff member) their account and sign-in details. */
export function sendAccountDetails(email: string, isNew = false) {
  const account = getAccountByEmail(email);
  if (!account) return;
  const role = account.role ?? "customer";
  const signIn =
    role === "customer"
      ? `${siteOrigin()}/login?mode=signin`
      : role === "staff" || role === "coadmin"
        ? `${siteOrigin()}/staff/login`
        : role === "doctor"
          ? `${siteOrigin()}/doctor/login`
          : `${siteOrigin()}/admin/login`;
  const address = account.address
    ? [account.address.line1, account.address.landmark, account.address.city, account.address.state, account.address.pincode].filter(Boolean).join(", ")
    : "Not added";
  const lines = [
    `Dear ${displayName(account, true) || "Member"},`,
    "",
    isNew ? "Your account on the Vaidya Gogate Memorial Foundation portal has been created." : "Here are your account details for the Vaidya Gogate Memorial Foundation portal.",
    "",
    `Account ID: ${account.accountId ?? "-"}`,
    `Name: ${displayName(account, true)}`,
    `Registered email: ${account.email}`,
    `Registered mobile: ${account.phone}`,
    `Address: ${address}`,
    role === "customer" ? `Store credit balance: ₹${(account.storeCredit ?? 0).toLocaleString("en-IN")}` : `Role: ${role}`,
    "",
    "How to sign in",
    `Open ${signIn} and sign in with ${account.email}${account.password ? ` and password ${account.password}` : ""}. Please change the password after you sign in.`,
    "",
    "If you did not expect this email, contact us at support@vaidyagogate.org.",
    "",
    "– Vaidya Gogate Memorial Foundation",
  ];
  sendEmail({
    to: account.email,
    phone: account.phone,
    name: displayName(account),
    params: [displayName(account) || "Member", account.accountId ?? ""],
    subject: isNew ? `Welcome to VGMF – your Account ID ${account.accountId}` : `Your VGMF account details (Account ID ${account.accountId})`,
    template: isNew ? "account-created" : "account-details",
    body: lines.join("\n"),
  });
  updateAccount(account.email, { lastDetailsSentAt: new Date().toISOString() });
}

/* ---------------- Store credit ---------------- */

export type StoreCreditEntry = { id: string; email: string; amount: number; at: string; note: string; orderId?: string; by?: string };

const CREDIT_KEY = "vgmf_store_credit";

export function getStoreCreditLedger(email?: string) {
  const all = readJSON<StoreCreditEntry[]>(CREDIT_KEY, []);
  return email ? all.filter((entry) => entry.email.toLowerCase() === email.toLowerCase()) : all;
}

export function getStoreCredit(email?: string) {
  return Math.max(0, getAccountByEmail(email)?.storeCredit ?? 0);
}

/** Positive amount adds credit, negative spends it. Returns the new balance. */
export function adjustStoreCredit(email: string, amount: number, note: string, orderId?: string) {
  const account = getAccountByEmail(email);
  if (!account) throw new Error("Store credit needs a customer account with this email.");
  const balance = Math.max(0, Math.round(((account.storeCredit ?? 0) + amount) * 100) / 100);
  updateAccount(account.email, { storeCredit: balance });
  writeJSON(CREDIT_KEY, [
    { id: `SC${Date.now()}${Math.floor(Math.random() * 90 + 10)}`, email: account.email, amount, at: new Date().toISOString(), note, orderId, by: currentActor() },
    ...getStoreCreditLedger(),
  ]);
  notifyCms();
  return balance;
}

export function createUserAccount(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: "customer" | "admin" | "coadmin" | "staff" | "doctor";
  password?: string;
  staffRoleId?: string;
}) {
  const password = input.password?.trim() || generatePassword();
  const account: User = {
    id: `usr-${Date.now()}`,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    whatsapp: input.phone,
    accountId: uniqueAccountId(),
    role: input.role,
    status: "active",
    createdAt: new Date().toISOString(),
    createdBy: currentActor(),
    staffRoleId: input.role === "staff" ? input.staffRoleId ?? "general-staff" : undefined,
    password,
  };
  saveAccount(account);
  recordActivity({ email: account.email, kind: "created", by: currentActorEmail(), detail: `${input.role} account created` });
  sendAccountDetails(account.email, true);
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
  id?: string;
  userEmail?: string;
  userId?: string;
  deliverTo: DeliveryAddress;
  items: { bookId: string; quantity: number }[];
  deliveryMode?: "delivery" | "store_pickup";
  payment?: "collect" | "link" | "cod" | "paid";
  paymentMethod?: string;
  paymentRef?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  courierChoice?: Order["courierChoice"];
  shippingOverride?: number;
  channel?: Order["channel"];
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
        sku: book.sku,
        preorder: Boolean(book.preorder?.enabled && book.stock <= 0),
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
  const settings = getOrderSettings();
  const itemCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const shipping =
    input.deliveryMode === "store_pickup"
      ? 0
      : input.shippingOverride ?? shippingFeeFor(subtotal, itemCount, input.courierChoice?.rate, settings);
  const cod = input.payment === "cod";
  const codFee = cod && settings.codEnabled ? settings.codFee : 0;
  const paid = input.payment === "paid";
  const order: Order = {
    id: input.id ?? generateOrderId(),
    userId: input.userId ?? "admin",
    date: new Date().toISOString(),
    items: orderItems,
    subtotal,
    discount,
    gst,
    shipping: shipping + codFee,
    total: subtotal + gst + shipping + codFee,
    currency: storeConfig.currency,
    paymentStatus: paid ? "Paid" : "Pending",
    paymentMethod: paid ? input.paymentMethod ?? "Recorded by admin" : cod ? "Cash on delivery" : undefined,
    paymentRef: input.paymentRef,
    razorpayOrderId: input.razorpayOrderId,
    razorpayPaymentId: input.razorpayPaymentId,
    paidAt: paid ? new Date().toISOString() : undefined,
    status: paid || cod ? "Ordered" : "Pending",
    channel: input.channel ?? "admin",
    courierChoice: input.courierChoice,
    courierName: input.courierChoice?.courierName,
    createdBy: currentActor(),
    history: [{ at: new Date().toISOString(), status: "Created", note: input.channel === "pos" ? "Created at POS" : "Created from admin", by: currentActor() }],
    deliveryMode: input.deliveryMode ?? "delivery",
    deliveryAddress: {
      ...input.deliverTo,
      email: input.deliverTo.email ?? input.userEmail ?? "",
    },
  };
  order.plan = computeOrderPlan(order);
  if (commitStockForOrder(order)) order.stockCommitted = true;
  saveOrder(order);
  sendEmail({
    to: order.deliveryAddress?.email || input.userEmail || "",
    phone: order.deliveryAddress?.phone,
    name: order.deliveryAddress?.fullName,
    params: [order.deliveryAddress?.fullName ?? "Customer", order.id, `₹${order.total}`],
    subject: `Order ${order.id} placed`,
    template: "order-placed",
    body: `Your order ${order.id} is ${order.paymentStatus === "Paid" ? "confirmed" : "created and awaiting payment"}.\n\nTotal: ₹${order.total.toLocaleString("en-IN")}\nExpected delivery: ${formatDate(order.plan.deliveredBy)}\n\n– VGMF Store`,
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

export function deleteOrder(orderId: string) {
  const order = getOrder(orderId);
  if (order?.stockCommitted) releaseStockForOrder(order);
  writeJSON("vgmf_orders", getOrders().filter((item) => item.id !== orderId));
}

export function resaveOrder(
  orderId: string,
  update: { items?: OrderItem[]; deliveryAddress?: DeliveryAddress; deliveryMode?: Order["deliveryMode"] }
) {
  const order = getOrder(orderId);
  if (!order) throw new Error("Order not found.");
  const items = update.items ?? order.items;
  if (update.items && order.stockCommitted) {
    releaseStockForOrder(order);
    commitStockForOrder({ items, stockCommitted: false });
  }
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = items.reduce(
    (sum, item) => sum + ((item.originalPrice ?? item.price) - item.price) * item.quantity,
    0
  );
  const gst = Math.round(subtotal * storeConfig.gstRate);
  const next = withHistory(
    {
      ...order,
      items,
      deliveryAddress: update.deliveryAddress ?? order.deliveryAddress,
      deliveryMode: update.deliveryMode ?? order.deliveryMode,
      subtotal,
      discount,
      gst,
      total: subtotal + gst + order.shipping - (order.storeCreditUsed ?? 0),
      stockCommitted: order.stockCommitted,
    },
    "Order edited"
  );
  updateOrderInStore(next);
  return next;
}

export function refundToStoreCredit(orderId: string, amount?: number, note?: string) {
  const order = getOrder(orderId);
  if (!order) return;
  const email = order.deliveryAddress?.email;
  if (!email) throw new Error("This order has no customer email to credit.");
  const refundAmount = amount ?? Math.max(0, order.total - (order.refundAmount ?? 0));
  const balance = adjustStoreCredit(email, refundAmount, note ?? `Refund for order ${order.id}`, order.id);
  const next: Order = withHistory(
    {
      ...order,
      paymentStatus: refundAmount >= order.total ? "Refunded" : "Partially Refunded",
      refundAmount: (order.refundAmount ?? 0) + refundAmount,
      refunds: [...(order.refunds ?? []), { id: `RF${Date.now()}`, at: new Date().toISOString(), amount: refundAmount, destination: "store_credit", note, by: currentActor() }],
    },
    "Store credit issued",
    `₹${refundAmount} · balance ₹${balance}`
  );
  updateOrderInStore(next);
  sendEmail({
    to: email,
    phone: order.deliveryAddress?.phone,
    name: order.deliveryAddress?.fullName,
    params: [order.deliveryAddress?.fullName ?? "Customer", order.id, `₹${refundAmount}`],
    subject: `Store credit of ₹${refundAmount} for order ${order.id}`,
    template: "store-credit",
    body: `A store credit of ₹${refundAmount.toLocaleString("en-IN")} has been added to your VGMF account for order ${order.id}. Current balance: ₹${balance.toLocaleString("en-IN")}.\n\n– VGMF Store`,
  });
  return next;
}

export function exportOrdersCsv(orders: Order[]) {
  const header = ["Order ID", "Date", "Customer", "Phone", "Email", "Status", "Payment", "Items", "Total", "Courier", "AWB"];
  const rows = orders.map((order) => [
    order.id,
    order.date,
    order.deliveryAddress?.fullName ?? "",
    order.deliveryAddress?.phone ?? "",
    order.deliveryAddress?.email ?? "",
    order.status,
    order.paymentStatus,
    order.items.map((item) => `${item.quantity} x ${item.title}`).join("; "),
    String(order.total),
    order.courierName ?? "",
    order.trackingId ?? "",
  ]);
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `vgmf-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function printOrdersPdf(orders: Order[]) {
  const rows = orders
    .map(
      (order) =>
        `<tr><td>${order.id}</td><td>${order.deliveryAddress?.fullName ?? ""}</td><td>${order.status}</td><td>${order.paymentStatus}</td><td>₹${order.total.toLocaleString("en-IN")}</td></tr>`
    )
    .join("");
  printHtml(
    "Orders",
    `<h1>VGMF orders</h1><table><tr><th>ID</th><th>Customer</th><th>Status</th><th>Payment</th><th>Total</th></tr>${rows}</table>`
  );
}

export function setOrderStatus(orderId: string, status: OrderStatus) {
  const order = getOrder(orderId);
  if (!order) return;
  const next: Order = withHistory({ ...order, status }, status);
  if (status === "Delivered" && order.paymentMethod === "Cash on delivery") {
    next.paymentStatus = "Paid";
  }
  if (status === "Cancelled" && order.stockCommitted) {
    releaseStockForOrder(order);
    next.stockCommitted = false;
  }
  updateOrderInStore(next);
  sendOrderStatusEmail(next, status);
}

export function cancelOrder(orderId: string, reason?: string) {
  const order = getOrder(orderId);
  if (!order) return;
  if (order.stockCommitted) releaseStockForOrder(order);
  const next: Order = withHistory(
    { ...order, status: "Cancelled", cancelReason: reason, stockCommitted: false },
    "Cancelled",
    reason
  );
  updateOrderInStore(next);
  sendOrderStatusEmail(next, "Cancelled");
}

export function refundOrder(orderId: string, amount?: number, note?: string) {
  const order = getOrder(orderId);
  if (!order) return;
  const refundAmount = amount ?? Math.max(0, order.total - (order.refundAmount ?? 0));
  const next: Order = withHistory(
    {
      ...order,
      paymentStatus: refundAmount + (order.refundAmount ?? 0) >= order.total ? "Refunded" : "Partially Refunded",
      refundAmount: (order.refundAmount ?? 0) + refundAmount,
      refunds: [...(order.refunds ?? []), { id: `RF${Date.now()}`, at: new Date().toISOString(), amount: refundAmount, destination: "original", note, by: currentActor() }],
    },
    "Refunded",
    note ?? `₹${refundAmount}`
  );
  updateOrderInStore(next);
  const days = getOrderSettings().refunds.processingDays;
  sendEmail({
    to: order.deliveryAddress?.email || "",
    phone: order.deliveryAddress?.phone,
    name: order.deliveryAddress?.fullName,
    params: [order.deliveryAddress?.fullName ?? "Customer", order.id, `₹${refundAmount}`],
    subject: `Refund initiated for order ${order.id}`,
    template: "refund",
    body: `A refund of ₹${refundAmount.toLocaleString("en-IN")} has been initiated for order ${order.id} to your original payment method. It reflects within ${days} business days.\n\n– VGMF Store`,
  });
}

export function setPaymentStatus(orderId: string, paymentStatus: Order["paymentStatus"]) {
  const order = getOrder(orderId);
  if (!order) return;
  updateOrderInStore(withHistory({ ...order, paymentStatus }, `Payment ${paymentStatus}`));
}

export function recordPayment(orderId: string, input: { method: string; reference?: string; razorpayPaymentId?: string }) {
  const order = getOrder(orderId);
  if (!order) return;
  const next = withHistory(
    {
      ...order,
      paymentStatus: "Paid",
      paymentMethod: input.method,
      paymentRef: input.reference,
      razorpayPaymentId: input.razorpayPaymentId ?? order.razorpayPaymentId,
      paidAt: new Date().toISOString(),
      status: order.status === "Pending" ? "Ordered" : order.status,
    },
    "Payment received",
    `${input.method}${input.reference ? ` · ${input.reference}` : ""}`
  );
  updateOrderInStore(next);
  return next;
}

export function patchOrder(orderId: string, update: Partial<Order>, note?: string) {
  const order = getOrder(orderId);
  if (!order) return;
  const next = note ? withHistory({ ...order, ...update }, note) : { ...order, ...update };
  updateOrderInStore(next);
  return next;
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
    trackingId: undefined,
    refunds: undefined,
    returnShipment: undefined,
    channel: "admin" as const,
    stockCommitted: false,
  };
  replacement.plan = computeOrderPlan(replacement);
  if (commitStockForOrder(replacement)) replacement.stockCommitted = true;
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
}) {
  const order = getOrder(input.orderId);
  if (!order || order.deliveryMode !== "delivery") return;

  const shipment: ShipmentRecord = {
    id: `SHP${Date.now()}`,
    orderId: order.id,
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

export function saveShipmentRecord(shipment: ShipmentRecord) {
  const list = getShipments().filter((item) => item.id !== shipment.id && item.orderId !== shipment.orderId);
  list.push(shipment);
  writeJSON(SHIPMENTS_KEY, list);
}

export function patchShipment(shipmentId: string, update: Partial<ShipmentRecord>) {
  const list = getShipments();
  const index = list.findIndex((item) => item.id === shipmentId);
  if (index === -1) return;
  list[index] = { ...list[index], ...update };
  writeJSON(SHIPMENTS_KEY, list);
  return list[index];
}

export function removeShipment(shipmentId: string) {
  writeJSON(SHIPMENTS_KEY, getShipments().filter((item) => item.id !== shipmentId));
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

export function printPosReceipt(order: Order) {
  const itemsHtml = order.items
    .map((item) => `<tr><td>${item.title}</td><td>${item.quantity}</td><td>₹${(item.price * item.quantity).toLocaleString("en-IN")}</td></tr>`)
    .join("");
  printHtml(
    `Receipt ${order.id}`,
    `<h1>VGMF Store</h1>
    <p class="muted">In-store receipt · ${formatDate(order.date)}</p>
    <p><b>Order ${order.id}</b><br/>${order.deliveryAddress?.fullName ?? "Walk-in"} · ${order.deliveryAddress?.phone ?? ""}</p>
    <table><tr><th>Item</th><th>Qty</th><th>Amount</th></tr>${itemsHtml}</table>
    <p>Subtotal ₹${order.subtotal.toLocaleString("en-IN")} · GST ₹${order.gst.toLocaleString("en-IN")}${order.storeCreditUsed ? ` · Credit −₹${order.storeCreditUsed.toLocaleString("en-IN")}` : ""}</p>
    <p class="big">Paid ₹${order.total.toLocaleString("en-IN")}</p>
    <p class="muted">${order.paymentMethod ?? "Cash"} ${order.paymentRef ? `· ${order.paymentRef}` : ""} · Thank you.</p>`
  );
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

/* ---------------- Notifications ---------------- */

export function getOutbox(): OutboxEmail[] {
  return getNotifications();
}

export function sendEmail(input: {
  to: string;
  subject: string;
  template: string;
  body: string;
  phone?: string;
  name?: string;
  params?: string[];
  replyTo?: string;
}) {
  return queueNotification({
    ...input,
    replyTo: input.replyTo || staffReplyTo(),
  });
}

export function sendOtpCode(input: { email?: string; phone?: string; name?: string; code: string; purpose: string }) {
  const body = `Hi ${input.name || "there"},\n\nYour VGMF ${input.purpose} code is ${input.code}. It expires in 10 minutes.\n\nIf you did not request this, ignore the message.\n\n– VGMF`;
  return queueNotification({
    to: input.email ?? "",
    phone: input.phone,
    name: input.name,
    params: [input.code],
    subject: `VGMF ${input.purpose} code`,
    template: "otp",
    body,
  });
}

export function sendPeopleEmail(recipients: User[], subject: string, body: string) {
  const text = body.trim();
  const title = subject.trim();
  if (!title || !text || recipients.length === 0) return 0;
  const replyTo = staffReplyTo();
  for (const account of recipients) {
    const name = displayName(account, true) || account.firstName || "there";
    sendEmail({
      to: account.email,
      phone: account.phone,
      name,
      subject: title,
      template: "custom",
      body: text.split("{name}").join(name),
      replyTo,
    });
  }
  return recipients.length;
}

export function sendOrderStatusEmail(order: Order, status: OrderStatus) {
  const to = order.deliveryAddress?.email || "";
  const phone = order.deliveryAddress?.phone;
  if (!to && !phone) return;
  const name = order.deliveryAddress?.fullName ?? "Customer";
  sendEmail({
    to,
    phone,
    name,
    params: [name, order.id, status],
    subject: `Order ${order.id} — ${status}`,
    template: "order-status",
    body: `Hi ${name},\n\nYour order ${order.id} is now ${status}.${order.trackingId ? `\nTracking: ${order.courierName ?? ""} ${order.trackingId}` : ""}\n\n– VGMF Store`,
  });
}

function withHistory(order: Order, status: string, note?: string): Order {
  return {
    ...order,
    history: [...(order.history ?? []), { at: new Date().toISOString(), status, note, by: currentActor() }],
  };
}

function currentActor() {
  if (typeof window === "undefined") return undefined;
  try {
    const session = JSON.parse(window.localStorage.getItem("vgmf_session") ?? "null") as User | null;
    return session?.email;
  } catch {
    return undefined;
  }
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

function uniqueTicketId() {
  const existing = new Set(getTickets().map((ticket) => ticket.id));
  let id = "";
  do {
    id = String(Math.floor(100000000000 + Math.random() * 900000000000));
  } while (existing.has(id));
  return id;
}

/** Find a customer by email or phone, or create one and send account details. */
export function ensureCustomerAccount(input: { name?: string; email?: string; phone?: string }): User | null {
  const email = (input.email || "").trim();
  const phone = (input.phone || "").trim();
  if (!email && !phone) return null;
  const existing =
    (email ? findAccountByIdentifier(email) : null) ||
    (phone ? findAccountByIdentifier(phone) : null);
  if (existing) return existing;
  const digits = phone.replace(/\D/g, "");
  const resolvedEmail = email || (digits ? `guest.${digits}@accounts.vaidyagogate.org` : "");
  if (!resolvedEmail) return null;
  const parts = (input.name || "Guest").trim().split(/\s+/).filter(Boolean);
  return createUserAccount({
    firstName: parts[0] || "Guest",
    lastName: parts.slice(1).join(" "),
    email: resolvedEmail,
    phone: phone || "0000000000",
    role: "customer",
  });
}

export function listSupportAgents(): User[] {
  return getAccounts().filter((account) => {
    const role = account.role;
    return (role === "admin" || role === "coadmin" || role === "staff") && (account.status ?? "active") === "active";
  });
}

export function ticketsVisibleTo(user: User | null | undefined): SupportTicket[] {
  const tickets = getTickets();
  if (!user) return [];
  if (user.role === "admin" || user.role === "coadmin") return tickets;
  const email = user.email.toLowerCase();
  if (user.role === "staff") {
    return tickets.filter(
      (ticket) =>
        !ticket.assignedTo ||
        ticket.assignedTo.toLowerCase() === email ||
        ticket.email.toLowerCase() === email ||
        ticket.userId === user.id
    );
  }
  return tickets.filter((ticket) => ticket.email.toLowerCase() === email || ticket.userId === user.id);
}

export function addTicket(input: {
  name: string;
  email: string;
  subject: string;
  body: string;
  portal?: SupportTicket["portal"];
  phone?: string;
  assignedTo?: string;
  chatThreadId?: string;
  userId?: string;
}) {
  const account = ensureCustomerAccount({ name: input.name, email: input.email, phone: input.phone });
  const now = new Date().toISOString();
  const ticket: SupportTicket = {
    id: uniqueTicketId(),
    name: input.name.trim() || account?.firstName || "Guest",
    email: (account?.email || input.email).trim(),
    phone: input.phone || account?.phone,
    subject: input.subject.trim(),
    body: input.body.trim(),
    portal: input.portal ?? "customer",
    status: "Open",
    createdAt: now,
    updatedAt: now,
    assignedTo: input.assignedTo,
    userId: input.userId || account?.id,
    chatThreadId: input.chatThreadId,
    responses: [],
  };
  const list = getTickets();
  list.push(ticket);
  writeJSON(TICKETS_KEY, list);
  sendEmail({
    to: ticket.email,
    phone: ticket.phone,
    name: ticket.name,
    params: [ticket.name, ticket.id, ticket.status],
    subject: `Support ticket ${ticket.id} opened`,
    template: "ticket-update",
    body: `Hi ${ticket.name},\n\nWe have opened ticket ${ticket.id}: ${ticket.subject}.\n\n${ticket.body}\n\nYou will receive updates on this ticket at ${ticket.email}.\n\n– VGMF Support`,
  });
  return ticket;
}

export function assignTicket(id: string, assignedTo: string) {
  const list = getTickets();
  const ticket = list.find((item) => item.id === id);
  if (!ticket) return;
  ticket.assignedTo = assignedTo || undefined;
  ticket.updatedAt = new Date().toISOString();
  if (ticket.status === "Open" && assignedTo) ticket.status = "In Progress";
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
