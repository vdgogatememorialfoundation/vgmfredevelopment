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
