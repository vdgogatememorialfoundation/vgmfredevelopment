import { getAllApplications } from "@/lib/applications";
import { getPartnerTickets, listStoredPartnerTickets } from "@/lib/partner-hydrate";
import { partnerPortalLabel } from "@/lib/partner-labels";
import type { Application, PartnerPortalId, PartnerTicketSummary } from "@/types";

export const applicationPipelineSteps: { key: Application["status"]; label: string }[] = [
  { key: "Submitted", label: "Submitted" },
  { key: "Under Review", label: "Under Review" },
  { key: "Approved", label: "Approved" },
  { key: "Confirmed", label: "Confirmed" },
];

export const fallbackApplicationStatuses: Record<PartnerPortalId, string[]> = {
  seminar: [
    "Submitted",
    "Pending",
    "Confirmed",
    "Paid",
    "Issued",
    "E-ticket",
    "Checked in",
    "Certificate issued",
    "Invalid",
    "Cancelled",
    "Expired",
  ],
  autism: [
    "Pre-registration",
    "Approved",
    "Main registration",
    "Submitted",
    "Pending",
    "Confirmed",
    "Paid",
    "Issued",
    "E-ticket",
    "Checked in",
    "Certificate issued",
    "Invalid",
    "Cancelled",
    "Expired",
  ],
  fellowship: ["Draft", "Submitted", "Under Review", "Shortlisted", "Waitlisted", "Accepted", "Certificate issued", "Rejected"],
};

const PIPELINE_ORDER: Record<PartnerPortalId, string[]> = {
  seminar: ["Submitted", "Pending", "Confirmed", "Paid", "Issued", "E-ticket", "Checked in", "Certificate issued"],
  autism: [
    "Pre-registration",
    "Approved",
    "Main registration",
    "Submitted",
    "Pending",
    "Confirmed",
    "Paid",
    "Issued",
    "E-ticket",
    "Checked in",
    "Certificate issued",
  ],
  fellowship: ["Draft", "Submitted", "Under Review", "Shortlisted", "Waitlisted", "Accepted", "Certificate issued"],
};

const TERMINAL_STATUSES = ["Invalid", "Cancelled", "Rejected", "Expired"];

const STATUS_ALIASES: Record<string, string> = {
  "pre registration": "Pre-registration",
  preregistration: "Pre-registration",
  prereg: "Pre-registration",
  "main registration": "Main registration",
  mainregistration: "Main registration",
  "e ticket": "E-ticket",
  eticket: "E-ticket",
  ticket: "E-ticket",
  "e ticket issued": "E-ticket",
  eticketissued: "E-ticket",
  issued: "Issued",
  "checked in": "Checked in",
  checkedin: "Checked in",
  "check in": "Checked in",
  scanned: "Checked in",
  "certificate issued": "Certificate issued",
  certificateissued: "Certificate issued",
  "cert issued": "Certificate issued",
  certificate: "Certificate issued",
  cert: "Certificate issued",
  expired: "Expired",
  underreview: "Under Review",
  "under review": "Under Review",
  shortlist: "Shortlisted",
  waitlist: "Waitlisted",
  accept: "Accepted",
  approved: "Approved",
  reject: "Rejected",
  invalid: "Invalid",
  cancel: "Cancelled",
  cancelled: "Cancelled",
  canceled: "Cancelled",
};

export type PartnerStatusCatalog = Record<PartnerPortalId, string[]>;

export type PipelineStep = { key: string; label: string };

