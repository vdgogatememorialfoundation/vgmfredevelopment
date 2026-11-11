import * as SecureStore from "expo-secure-store";
import { DEFAULT_API, FEED_ORIGINS } from "./host";

export type Row = Record<string, unknown>;

export type Feed = {
  publishedAt: string;
  site: {
    name: string;
    tagline: string;
    logoUrl?: string;
    logoText?: string;
    email: string;
    phone: string;
    address: string;
    social?: Record<string, string>;
  };
  flags: { supportUs?: boolean; supportUsTitle?: string; supportUsText?: string; supportUsHref?: string };
  visibility: Record<string, boolean>;
  mobile: {
    minVersion?: string;
    latestVersion?: string;
    forceUpdate?: boolean;
    playStoreUrl?: string;
    appStoreUrl?: string;
    apiBaseUrl?: string;
    modules: Record<string, boolean>;
    apps?: Record<string, { name?: string; logoUrl?: string }>;
    showDeveloperCredit?: boolean;
  };
  platformCountries?: {
    allowInternational?: boolean;
    enabledCountryCodes?: string[];
  };
  events: Row[];
  articles: Row[];
  books: Row[];
  clinics: Row[];
  videos: Row[];
  notices: Row[];
  announcements: Row[];
  flyers?: Row[];
  gallery: Row[];
  about: Row | null;
  policies: Record<string, { title?: string; description?: string; sections?: { title: string; body: string }[] }>;
  faqs: Array<{ question?: string; answer?: string }>;
  productReviews?: Row[];
  banners?: Row[];
  awards?: Row[];
  pages?: Row[];
  orderSettings?: Row;
  appearance?: Record<string, unknown> | null;
};

export type Session = { token: string; email: string; name: string; accountId?: string };

export type FoundationAccount = {
  id: string;
  accountId: string;
  salutation?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  name: string;
};

function asSession(data: Record<string, unknown>, fallback?: Partial<Session>): Session {
  const account = (data.account as FoundationAccount | undefined) || undefined;
  return {
    token: String(data.token || fallback?.token || ""),
    email: String(data.email || account?.email || fallback?.email || ""),
    name: String(data.name || account?.name || fallback?.name || ""),
    accountId: String(data.accountId || account?.accountId || fallback?.accountId || "") || undefined,
  };
}

async function accountAction(action: string, body: Record<string, unknown> = {}) {
  const data = await parse(
    await fetch(`${getApiBase()}/api/mobile/account`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ action, ...body }),
    })
  );
  if (!data.ok) throw new Error(String(data.error || "Could not reach Foundation accounts."));
  return data;
}

const SESSION_KEY = "vgmf-session";
let apiBase = DEFAULT_API;
let session: Session | null = null;

export function getApiBase() {
  return apiBase.replace(/\/$/, "");
}

export function setApiBase(url?: string) {
  if (url && /^https?:\/\//i.test(url)) apiBase = url.replace(/\/$/, "");
}

export function getSession() {
  return session;
}

export async function loadSession() {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    session = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    session = null;
  }
  return session;
}

export async function saveSession(next: Session | null) {
  session = next;
  try {
    if (next) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
    else await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    /* device storage unavailable */
  }
}

function headers(json = true): Record<string, string> {
  const value: Record<string, string> = { accept: "application/json" };
  if (json) value["content-type"] = "application/json";
  if (session?.token) value.authorization = `Bearer ${session.token}`;
  return value;
}

function looksLikeHtml(text: string) {
  const trimmed = text.trim();
  return (
    /^<!DOCTYPE html/i.test(trimmed) ||
    /^<html[\s>]/i.test(trimmed) ||
    /parastorage\.com/i.test(trimmed) ||
    /<(title|meta|script)[\s>]/i.test(trimmed)
  );
}

