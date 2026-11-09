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
  User, RefundRecord } from "@/types";
import { pickupInstructions } from "@/lib/fulfillment";
import { siteConfig, storeConfig } from "@/lib/constants";
import { generateOrderId, getOrders, pickupOtp, pickupOtpReady, publishShipment, publishShopOrder, saveOrder, syncReplacementProgress } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import { ACCOUNT_EXISTS_MESSAGE, phoneDigits, samePhone } from "@/lib/account-identity";
import { clearSession, findAccountByIdentifier, getSession, saveAccount, setSession } from "@/lib/auth";
import { commitStockForOrder, getLiveBooks, releaseStockForOrder } from "@/lib/product-data";
import { matchesBarcode } from "@/lib/barcode";
import { sameShipmentSlot } from "@/lib/shipment-slot";
import { getNotifications, queueNotification } from "@/lib/notify";
import { messageCopyFor } from "@/lib/message-templates";
import { pushInbox } from "@/lib/inbox";
import { commerceCharges, getOrderSettings, shippingFeeFor } from "@/lib/integrations";
import { barcodeSvg } from "@/lib/barcode";
import { generatePassword } from "@/lib/passwords";
import { currentActorEmail, recordActivity } from "@/lib/activity";
import { emptySocial } from "@/lib/social";
import { staffReplyTo } from "@/lib/account-mail";
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
    logoUrl: current.logoUrl || defaults.logoUrl,
    faviconUrl: current.faviconUrl || current.logoUrl || defaults.faviconUrl,
    apiKeys: { ...defaults.apiKeys, ...current.apiKeys },
    processing: { ...defaults.processing, ...current.processing },
    social: { ...defaults.social, ...current.social },
    liveChatEnabled: current.liveChatEnabled ?? defaults.liveChatEnabled,
    liveChatOnline: current.liveChatOnline ?? defaults.liveChatOnline,
    tickerSeconds: current.tickerSeconds || defaults.tickerSeconds,
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
    to: order.deliveryAddress?.email || input.userEmail || "",
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
  const charges = commerceCharges(subtotal);
  const gst = charges.gst;
  const platformFee = charges.platformFee;
  const next = withHistory(
    {
      ...order,
      items,
      deliveryAddress: update.deliveryAddress ?? order.deliveryAddress,
      deliveryMode: update.deliveryMode ?? order.deliveryMode,
      subtotal,
      discount,
      gst,
      platformFee,
      total: subtotal + gst + platformFee + order.shipping - (order.storeCreditUsed ?? 0),
      stockCommitted: order.stockCommitted,
    },
    "Order edited"
  );
  updateOrderInStore(next);
  return next;
}

/** Amount still refundable. The platform fee is kept unless the desk has allowed refunding it. */
export function maxRefundable(order: Order) {
  const settings = getOrderSettings();
  const kept = settings.platformFee.enabled && !settings.platformFee.refundable ? Math.max(0, order.platformFee ?? 0) : 0;
  const collected = order.preorderPayment && !order.preorderPayment.balancePaidAt ? order.preorderPayment.advance : order.total;
  return Math.max(0, collected - kept - (order.refundAmount ?? 0));
}

