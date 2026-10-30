import { createHash } from "node:crypto";
import { Pool } from "pg";
import { accountMatchesIdentifier } from "@/lib/account-identity";
import { upsertNotice } from "@/lib/server/notices";
import { partnerCategory, partnerPortalHref, partnerPortalIds, partnerTicketHref, portalBadge } from "@/lib/partner-labels";
import { AUTISM_ORIGIN, FELLOWSHIP_ORIGIN, SEMINAR_ORIGIN, asList, asRecord, textField } from "@/lib/partner-certificates";
import { partnerForKey, readApiKey } from "@/lib/partner-keys";
import type {
  Announcement,
  Event,
  EventMode,
  EventType,
  Notice,
  PartnerPaymentSummary,
  PartnerPortalId,
  PartnerTicketSummary,
  RegistrationStatus,
  User,
} from "@/types";

const FETCH_MS = 6000;
const STALE_MS = 10 * 60 * 1000;
const PRIVATE = /^(email|e-mail|phone|mobile|whatsapp|token|qrtoken|qr|otp|password|secret|authorization|qr_code|qrcode|provider_transaction|provider_order|razorpay|metadata_json|form_data)/i;

export type SanitizedPartnerAccount = User & { sourceId: string };

export type PartnerStats = {
  events: number;
  notices: number;
  accounts: number;
  tickets: number;
  payments: number;
  source: "database" | "public-api" | "none";
};

export type PartnerSnapshot = {
  syncedAt: string;
  events: Event[];
  notices: Notice[];
  announcements: Announcement[];
  accounts: SanitizedPartnerAccount[];
  ticketsByEmail: Record<string, PartnerTicketSummary[]>;
  paymentsByEmail: Record<string, PartnerPaymentSummary[]>;
  stats: Record<PartnerPortalId, PartnerStats>;
  /** bcrypt / hex hashes keyed as `portal:email`. Never sent to the browser. */
  passwordHashes?: Record<string, string>;
};

const emptyStats = (source: PartnerStats["source"] = "none"): PartnerStats => ({
  events: 0,
  notices: 0,
  accounts: 0,
  tickets: 0,
  payments: 0,
  source,
});

export function emptySnapshot(): PartnerSnapshot {
  return {
    syncedAt: "",
    events: [],
    notices: [],
    announcements: [],
    accounts: [],
    ticketsByEmail: {},
    paymentsByEmail: {},
    stats: { seminar: emptyStats(), autism: emptyStats(), fellowship: emptyStats() },
    passwordHashes: {},
  };
}

export function clientPartnerSnapshot(snapshot: PartnerSnapshot, opts?: { includePasswords?: boolean }) {
  return {
    syncedAt: snapshot.syncedAt,
    events: snapshot.events,
    notices: snapshot.notices,
    announcements: snapshot.announcements,
    accounts: snapshot.accounts.map((account) => sanitizeAccountForClient(account, opts)),
    ticketsByEmail: snapshot.ticketsByEmail,
    paymentsByEmail: snapshot.paymentsByEmail,
    stats: snapshot.stats,
  };
}

export function sanitizeAccountForClient(account: SanitizedPartnerAccount, opts?: { includePasswords?: boolean }) {
  void opts;
  return {
    ...account,
    password: undefined,
    partnerPasswordSet: false,
    foundationPasswordSet: Boolean(account.foundationPasswordSet),
  };
}

const pools = new Map<PartnerPortalId, Pool>();

function dbUrl(portal: PartnerPortalId) {
  const key =
    portal === "seminar" ? "SEMINAR_DATABASE_URL" : portal === "autism" ? "AUTISM_DATABASE_URL" : "FELLOWSHIP_DATABASE_URL";
  return (process.env[key] || "").trim();
}

function anyDbConfigured() {
  return partnerPortalIds.some((portal) => Boolean(dbUrl(portal)));
}

function poolFor(portal: PartnerPortalId) {
  const url = dbUrl(portal);
  if (!url) return null;
  const existing = pools.get(portal);
  if (existing) return existing;
  const pool = new Pool({ connectionString: url, max: 2, idleTimeoutMillis: 10_000 });
  pools.set(portal, pool);
  return pool;
}

function originFor(portal: PartnerPortalId) {
  if (portal === "seminar") return SEMINAR_ORIGIN;
  if (portal === "autism") return AUTISM_ORIGIN;
  return FELLOWSHIP_ORIGIN;
}

function slugify(value: string) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return slug || `item-${Date.now()}`;
}

function iso(value: unknown) {
  if (!value) return "";
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  const text = String(value).trim();
  if (!text) return "";
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : text;
}

