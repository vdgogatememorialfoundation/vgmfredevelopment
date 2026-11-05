import { refreshStoredShipment } from "@/lib/server/live-track";
import { listShopShipments } from "@/lib/server/shop-shipments";

const EVERY_MS = 10 * 60 * 1000;
const DONE = new Set(["Delivered", "Failed", "Cancelled", "RTO Delivered"]);

let started = false;
let running = false;

/** Polls every open courier shipment (provider APIs and manual courier websites) so orders move even when nobody has the page open. */
export async function syncOpenShipments() {
  if (running) return;
  running = true;
  try {
    const open = listShopShipments().filter(
      (shipment) =>
        shipment.awb &&
        shipment.note !== "Cancelled" &&
        !DONE.has(String(shipment.status)) &&
        (shipment.directCourier || (shipment.live && shipment.provider && shipment.provider !== "local"))
    );
    for (const shipment of open) {
      try {
        await refreshStoredShipment(shipment.orderId);
      } catch {
        /* one courier failing must not stop the rest */
      }
    }
  } finally {
    running = false;
  }
}

export function startShipmentSync() {
  if (started) return;
  started = true;
  setTimeout(() => void syncOpenShipments(), 60_000).unref?.();
  setInterval(() => void syncOpenShipments(), EVERY_MS).unref?.();
}
