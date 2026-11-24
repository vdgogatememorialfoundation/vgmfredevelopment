import * as SecureStore from "expo-secure-store";
import { DEFAULT_API } from "./host";

const PORTAL_SESSION_KEY = "vgmf-portal-session";

export type PortalSession = {
  token: string;
  email: string;
  role: string;
  name: string;
  firstName?: string;
  lastName?: string;
  staffRoleId?: string;
};

export type PortalMetrics = {
  totalOrders: number;
  todayOrders: number;
  todayRevenue: number;
  totalRevenue: number;
  pendingPick: number;
  readyToPack: number;
  packedCount: number;
  packedUnpaidCount: number;
  packedUnpaidAmount: number;
  shippedCount: number;
  deliveredCount: number;
  openTickets: number;
  lowStockCount: number;
  posSalesTodayCount: number;
  posSalesTodayAmount: number;
};

export type PortalOrderItem = {
  bookId: string;
  title: string;
  quantity: number;
  price: number;
  sku?: string;
  batchNo?: string;
  preorder?: boolean;
};

export type PortalOrder = {
  id: string;
  date: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
  channel?: string;
  deliveryMode?: "delivery" | "store_pickup";
  subtotal: number;
  discount?: number;
  shipping?: number;
  total: number;
  amountPaid?: number;
  balanceDue: number;
  isPackedUnpaid: boolean;
  courierName?: string;
  trackingId?: string;
  eta?: string;
  createdBy?: string;
  items: PortalOrderItem[];
  deliveryAddress?: {
    fullName?: string;
    phone?: string;
    email?: string;
    line1?: string;
    landmark?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  preorderPayment?: {
    advance: number;
    balance: number;
    advancePaidAt?: string;
    balancePaidAt?: string;
    shippingDue?: boolean;
    link?: { url: string; createdAt?: string; expiresAt?: string };
  };
  balanceReminder?: {
    lastAt: string;
    count: number;
    channels: string[];
    due: number;
  };
  pick?: {
    assignee?: string;
    packer?: string;
    assignedAt?: string;
    acceptedAt?: string;
    picked?: Record<string, number>;
    pickedAt?: string;
    packScan?: Record<string, number>;
    orderScannedAt?: string;
    packedAt?: string;
  };
  shipment?: {
    id: string;
    courier?: string;
    awb?: string;
    status?: string;
    expectedBy?: string;
    events?: { title?: string; detail?: string; at?: string; location?: string }[];
  };
  awbPhotos?: { url: string; at: string; by: string; byName?: string; awb?: string }[];
  history?: { at: string; status: string; note?: string; by?: string }[];
};

export type PortalTicket = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  responses?: { at: string; from: string; text: string }[];
};

export type PosBook = {
  id: string;
  title: string;
  author?: string;
  language?: string;
  price: number;
  stock?: number;
  stockStatus?: string;
  sku?: string;
  isbn?: string;
  barcode?: string;
  image?: string;
  coverImage?: string;
  offer?: { price?: number; active?: boolean };
  preorder?: boolean | { enabled?: boolean };
  isPreorderable?: boolean;
};

export type PosOrderSettings = {
  preorderPayment?: {
    mode?: string;
    advanceType?: "amount" | "percent";
    advanceValue?: number;
    balanceWhen?: "on_ready" | "before_dispatch";
  };
  platformFee?: { enabled?: boolean; amount?: number };
  shippingFeeMode?: string;
  flatFee?: number;
};

export type PosCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

let currentPortalSession: PortalSession | null = null;

export function getPortalSession() {
  return currentPortalSession;
}

export async function loadPortalSession(): Promise<PortalSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(PORTAL_SESSION_KEY);
    currentPortalSession = raw ? (JSON.parse(raw) as PortalSession) : null;
  } catch {
    currentPortalSession = null;
  }
  return currentPortalSession;
}

export async function savePortalSession(next: PortalSession | null) {
  currentPortalSession = next;
  try {
    if (next) await SecureStore.setItemAsync(PORTAL_SESSION_KEY, JSON.stringify(next));
    else await SecureStore.deleteItemAsync(PORTAL_SESSION_KEY);
  } catch {
    /* ignore storage error */
  }
}

export async function callPortal<T = Record<string, unknown>>(action: string, payload: Record<string, unknown> = {}): Promise<T & { ok: boolean; error?: string }> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };
  if (currentPortalSession?.token) {
    headers.authorization = `Bearer ${currentPortalSession.token}`;
  }
  const response = await fetch(`${DEFAULT_API}/api/mobile/portal`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...payload }),
  });
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = { ok: false, error: `Server returned HTTP ${response.status}` };
  }
  if (response.status === 401 && action !== "login" && action !== "otp-verify") {
    await savePortalSession(null);
  }
  if (!data.ok) {
    throw new Error(String(data.error || `Request failed (${response.status})`));
  }
  return data as T & { ok: boolean; error?: string };
}

export async function portalLogin(email: string, password: string) {
  const data = await callPortal<{ token: string; session: PortalSession }>("login", { email, password });
  const session: PortalSession = { ...data.session, token: data.token };
  await savePortalSession(session);
  return session;
}

export async function portalOtpSend(email: string, portal: string) {
  return callPortal<{ message?: string }>("otp-send", { email, portal });
}

