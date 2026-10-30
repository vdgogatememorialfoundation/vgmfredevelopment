import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { dirname, join } from "node:path";

const OTP_FILE = join("/tmp", "vgmf-mobile-otp.json");
const TICKETS_FILE = join("/tmp", "vgmf-mobile-tickets.json");
const ORDERS_FILE = join("/tmp", "vgmf-mobile-orders.json");
const SESSIONS_FILE = join("/tmp", "vgmf-mobile-sessions.json");

const OTP_RESEND_MS = 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TICKET_WINDOW_MS = 10 * 60 * 1000;
const TICKET_MAX_PER_WINDOW = 3;
const ORDER_IDEM_MS = 2 * 60 * 1000;

type OtpRecord = { email: string; code: string; expiresAt: number; sentAt: number; attempts: number };
export type MobileSession = { token: string; email: string; name: string; createdAt: string; expiresAt: string };
export type MobileTicket = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  body: string;
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  createdAt: string;
  responses: { at: string; from: string; text: string }[];
};
export type MobileOrder = {
  id: string;
  email: string;
  name: string;
  phone?: string;
  items: { id: string; title: string; quantity: number; price: number }[];
  total: number;
  status: "Recorded";
  paymentStatus: "unpaid";
  createdAt: string;
};

type IdemRecord = { key: string; orderId: string; at: number };

const memory = {
  otp: null as OtpRecord[] | null,
  tickets: null as MobileTicket[] | null,
  orders: null as MobileOrder[] | null,
  sessions: null as MobileSession[] | null,
  idem: [] as IdemRecord[],
};

function readFile<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeFile(file: string, value: unknown) {
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(value));
  } catch {
    /* ephemeral host — in-memory copy still holds for this instance */
  }
}

function codesMatch(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function load<T>(key: keyof typeof memory, file: string, fallback: T): T {
  if (memory[key] == null) (memory[key] as T) = readFile(file, fallback);
  return memory[key] as T;
}

function persist<T>(key: "otp" | "tickets" | "orders" | "sessions", file: string, value: T) {
  (memory[key] as T) = value;
  writeFile(file, value);
}

function newId() {
  return randomBytes(6).toString("hex");
}

export function issueMobileOtp(email: string): { code?: string; error?: string } {
  const normalized = email.trim().toLowerCase();
  const list = load<OtpRecord[]>("otp", OTP_FILE, []);
  const existing = list.find((item) => item.email === normalized);
  if (existing && Date.now() - existing.sentAt < OTP_RESEND_MS) {
    const wait = Math.ceil((OTP_RESEND_MS - (Date.now() - existing.sentAt)) / 1000);
    return { error: `Wait ${wait} seconds before requesting another email code.` };
  }
  const code = String(randomInt(100000, 1000000));
  const next = list.filter((item) => item.email !== normalized);
  next.push({ email: normalized, code, expiresAt: Date.now() + OTP_TTL_MS, sentAt: Date.now(), attempts: 0 });
  persist("otp", OTP_FILE, next);
  return { code };
}

export function clearMobileOtp(email: string) {
  persist(
    "otp",
    OTP_FILE,
    load<OtpRecord[]>("otp", OTP_FILE, []).filter((item) => item.email !== email.trim().toLowerCase())
  );
}

export function verifyMobileOtp(email: string, code: string) {
  const normalized = email.trim().toLowerCase();
  const list = load<OtpRecord[]>("otp", OTP_FILE, []);
  const record = list.find((item) => item.email === normalized);
  if (!record) return "No code has been sent.";
  if (Date.now() > record.expiresAt) {
    clearMobileOtp(normalized);
    return "That code has expired.";
  }
  if (!/^\d{6}$/.test(code.trim())) return "Enter the 6-digit email code.";
  if (!codesMatch(record.code, code.trim())) {
    record.attempts += 1;
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      clearMobileOtp(normalized);
      return "Too many incorrect attempts. Request a new email code.";
    }
    persist("otp", OTP_FILE, list);
    return "Incorrect code.";
  }
  clearMobileOtp(normalized);
  return null;
}