export function prettyPartnerStatus(raw?: string) {
  const value = (raw ?? "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!value) return "";
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusKey(value?: string) {
  return prettyPartnerStatus(value).toLowerCase();
}

export function canonicalizePartnerStatus(raw?: string) {
  const pretty = prettyPartnerStatus(raw);
  if (!pretty) return "";
  const key = pretty.toLowerCase();
  if (STATUS_ALIASES[key]) return STATUS_ALIASES[key];
  const compact = key.replace(/\s+/g, "");
  if (STATUS_ALIASES[compact]) return STATUS_ALIASES[compact];
  const aliases = Object.entries(STATUS_ALIASES).sort((left, right) => right[0].length - left[0].length);
  for (const [alias, label] of aliases) {
    if (alias.length < 4) continue;
    if (key.includes(alias) || compact.includes(alias.replace(/\s+/g, ""))) return label;
  }
  return pretty;
}

export function isTerminalPartnerStatus(raw?: string) {
  const key = canonicalizePartnerStatus(raw).toLowerCase();
  return TERMINAL_STATUSES.some((item) => item.toLowerCase() === key);
}

function orderedUnique(values: string[]) {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const label = canonicalizePartnerStatus(value) || prettyPartnerStatus(value);
    if (!label) continue;
    const key = statusKey(label);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(label);
  }
  return next;
}

export function mergeStatusCatalog(live: Partial<PartnerStatusCatalog> | undefined, extra: string[] = []): PartnerStatusCatalog {
  const next: PartnerStatusCatalog = {
    seminar: [],
    autism: [],
    fellowship: [],
  };
  for (const portal of Object.keys(next) as PartnerPortalId[]) {
    next[portal] = orderedUnique([...PIPELINE_ORDER[portal], ...fallbackApplicationStatuses[portal], ...(live?.[portal] ?? [])]);
  }
  void extra;
  return next;
}

export function pipelineStepsFor(
  portal: PartnerPortalId | undefined,
  catalog?: Partial<PartnerStatusCatalog>,
  rawStatus?: string,
): PipelineStep[] {
  if (!portal) {
    return applicationPipelineSteps.map((step) => ({ key: step.key, label: step.label }));
  }
  const merged = mergeStatusCatalog(catalog);
  const seen = new Set<string>();
  const steps: PipelineStep[] = [];
  const add = (value: string, allowTerminal = false) => {
    const label = canonicalizePartnerStatus(value) || prettyPartnerStatus(value);
    if (!label) return;
    if (!allowTerminal && isTerminalPartnerStatus(label)) return;
    const key = statusKey(label);
    if (seen.has(key)) return;
    seen.add(key);
    steps.push({ key: label, label });
  };
  for (const item of PIPELINE_ORDER[portal]) add(item);
  for (const item of merged[portal]) add(item);
  if (rawStatus && !isTerminalPartnerStatus(rawStatus)) add(rawStatus);
  if (rawStatus && isTerminalPartnerStatus(rawStatus)) add(rawStatus, true);
  return steps;
}

export function pipelineIndexFor(steps: PipelineStep[], raw?: string, fallback?: string) {
  const needle = statusKey(canonicalizePartnerStatus(raw) || canonicalizePartnerStatus(fallback) || raw || fallback);
  if (!needle) return 0;
  const exact = steps.findIndex((step) => statusKey(step.key) === needle);
  if (exact >= 0) return exact;
  const fuzzy = steps.findIndex((step) => {
    const key = statusKey(step.key);
    return needle.includes(key) || key.includes(needle);
  });
  return fuzzy >= 0 ? fuzzy : 0;
}

export type TrackedApplication = {
  application: Application;
  ticket?: PartnerTicketSummary;
  portal?: PartnerPortalId;
  portalLabel?: string;
  source: "local" | "partner";
};

export function normalizeApplicationStatus(raw?: string): Application["status"] {
  const value = (raw ?? "").toLowerCase().replace(/[_-]+/g, " ").trim();
  if (/(reject|declin|invalid|cancel|fail|withdraw)/.test(value)) return "Rejected";
  if (/(certificate|checked in|check in|confirm|complete|issued|paid|captured|success|registered|\bvalid\b)/.test(value)) {
    return "Confirmed";
  }
  if (/(approv|accept|shortlist|selected)/.test(value)) return "Approved";
  if (/(review|process|pending|verify)/.test(value)) return "Under Review";
  return "Submitted";
}

export function ticketMatchesQuery(ticket: PartnerTicketSummary, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return false;
  return (
    ticket.id.toLowerCase() === needle ||
    (ticket.applicationNo ?? "").toLowerCase() === needle ||
    ticket.id.toLowerCase().endsWith(`-${needle}`) ||
    (ticket.applicationNo ?? "").toLowerCase().replace(/\s+/g, "") === needle.replace(/\s+/g, "")
  );
}

export function applicationFromTicket(ticket: PartnerTicketSummary, email = ""): Application {
  return {
    applicationId: ticket.applicationNo || ticket.id,
    eventId: ticket.id,
    eventName: ticket.eventName,
    name: "",
    email,
    status: normalizeApplicationStatus(ticket.status),
    appliedAt: ticket.issuedAt || new Date().toISOString(),
  };
}

export function trackedFromTicket(ticket: PartnerTicketSummary, email = ""): TrackedApplication {
  return {
    application: applicationFromTicket(ticket, email),
    ticket,
    portal: ticket.portal,
    portalLabel: partnerPortalLabel(ticket.portal),
    source: "partner",
  };
}

export function findLocalTrackedApplication(query: string): TrackedApplication | null {
  const id = query.trim().toUpperCase();
  if (!id) return null;
  const local = getAllApplications().find((item) => item.applicationId.toUpperCase() === id);
  if (!local) return null;
  return { application: local, source: "local" };
}

export function findStoredPartnerApplication(query: string, email?: string): TrackedApplication | null {
  if (email) {
    const mine = getPartnerTickets(email).find((ticket) => ticketMatchesQuery(ticket, query));
    if (mine) return trackedFromTicket(mine, email);
  }
  for (const [owner, tickets] of Object.entries(listStoredPartnerTickets())) {
    const found = tickets.find((ticket) => ticketMatchesQuery(ticket, query));
    if (found) return trackedFromTicket(found, owner);
  }
  return null;
}

export function resolveTrackedApplication(query: string, email?: string): TrackedApplication | null {
  return findLocalTrackedApplication(query) ?? findStoredPartnerApplication(query, email);
}

export function kindLabel(kind?: PartnerTicketSummary["kind"]) {
  if (kind === "application") return "Application";
  if (kind === "ticket") return "E-ticket";
  return "Registration";
}
