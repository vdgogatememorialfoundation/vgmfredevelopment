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

type Deleted = { ids: string[]; awbs: string[] };

function readDeleted(): Deleted {
  try {
    const parsed = JSON.parse(readFileSync(dataFile("shop-shipments-deleted.json"), "utf8")) as Partial<Deleted>;
    return { ids: Array.isArray(parsed.ids) ? parsed.ids : [], awbs: Array.isArray(parsed.awbs) ? parsed.awbs : [] };
  } catch {
    return { ids: [], awbs: [] };
  }
}

/** Shipment ids deleted from the desk, so stale browser copies can't bring them back. */
export function deletedShopShipmentIds() {
  return readDeleted().ids;
}

function isDeleted(shipment: ShipmentRecord, deleted = readDeleted()) {
  const awb = shipment.awb?.trim();
  return deleted.ids.includes(shipment.id) || Boolean(awb && deleted.awbs.includes(awb));
}

export function listShopShipments() {
  return readAll();
}

export function findShopShipment(orderId: string) {
  return readAll().find((item) => item.orderId === orderId && item.note !== "Cancelled") ?? readAll().find((item) => item.orderId === orderId);
}

export function upsertShopShipment(shipment: ShipmentRecord) {
  if (!shipment?.id || !shipment.orderId || isDeleted(shipment)) return;
  const all = readAll();
  const prev = all.find((item) => item.id === shipment.id || item.orderId === shipment.orderId);
  if (prev && shipmentActivityAt(prev) > shipmentActivityAt(shipment)) return prev;
  const next = all.filter((item) => item.id !== shipment.id && item.orderId !== shipment.orderId);
  next.unshift(prev ? { ...prev, ...shipment } : shipment);
  writeAll(next);
  return next[0];
}

export function deleteShopShipments(orderId: string) {
  const id = orderId.trim();
  if (!id) return;
  const all = readAll();
  const gone = all.filter((item) => item.orderId === id);
  if (gone.length) {
    const deleted = readDeleted();
    const ids = [...new Set([...gone.map((item) => item.id), ...deleted.ids])].slice(0, 5000);
    const awbs = [...new Set([...gone.map((item) => item.awb?.trim()).filter((awb): awb is string => Boolean(awb)), ...deleted.awbs])].slice(0, 5000);
    writeFileSync(dataFile("shop-shipments-deleted.json"), JSON.stringify({ ids, awbs }));
  }
  writeAll(all.filter((item) => item.orderId !== id));
}

export function replaceShopShipment(shipment: ShipmentRecord) {
  if (!shipment?.id || !shipment.orderId) return;
  const next = readAll().filter((item) => item.id !== shipment.id && item.orderId !== shipment.orderId);
  next.unshift(shipment);
  writeAll(next);
  return shipment;
}
