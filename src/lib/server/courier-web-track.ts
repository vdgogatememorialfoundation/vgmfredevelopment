import { isCourierInfoLine } from "@/lib/order-pipeline";
import { courierTrackingCode, courierTrackingLink, directCourier } from "@/lib/couriers";

/**
 * Reads tracking scans for couriers sent without an API account: first from the
 * courier's own public tracking site, then from a tracking service key
 * (AfterShip / TrackingMore / 17TRACK) when one is saved in Shipping APIs.
 */

type Json = Record<string, unknown>;
type Scan = { at: string; status: string; location?: string };
export type CourierWebHit = {
  status: string;
  events: Scan[];
  trackingUrl: string;
  courierName: string;
  awb: string;
  expectedBy?: string;
  source: string;
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { at: number; hit: CourierWebHit | null }>();

async function fetchText(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("user-agent")) headers.set("user-agent", UA);
  if (!headers.has("accept-language")) headers.set("accept-language", "en-IN,en;q=0.9");
  const response = await fetch(url, { ...init, headers, redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(15000) });
  return { response, text: await response.text() };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Expand JSON values that arrive as strings (Amazon sends nested JSON strings). */
function expand(value: unknown, depth = 0): unknown {
  if (depth > 6) return value;
  if (typeof value === "string" && /^\s*[[{]/.test(value)) {
    const parsed = parseJson(value);
    return parsed === null ? value : expand(parsed, depth + 1);
  }
  if (Array.isArray(value)) return value.map((item) => expand(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Json).map(([key, item]) => [key, expand(item, depth + 1)]));
  }
  return value;
}

const TIME_KEY = /(time|date|timestamp|^at$|when)/i;
const TEXT_KEY = /(status|remark|message|description|activity|detail|event|scan|instruction|summary|localisedstringid)/i;
const PLACE_KEY = /(location|city|hub|place|office|branch|origin|area)/i;

function flatText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(flatText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const object = value as Json;
    for (const key of ["name", "city", "displayName", "localisedStringId", "text", "value", "description"]) {
      const text = flatText(object[key]);
      if (text) return text;
    }
    return Object.values(object).map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean).slice(0, 3).join(", ");
  }
  return "";
}

