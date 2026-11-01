import { readFileSync, writeFileSync } from "node:fs";
import { dataFile } from "@/lib/server/paths";

type Json = Record<string, unknown>;

function credsFile() {
  return dataFile("shipping-creds.json");
}

function mapsFile() {
  return dataFile("maps-key.json");
}

function readJson(path: string): Json {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Json;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function mergeNonEmpty(base: unknown, extra: unknown): unknown {
  if (typeof extra === "string") return extra.trim() ? extra : base;
  if (typeof extra === "number" || typeof extra === "boolean") return extra;
  if (Array.isArray(extra)) return extra.length ? extra : base;
  if (extra && typeof extra === "object") {
    const seed = base && typeof base === "object" && !Array.isArray(base) ? (base as Json) : {};
    const out: Json = { ...seed };
    for (const [key, value] of Object.entries(extra as Json)) {
      if (key === "connection") continue;
      out[key] = mergeNonEmpty(out[key], value);
    }
    return out;
  }
  return base ?? extra;
}

/** Keep courier keys on this host so a phone can refresh tracking without the admin browser. */
export function mergeShippingCreds(incoming: unknown) {
  if (!incoming || typeof incoming !== "object") return;
  const next = mergeNonEmpty(readJson(credsFile()), incoming) as Json;
  writeFileSync(credsFile(), JSON.stringify(next));
}

export function readShippingCreds(): Json {
  return readJson(credsFile());
}

export function saveMapsKey(key: string) {
  const trimmed = key.trim();
  if (!trimmed) return;
  writeFileSync(mapsFile(), JSON.stringify({ key: trimmed }));
}

export function readMapsKey() {
  const key = readJson(mapsFile()).key;
  return typeof key === "string" ? key : "";
}
