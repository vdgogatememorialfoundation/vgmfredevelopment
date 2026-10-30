import { getAllAccounts, getSession, setSession } from "@/lib/auth";
import { noticeKeys } from "@/lib/cms";
import type { Announcement, Event, Notice, PartnerPaymentSummary, PartnerTicketSummary, User } from "@/types";

const EVENTS_CUSTOM = "vgmf_custom_events";
const ANN_CUSTOM = "vgmf_custom_announcements";
const TICKETS_KEY = "vgmf_partner_tickets";
const PAYMENTS_KEY = "vgmf_partner_payments";
const ACCOUNTS_KEY = "vgmf_accounts";
const APPLIED_KEY = "vgmf_partner_applied_at";

type PartnerFeed = {
  syncedAt?: string;
  events?: Event[];
  notices?: Notice[];
  announcements?: Announcement[];
  accounts?: User[];
  ticketsByEmail?: Record<string, PartnerTicketSummary[]>;
  paymentsByEmail?: Record<string, PartnerPaymentSummary[]>;
};

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
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[], partnerPrefix = /^(seminar|autism)-/) {
  const keep = current.filter((item) => !partnerPrefix.test(item.id));
  const map = new Map(keep.map((item) => [item.id, item]));
  for (const item of incoming) map.set(item.id, item);
  return [...map.values()];
}

function mergePortals(existing: User, incoming: User): User {
  const portals = [...(existing.partnerPortals ?? [])];
  for (const portal of incoming.partnerPortals ?? []) {
    const found = portals.find((item) => item.id === portal.id);
    if (found) Object.assign(found, portal);
    else portals.push(portal);
  }
  const protectedRole = existing.role === "admin" || existing.role === "coadmin" || existing.role === "staff";
  return {
    ...existing,
    partnerPortals: portals,
    role: protectedRole ? existing.role : incoming.partnerPortals?.length ? "customer" : existing.role || incoming.role || "customer",
    firstName: existing.firstName || incoming.firstName,
    lastName: existing.lastName || incoming.lastName,
    phone: existing.phone || incoming.phone,
    whatsapp: existing.whatsapp || incoming.whatsapp || incoming.phone,
    alternatePhone: existing.alternatePhone || incoming.alternatePhone,
    password: existing.password || incoming.password,
    partnerPasswordSet: Boolean(existing.partnerPasswordSet || incoming.partnerPasswordSet || existing.password || incoming.password),
  };
}

function applyAccounts(incoming: User[]) {
  if (!incoming.length) return;
  const current = getAllAccounts();
  const byEmail = new Map(current.map((account) => [account.email.toLowerCase(), account]));
  for (const account of incoming) {
    const key = account.email.toLowerCase();
    const existing = byEmail.get(key);
    const incomingRole =
      account.role === "admin" || account.role === "coadmin" || account.role === "staff" ? account.role : "customer";
    byEmail.set(key, existing ? mergePortals(existing, { ...account, role: incomingRole }) : { ...account, role: incomingRole });
  }
  writeJSON(ACCOUNTS_KEY, [...byEmail.values()]);
}

function applySession() {
  const session = getSession();
  if (!session?.email) return;
  const live = getAllAccounts().find((account) => account.email.toLowerCase() === session.email.toLowerCase());
  if (!live?.partnerPortals?.length) return;
  if (JSON.stringify(live.partnerPortals) === JSON.stringify(session.partnerPortals ?? [])) return;
  setSession({ ...session, partnerPortals: live.partnerPortals });
}

export function getPartnerTickets(email: string): PartnerTicketSummary[] {
  const all = readJSON<Record<string, PartnerTicketSummary[]>>(TICKETS_KEY, {});
  return all[email.toLowerCase()] ?? [];
}

export function getPartnerPayments(email: string): PartnerPaymentSummary[] {
  const all = readJSON<Record<string, PartnerPaymentSummary[]>>(PAYMENTS_KEY, {});
  return all[email.toLowerCase()] ?? [];
}

export function applyPartnerFeed(feed: PartnerFeed) {
  if (typeof window === "undefined") return;
  if (feed.events?.length) writeJSON(EVENTS_CUSTOM, mergeById(readJSON<Event[]>(EVENTS_CUSTOM, []), feed.events));
  if (feed.notices?.length) writeJSON(noticeKeys.custom, mergeById(readJSON<Notice[]>(noticeKeys.custom, []), feed.notices));
  if (feed.announcements?.length) writeJSON(ANN_CUSTOM, mergeById(readJSON<Announcement[]>(ANN_CUSTOM, []), feed.announcements));
  if (feed.ticketsByEmail) writeJSON(TICKETS_KEY, { ...readJSON(TICKETS_KEY, {}), ...feed.ticketsByEmail });
  if (feed.paymentsByEmail) writeJSON(PAYMENTS_KEY, { ...readJSON(PAYMENTS_KEY, {}), ...feed.paymentsByEmail });
  if (feed.accounts?.length) applyAccounts(feed.accounts);
  applySession();
  if (feed.syncedAt) writeJSON(APPLIED_KEY, feed.syncedAt);
  window.dispatchEvent(new Event("vgmf-cms"));
}

