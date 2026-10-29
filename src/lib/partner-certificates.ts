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
  typeLabel?: string;
  issuer?: string;
  verifyUrl?: string;
  apiUrl?: string;
  participantId?: string;
  issuedAt?: string;
};

export type AutismVerifyResult = {
  ok: boolean;
  valid: boolean;
  code?: string;
  error?: string;
  status: string;
  certificate: UnifiedCertificate | null;
};

export const AUTISM_ERROR_COPY: Record<string, string> = {
  INVALID_ID: "Enter a certificate ID such as CERT-P-12-345 or CERT-V-12-345.",
  NOT_FOUND: "No certificate was found for this ID.",
  NOT_ISSUED: "This certificate ID is on file but has not been issued yet.",
  AMBIGUOUS: "This older certificate ID matches more than one certificate. Use the full ID printed as CERT-P-… or CERT-V-….",
  RATE_LIMITED: "Too many verification attempts. Please wait a minute and try again.",
  UNAVAILABLE: "Verification is temporarily unavailable. Please try again later.",
};

export function autismErrorText(code?: string, fallback?: string) {
  if (code && AUTISM_ERROR_COPY[code]) return AUTISM_ERROR_COPY[code];
  if (fallback?.trim()) return fallback.trim();
  return AUTISM_ERROR_COPY.UNAVAILABLE;
}

export function normalizeCertificateId(id: string) {
  return String(id || "").replace(/\s+/g, "").toUpperCase();
}

export const SEMINAR_ORIGIN = "https://seminar.vaidyagogate.org";
export const AUTISM_ORIGIN = "https://autism.vaidyagogate.org";

export function seminarDigits(id: string) {
  return String(id || "").replace(/\D/g, "");
}

export function isSeminarId(id: string) {
  return seminarDigits(id).length === 12;
}

export function parseAutismId(id: string) {
  const raw = normalizeCertificateId(id);
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

function autismFail(code: string, error?: string): AutismVerifyResult {
  return {
    ok: false,
    valid: false,
    code,
    error: autismErrorText(code, error),
    status: code.toLowerCase(),
    certificate: null,
  };
}

export function mapAutismApiResponse(
  status: number,
  body: Record<string, unknown> | null,
  rawId: string
): AutismVerifyResult {
  if (status === 0) return autismFail("UNAVAILABLE");
  if (!body) {
    if (status === 400) return autismFail("INVALID_ID");
    if (status === 429) return autismFail("RATE_LIMITED");
    if (status === 409) return autismFail("AMBIGUOUS");
    if (status === 404) return autismFail("NOT_FOUND");
    if (status >= 500) return autismFail("UNAVAILABLE");
    return autismFail("UNAVAILABLE");
  }

  const code = textField(body, ["code"]).toUpperCase();
  const error = textField(body, ["error"]);

  if (status === 400 || code === "INVALID_ID") return autismFail("INVALID_ID", error);
  if (status === 429 || code === "RATE_LIMITED") return autismFail("RATE_LIMITED", error);
  if (status === 409 || code === "AMBIGUOUS") return autismFail("AMBIGUOUS", error);
  if (code === "NOT_ISSUED" || (status === 404 && code === "NOT_ISSUED")) return autismFail("NOT_ISSUED", error);
  if (status === 404 || code === "NOT_FOUND") return autismFail("NOT_FOUND", error);
  if (status >= 500 || code === "UNAVAILABLE") return autismFail("UNAVAILABLE", error);

  const nested = asRecord(body.certificate);
  const valid = body.valid === true && Boolean(nested);
  if (!valid) {
    if (code) return autismFail(code, error);
    if (body.valid === false) return autismFail("NOT_FOUND", error);
    return autismFail("NOT_FOUND", error);
  }

  const cert = nested!;
  const holderName = textField(cert, ["holderName", "name"]);
  if (!holderName) return autismFail("NOT_ISSUED");

  const eventRecord = asRecord(cert.event);
  const eventId = textField(eventRecord, ["id"]) || textField(cert, ["eventId"]);
  const eventTitle = textField(eventRecord, ["title", "name"]) || textField(cert, ["event"]);
  const eventDate = textField(eventRecord, ["date"]) || textField(cert, ["eventDate", "date"]);
  const type = textField(cert, ["type", "kind"]);
  const typeLabel =
    textField(cert, ["typeLabel"]) ||
    (type === "volunteer" ? "Volunteer" : type === "participant" ? "Participation" : type || "Participation");
  const certificateId = textField(cert, ["certificateId", "certificateNumber"]) || normalizeCertificateId(rawId);
  const issuedAt = textField(cert, ["issuedAt", "issueDate"]);
  const issuer = textField(cert, ["issuer"]) || "Vaidya Gogate Memorial Foundation";
  const year = eventDate ? new Date(eventDate).getFullYear() : NaN;

  return {
    ok: true,
    valid: true,
    status: "valid",
    certificate: {
      certificateNumber: certificateId,
      name: holderName,
      event: eventTitle,
      certificateType: typeLabel,
      eventDate,
      issueDate: issuedAt.slice(0, 10) || eventDate,
      signature: issuer,
      year: Number.isFinite(year) ? year : undefined,
      source: "autism",
      sourceLabel: sourceLabel("autism"),
      applicationNumber: textField(cert, ["applicationNo", "applicationNumber"]),
      eventId,
      kind: type || typeLabel,
      eventDetails: eventTitle || eventId ? { id: eventId || eventTitle, title: eventTitle || eventId, date: eventDate } : undefined,
      typeLabel,
      issuer,
      verifyUrl: textField(cert, ["verifyUrl"]),
      apiUrl: textField(cert, ["apiUrl"]),
      participantId: textField(cert, ["participantId"]),
      issuedAt,
    },
  };
}
