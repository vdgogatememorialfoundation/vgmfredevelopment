import { readFileSync, writeFileSync } from "node:fs";
import { shipmentActivityAt } from "@/lib/commerce-stamp";
import { dataFile } from "@/lib/server/paths";
import type { ShipmentRecord } from "@/types";

function file() {
  return dataFile("shop-shipments.json");
}

function readAll(): ShipmentRecord[] {
  try {
    const parsed = JSON.parse(readFileSync(file(), "utf8")) as ShipmentRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(list: ShipmentRecord[]) {
  writeFileSync(file(), JSON.stringify(list.slice(0, 2000)));
}

export function listShopShipments() {
  return readAll();
}

export function findShopShipment(orderId: string) {
  return readAll().find((item) => item.orderId === orderId && item.note !== "Cancelled") ?? readAll().find((item) => item.orderId === orderId);
}

export function upsertShopShipment(shipment: ShipmentRecord) {
  if (!shipment?.id || !shipment.orderId) return;
  const all = readAll();
  const prev = all.find((item) => item.id === shipment.id || item.orderId === shipment.orderId);
  if (prev && shipmentActivityAt(prev) > shipmentActivityAt(shipment)) return prev;
  const next = all.filter((item) => item.id !== shipment.id && item.orderId !== shipment.orderId);
  next.unshift(prev ? { ...prev, ...shipment } : shipment);
  writeAll(next);
  return next[0];
}

export function replaceShopShipment(shipment: ShipmentRecord) {
  if (!shipment?.id || !shipment.orderId) return;
  const next = readAll().filter((item) => item.id !== shipment.id && item.orderId !== shipment.orderId);
  next.unshift(shipment);
  writeAll(next);
  return shipment;
}
