import {
  AUTISM_ORIGIN,
  SEMINAR_ORIGIN,
  asList,
  asRecord,
  isAutismId,
  isSeminarId,
  mapAutismApiResponse,
  mapPartnerEvent,
  parseAutismId,
  seminarDigits,
  sourceLabel,
  stripPrivateFields,
  textField,
  type AutismVerifyResult,
  type CertificateSource,
  type PartnerEvent,
  type UnifiedCertificate,
} from "@/lib/partner-certificates";

const FETCH_MS = 4000;

type PartnerJson = {
  status: number;
  body: Record<string, unknown> | null;
};

async function fetchJson(url: string): Promise<PartnerJson> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    return { status: response.status, body: asRecord(stripPrivateFields(parsed)) };
  } catch {
    return { status: 0, body: null };
  } finally {
    clearTimeout(timer);
  }
}

function yearFrom(date: string) {
  const parsed = date ? new Date(date).getFullYear() : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function matchEvent(events: PartnerEvent[], id?: string, title?: string) {
  const needle = (id || "").trim().toLowerCase();
  const name = (title || "").trim().toLowerCase();
  return (
    events.find((event) => event.id.toLowerCase() === needle) ||
    events.find((event) => name && event.title.toLowerCase() === name) ||
    events.find((event) => needle && event.title.toLowerCase().includes(needle))
  );
}

export async function loadPartnerEvents(origin: string): Promise<PartnerEvent[]> {
  const urls = [
    `${origin}/api/public/events`,
    `${origin}/api/events/public`,
    `${origin}/api/events`,
  ];
  for (const url of urls) {
    const result = await fetchJson(url);
    if (!result.body) continue;
    const mapped = asList(result.body).map(mapPartnerEvent).filter((item): item is PartnerEvent => Boolean(item));
    if (mapped.length) return mapped;
  }
  return [];
}

function eventFromBody(body: Record<string, unknown> | null): PartnerEvent | undefined {
  if (!body) return undefined;
  const nested = mapPartnerEvent(body.event);
  if (nested) return nested;
  const title = textField(body, ["event", "eventTitle", "eventName", "title"]);
  const id = textField(body, ["eventId", "event_id"]);
  if (!title && !id) return undefined;
  return {
    id: id || title,
    title: title || id,
    date: textField(body, ["eventDate", "date", "event_date"]),
    venue: textField(body, ["venue", "location"]),
  };
}

function mapSeminar(body: Record<string, unknown> | null, fallbackId: string, events: PartnerEvent[]): UnifiedCertificate | null {
  if (!body) return null;
  const valid = body.valid === true || body.status === "valid";
  if (!valid) return null;
  const event = eventFromBody(body);
  const matched = matchEvent(events, event?.id, event?.title) || event;
  const name = textField(body, ["holderName", "name"]);
  if (!name) return null;
  const certificateNumber = textField(body, ["certificateId", "certificateNumber", "id"]) || fallbackId;
  const eventDate = matched?.date || event?.date || "";
  const kind = textField(body, ["kind", "certificateType", "type"]);
  return {
    certificateNumber,
    name,
    event: matched?.title || event?.title || "",
    certificateType: kind === "volunteer" ? "Volunteer" : kind === "participant" ? "Participation" : kind || "Participation",
    eventDate,
    issueDate: textField(body, ["issuedAt", "issueDate", "issued_at"]).slice(0, 10) || eventDate,
    signature: "Vaidya Gogate Memorial Foundation",
    year: yearFrom(eventDate),
    source: "seminar",
    sourceLabel: sourceLabel("seminar"),
    prn: textField(body, ["prn", "PRN"]),
    applicationNumber: textField(body, ["applicationNo", "applicationNumber", "application_no"]),
    eventId: matched?.id || event?.id,
    eventVenue: matched?.venue || event?.venue,
    kind,
    eventDetails: matched,
  };
}

function enrichAutism(mapped: UnifiedCertificate, events: PartnerEvent[]): UnifiedCertificate {
  const matched = matchEvent(events, mapped.eventId, mapped.event);
  if (!matched) return mapped;
  return {
    ...mapped,
    event: matched.title || mapped.event,
    eventDate: matched.date || mapped.eventDate,
    eventVenue: matched.venue || mapped.eventVenue,
    eventId: matched.id || mapped.eventId,
    eventDetails: matched,
    year: mapped.year || yearFrom(matched.date || mapped.eventDate),
  };
}

async function verifySeminar(id: string, events: PartnerEvent[]) {
  const digits = seminarDigits(id);
  if (digits.length !== 12) return { status: "invalid_id" as const, certificate: null };
  const encoded = encodeURIComponent(digits);
  const urls = [
    `${SEMINAR_ORIGIN}/api/public/certificates/verify/${encoded}`,
    `${SEMINAR_ORIGIN}/api/public/certificates/verify?id=${encoded}`,
  ];
  for (const url of urls) {
    const result = await fetchJson(url);
    if (result.status === 400) return { status: "invalid_id" as const, certificate: null };
    const mapped = mapSeminar(result.body, digits, events);
    if (mapped) return { status: "valid" as const, certificate: mapped };
    if (result.body && (result.body.valid === false || result.body.status === "not_found" || result.body.status === "not_issued")) {
      return { status: String(result.body.status || "not_found"), certificate: null };
    }
  }
  return { status: "not_found" as const, certificate: null };
}

async function verifyAutism(id: string, events: PartnerEvent[]): Promise<AutismVerifyResult> {
  const parsed = parseAutismId(id);
  const lookup = encodeURIComponent(parsed?.raw || id.replace(/\s+/g, ""));
  const urls = [
    `${AUTISM_ORIGIN}/api/public/certificates/verify?id=${lookup}`,
    `${AUTISM_ORIGIN}/api/public/certificates/${lookup}`,
  ];
  let last: AutismVerifyResult = {
    ok: false,
    valid: false,
    code: "UNAVAILABLE",
    error: "Verification is temporarily unavailable. Please try again later.",
    status: "unavailable",
    certificate: null,
  };
  for (const url of urls) {
    const result = await fetchJson(url);
    if (result.status === 0) continue;
    const mapped = mapAutismApiResponse(result.status, result.body, parsed?.raw || id);
    if (mapped.certificate) {
      mapped.certificate = enrichAutism(mapped.certificate, events);
      return mapped;
    }
    last = mapped;
    if (mapped.code && mapped.code !== "UNAVAILABLE") return mapped;
  }
  return last;
}

async function seminarLookup(id: string) {
  const result = await verifySeminar(id, []);
  if (result.certificate) {
    const events = await loadPartnerEvents(SEMINAR_ORIGIN);
    const matched = events.find(
      (event) => event.id === result.certificate?.eventId || event.title === result.certificate?.event
    );
    if (matched) result.certificate.eventDetails = matched;
  }
  return result;
}

async function autismLookup(id: string) {
  const result = await verifyAutism(id, []);
  if (result.certificate) {
    const events = await loadPartnerEvents(AUTISM_ORIGIN);
    return { ...result, certificate: enrichAutism(result.certificate, events) };
  }
  return result;
}

export async function lookupPartnerCertificate(id: string): Promise<{
  certificate: UnifiedCertificate | null;
  status: string;
  code?: string;
  error?: string;
  sourceTried: CertificateSource[];
}> {
  const trimmed = id.trim();
  if (!trimmed) {
    return { certificate: null, status: "invalid_id", code: "INVALID_ID", error: "Add a certificate number.", sourceTried: [] };
  }

  const seminarId = isSeminarId(trimmed);
  const autismId = isAutismId(trimmed);
  const sourceTried: CertificateSource[] = seminarId ? ["seminar", "autism"] : ["autism"];

  if (seminarId) {
    const [seminar, autism] = await Promise.all([seminarLookup(trimmed), autismLookup(trimmed)]);
    if (seminar.certificate) return { ...seminar, sourceTried };
    if (autism.certificate) return { ...autism, sourceTried };
    if (autism.code && autism.code !== "NOT_FOUND" && autism.code !== "UNAVAILABLE" && autism.code !== "INVALID_ID") {
      return { ...autism, sourceTried };
    }
    return {
      certificate: null,
      status: seminar.status || "not_found",
      code: "NOT_FOUND",
      error: "No certificate was found for this ID.",
      sourceTried,
    };
  }

  const autism = await autismLookup(trimmed);
  if (autism.certificate) return { ...autism, sourceTried };
  if (autism.code && autism.code !== "NOT_FOUND" && autism.code !== "UNAVAILABLE") {
    return { ...autism, sourceTried };
  }

  if (!autismId) {
    sourceTried.push("seminar");
    const seminar = await seminarLookup(trimmed);
    if (seminar.certificate) return { ...seminar, sourceTried };
  }

  return {
    certificate: null,
    status: autism.status || "not_found",
    code: autism.code || "NOT_FOUND",
    error: autism.error || "No certificate was found for this ID.",
    sourceTried,
  };
}
