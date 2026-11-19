import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { dataFile } from "@/lib/server/paths";

export type AuditEntry = {
  id: string;
  at: string;
  actor: string;
  actorType: "staff" | "customer" | "guest";
  role?: string;
  action: string;
  target?: string;
  detail?: string;
  ip?: string;
};

const FILE = dataFile("audit-log.json");
const LIMIT = 20000;

function read(): AuditEntry[] {
  try {
    const rows = JSON.parse(readFileSync(FILE, "utf8")) as AuditEntry[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function appendAudit(entry: Omit<AuditEntry, "id" | "at">) {
  const row: AuditEntry = {
    id: `au${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    ...entry,
  };
  const rows = [row, ...read()].slice(0, LIMIT);
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(rows));
  return row;
}

export function listAudit(filter: { q?: string; actorType?: string; limit?: number } = {}) {
  const q = (filter.q || "").trim().toLowerCase();
  return read()
    .filter((row) => !filter.actorType || row.actorType === filter.actorType)
    .filter((row) => !q || [row.actor, row.action, row.target, row.detail, row.role].some((value) => (value || "").toLowerCase().includes(q)))
    .slice(0, filter.limit ?? 500);
}