function dateOnly(value?: unknown) {
  const stamp = iso(value);
  return stamp ? stamp.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function asNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function str(row: Record<string, unknown>, keys: string[], fallback = "") {
  return textField(row, keys) || fallback;
}

function mediaUrl(origin: string, path: unknown) {
  const value = String(path || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  return `${origin}${value.startsWith("/") ? "" : "/"}${value}`;
}

function accountIdFor(portal: PartnerPortalId, sourceId: string, existing?: string) {
  const given = (existing || "").replace(/\D/g, "");
  if (given.length === 12) return given;
  const digest = createHash("sha256").update(`${portal}:${sourceId}`).digest("hex");
  let digits = "";
  for (const ch of digest) {
    if (/\d/.test(ch)) digits += ch;
    if (digits.length === 12) break;
  }
  return (digits + "000000000000").slice(0, 12);
}

function skipStaff(role: string, userRole: string) {
  const values = `${role} ${userRole}`.toLowerCase();
  return ["admin", "co_admin", "coadmin", "staff", "scanner_portal_user", "judge_user", "committee"].some((item) => values.includes(item));
}

function splitPersonName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function registrationStatus(start?: string, end?: string, enabled = true): RegistrationStatus {
  if (!enabled) return "Closed";
  const now = Date.now();
  const opens = start ? Date.parse(start) : NaN;
  const closes = end ? Date.parse(end) : NaN;
  if (Number.isFinite(opens) && opens > now) return "Open";
  if (Number.isFinite(closes) && closes <= now) return "Closed";
  if (Number.isFinite(closes) && closes - now < 3 * 24 * 60 * 60 * 1000) return "Closing Soon";
  return "Open";
}

function mapMode(value: string): EventMode {
  const text = value.toLowerCase();
  if (text.includes("online") || text.includes("webinar")) return "Online";
  if (text.includes("hybrid")) return "Hybrid";
  return "Offline";
}

function mapEventType(portal: PartnerPortalId, title: string): EventType {
  const text = title.toLowerCase();
  if (text.includes("workshop")) return "Workshop";
  if (text.includes("webinar")) return "Webinar";
  if (portal === "fellowship" || text.includes("fellowship")) return "Fellowship";
  if (portal === "autism") return "Other Foundation Events";
  return "Seminar";
}

function publicFeed(snapshot: PartnerSnapshot) {
  return {
    syncedAt: snapshot.syncedAt,
    events: snapshot.events,
    notices: snapshot.notices,
    announcements: snapshot.announcements,
    stats: snapshot.stats,
  };
}

export function publicPartnerFeed(snapshot: PartnerSnapshot) {
  return publicFeed(snapshot);
}

function stripPrivate(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPrivate);
  if (!value || typeof value !== "object") return value;
  const next: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (PRIVATE.test(key) || /qr/i.test(key)) continue;
    next[key] = stripPrivate(nested);
  }
  return next;
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type ScheduleRow = {
  id: number;
  title?: string;
  description?: string | null;
  seminar_id?: number;
  start_time?: string;
  end_time?: string;
  location?: string | null;
  speaker_name?: string | null;
  speaker_bio?: string | null;
  seminar_title?: string;
};

function eventFromSeminar(
  portal: PartnerPortalId,
  seminar: Record<string, unknown>,
  sessions: ScheduleRow[]
): Event {
  const origin = originFor(portal);
  const idNum = String(seminar.id ?? seminar.seminar_id ?? "0");
  const title = str(seminar, ["title", "seminar_title", "name"], portal === "seminar" ? "Seminar" : portal === "fellowship" ? "Fellowship" : "Programme");
  const slug = str(seminar, ["event_slug"]) || slugify(`${portal}-${title}-${idNum}`);
  const start = iso(seminar.event_date) || iso(sessions[0]?.start_time);
  const end = iso(seminar.event_end_date) || iso(sessions[sessions.length - 1]?.end_time) || start;
  const registrationStart = iso(seminar.registration_start) || iso(seminar.preregistration_start);
  const registrationEnd = iso(seminar.registration_end) || iso(seminar.preregistration_end);
  const venue = str(seminar, ["location_text", "venue", "location"]) || String(sessions[0]?.location || "").trim();
  const city = venue.toLowerCase().includes("pune") ? "Pune" : "";
  const speakers = sessions
    .filter((row) => row.speaker_name && !/break|lunch|tea|registration|vote of thanks|programme ends/i.test(row.speaker_name || ""))
    .map((row) => ({
      id: `${portal}-spk-${row.id}`,
      name: row.speaker_name || "",
      designation: "",
      topic: row.title || "",
    }));
  const schedule = sessions.map((row) => ({
    id: `${portal}-sch-${row.id}`,
    time: iso(row.start_time),
    title: [row.speaker_name, row.title].filter(Boolean).join(" — ") || "Session",
    description: row.description || undefined,
  }));
  const enabled = seminar.registration_enabled == null ? true : Boolean(asNumber(seminar.registration_enabled) || seminar.registration_enabled === true);
  return {
    id: `${portal}-${idNum}`,
    name: title,
    slug,
    shortDescription: str(seminar, ["description"]).slice(0, 240) || `${title} on the ${partnerCategory(portal)} portal.`,
    description: str(seminar, ["description"]) || str(seminar, ["terms_conditions"]),
    bannerUrl: mediaUrl(origin, seminar.hero_image_path || seminar.flyer_path),
    startDate: start || dateOnly(),
    endDate: end || start || dateOnly(),
    venue: venue || undefined,
    city: city || undefined,
    mode: mapMode(str(seminar, ["delivery_mode", "mode"])),
    eventType: mapEventType(portal, title),
    registrationStart: registrationStart || start || dateOnly(),
    registrationEnd: registrationEnd || end || dateOnly(),
    fee: asNumber(seminar.price),
    currency: "INR",
    capacity: asNumber(seminar.capacity) || undefined,
    registrationStatus: registrationStatus(registrationStart || start, registrationEnd || end, enabled),
    speakers,
    schedule,
    mapsUrl: str(seminar, ["location_url"]) || undefined,
    registrationUrl: origin,
    source: portal,
    sourceUrl: origin,
    tbd: {
      venue: !venue,
      city: !city,
      registration: false,
      fee: !asNumber(seminar.price),
    },
  };
}

function eventsFromSchedules(portal: PartnerPortalId, rows: ScheduleRow[]): Event[] {
  const grouped = new Map<string, ScheduleRow[]>();
  for (const row of rows) {
    const key = String(row.seminar_id || row.seminar_title || row.id);
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }
  return [...grouped.entries()].map(([key, sessions]) => {
    const first = sessions[0];
    return eventFromSeminar(
      portal,
      {
        id: first.seminar_id || key,
        title: first.seminar_title || first.title,
        event_date: first.start_time,
        event_end_date: sessions[sessions.length - 1]?.end_time,
        location_text: first.location,
      },
      sessions
    );
  });
}

function noticesFromPublic(portal: PartnerPortalId, payload: unknown): { notices: Notice[]; announcements: Announcement[] } {
  const origin = originFor(portal);
  const record = asRecord(payload) ?? {};
  const notices: Notice[] = [];
  const announcements: Announcement[] = [];
  const publicNotices = Array.isArray(record.publicNotices) ? record.publicNotices : [];
  publicNotices.forEach((item, index) => {
    const row = asRecord(item) ?? {};
    const title = str(row, ["title", "heading"], "Notice");
    const body = str(row, ["body", "description", "text"], title);
    const pdf = str(row, ["pdf", "file", "href"]);
    const id = `${portal}-notice-${index}-${slugify(title)}`;
    notices.push({
      id,
      title,
      date: dateOnly(record.updatedAt),
      category: partnerCategory(portal),
      description: body,
      href: pdf ? mediaUrl(origin, pdf) : `${origin}/#notices`,
      attachment: pdf ? mediaUrl(origin, pdf) : undefined,
    });
  });
  const scrolling = Array.isArray(record.scrollingAnnouncements) ? record.scrollingAnnouncements : [];
  scrolling.forEach((item, index) => {
    const row = asRecord(item) ?? {};
    if (row.enabled === false) return;
    const body = str(row, ["body", "title", "text"]);
    if (!body) return;
    announcements.push({
      id: `${portal}-ann-${index}-${slugify(body).slice(0, 24)}`,
      title: body,
      description: body,
      date: dateOnly(record.updatedAt),
      category: partnerCategory(portal),
      href: origin,
      priority: "high",
    });
  });
  const ticker = str(record, ["ticker", "tickerText"]);
  if (ticker) {
    announcements.unshift({
      id: `${portal}-ticker`,
      title: ticker,
      description: ticker,
      date: dateOnly(record.updatedAt),
      category: partnerCategory(portal),
      href: origin,
      priority: "high",
    });
  }
  return { notices, announcements };
}

async function pullPublic(portal: PartnerPortalId) {
  if (portal === "fellowship") return { events: [] as Event[], notices: [] as Notice[], announcements: [] as Announcement[] };
  const origin = originFor(portal);
  const [schedules, announcements, seminars, vgmfFeed] = await Promise.all([
    fetchJson(`${origin}/api/event-schedules`),
    fetchJson(`${origin}/api/public/announcements`),
    fetchJson(`${origin}/api/public/certificate-verify/seminars`),
    fetchJson(`${origin}/api/public/vgmf-feed`),
  ]);
  const feed = asRecord(vgmfFeed);
  const sessionRows = (
    Array.isArray(schedules) ? schedules : asList((feed?.schedules as unknown) ?? schedules ?? {})
  ) as ScheduleRow[];
  let events = eventsFromSchedules(portal, sessionRows);
  const seminarList = asList(seminars ?? {});
  if (seminarList.length) {
    const byId = new Map(events.map((event) => [event.id, event]));
    for (const item of seminarList) {
      const row = asRecord(item) ?? {};
      const mapped = eventFromSeminar(
        portal,
        {
          id: row.id,
          title: row.title,
          event_date: row.eventDate || row.event_date,
          location_text: row.venue,
        },
        sessionRows.filter((session) => String(session.seminar_id) === String(row.id))
      );
      byId.set(mapped.id, { ...byId.get(mapped.id), ...mapped, schedule: byId.get(mapped.id)?.schedule || mapped.schedule });
    }
    events = [...byId.values()];
  }
  const copied = noticesFromPublic(portal, announcements);
  return { events, ...copied };
}

async function queryRows(portal: PartnerPortalId, sql: string, params: unknown[] = []) {
  const pool = poolFor(portal);
  if (!pool) return null;
  try {
    const result = await pool.query(sql, params);
    return result.rows as Record<string, unknown>[];
  } catch {
    return null;
  }
}

function mapAccount(portal: PartnerPortalId, row: Record<string, unknown>, extras: {
  hasTicket?: boolean;
  ticketCount?: number;
  paymentCount?: number;
  hasProfile?: boolean;
}): { account: SanitizedPartnerAccount; passwordHash?: string } | null {
  const email = str(row, ["email"]).toLowerCase();
  if (!email || !email.includes("@")) return null;
  const roleRaw = str(row, ["role"]);
  const userRole = str(row, ["user_role"]);
  if (skipStaff(roleRaw, userRole)) return null;
  const sourceId = String(row.id ?? email);
  const doctor = portal === "seminar" || extras.hasProfile || /doctor/i.test(`${roleRaw} ${userRole}`);
  const disabled = asNumber(row.is_disabled) === 1 || asNumber(row.is_banned) === 1;
  const phone = str(row, ["phone", "contact_number", "mobile"]);
  const named = splitPersonName(str(row, ["full_name", "name"]));
  const firstName = str(row, ["first_name", "firstName"]) || named.first || "Member";
  const lastName = str(row, ["last_name", "lastName"]) || named.last;
  const alternatePhone = str(row, ["alternate_phone", "alternatePhone", "alternate_mobile", "whatsapp"]) || phone;
  const portalRole = portal === "seminar" ? (doctor ? "doctor" : "registrant") : portal === "fellowship" ? "applicant" : "applicant";
  return {
    account: {
      id: `${portal}-usr-${sourceId}`,
      sourceId,
      firstName,
      middleName: str(row, ["middle_name"]) || undefined,
      lastName,
      email,
      phone,
      whatsapp: str(row, ["whatsapp"]) || phone,
      alternatePhone,
      accountId: accountIdFor(portal, sourceId, str(row, ["user_id_string", "user_id"])),
      role: "customer",
      password: undefined,
      partnerPasswordSet: false,
      foundationPasswordSet: false,
      status: disabled ? "disabled" : "active",
      statusReason: disabled ? str(row, ["ban_reason"]) || undefined : undefined,
      createdAt: iso(row.created_at) || undefined,
      createdBy: `${portal}-sync`,
      partnerPortals: [
        portalBadge(portal, {
          hasTicket: Boolean(extras.hasTicket),
          ticketCount: extras.ticketCount,
          paymentCount: extras.paymentCount,
          role: portalRole,
        }),
      ],
    },
    passwordHash: undefined,
  };
}

function noticeFromRow(portal: PartnerPortalId, row: Record<string, unknown>, index = 0): Notice {
  const origin = originFor(portal);
  const title = str(row, ["title", "heading", "message"], "Notice");
  const body = str(row, ["content", "description", "body", "message"], title);
  const pdf = str(row, ["pdf_path", "attachment", "link_url"]);
  const id = str(row, ["id"]) || `${portal}-notice-${index}-${slugify(title)}`;
  return {
    id: `${portal}-notice-${id}`,
    title,
    date: dateOnly(row.published_at || row.created_at),
    category: str(row, ["category"]) && !["GENERAL", "EVENT"].includes(str(row, ["category"]))
      ? str(row, ["category"])
      : partnerCategory(portal),
    description: body,
    href: pdf ? mediaUrl(origin, pdf) : `${origin}/#notices`,
    attachment: pdf ? mediaUrl(origin, pdf) : undefined,
  };
}

async function pullNoticesDatabase(portal: PartnerPortalId): Promise<{ notices: Notice[]; announcements: Announcement[] }> {
  const origin = originFor(portal);
  const notices: Notice[] = [];
  const announcements: Announcement[] = [];
  const sql =
    portal === "fellowship"
      ? `SELECT id, title, content, category::text AS category, link_url, attachment_file_name, is_active, published_at, created_at
           FROM notices
          WHERE coalesce(is_active, true) = true
          ORDER BY published_at DESC NULLS LAST, created_at DESC`
      : portal === "autism"
        ? `SELECT id, message, pdf_path, created_at FROM notices ORDER BY created_at DESC`
        : `SELECT id, title, content, pdf_path, created_at FROM notices ORDER BY created_at DESC`;
  const rows = (await queryRows(portal, sql)) ?? [];
  rows.forEach((row, index) => {
    const notice = noticeFromRow(portal, row, index);
    notices.push(notice);
    if (notice.description) {
      announcements.push({
        id: `${portal}-ann-db-${notice.id}`,
        title: notice.title,
        description: notice.description,
        date: notice.date,
        category: partnerCategory(portal),
        href: origin,
        priority: "high",
      });
    }
  });
  return { notices, announcements };
}

function fellowshipProgrammeEvent(settings: Record<string, unknown>, notices: Notice[]): Event {
  const origin = originFor("fellowship");
  const title = str(settings, ["hero_title", "site_name"], "Vaidya Gogate Memorial Foundation Research Fellowship 2026");
  const description = str(settings, ["about_content", "site_tagline", "hero_subtitle"]) || notices.map((item) => item.title).join(" · ");
  const signup = settings.signup_enabled == null ? true : Boolean(settings.signup_enabled);
  const start = dateOnly(notices[0]?.date) || dateOnly(settings.updated_at) || "2026-06-17";
  return {
    id: "fellowship-programme",
    name: title,
    slug: slugify(`fellowship-${title}`),
    shortDescription: (str(settings, ["site_tagline"]) || description).slice(0, 240),
    description,
    bannerUrl: mediaUrl(origin, settings.hero_snapshot || settings.logo_url),
    startDate: start,
    endDate: start,
    mode: "Hybrid",
    eventType: "Fellowship",
    registrationStart: start,
    registrationEnd: start,
    fee: 0,
    currency: "INR",
    registrationStatus: signup ? "Open" : "Closed",
    registrationUrl: origin,
    source: "fellowship",
    sourceUrl: origin,
    tbd: { venue: true, city: true, dates: true, fee: true, registration: false },
  };
}

async function pullFellowshipDatabase() {
  const portal: PartnerPortalId = "fellowship";
  if (!poolFor(portal)) return null;
  const origin = originFor(portal);
  const settings = ((await queryRows(portal, "SELECT * FROM site_settings LIMIT 1")) ?? [])[0] ?? {};
  const copied = await pullNoticesDatabase(portal);
  const ticker = str(settings, ["ticker_text"]);
  if (ticker && settings.ticker_enabled !== false) {
    copied.announcements.unshift({
      id: "fellowship-ticker",
      title: ticker,
      description: ticker,
      date: dateOnly(settings.updated_at),
      category: "Fellowship",
      href: origin,
      priority: "high",
    });
  }
  const events = [fellowshipProgrammeEvent(settings, copied.notices)];
  const users = (await queryRows(
    portal,
    `SELECT u.id, u.user_id AS user_id_string, u.email, u.phone, u.password_hash AS password,
            u.role::text AS role, u.user_role, u.created_at, u.is_disabled, u.is_banned, u.ban_reason,
            a.name AS full_name, a.mobile, a.alternate_mobile, a.application_number, a.status::text AS application_status,
            a.id AS application_id, a.submitted_at
       FROM users u
       LEFT JOIN applications a ON a.user_id = u.id`
  )) ?? [];
  const orders = (await queryRows(
    portal,
    `SELECT o.id, o.amount, o.status, o.payment_date AS created_at, o.payment_gateway AS gateway,
            r.user_id, u.email AS user_email
       FROM orders o
       LEFT JOIN registrations r ON r.id = o.registration_id
       LEFT JOIN users u ON u.id::text = r.user_id::text`
  )) ?? [];

  const accounts: SanitizedPartnerAccount[] = [];
  const ticketsByEmail: Record<string, PartnerTicketSummary[]> = {};
  const paymentsByEmail: Record<string, PartnerPaymentSummary[]> = {};
  const passwordHashes: Record<string, string> = {};
  const seen = new Set<string>();

  for (const row of users) {
    const email = str(row, ["email"]).toLowerCase();
    if (!email || seen.has(email)) {
      if (email && str(row, ["application_id"])) {
        const extra = {
          id: `fellowship-app-${str(row, ["application_id"])}`,
          portal,
          eventName: str(row, ["application_number"]) || "Research Fellowship 2026",
          status: str(row, ["application_status"], "Submitted").replace(/_/g, " "),
          issuedAt: iso(row.submitted_at) || undefined,
          portalUrl: partnerTicketHref(portal),
        };
        const list = ticketsByEmail[email] ?? [];
        if (!list.some((item) => item.id === extra.id)) ticketsByEmail[email] = [extra, ...list];
      }
      continue;
    }
    seen.add(email);
    const hasApplication = Boolean(str(row, ["application_id"]));
    const userOrders = orders.filter((item) => str(item, ["user_email"]).toLowerCase() === email || String(item.user_id) === String(row.id));
    const mapped = mapAccount(portal, row, {
      hasTicket: hasApplication,
      ticketCount: hasApplication ? 1 : 0,
      paymentCount: userOrders.length,
    });
    if (!mapped) continue;
    if (mapped.passwordHash) passwordHashes[`${portal}:${mapped.account.email}`] = mapped.passwordHash;
    if (hasApplication) {
      ticketsByEmail[email] = [
        {
          id: `fellowship-app-${str(row, ["application_id"])}`,
          portal,
          eventName: str(row, ["application_number"]) ? `Fellowship ${str(row, ["application_number"])}` : "Research Fellowship 2026",
          status: str(row, ["application_status"], "Submitted").replace(/_/g, " "),
          issuedAt: iso(row.submitted_at) || undefined,
          portalUrl: partnerTicketHref(portal),
        },
      ];
    }
    paymentsByEmail[email] = userOrders.map((item) => ({
      id: `fellowship-pay-${item.id}`,
      portal,
      amount: asNumber(item.amount),
      currency: "INR",
      status: str(item, ["status"], "Recorded"),
      at: iso(item.created_at) || undefined,
      eventName: "Research Fellowship 2026",
      portalUrl: origin,
    }));
    accounts.push(mapped.account);
  }

  return {
    events,
    accounts,
    ticketsByEmail,
    paymentsByEmail,
    passwordHashes,
    notices: copied.notices,
    announcements: copied.announcements,
    registrations: Object.values(ticketsByEmail).length,
  };
}

async function pullDatabase(portal: PartnerPortalId) {
  if (!poolFor(portal)) return null;
  if (portal === "fellowship") return pullFellowshipDatabase();
  const origin = originFor(portal);
  const seminars = (await queryRows(portal, "SELECT * FROM seminars ORDER BY event_date DESC NULLS LAST, id DESC")) ?? [];
  const schedules = (await queryRows(
    portal,
    "SELECT id, title, description, seminar_id, start_time, end_time, location, speaker_name, speaker_bio FROM event_schedules ORDER BY start_time ASC NULLS LAST, id ASC"
  )) ?? [];
  const users = (await queryRows(
    portal,
    `SELECT u.id, u.user_id_string, u.first_name, u.middle_name, u.last_name, u.email, u.phone, u.whatsapp,
            u.password, u.role, u.user_role, u.created_at, u.is_disabled, u.is_banned, u.ban_reason,
            CASE WHEN d.user_id IS NULL THEN 0 ELSE 1 END AS has_profile
       FROM users u
       LEFT JOIN doctor_profile d ON d.user_id = u.id`
  )) ?? [];
  const tickets = (await queryRows(
    portal,
    `SELECT t.id, t.user_id, t.ticket_id_string, t.is_valid, t.is_scanned, u.email AS user_email
       FROM tickets t
       LEFT JOIN users u ON u.id = t.user_id`
  )) ?? [];
  const registrations = (await queryRows(
    portal,
    `SELECT r.id, r.user_id, r.seminar_id, r.application_no, r.status, r.created_at, u.email AS user_email
       FROM registrations r
       LEFT JOIN users u ON u.id = r.user_id`
  )) ?? [];
  const prereg = portal === "autism"
    ? (await queryRows(
        portal,
        `SELECT p.id, p.user_id, p.seminar_id, p.application_no, p.status, p.created_at, u.email AS user_email
           FROM preregistrations p
           LEFT JOIN users u ON u.id = p.user_id`
      )) ?? []
    : [];
  const attempts = (await queryRows(
    portal,
    `SELECT id, user_id, user_email, amount, status, gateway, created_at, application_no, registration_id
       FROM payment_attempts`
  )) ?? [];
  const orders = (await queryRows(
    portal,
    `SELECT o.id, r.user_id, u.email AS user_email, o.amount, o.status, o.payment_gateway AS gateway,
            o.payment_date AS created_at, r.application_no, o.registration_id
       FROM orders o
       LEFT JOIN registrations r ON r.id = o.registration_id
       LEFT JOIN users u ON u.id = r.user_id`
  )) ?? [];
  const payments: Record<string, unknown>[] = [
    ...attempts.map((row) => ({ ...row, id: `att-${row.id}` })),
    ...orders.map((row) => ({ ...row, id: `ord-${row.id}` })),
  ];

  const seminarById = new Map(seminars.map((row) => [String(row.id), row]));
  const sessionsBySeminar = new Map<string, ScheduleRow[]>();
  for (const row of schedules) {
    const key = String(row.seminar_id || "");
    const list = sessionsBySeminar.get(key) ?? [];
    list.push(row as ScheduleRow);
    sessionsBySeminar.set(key, list);
  }
  const events = seminars.length
    ? seminars.map((row) => eventFromSeminar(portal, row, sessionsBySeminar.get(String(row.id)) ?? []))
    : eventsFromSchedules(portal, schedules as ScheduleRow[]);

  const ticketsByUser = new Map<string, Record<string, unknown>[]>();
  for (const row of tickets) {
    const key = String(row.user_id);
    const list = ticketsByUser.get(key) ?? [];
    list.push(row);
    ticketsByUser.set(key, list);
  }
  const paymentsByUser = new Map<string, Record<string, unknown>[]>();
  for (const row of payments) {
    const key = String(row.user_id || "");
    if (!key) continue;
    const list = paymentsByUser.get(key) ?? [];
    list.push(row);
    paymentsByUser.set(key, list);
  }

  const accounts: SanitizedPartnerAccount[] = [];
  const ticketsByEmail: Record<string, PartnerTicketSummary[]> = {};
  const paymentsByEmail: Record<string, PartnerPaymentSummary[]> = {};
  const passwordHashes: Record<string, string> = {};

  for (const row of users) {
    const userTickets = ticketsByUser.get(String(row.id)) ?? [];
    const userPayments = paymentsByUser.get(String(row.id)) ?? [];
    const mapped = mapAccount(portal, row, {
      hasTicket: userTickets.some((item) => asNumber(item.is_valid) !== 0),
      ticketCount: userTickets.length,
      paymentCount: userPayments.length,
      hasProfile: asNumber(row.has_profile) === 1,
    });
    if (!mapped) continue;
    const account = mapped.account;
    if (mapped.passwordHash) passwordHashes[`${portal}:${account.email}`] = mapped.passwordHash;
    const email = account.email.toLowerCase();
    const eventName = (id?: unknown) => str(seminarById.get(String(id || "")) ?? {}, ["title"]) || `${partnerCategory(portal)} programme`;
    ticketsByEmail[email] = userTickets.map((item) => ({
      id: `${portal}-tkt-${item.id}`,
      portal,
      eventName: eventName(item.event_id),
      status: asNumber(item.is_valid) === 0 ? "Invalid" : item.is_scanned ? "Checked in" : "Issued",
      issuedAt: iso(item.scan_time) || undefined,
      portalUrl: partnerTicketHref(portal),
    }));
    paymentsByEmail[email] = userPayments.map((item) => ({
      id: `${portal}-pay-${item.id}`,
      portal,
      amount: asNumber(item.amount),
      currency: "INR",
      status: str(item, ["status"], "Recorded"),
      at: iso(item.created_at) || undefined,
      eventName: str(item, ["application_no"]) || eventName(),
      portalUrl: origin,
    }));
    if (!account.partnerPortals?.[0]?.hasTicket) {
      const regs = registrations.filter((item) => String(item.user_id) === String(row.id));
      if (regs.length && account.partnerPortals?.[0]) account.partnerPortals[0].hasTicket = true;
    }
    accounts.push(account);
  }

  if (portal === "autism") {
    for (const row of prereg) {
      const email = str(row, ["user_email"]).toLowerCase();
      if (!email) continue;
      const existing = accounts.find((account) => account.email === email);
      if (existing?.partnerPortals?.[0]) existing.partnerPortals[0].role = "applicant";
    }
  }

  const copied = await pullNoticesDatabase(portal);

  return {
    events,
    accounts,
    ticketsByEmail,
    paymentsByEmail,
    passwordHashes,
    notices: copied.notices,
    announcements: copied.announcements,
    registrations: registrations.length,
  };
}

function mergeById<T extends { id: string }>(primary: T[], extra: T[]) {
  const map = new Map(primary.map((item) => [item.id, item]));
  for (const item of extra) {
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return [...map.values()];
}

function mergeAccounts(list: SanitizedPartnerAccount[]) {
  const map = new Map<string, SanitizedPartnerAccount>();
  for (const account of list) {
    const key = account.email.toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, account);
      continue;
    }
    const portals = [...(existing.partnerPortals ?? [])];
    for (const portal of account.partnerPortals ?? []) {
      const found = portals.find((item) => item.id === portal.id);
      if (found) {
        found.hasTicket = Boolean(found.hasTicket || portal.hasTicket);
        found.ticketCount = (found.ticketCount ?? 0) + (portal.ticketCount ?? 0);
        found.paymentCount = (found.paymentCount ?? 0) + (portal.paymentCount ?? 0);
      } else portals.push(portal);
    }
    const protectedRole = existing.role === "admin" || existing.role === "coadmin" || existing.role === "staff";
    map.set(key, {
      ...existing,
      ...account,
      id: existing.id,
      accountId: existing.accountId,
      role: protectedRole ? existing.role : "customer",
      password: undefined,
      partnerPasswordSet: false,
      foundationPasswordSet: Boolean(existing.foundationPasswordSet || account.foundationPasswordSet),
      alternatePhone: existing.alternatePhone || account.alternatePhone,
      partnerPortals: portals,
    });
  }
  return [...map.values()];
}

