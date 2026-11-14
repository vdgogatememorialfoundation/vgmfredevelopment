import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { dataFile } from "@/lib/server/paths";

type Json = Record<string, unknown>;

const FILE = () => dataFile("admin-integrations.json");
const SECRET = /secret|salt|token|password|apikey|api_key|merchantkey|^key$/i;

function read(): { settings: Json; updatedAt: string } {
  try {
    const parsed = JSON.parse(readFileSync(FILE(), "utf8")) as { settings?: Json; updatedAt?: string };
    return { settings: parsed.settings && typeof parsed.settings === "object" ? parsed.settings : {}, updatedAt: parsed.updatedAt || "" };
  } catch {
    return { settings: {}, updatedAt: "" };
  }
}

/** A blank or masked value from a device without the keys never erases a saved one. */
function keepSaved(base: unknown, extra: unknown): unknown {
  if (typeof extra === "string") return extra.trim() && !extra.includes("•") ? extra : base ?? extra;
  if (typeof extra === "number" || typeof extra === "boolean") return extra;
  if (Array.isArray(extra)) return extra;
  if (extra && typeof extra === "object") {
    const seed = base && typeof base === "object" && !Array.isArray(base) ? (base as Json) : {};
    const out: Json = { ...seed };
    for (const [key, value] of Object.entries(extra as Json)) {
      if (key === "connection") continue;
      out[key] = keepSaved(out[key], value);
    }
    return out;
  }
  return base ?? extra;
}

function blankSecrets(value: unknown, path: string, saved: string[]): unknown {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return value;
  const out: Json = {};
  for (const [key, entry] of Object.entries(value as Json)) {
    const at = path ? `${path}.${key}` : key;
    if (typeof entry === "string" && SECRET.test(key)) {
      if (entry.trim()) saved.push(at);
      out[key] = "";
    } else {
      out[key] = blankSecrets(entry, at, saved);
    }
  }
  return out;
}

export function saveAdminIntegrations(incoming: unknown, at: string) {
  if (!incoming || typeof incoming !== "object") return read();
  const current = read();
  const next = { settings: keepSaved(current.settings, incoming) as Json, updatedAt: at > current.updatedAt ? at : current.updatedAt };
  mkdirSync(dirname(FILE()), { recursive: true });
  writeFileSync(FILE(), JSON.stringify(next));
  return next;
}

/** Settings for another admin device: everything except the secret values, plus which secrets are saved here. */
export function publicAdminIntegrations() {
  const current = read();
  const saved: string[] = [];
  const settings = blankSecrets(current.settings, "", saved) as Json;
  return { settings, saved, updatedAt: current.updatedAt };
}

export function savedAdminIntegrations(): Json {
  return read().settings;
}