export function createMobileSession(email: string, name = "") {
  const now = Date.now();
  const session: MobileSession = {
    token: randomBytes(24).toString("hex"),
    email: email.trim().toLowerCase(),
    name: name.trim(),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  };
  const list = load<MobileSession[]>("sessions", SESSIONS_FILE, []).filter((item) => item.email !== session.email);
  list.push(session);
  persist("sessions", SESSIONS_FILE, list);
  return session;
}

export function sessionFromToken(token?: string | null) {
  if (!token) return null;
  const list = load<MobileSession[]>("sessions", SESSIONS_FILE, []);
  const session = list.find((item) => item.token === token);
  if (!session) return null;
  if (Date.parse(session.expiresAt || "") < Date.now()) {
    persist(
      "sessions",
      SESSIONS_FILE,
      list.filter((item) => item.token !== token)
    );
    return null;
  }
  return session;
}

export function revokeMobileSession(token?: string | null) {
  if (!token) return;
  persist(
    "sessions",
    SESSIONS_FILE,
    load<MobileSession[]>("sessions", SESSIONS_FILE, []).filter((item) => item.token !== token)
  );
}

export function publicSession(session: MobileSession) {
  return { email: session.email, name: session.name, expiresAt: session.expiresAt };
}

export function listTickets(email: string) {
  const normalized = email.trim().toLowerCase();
  return load<MobileTicket[]>("tickets", TICKETS_FILE, []).filter((ticket) => ticket.email === normalized);
}

export function ticketRateLimited(email: string) {
  const since = Date.now() - TICKET_WINDOW_MS;
  const recent = listTickets(email).filter((ticket) => Date.parse(ticket.createdAt) >= since);
  return recent.length >= TICKET_MAX_PER_WINDOW;
}

export function addTicket(input: { name: string; email: string; phone?: string; subject: string; body: string }) {
  const email = input.email.trim().toLowerCase();
  if (ticketRateLimited(email)) {
    throw new Error("Wait a few minutes before sending another ticket.");
  }
  const now = new Date().toISOString();
  const ticket: MobileTicket = {
    id: newId(),
    name: input.name.trim().slice(0, 80),
    email,
    phone: input.phone?.trim().slice(0, 30),
    subject: input.subject.trim().slice(0, 200),
    body: input.body.trim().slice(0, 5000),
    status: "Open",
    createdAt: now,
    responses: [],
  };
  const list = load<MobileTicket[]>("tickets", TICKETS_FILE, []);
  list.unshift(ticket);
  persist("tickets", TICKETS_FILE, list);
  return ticket;
}

export function listOrders(email: string) {
  const normalized = email.trim().toLowerCase();
  return load<MobileOrder[]>("orders", ORDERS_FILE, []).filter((order) => order.email === normalized);
}

function orderKey(email: string, items: MobileOrder["items"]) {
  return createHash("sha256")
    .update(JSON.stringify({ email, items: items.map((item) => [item.id, item.quantity, item.price]) }))
    .digest("hex");
}

export function addOrder(input: { email: string; name: string; phone?: string; items: MobileOrder["items"] }) {
  const email = input.email.trim().toLowerCase();
  const items = input.items.map((item) => ({
    id: String(item.id),
    title: String(item.title).slice(0, 200),
    quantity: Math.max(1, Math.min(20, Math.floor(Number(item.quantity) || 1))),
    price: Math.max(0, Number(item.price) || 0),
  }));
  const key = orderKey(email, items);
  const now = Date.now();
  memory.idem = memory.idem.filter((row) => now - row.at < ORDER_IDEM_MS);
  const replay = memory.idem.find((row) => row.key === key);
  if (replay) {
    const existing = load<MobileOrder[]>("orders", ORDERS_FILE, []).find((order) => order.id === replay.orderId);
    if (existing) return existing;
  }
  const order: MobileOrder = {
    email,
    name: input.name.trim().slice(0, 80) || "Customer",
    phone: input.phone?.trim().slice(0, 30),
    items,
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    id: newId(),
    status: "Recorded",
    paymentStatus: "unpaid",
    createdAt: new Date(now).toISOString(),
  };
  const list = load<MobileOrder[]>("orders", ORDERS_FILE, []);
  list.unshift(order);
  persist("orders", ORDERS_FILE, list);
  memory.idem.push({ key, orderId: order.id, at: now });
  return order;
}

export function bearerToken(header: string | null) {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}