function toIso(value: unknown, extraTime = ""): string {
  if (typeof value === "number") return new Date(value > 1e12 ? value : value * 1000).toISOString();
  const text = `${flatText(value)} ${extraTime}`.trim();
  if (!text) return "";
  // Courier sites print Indian time without a zone.
  const zoned = /(z|[+-]\d{2}:?\d{2}|\bgmt\b|\butc\b)/i.test(text.replace(/^\d{4}-\d{2}-\d{2}/, ""));
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const iso = text.length <= 10 ? `${text}T00:00:00` : text.replace(" ", "T");
    const ms = Date.parse(zoned ? iso : `${iso}+05:30`);
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }
  if (zoned) {
    const ms = Date.parse(text);
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }
  const dmy = text.match(/(\d{1,2})[-/ ](\w{3,9}|\d{1,2})[-/ ,]+(\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?/i);
  if (!dmy) {
    const ms = Date.parse(`${text} GMT+0530`);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : "";
  }
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = /^\d+$/.test(dmy[2]) ? Number(dmy[2]) - 1 : months.indexOf(dmy[2].slice(0, 3).toLowerCase());
  if (month < 0) return "";
  let year = Number(dmy[3]);
  if (year < 100) year += 2000;
  let hour = Number(dmy[4] ?? 0);
  if (dmy[7]?.toLowerCase() === "pm" && hour < 12) hour += 12;
  if (dmy[7]?.toLowerCase() === "am" && hour === 12) hour = 0;
  const pad = (n: number) => String(n).padStart(2, "0");
  const ms = Date.parse(`${year}-${pad(month + 1)}-${pad(Number(dmy[1]))}T${pad(hour)}:${pad(Number(dmy[5] ?? 0))}:${pad(Number(dmy[6] ?? 0))}+05:30`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : "";
}

function eventFrom(item: Json): Scan | null {
  const keys = Object.keys(item);
  const timeKey = keys.find((key) => TIME_KEY.test(key) && toIso(item[key]));
  const textRank = (key: string) =>
    /(code|id|type)$/i.test(key) ? 9 : /(remark|message|description|detail|summary|activity|instruction|localised)/i.test(key) ? 0 : /status/i.test(key) ? 1 : 2;
  const textKey = keys
    .filter((key) => TEXT_KEY.test(key) && flatText(item[key]) && !TIME_KEY.test(key) && textRank(key) < 9)
    .sort((x, y) => textRank(x) - textRank(y))[0];
  if (!timeKey || !textKey) return null;
  const clock = keys.find((key) => /^time$/i.test(key) && key !== timeKey);
  const placeKey = keys.find((key) => PLACE_KEY.test(key) && flatText(item[key]));
  return {
    at: toIso(item[timeKey], clock ? flatText(item[clock]) : ""),
    status: flatText(item[textKey]).slice(0, 200),
    location: placeKey ? flatText(item[placeKey]).slice(0, 120) : undefined,
  };
}

/** Finds the longest list of scan-like objects anywhere in a JSON reply. */
function scansFromJson(root: unknown): Scan[] {
  let best: Scan[] = [];
  const walk = (value: unknown, depth: number) => {
    if (depth > 10 || !value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      const events = value.map((item) => (item && typeof item === "object" && !Array.isArray(item) ? eventFrom(item as Json) : null)).filter(Boolean) as Scan[];
      if (events.length > best.length) best = events;
      value.forEach((item) => walk(item, depth + 1));
      return;
    }
    Object.values(value as Json).forEach((item) => walk(item, depth + 1));
  };
  walk(root, 0);
  return best;
}

function findKey(root: unknown, pattern: RegExp, depth = 0): string {
  if (depth > 8 || !root || typeof root !== "object") return "";
  if (Array.isArray(root)) {
    for (const item of root) {
      const found = findKey(item, pattern, depth + 1);
      if (found) return found;
    }
    return "";
  }
  for (const [key, value] of Object.entries(root as Json)) {
    if (pattern.test(key) && (typeof value === "string" || typeof value === "number") && String(value).trim()) return String(value).trim();
  }
  for (const value of Object.values(root as Json)) {
    const found = findKey(value, pattern, depth + 1);
    if (found) return found;
  }
  return "";
}

function strip(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

/** Courier tracking pages: scan tables (mapped by their header row) plus "Label | value" summary rows. */
function scansFromHtml(html: string): { events: Scan[]; facts: Record<string, string> } {
  const rows = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) => [...match[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => strip(cell[1])));
  const dateCell = /(\d{1,2}[-/ ](\w{3,9}|\d{1,2})[-/ ,]+\d{2,4})|(\d{4}-\d{2}-\d{2})/;
  const textCol = /(detail|status|activity|remark|description|event|scan)/;
  const events: Scan[] = [];
  const facts: Record<string, string> = {};
  let header: string[] | null = null;
  for (const cells of rows) {
    if (cells.length < 2) continue;
    const lower = cells.map((cell) => cell.toLowerCase());
    if (lower.some((cell) => /(^|\s)date\b/.test(cell)) && lower.some((cell) => textCol.test(cell)) && !cells.some((cell) => dateCell.test(cell))) {
      header = lower;
      continue;
    }
    if (cells.length === 2 && cells[0] && cells[0].length < 40 && !dateCell.test(cells[0])) {
      facts[lower[0].replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim()] = cells[1];
      if (!dateCell.test(cells[1]) || isCourierInfoLine(cells[0])) continue;
    }
    if (header && cells.length === header.length) {
      const cols = header;
      const col = (pattern: RegExp) => cols.findIndex((name) => pattern.test(name));
      const dateIdx = col(/(^|\s)date\b/);
      const timeIdx = col(/time/);
      const textIdx = col(textCol);
      const placeIdx = col(/(location|place|city|office|hub|branch|origin)/);
      const at = dateIdx >= 0 ? toIso(cells[dateIdx], timeIdx >= 0 && timeIdx !== dateIdx ? cells[timeIdx] : "") : "";
      if (at && textIdx >= 0 && cells[textIdx]) {
        events.push({ at, status: cells[textIdx].slice(0, 200), location: placeIdx >= 0 ? cells[placeIdx].slice(0, 120) || undefined : undefined });
        continue;
      }
    }
    const dateIdx = cells.findIndex((cell) => dateCell.test(cell) && cell.length < 40);
    if (dateIdx < 0) continue;
    const timeIdx = cells.findIndex((cell, index) => index !== dateIdx && /^\d{1,2}:\d{2}/.test(cell));
    const rest = cells.filter((cell, index) => index !== dateIdx && index !== timeIdx && cell && !/^\d{1,2}:\d{2}/.test(cell));
    if (!rest.length || rest.some((cell) => isCourierInfoLine(cell))) continue;
    const sorted = [...rest].sort((a, b) => b.length - a.length);
    const at = toIso(cells[dateIdx], timeIdx >= 0 ? cells[timeIdx] : "");
    if (!at) continue;
    events.push({ at, status: sorted[0].slice(0, 200), location: sorted[1]?.slice(0, 120) });
  }
  return { events, facts };
}

function hit(courierId: string, awb: string, events: Scan[], source: string, status = "", expectedBy = ""): CourierWebHit | null {
  const latest = Date.now() + 6 * 3600_000;
  const sorted = [...events]
    .filter((event) => event.status && !isCourierInfoLine(event.status) && Date.parse(event.at) <= latest && Date.parse(event.at) > Date.UTC(2015, 0, 1))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  if (isCourierInfoLine(status)) status = "";
  if (!sorted.length && !status) return null;
  return {
    status: status || sorted.at(-1)?.status || "",
    events: sorted,
    trackingUrl: courierTrackingLink(courierId, awb),
    courierName: directCourier(courierId)?.label ?? "Courier",
    awb,
    expectedBy: expectedBy ? toIso(expectedBy) || undefined : undefined,
    source,
  };
}

function fromJson(courierId: string, awb: string, data: unknown, source: string) {
  const root = expand(data);
  const events = scansFromJson(root);
  const status = findKey(root, /^(current_?status|currentStatus|latestStatus|shipmentStatus|statusDetails|status)$/i);
  const expected = findKey(root, /(expected|edd|promise|estimated)/i);
  return hit(courierId, awb, events, source, /^\d+$/.test(status) ? "" : status, expected);
}

async function amazon(awb: string) {
  const { response, text } = await fetchText(`https://track.amazon.in/api/tracker/${encodeURIComponent(awb)}`, { headers: { accept: "application/json" } });
  if (!response.ok) return null;
  const data = expand(parseJson(text)) as Json | null;
  if (!data || JSON.stringify(data.progressTracker ?? "").includes("TRACKING_ID_NOT_FOUND")) return null;
  return fromJson("amazon-shipping", awb, data, "track.amazon.in");
}

async function delhivery(awb: string) {
  const { response, text } = await fetchText(`https://dlv-api.delhivery.com/v3/unified-tracking?wbn=${encodeURIComponent(awb)}`, {
    headers: { accept: "application/json", origin: "https://www.delhivery.com", referer: "https://www.delhivery.com/" },
  });
  if (!response.ok) return null;
  const data = parseJson(text) as Json | null;
  if (!data || !Array.isArray(data.data) || !data.data.length) return null;
  const row = data.data[0] as Json;
  const current = (row.status as Json) ?? {};
  const scans = ((row.trackingStates as Json[]) ?? []).flatMap((state) =>
    ((state.scans as Json[]) ?? []).map((scan) => ({ scan, state }))
  );
  const place = (scan?: Json) => flatText(scan?.cityLocation) || flatText(scan?.scannedLocation) || undefined;
  const events: Scan[] = [];
  for (const { scan, state } of scans) {
    const at = toIso(flatText(scan.scanDateTime) || flatText(scan.scanDate) || flatText(state.scanDateTime) || flatText(state.date));
    const text = flatText(scan.scanNslRemark) || flatText(scan.scan) || flatText(state.label);
    if (at && text) events.push({ at, status: text.slice(0, 200), location: place(scan) });
  }
  // Delhivery leaves the latest scan undated; its time is the shipment's statusDateTime.
  const latestAt = toIso(flatText(current.statusDateTime));
  const last = scans.at(-1)?.scan;
  if (latestAt && !events.some((event) => event.at === latestAt)) {
    const text = flatText(last?.scanNslRemark) || flatText(row.hqStatus) || flatText(current.instructions);
    if (text) events.push({ at: latestAt, status: text.slice(0, 200), location: place(last) });
  }
  return hit("delhivery", awb, events, "delhivery.com", flatText(row.hqStatus), flatText(row.promiseDeliveryDate));
}

async function ekart(awb: string) {
  const page = await fetchText(`https://ekartlogistics.com/ekartlogistics-web/shipmenttrack/${encodeURIComponent(awb)}`);
  const token = page.text.match(/name="csrf-token" content="([^"]+)"/)?.[1];
  const cookies = page.response.headers.getSetCookie?.().map((cookie) => cookie.split(";")[0]).join("; ") ?? "";
  if (!token) return null;
  const { response, text } = await fetchText("https://ekartlogistics.com/ekartlogistics-web-routes-api/ekartlogistics-web-proxy/trackings/v2", {
    method: "POST",
    headers: { "content-type": "application/json", "csrf-token": token, cookie: cookies, "x-user-agent": `${UA} EKCL/website/1` },
    body: JSON.stringify({ tracking_ids: awb }),
  });
  if (!response.ok) return null;
  return fromJson("ekart", awb, parseJson(text), "ekartlogistics.com");
}

