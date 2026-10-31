import type { Event, RegistrationStatus } from "@/types";

type EventDates = Pick<Event, "startDate" | "endDate" | "registrationEnd" | "registrationStatus" | "tbd">;

function parseStamp(value?: string, endOfDay = false) {
  if (!value) return NaN;
  const trimmed = value.trim();
  if (!trimmed) return NaN;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return Date.parse(endOfDay ? `${trimmed}T23:59:59` : `${trimmed}T00:00:00`);
  }
  return Date.parse(trimmed);
}

export function isEventPast(event: Pick<Event, "startDate" | "endDate" | "tbd">, now = Date.now()) {
  if (event.tbd?.dates) return false;
  const end = parseStamp(event.endDate || event.startDate, true);
  if (!Number.isFinite(end)) return false;
  return end < now;
}

export function isRegistrationClosed(event: EventDates, now = Date.now()) {
  if (event.registrationStatus === "Closed") return true;
  if (isEventPast(event, now)) return true;
  const closes = parseStamp(event.registrationEnd, true);
  return Number.isFinite(closes) && closes < now;
}

export function resolvedRegistrationStatus(event: EventDates, now = Date.now()): RegistrationStatus {
  if (isRegistrationClosed(event, now)) return "Closed";
  return event.registrationStatus;
}

export function withResolvedRegistration<T extends EventDates>(event: T, now = Date.now()): T {
  const status = resolvedRegistrationStatus(event, now);
  return status === event.registrationStatus ? event : { ...event, registrationStatus: status };
}

export function isPublicFellowshipEvent(event: Pick<Event, "id" | "source" | "slug" | "eventType">) {
  return (
    event.source === "fellowship" ||
    event.eventType === "Fellowship" ||
    String(event.id || "").startsWith("fellowship-") ||
    String(event.slug || "").startsWith("fellowship-")
  );
}
