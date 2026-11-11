import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { HostedGatewayId } from "@/lib/integrations";
import { dataFile } from "@/lib/server/paths";
import type { Order } from "@/types";

export type HoldStatus = "holding" | "confirmed" | "failed" | "refunded";

export type PaymentHold = {
  id: string;
  kind: "order" | "subscription" | "other";
  gateway: HostedGatewayId | "razorpay";
  amount: number;
  status: HoldStatus;
  createdAt: string;
  updatedAt: string;
  reference?: string;
  /** The checkout order as it will be once paid; the server saves it if Razorpay confirms and the browser never did. */
  order?: Order;
  /** Razorpay refund for a payment that never matched an order. */
  refundId?: string;
};

const FILE = () => dataFile("payment-holds.json");

function readAll(): PaymentHold[] {
  try {
    const parsed = JSON.parse(readFileSync(FILE(), "utf8")) as PaymentHold[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: PaymentHold[]) {
  const file = FILE();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(rows));
}

export function listHolds() {
  return readAll();
}

export function readHold(id: string) {
  return readAll().find((row) => row.id === id);
}

export function saveHold(hold: PaymentHold) {
  const rows = readAll().filter((row) => row.id !== hold.id);
  rows.push(hold);
  writeAll(rows.slice(-400));
  return hold;
}
