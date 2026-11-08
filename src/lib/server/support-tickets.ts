import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { dataFile } from "@/lib/server/paths";
import { mergeTickets } from "@/lib/ticket-merge";
import type { SupportTicket } from "@/types";

/** One server-side ticket store shared by the website, the support desk and the Android app. */
const LEGACY_FILE = join("/tmp", "vgmf-mobile-tickets.json");
const STATUSES: SupportTicket["status"][] = ["Open", "In Progress", "Resolved", "Closed"];
let cache: SupportTicket[] | null = null;

const file = () => dataFile("support-tickets.json");
const cut = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

function readList(path: string): Partial<SupportTicket>[] {
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function normalizeTicket(ticket: Partial<SupportTicket>): SupportTicket {
  const now = new Date().toISOString();
  const createdAt = cut(ticket.createdAt, 40) || now;
  return {
    id: cut(ticket.id, 40),
    name: cut(ticket.name, 80) || "Guest",
    email: cut(ticket.email, 160).toLowerCase(),
    phone: cut(ticket.phone, 30) || undefined,
    subject: cut(ticket.subject, 200),
    body: cut(ticket.body, 5000),
    status: STATUSES.includes(ticket.status as SupportTicket["status"]) ? (ticket.status as SupportTicket["status"]) : "Open",
    createdAt,
    updatedAt: cut(ticket.updatedAt, 40) || createdAt,
    portal: ticket.portal,
    assignedTo: cut(ticket.assignedTo, 160) || undefined,
    userId: cut(ticket.userId, 80) || undefined,
    chatThreadId: cut(ticket.chatThreadId, 80) || undefined,
    responses: (Array.isArray(ticket.responses) ? ticket.responses : [])
      .slice(-300)
      .map((reply) => ({ at: cut(reply?.at, 40) || now, from: cut(reply?.from, 80) || "Customer", text: cut(reply?.text, 5000) }))
      .filter((reply) => reply.text),
  };
}

function load() {
  if (cache) return cache;
  const list = readList(file()).map(normalizeTicket);
  for (const legacy of readList(LEGACY_FILE)) {
    if (legacy?.id && !list.some((ticket) => ticket.id === legacy.id)) list.push(normalizeTicket({ portal: "customer", ...legacy }));
  }
  cache = list;
  return list;
}

function save(list: SupportTicket[]) {
  cache = list;
  mkdirSync(dirname(file()), { recursive: true });
  writeFileSync(file(), JSON.stringify(list));
}

export function allTickets() {
  return [...load()].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export function findTicket(id: string) {
  return load().find((ticket) => ticket.id === id);
}

export function ticketsFor(email: string, userId?: string) {
  const normalized = email.trim().toLowerCase();
  return allTickets().filter((ticket) => (normalized && ticket.email === normalized) || (userId && ticket.userId === userId));
}

export function ownsTicket(ticket: SupportTicket, email: string, userId?: string) {
  return Boolean((email && ticket.email === email.trim().toLowerCase()) || (userId && ticket.userId === userId));
}

export function saveTicket(input: Partial<SupportTicket>) {
  const incoming = normalizeTicket(input);
  if (!incoming.id) throw new Error("Ticket id missing.");
  const list = load();
  const index = list.findIndex((ticket) => ticket.id === incoming.id);
  const merged = mergeTickets(index >= 0 ? list[index] : undefined, incoming);
  const next = [...list];
  if (index >= 0) next[index] = merged;
  else next.unshift(merged);
  save(next);
  return merged;
}

export function replyToTicket(id: string, from: string, text: string) {
  const ticket = findTicket(id);
  if (!ticket) return null;
  const at = new Date().toISOString();
  const reopen = ticket.status === "Resolved" || ticket.status === "Closed";
  return saveTicket({ ...ticket, status: reopen ? "Open" : ticket.status, updatedAt: at, responses: [...ticket.responses, { at, from, text }] });
}
