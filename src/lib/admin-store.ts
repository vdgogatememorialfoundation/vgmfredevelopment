import type {
  AccountStatus,
  DeliveryAddress,
  Order,
  Book,
  OrderItem,
  OrderPlan,
  OutboxEmail,
  ShipmentRecord,
  SiteSettings,
  SupportMessage,
  SupportTicket,
  FAQItem,
  User, RefundRecord } from "@/types";
import { pickupInstructions } from "@/lib/fulfillment";
import { siteConfig, storeConfig } from "@/lib/constants";
import { generateOrderId, getOrders, pickupOtp, pickupOtpReady, publishShipment, publishShopOrder, saveOrder, syncReplacementProgress } from "@/lib/store";
import { formatDate, formatDateTime } from "@/lib/utils";
import { ACCOUNT_EXISTS_MESSAGE, phoneDigits, samePhone } from "@/lib/account-identity";
import { clearSession, findAccountByIdentifier, getSession, saveAccount, setSession } from "@/lib/auth";
import { commitStockForOrder, getLiveBooks, releaseStockForOrder } from "@/lib/product-data";
import { matchesBarcode, matchesTag } from "@/lib/barcode";
import QRCode from "qrcode";
import { sameShipmentSlot } from "@/lib/shipment-slot";
import { getNotifications, queueNotification } from "@/lib/notify";
import { messageCopyFor } from "@/lib/message-templates";
import { pushInbox } from "@/lib/inbox";
import { commerceCharges, getIntegrations, getOrderSettings, shippingFeeFor } from "@/lib/integrations";
import { barcodeSvg } from "@/lib/barcode";
import { generatePassword } from "@/lib/passwords";
import { currentActorEmail, recordActivity } from "@/lib/activity";
import { logAudit } from "@/lib/audit";
import { emptySocial } from "@/lib/social";
import { senderName, staffReplyTo } from "@/lib/account-mail";
import { pushTicket } from "@/lib/ticket-sync";

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
    logoUrl: "/uploads/site-logo.png",
    faviconUrl: "/icon.png",
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
    tickerSeconds: 36,
    productText: { cardTitle: 14, cardMeta: 12, cardLanguage: 20, cardPrice: 14, pageLanguage: 24 },
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
        name: "Vaidya Gogate Memorial Foundation Clinic",
        code: "PUN",
        address: "Vaidya Gogate Memorial Foundation, 102, Ramprasad Chamber, 368/1, Nanapeth, Near Kirad Hospital, Above Shraddha Medicals, Jawaharlal Nehru Road, Nana Peth",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411002",
        phone: "093737 92952",
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
    logoUrl: current.logoUrl || defaults.logoUrl,
    faviconUrl: current.faviconUrl || current.logoUrl || defaults.faviconUrl,
    apiKeys: { ...defaults.apiKeys, ...current.apiKeys },
    processing: { ...defaults.processing, ...current.processing },
    social: { ...defaults.social, ...current.social },
    liveChatEnabled: current.liveChatEnabled ?? defaults.liveChatEnabled,
    liveChatOnline: current.liveChatOnline ?? defaults.liveChatOnline,
    tickerSeconds: current.tickerSeconds || defaults.tickerSeconds,
    productText: { ...defaults.productText, ...current.productText },
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

const ADMIN_PASSWORD = "admin123";
const STAFF_PASSWORD = "staff123";

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
    firstName: "Vaidya Gogate Memorial",
    lastName: "Foundation",
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
    const session = getSession();
    if (session?.email.toLowerCase() === email.toLowerCase()) setSession({ ...session, ...update });
  }
}

export function removeAccount(email: string) {
  recordActivity({ email, kind: "deleted", by: currentActorEmail() });
  writeJSON("vgmf_accounts", getAccounts().filter((account) => account.email.toLowerCase() !== email.toLowerCase()));
  const session = getSession();
  if (session?.email.toLowerCase() === email.toLowerCase()) clearSession();
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
  alternatePhone?: string;
  email: string;
  address?: User["address"];
};

function phoneInUse(phone: string, exceptEmail?: string) {
  const digits = phoneDigits(phone);
  if (!digits) return false;
  return getAccounts().some((account) => {
    if (exceptEmail && account.email.toLowerCase() === exceptEmail.toLowerCase()) return false;
    return samePhone(account.phone, phone) || samePhone(account.alternatePhone, phone) || samePhone(account.whatsapp, phone);
  });
}

export function createCustomerAccount(input: CustomerInput, options: { sendDetails?: boolean } = {}) {
  const email = input.email.trim();
  if (getAccountByEmail(email) || findAccountByIdentifier(email)) throw new Error(ACCOUNT_EXISTS_MESSAGE);
  const phone = input.phone.trim();
  const alternatePhone = (input.alternatePhone || phone).trim();
  if (phoneInUse(phone) || (alternatePhone && phoneInUse(alternatePhone))) throw new Error(ACCOUNT_EXISTS_MESSAGE);
  const account: User = {
    id: `usr-${Date.now()}`,
    salutation: input.salutation || undefined,
    firstName: input.firstName.trim(),
    middleName: input.middleName?.trim() || undefined,
    lastName: input.lastName.trim(),
    email,
    phone,
    alternatePhone,
    whatsapp: phone,
    accountId: uniqueAccountId(),
    role: "customer",
    status: "active",
    address: input.address,
    storeCredit: 0,
    createdAt: new Date().toISOString(),
    createdBy: currentActor(),
    password: generatePassword(),
    foundationPasswordSet: true,
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
    throw new Error(ACCOUNT_EXISTS_MESSAGE);
  }
  if (update.phone && phoneInUse(update.phone, nextEmail || email)) throw new Error(ACCOUNT_EXISTS_MESSAGE);
  if (update.alternatePhone && phoneInUse(update.alternatePhone, nextEmail || email)) throw new Error(ACCOUNT_EXISTS_MESSAGE);
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
  const signin =
    account.partnerPortals?.length && !account.foundationPasswordSet
      ? `Open ${signIn} and use Forgot password to set a Foundation website password. Seminar, Autism and Fellowship passwords are not used on this site.`
      : `Open ${signIn} and sign in with ${account.email}${account.password ? ` and password ${account.password}` : ""}. Please change the password after you sign in.`;
  const copy = messageCopyFor(isNew ? "account-created" : "account-details", {
    name: displayName(account, true) || "Member",
    email: account.email,
    phone: account.phone,
    accountId: account.accountId ?? "-",
    signin,
  });
  sendEmail({
    to: account.email,
    phone: account.phone,
    name: displayName(account),
    params: [displayName(account) || "Member", account.accountId ?? ""],
    subject: copy.emailSubject,
    template: isNew ? "account-created" : "account-details",
    body: copy.emailBody,
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

const walletKey = (email: string) => `vgmf_wallet_${email.trim().toLowerCase()}`;

/** The server balance when this browser has fetched it, otherwise the locally known one. */
export function getStoreCredit(email?: string) {
  if (!email) return 0;
  const cached = typeof window === "undefined" ? null : window.localStorage.getItem(walletKey(email));
  if (cached != null && Number.isFinite(Number(cached))) return Math.max(0, Number(cached));
  return Math.max(0, getAccountByEmail(email)?.storeCredit ?? 0);
}

/** Records the server's wallet for this customer on this device. */
export function rememberWallet(email: string, balance: number, entries: StoreCreditEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(walletKey(email), String(balance));
  const value = email.toLowerCase();
  const others = getStoreCreditLedger().filter((entry) => entry.email.toLowerCase() !== value);
  writeJSON(CREDIT_KEY, [...entries, ...others]);
  if (getAccountByEmail(email)) updateAccount(email, { storeCredit: balance });
  notifyCms();
}

export function pushStoreCredit(entries: StoreCreditEntry[]) {
  if (typeof window === "undefined" || !entries.length) return Promise.resolve();
  return fetch("/api/shop/wallet", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ entries }),
  })
    .then(() => undefined)
    .catch(() => undefined);
}

/** Positive amount adds credit, negative spends it. Returns the new balance. */
export function adjustStoreCredit(email: string, amount: number, note: string, orderId?: string) {
  const value = email.trim().toLowerCase();
  if (!value) throw new Error("Store credit needs a customer email.");
  const account = getAccountByEmail(value);
  const balance = Math.max(0, Math.round((getStoreCredit(value) + amount) * 100) / 100);
  if (account) updateAccount(account.email, { storeCredit: balance });
  if (typeof window !== "undefined") window.localStorage.setItem(walletKey(value), String(balance));
  const entry: StoreCreditEntry = {
    id: `SC${Date.now()}${Math.floor(Math.random() * 90 + 10)}`,
    email: account?.email ?? value,
    amount,
    at: new Date().toISOString(),
    note,
    orderId,
    by: currentActor(),
  };
  writeJSON(CREDIT_KEY, [entry, ...getStoreCreditLedger()]);
  void pushStoreCredit([entry]);
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
  if (getAccountByEmail(input.email) || findAccountByIdentifier(input.email) || phoneInUse(input.phone)) {
    throw new Error(ACCOUNT_EXISTS_MESSAGE);
  }
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
        batchNo: book.batchNo,
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
  const settings = getOrderSettings();
  const charges = commerceCharges(subtotal, settings);
  const gst = charges.gst;
  const platformFee = charges.platformFee;
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
    accountEmail: (input.deliverTo.email || input.userEmail || "").trim().toLowerCase() || undefined,
    date: new Date().toISOString(),
    items: orderItems,
    subtotal,
    discount,
    gst,
    platformFee,
    shipping: shipping + codFee,
    total: subtotal + gst + platformFee + shipping + codFee,
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
    to: "",
    phone: order.deliveryAddress?.phone,
    name: order.deliveryAddress?.fullName,
    params: [order.deliveryAddress?.fullName ?? "Customer", order.id, `₹${order.total}`],
    subject: `Order ${order.id} placed`,
    template: "order-placed",
    body: `Dear ${order.deliveryAddress?.fullName || "Guest"},\n\nNamaste, and thank you for ordering from Vaidya Gogate Memorial Foundation.\n\nYour order ${order.id} is ${order.paymentStatus === "Paid" ? "confirmed" : "created and awaiting payment"}.\n\nTotal: ₹${order.total.toLocaleString("en-IN")}\n${
      order.deliveryMode === "store_pickup"
        ? pickupInstructions()
        : `Expected delivery: ${formatDate(order.plan.deliveredBy)}`
    }\n\nWith warm regards,\nVaidya Gogate Memorial Foundation`,
  });
  return order;
}

