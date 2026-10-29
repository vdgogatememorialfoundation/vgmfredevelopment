import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";

const OTP_FILE = join("/tmp", "vgmf-mobile-otp.json");
const TICKETS_FILE = join("/tmp", "vgmf-mobile-tickets.json");
const ORDERS_FILE = join("/tmp", "vgmf-mobile-orders.json");
const SESSIONS_FILE = join("/tmp", "vgmf-mobile-sessions.json");

const OTP_RESEND_MS = 60 * 1000;

type OtpRecord = { email: string; code: string; expiresAt: number; sentAt: number };
export type MobileSession = { token: string; email: string; name: string; createdAt: string };
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
  status: string;
  createdAt: string;
};

function read<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function write(file: string, value: unknown) {
  try {
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, JSON.stringify(value));
  } catch {
    /* ephemeral */
  }
}

export function issueMobileOtp(email: string): { code?: string; error?: string } {
  const normalized = email.trim().toLowerCase();
  const list = read<OtpRecord[]>(OTP_FILE, []);
  const existing = list.find((item) => item.email === normalized);
  if (existing && Date.now() - existing.sentAt < OTP_RESEND_MS) {
    const wait = Math.ceil((OTP_RESEND_MS - (Date.now() - existing.sentAt)) / 1000);
    return { error: `Wait ${wait} seconds before requesting another email code.` };
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const next = list.filter((item) => item.email !== normalized);
  next.push({ email: normalized, code, expiresAt: Date.now() + 10 * 60 * 1000, sentAt: Date.now() });
  write(OTP_FILE, next);
  return { code };
}

export function clearMobileOtp(email: string) {
  write(
    OTP_FILE,
    read<OtpRecord[]>(OTP_FILE, []).filter((item) => item.email !== email.trim().toLowerCase())
  );
}

export function verifyMobileOtp(email: string, code: string) {
  const record = read<OtpRecord[]>(OTP_FILE, []).find((item) => item.email === email.trim().toLowerCase());
  if (!record) return "No code has been sent.";
  if (Date.now() > record.expiresAt) return "That code has expired.";
  if (record.code !== code.trim()) return "Incorrect code.";
  write(
    OTP_FILE,
    read<OtpRecord[]>(OTP_FILE, []).filter((item) => item.email !== email.trim().toLowerCase())
  );
  return null;
}

export function createMobileSession(email: string, name = "") {
  const session: MobileSession = {
    token: randomBytes(24).toString("hex"),
    email: email.trim().toLowerCase(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };
  const list = read<MobileSession[]>(SESSIONS_FILE, []).filter((item) => item.email !== session.email);
  list.push(session);
  write(SESSIONS_FILE, list);
  return session;
}

export function sessionFromToken(token?: string | null) {
  if (!token) return null;
  return read<MobileSession[]>(SESSIONS_FILE, []).find((item) => item.token === token) ?? null;
}

export function listTickets(email?: string) {
  const all = read<MobileTicket[]>(TICKETS_FILE, []);
  if (!email) return all;
  return all.filter((ticket) => ticket.email.toLowerCase() === email.trim().toLowerCase());
}

export function addTicket(input: { name: string; email: string; phone?: string; subject: string; body: string }) {
  const now = new Date().toISOString();
  const ticket: MobileTicket = {
    id: String(Math.floor(100000000000 + Math.random() * 900000000000)),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone,
    subject: input.subject.trim(),
    body: input.body.trim(),
    status: "Open",
    createdAt: now,
    responses: [],
  };
  const list = listTickets();
  list.unshift(ticket);
  write(TICKETS_FILE, list);
  return ticket;
}

export function listOrders(email?: string) {
  const all = read<MobileOrder[]>(ORDERS_FILE, []);
  if (!email) return all;
  return all.filter((order) => order.email.toLowerCase() === email.trim().toLowerCase());
}

export function addOrder(input: Omit<MobileOrder, "id" | "createdAt" | "status"> & { status?: string }) {
  const order: MobileOrder = {
    ...input,
    email: input.email.trim().toLowerCase(),
    id: String(Math.floor(100000000000 + Math.random() * 900000000000)),
    status: input.status ?? "Ordered",
    createdAt: new Date().toISOString(),
  };
  const list = listOrders();
  list.unshift(order);
  write(ORDERS_FILE, list);
  return order;
}

export function bearerToken(header: string | null) {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}
