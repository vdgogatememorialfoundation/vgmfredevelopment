import { Pool } from "pg";
import { sourceLabel, type UnifiedCertificate } from "@/lib/partner-certificates";

/** Reads certificates straight from the seminar portal database (participant and volunteer, every certificate a person holds). */
let pool: Pool | null = null;

function seminarDb() {
  const url = (process.env.SEMINAR_DATABASE_URL || "").trim();
  if (!url) return null;
  if (!pool) pool = new Pool({ connectionString: url, max: 2, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 8_000 });
  return pool;
}

export function seminarCertificatesConfigured() {
  return Boolean((process.env.SEMINAR_DATABASE_URL || "").trim());
}

export type SeminarCertificateRow = {
  number: string;
  name: string;
  kind: "participant" | "volunteer";
  event: string;
  eventDate: string;
  enabled: boolean;
  scanVerified: boolean;
  updatedAt: string;
};

const SELECT = (table: string, kind: string) => `
  SELECT '${kind}' AS kind, c.certificate_id_string AS number,
         COALESCE(NULLIF(trim(c.display_name), ''), trim(concat(u.first_name, ' ', u.last_name))) AS name,
         COALESCE(s.title, '') AS event, COALESCE(s.event_date::text, '') AS event_date,
         COALESCE(c.enabled, 0)::int AS enabled, COALESCE(c.scan_verified, 0)::int AS scan_verified,
         COALESCE(c.updated_at::text, '') AS updated_at
    FROM ${table} c
    LEFT JOIN users u ON u.id = c.user_id
    LEFT JOIN seminars s ON s.id = c.seminar_id
   WHERE coalesce(c.certificate_id_string, '') <> ''`;

function mapRow(row: Record<string, unknown>): SeminarCertificateRow {
  return {
    number: String(row.number ?? ""),
    name: String(row.name ?? "").trim(),
    kind: row.kind === "volunteer" ? "volunteer" : "participant",
    event: String(row.event ?? ""),
    eventDate: String(row.event_date ?? "").slice(0, 10),
    enabled: Number(row.enabled) === 1,
    scanVerified: Number(row.scan_verified) === 1,
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function listSeminarCertificates(): Promise<SeminarCertificateRow[] | null> {
  const db = seminarDb();
  if (!db) return null;
  const result = await db.query(
    `${SELECT("user_certificates", "participant")} UNION ALL ${SELECT("volunteer_certificates", "volunteer")} ORDER BY updated_at DESC LIMIT 5000`
  );
  return result.rows.map(mapRow);
}

/** One certificate by its 12-digit id, from either table. */
export async function findSeminarCertificate(digits: string): Promise<SeminarCertificateRow | null> {
  const db = seminarDb();
  if (!db || digits.length !== 12) return null;
  try {
    const result = await db.query(
      `SELECT * FROM (${SELECT("user_certificates", "participant")} UNION ALL ${SELECT("volunteer_certificates", "volunteer")}) x
        WHERE right(regexp_replace(x.number, '\\D', '', 'g'), 12) = $1 LIMIT 1`,
      [digits]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  } catch {
    return null;
  }
}

export function seminarRowToCertificate(row: SeminarCertificateRow): UnifiedCertificate {
  const year = row.eventDate ? new Date(row.eventDate).getFullYear() : NaN;
  return {
    certificateNumber: row.number,
    name: row.name,
    event: row.event,
    certificateType: row.kind === "volunteer" ? "Volunteer" : "Participation",
    eventDate: row.eventDate,
    issueDate: row.updatedAt.slice(0, 10) || row.eventDate,
    signature: "Vaidya Gogate Memorial Foundation",
    year: Number.isFinite(year) ? year : undefined,
    source: "seminar",
    sourceLabel: sourceLabel("seminar"),
    kind: row.kind,
  };
}
