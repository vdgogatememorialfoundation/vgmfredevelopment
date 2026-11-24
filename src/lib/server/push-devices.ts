import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { dataFile } from "@/lib/server/paths";

export type PushDevice = { token: string; platform: string; email?: string; phone?: string; accountId?: string; updatedAt: string };

const FILE = () => dataFile("push-devices.json");

export function listPushDevices(): PushDevice[] {
  try {
    const parsed = JSON.parse(readFileSync(FILE(), "utf8")) as PushDevice[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(rows: PushDevice[]) {
  const file = FILE();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(rows));
}

export function savePushDevice(device: PushDevice) {
  const rows = listPushDevices().filter((row) => row.token !== device.token);
  write([...rows, device].slice(-20000));
}

export function dropPushTokens(tokens: string[]) {
  if (!tokens.length) return;
  const drop = new Set(tokens);
  write(listPushDevices().filter((row) => !drop.has(row.token)));
}

const digits = (value?: string) => (value ?? "").replace(/\D/g, "").slice(-10);

export function devicesFor(who: { email?: string; phone?: string; accountId?: string }) {
  const email = who.email?.trim().toLowerCase();
  const phone = digits(who.phone);
  return listPushDevices().filter(
    (row) =>
      (email && row.email?.toLowerCase() === email) ||
      (phone && digits(row.phone) === phone) ||
      (who.accountId && row.accountId === who.accountId)
  );
}