/** Any other courier: read its public tracking page (JSON or scan table). */
async function trackingPage(courierId: string, awb: string) {
  const url = courierTrackingLink(courierId, awb);
  if (!url) return null;
  const { response, text } = await fetchText(url);
  if (!response.ok) return null;
  const json = parseJson(text);
  if (json) return fromJson(courierId, awb, json, new URL(url).hostname);
  const page = scansFromHtml(text);
  const expected = Object.entries(page.facts).find(([label]) => /(expected|estimated|edd|promise)/.test(label))?.[1] ?? "";
  return hit(courierId, awb, page.events, new URL(url).hostname, page.facts.status ?? page.facts["current status"] ?? "", expected);
}

const SITE_READERS: Record<string, (awb: string) => Promise<CourierWebHit | null>> = {
  "amazon-shipping": amazon,
  delhivery,
  ekart,
};

export type TrackerCreds = { service?: string; apiKey?: string; enabled?: boolean };

async function aftership(key: string, courierId: string, awb: string) {
  const slug = courierTrackingCode(courierId);
  const headers = { "as-api-key": key, "content-type": "application/json" };
  const base = "https://api.aftership.com/tracking/2024-04/trackings";
  await fetchText(base, { method: "POST", headers, body: JSON.stringify({ tracking_number: awb, ...(slug ? { slug } : {}) }) }).catch(() => null);
  const { response, text } = await fetchText(`${base}?tracking_numbers=${encodeURIComponent(awb)}${slug ? `&slug=${slug}` : ""}`, { headers });
  if (!response.ok) return null;
  const tracking = ((parseJson(text) as Json)?.data as Json)?.trackings as Json[] | undefined;
  const first = tracking?.[0];
  if (!first) return null;
  const events = ((first.checkpoints as Json[]) ?? []).map((point) => ({
    at: toIso(point.checkpoint_time),
    status: flatText(point.message ?? point.subtag_message ?? point.tag),
    location: flatText(point.location ?? point.city),
  }));
  return hit(courierId, awb, events, "AfterShip", flatText(first.subtag_message ?? first.tag), flatText(first.expected_delivery ?? first.courier_estimated_delivery_date));
}

