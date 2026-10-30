import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { readKv, writeKv } from "@/lib/server/db";
import { dataFile } from "@/lib/server/paths";
import type { PartnerSnapshot } from "@/lib/server/partner-portals";

const SNAPSHOT_KEY = "partner-snapshot";

function filePath() {
  return dataFile("partner-snapshot.json");
}

function withoutSisterSecrets(snapshot: PartnerSnapshot): PartnerSnapshot {
  const { passwordHashes: _hashes, ...rest } = snapshot as PartnerSnapshot & { passwordHashes?: unknown };
  void _hashes;
  return {
    ...rest,
    accounts: (snapshot.accounts ?? []).map((account) => ({
      ...account,
      password: undefined,
      partnerPasswordSet: false,
    })),
  };
}

function readFile(): PartnerSnapshot | null {
  try {
    const parsed = JSON.parse(readFileSync(filePath(), "utf8")) as PartnerSnapshot;
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.events)) return withoutSisterSecrets(parsed);
  } catch {
    /* missing */
  }
  return null;
}

function writeFile(snapshot: PartnerSnapshot) {
  try {
    const file = filePath();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(withoutSisterSecrets(snapshot)));
  } catch {
    /* ephemeral host */
  }
}

export async function readPartnerSnapshot(): Promise<PartnerSnapshot | null> {
  const fromDb = await readKv<PartnerSnapshot>("admin", SNAPSHOT_KEY);
  if (fromDb && Array.isArray(fromDb.events)) return withoutSisterSecrets(fromDb);
  return readFile();
}

export async function writePartnerSnapshot(snapshot: PartnerSnapshot) {
  const clean = withoutSisterSecrets(snapshot);
  writeFile(clean);
  try {
    await writeKv("admin", SNAPSHOT_KEY, clean);
  } catch {
    /* file copy still holds */
  }
  return clean;
}