async function persistPartnerNotices(notices: Notice[]) {
  for (const notice of notices) {
    try {
      upsertNotice({
        id: notice.id,
        title: notice.title,
        description: notice.description || notice.title,
        category: notice.category,
        date: notice.date,
        href: notice.href,
        attachment: notice.attachment,
      });
    } catch {
      /* skip malformed partner notice */
    }
  }
}

export async function syncPartnerPortals(mode: "full" | "public" = "full"): Promise<PartnerSnapshot> {
  const { readPartnerSnapshot, writePartnerSnapshot } = await import("@/lib/server/partner-store");
  const previous = (await readPartnerSnapshot()) ?? emptySnapshot();
  const snapshot = emptySnapshot();
  if (mode === "public") {
    snapshot.accounts = previous.accounts;
    snapshot.ticketsByEmail = previous.ticketsByEmail;
    snapshot.paymentsByEmail = previous.paymentsByEmail;
    snapshot.passwordHashes = previous.passwordHashes ?? {};
  }
  for (const portal of partnerPortalIds) {
    const publicData = await pullPublic(portal);
    const dbData = mode === "full" ? await pullDatabase(portal) : null;
    const events = dbData?.events?.length ? mergeById(dbData.events, publicData.events) : publicData.events;
    const notices = mergeById(publicData.notices, dbData?.notices ?? []);
    const announcements = mergeById(publicData.announcements, dbData?.announcements ?? []);
    snapshot.events.push(...events);
    snapshot.notices.push(...notices);
    snapshot.announcements.push(...announcements);
    if (dbData) {
      snapshot.accounts.push(...dbData.accounts);
      Object.assign(snapshot.ticketsByEmail, dbData.ticketsByEmail);
      Object.assign(snapshot.paymentsByEmail, dbData.paymentsByEmail);
      Object.assign(snapshot.passwordHashes ?? (snapshot.passwordHashes = {}), dbData.passwordHashes);
    }
    snapshot.stats[portal] = {
      events: events.length,
      notices: notices.length,
      accounts: (mode === "full" ? dbData?.accounts.length : snapshot.accounts.filter((account) => account.partnerPortals?.some((item) => item.id === portal)).length) ?? 0,
      tickets: Object.values(mode === "full" ? dbData?.ticketsByEmail ?? {} : snapshot.ticketsByEmail).reduce((sum, rows) => sum + rows.filter((row) => row.portal === portal).length, 0),
      payments: Object.values(mode === "full" ? dbData?.paymentsByEmail ?? {} : snapshot.paymentsByEmail).reduce((sum, rows) => sum + rows.filter((row) => row.portal === portal).length, 0),
      source: dbData ? "database" : publicData.events.length || publicData.notices.length ? "public-api" : snapshot.stats[portal]?.source || "none",
    };
  }
  snapshot.accounts = mergeAccounts(snapshot.accounts);
  snapshot.syncedAt = new Date().toISOString();
  await persistPartnerNotices(snapshot.notices);
  await writePartnerSnapshot(snapshot);
  return snapshot;
}

