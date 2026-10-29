export type CertificateSource = "foundation" | "seminar" | "autism";

export type PartnerEvent = {
  id: string;
  title: string;
  date?: string;
  venue?: string;
  city?: string;
  mode?: string;
};

export type UnifiedCertificate = {
  certificateNumber: string;
  name: string;
  event: string;
  certificateType: string;
  eventDate: string;
  issueDate: string;
  signature: string;
  status?: "Valid" | "Revoked";
  year?: number;
  eventSlug?: string;
  source: CertificateSource;
  sourceLabel: string;
  prn?: string;
  applicationNumber?: string;
  eventId?: string;
  eventVenue?: string;
  kind?: string;
  eventDetails?: PartnerEvent;
};

export const SEMINAR_ORIGIN = "https://seminar.vaidyagogate.org";
export const AUTISM_ORIGIN = "https://autism.vaidyagogate.org";

export function seminarDigits(id: string) {
  return String(id || "").replace(/\D/g, "");
}

export function isSeminarId(id: string) {
  return seminarDigits(id).length === 12;
}

export function parseAutismId(id: string) {
  const raw = String(id || "").trim().toUpperCase();
  const match = raw.match(/^CERT(?:-([PV]))?-([^-]+)-(.+)$/);
  if (!match) return null;
  const kind = match[1] === "V" ? "Volunteer" : match[1] === "P" ? "Participation" : "Certificate";
  return { raw, kind, eventId: match[2], certificateId: match[3] };
}

export function isAutismId(id: string) {
  return Boolean(parseAutismId(id));
}

export function sourceLabel(source: CertificateSource) {
  if (source === "seminar") return "Seminar programmes";
  if (source === "autism") return "Autism programmes";
  return "Vaidya Gogate Memorial Foundation";
}

const PRIVATE_KEY = /^(email|e-mail|phone|mobile|whatsapp|token|qrtoken|qr|otp|password|secret|authorization)/i;

export function stripPrivateFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPrivateFields);
  if (!value || typeof value !== "object") return value;
  const next: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (PRIVATE_KEY.test(key)) continue;
    next[key] = stripPrivateFields(nested);
  }
  return next;
}

export function textField(record: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!record) return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [];
  for (const key of ["events", "data", "items", "results", "records"]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}

export function mapPartnerEvent(value: unknown): PartnerEvent | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = textField(record, ["id", "eventId", "slug", "event_id"]);
  const title = textField(record, ["title", "name", "event", "eventTitle", "event_name"]);
  if (!id && !title) return null;
  return {
    id: id || title,
    title: title || id,
    date: textField(record, ["date", "eventDate", "startDate", "start_date", "heldOn"]),
    venue: textField(record, ["venue", "location", "place"]),
    city: textField(record, ["city"]),
    mode: textField(record, ["mode", "type"]),
  };
}