function publicError(status: number, text: string) {
  if (looksLikeHtml(text) || /400 Error: Bad Request|404 Error: Page Not Found/i.test(text)) {
    return "The public website is not serving the app feed yet. Pull down to retry.";
  }
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 160 || trimmed.includes("<")) {
    return status ? `Could not load the Foundation app feed (HTTP ${status}).` : "Could not load the Foundation app feed.";
  }
  return trimmed;
}

function feedOrigins() {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const raw of [getApiBase(), ...FEED_ORIGINS]) {
    const origin = String(raw || "").replace(/\/$/, "");
    if (!origin || seen.has(origin)) continue;
    seen.add(origin);
    list.push(origin);
  }
  return list;
}

async function parse(response: Response, mode: "public" | "auth" = "auth") {
  const text = await response.text();
  let data: Record<string, unknown> = {};
  if (looksLikeHtml(text)) {
    data = { ok: false, error: publicError(response.status, text) };
  } else {
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      data = { ok: false, error: publicError(response.status, text) };
    }
  }
  if (mode === "auth" && response.status === 401) {
    data.ok = false;
    data.error = data.error || "Sign in again.";
  }
  return data;
}

export async function fetchFeed(): Promise<Feed> {
  const stamp = Date.now();
  const urls = feedOrigins().flatMap((origin) => [
    `${origin}/api/mobile/feed?t=${stamp}`,
    `${origin}/app-feed.json?t=${stamp}`,
  ]);
  let lastError = "Could not reach the Foundation app feed.";
  for (const url of urls) {
    try {
      const response = await fetch(url, { headers: { accept: "application/json" } });
      const data = await parse(response, "public");
      const feed = (data.feed ?? data) as Feed;
      if (feed?.site?.name) {
        setApiBase(new URL(url).origin);
        return feed;
      }
      lastError = publicError(response.status, String(data.error || lastError));
    } catch (error) {
      lastError = publicError(0, (error as Error).message || lastError);
    }
  }
  throw new Error(lastError);
}

export async function fetchConfig() {
  const data = await parse(await fetch(`${getApiBase()}/api/mobile/config`, { headers: { accept: "application/json" } }), "public");
  if (!data.ok) return null;
  return data as { ok: true; version?: number; publishedAt?: string; appearance?: Record<string, unknown> };
}

export async function fetchLiveNotices() {
  const data = await parse(await fetch(`${getApiBase()}/api/notices`, { headers: { accept: "application/json" } }), "public");
  if (!data.ok) return [] as Row[];
  return (data.notices ?? []) as Row[];
}

export async function sendEmailOtp(email: string, name?: string) {
  const data = await parse(
    await fetch(`${getApiBase()}/api/mobile/otp`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ action: "send", email, name }),
    })
  );
  if (!data.ok) throw new Error(String(data.error || "Could not send the email code."));
  return data as { ok: true; message?: string };
}

export async function logoutSession() {
  const token = session?.token;
  await saveSession(null);
  if (!token) return;
  try {
    await fetch(`${getApiBase()}/api/mobile/otp`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "logout", token }),
    });
  } catch {
    /* local sign-out still applies */
  }
}

export async function checkSession() {
  await loadSession();
  if (!session?.token) return null;
  try {
    const data = await parse(
      await fetch(`${getApiBase()}/api/mobile/account`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ action: "session" }),
      }),
      "auth"
    );
    if (!data.ok) return session;
    const next = asSession(data, session);
    if (next.token) await saveSession(next);
    return next.token ? next : session;
  } catch {
    return session;
  }
}

export async function verifyEmailOtp(email: string, code: string, name?: string) {
  const data = await parse(
    await fetch(`${getApiBase()}/api/mobile/otp`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ action: "verify", email, code, name }),
    })
  );
  if (!data.ok || !data.token) throw new Error(String(data.error || "That code is not valid."));
  const next = asSession(data, { email, name });
  await saveSession(next);
  return next;
}

export async function registerAccount(input: {
  salutation: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp?: string;
  alternatePhone?: string;
  country?: string;
  countryCode?: string;
}) {
  return accountAction("register", input) as Promise<{ ok: true; message?: string; pending?: Record<string, string> }>;
}

