import type { ShipmentRecord } from "@/types";

/** One record per order, or per part when the order is split into several shipments. */
export function sameShipmentSlot(a: Pick<ShipmentRecord, "orderId" | "part">, b: Pick<ShipmentRecord, "orderId" | "part">) {
  return a.orderId === b.orderId && (a.part ?? 0) === (b.part ?? 0);
}
