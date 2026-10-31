import { getAllAccounts, getSession, isSignedOut, setSession } from "@/lib/auth";
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

function mergeById<T extends { id: string }>(current: T[], incoming: T[], partnerPrefix = /^(seminar|autism|fellowship)-/) {
  const keep = current.filter((item) => !partnerPrefix.test(item.id));
  const map = new Map(keep.map((item) => [item.id, item]));
  for (const item of incoming) map.set(item.id, item);
  return [...map.values()];
}

export const SISTER_PASSWORD_HINT =
  "Seminar, Autism and Fellowship passwords are not used on this website. Use Forgot password to set a new password for the Foundation site.";

export function hasFoundationPassword(account: Pick<User, "password" | "foundationPasswordSet" | "partnerPortals" | "role"> | null | undefined) {
  if (!account) return false;
  if (account.role === "admin" || account.role === "coadmin" || account.role === "staff") return Boolean(account.password);
  if (account.foundationPasswordSet && account.password) return true;
  if (account.partnerPortals?.length) return false;
  return Boolean(account.password);
}

function scrubSisterLogin(account: User): User {
  const protectedRole = account.role === "admin" || account.role === "coadmin" || account.role === "staff";
  if (protectedRole) return account;
  if (!account.partnerPortals?.length) return account;
  if (account.foundationPasswordSet) return { ...account, partnerPasswordSet: false };
  return { ...account, password: undefined, partnerPasswordSet: false };
}

function mergePortals(existing: User, incoming: User): User {
  const portals = [...(existing.partnerPortals ?? [])];
  for (const portal of incoming.partnerPortals ?? []) {
    const found = portals.find((item) => item.id === portal.id);
    if (found) Object.assign(found, portal);
    else portals.push(portal);
  }
  const protectedRole = existing.role === "admin" || existing.role === "coadmin" || existing.role === "staff";
  const keepPassword =
    protectedRole ||
    Boolean(existing.foundationPasswordSet) ||
    Boolean(existing.password && !existing.partnerPortals?.length);
  return {
    ...existing,
    partnerPortals: portals,
    role: protectedRole ? existing.role : incoming.partnerPortals?.length ? "customer" : existing.role || incoming.role || "customer",
    firstName: existing.firstName || incoming.firstName,
    lastName: existing.lastName || incoming.lastName,
    phone: existing.phone || incoming.phone,
    whatsapp: existing.whatsapp || incoming.whatsapp || incoming.phone,
    alternatePhone: existing.alternatePhone || incoming.alternatePhone,
    password: keepPassword ? existing.password : undefined,
    foundationPasswordSet: Boolean(existing.foundationPasswordSet || (keepPassword && existing.password)),
    partnerPasswordSet: false,
  };
}

function applyAccounts(incoming: User[]) {
  if (!incoming.length) return;
  const current = getAllAccounts();
  const byEmail = new Map(current.map((account) => [account.email.toLowerCase(), account]));
  for (const account of incoming) {
    const key = account.email.toLowerCase();
    const existing = byEmail.get(key);
    const incomingRole: User["role"] =
      account.role === "admin" || account.role === "coadmin" || account.role === "staff" ? account.role : "customer";
    const incomingClean: User = { ...account, role: incomingRole, password: undefined, partnerPasswordSet: false };
    byEmail.set(key, existing ? mergePortals(existing, incomingClean) : incomingClean);
  }
  writeJSON(ACCOUNTS_KEY, [...byEmail.values()].map(scrubSisterLogin));
}

function applySession() {
  if (isSignedOut()) return;
  const session = getSession();
  if (!session?.email) return;
  const live = getAllAccounts().find((account) => account.email.toLowerCase() === session.email.toLowerCase());
  if (!live?.partnerPortals?.length) return;
  if (JSON.stringify(live.partnerPortals) === JSON.stringify(session.partnerPortals ?? [])) return;
  setSession({ ...session, partnerPortals: live.partnerPortals });
}

function mergeEmailMaps<T extends { id: string }>(current: Record<string, T[]>, incoming: Record<string, T[]>) {
  const next = { ...current };
  for (const [email, rows] of Object.entries(incoming)) {
    const key = email.toLowerCase();
    const map = new Map((next[key] ?? []).map((row) => [row.id, row]));
    for (const row of rows) map.set(row.id, row);
    next[key] = [...map.values()];
  }
  return next;
}