export async function verifyRegister(input: {
  salutation: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp?: string;
  alternatePhone?: string;
  country?: string;
  countryCode?: string;
  code: string;
}) {
  const data = await accountAction("verify-register", input);
  const next = asSession(data);
  if (!next.token) throw new Error("Could not create the Foundation account.");
  await saveSession(next);
  return { ...next, message: String(data.message || "") };
}

export async function loginAccount(input: { identifier: string; password?: string; method?: "password" | "otp" }) {
  const data = await accountAction("login", input);
  if (data.token && data.otpRequired === false) {
    const next = asSession(data);
    await saveSession(next);
    return { ok: true as const, otpRequired: false as const, session: next, email: next.email, name: next.name, message: String(data.message || "Signed in.") };
  }
  return { ok: true as const, otpRequired: true as const, email: String(data.email || input.identifier), name: String(data.name || ""), message: String(data.message || "") };
}

export async function verifyLogin(email: string, code: string) {
  const data = await accountAction("verify-login", { email, code });
  const next = asSession(data, { email });
  if (!next.token) throw new Error("That code is not valid.");
  await saveSession(next);
  return next;
}

export async function forgotPassword(identifier: string) {
  return accountAction("forgot", { identifier }) as Promise<{ ok: true; email?: string; message?: string }>;
}

export async function resetPassword(email: string, code: string, password: string) {
  return accountAction("reset", { email, code, password }) as Promise<{ ok: true; message?: string }>;
}

export async function askChat(message: string) {
  const data = await parse(
    await fetch(`${getApiBase()}/api/mobile/chat`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ message }),
    }),
    "public"
  );
  if (!data.ok) throw new Error(String(data.error || "Could not send that question."));
  return String(data.reply || "");
}

export async function listTickets() {
  const data = await parse(await fetch(`${getApiBase()}/api/mobile/tickets`, { headers: headers(false) }));
  if (!data.ok) throw new Error(String(data.error || "Could not load tickets."));
  return (data.tickets ?? []) as Row[];
}

export async function createTicket(input: { name: string; email: string; phone?: string; subject: string; body: string }) {
  const data = await parse(
    await fetch(`${getApiBase()}/api/mobile/tickets`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(input),
    })
  );
  if (!data.ok) throw new Error(String(data.error || "Could not create the ticket."));
  return data.ticket as Row;
}

export async function replyTicket(id: string, body: string) {
  const data = await parse(
    await fetch(`${getApiBase()}/api/mobile/tickets`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ action: "reply", id, body }),
    })
  );
  if (!data.ok) throw new Error(String(data.error || "Could not send the reply."));
  return data.ticket as Row;
}

export async function listOrders() {
  const data = await parse(await fetch(`${getApiBase()}/api/mobile/orders`, { headers: headers(false) }));
  if (!data.ok) throw new Error(String(data.error || "Could not load orders."));
  return (data.orders ?? []) as Row[];
}

export async function requestReplacement(input: { orderId: string; note?: string; images: string[] }) {
  const data = await parse(
    await fetch(`${getApiBase()}/api/mobile/orders`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ action: "replacement", ...input }),
    })
  );
  if (!data.ok) throw new Error(String(data.error || "Could not send the replacement request."));
  return data.order as Row;
}

export type PostalPlace = {
  city: string;
  state: string;
  country: string;
  countryCode: string;
  pincode: string;
};

export async function fetchPostalPlace(postal: string, countryCode?: string): Promise<PostalPlace | null> {
  const pin = postal.trim();
  if (pin.length < 3) return null;
  const query = new URLSearchParams({ postal: pin });
  if (countryCode) query.set("country", countryCode);
  const data = await parse(await fetch(`${getApiBase()}/api/geo/postal?${query}`, { headers: { accept: "application/json" } }), "public");
  return ((data.place as PostalPlace | undefined) ?? null);
}

