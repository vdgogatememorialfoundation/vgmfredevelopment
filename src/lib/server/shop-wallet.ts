import { randomInt } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dataFile } from "@/lib/server/paths";
import { readMobileFeed } from "@/lib/server/mobile-feed";
import { publicOrderSettings, type OrderSettings } from "@/lib/integrations";

export type WalletEntry = { id: string; email: string; amount: number; at: string; note: string; orderId?: string; by?: string; expiresAt?: string };

const FILE = "store-credit.json";

function readAll(): WalletEntry[] {
  try {
    const parsed = JSON.parse(readFileSync(dataFile(FILE), "utf8")) as WalletEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function creditExpiryDays() {
  try {
    return publicOrderSettings(readMobileFeed().orderSettings as Partial<OrderSettings> | undefined).refunds.creditExpiryDays;
  } catch {
    return 0;
  }
}

const round = (value: number) => Math.round(value * 100) / 100;

const ID_FILE = "store-credit-ids.json";

function readIds(): Record<string, string> {
  try {
    const parsed = JSON.parse(readFileSync(dataFile(ID_FILE), "utf8")) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** The customer's own 5-digit Store Credit ID; the counter enters it before store credit can be used at POS. */
export function walletIdFor(email: string) {
  const value = email.trim().toLowerCase();
  if (!value) return "";
  const ids = readIds();
  if (ids[value]) return ids[value];
  const taken = new Set(Object.values(ids));
  let id = "";
  for (let tries = 0; tries < 200 && (!id || taken.has(id)); tries += 1) id = String(randomInt(10000, 100000));
  if (taken.has(id)) throw new Error("No Store Credit ID left.");
  ids[value] = id;
  writeFileSync(dataFile(ID_FILE), JSON.stringify(ids));
  return id;
}

const misses = new Map<string, { count: number; until: number }>();

/** Checks the code a customer gives at the counter; 5 wrong tries lock that customer's ID checks for 15 minutes. */
export function walletIdMatches(email: string, code: string) {
  const value = email.trim().toLowerCase();
  const now = Date.now();
  const miss = misses.get(value);
  if (miss && miss.count >= 5 && miss.until > now) return false;
  const id = readIds()[value];
  const ok = Boolean(id && /^\d{5}$/.test(code.trim()) && id === code.trim());
  if (ok) misses.delete(value);
  else misses.set(value, { count: miss && miss.until > now ? miss.count + 1 : 1, until: now + 15 * 60_000 });
  return ok;
}

/** Balance after expiry: each credit lapses expiryDays after it was added, and spending uses the oldest live credit first. */
export function walletFor(email: string, expiryDays = creditExpiryDays()) {
  const value = email.trim().toLowerCase();
  const entries = readAll().filter((entry) => entry.email === value);
  if (!(expiryDays > 0)) {
    return { entries, balance: Math.max(0, round(entries.reduce((sum, entry) => sum + entry.amount, 0))), expiryDays: 0 };
  }
  const lots: { left: number; expires: number }[] = [];
  for (const entry of [...entries].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    const at = Date.parse(entry.at) || 0;
    if (entry.amount > 0) {
      lots.push({ left: entry.amount, expires: at + expiryDays * 864e5 });
      continue;
    }
    let need = -entry.amount;
    for (const lot of lots) {
      if (need <= 0) break;
      if (lot.left <= 0 || lot.expires < at) continue;
      const take = Math.min(lot.left, need);
      lot.left -= take;
      need -= take;
    }
  }
  const now = Date.now();
  const live = lots.filter((lot) => lot.left > 0.001 && lot.expires >= now).sort((a, b) => a.expires - b.expires);
  const balance = Math.max(0, round(live.reduce((sum, lot) => sum + lot.left, 0)));
  const expiring = live[0] ? { amount: round(live[0].left), at: new Date(live[0].expires).toISOString() } : undefined;
  const dated = entries.map((entry) => (entry.amount > 0 ? { ...entry, expiresAt: new Date((Date.parse(entry.at) || 0) + expiryDays * 864e5).toISOString() } : entry));
  return { entries: dated, balance, expiryDays, expiring };
}

/** Adds ledger lines once each (by id). Customers may only spend their own balance; staff may credit anyone. */
export function addWalletEntries(input: WalletEntry[], viewer: { email: string; portal: boolean }) {
  const all = readAll();
  const known = new Set(all.map((entry) => entry.id));
  const added: WalletEntry[] = [];
  for (const raw of input.slice(0, 200)) {
    const email = String(raw?.email ?? "").trim().toLowerCase();
    const amount = Math.round(Number(raw?.amount) * 100) / 100;
    const id = String(raw?.id ?? "").slice(0, 60);
    if (!id || !email || !Number.isFinite(amount) || amount === 0 || known.has(id)) continue;
    if (!viewer.portal) {
      if (email !== viewer.email || amount > 0) continue;
      if (walletFor(email).balance + added.filter((entry) => entry.email === email).reduce((sum, entry) => sum + entry.amount, 0) + amount < -0.001) continue;
    }
    const entry: WalletEntry = {
      id,
      email,
      amount,
      at: String(raw.at || new Date().toISOString()),
      note: String(raw.note ?? "").slice(0, 200),
      orderId: raw.orderId ? String(raw.orderId).slice(0, 40) : undefined,
      by: viewer.portal ? String(raw.by ?? viewer.email).slice(0, 120) : email,
    };
    known.add(id);
    added.push(entry);
  }
  if (added.length) writeFileSync(dataFile(FILE), JSON.stringify([...added, ...all].slice(0, 50000)));
  return added.length;
}
