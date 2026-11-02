import { Pool } from "pg";
import { samePhone } from "@/lib/account-identity";
import { SEMINAR_HOST } from "@/lib/platform";

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

export async function findSeminarViewer(email: string, phone: string): Promise<SeminarViewer | null> {
  const db = seminarPool();
  if (!db) return null;
  const normalized = email.trim().toLowerCase();
  const byEmail = normalized
    ? await db.query<{ id: number; email: string | null; phone: string | null; whatsapp: string | null; doctor_category: string | null }>(
        `SELECT id, email, phone, whatsapp, doctor_category FROM users WHERE lower(email) = $1 ORDER BY id ASC LIMIT 8`,
        [normalized]
      )
    : { rows: [] };
  let rows = byEmail.rows;
  const local = phone.replace(/\D/g, "").slice(-10);
  if (!rows.length && local.length >= 10) {
    const byPhone = await db.query<{ id: number; email: string | null; phone: string | null; whatsapp: string | null; doctor_category: string | null }>(
      `SELECT id, email, phone, whatsapp, doctor_category
       FROM users
       WHERE right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10) = $1
          OR right(regexp_replace(coalesce(whatsapp, ''), '\\D', '', 'g'), 10) = $1
       ORDER BY id ASC
       LIMIT 8`,
      [local]
    );
    rows = byPhone.rows;
  }
  if (!rows.length) return null;
  const match =
    rows.find((row) => normalized && String(row.email || "").toLowerCase() === normalized && (phone ? samePhone(row.phone, phone) || samePhone(row.whatsapp, phone) : true)) ||
    rows[0];
  return {
    id: Number(match.id),
    email: String(match.email || ""),
    phone: String(match.phone || match.whatsapp || ""),
    volunteer: String(match.doctor_category || "").toLowerCase() === "volunteer",
  };
}

export async function seminarVideoRequest(path: string, init?: { method?: "GET" | "POST"; body?: Record<string, unknown> }) {
  const response = await fetch(`${seminarVideoOrigin()}${path}`, {
    method: init?.method || "GET",
    headers: { accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}) },
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
