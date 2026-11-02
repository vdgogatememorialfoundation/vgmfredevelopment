import { samePhone } from "./account-identity";

/** A seminar office login. Staff rows that share a doctor's email are not the doctor's video account. */
const STAFF_ROLES = ["admin", "co_admin", "coadmin", "staff", "scanner_portal_user", "judge_user", "committee"];

export type SeminarUserRow = {
  id: number;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  doctor_category: string | null;
  user_id_string: string | null;
  role: string | null;
  user_role: string | null;
  has_license: boolean;
};

export function portalAccountId(...values: Array<string | undefined | null>) {
  for (const value of values) {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.length === 12) return digits;
  }
  return "";
}

export function isSeminarStaff(row: Pick<SeminarUserRow, "role" | "user_role">) {
  const values = `${row.role || ""} ${row.user_role || ""}`.toLowerCase();
  return STAFF_ROLES.some((role) => values.includes(role));
}

/**
 * The account page and the seminar portal must resolve to the same person.
 * The 12-digit portal id wins. Otherwise a volunteer who already has a video
 * license wins over a staff login that reused the same email or phone.
 */
export function chooseSeminarViewer(rows: SeminarUserRow[], email: string, phone: string, accountId: string) {
  const portalId = portalAccountId(accountId);
  if (portalId) {
    const byPortal = rows.find((row) => String(row.user_id_string || "").trim() === portalId);
    if (byPortal) return byPortal;
  }
  const normalized = email.trim().toLowerCase();
  const emailRows = normalized ? rows.filter((row) => String(row.email || "").trim().toLowerCase() === normalized) : [];
  const pool = emailRows.length ? emailRows : rows;
  if (!pool.length) return null;
  const doctors = pool.filter((row) => !isSeminarStaff(row));
  const candidates = doctors.length ? doctors : pool;
  const score = (row: SeminarUserRow) => {
    const volunteer = String(row.doctor_category || "").toLowerCase() === "volunteer" ? 8 : 0;
    const license = row.has_license ? 4 : 0;
    const phoneOk = phone && (samePhone(row.phone, phone) || samePhone(row.whatsapp, phone)) ? 1 : 0;
    return volunteer + license + phoneOk;
  };
  return [...candidates].sort((left, right) => score(right) - score(left) || left.id - right.id)[0];
}
