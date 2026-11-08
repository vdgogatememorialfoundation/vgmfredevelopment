import { readFileSync, writeFileSync } from "node:fs";
import { dataFile } from "@/lib/server/paths";

export type WalletEntry = { id: string; email: string; amount: number; at: string; note: string; orderId?: string; by?: string };

const FILE = "store-credit.json";

function readAll(): WalletEntry[] {
  try {
    const parsed = JSON.parse(readFileSync(dataFile(FILE), "utf8")) as WalletEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function walletFor(email: string) {
  const value = email.trim().toLowerCase();
  const entries = readAll().filter((entry) => entry.email === value);
  const balance = Math.max(0, Math.round(entries.reduce((sum, entry) => sum + entry.amount, 0) * 100) / 100);
  return { entries, balance };
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