export const ORDER_ALERT_EMAILS = ["care@vaidyagogate.org", "vd.gogatememorialfoundation@gmail.com"];

/** Every new order is mailed to the Foundation desk with the full details. */
export function notifyStaffOfOrder(order: Order) {
  const address = order.deliveryAddress;
  const lines = order.items.map((item) => `- ${item.title}${item.sku ? ` (SKU ${item.sku})` : ""} × ${item.quantity} @ ₹${item.price} = ₹${item.price * item.quantity}`).join("\n");
  const where = address ? [address.line1, address.landmark, address.city, address.state, address.pincode, address.country].filter(Boolean).join(", ") : "";
  const body = [
    `New order ${order.id} · ${formatDateTime(order.date)}`,
    "",
    `Customer: ${address?.fullName || "—"}`,
    `Phone: ${address?.phone || "—"}`,
    `Email: ${address?.email || order.accountEmail || "—"}`,
    order.deliveryMode === "store_pickup" ? "Delivery: Pickup from store" : `Deliver to: ${where || "—"}`,
    "",
    "Items:",
    lines,
    "",
    `Subtotal: ₹${order.subtotal}`,
    order.discount ? `Discount: − ₹${order.discount}` : "",
    order.gst ? `GST: ₹${order.gst}` : "",
    order.platformFee ? `Platform fee: ₹${order.platformFee}` : "",
    `Shipping: ${order.shipping ? `₹${order.shipping}` : "Free / later"}`,
    `Total: ₹${order.total}`,
    `Payment: ${order.paymentStatus}${order.paymentMethod ? ` · ${order.paymentMethod}` : ""}${order.razorpayPaymentId ? ` · ${order.razorpayPaymentId}` : ""}`,
    order.preorderPayment ? `Pre-order: advance ₹${order.preorderPayment.advance ?? ""} · balance ₹${order.preorderPayment.balance ?? ""}` : "",
    order.courierName ? `Courier: ${order.courierName}` : "",
    "",
    `Open in admin: ${typeof window === "undefined" ? "" : window.location.origin}/admin/orders`,
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n");
  for (const to of ORDER_ALERT_EMAILS) {
    sendEmail({ to, subject: `New order ${order.id} · ₹${order.total} · ${address?.fullName || "Customer"}`, template: "staff-new-order", body });
  }
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
  publishShopOrder(order);
}

export function getOrder(orderId: string) {
  return getOrders().find((o) => o.id === orderId);
}

export function deleteOrder(orderId: string) {
  const order = getOrder(orderId);
  if (order?.stockCommitted) releaseStockForOrder(order);
  writeJSON("vgmf_orders", getOrders().filter((item) => item.id !== orderId));
  removeOrderShipments(orderId);
  forgetShopOrder(orderId);
}

export function resaveOrder(
  orderId: string,
  update: { items?: OrderItem[]; deliveryAddress?: DeliveryAddress; deliveryMode?: Order["deliveryMode"]; shipping?: number }
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
  const charges = commerceCharges(subtotal);
  const gst = charges.gst;
  const platformFee = charges.platformFee;
  const shipping =
    update.shipping !== undefined && Number.isFinite(update.shipping)
      ? Math.max(0, Math.round(update.shipping * 100) / 100)
      : order.shipping;
  const total = subtotal + gst + platformFee + shipping - (order.storeCreditUsed ?? 0);
  const advance = order.preorderPayment?.advancePaidAt ? order.preorderPayment.advance : 0;
  const paidSoFar =
    order.paymentStatus === "Paid"
      ? order.total
      : order.paymentStatus === "Partially Paid"
        ? order.amountPaid ?? advance
        : 0;
  const owesMore = paidSoFar > 0 && total > paidSoFar + 0.005;
  const paymentStatus: Order["paymentStatus"] =
    paidSoFar <= 0 ? order.paymentStatus : owesMore ? "Partially Paid" : order.preorderPayment && !order.preorderPayment.balancePaidAt && order.paymentStatus === "Partially Paid" ? "Partially Paid" : "Paid";
  const preorderPayment =
    order.preorderPayment && !order.preorderPayment.balancePaidAt
      ? { ...order.preorderPayment, balance: Math.max(0, Math.round((total - order.preorderPayment.advance) * 100) / 100) }
      : order.preorderPayment;
  const next = withHistory(
    {
      ...order,
      paymentStatus,
      amountPaid: paidSoFar > 0 ? paidSoFar : order.amountPaid,
      preorderPayment,
      items,
      deliveryAddress: update.deliveryAddress ?? order.deliveryAddress,
      deliveryMode: update.deliveryMode ?? order.deliveryMode,
      subtotal,
      discount,
      gst,
      platformFee,
      shipping,
      total,
      stockCommitted: order.stockCommitted,
    },
    "Order edited",
    owesMore
      ? `New total ₹${total.toLocaleString("en-IN")} · ₹${(Math.round((total - paidSoFar) * 100) / 100).toLocaleString("en-IN")} due from the customer`
      : undefined
  );
  updateOrderInStore(next);
  return next;
}

/** Amount still refundable. The platform fee is kept unless the desk ticks "also refund the platform fee" on that refund. */
export function maxRefundable(order: Order, options: { withPlatformFee?: boolean } = {}) {
  const kept = options.withPlatformFee ? 0 : Math.max(0, order.platformFee ?? 0);
  const collected = order.preorderPayment && !order.preorderPayment.balancePaidAt ? order.preorderPayment.advance : order.total;
  return Math.max(0, collected - kept - (order.refundAmount ?? 0));
}

export function refundToStoreCredit(orderId: string, amount?: number, note?: string, options: { withPlatformFee?: boolean } = {}) {
  const order = getOrder(orderId);
  if (!order) return;
  const email = order.deliveryAddress?.email;
  if (!email) throw new Error("This order has no customer email to credit.");
  const cap = maxRefundable(order, options);
  if (amount != null && !(Number.isFinite(amount) && amount > 0)) throw new Error("Enter a refund amount above ₹0.");
  if (amount != null && amount > cap + 0.001) throw new Error(`At most ₹${cap.toLocaleString("en-IN")} can still be refunded on this order.`);
  const refundAmount = Math.round(Math.min(amount ?? cap, cap) * 100) / 100;
  if (refundAmount <= 0) throw new Error("Nothing left to refund. The platform fee is kept unless you tick \"Also refund the platform fee\".");
  const balance = adjustStoreCredit(email, refundAmount, note ?? `Refund for order ${order.id}`, order.id);
  const next: Order = withHistory(
    {
      ...order,
      paymentStatus: (order.refundAmount ?? 0) + refundAmount >= order.total ? "Refunded" : "Partially Refunded",
      refundAmount: (order.refundAmount ?? 0) + refundAmount,
      refunds: [...(order.refunds ?? []), { id: String(Date.now()), at: new Date().toISOString(), amount: refundAmount, destination: "store_credit", note, by: currentActor() }],
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
    body: `Dear Guest,\n\nNamaste, and greetings from Vaidya Gogate Memorial Foundation.\n\nA store credit of ₹${refundAmount.toLocaleString("en-IN")} has been added to your account for order ${order.id}. Current balance: ₹${balance.toLocaleString("en-IN")}.\n\nWith warm regards,\nVaidya Gogate Memorial Foundation`,
  });
  return next;
}

export function exportOrdersCsv(orders: Order[]) {
  const header = [
    "Order ID", "Date", "Channel", "Customer", "Phone", "Email", "Account email",
    "Delivery mode", "Address", "Landmark", "City", "State", "Pincode", "Country",
    "Items", "Item count", "Total quantity", "SKUs",
    "Subtotal", "Discount", "GST", "Platform fee", "Shipping", "Store credit used", "Total",
    "Order status", "Payment status", "Payment method", "Payment ref", "Razorpay payment ID", "Razorpay order ID", "Paid at",
    "Pre-order advance", "Pre-order balance", "Refunded",
    "Courier", "AWB", "Expected delivery", "Return AWB", "Return charge", "Return charge paid by",
  ];
  const rows = orders.map((order) => {
    const address = order.deliveryAddress;
    const refunded = (order.refunds ?? []).reduce((sum, refund) => sum + (Number(refund.amount) || 0), 0);
    return [
      order.id,
      formatDateTime(order.date),
      order.channel ?? "online",
      address?.fullName ?? "",
      address?.phone ?? "",
      address?.email ?? "",
      order.accountEmail ?? "",
      order.deliveryMode === "store_pickup" ? "Store pickup" : "Delivery",
      address?.line1 ?? "",
      address?.landmark ?? "",
      address?.city ?? "",
      address?.state ?? "",
      address?.pincode ?? "",
      address?.country ?? "India",
      order.items.map((item) => `${item.title} x ${item.quantity} @ ${item.price}`).join("; "),
      order.items.length,
      order.items.reduce((sum, item) => sum + item.quantity, 0),
      order.items.map((item) => item.sku || item.bookId).join("; "),
      order.subtotal,
      order.discount,
      order.gst,
      order.platformFee ?? 0,
      order.shipping,
      order.storeCreditUsed ?? 0,
      order.total,
      order.status,
      order.paymentStatus,
      order.paymentMethod ?? "",
      order.paymentRef ?? "",
      order.razorpayPaymentId ?? "",
      order.razorpayOrderId ?? "",
      order.paidAt ? formatDateTime(order.paidAt) : "",
      order.preorderPayment?.advance ?? "",
      order.preorderPayment?.balance ?? "",
      refunded || "",
      order.courierName ?? "",
      order.trackingId ?? "",
      order.plan?.deliveredBy ? formatDate(order.plan.deliveredBy) : order.eta ?? "",
      order.returnShipment?.awb ?? "",
      order.returnShipment?.charge ?? "",
      order.returnShipment?.chargePaidBy ?? "",
    ];
  });
  const csv = "\ufeff" + [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
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
    `<h1>Vaidya Gogate Memorial Foundation orders</h1><table><tr><th>ID</th><th>Customer</th><th>Status</th><th>Payment</th><th>Total</th></tr>${rows}</table>`
  );
}

/* ---------------- Pick & pack ---------------- */

export function assignPicker(orderId: string, assignee: string) {
  const order = getOrder(orderId);
  const email = assignee.trim().toLowerCase();
  if (!order || !email) throw new Error("Pick a staff member to assign.");
  updateOrderInStore(withHistory({ ...order, pick: { assignee: email, assignedAt: new Date().toISOString(), picked: {}, packScan: {} } }, "Picker assigned", email));
}

/** Hand picking (or packing, once picked) to the same or another staff member; their scanner rings. */
export function reassignPickPack(orderId: string, assignee: string, stage: "pick" | "pack") {
  const order = getOrder(orderId);
  const email = assignee.trim().toLowerCase();
  if (!order?.pick) throw new Error("Assign a picker first.");
  if (!email) throw new Error("Pick a staff member.");
  const at = new Date().toISOString();
  const pick =
    stage === "pick"
      ? { ...order.pick, assignee: email, assignedAt: at, acceptedAt: undefined }
      : { ...order.pick, packer: email, packerAssignedAt: at };
  updateOrderInStore(withHistory({ ...order, pick }, stage === "pick" ? "Picker reassigned" : "Packer assigned", email));
}

export function acceptPick(orderId: string) {
  const order = getOrder(orderId);
  if (!order?.pick) return;
  updateOrderInStore(withHistory({ ...order, pick: { ...order.pick, acceptedAt: new Date().toISOString() } }, "Picking started", order.pick.assignee));
}

type ScanKind = "productCode" | "sku" | "isbn" | "any";
const KIND_LABEL: Record<ScanKind, string> = { productCode: "product code", sku: "SKU", isbn: "ISBN", any: "barcode" };
type PickItem = Order["items"][number];

/** Code printed on the packaging slip that the packer scans first. */
export function packingBoxCode(orderId: string) {
  return `BOX-${orderId}`;
}

const plainCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
const isBoxCode = (order: Order, value: string) => plainCode(value) === plainCode(packingBoxCode(order.id));
const isOrderCode = (order: Order, value: string) =>
  !plainCode(value).startsWith("BOX") && (value.replace(/\D/g, "") === order.id.replace(/\D/g, "") || value.includes(order.id));

/** Codes this product carries for the stage, and whether Settings makes each one required. */
function stageKinds(stage: "pick" | "pack", item: PickItem, book?: Book) {
  const rules = getOrderSettings().scanRules;
  const sku = item.sku || book?.sku;
  const rows: { kind: ScanKind; required: boolean }[] = [];
  if (stage === "pick") {
    if (book?.productCode || book?.barcode) rows.push({ kind: "productCode", required: rules.pick.productCode });
    if (sku) rows.push({ kind: "sku", required: rules.pick.sku });
  } else {
    if (sku) rows.push({ kind: "sku", required: rules.pack.sku });
    if (book?.isbn) rows.push({ kind: "isbn", required: rules.pack.isbn });
  }
  return rows;
}

/** Required codes; the first one counts copies. With none required, any of the product's codes counts a copy. */
function requiredKinds(stage: "pick" | "pack", item: PickItem, book?: Book): ScanKind[] {
  const kinds = stageKinds(stage, item, book).filter((row) => row.required).map((row) => row.kind);
  return kinds.length ? kinds : ["any"];
}

function matchedKinds(item: PickItem, book: Book | undefined, value: string): ScanKind[] {
  const kinds: ScanKind[] = [];
  if ((book?.productCode || book?.barcode) && matchesBarcode({ productCode: book?.productCode, barcode: book?.barcode }, value)) kinds.push("productCode");
  const sku = item.sku || book?.sku;
  if (sku && matchesBarcode({ sku }, value)) kinds.push("sku");
  if (book?.isbn && matchesBarcode({ isbn: book.isbn }, value)) kinds.push("isbn");
  if (matchesBarcode({ ...(book ?? {}), id: item.bookId, sku, batchNo: item.batchNo || book?.batchNo }, value)) kinds.push("any");
  return kinds;
}

function stageState(order: Order, stage: "pick" | "pack") {
  const pick = order.pick;
  return { counts: (stage === "pick" ? pick?.picked : pick?.packScan) ?? {}, seen: (stage === "pick" ? pick?.pickCodes : pick?.packCodes) ?? {} };
}

function itemMissing(stage: "pick" | "pack", item: PickItem, book: Book | undefined, counts: Record<string, number>, seen: Record<string, string[]>) {
  const req = requiredKinds(stage, item, book);
  const left = item.quantity - (counts[item.bookId] ?? 0);
  const missing: string[] = [];
  if (left > 0) missing.push(`${left} × ${KIND_LABEL[req[0]]}`);
  for (const kind of req.slice(1)) if (!(seen[item.bookId] ?? []).includes(kind)) missing.push(KIND_LABEL[kind]);
  return missing;
}

/** What is still to scan, item by item, e.g. "VGMF BOOK: 1 × product code, SKU". Empty when every item is done. */
export function pickPackLeft(order: Order, stage: "pick" | "pack") {
  const books = getLiveBooks();
  const { counts, seen } = stageState(order, stage);
  return order.items
    .map((item) => {
      const missing = itemMissing(stage, item, books.find((row) => row.id === item.bookId), counts, seen);
      return missing.length ? `${item.title}: ${missing.join(", ")}` : "";
    })
    .filter(Boolean)
    .join(" · ");
}

/** Which order-level steps are satisfied: scanned, optional in Settings, or skipped by admin. */
export function pickPackGates(order: Order) {
  const pick = order.pick;
  const rules = getOrderSettings().scanRules;
  const skipped = pick?.bypassed ?? [];
  return {
    pickOrder: Boolean(pick?.pickOrderScannedAt) || !rules.pick.orderCode || skipped.includes("pickOrder"),
    box: Boolean(pick?.boxScannedAt) || !rules.pack.boxCode || skipped.includes("box"),
    packOrder: Boolean(pick?.orderScannedAt) || !rules.pack.orderCode || skipped.includes("packOrder"),
    photos: Boolean(order.packPhotos?.length) || !rules.pack.photos || skipped.includes("photos"),
    confirm: rules.pack.confirm,
  };
}

/** Scanned / not scanned checklist for the picker or packer screen. */
export function pickPackChecklist(order: Order) {
  const pick = order.pick;
  const rules = getOrderSettings().scanRules;
  const skipped = pick?.bypassed ?? [];
  const stage: "pick" | "pack" = pick?.pickedAt ? "pack" : "pick";
  const books = getLiveBooks();
  const { counts, seen } = stageState(order, stage);
  const mark = (label: string, done: boolean, required: boolean, key?: string) => ({ label, done, optional: !required, bypassed: Boolean(key && skipped.includes(key)) });
  const steps =
    stage === "pick"
      ? [mark("Order code", Boolean(pick?.pickOrderScannedAt), rules.pick.orderCode, "pickOrder")]
      : [mark("Box code", Boolean(pick?.boxScannedAt), rules.pack.boxCode, "box"), mark("Order code", Boolean(pick?.orderScannedAt), rules.pack.orderCode, "packOrder")];
  const items = order.items.map((item) => {
    const book = books.find((row) => row.id === item.bookId);
    const req = requiredKinds(stage, item, book);
    const count = Math.min(item.quantity, counts[item.bookId] ?? 0);
    const had = seen[item.bookId] ?? [];
    const itemsKey = stage === "pick" ? "pickItems" : "packItems";
    return {
      id: item.bookId,
      title: item.title,
      codes: [
        mark(`${KIND_LABEL[req[0]]} ${count}/${item.quantity}`, count >= item.quantity, true, itemsKey),
        ...stageKinds(stage, item, book)
          .filter((row) => row.kind !== req[0])
          .map((row) => mark(KIND_LABEL[row.kind], had.includes(row.kind), row.required, itemsKey)),
      ],
    };
  });
  const finish =
    stage === "pack"
      ? [
          mark(`Packing photos${order.packPhotos?.length ? ` (${order.packPhotos.length})` : ""}`, Boolean(order.packPhotos?.length), rules.pack.photos, "photos"),
          mark("Items match description", Boolean(pick?.matchedAt), rules.pack.confirm),
        ]
      : [];
  return { stage, steps, items, finish };
}

function finishPacked(order: Order, note: string) {
  const pick = order.pick;
  if (!pick) return "";
  const now = new Date().toISOString();
  updateOrderInStore(withHistory({ ...order, pick: { ...pick, matchedAt: pick.matchedAt ?? now, packedAt: now } }, "Packed", note));
  setOrderStatus(order.id, order.deliveryMode === "store_pickup" ? "Packed" : "Ready to Ship");
  return order.deliveryMode === "store_pickup" ? "Packed. Ready for store pickup (OTP unlocked)." : "Packed and ready for pickup. Admin assigns the courier from Orders.";
}

/** When Settings does not require the final check, pack as soon as every required step is done. */
export function maybeFinishPack(orderId: string) {
  const order = getOrder(orderId);
  if (!order?.pick?.pickedAt || order.pick.packedAt) return "";
  const gates = pickPackGates(order);
  if (gates.confirm || !gates.box || !gates.packOrder || !gates.photos || pickPackLeft(order, "pack")) return "";
  return finishPacked(order, "All required scans done");
}

/** One scan in the store. Picker: order code, then each item's product code and SKU. Packer: box code, order code, then each item's SKU and ISBN. Settings can make any of these optional. */
export function recordPickScan(orderId: string, code: string): string {
  const order = getOrder(orderId);
  const pick = order?.pick;
  if (!order || !pick) throw new Error("This order has no picker assigned.");
  const value = code.trim();
  if (!value) throw new Error("Scan a code.");
  const books = getLiveBooks();
  const now = new Date().toISOString();
  const gates = pickPackGates(order);
  const bookOf = (item: PickItem) => books.find((row) => row.id === item.bookId);
  const unit = /[\s-]?U\d{5}$/i.test(value) ? plainCode(value) : "";

  const scanItem = (stage: "pick" | "pack") => {
    const { counts, seen } = stageState(order, stage);
    const unitsKey = stage === "pick" ? "pickUnits" : "packUnits";
    const units = order.pick?.[unitsKey] ?? [];
    if (unit) {
      if (units.includes(unit)) throw new Error("This copy's label is already scanned for this order. Scan the next copy.");
      const other = getOrders().find((row) => row.id !== order.id && row.status !== "Cancelled" && [...(row.pick?.pickUnits ?? []), ...(row.pick?.packUnits ?? [])].includes(unit));
      if (other) throw new Error(`This copy is already assigned to order ${other.id}. Use another copy.`);
    }
    const open = order.items.filter((item) => itemMissing(stage, item, bookOf(item), counts, seen).length);
    const rows = order.items.map((item) => {
      const book = bookOf(item);
      const req = requiredKinds(stage, item, book);
      const kinds = matchedKinds(item, book, value);
      const known = stageKinds(stage, item, book).map((row) => row.kind);
      const useful = req[0] === "any" ? (kinds.length ? (["any"] as ScanKind[]) : []) : kinds.filter((kind) => req.includes(kind));
      return { item, req, kinds, useful, extra: kinds.filter((kind) => known.includes(kind)), isOpen: open.includes(item) };
    });
    let hit = rows.find((row) => row.isOpen && row.useful.length);
    if (!hit) {
      const tagged = open.filter((item) => requiredKinds(stage, item, bookOf(item))[0] === "any" && matchesTag(bookOf(item) ?? {}, value));
      if (tagged.length === 1) hit = rows.find((row) => row.item === tagged[0]);
      if (hit) hit = { ...hit, useful: ["any"] };
    }
    // An optional code (e.g. SKU when only the product code is required) is still marked as scanned.
    const optional = hit ? undefined : rows.find((row) => row.extra.some((kind) => !(seen[row.item.bookId] ?? []).includes(kind)));
    if (!hit && optional) {
      const nextSeen = { ...seen, [optional.item.bookId]: Array.from(new Set([...(seen[optional.item.bookId] ?? []), ...optional.extra])) };
      return { nextCounts: counts, nextSeen, done: false, units: unit ? [...units, unit] : units, message: `${KIND_LABEL[optional.extra[0]]} of ${optional.item.title} scanned.` };
    }
    if (!hit) {
      const wrongKind = rows.find((row) => row.isOpen && row.kinds.length);
      if (wrongKind) throw new Error(`Wrong code for ${wrongKind.item.title}. Scan its ${wrongKind.req.map((kind) => KIND_LABEL[kind]).join(" and ")}.`);
      const finished = rows.find((row) => row.kinds.length);
      throw new Error(finished ? `${finished.item.title} is already fully scanned.` : "This code is not an item on this order.");
    }
    const { item, req, useful, extra } = hit;
    const have = seen[item.bookId] ?? [];
    const nextCounts = { ...counts };
    const counted = useful.includes(req[0]) && (counts[item.bookId] ?? 0) < item.quantity;
    if (counted) nextCounts[item.bookId] = (counts[item.bookId] ?? 0) + 1;
    else if (!useful.some((kind) => !have.includes(kind))) {
      throw new Error(`${KIND_LABEL[useful[0]]} of ${item.title} is already scanned. Still to scan: ${itemMissing(stage, item, bookOf(item), counts, seen).join(", ")}.`);
    }
    const nextSeen = { ...seen, [item.bookId]: Array.from(new Set([...have, ...useful, ...extra])) };
    const done = order.items.every((row) => !itemMissing(stage, row, bookOf(row), nextCounts, nextSeen).length);
    const leftHere = itemMissing(stage, item, bookOf(item), nextCounts, nextSeen);
    return { nextCounts, nextSeen, done, units: unit ? [...units, unit] : units, message: `${KIND_LABEL[useful[0]]} of ${item.title} scanned.${leftHere.length ? ` Still for this item: ${leftHere.join(", ")}.` : ""}` };
  };

  if (!pick.pickedAt) {
    if (!pick.pickOrderScannedAt && isOrderCode(order, value)) {
      updateOrderInStore({ ...order, pick: { ...pick, acceptedAt: pick.acceptedAt ?? now, pickOrderScannedAt: now } });
      return "Order matched. Now scan each item's product code and SKU.";
    }
    if (!gates.pickOrder) throw new Error("Step 1: scan the order code (barcode or QR) on the packaging slip first.");
    if (isOrderCode(order, value) || isBoxCode(order, value)) throw new Error("The order is already matched. Now scan the items.");
    const result = scanItem("pick");
    const next = { ...order, pick: { ...pick, acceptedAt: pick.acceptedAt ?? now, picked: result.nextCounts, pickCodes: result.nextSeen, pickUnits: result.units, pickedAt: result.done ? now : undefined } };
    updateOrderInStore(result.done ? withHistory(next, "Item picked", "All items picked from inventory") : next);
    return result.done ? "All items picked. The order moves to the packer." : result.message;
  }
  if (pick.packedAt) return "Already packed and ready for pickup.";
  if (!pick.boxScannedAt && isBoxCode(order, value)) {
    updateOrderInStore({ ...order, pick: { ...pick, boxScannedAt: now } });
    return "Box matched. Now scan the order code.";
  }
  if (!gates.box) throw new Error("Step 1: scan the box code (BOX-…) on the packaging slip first.");
  if (!pick.orderScannedAt && isOrderCode(order, value)) {
    updateOrderInStore({ ...order, pick: { ...pick, orderScannedAt: now } });
    return "Order matched. Now scan each item's SKU, and ISBN for books, as it goes into the box.";
  }
  if (!gates.packOrder) throw new Error(isBoxCode(order, value) ? "The box is already scanned. Step 2: scan the order code." : "Step 2: scan the order code (barcode or QR) on the packaging slip.");
  if (isOrderCode(order, value) || isBoxCode(order, value)) throw new Error("Box and order are already matched. Now scan the items.");
  const result = scanItem("pack");
  updateOrderInStore({ ...order, pick: { ...pick, packScan: result.nextCounts, packCodes: result.nextSeen, packUnits: result.units } });
  if (!result.done) return result.message;
  return maybeFinishPack(order.id) || "All items scanned. Add packing photos, then confirm the items match the description.";
}

/** Last packer step: every required scan done, packing photo (if required), items checked against the order description. */
export function confirmPacked(orderId: string) {
  const order = getOrder(orderId);
  const pick = order?.pick;
  if (!order || !pick?.pickedAt) throw new Error("Picking is not finished yet.");
  if (pick.packedAt) return "Already packed.";
  const gates = pickPackGates(order);
  if (!gates.box) throw new Error("Scan the box code first.");
  if (!gates.packOrder) throw new Error("Scan the order code first.");
  const left = pickPackLeft(order, "pack");
  if (left) throw new Error(`Still to scan: ${left}.`);
  if (!gates.photos) throw new Error("Take at least one packing photo first.");
  return finishPacked(order, "Items checked against the order description");
}

const SKIP_LABEL: Record<string, string> = { pickOrder: "Picker order code", pickItems: "Picker item scans", box: "Box code", packOrder: "Packer order code", packItems: "Packer item scans", photos: "Packing photos" };

/** Admin skips the current step (or every remaining step) for an order. */
export function bypassPickStep(orderId: string, all = false) {
  const by = getSession()?.email ?? "admin";
  let last = "";
  for (let round = 0; round < 12; round += 1) {
    const order = getOrder(orderId);
    const pick = order?.pick;
    if (!order || !pick) throw new Error("This order has no picker assigned.");
    if (pick.packedAt) return last || "Already packed.";
    const gates = pickPackGates(order);
    const now = new Date().toISOString();
    const full = Object.fromEntries(order.items.map((item) => [item.bookId, item.quantity]));
    const skip = (key: string, patch: Partial<NonNullable<Order["pick"]>>) => {
      updateOrderInStore(withHistory({ ...order, pick: { ...pick, ...patch, bypassed: [...(pick.bypassed ?? []), key] } }, "Scan step bypassed", `${SKIP_LABEL[key]} · ${by}`));
      last = `${SKIP_LABEL[key]} skipped.`;
    };
    if (!pick.pickedAt) {
      if (!gates.pickOrder) skip("pickOrder", { acceptedAt: pick.acceptedAt ?? now });
      else skip("pickItems", { acceptedAt: pick.acceptedAt ?? now, picked: full, pickedAt: now });
    } else if (!gates.box) skip("box", {});
    else if (!gates.packOrder) skip("packOrder", {});
    else if (pickPackLeft(order, "pack")) skip("packItems", { packScan: full });
    else if (!gates.photos) skip("photos", {});
    else return finishPacked(order, `Packed · steps bypassed by ${by}`);
    if (!all) return last;
  }
  return last;
}

export function setOrderStatus(orderId: string, status: OrderStatus) {
  logAudit("Order status changed", orderId, status);
  const order = getOrder(orderId);
  if (!order) return;
  const next: Order = withHistory({ ...order, status }, status);
  if (status === "Delivered" && order.paymentMethod === "Cash on delivery") {
    next.paymentStatus = "Paid";
  }
  if (!pickupOtpReady(order) && pickupOtpReady(next)) sendPickupOtp(next);
  if (status === "Cancelled" && order.stockCommitted) {
    releaseStockForOrder(order);
    next.stockCommitted = false;
  }
  updateOrderInStore(next);
  sendOrderStatusEmail(next, status);
  syncReplacementProgress(next);
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
  removeOrderShipments(orderId);
  sendOrderStatusEmail(next, "Cancelled");
}

export function refundOrder(orderId: string, amount?: number, note?: string, extra?: Partial<RefundRecord>, options: { withPlatformFee?: boolean } = {}) {
  const order = getOrder(orderId);
  if (!order) return;
  const cap = maxRefundable(order, options);
  const refundAmount = Math.min(amount ?? cap, cap);
  if (refundAmount <= 0) return;
  const next: Order = withHistory(
    {
      ...order,
      paymentStatus: refundAmount + (order.refundAmount ?? 0) >= order.total ? "Refunded" : "Partially Refunded",
      refundAmount: (order.refundAmount ?? 0) + refundAmount,
      refunds: [...(order.refunds ?? []), { id: String(Date.now()), at: new Date().toISOString(), amount: refundAmount, destination: "original", note, by: currentActor(), ...extra }],
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
    body: `Dear Guest,\n\nNamaste, and greetings from Vaidya Gogate Memorial Foundation.\n\nA refund of ₹${refundAmount.toLocaleString("en-IN")} has been initiated for order ${order.id} to your original payment method. It reflects within ${days} business days.\n\nWith warm regards,\nVaidya Gogate Memorial Foundation`,
  });
}

/** Gateway status update for one refund (status, bank RRN/ARN). Earlier refund entries stay as recorded. */
export function updateRefund(orderId: string, refundId: string, patch: Partial<RefundRecord>) {
  const order = getOrder(orderId);
  const current = order?.refunds?.find((refund) => refund.id === refundId);
  if (!order || !current) return;
  const changed = patch.status && patch.status !== current.status;
  const merged = { ...order, refunds: order.refunds!.map((refund) => (refund.id === refundId ? { ...refund, ...patch } : refund)) };
  const next = changed ? withHistory(merged, `Refund ${patch.status}`, [`₹${current.amount}`, patch.rrn && `RRN ${patch.rrn}`, patch.arn && `ARN ${patch.arn}`].filter(Boolean).join(" · ")) : merged;
  updateOrderInStore(next);
  return next;
}

/** Sends the store-pickup OTP; only once the seller has processed the order. */
export function sendPickupOtp(order: Order) {
  if (!pickupOtpReady(order)) return false;
  sendOtpCode({
    email: order.deliveryAddress?.email,
    phone: order.deliveryAddress?.phone,
    name: order.deliveryAddress?.fullName,
    code: pickupOtp(order.id),
    purpose: `store pickup for order ${order.id}`,
  });
  return true;
}

/** Customer paid only the courier charge for a store-pickup order: it becomes a courier delivery, ready to book. */
export function recordCourierPayment(orderId: string, input: { method: string; reference?: string }) {
  const order = getOrder(orderId);
  const upgrade = order?.courierUpgrade;
  if (!order || !upgrade || upgrade.paidAt) return;
  const next = withHistory(
    {
      ...order,
      deliveryMode: "delivery",
      shipping: (order.shipping ?? 0) + upgrade.amount,
      total: order.total + upgrade.amount,
      courierChoice: upgrade.rate,
      courierName: upgrade.rate.courierName,
      courierUpgrade: { ...upgrade, paidAt: new Date().toISOString(), paymentRef: input.reference },
    },
    "Courier charge paid",
    `Switched from store pickup to ${upgrade.rate.courierName} · ₹${upgrade.amount} · ${input.method}${input.reference ? ` · ${input.reference}` : ""}`
  );
  updateOrderInStore(next);
  return next;
}

export function recordReturnChargePayment(orderId: string, input: { method: string; reference?: string }) {
  const order = getOrder(orderId);
  const back = order?.returnShipment;
  if (!order || !back || back.chargePaidAt) return;
  const next = withHistory(
    { ...order, returnShipment: { ...back, chargePaidAt: new Date().toISOString(), chargeRef: input.reference } },
    "Return courier charge paid",
    `₹${back.charge ?? 0} · ${input.method}${input.reference ? ` · ${input.reference}` : ""}`
  );
  updateOrderInStore(next);
  return next;
}

export function recordBalancePayment(orderId: string, input: { method: string; reference?: string }) {
  const order = getOrder(orderId);
  const plan = order?.preorderPayment;
  if (!order || !plan || plan.balancePaidAt) return;
  const next = withHistory(
    {
      ...order,
      paymentStatus: "Paid",
      paidAt: order.paidAt ?? new Date().toISOString(),
      preorderPayment: { ...plan, balancePaidAt: new Date().toISOString(), balanceRef: input.reference },
    },
    "Balance paid",
    `Pre-order balance ₹${plan.balance} · ${input.method}${input.reference ? ` · ${input.reference}` : ""}`
  );
  updateOrderInStore(next);
  return next;
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

/** Desk switches a courier order (not yet booked) to collection at the clinic: courier charge comes off the total. */
export function convertToStorePickup(orderId: string) {
  const order = getOrder(orderId);
  if (!order || order.deliveryMode !== "delivery") return "This order is already a store pickup.";
  if (["Shipped", "Out for Delivery", "Delivered", "Cancelled"].includes(order.status)) return "This order has already left or is closed.";
  const shipping = order.shipping || 0;
  const total = Math.round((order.total - shipping) * 100) / 100;
  const next = withHistory(
    {
      ...order,
      deliveryMode: "store_pickup",
      shipping: 0,
      total,
      courierName: undefined,
      courierChoice: undefined,
      preorderPayment: order.preorderPayment
        ? { ...order.preorderPayment, shippingDue: undefined, balance: Math.max(0, Math.round((total - order.preorderPayment.advance) * 100) / 100) }
        : undefined,
    },
    order.status,
    `Changed to store pickup by the desk${shipping ? `; courier charge ₹${shipping} removed` : ""}.`
  );
  updateOrderInStore(next);
  const paidFull = order.paymentStatus === "Paid" && shipping > 0;
  return paidFull
    ? `Changed to store pickup. The customer paid ₹${shipping} courier charge; refund it from Refunds if needed.`
    : "Changed to store pickup.";
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
    id: String(Date.now()),
    orderId: order.id,
    courier: input.courier,
    awb: generateAWB(input.courier),
    charges: input.charges,
    toAddress: { ...(order.deliveryAddress as DeliveryAddress) },
    items: order.items.map((item) => ({
      sku: item.bookId,
      title: item.title,
      quantity: item.quantity,
      barcode: getLiveBooks().find((b) => b.id === item.bookId)?.barcode || getLiveBooks().find((b) => b.id === item.bookId)?.sku,
    })),
    status: "Booked",
    generatedAt: new Date().toISOString(),
  };
  const list = getShipments().filter((s) => s.orderId !== order.id);
  list.push(shipment);
  writeJSON(SHIPMENTS_KEY, list);
  publishShipment(shipment);

  const next = { ...order, shipmentId: shipment.id, status: "Shipped" as OrderStatus };
  updateOrderInStore(next);
  sendOrderStatusEmail(next, "Shipped");
  return shipment;
}

export function saveShipmentRecord(shipment: ShipmentRecord) {
  const list = getShipments().filter((item) => item.id !== shipment.id && !sameShipmentSlot(item, shipment));
  list.push(shipment);
  writeJSON(SHIPMENTS_KEY, list);
  publishShipment(shipment);
}

export function patchShipment(shipmentId: string, update: Partial<ShipmentRecord>) {
  const list = getShipments();
  const index = list.findIndex((item) => item.id === shipmentId);
  if (index === -1) return;
  list[index] = { ...list[index], ...update };
  writeJSON(SHIPMENTS_KEY, list);
  publishShipment(list[index]);
  return list[index];
}

export function removeShipment(shipmentId: string) {
  writeJSON(SHIPMENTS_KEY, getShipments().filter((item) => item.id !== shipmentId));
}

/** Drop every shipment for an order from the desk and from the website copy. */
export function removeOrderShipments(orderId: string) {
  const next = getShipments().filter((item) => item.orderId !== orderId);
  if (next.length === getShipments().length) {
    forgetShopShipments(orderId);
    return;
  }
  writeJSON(SHIPMENTS_KEY, next);
  forgetShopShipments(orderId);
}

function forgetShopShipments(orderId: string) {
  if (typeof window === "undefined" || !orderId) return;
  void fetch("/api/shop/shipments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ action: "delete", orderId }),
  }).catch(() => undefined);
}