export async function loadPartnerSnapshot(opts?: { refresh?: boolean; full?: boolean; maxAgeMs?: number }) {
  const { readPartnerSnapshot } = await import("@/lib/server/partner-store");
  const current = await readPartnerSnapshot();
  if (opts?.full) return syncPartnerPortals("full");
  if (opts?.refresh) return syncPartnerPortals("public");
  if (!current?.syncedAt) {
    const light = await syncPartnerPortals("public");
    if (anyDbConfigured()) void syncPartnerPortals("full");
    return light;
  }
  const age = Date.now() - Date.parse(current.syncedAt);
  if (!Number.isFinite(age) || age > (opts?.maxAgeMs ?? STALE_MS)) {
    return anyDbConfigured() ? syncPartnerPortals("full") : syncPartnerPortals("public");
  }
  return current;
}

function upsertList<T extends { id: string }>(list: T[], item: T) {
  return [item, ...list.filter((row) => row.id !== item.id)];
}

export async function ingestPartnerPayload(request: { headers: Headers; nextUrl: URL }, body: unknown) {
  const key = readApiKey(request);
  const partner = partnerForKey(key);
  if (!partner) return { ok: false as const, error: "Unknown partner key.", status: 401 };
  const portal = partner.id as PartnerPortalId;
  const payload = asRecord(stripPrivate(body)) ?? {};
  const snapshot = (await (await import("@/lib/server/partner-store")).readPartnerSnapshot()) ?? emptySnapshot();
  const accountRow = asRecord(payload.account) ?? asRecord(payload.user);
  if (accountRow) {
    const mapped = mapAccount(portal, {
      id: accountRow.id,
      user_id_string: accountRow.accountId || accountRow.user_id_string,
      first_name: accountRow.firstName || accountRow.first_name,
      last_name: accountRow.lastName || accountRow.last_name,
      email: accountRow.email,
      phone: accountRow.phone,
      whatsapp: accountRow.whatsapp || accountRow.phone,
      full_name: accountRow.name || accountRow.full_name,
      role: accountRow.role || (portal === "seminar" ? "doctor" : "user"),
      user_role: accountRow.user_role || accountRow.role,
      created_at: accountRow.createdAt,
      has_profile: portal === "seminar" ? 1 : 0,
    }, {
      hasTicket: Boolean(payload.ticket || payload.application || payload.hasTicket),
      ticketCount: asNumber(payload.ticketCount) || (payload.ticket || payload.application ? 1 : 0),
      paymentCount: asNumber(payload.paymentCount) || (payload.payment ? 1 : 0),
      hasProfile: portal === "seminar",
    });
    if (mapped) {
      snapshot.accounts = mergeAccounts([mapped.account, ...snapshot.accounts]);
      if (mapped.passwordHash) {
        snapshot.passwordHashes = { ...(snapshot.passwordHashes ?? {}), [`${portal}:${mapped.account.email}`]: mapped.passwordHash };
      }
    }
  }
  const eventRow = asRecord(payload.event) ?? asRecord(payload.seminar);
  if (eventRow) {
    const event = eventFromSeminar(portal, eventRow, []);
    snapshot.events = upsertList(snapshot.events, event);
  }
  const noticeRow = asRecord(payload.notice);
  if (noticeRow) {
    const notice: Notice = {
      id: str(noticeRow, ["id"]) || `${portal}-notice-${Date.now()}`,
      title: str(noticeRow, ["title"], "Notice"),
      date: dateOnly(noticeRow.date),
      category: partnerCategory(portal),
      description: str(noticeRow, ["description", "body"], str(noticeRow, ["title"], "Notice")),
      href: str(noticeRow, ["href"]) || partnerPortalHref(portal),
    };
    snapshot.notices = upsertList(snapshot.notices, notice);
    try {
      upsertNotice(notice);
    } catch {
      /* ignore */
    }
  }
  const email = str(accountRow ?? {}, ["email"]).toLowerCase() || str(payload, ["email"]).toLowerCase();
  const ticketRow = asRecord(payload.ticket) ?? asRecord(payload.application);
  if (email && ticketRow) {
    const ticket: PartnerTicketSummary = {
      id: str(ticketRow, ["id"]) || `${portal}-tkt-${Date.now()}`,
      portal,
      eventName: str(ticketRow, ["eventName", "event", "title", "application_number"], `${partnerCategory(portal)} programme`),
      status: str(ticketRow, ["status"], "Issued"),
      paymentStatus: str(ticketRow, ["paymentStatus"]) || undefined,
      amount: asNumber(ticketRow.amount) || undefined,
      currency: "INR",
      issuedAt: iso(ticketRow.issuedAt || ticketRow.issued_at) || undefined,
      portalUrl: partnerTicketHref(portal),
    };
    snapshot.ticketsByEmail[email] = upsertList(snapshot.ticketsByEmail[email] ?? [], ticket);
  }
  const paymentRow = asRecord(payload.payment);
  if (email && paymentRow) {
    const payment: PartnerPaymentSummary = {
      id: str(paymentRow, ["id"]) || `${portal}-pay-${Date.now()}`,
      portal,
      amount: asNumber(paymentRow.amount),
      currency: str(paymentRow, ["currency"], "INR"),
      status: str(paymentRow, ["status"], "Paid"),
      at: iso(paymentRow.at || paymentRow.created_at) || new Date().toISOString(),
      eventName: str(paymentRow, ["eventName", "event"]) || undefined,
      portalUrl: originFor(portal),
    };
    snapshot.paymentsByEmail[email] = upsertList(snapshot.paymentsByEmail[email] ?? [], payment);
  }
  snapshot.syncedAt = new Date().toISOString();
  snapshot.stats[portal] = {
    ...snapshot.stats[portal],
    events: snapshot.events.filter((event) => event.source === portal).length,
    notices: snapshot.notices.filter((notice) => notice.id.startsWith(`${portal}-`)).length,
    accounts: snapshot.accounts.filter((account) => account.partnerPortals?.some((item) => item.id === portal)).length,
    tickets: Object.values(snapshot.ticketsByEmail).reduce((sum, rows) => sum + rows.filter((row) => row.portal === portal).length, 0),
    payments: Object.values(snapshot.paymentsByEmail).reduce((sum, rows) => sum + rows.filter((row) => row.portal === portal).length, 0),
    source: snapshot.stats[portal]?.source === "database" ? "database" : "public-api",
  };
  const { writePartnerSnapshot } = await import("@/lib/server/partner-store");
  await writePartnerSnapshot(snapshot);
  return { ok: true as const, portal, syncedAt: snapshot.syncedAt };
}

