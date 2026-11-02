import type { Event, RegistrationStatus, RegistrationWindow } from "@/types";

export type WindowPhase = "upcoming" | "open" | "closing" | "closed";

function parseStamp(value?: string) {
  if (!value) return NaN;
  const trimmed = value.trim();
  if (!trimmed) return NaN;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return Date.parse(`${trimmed}T00:00:00`);
  return Date.parse(trimmed);
}

export function windowPhase(window: RegistrationWindow, now = Date.now()): WindowPhase {
  const start = parseStamp(window.start);
  const end = parseStamp(window.end);
  if (Number.isFinite(start) && start > now) return "upcoming";
  if (Number.isFinite(end) && end <= now) return "closed";
  if (Number.isFinite(end) && end - now < 3 * 24 * 60 * 60 * 1000) return "closing";
  return "open";
}

export function configuredWindows(event: Pick<Event, "preRegistration" | "mainRegistration">) {
  return [event.preRegistration, event.mainRegistration].filter((window): window is RegistrationWindow => Boolean(window?.label));
}

export function portalRegistrationPhase(event: Pick<Event, "preRegistration" | "mainRegistration">, now = Date.now()) {
  const phases = configuredWindows(event).map((window) => windowPhase(window, now));
  if (!phases.length) return "none" as const;
  if (phases.includes("closing")) return "closing" as const;
  if (phases.includes("open")) return "open" as const;
  if (phases.includes("upcoming")) return "upcoming" as const;
  return "closed" as const;
}

export function registrationBadge(event: Event, now = Date.now()) {
  const windows = configuredWindows(event);
  if (!windows.length) return "";
  const ranked = windows
    .map((window) => ({ window, phase: windowPhase(window, now) }))
    .sort((a, b) => Number(a.window.label === "Pre-registration") - Number(b.window.label === "Pre-registration"));
  const live = ranked.find((item) => item.window.label === "Main registration" && (item.phase === "open" || item.phase === "closing"))
    ?? ranked.find((item) => item.phase === "open" || item.phase === "closing");
  if (live) return live.phase === "closing" ? `${live.window.label} closing` : live.window.label;
  const upcoming = ranked
    .filter((item) => item.phase === "upcoming")
    .sort((a, b) => parseStamp(a.window.start) - parseStamp(b.window.start))[0];
  if (upcoming) return `${upcoming.window.label} soon`;
  return "Registration closed";
}

export function openRegistrationPhase(event: Event, now = Date.now()): "pre" | "main" | "" {
  const windows = configuredWindows(event).map((window) => ({ window, phase: windowPhase(window, now) }));
  const live = windows.filter((item) => item.phase === "open" || item.phase === "closing");
  if (live.some((item) => item.window.label === "Main registration")) return "main";
  if (live.some((item) => item.window.label === "Pre-registration")) return "pre";
  return "";
}

export function collapsedRegistration(windows: RegistrationWindow[], now = Date.now()): { start: string; end: string; status: RegistrationStatus } {
  const ranked = windows.map((window) => ({ window, phase: windowPhase(window, now) }));
  const chosen = ranked.find((item) => item.phase === "open" || item.phase === "closing")
    ?? ranked.find((item) => item.phase === "upcoming")
    ?? ranked.find((item) => item.window.label === "Main registration")
    ?? ranked[0];
  const status: RegistrationStatus = !chosen
    ? "Closed"
    : chosen.phase === "closing"
      ? "Closing Soon"
      : chosen.phase === "closed"
        ? "Closed"
        : "Open";
  return {
    start: chosen?.window.start || "",
    end: chosen?.window.end || "",
    status,
  };
}

export function formatWindowWhen(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return `${date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })} IST`;
}
