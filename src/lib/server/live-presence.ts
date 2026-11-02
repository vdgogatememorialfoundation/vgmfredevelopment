import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { dataFile } from "@/lib/server/paths";

export type PresenceAudience = "visitor" | "customer";

export type LivePresence = {
  sessionId: string;
  path: string;
  title: string;
  city: string;
  region: string;
  country: string;
  lat?: number;
  lng?: number;
  audience: PresenceAudience;
  label: string;
  firstSeen: string;
  lastSeen: string;
};

export type PageActivity = {
  id: string;
  sessionId: string;
  path: string;
  title: string;
  city: string;
  country: string;
  audience: PresenceAudience;
  label: string;
  at: string;
};

export type CustomerAction = {
  id: string;
  at: string;
  email: string;
  kind: string;
  detail: string;
};

type Store = {
  live: LivePresence[];
  pages: PageActivity[];
  customers: CustomerAction[];
};

const FILE = () => dataFile("live-presence.json");
const LIVE_MS = 5 * 60 * 1000;

function readStore(): Store {
  try {
    const parsed = JSON.parse(readFileSync(FILE(), "utf8")) as Store;
    return {
      live: Array.isArray(parsed.live) ? parsed.live : [],
      pages: Array.isArray(parsed.pages) ? parsed.pages : [],
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
    };
  } catch {
    return { live: [], pages: [], customers: [] };
  }
}

function writeStore(store: Store) {
  const file = FILE();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(store));
}

function cleanPath(value: string) {
  const path = value.trim().slice(0, 180);
  if (!path.startsWith("/") || path.startsWith("//")) return "";
  if (path.startsWith("/admin") || path.startsWith("/staff") || path.startsWith("/doctor") || path.startsWith("/api")) return "";
  return path.split("?")[0];
}

function cleanText(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function recordPresence(input: {
  sessionId: string;
  path: string;
  title?: string;
  city?: string;
  region?: string;
  country?: string;
  lat?: number;
  lng?: number;
  audience?: PresenceAudience;
  label?: string;
}) {
  const path = cleanPath(input.path || "/");
  const sessionId = cleanText(input.sessionId || "", 40);
  if (!path || !sessionId) return;
  const now = new Date().toISOString();
  const audience: PresenceAudience = input.audience === "customer" ? "customer" : "visitor";
  const label = cleanText(input.label || "", 40).replace(/@/g, "");
  const store = readStore();
  const cutoff = Date.now() - LIVE_MS;
  const previous = store.live.find((row) => row.sessionId === sessionId);
  const next: LivePresence = {
    sessionId,
    path,
    title: cleanText(input.title || path, 120),
    city: cleanText(input.city || "", 80),
    region: cleanText(input.region || "", 80),
    country: cleanText(input.country || "", 80),
    lat: typeof input.lat === "number" && Number.isFinite(input.lat) ? input.lat : undefined,
    lng: typeof input.lng === "number" && Number.isFinite(input.lng) ? input.lng : undefined,
    audience,
    label,
    firstSeen: previous?.firstSeen || now,
    lastSeen: now,
  };
  const changedPage = !previous || previous.path !== path;
  store.live = [next, ...store.live.filter((row) => row.sessionId !== sessionId && Date.parse(row.lastSeen) >= cutoff)].slice(0, 200);
  if (changedPage) {
    store.pages = [
      {
        id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        sessionId,
        path,
        title: next.title,
        city: next.city,
        country: next.country,
        audience,
        label,
        at: now,
      },
      ...store.pages,
    ].slice(0, 400);
  }
  writeStore(store);
}

export function recordCustomerAction(input: { email?: string; kind?: string; detail?: string }) {
  const email = cleanText(input.email || "", 120).toLowerCase();
  const kind = cleanText(input.kind || "", 40);
  if (!email.includes("@") || !kind) return;
  const store = readStore();
  store.customers = [
    {
      id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      email,
      kind,
      detail: cleanText(input.detail || "", 180),
    },
    ...store.customers,
  ].slice(0, 400);
  writeStore(store);
}

export function presenceReport() {
  const store = readStore();
  const cutoff = Date.now() - LIVE_MS;
  const day = Date.now() - 24 * 60 * 60 * 1000;
  return {
    live: store.live.filter((row) => Date.parse(row.lastSeen) >= cutoff),
    userActivity: store.pages.filter((row) => Date.parse(row.at) >= day),
    customerActivity: store.customers.filter((row) => Date.parse(row.at) >= day),
    customerBrowsing: store.pages.filter((row) => row.audience === "customer" && Date.parse(row.at) >= day),
  };
}
