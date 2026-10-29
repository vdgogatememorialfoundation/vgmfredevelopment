const HITS_KEY = "vgmf_analytics_hits";
const LIVE_KEY = "vgmf_analytics_live";
const SESSION_KEY = "vgmf_analytics_session";
const MAX_HITS = 2500;
const LIVE_MS = 5 * 60 * 1000;

export type AnalyticsHit = {
  id: string;
  sessionId: string;
  at: string;
  path: string;
  title: string;
  referrer: string;
  country: string;
  region: string;
  city: string;
  lat?: number;
  lng?: number;
};

export type LiveVisitor = AnalyticsHit & { lastSeen: string };

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("vgmf-cms"));
}

export function subscribeAnalytics(onChange: () => void) {
  const handler = () => onChange();
  window.addEventListener("vgmf-cms", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("vgmf-cms", handler);
    window.removeEventListener("storage", handler);
  };
}

export function getHits(): AnalyticsHit[] {
  return read<AnalyticsHit[]>(HITS_KEY, []);
}

export function getLiveVisitors(): LiveVisitor[] {
  const cutoff = Date.now() - LIVE_MS;
  return read<LiveVisitor[]>(LIVE_KEY, []).filter((visitor) => Date.parse(visitor.lastSeen) >= cutoff);
}

function sessionId() {
  if (typeof window === "undefined") return "";
  let id = window.sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    window.sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

type Geo = { country: string; region: string; city: string; lat?: number; lng?: number };

async function lookupGeo(): Promise<Geo> {
  try {
    const response = await fetch("https://ipwho.is/", { cache: "no-store" });
    const data = (await response.json()) as {
      success?: boolean;
      country?: string;
      region?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
    };
    if (!data?.success) return { country: "Unknown", region: "", city: "" };
    return {
      country: data.country || "Unknown",
      region: data.region || "",
      city: data.city || "",
      lat: typeof data.latitude === "number" ? data.latitude : undefined,
      lng: typeof data.longitude === "number" ? data.longitude : undefined,
    };
  } catch {
    return { country: "Unknown", region: "", city: "" };
  }
}

export async function recordVisit(path = typeof window === "undefined" ? "/" : window.location.pathname) {
  if (typeof window === "undefined") return;
  const geo = await lookupGeo();
  const hit: AnalyticsHit = {
    id: `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    sessionId: sessionId(),
    at: new Date().toISOString(),
    path,
    title: document.title || path,
    referrer: document.referrer || "",
    ...geo,
  };
  const hits = [hit, ...getHits()].slice(0, MAX_HITS);
  write(HITS_KEY, hits);
  heartbeat(path, geo);
}

export function heartbeat(path?: string, geo?: Geo) {
  if (typeof window === "undefined") return;
  const current = getLiveVisitors();
  const id = sessionId();
  const existing = current.find((visitor) => visitor.sessionId === id);
  const next: LiveVisitor = {
    id: existing?.id || `l${id}`,
    sessionId: id,
    at: existing?.at || new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    path: path || window.location.pathname,
    title: document.title || path || "/",
    referrer: document.referrer || existing?.referrer || "",
    country: geo?.country || existing?.country || "Unknown",
    region: geo?.region || existing?.region || "",
    city: geo?.city || existing?.city || "",
    lat: geo?.lat ?? existing?.lat,
    lng: geo?.lng ?? existing?.lng,
  };
  write(LIVE_KEY, [next, ...current.filter((visitor) => visitor.sessionId !== id)].slice(0, 200));
}

export function countBy(hits: AnalyticsHit[], key: "country" | "region" | "city" | "path") {
  const map = new Map<string, number>();
  for (const hit of hits) {
    const label = (hit[key] || "Unknown").trim() || "Unknown";
    map.set(label, (map.get(label) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export function uniqueSessions(hits: AnalyticsHit[]) {
  return new Set(hits.map((hit) => hit.sessionId)).size;
}

export function hitsSince(hours: number) {
  const cutoff = Date.now() - hours * 3600_000;
  return getHits().filter((hit) => Date.parse(hit.at) >= cutoff);
}

export function articleHits(hits: AnalyticsHit[]) {
  return hits.filter((hit) => hit.path.startsWith("/articles"));
}