export async function hydratePartnerFeed(opts?: { full?: boolean }) {
  if (typeof window === "undefined") return;
  const full = opts?.full ?? (window.location.pathname.startsWith("/admin") || window.location.pathname.startsWith("/staff"));
  try {
    const feedRes = await fetch(`/api/partners/feed${full ? "?full=1" : ""}`, { cache: "no-store", credentials: "same-origin" });
    if (feedRes.ok) {
      const feed = (await feedRes.json()) as PartnerFeed & { ok?: boolean };
      applyPartnerFeed(feed);
    }
  } catch {
    /* public site still works without partner data */
  }
  try {
    const meRes = await fetch("/api/partners/me", { cache: "no-store", credentials: "same-origin" });
    if (!meRes.ok) return;
    const me = (await meRes.json()) as {
      account?: User | null;
      tickets?: PartnerTicketSummary[];
      payments?: PartnerPaymentSummary[];
      email?: string;
    };
    if (me.account) applyAccounts([me.account]);
    if (me.email && me.tickets) {
      const tickets = readJSON<Record<string, PartnerTicketSummary[]>>(TICKETS_KEY, {});
      tickets[me.email.toLowerCase()] = me.tickets;
      writeJSON(TICKETS_KEY, tickets);
    }
    if (me.email && me.payments) {
      const payments = readJSON<Record<string, PartnerPaymentSummary[]>>(PAYMENTS_KEY, {});
      payments[me.email.toLowerCase()] = me.payments;
      writeJSON(PAYMENTS_KEY, payments);
    }
    applySession();
    window.dispatchEvent(new Event("vgmf-cms"));
  } catch {
    /* ignore */
  }
}

export type PartnerLookupResult = {
  ok: boolean;
  found: boolean;
  account: User | null;
  tickets: PartnerTicketSummary[];
  payments: PartnerPaymentSummary[];
  passwordOk: boolean;
  passwordSet: boolean;
};

export async function lookupPartnerAccount(input: {
  identifier?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  password?: string;
}): Promise<PartnerLookupResult> {
  const empty: PartnerLookupResult = {
    ok: false,
    found: false,
    account: null,
    tickets: [],
    payments: [],
    passwordOk: false,
    passwordSet: false,
  };
  try {
    const response = await fetch("/api/partners/lookup", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await response.json()) as PartnerLookupResult;
    if (!response.ok) return empty;
    if (data.account) {
      const hydrated: User = {
        ...data.account,
        role:
          data.account.role === "admin" || data.account.role === "coadmin" || data.account.role === "staff"
            ? data.account.role
            : "customer",
        password: input.password && data.passwordOk ? input.password : data.account.password,
        partnerPasswordSet: data.passwordSet || data.account.partnerPasswordSet,
      };
      applyAccounts([hydrated]);
    }
    if (data.account?.email) {
      const email = data.account.email.toLowerCase();
      if (data.tickets) {
        const tickets = readJSON<Record<string, PartnerTicketSummary[]>>(TICKETS_KEY, {});
        tickets[email] = data.tickets;
        writeJSON(TICKETS_KEY, tickets);
      }
      if (data.payments) {
        const payments = readJSON<Record<string, PartnerPaymentSummary[]>>(PAYMENTS_KEY, {});
        payments[email] = data.payments;
        writeJSON(PAYMENTS_KEY, payments);
      }
    }
    applySession();
    if (typeof window !== "undefined") window.dispatchEvent(new Event("vgmf-cms"));
    return { ...empty, ...data, ok: true };
  } catch {
    return empty;
  }
}

export async function syncPartnerPortalsNow() {
  const response = await fetch("/api/partners/sync", { method: "POST", credentials: "same-origin" });
  const data = (await response.json()) as { ok: boolean; error?: string; syncedAt?: string; stats?: unknown; accounts?: number; events?: number; notices?: number };
  if (!response.ok || !data.ok) throw new Error(data.error || "Could not sync sister portals.");
  await hydratePartnerFeed({ full: true });
  return data;
}
