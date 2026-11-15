import { readFileSync, writeFileSync } from "node:fs";
import { dataFile } from "@/lib/server/paths";
import { lookupPostal } from "@/lib/server/postal-lookup";

type Office = { Name?: string; District?: string; State?: string };

const NOISE = /\b(hub|facility|warehouse|center|centre|gateway|dc|sc|pc|ds|mh|ekl|motherhub|mother|branch|office|depot|sorting|ndc|rpc|crc)\b/gi;
const memory = new Map<string, string>();
let loaded = false;

function cacheFile() {
  return dataFile("place-states.json");
}

function loadCache() {
  if (loaded) return;
  loaded = true;
  try {
    const saved = JSON.parse(readFileSync(cacheFile(), "utf8")) as Record<string, string>;
    for (const [key, value] of Object.entries(saved)) memory.set(key, value);
  } catch {
    /* first run */
  }
}

function saveCache() {
  try {
    writeFileSync(cacheFile(), JSON.stringify(Object.fromEntries(memory)));
  } catch {
    /* read-only data dir: keep the in-memory copy */
  }
}

const titleCase = (value: string) => value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

/** The town in a courier scan location: "THANE", "Thane_Hub (Maharashtra)", "Bhiwandi_MH" → "Thane", "Bhiwandi". */
function townOf(location: string) {
  const first = location.split(/[,|(]/)[0] ?? "";
  return first.replace(/[_-]+/g, " ").replace(/\d+/g, " ").replace(NOISE, " ").replace(/\s+/g, " ").trim();
}

async function stateFor(town: string) {
  const key = town.toLowerCase();
  loadCache();
  if (memory.has(key)) return memory.get(key) ?? "";
  const response = await fetch(`https://api.postalpincode.in/postoffice/${encodeURIComponent(town)}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  }).catch(() => null);
  if (!response?.ok) return "";
  const rows = (await response.json().catch(() => null)) as { PostOffice?: Office[] | null }[] | null;
  const offices = rows?.[0]?.PostOffice ?? [];
  const same = (value?: string) => (value ?? "").trim().toLowerCase() === key;
  const best = offices.find((row) => same(row.District)) ?? offices.find((row) => same(row.Name));
  // Only an exact district or post-office match counts, so hub codes are never given a wrong state.
  const state = best?.State ?? "";
  memory.set(key, state);
  saveCache();
  return state;
}

/** "THANE" → "Thane, Maharashtra, India". Left as it is when the town cannot be placed. */
export async function placeWithState(location?: string) {
  const raw = (location ?? "").replace(/\s+/g, " ").trim();
  if (!raw || /^-?\d+(\.\d+)?\s*,\s*-?\d+/.test(raw)) return raw;
  if (/,\s*india$/i.test(raw)) return raw;
  const pin = raw.match(/\b\d{6}\b/)?.[0];
  if (pin) {
    const place = await lookupPostal({ postal: pin, countryCode: "IN" }).catch(() => null);
    if (place?.state) return `${titleCase(place.city || townOf(raw) || raw)}, ${place.state}, India`;
  }
  const town = townOf(raw);
  if (town.replace(/[^a-z]/gi, "").length < 3) return raw;
  const state = await stateFor(town).catch(() => "");
  return state ? `${titleCase(town)}, ${state}, India` : raw;
}

/** Adds state and country to every scan location (one lookup per town, cached on disk). */
export async function withScanPlaces<T extends { location?: string }>(events: T[] = []): Promise<T[]> {
  const towns = [...new Set(events.map((event) => event.location ?? "").filter(Boolean))];
  const resolved = new Map(await Promise.all(towns.map(async (town) => [town, await placeWithState(town)] as const)));
  return events.map((event) => (event.location ? { ...event, location: resolved.get(event.location) || event.location } : event));
}
