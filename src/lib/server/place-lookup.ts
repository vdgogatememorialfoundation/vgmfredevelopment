import { readFileSync, writeFileSync } from "node:fs";
import { dataFile } from "@/lib/server/paths";
import { lookupPostal } from "@/lib/server/postal-lookup";

type Office = { Name?: string; District?: string; State?: string };

const NOISE = /\b(hub|facility|warehouse|center|centre|gateway|dc|sc|pc|ds|mh|ekl|motherhub|mother|branch|office|depot|sorting|ndc|rpc|crc)\b/gi;
const memory = new Map<string, string>();
let loaded = false;

function cacheFile() {
  // v2: every state a town name is found in ("Dhanori" is in Pune and in Haryana), joined by "|".
  return dataFile("place-states-v2.json");
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

async function stateFor(town: string, prefer: string[] = []) {
  const key = town.toLowerCase();
  loadCache();
  const pickState = (states: string[]) => {
    const wanted = prefer.map((state) => state.trim().toLowerCase()).filter(Boolean);
    return states.find((state) => wanted.includes(state.toLowerCase())) ?? states[0] ?? "";
  };
  if (memory.has(key)) return pickState((memory.get(key) ?? "").split("|").filter(Boolean));
  const response = await fetch(`https://api.postalpincode.in/postoffice/${encodeURIComponent(town)}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  }).catch(() => null);
  if (!response?.ok) return "";
  const rows = (await response.json().catch(() => null)) as { PostOffice?: Office[] | null }[] | null;
  const offices = rows?.[0]?.PostOffice ?? [];
  const same = (value?: string) => (value ?? "").trim().toLowerCase() === key;
  // Only an exact district or post-office match counts, so hub codes are never given a wrong state.
  const matches = offices.filter((row) => same(row.District)).concat(offices.filter((row) => same(row.Name)));
  const states = [...new Set(matches.map((row) => (row.State ?? "").trim()).filter(Boolean))];
  memory.set(key, states.join("|"));
  saveCache();
  return pickState(states);
}

/** "THANE" → "Thane, Maharashtra, India". Left as it is when the town cannot be placed. */
export async function placeWithState(location?: string, prefer: string[] = []) {
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
  // "SAI THANE" (hub code + town): try the whole name, then each word from the right.
  const words = town.split(" ").filter((word) => word.length >= 4).reverse();
  for (const name of [town, ...words.filter((word) => word !== town)]) {
    const state = await stateFor(name, prefer).catch(() => "");
    if (state) return `${titleCase(name)}, ${state}, India`;
  }
  return raw;
}

/** Adds state and country to every scan location (one lookup per town, cached on disk). */
/** Adds state and country to every scan location (one lookup per town, cached on disk). A town found in several states takes the pickup or delivery state. */
export async function withScanPlaces<T extends { location?: string }>(events: T[] = [], prefer: string[] = []): Promise<T[]> {
  const towns = [...new Set(events.map((event) => event.location ?? "").filter(Boolean))];
  const resolved = new Map(await Promise.all(towns.map(async (town) => [town, await placeWithState(town, prefer)] as const)));
  return events.map((event) => (event.location ? { ...event, location: resolved.get(event.location) || event.location } : event));
}
