import { readFileSync, writeFileSync } from "node:fs";
import { dataFile } from "@/lib/server/paths";

type Line = { bookId: string; quantity: number };
type Row = { email: string; items: Line[]; at: number };

function readAll(): Row[] {
  try {
    const parsed = JSON.parse(readFileSync(dataFile("shop-carts.json"), "utf8")) as Row[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readCart(email: string) {
  const value = email.trim().toLowerCase();
  return readAll().find((row) => row.email === value) ?? null;
}

export function saveCart(email: string, items: Line[], at: number) {
  const value = email.trim().toLowerCase();
  if (!value || !Number.isFinite(at)) return null;
  const all = readAll();
  const prev = all.find((row) => row.email === value);
  if (prev && prev.at > at) return prev;
  const next: Row = {
    email: value,
    items: items
      .filter((item) => typeof item?.bookId === "string" && item.bookId.trim())
      .map((item) => ({ bookId: item.bookId, quantity: Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1))) }))
      .slice(0, 100),
    at,
  };
  const rows = all.filter((row) => row.email !== value);
  rows.unshift(next);
  writeFileSync(dataFile("shop-carts.json"), JSON.stringify(rows.slice(0, 5000)));
  return next;
}