export function listStoredPartnerTickets(): Record<string, PartnerTicketSummary[]> {
  return readJSON<Record<string, PartnerTicketSummary[]>>(TICKETS_KEY, {});
}

export function getPartnerTickets(email: string): PartnerTicketSummary[] {
  return listStoredPartnerTickets()[email.toLowerCase()] ?? [];
}

export function getPartnerPayments(email: string): PartnerPaymentSummary[] {
  const all = readJSON<Record<string, PartnerPaymentSummary[]>>(PAYMENTS_KEY, {});
  return all[email.toLowerCase()] ?? [];
}

export function applyPartnerFeed(feed: PartnerFeed) {
  if (typeof window === "undefined") return;
  if (feed.events?.length) {
    const incoming = feed.events.filter(
      (event) => event.source !== "fellowship" && event.eventType !== "Fellowship" && !String(event.id).startsWith("fellowship-")
    );
    const current = readJSON<Event[]>(EVENTS_CUSTOM, []).filter(
      (event) => event.source !== "fellowship" && event.eventType !== "Fellowship" && !String(event.id).startsWith("fellowship-")
    );
    writeJSON(EVENTS_CUSTOM, mergeById(current, incoming));
  }
  if (feed.notices?.length) writeJSON(noticeKeys.custom, mergeById(readJSON<Notice[]>(noticeKeys.custom, []), feed.notices));
  if (feed.announcements?.length) writeJSON(ANN_CUSTOM, mergeById(readJSON<Announcement[]>(ANN_CUSTOM, []), feed.announcements));
  if (feed.ticketsByEmail) writeJSON(TICKETS_KEY, mergeEmailMaps(readJSON(TICKETS_KEY, {}), feed.ticketsByEmail));
  if (feed.paymentsByEmail) writeJSON(PAYMENTS_KEY, mergeEmailMaps(readJSON(PAYMENTS_KEY, {}), feed.paymentsByEmail));
  if (feed.accounts?.length) applyAccounts(feed.accounts);
  applySession();
  if (feed.syncedAt) writeJSON(APPLIED_KEY, feed.syncedAt);
  window.dispatchEvent(new Event("vgmf-cms"));
}

export async function hydratePartnerFeed(opts?: { full?: boolean; force?: boolean }) {
  if (typeof window === "undefined") return;
  const signedOut = isSignedOut();
  const session = signedOut ? null : getSession();
  const email = session?.email?.trim().toLowerCase() || "";
  const last = Number(window.sessionStorage.getItem("vgmf_partner_hydrated_at") || 0);
  const lastEmail = window.sessionStorage.getItem("vgmf_partner_hydrated_email") || "";
  if (!opts?.force && last && lastEmail === email && Date.now() - last < 5 * 60 * 1000) return;
  window.sessionStorage.setItem("vgmf_partner_hydrated_at", String(Date.now()));
  window.sessionStorage.setItem("vgmf_partner_hydrated_email", email);
  try {
    const feedRes = await fetch("/api/partners/feed", { cache: "no-store", credentials: "same-origin" });
    if (feedRes.ok) {
      const feed = (await feedRes.json()) as PartnerFeed & { ok?: boolean };
      applyPartnerFeed(feed);
    }
  } catch {
    /* public site still works without partner data */
  }
  if (signedOut) return;
  if (email) {
    await lookupPartnerAccount({ email, phone: session?.phone, identifier: email });
    return;
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
        password: undefined,
        partnerPasswordSet: false,
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

export async function refreshPartnerAccount(input: { email?: string; phone?: string }) {
  if (!input.email && !input.phone) return;
  return lookupPartnerAccount({
    identifier: input.email || input.phone,
    email: input.email,
    phone: input.phone,
  });
}

export async function syncPartnerPortalsNow() {
  const response = await fetch("/api/partners/sync", { method: "POST", credentials: "same-origin" });
  const data = (await response.json()) as { ok: boolean; error?: string; syncedAt?: string; stats?: unknown; accounts?: number; events?: number; notices?: number };
  if (!response.ok || !data.ok) throw new Error(data.error || "Could not sync sister portals.");
  await hydratePartnerFeed({ full: true });
  return data;
}
