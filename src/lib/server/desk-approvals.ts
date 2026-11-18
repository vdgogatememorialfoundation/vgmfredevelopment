import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { dataFile } from "@/lib/server/paths";

/** Refund, cancel and return requests raised by care/staff from a chat or ticket; Admin approves or rejects. */
export type DeskApproval = {
  id: string;
  kind: "refund" | "cancel" | "return";
  orderId: string;
  amount?: number;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
  decidedBy?: string;
  decidedAt?: string;
  note?: string;
};

const FILE = () => dataFile("desk-approvals.json");

export function listApprovals(): DeskApproval[] {
  try {
    const rows = JSON.parse(readFileSync(FILE(), "utf8")) as DeskApproval[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function save(rows: DeskApproval[]) {
  mkdirSync(dirname(FILE()), { recursive: true });
  writeFileSync(FILE(), JSON.stringify(rows.slice(0, 1000), null, 2));
}

export function addApproval(input: Pick<DeskApproval, "kind" | "orderId" | "amount" | "reason" | "requestedBy">) {
  const rows = listApprovals();
  const open = rows.find((row) => row.status === "pending" && row.orderId === input.orderId && row.kind === input.kind);
  if (open) return open;
  const row: DeskApproval = { ...input, id: `APR${Date.now().toString(36).toUpperCase()}`, requestedAt: new Date().toISOString(), status: "pending" };
  save([row, ...rows]);
  return row;
}

export function decideApproval(id: string, status: "approved" | "rejected", decidedBy: string, note?: string) {
  const rows = listApprovals();
  const row = rows.find((item) => item.id === id);
  if (!row || row.status !== "pending") return null;
  Object.assign(row, { status, decidedBy, decidedAt: new Date().toISOString(), note });
  save(rows);
  return row;
}