export async function portalOtpVerify(email: string, code: string) {
  const data = await callPortal<{ token: string; session: PortalSession }>("otp-verify", { email, code });
  const session: PortalSession = { ...data.session, token: data.token };
  await savePortalSession(session);
  return session;
}

export async function portalLogout() {
  const token = currentPortalSession?.token;
  await savePortalSession(null);
  if (token) {
    await callPortal("logout", { token }).catch(() => undefined);
  }
}

export async function fetchPortalDashboard() {
  return callPortal<{ metrics: PortalMetrics; packedUnpaid: PortalOrder[]; recentOrders: PortalOrder[] }>("dashboard");
}

export async function fetchPortalOrders(filter = "all", q = "") {
  return callPortal<{ total: number; orders: PortalOrder[] }>("orders", { filter, q, limit: 100 });
}

export async function fetchPortalOrder(orderId: string) {
  return callPortal<{ order: PortalOrder }>("order-detail", { orderId });
}

export async function updatePortalOrder(input: {
  orderId: string;
  status?: string;
  markBalancePaid?: boolean;
  paymentMethod?: string;
  paymentRef?: string;
  note?: string;
}) {
  return callPortal<{ order: PortalOrder }>("order-update", input);
}

export async function sendBalanceReminder(input: {
  orderId?: string;
  allPackedUnpaid?: boolean;
  channels?: ("whatsapp" | "email")[];
}) {
  return callPortal<{
    orderId?: string;
    alreadyPaid?: boolean;
    due?: number;
    whatsapp?: string;
    email?: string;
    payUrl?: string;
    sentCount?: number;
    total?: number;
    order?: PortalOrder;
  }>("balance-reminder", input);
}

export async function fetchPickPackQueue() {
  return callPortal<{
    unassigned: PortalOrder[];
    pickQueue: PortalOrder[];
    packQueue: PortalOrder[];
    recentlyPacked: PortalOrder[];
  }>("pick-pack-queue");
}

export async function runPickPackAction(input: {
  sub: "claim-pick" | "pick-scan" | "complete-pick" | "pack-scan" | "complete-pack";
  orderId: string;
  code?: string;
  bookId?: string;
}) {
  return callPortal<{ order: PortalOrder; allPicked?: boolean; orderQrMatched?: boolean; matchedTitle?: string }>(
    "pick-pack-action",
    input
  );
}

export async function scanLookup(code: string) {
  return callPortal<{ kind: "order" | "book"; order?: PortalOrder; book?: PosBook }>("scan-lookup", { code });
}

export async function uploadAwbPhoto(input: { orderId: string; dataUrl: string; awb?: string; filename?: string }) {
  return callPortal<{
    photo: { url: string; at: string; by: string; byName?: string; awb?: string };
    order: PortalOrder;
  }>("upload-awb-photo", input);
}

export async function fetchPosCatalog() {
  return callPortal<{
    books: PosBook[];
    customers: PosCustomer[];
    site?: { name?: string; address?: string; phone?: string };
    orderSettings?: PosOrderSettings;
    razorpayConfigured?: boolean;
    razorpayEdcConfigured?: boolean;
  }>("pos-catalog");
}

export async function posRazorpayStart(input: { amount: number; receipt?: string }) {
  return callPortal<{ keyId: string; razorpayOrderId: string; amount: number; receipt: string }>("pos-razorpay-start", input);
}

export async function posRazorpayLink(input: {
  amount: number;
  receipt?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  description?: string;
}) {
  return callPortal<{ linkId: string; url: string; status: string; amount: number; receipt: string }>("pos-razorpay-link", input);
}

export async function posRazorpayLinkCheck(linkId: string) {
  return callPortal<{ paid: boolean; status: string; paymentId: string }>("pos-razorpay-link-check", { linkId });
}

export async function posEdcStart(input: {
  amount: number;
  receipt?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  edcMethod?: "upi" | "card";
}) {
  return callPortal<{ razorpayOrderId: string; activityId: string; status: string; deviceMode: string }>("pos-edc-start", input);
}

export async function posEdcStatus(input: { razorpayOrderId: string; activityId?: string }) {
  return callPortal<{ paid: boolean; failed: boolean; pending: boolean; paymentId: string; method: string; error?: string }>(
    "pos-edc-status",
    input
  );
}

export async function createPosOrder(input: {
  items: { bookId: string; quantity: number; price?: number }[];
  orderType?: "normal" | "preorder";
  deliveryMode?: "store_pickup" | "delivery";
  address?: { line1: string; landmark?: string; city: string; state: string; pincode: string };
  shipping?: number;
  shippingDue?: boolean;
  discount?: number;
  payNow?: number;
  paymentMethod: string;
  paymentRef?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  paymentLinkId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
}) {
  return callPortal<{ order: PortalOrder }>("pos-create-order", input);
}

export async function fetchPortalTickets() {
  return callPortal<{ tickets: PortalTicket[] }>("tickets");
}

export async function replyPortalTicket(input: { ticketId: string; text?: string; status?: string }) {
  return callPortal<{ ticket: PortalTicket }>("ticket-reply", input);
}

export function formatINR(value: number | undefined) {
  return `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
}

export function formatShortDate(iso?: string) {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