function forgetShopOrder(orderId: string) {
  if (typeof window === "undefined" || !orderId) return;
  void fetch("/api/shop/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ action: "delete", orderId }),
  }).catch(() => undefined);
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
  publishShipment(shipment);

  const order = getOrder(shipment.orderId);
  if (order) {
    const next: Order = { ...order, status: status === "Delivered" ? "Delivered" : "Shipped" };
    updateOrderInStore(next);
    syncReplacementProgress(next);
  }
}

/* ---------------- Printables ---------------- */

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rupees(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function logoSrc() {
  const url = getSettings().logoUrl || "/uploads/site-logo.png";
  if (/^(https?:|data:)/.test(url) || typeof window === "undefined") return url;
  return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

function logoImg(cls = "logo") {
  return `<img class="${cls}" src="${esc(logoSrc())}" alt="" onerror="this.style.display='none'"/>`;
}

export type LabelSize = "printer" | "4x6" | "a4" | "a5" | "roll";
const LABEL_SIZE_KEY = "vgmf-label-size";
export const LABEL_SIZES: { id: LabelSize; label: string }[] = [
  { id: "printer", label: "Choose paper in print dialog" },
  { id: "4x6", label: "4×6 in tag (thermal)" },
  { id: "roll", label: "Paper roll 80 mm" },
  { id: "a5", label: "A5 sheet" },
  { id: "a4", label: "A4 sheet" },
];

export function getLabelSize(): LabelSize {
  const fallback = (getIntegrations().shipping.labelSize || "4x6") as LabelSize;
  if (typeof window === "undefined") return fallback;
  const saved = window.localStorage.getItem(LABEL_SIZE_KEY) as LabelSize | null;
  return LABEL_SIZES.some((item) => item.id === saved) ? (saved as LabelSize) : fallback;
}

export function setLabelSize(size: LabelSize) {
  if (typeof window !== "undefined") window.localStorage.setItem(LABEL_SIZE_KEY, size);
}

function letterhead() {
  return `<header class="head">
    <div class="head-brand">${logoImg()}<div>
      <p class="brand">${esc(siteConfig.name)}</p>
      <p class="addr">${esc(siteConfig.address)}</p>
      <p class="addr">Phone ${esc(siteConfig.phone)} · ${esc(siteConfig.email)}</p>
      <p class="addr">Clinic hours: Monday to Thursday, 6:00 PM – 10:00 PM</p>
    </div></div>
    <div class="mark">VGMF</div>
  </header>`;
}

function addressBlock(address?: { fullName?: string; phone?: string; line1?: string; landmark?: string; city?: string; state?: string; pincode?: string; email?: string }) {
  if (!address) return "—";
  const line = [address.line1, address.landmark, address.city, address.state, address.pincode].filter(Boolean).join(", ");
  return `${esc(address.fullName || "Customer")}<br/>${esc(line)}<br/>${esc(address.phone || "")}${address.email ? `<br/>${esc(address.email)}` : ""}`;
}

function printHtml(title: string, html: string, page = "A4") {
  if (typeof window === "undefined") return;
  // A real page of this site, so the browser's print header shows the site address instead of "about:blank".
  const win = window.open("/print.html", "_blank");
  if (!win) return;
  const margin = page === "A4" || page === "A5" || page === "auto" ? "10mm" : "3mm";
  const pageRule = page === "auto" ? `@page { margin: ${margin}; }` : `@page { size: ${page}; margin: ${margin}; }`;
  const doc = `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(title)}</title>
  <style>
    ${pageRule}
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #1c1917; margin: 0; }
    .head { display: flex; justify-content: space-between; gap: 16px; border-bottom: 3px solid #8F2D2D; padding-bottom: 12px; }
    .head-brand { display: flex; gap: 12px; align-items: center; }
    .logo { height: 56px; width: auto; max-width: 160px; object-fit: contain; }
    .label-logo { height: 34px; width: auto; max-width: 110px; object-fit: contain; background: #fff; border-radius: 6px; padding: 3px; }
    .label-brand { display: flex; gap: 8px; align-items: center; }
    .size-a4 .label-sheet { width: 150mm; margin: 0 auto; }
    .size-a5 .label-sheet { width: 128mm; margin: 0 auto; }
    .size-printer .label-sheet { max-width: 150mm; margin: 0 auto; }
    .size-roll { font-size: 11px; }
    .size-roll .grid { display: block; }
    .size-roll .box { margin-top: 8px; min-width: 0; }
    .size-roll .awb { font-size: 18px; }
    .size-roll svg { max-width: 100%; height: auto; }
    .brand { font-size: 18px; font-weight: 700; color: #6A1F1F; margin: 0; }
    .addr { margin: 2px 0; font-size: 11px; color: #44403c; line-height: 1.45; }
    .mark { font-weight: 800; letter-spacing: 0.14em; color: #8F2D2D; font-size: 13px; }
    h1 { font-size: 18px; margin: 16px 0 0; letter-spacing: 0.08em; text-transform: uppercase; color: #1c1917; }
    .sub { margin: 4px 0 0; font-size: 12px; color: #57534e; }
    .grid { display: flex; justify-content: space-between; gap: 16px; margin-top: 14px; }
    .box { border: 1px solid #e7e5e4; border-radius: 8px; padding: 12px 14px; min-width: 42%; }
    .label { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #78716c; margin: 0 0 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #f7f3ea; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: #44403c; }
    td, th { border-bottom: 1px solid #e7e5e4; padding: 8px; text-align: left; font-size: 12px; vertical-align: top; }
    .right { text-align: right; }
    .totals { width: 260px; margin-left: auto; margin-top: 8px; }
    .totals td { border: none; padding: 3px 8px; }
    .grand td { border-top: 2px solid #8F2D2D; font-size: 14px; font-weight: 700; padding-top: 8px; }
    .foot { margin-top: 28px; font-size: 11px; color: #57534e; border-top: 1px solid #e7e5e4; padding-top: 8px; line-height: 1.5; }
    .label-sheet { border: 2px solid #1c1917; padding: 0; overflow: hidden; }
    .label-band { background: #6A1F1F; color: #fff; padding: 10px 12px; display: flex; justify-content: space-between; gap: 8px; align-items: flex-end; }
    .label-band b { font-size: 13px; letter-spacing: 0.12em; }
    .label-band span { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.9; }
    .label-body { padding: 12px; }
    .awb { font-size: 22px; font-weight: 800; letter-spacing: 0.08em; margin: 0; }
    .route { margin-top: 8px; border: 1px dashed #8F2D2D; border-radius: 8px; padding: 8px 10px; display: flex; justify-content: space-between; gap: 8px; }
    .route b { font-size: 18px; letter-spacing: 0.04em; }
    .meta { font-size: 11px; color: #44403c; margin: 6px 0 0; }
    .check { font-size: 16px; }
    .label-sheet { page-break-inside: avoid; break-inside: avoid; }
    .size-4x6 { font-size: 10px; line-height: 1.3; }
    .size-4x6 .label-band { padding: 6px 8px; }
    .size-4x6 .label-logo { height: 30px; }
    .size-4x6 .label-body { padding: 6px 8px; }
    .size-4x6 .awb { font-size: 17px; }
    .size-4x6 .grid { gap: 6px; margin-top: 6px; }
    .size-4x6 .box { padding: 5px 7px; min-width: 0; flex: 1 1 0; }
    .size-4x6 .box.to { flex: 1.35 1 0; font-size: 11px; }
    .size-4x6 .route { margin-top: 5px; padding: 4px 8px; }
    .size-4x6 .route b { font-size: 15px; }
    .size-4x6 table { margin-top: 6px; }
    .size-4x6 td, .size-4x6 th { padding: 3px 5px; font-size: 10px; }
    .size-4x6 .foot { margin-top: 6px; padding-top: 4px; font-size: 9px; line-height: 1.35; }
    .size-4x6 svg { max-width: 100%; height: 44px; }
    .agg { border: 2px solid #000; }
    .agg-row { display: flex; border-bottom: 1.5px solid #000; }
    .agg-row.center { text-align: center; }
    .agg-row.center svg { margin: 0 auto; }
    .agg-cell { flex: 1 1 0; padding: 6px 8px; border-right: 1.5px solid #000; font-size: 11px; line-height: 1.4; }
    .agg-cell:last-child { border-right: none; }
    .agg-cell.grow { flex: 2 1 0; }
    .agg-cell.side { flex: 1.1 1 0; }
    .agg .to-name { font-size: 14px; }
    .agg .pin { font-size: 14px; letter-spacing: 0.04em; }
    .agg .courier { font-size: 14px; }
    .agg .routing { font-size: 18px; letter-spacing: 0.06em; }
    .agg .pay-mode { font-size: 18px; letter-spacing: 0.08em; }
    .agg table { margin-top: 0; }
    .agg td, .agg th { border-bottom: 1px solid #000; }
    .agg .qr { display: block; margin-top: 4px; }
    .agg-foot { display: flex; gap: 8px; align-items: center; padding: 6px 8px; font-size: 9px; line-height: 1.35; }
    .size-4x6 .agg-cell { padding: 4px 6px; font-size: 10px; }
    .size-4x6 .agg .pay-mode, .size-4x6 .agg .routing { font-size: 15px; }
    .mono .label-sheet, .mono .label-sheet * { color: #000 !important; }
    .mono .label-sheet { border: 2px solid #fff; background: #fff; }
    .mono .label-sheet .label-band { background: #fff; border-bottom: 1.5px solid #000; }
    .mono .label-sheet .label-band span { opacity: 1; }
    .mono .label-sheet .label-logo { filter: grayscale(1) contrast(1.4); background: #fff; }
    .mono .label-sheet .route { border: 1px solid #fff; border-top: 1px solid #000; border-bottom: 1px solid #000; border-radius: 0; }
    .mono .label-sheet .box { border: 1px solid #fff; border-radius: 0; padding-left: 0; }
    .mono .label-sheet th { background: #fff; border-bottom: 1px solid #000; }
    .mono .label-sheet td { border-bottom: 1px solid #fff; }
    .mono .label-sheet .foot { border-top: 1px solid #000; }
    .mono .label-sheet .label { color: #000; font-weight: 700; }
    .label-head { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; }
    .label-head > div { flex: 1; min-width: 0; }
    .label-sheet svg.qr { width: 64px !important; height: 64px !important; flex: none; }
    .label-sheet .pay { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 6px; padding: 6px 0; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; }
    .label-sheet .pay b { font-size: 18px; letter-spacing: 0.08em; }
    .label-sheet .pay span { font-size: 13px; font-weight: 700; text-align: right; }
  </style></head><body>${html}<script>
    (function () {
      var printed = false;
      function fit() {
        var sheet = document.querySelector(".label-sheet");
        var pageMm = ${JSON.stringify(labelPageMm(page))};
        if (!sheet || !pageMm) return;
        var px = 96 / 25.4;
        var room = pageMm[1] * px - 2;
        var width = pageMm[0] * px;
        sheet.style.width = width + "px";
        var height = sheet.getBoundingClientRect().height;
        if (height > room) sheet.style.zoom = String(Math.floor((room / height) * 1000) / 1000);
      }
      function go() {
        if (printed) return;
        printed = true;
        fit();
        window.focus();
        window.print();
      }
      var images = Array.prototype.slice.call(document.images);
      var pending = images.filter(function (img) { return !img.complete; });
      if (!pending.length) return setTimeout(go, 50);
      var left = pending.length;
      pending.forEach(function (img) {
        var done = function () { left -= 1; if (left <= 0) go(); };
        img.addEventListener("load", done);
        img.addEventListener("error", done);
      });
      setTimeout(go, 3000);
    })();
  </script></body></html>`;
  writeWhenReady(win, doc, title);
}

/** Waits for /print.html to load in the new window, then puts the printable page into it. */
function writeWhenReady(win: Window, doc: string, title: string) {
  const started = Date.now();
  const write = () => {
    let ready = false;
    try {
      ready = win.location.pathname === "/print.html" && win.document.readyState === "complete";
    } catch {
      ready = false;
    }
    if (!ready && Date.now() - started < 6000) {
      window.setTimeout(write, 60);
      return;
    }
    const parsed = new DOMParser().parseFromString(doc, "text/html");
    win.document.title = title;
    win.document.head.innerHTML = parsed.head.innerHTML;
    win.document.body.innerHTML = parsed.body.innerHTML;
    parsed.body.querySelectorAll("script").forEach((source) => {
      const script = win.document.createElement("script");
      script.textContent = source.textContent;
      win.document.body.appendChild(script);
    });
  };
  write();
}

export type LabelColour = "bw" | "colour";
const LABEL_COLOUR_KEY = "vgmf_label_colour";

export function getLabelColour(): LabelColour {
  if (typeof window === "undefined") return "bw";
  return window.localStorage.getItem(LABEL_COLOUR_KEY) === "colour" ? "colour" : "bw";
}

export function setLabelColour(value: LabelColour) {
  if (typeof window !== "undefined") window.localStorage.setItem(LABEL_COLOUR_KEY, value);
}

function qrSvg(text: string, px = 68) {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
    const size = qr.modules.size;
    let path = "";
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) if (qr.modules.get(y, x)) path += `M${x + 2} ${y + 2}h1v1h-1z`;
    }
    return `<svg class="qr" xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${size + 4} ${size + 4}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  } catch {
    return "";
  }
}

function labelPageMm(page: string): [number, number] | null {
  const margin = page === "A4" || page === "A5" ? 10 : 3;
  const sizes: Record<string, [number, number]> = { "100mm 150mm": [100, 150], "80mm 240mm": [80, 240] };
  const size = sizes[page];
  return size ? [size[0] - margin * 2, size[1] - margin * 2] : null;
}

export function printShippingLabel(
  shipment: ShipmentRecord,
  details?: { routingCode?: string; destination?: string; courierName?: string; awb?: string },
  size: LabelSize = getLabelSize(),
  colour: LabelColour = getLabelColour()
) {
  const to = shipment.toAddress;
  // Booked through an aggregator: the pickup address registered with it is the sender and return address.
  const pickup = getIntegrations().shipping.pickup;
  const viaAggregator = Boolean(shipment.provider && !["manual", "self"].includes(String(shipment.provider)) && pickup?.line1);
  const fromName = viaAggregator ? pickup.contactName || pickup.nickname || siteConfig.name : siteConfig.name;
  const fromAddress = viaAggregator ? [pickup.line1, pickup.line2, pickup.city, pickup.state, pickup.pincode].filter(Boolean).join(", ") : siteConfig.address;
  const fromPhone = viaAggregator ? pickup.phone || siteConfig.phone : siteConfig.phone;
  const awb = details?.awb || shipment.awb;
  const courier = details?.courierName || shipment.courier || "Courier";
  const routing = details?.routingCode || shipment.routingCode || "";
  const hub = details?.destination || shipment.destinationHub || "";
  const order = getOrder(shipment.orderId);
  const cod = Boolean(order && order.paymentMethod === "Cash on delivery" && order.paymentStatus !== "Paid");
  const collect = cod && order ? Math.max(0, order.total - (order.storeCreditUsed ?? 0)) : 0;
  // Laid out like the Shiprocket / Nimbuspost / GoSwift 4x6 labels: Ship to, courier + AWB, parcel, shipped by, order, items.
  const shipping = getIntegrations().shipping;
  const box = order?.parcel ?? shipping.packageCm;
  const weight = order?.weightKg || shipping.defaultWeightKg;
  const priced = shipment.items.map((item) => {
    const line = order?.items.find((row) => (item.sku && row.sku === item.sku) || row.bookId === item.sku || row.title === item.title);
    return { ...item, price: line?.price ?? 0, batch: line?.batchNo ?? "" };
  });
  const value = priced.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const html = `<div class="size-${size}${colour === "bw" ? " mono" : ""}"><div class="label-sheet agg">
    <div class="agg-row">
      <div class="agg-cell grow to">
        <p class="label">Ship to</p>
        <strong class="to-name">${esc(to.fullName)}</strong><br/>
        ${esc([to.line1, to.landmark].filter(Boolean).join(", "))}<br/>
        ${esc([to.city, to.state].filter(Boolean).join(", "))}<br/>
        <b class="pin">PIN ${esc(to.pincode)}</b><br/>
        Mobile: ${esc(to.phone)}
      </div>
      <div class="agg-cell side">
        <p class="label">Courier</p>
        <b class="courier">${esc(courier)}</b>
        ${routing ? `<p class="label" style="margin-top:6px">Routing code</p><b class="routing">${esc(routing)}</b>` : ""}
        ${hub ? `<p class="meta">Hub ${esc(hub)}</p>` : ""}
      </div>
    </div>
    <div class="agg-row center">
      <div class="agg-cell grow">
        <p class="label">AWB no.</p>
        ${barcodeSvg(awb, { height: 56, module: 1.6, format: "code128" })}
        <p class="awb">${esc(awb)}</p>
      </div>
    </div>
    <div class="agg-row">
      <div class="agg-cell"><p class="label">Dimensions (cm)</p><b>${esc(`${box.length} × ${box.breadth} × ${box.height}`)}</b></div>
      <div class="agg-cell"><p class="label">Weight</p><b>${esc(weight)} kg</b></div>
      <div class="agg-cell pay-cell"><p class="label">Payment</p><b class="pay-mode">${cod ? "COD" : "PREPAID"}</b><br/>${cod ? `Collect ${esc(rupees(collect))}` : "Do not collect cash"}</div>
    </div>
    <div class="agg-row">
      <div class="agg-cell grow">
        <p class="label">Shipped by (if undelivered, return to)</p>
        <strong>${esc(fromName)}</strong><br/>
        ${esc(fromAddress)}<br/>
        ${esc(fromPhone)}
      </div>
      <div class="agg-cell side">
        <p class="label">Order no.</p>
        <b>${esc(shipment.orderId)}</b>
        <p class="meta">Order date ${esc(formatDate(order?.date || shipment.generatedAt))}</p>
        <p class="meta">Invoice value ${esc(rupees(value || order?.total || 0))}</p>
      </div>
    </div>
    <div class="agg-row center">
      <div class="agg-cell grow"><p class="label">Order barcode</p>${barcodeSvg(shipment.orderId, { height: 64, module: 1.5, format: "code128" })}</div>
      <div class="agg-cell side" style="text-align:center"><p class="label">Order QR</p>${qrSvg(shipment.orderId, 100)}</div>
    </div>
    <table><tr><th>Item</th><th>SKU</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Total</th></tr>
    ${priced
      .map(
        (item) =>
          `<tr><td>${esc(item.title)}${item.batch ? `<br/><small>Batch ${esc(item.batch)}</small>` : ""}</td><td>${esc(item.sku)}</td><td class="right">${esc(item.quantity)}</td><td class="right">${esc(rupees(item.price))}</td><td class="right">${esc(rupees(item.price * item.quantity))}</td></tr>`
      )
      .join("")}
    <tr><td colspan="4" class="right"><b>Total</b></td><td class="right"><b>${esc(rupees(value))}</b></td></tr>
    </table>
    <div class="agg-foot">
      <span>${logoImg("label-logo")}</span>
      <span>${esc(siteConfig.name)} · ${esc(siteConfig.phone)} · Handle books with care. Do not bend.<br/>This is a computer-generated label and does not need a signature.</span>
    </div>
  </div></div>`;
  const page = size === "printer" ? "auto" : size === "a4" ? "A4" : size === "a5" ? "A5" : size === "roll" ? "80mm 240mm" : "100mm 150mm";
  printHtml(`Label ${awb}`, html, page);
}

export function printOrderInvoice(order: Order, shipment?: ShipmentRecord) {
  const itemsHtml = order.items
    .map(
      (item) => `<tr>
        <td>${esc(item.title)}</td>
        <td>${esc(item.sku || item.bookId)}</td>
        <td class="right">${esc(item.quantity)}</td>
        <td class="right">${rupees(item.price)}</td>
        <td class="right">${rupees(item.price * item.quantity)}</td>
      </tr>`
    )
    .join("");
  const html = `${letterhead()}
  <h1>Tax invoice</h1>
  <p class="sub">Invoice ${esc(order.id)} · ${esc(formatDate(order.date))} · Payment ${esc(order.paymentStatus)}${order.paymentMethod ? ` · ${esc(order.paymentMethod)}` : ""}</p>
  <div class="grid">
    <div class="box"><p class="label">Bill to</p>${addressBlock(order.deliveryAddress)}</div>
    <div class="box">
      <p class="label">${order.deliveryMode === "store_pickup" ? "Store pickup" : "Shipment"}</p>
      ${
        order.deliveryMode === "store_pickup"
          ? `Collect from the clinic.${pickupOtpReady(order) && order.status !== "Delivered" ? `<br/>Pickup OTP ${esc(pickupOtp(order.id))}` : ""}`
          : shipment
            ? `${esc(shipment.courier)}<br/>AWB ${esc(shipment.awb)}`
            : "Packed at the clinic. AWB is printed after the courier is booked."
      }
    </div>
  </div>
  <table>
    <tr><th>Item</th><th>SKU</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr>
    ${itemsHtml}
  </table>
  <table class="totals">
    <tr><td>Subtotal</td><td class="right">${rupees(order.subtotal)}</td></tr>
    <tr><td>Discount</td><td class="right">−${rupees(order.discount)}</td></tr>
    <tr><td>GST</td><td class="right">${rupees(order.gst)}</td></tr>
    <tr><td>Shipping</td><td class="right">${rupees(order.shipping)}</td></tr>
    ${order.storeCreditUsed ? `<tr><td>Store credit</td><td class="right">−${rupees(order.storeCreditUsed)}</td></tr>` : ""}
    <tr class="grand"><td>Total</td><td class="right">${rupees(order.total)}</td></tr>
  </table>
  <p class="foot">This invoice is issued by ${esc(siteConfig.name)}. Books are supplied as listed. For a correction, contact ${esc(siteConfig.phone)} or ${esc(siteConfig.email)} with invoice ${esc(order.id)}.</p>`;
  printHtml(`Invoice ${order.id}`, html);
}

export function printPosReceipt(order: Order) {
  const itemsHtml = order.items
    .map((item) => `<tr><td>${esc(item.title)}</td><td class="right">${esc(item.quantity)}</td><td class="right">${rupees(item.price * item.quantity)}</td></tr>`)
    .join("");
  printHtml(
    `Receipt ${order.id}`,
    `${letterhead()}
    <h1>Receipt</h1>
    <p class="sub">In-store sale · ${esc(formatDate(order.date))} · Order ${esc(order.id)}</p>
    <div class="box" style="margin-top:14px">${esc(order.deliveryAddress?.fullName ?? "Walk-in")} · ${esc(order.deliveryAddress?.phone ?? "")}</div>
    <table><tr><th>Item</th><th class="right">Qty</th><th class="right">Amount</th></tr>${itemsHtml}</table>
    <table class="totals">
      <tr><td>Subtotal</td><td class="right">${rupees(order.subtotal)}</td></tr>
      ${order.storeCreditUsed ? `<tr><td>Store credit</td><td class="right">−${rupees(order.storeCreditUsed)}</td></tr>` : ""}
      <tr class="grand"><td>Paid</td><td class="right">${rupees(order.total)}</td></tr>
    </table>
    <p class="foot">${esc(order.paymentMethod ?? "Cash")}${order.paymentRef ? ` · ${esc(order.paymentRef)}` : ""} · Thank you for visiting the clinic.</p>`
  );
}

export function printPackagingSlip(order: Order) {
  printHtml(`Packaging slip ${order.id}`, packagingSlipHtml(order));
}

/** All the chosen orders' packaging slips in one print, one slip per page. */
export function printPackagingSlips(orders: Order[]) {
  if (orders.length === 0) return;
  const html = orders
    .map((order, index) => `<section style="${index < orders.length - 1 ? "page-break-after:always;break-after:page" : ""}">${packagingSlipHtml(order)}</section>`)
    .join("");
  printHtml(`Packaging slips (${orders.length})`, html);
}

function packagingSlipHtml(order: Order) {
  const slipBooks = getLiveBooks();
  const orderBooks = order.items.map((item) => slipBooks.find((row) => row.id === item.bookId));
  const packIn = Array.from(new Set(orderBooks.map((book) => book?.packIn?.trim()).filter((value): value is string => Boolean(value)))).join(" + ");
  const packingNotes = Array.from(new Set(orderBooks.map((book) => book?.packingNote?.trim()).filter((value): value is string => Boolean(value))));
  return `${letterhead()}
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
    <div>
      <h1>Packaging slip</h1>
      <p class="sub">Order ${esc(order.id)} · ${esc(formatDate(order.date))} · ${order.deliveryMode === "store_pickup" ? "Store pickup" : "Courier"}</p>
      <p class="sub"><strong>Picker:</strong> order code, then each item's product code and SKU. <strong>Packer:</strong> box code, order code, each item's SKU (and ISBN for books), packing photos, then confirm the items match.</p>
    </div>
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end;margin:8px 0">
    <div style="text-align:center"><p class="label">Box code (packer step 1)</p>${barcodeSvg(packingBoxCode(order.id), { height: 64, module: 1.5, format: "code128" })}</div>
    <div style="text-align:center"><p class="label">Order code (picker step 1 · packer step 2)</p>${barcodeSvg(order.id, { height: 64, module: 1.6, format: "code128" })}</div>
    <div style="text-align:center"><p class="label">Order QR</p>${qrSvg(order.id, 110)}</div>
  </div>
  <div class="grid">
    <div class="box"><p class="label">Customer</p>${addressBlock(order.deliveryAddress)}</div>
    <div class="box">
      <p class="label">Pack in</p>
      <strong>${esc(packIn || order.plan?.packagingLabel || "Standard cardboard box")}</strong>
      ${packingNotes.length ? packingNotes.map((note) => `<p class="sub">${esc(note)}</p>`).join("") : `<p class="sub">Tick each line as you pack it. Seal the parcel and attach the shipping label on the outside.</p>`}
    </div>
  </div>
  <table><tr><th></th><th>Scan this barcode</th><th>Title / codes</th><th class="right">Qty</th></tr>
  ${order.items
    .map((item) => {
      const book = slipBooks.find((row) => row.id === item.bookId);
      const sku = item.sku || book?.sku || "";
      const product = book?.barcode || book?.productCode || "";
      const bars = [product && ["Product code", product], sku && ["SKU", sku], book?.isbn && book.isbn !== product && ["ISBN", book.isbn]].filter(Boolean) as string[][];
      const scanCell = (bars.length ? bars : [["Code", item.bookId]]).map(([label, value]) => `<div style="margin-bottom:4px"><span class="sub">${esc(label)}</span>${barcodeSvg(value, { height: 46, module: 1.3, format: label === "SKU" || label === "Code" ? "code128" : undefined })}</div>`).join("");
      const codes = [sku && `SKU ${sku}`, book?.isbn && `ISBN ${book.isbn}`, book?.barcode && `Barcode ${book.barcode}`, book?.productCode && `Code ${book.productCode}`, (item.batchNo || book?.batchNo) && `Batch ${item.batchNo || book?.batchNo}`].filter(Boolean).join(" · ");
      return `<tr><td class="check">☐</td><td>${scanCell}</td><td><strong>${esc(item.title)}</strong><br/><span class="sub">${esc(codes)}</span></td><td class="right">${esc(item.quantity)}</td></tr>`;
    })
    .join("")}</table>
  <p class="foot">Packed by ______________ &nbsp; Checked by ______________ &nbsp; Date ______________<br/>Pack, seal, and attach the shipping label. Then book the courier pickup, or hold the parcel for store pickup.</p>`;
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
  fromName?: string;
}) {
  return queueNotification({
    ...input,
    replyTo: input.replyTo || staffReplyTo(),
  });
}

export function sendOtpCode(input: { email?: string; phone?: string; name?: string; code: string; purpose: string }) {
  const copy = messageCopyFor("otp", {
    name: input.name || "there",
    code: input.code,
    purpose: input.purpose,
    email: input.email,
    phone: input.phone,
  });
  return queueNotification({
    to: input.email ?? "",
    phone: input.phone,
    name: input.name,
    params: [input.code],
    subject: copy.emailSubject,
    template: "otp",
    body: copy.emailBody,
  });
}

export function sendPeopleEmail(recipients: User[], subject: string, body: string) {
  const text = body.trim();
  const title = subject.trim();
  if (!title || !text || recipients.length === 0) return 0;
  const replyTo = staffReplyTo();
  const fromName = senderName();
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
      fromName,
    });
  }
  return recipients.length;
}

export function sendOrderStatusEmail(order: Order, status: OrderStatus) {
  const to = order.deliveryAddress?.email || "";
  const phone = order.deliveryAddress?.phone;
  if (!to && !phone) return;
  const name = order.deliveryAddress?.fullName ?? "Customer";
  // The server emails each stage with full order and payment details (order-stage-mail).
  sendEmail({
    to: "",
    phone,
    name,
    params: [name, order.id, status],
    subject: `Order ${order.id} — ${status}`,
    template: "order-status",
    body: `Dear ${name},\n\nNamaste, and greetings from Vaidya Gogate Memorial Foundation.\n\n${order.replacementOf ? `Your replacement for order ${order.replacementOf} (${order.id}) is now ${status}.` : `Your order ${order.id} is now ${status}.`}${order.trackingId ? `\nTracking: ${order.courierName ?? ""} ${order.trackingId}` : ""}\n\nFollow each step in My Orders.\n\nWith warm regards,\nVaidya Gogate Memorial Foundation`,
  });
  const ordersHref = order.replacementOf ? `/account/orders/${encodeURIComponent(order.replacementOf)}` : "/account/orders";
  if (to) {
    pushInbox({
      audience: "customer",
      email: to,
      kind: "order",
      title: order.replacementOf ? `Replacement is ${status}` : `Order ${order.id} is now ${status}`,
      body: order.trackingId
        ? `Tracking: ${order.courierName ?? ""} ${order.trackingId}`
        : order.replacementOf
          ? `Your replacement for order ${order.replacementOf} is now ${status}.`
          : `Your Foundation shop order was updated to ${status}.`,
      href: ordersHref,
    });
  }
  pushInbox({
    audience: "staff",
    kind: "order",
    title: `Order ${order.id} → ${status}`,
    body: `${name} · ₹${order.total.toLocaleString("en-IN")}`,
    href: "/admin/commerce/orders",
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
    return getSession()?.email;
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
    body: `Dear Guest,\n\nNamaste, and greetings from Vaidya Gogate Memorial Foundation.\n\nYou left items in your cart: ${items.join(", ")}.\n\nComplete your order now before the deal ends.\n\nWith warm regards,\nVaidya Gogate Memorial Foundation`,
  });
  return true;
}

export function sendSupportReply(message: SupportMessage) {
  sendEmail({
    to: message.email,
    subject: `Re: ${message.subject}`,
    template: "support-reply",
    body: `Dear ${message.name},\n\nNamaste, and greetings from Vaidya Gogate Memorial Foundation.\n\n${message.reply ?? ""}\n\nWith warm regards,\nVaidya Gogate Memorial Foundation`,
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
  pushTicket(ticket);
  sendEmail({
    to: ticket.email,
    phone: ticket.phone,
    name: ticket.name,
    params: [ticket.name, ticket.id, ticket.status],
    subject: `Support ticket ${ticket.id} opened`,
    template: "ticket-update",
    body: `Dear ${ticket.name},\n\nNamaste, and greetings from Vaidya Gogate Memorial Foundation.\n\nWe have opened ticket ${ticket.id}: ${ticket.subject}.\n\n${ticket.body}\n\nYou will receive updates on this ticket at ${ticket.email}.\n\nWith warm regards,\nVaidya Gogate Memorial Foundation`,
  });
  pushInbox({
    audience: "customer",
    email: ticket.email,
    kind: "ticket",
    title: `Ticket ${ticket.id} opened`,
    body: ticket.subject,
    href: "/account/tickets",
  });
  pushInbox({
    audience: "staff",
    kind: "ticket",
    title: `New ticket ${ticket.id}`,
    body: `${ticket.name}: ${ticket.subject}`,
    href: "/admin/support/tickets",
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
  pushTicket(ticket);
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
  pushTicket(ticket);
  sendEmail({
    to: ticket.email,
    subject: `Update on your ticket ${ticket.id}`,
    template: "ticket-update",
    body: `Dear ${ticket.name},\n\nNamaste, and greetings from Vaidya Gogate Memorial Foundation.\n\n${text}\n\nWith warm regards,\nVaidya Gogate Memorial Foundation`,
  });
  pushInbox({
    audience: "customer",
    email: ticket.email,
    kind: "ticket",
    title: `Update on ticket ${ticket.id}`,
    body: text,
    href: "/account/tickets",
  });
}

/** A customer's follow-up on their own ticket; reopens it if it was resolved. */
export function customerReplyToTicket(id: string, from: string, text: string) {
  const list = getTickets();
  const ticket = list.find((t) => t.id === id);
  if (!ticket || !text.trim()) return;
  const at = new Date().toISOString();
  ticket.responses.push({ at, from, text: text.trim() });
  if (ticket.status === "Resolved" || ticket.status === "Closed") ticket.status = "Open";
  ticket.updatedAt = at;
  writeJSON(TICKETS_KEY, list);
  pushTicket(ticket);
}

export function updateTicketStatus(id: string, status: SupportTicket["status"]) {
  const list = getTickets();
  const ticket = list.find((t) => t.id === id);
  if (!ticket) return;
  ticket.status = status;
  ticket.updatedAt = new Date().toISOString();
  writeJSON(TICKETS_KEY, list);
  pushTicket(ticket);
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