export async function placeOrder(input: {
  name?: string;
  email?: string;
  phone?: string;
  line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  countryCode?: string;
  items: { id: string; quantity: number }[];
}) {
  const data = await parse(
    await fetch(`${getApiBase()}/api/mobile/orders`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(input),
    })
  );
  if (!data.ok) throw new Error(String(data.error || "Could not place the order."));
  return data.order as Row;
}

export async function createCheckout(input: {
  name: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  countryCode?: string;
  landmark?: string;
  pickup?: boolean;
  promoCode?: string;
  items: { id: string; quantity: number }[];
}) {
  const data = await parse(
    await fetch(`${getApiBase()}/api/mobile/checkout`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(input),
    })
  );
  if (!data.ok) throw new Error(String(data.error || "Could not start checkout."));
  return data as { ok: true; configured?: boolean; order?: Row; amount?: number; keyId?: string; razorpayOrderId?: string };
}

export async function verifyCheckout(input: { orderId: string; paymentId?: string; razorpayOrderId?: string; signature?: string }) {
  const data = await parse(
    await fetch(`${getApiBase()}/api/mobile/checkout`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ action: "verify", ...input }),
    })
  );
  if (!data.ok) throw new Error(String(data.error || "Could not confirm payment."));
  return data as { ok: true; order?: Row };
}

export async function listPartnerRecords() {
  const data = await parse(await fetch(`${getApiBase()}/api/mobile/records`, { headers: headers(false) }));
  if (!data.ok) throw new Error(String(data.error || "Could not load account records."));
  return data as { ok: true; tickets: Row[]; payments: Row[]; syncedAt?: string };
}

export async function listInbox() {
  const data = await parse(await fetch(`${getApiBase()}/api/mobile/inbox`, { headers: headers(false) }));
  if (!data.ok) throw new Error(String(data.error || "Could not load notifications."));
  return (data.items ?? []) as Row[];
}

export async function liveChatAction(action: string, body: Record<string, unknown> = {}) {
  const data = await parse(
    await fetch(`${getApiBase()}/api/mobile/live-chat`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ action, ...body }),
    })
  );
  if (!data.ok) throw new Error(String(data.error || "Could not update chat."));
  return data as { ok: true; thread?: Row; threads?: Row[] };
}

export async function listLiveChats() {
  const data = await parse(await fetch(`${getApiBase()}/api/mobile/live-chat`, { headers: headers(false) }));
  if (!data.ok) throw new Error(String(data.error || "Could not load chats."));
  return (data.threads ?? []) as Row[];
}

export async function verifyCertificate(number: string) {
  const data = await parse(
    await fetch(`${getApiBase()}/api/certificates/verify?number=${encodeURIComponent(number)}`, {
      headers: { accept: "application/json" },
    }),
    "public"
  );
  return data as { ok?: boolean; verified?: boolean; error?: string; certificate?: Row; sourceLabel?: string };
}

