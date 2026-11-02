import { readFileSync, writeFileSync } from "node:fs";
import { dataFile } from "@/lib/server/paths";

type Row = { email: string; ids: string[]; at: number };

function readAll(): Row[] {
  try {
    const parsed = JSON.parse(readFileSync(dataFile("shop-wishlists.json"), "utf8")) as Row[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readWishlist(email: string) {
  const value = email.trim().toLowerCase();
  return readAll().find((row) => row.email === value) ?? null;
}

export function saveWishlist(email: string, ids: string[], at: number) {
  const value = email.trim().toLowerCase();
  if (!value || !Number.isFinite(at)) return null;
  const all = readAll();
  const prev = all.find((row) => row.email === value);
  if (prev && prev.at > at) return prev;
  const next: Row = {
    email: value,
    ids: [...new Set(ids.filter((id) => typeof id === "string" && id.trim()))].slice(0, 200),
    at,
  };
  const rows = all.filter((row) => row.email !== value);
  rows.unshift(next);
  writeFileSync(dataFile("shop-wishlists.json"), JSON.stringify(rows.slice(0, 5000)));
  return next;
}
