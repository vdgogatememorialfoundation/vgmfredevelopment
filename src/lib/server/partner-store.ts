import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { readKv, writeKv } from "@/lib/server/db";
import { dataFile } from "@/lib/server/paths";
import type { PartnerSnapshot } from "@/lib/server/partner-portals";

const SNAPSHOT_KEY = "partner-snapshot";

function filePath() {
  return dataFile("partner-snapshot.json");
}

function readFile(): PartnerSnapshot | null {
  try {
    const parsed = JSON.parse(readFileSync(filePath(), "utf8")) as PartnerSnapshot;
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.events)) return parsed;
  } catch {
    /* missing */
  }
  return null;
}

function writeFile(snapshot: PartnerSnapshot) {
  try {
    const file = filePath();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(snapshot));
  } catch {
    /* ephemeral host */
  }
}

export async function readPartnerSnapshot(): Promise<PartnerSnapshot | null> {
  const fromDb = await readKv<PartnerSnapshot>("admin", SNAPSHOT_KEY);
  if (fromDb && Array.isArray(fromDb.events)) return fromDb;
  return readFile();
}

export async function writePartnerSnapshot(snapshot: PartnerSnapshot) {
  writeFile(snapshot);
  try {
    await writeKv("admin", SNAPSHOT_KEY, snapshot);
  } catch {
    /* file copy still holds */
  }
  return snapshot;
}