async function trackingmore(key: string, courierId: string, awb: string) {
  const code = courierTrackingCode(courierId);
  const headers = { "Tracking-Api-Key": key, "content-type": "application/json" };
  if (code) await fetchText("https://api.trackingmore.com/v4/trackings/create", { method: "POST", headers, body: JSON.stringify({ tracking_number: awb, courier_code: code }) }).catch(() => null);
  const { response, text } = await fetchText(`https://api.trackingmore.com/v4/trackings/get?tracking_numbers=${encodeURIComponent(awb)}${code ? `&courier_code=${code}` : ""}`, { headers });
  if (!response.ok) return null;
  const first = ((parseJson(text) as Json)?.data as Json[] | undefined)?.[0];
  if (!first) return null;
  const info = (first.origin_info as Json)?.trackinfo as Json[] | undefined;
  const events = (info ?? []).map((point) => ({ at: toIso(point.checkpoint_date), status: flatText(point.tracking_detail ?? point.checkpoint_delivery_status), location: flatText(point.location) }));
  return hit(courierId, awb, events, "TrackingMore", flatText(first.latest_event ?? first.delivery_status), flatText(first.scheduled_delivery_date));
}

async function seventeenTrack(key: string, courierId: string, awb: string) {
  const headers = { "17token": key, "content-type": "application/json" };
  await fetchText("https://api.17track.net/track/v2.2/register", { method: "POST", headers, body: JSON.stringify([{ number: awb }]) }).catch(() => null);
  const { response, text } = await fetchText("https://api.17track.net/track/v2.2/gettrackinfo", { method: "POST", headers, body: JSON.stringify([{ number: awb }]) });
  if (!response.ok) return null;
  const accepted = (((parseJson(text) as Json)?.data as Json)?.accepted as Json[] | undefined)?.[0];
  const info = accepted?.track_info as Json | undefined;
  if (!info) return null;
  const providers = ((info.tracking as Json)?.providers as Json[] | undefined) ?? [];
  const events = ((providers[0]?.events as Json[]) ?? []).map((point) => ({ at: toIso(point.time_iso ?? point.time_utc), status: flatText(point.description), location: flatText(point.location) }));
  const latest = (info.latest_status as Json)?.status;
  return hit(courierId, awb, events, "17TRACK", flatText(latest), flatText(((info.time_metrics as Json)?.estimated_delivery_date as Json)?.to));
}

async function trackingService(creds: TrackerCreds, courierId: string, awb: string) {
  const key = creds.apiKey?.trim() || process.env.TRACKING_API_KEY?.trim() || "";
  if (!key || creds.enabled === false) return null;
  const service = creds.service || process.env.TRACKING_SERVICE || "aftership";
  if (service === "trackingmore") return trackingmore(key, courierId, awb);
  if (service === "17track") return seventeenTrack(key, courierId, awb);
  return aftership(key, courierId, awb);
}

export async function courierWebTrack(courierId: string, awb: string, creds: TrackerCreds = {}): Promise<CourierWebHit | null> {
  const id = directCourier(courierId)?.id ?? "other";
  const number = awb.trim();
  if (number.length < 3) return null;
  const cacheKey = `${id}:${number}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.hit;
  let found: CourierWebHit | null = null;
  try {
    found = await (SITE_READERS[id] ?? ((value: string) => trackingPage(id, value)))(number);
  } catch {
    found = null;
  }
  if (!found?.events.length) {
    try {
      found = (await trackingService(creds, id, number)) ?? found;
    } catch {
      /* keep the site result */
    }
  }
  cache.set(cacheKey, { at: Date.now(), hit: found });
  return found;
}