export function refundToStoreCredit(orderId: string, amount?: number, note?: string) {
  const order = getOrder(orderId);
  if (!order) return;
  const email = order.deliveryAddress?.email;
  if (!email) throw new Error("This order has no customer email to credit.");
  const cap = maxRefundable(order);
  if (amount != null && !(Number.isFinite(amount) && amount > 0)) throw new Error("Enter a refund amount above ₹0.");
  if (amount != null && amount > cap + 0.001) throw new Error(`At most ₹${cap.toLocaleString("en-IN")} can still be refunded on this order.`);
  const refundAmount = Math.round(Math.min(amount ?? cap, cap) * 100) / 100;
  if (refundAmount <= 0) throw new Error("Nothing left to refund. The platform fee stays with the Foundation unless that refund is switched on.");
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

export function acceptPick(orderId: string) {
  const order = getOrder(orderId);
  if (!order?.pick) return;
  updateOrderInStore(withHistory({ ...order, pick: { ...order.pick, acceptedAt: new Date().toISOString() } }, "Picking started", order.pick.assignee));
}

/** One scan in the store. Before picking is complete a product barcode counts as picked; afterwards the order QR then each product marks it packed. */
export function recordPickScan(orderId: string, code: string): string {
  const order = getOrder(orderId);
  const pick = order?.pick;
  if (!order || !pick) throw new Error("This order has no picker assigned.");
  const value = code.trim();
  const books = getLiveBooks();
  const needed = (map: Record<string, number>) => order.items.every((item) => (map[item.bookId] ?? 0) >= item.quantity);
  const matchItem = (map: Record<string, number>) =>
    order.items.find((item) => {
      const book = books.find((row) => row.id === item.bookId);
      return (book ? matchesBarcode(book, value) : item.bookId === value || item.sku === value) && (map[item.bookId] ?? 0) < item.quantity;
    });
  if (!pick.pickedAt) {
    const item = matchItem(pick.picked);
    if (!item) throw new Error("This barcode is not an item still to pick on this order.");
    const picked = { ...pick.picked, [item.bookId]: (pick.picked[item.bookId] ?? 0) + 1 };
    const done = needed(picked);
    const next = { ...order, pick: { ...pick, acceptedAt: pick.acceptedAt ?? new Date().toISOString(), picked, pickedAt: done ? new Date().toISOString() : undefined } };
    updateOrderInStore(done ? withHistory(next, "Item picked", "All items picked from inventory") : next);
    return done ? "All items picked. Scan the order QR, then each item to pack." : `Picked ${item.title}.`;
  }
  if (pick.packedAt) return "Already packed and ready for dispatch.";
  if (!pick.orderScannedAt) {
    if (value.replace(/\D/g, "") !== order.id.replace(/\D/g, "") && !value.includes(order.id)) throw new Error("Scan the order QR first.");
    updateOrderInStore({ ...order, pick: { ...pick, orderScannedAt: new Date().toISOString() } });
    return "Order matched. Now scan each item into the box.";
  }
  const item = matchItem(pick.packScan);
  if (!item) throw new Error("This barcode is not an item still to pack on this order.");
  const packScan = { ...pick.packScan, [item.bookId]: (pick.packScan[item.bookId] ?? 0) + 1 };
  if (!needed(packScan)) {
    updateOrderInStore({ ...order, pick: { ...pick, packScan } });
    return `Packed ${item.title}.`;
  }
  updateOrderInStore({ ...order, pick: { ...pick, packScan, packedAt: new Date().toISOString() } });
  setOrderStatus(order.id, order.deliveryMode === "store_pickup" ? "Packed" : "Ready to Ship");
  return order.deliveryMode === "store_pickup" ? "Packed. Ready for store pickup (OTP unlocked)." : "Packed and ready for dispatch. Allocate a courier from Orders.";
}

export function setOrderStatus(orderId: string, status: OrderStatus) {
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

export function refundOrder(orderId: string, amount?: number, note?: string, extra?: Partial<RefundRecord>) {
  const order = getOrder(orderId);
  if (!order) return;
  const cap = maxRefundable(order);
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

export type LabelSize = "4x6" | "a4" | "a5" | "roll";
const LABEL_SIZE_KEY = "vgmf-label-size";
export const LABEL_SIZES: { id: LabelSize; label: string }[] = [
  { id: "4x6", label: "4×6 in tag (thermal)" },
  { id: "roll", label: "Paper roll 80 mm" },
  { id: "a5", label: "A5 sheet" },
  { id: "a4", label: "A4 sheet" },
];

export function getLabelSize(): LabelSize {
  if (typeof window === "undefined") return "4x6";
  const saved = window.localStorage.getItem(LABEL_SIZE_KEY) as LabelSize | null;
  return LABEL_SIZES.some((item) => item.id === saved) ? (saved as LabelSize) : "4x6";
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
  const win = window.open("", "_blank");
  if (!win) return;
  const margin = page === "A4" || page === "A5" ? "10mm" : "3mm";
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${esc(title)}</title>
  <style>
    @page { size: ${page}; margin: ${margin}; }
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #1c1917; margin: 0; }
    .head { display: flex; justify-content: space-between; gap: 16px; border-bottom: 3px solid #8F2D2D; padding-bottom: 12px; }
    .head-brand { display: flex; gap: 12px; align-items: center; }
    .logo { height: 56px; width: auto; max-width: 160px; object-fit: contain; }
    .label-logo { height: 34px; width: auto; max-width: 110px; object-fit: contain; background: #fff; border-radius: 6px; padding: 3px; }
    .label-brand { display: flex; gap: 8px; align-items: center; }
    .size-a4 .label-sheet { width: 150mm; margin: 0 auto; }
    .size-a5 .label-sheet { width: 128mm; margin: 0 auto; }
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
  </style></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

export function printShippingLabel(
  shipment: ShipmentRecord,
  details?: { routingCode?: string; destination?: string; courierName?: string; awb?: string },
  size: LabelSize = getLabelSize()
) {
  const to = shipment.toAddress;
  const awb = details?.awb || shipment.awb;
  const courier = details?.courierName || shipment.courier || "Courier";
  const routing = details?.routingCode || shipment.routingCode || "";
  const hub = details?.destination || shipment.destinationHub || "";
  const html = `<div class="size-${size}"><div class="label-sheet">
    <div class="label-band">
      <div class="label-brand">
        ${logoImg("label-logo")}
        <div><b>VGMF</b><div>${esc(siteConfig.name)}</div></div>
      </div>
      <span>Shipping label</span>
    </div>
    <div class="label-body">
      <p class="label">${esc(courier)}</p>
      <p class="awb">${esc(awb)}</p>
      ${barcodeSvg(awb, { height: 56, module: 1.6 })}
      <p class="meta">Order ${esc(shipment.orderId)} · ${esc(formatDate(shipment.generatedAt))}</p>
      ${
        routing || hub
          ? `<div class="route"><div><p class="label">Routing</p><b>${esc(routing || "—")}</b></div><div><p class="label">Hub</p><b>${esc(hub || "—")}</b></div></div>`
          : ""
      }
      <div class="grid">
        <div class="box">
          <p class="label">From</p>
          <strong>${esc(siteConfig.name)}</strong><br/>
          ${esc(siteConfig.address)}<br/>
          ${esc(siteConfig.phone)}
        </div>
        <div class="box">
          <p class="label">Deliver to</p>
          <strong>${esc(to.fullName)}</strong><br/>
          ${esc([to.line1, to.landmark, to.city, to.state, to.pincode].filter(Boolean).join(", "))}<br/>
          ${esc(to.phone)}
        </div>
      </div>
      <table><tr><th>SKU</th><th>Title</th><th class="right">Qty</th></tr>
      ${shipment.items.map((item) => `<tr><td>${esc(item.sku)}</td><td>${esc(item.title)}</td><td class="right">${esc(item.quantity)}</td></tr>`).join("")}
      </table>
      <p class="foot">If undelivered, return to the clinic address above. Handle books with care. Do not bend.</p>
    </div>
  </div></div>`;
  const page = size === "a4" ? "A4" : size === "a5" ? "A5" : size === "roll" ? "80mm 240mm" : "100mm 150mm";
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
  const title = `Packaging slip ${order.id}`;
  const html = `${letterhead()}
  <h1>Packaging slip</h1>
  <p class="sub">Order ${esc(order.id)} · ${esc(formatDate(order.date))} · ${order.deliveryMode === "store_pickup" ? "Store pickup" : "Courier"}</p>
  <div class="grid">
    <div class="box"><p class="label">Customer</p>${addressBlock(order.deliveryAddress)}</div>
    <div class="box">
      <p class="label">Pack in</p>
      <strong>${esc(order.plan?.packagingLabel ?? "Standard cardboard box")}</strong>
      <p class="sub">Tick each line as you pack it. Seal the parcel and attach the shipping label on the outside.</p>
    </div>
  </div>
  <table><tr><th></th><th>SKU</th><th>Title</th><th class="right">Qty</th></tr>
  ${order.items
    .map(
      (item) =>
        `<tr><td class="check">☐</td><td>${esc(item.sku || item.bookId)}</td><td>${esc(item.title)}</td><td class="right">${esc(item.quantity)}</td></tr>`
    )
    .join("")}</table>
  <p class="foot">Packed by ______________ &nbsp; Checked by ______________ &nbsp; Date ______________<br/>Pack, seal, and attach the shipping label. Then book the courier pickup, or hold the parcel for store pickup.</p>`;
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