export function str(value: unknown, fallback = "") {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

export function mediaUrl(value?: unknown) {
  const raw = str(value);
  if (!raw) return "";
  if (/^(https?:|data:|file:|content:)/i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${getApiBase()}${raw}`;
  return raw;
}

export function findRow(rows: Row[] | undefined, id: string) {
  return (rows ?? []).find((row) => str(row.id) === id || str(row.slug) === id);
}

export function money(value: unknown) {
  return `₹${(Number(value) || 0).toLocaleString("en-IN")}`;
}

export function formatDate(value: unknown) {
  const text = str(value);
  if (!text) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.slice(0, 10);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function isPastDate(value: unknown) {
  const text = str(value);
  if (!text) return false;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T23:59:59` : text);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
}

export function isRegistrationClosed(item: Row | null | undefined) {
  if (!item) return true;
  if (str(item.registrationStatus).toLowerCase() === "closed") return true;
  return isPastDate(item.endDate || item.startDate || item.registrationEnd);
}

export function moduleOn(feed: Feed | null, id: string) {
  if (!feed) return true;
  if (feed.visibility?.[id] === false) return false;
  if (feed.mobile?.modules?.[id] === false) return false;
  return true;
}

export type RegistrationField = { key?: string; type?: string; label?: string; required?: boolean; enabled?: boolean; options?: ({ value?: string; label?: string } | string)[] };

export async function fetchRegistrationForm(portal: string, seminarId: number, phase: "pre" | "main") {
  const response = await fetch(`${getApiBase()}/api/partners/registrations?portal=${encodeURIComponent(portal)}&seminarId=${seminarId}&phase=${phase}`, { headers: headers(false) });
  const data = (await response.json().catch(() => null)) as { error?: string; form?: { fields?: RegistrationField[] } } | null;
  if (!response.ok) throw new Error(data?.error || "The registration form is not available.");
  return (data?.form?.fields ?? []).filter((field) => field.enabled !== false && field.key);
}

export async function submitRegistration(input: { portal: string; seminarId: number; phase: "pre" | "main"; values: Record<string, string> }) {
  const body = new FormData();
  body.append("portal", input.portal);
  body.append("seminarId", String(input.seminarId));
  body.append("phase", input.phase);
  body.append("formData", JSON.stringify(input.values));
  const auth = headers(false);
  const response = await fetch(`${getApiBase()}/api/partners/registrations`, { method: "POST", headers: { accept: "application/json", ...(auth.authorization ? { authorization: auth.authorization } : {}) }, body });
  const data = (await response.json().catch(() => null)) as { error?: string; message?: string; applicationNo?: string } | null;
  if (!response.ok) throw new Error(data?.error || "Could not register.");
  return data?.applicationNo ? `${data.message || "Registered."} Application ${data.applicationNo}.` : data?.message || "Registered.";
}

export async function fetchWallet() {
  const data = await parse(await fetch(`${getApiBase()}/api/shop/wallet`, { headers: headers(false) }));
  return { balance: Number(data.balance) || 0, entries: (Array.isArray(data.entries) ? data.entries : []) as Row[] };
}

export async function startBalancePayment(orderId: string) {
  const data = await parse(await fetch(`${getApiBase()}/api/mobile/checkout`, { method: "POST", headers: headers(), body: JSON.stringify({ action: "balance", orderId }) }));
  if (!data.ok) throw new Error(String(data.error || "Could not start the payment."));
  return data as { ok: true; order?: Row; amount?: number; keyId?: string; razorpayOrderId?: string };
}

export async function verifyBalancePayment(input: { orderId: string; paymentId?: string; razorpayOrderId?: string; signature?: string }) {
  const data = await parse(await fetch(`${getApiBase()}/api/mobile/checkout`, { method: "POST", headers: headers(), body: JSON.stringify({ action: "balance_verify", ...input }) }));
  if (!data.ok) throw new Error(String(data.error || "Could not confirm payment."));
  return data as { ok: true; order?: Row };
}

export function preorderable(book?: Row | null) {
  if (!book) return false;
  const plan = book.preorder as { enabled?: boolean } | boolean | undefined;
  const enabled = typeof plan === "object" ? Boolean(plan?.enabled) : Boolean(plan);
  return enabled && (str(book.stockStatus) === "out_of_stock" || Number(book.stock ?? 0) <= 0);
}

export function orderable(book?: Row | null) {
  if (!book || book.active === false) return false;
  return preorderable(book) || (str(book.stockStatus) !== "out_of_stock" && Number(book.stock ?? 1) > 0);
}

export function preorderDeliveryDate(book?: Row | null, now = new Date()) {
  const plan = (book?.preorder ?? {}) as { releaseDate?: string };
  const release = plan.releaseDate ? new Date(`${plan.releaseDate}T00:00:00+05:30`) : null;
  const start = release && !Number.isNaN(release.getTime()) && release > now ? release : now;
  return formatDate(new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString());
}

export function plainText(value: unknown) {
  return str(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Offer price while the product's offer runs, otherwise the regular price. */
export function offerPrice(book?: Row | null, now = Date.now()) {
  const price = Number(book?.price) || 0;
  const offer = (book?.offer ?? null) as { price?: number; label?: string; startsAt?: string; endsAt?: string } | null;
  if (!offer || !(Number(offer.price) > 0) || Number(offer.price) >= price) return price;
  if (offer.startsAt && Date.parse(offer.startsAt) > now) return price;
  if (offer.endsAt && Date.parse(offer.endsAt) < now) return price;
  return Number(offer.price);
}

export function offerLabel(book?: Row | null) {
  if (!book || offerPrice(book) >= (Number(book.price) || 0)) return "";
  return str((book.offer as { label?: string } | undefined)?.label, "Special offer");
}

export type PromoRule =
  | { kind: "coupon"; code: string; label: string; type: "percent" | "flat"; value: number; minOrder: number; maxDiscount: number }
  | { kind: "gift"; code: string; label: string; balance: number };

export function promoAmount(rule: PromoRule | null, subtotal: number) {
  if (!rule || subtotal <= 0) return 0;
  if (rule.kind === "gift") return Math.min(subtotal, Math.max(0, rule.balance));
  if (subtotal < rule.minOrder) return 0;
  let off = rule.type === "percent" ? (subtotal * rule.value) / 100 : rule.value;
  if (rule.maxDiscount > 0) off = Math.min(off, rule.maxDiscount);
  return Math.round(Math.min(subtotal, Math.max(0, off)) * 100) / 100;
}

export async function checkPromo(code: string, preorder: boolean) {
  const data = await parse(
    await fetch(`${getApiBase()}/api/shop/promotions`, { method: "POST", headers: headers(), body: JSON.stringify({ action: "check", code, preorder }) })
  );
  if (!data.ok) throw new Error(String(data.error || "That code isn't valid."));
  return data.rule as PromoRule;
}

/** Overall star rating and counts from the published buyer reviews (falls back to the product's own rating). */
export function productRating(feed: Feed | null, book: Row) {
  const reviews = (feed?.productReviews ?? []).filter((row) => str(row.bookId || row.productId) === str(book.id));
  const scores = reviews.map((row) => Number(row.rating) || 0).filter((value) => value > 0);
  const rating = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : Number(book.rating) || 0;
  const ratings = scores.length || Number(book.reviewCount) || 0;
  const written = reviews.filter((row) => str(row.comment || row.text || row.body).trim()).length;
  return { rating: Math.round(rating * 10) / 10, ratings, written };
}

/** Return / replacement / cancellation for this product: its own setting, else the shop rules. */
export function productPolicy(feed: Feed | null, book: Row) {
  const rules = (feed?.orderSettings ?? {}) as { returns?: { enabled?: boolean; replacementAllowed?: boolean; windowDays?: number }; cancellation?: { enabled?: boolean } };
  const own = (book.policy ?? {}) as { returns?: boolean; replacement?: boolean; cancellation?: boolean };
  const returns = own.returns ?? rules.returns?.enabled !== false;
  return {
    returns,
    replacement: own.replacement ?? (returns && rules.returns?.replacementAllowed !== false),
    cancellation: own.cancellation ?? rules.cancellation?.enabled === true,
    windowDays: Number(rules.returns?.windowDays) || 7,
  };
}

/** Public shipment lookup by order number + mobile number, same as the website's Track a shipment page. */
export async function trackOrder(id: string, phone: string) {
  const response = await fetch(`${getApiBase()}/api/shop/orders?id=${encodeURIComponent(id.trim())}&phone=${encodeURIComponent(phone.trim())}`, { headers: headers(false) });
  const data = (await response.json().catch(() => ({}))) as { orders?: Row[] };
  return data.orders?.[0] ?? null;
}
