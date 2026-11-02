import { Pool } from "pg";
import { SEMINAR_HOST } from "@/lib/platform";
import { chooseSeminarViewer, portalAccountId, type SeminarUserRow } from "@/lib/seminar-viewer";

/**
 * Seminar recordings stay in the seminar portal (access rules, purchases, encrypted playback).
 * This site only looks up the signed-in person and calls that portal, so the page itself
 * can live on the main domain where Google AdSense is approved.
 */
let pool: Pool | null = null;

export function seminarVideoOrigin() {
  return (process.env.SEMINAR_VIDEO_ORIGIN || `https://${SEMINAR_HOST}`).replace(/\/$/, "");
}

function seminarPool() {
  const url = (process.env.SEMINAR_DATABASE_URL || "").trim();
  if (!url) return null;
  if (!pool) pool = new Pool({ connectionString: url, max: 2, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 8_000 });
  return pool;
}

export type SeminarViewer = {
  id: number;
  email: string;
  phone: string;
  volunteer: boolean;
};

export function seminarVideoDbConfigured() {
  return Boolean((process.env.SEMINAR_DATABASE_URL || "").trim());
}

let officeAdminId: number | null = null;

/** Seminar office routes trust an admin user id. This site chooses that id; the browser never supplies it. */
export async function seminarOfficeAdminId() {
  if (officeAdminId) return officeAdminId;
  const db = seminarPool();
  if (!db) return null;
  const result = await db.query<{ id: number }>(
    `SELECT id FROM users
     WHERE COALESCE(is_disabled, 0) = 0 AND lower(COALESCE(role, '')) = 'admin'
     ORDER BY id ASC
     LIMIT 1`
  );
  const id = Number(result.rows[0]?.id || 0);
  officeAdminId = id > 0 ? id : null;
  return officeAdminId;
}

const USER_COLUMNS = `u.id, u.email, u.phone, u.whatsapp, u.doctor_category, u.user_id_string, u.role, u.user_role,
       EXISTS (SELECT 1 FROM video_licenses l WHERE l.user_id = u.id) AS has_license`;

function asViewer(match: SeminarUserRow): SeminarViewer {
  return {
    id: Number(match.id),
    email: String(match.email || ""),
    phone: String(match.phone || match.whatsapp || ""),
    volunteer: String(match.doctor_category || "").toLowerCase() === "volunteer",
  };
}

type CookieJar = { get(name: string): { value: string } | undefined };

function readSession(raw: string | undefined) {
  if (!raw) return null;
  const candidates = [raw];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch {
    /* already decoded */
  }
  for (const value of candidates) {
    try {
      const parsed = JSON.parse(value) as { email?: string; phone?: string; accountId?: string; id?: string; firstName?: string; lastName?: string };
      if (parsed?.email) return parsed;
    } catch {
      /* next encoding */
    }
  }
  return null;
}

/**
 * Seminar videos follow the account on the dashboard. An admin session in the
 * same browser must not replace that person, or a volunteer sees another login's
 * license and a paywall.
 */
export function seminarDashboardViewer(cookies: CookieJar) {
  const parsed = readSession(cookies.get("vgmf_session")?.value) || readSession(cookies.get("vgmf_admin_session")?.value);
  if (!parsed?.email) return { email: "", phone: "", accountId: "", name: "" };
  return {
    email: parsed.email.trim().toLowerCase(),
    phone: parsed.phone || "",
    accountId: portalAccountId(parsed.accountId, parsed.id),
    name: [parsed.firstName, parsed.lastName].filter(Boolean).join(" ").trim(),
  };
}

export async function findSeminarViewer(email: string, phone: string, accountId = ""): Promise<SeminarViewer | null> {
  const db = seminarPool();
  if (!db) return null;
  const portalId = portalAccountId(accountId);
  const normalized = email.trim().toLowerCase();
  const byPortal = portalId
    ? await db.query<SeminarUserRow>(
        `SELECT ${USER_COLUMNS} FROM users u WHERE btrim(coalesce(u.user_id_string, '')) = $1 ORDER BY u.id ASC LIMIT 4`,
        [portalId]
      )
    : { rows: [] as SeminarUserRow[] };
  const portalMatch = chooseSeminarViewer(byPortal.rows, normalized, phone, portalId);
  if (portalMatch && String(portalMatch.user_id_string || "").trim() === portalId) return asViewer(portalMatch);
  const byEmail = normalized
    ? await db.query<SeminarUserRow>(
        `SELECT ${USER_COLUMNS} FROM users u WHERE lower(btrim(u.email)) = $1 ORDER BY u.id ASC LIMIT 8`,
        [normalized]
      )
    : { rows: [] as SeminarUserRow[] };
  let rows = byEmail.rows;
  const local = phone.replace(/\D/g, "").slice(-10);
  if (!rows.length && local.length >= 10) {
    const byPhone = await db.query<SeminarUserRow>(
      `SELECT ${USER_COLUMNS}
       FROM users u
       WHERE right(regexp_replace(coalesce(u.phone, ''), '\\D', '', 'g'), 10) = $1
          OR right(regexp_replace(coalesce(u.whatsapp, ''), '\\D', '', 'g'), 10) = $1
       ORDER BY u.id ASC
       LIMIT 8`,
      [local]
    );
    rows = byPhone.rows;
  }
  const match = chooseSeminarViewer(rows, normalized, phone, portalId);
  return match ? asViewer(match) : null;
}

export function seminarClientHeaders(request: { headers: { get(name: string): string | null } }) {
  const headers: Record<string, string> = {};
  const userAgent = request.headers.get("user-agent");
  const forwarded = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "";
  if (userAgent) headers["user-agent"] = userAgent.slice(0, 240);
  if (forwarded) headers["x-forwarded-for"] = forwarded.slice(0, 240);
  return headers;
}

export async function seminarVideoRequest(path: string, init?: { method?: "GET" | "POST"; body?: Record<string, unknown>; headers?: Record<string, string> }) {
  const response = await fetch(`${seminarVideoOrigin()}${path}`, {
    method: init?.method || "GET",
    headers: { accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}), ...(init?.headers || {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: "The seminar video service did not answer." };
  }
  return { status: response.status, data };
}