export function findPartnerAccount(snapshot: PartnerSnapshot, identifier: string) {
  const value = identifier.trim();
  if (!value) return null;
  return snapshot.accounts.find((item) => accountMatchesIdentifier(item, value)) ?? null;
}

export function accountsForEmail(snapshot: PartnerSnapshot, email: string) {
  const key = email.trim().toLowerCase();
  const account = snapshot.accounts.find((item) => item.email.toLowerCase() === key) ?? findPartnerAccount(snapshot, email);
  const emailKey = account?.email.toLowerCase() ?? key;
  return {
    account: account ?? null,
    tickets: snapshot.ticketsByEmail[emailKey] ?? [],
    payments: snapshot.paymentsByEmail[emailKey] ?? [],
  };
}

export async function lookupPartnerIdentity(input: {
  identifier?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  password?: string;
}) {
  void input.password;
  const snapshot = await loadPartnerSnapshot();
  const candidates = [input.identifier, input.email, input.phone, input.alternatePhone]
    .map((value) => (value ?? "").trim())
    .filter(Boolean);
  let account: SanitizedPartnerAccount | null = null;
  for (const candidate of candidates) {
    account = findPartnerAccount(snapshot, candidate);
    if (account) break;
  }
  const email = account?.email ?? "";
  const related = email ? accountsForEmail(snapshot, email) : { account, tickets: [], payments: [] };
  const resolved = related.account ?? account;
  return {
    found: Boolean(resolved),
    passwordOk: false,
    passwordSet: false,
    account: resolved ? sanitizeAccountForClient(resolved, { includePasswords: false }) : null,
    tickets: related.tickets,
    payments: related.payments,
  };
}

export { partnerPortalHref, partnerTicketHref };
