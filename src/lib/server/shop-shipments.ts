import { readFileSync, writeFileSync } from "node:fs";
import { shipmentActivityAt } from "@/lib/commerce-stamp";
import { dataFile } from "@/lib/server/paths";
import type { ShipmentRecord } from "@/types";
import { sameShipmentSlot } from "@/lib/shipment-slot";

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

export function findShopShipment(orderId: string, shipmentId = "") {
  if (shipmentId) {
    const exact = readAll().find((item) => item.id === shipmentId && item.orderId === orderId);
    if (exact) return exact;
  }
  return readAll().find((item) => item.orderId === orderId && item.note !== "Cancelled") ?? readAll().find((item) => item.orderId === orderId);
}

/** Customer copy of a shipment: once it is delivered (or over), the rider's name, phone, GPS and OTP stay with Admin only. */
export function customerShipment<T extends ShipmentRecord | null | undefined>(shipment: T, orderStatus = ""): T {
  if (!shipment) return shipment;
  const over = ["Delivered", "Cancelled", "Failed", "Returned"].includes(shipment.status) || ["Delivered", "Cancelled", "Failed"].includes(orderStatus);
  if (!over) return shipment;
  const { agentName: _name, agentPhone: _phone, agentLat: _lat, agentLng: _lng, deliveryOtp: _otp, ...rest } = shipment as ShipmentRecord;
  void _name; void _phone; void _lat; void _lng; void _otp;
  return rest as T;
}

export function upsertShopShipment(shipment: ShipmentRecord) {
  if (!shipment?.id || !shipment.orderId || isDeleted(shipment)) return;
  const all = readAll();
  const prev = all.find((item) => item.id === shipment.id || sameShipmentSlot(item, shipment));
  // A desk "remove this scan" carries older scans than the server copy; still apply the removal.
  const hides = (shipment.hiddenScans ?? []).filter((key) => !(prev?.hiddenScans ?? []).includes(key));
  if (prev && shipmentActivityAt(prev) > shipmentActivityAt(shipment) && !hides.length) return prev;
  const next = all.filter((item) => item.id !== shipment.id && !sameShipmentSlot(item, shipment));
  if (prev && hides.length && shipmentActivityAt(prev) > shipmentActivityAt(shipment)) {
    const hidden = new Set([...(prev.hiddenScans ?? []), ...hides]);
    const keyOf = (scan: { at: string; status: string }) => `${scan.at}|${scan.status.trim().toLowerCase()}`;
    next.unshift({ ...prev, hiddenScans: [...hidden], tracking: (prev.tracking ?? []).filter((scan) => !hidden.has(keyOf(scan))) });
    writeAll(next);
    return next[0];
  }
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
  const next = readAll().filter((item) => item.id !== shipment.id && !sameShipmentSlot(item, shipment));
  next.unshift(shipment);
  writeAll(next);
  return shipment;
}
