import { orderActivityAt, shipmentActivityAt } from "@/lib/commerce-stamp";
import { getSettings, getShipments } from "@/lib/admin-store";
import { getOrders } from "@/lib/store";
import type { Order, ShipmentRecord } from "@/types";

function writeOrders(orders: Order[]) {
  window.localStorage.setItem("vgmf_orders", JSON.stringify(orders));
}

function writeShipments(shipments: ShipmentRecord[]) {
  window.localStorage.setItem("vgmf_shipments", JSON.stringify(shipments));
}

export function rememberShipment(shipment: ShipmentRecord) {
  if (typeof window === "undefined" || !shipment?.id) return;
  const list = getShipments().filter((item) => item.id !== shipment.id && item.orderId !== shipment.orderId);
  list.unshift(shipment);
  writeShipments(list);
  window.dispatchEvent(new Event("vgmf-cms"));
}

export function rememberOrder(order: Order) {
  rememberOrders([order]);
}

function rememberOrders(remote: Order[]) {
  if (!remote.length) return;
  const byId = new Map(getOrders().map((order) => [order.id, order]));
  let changed = false;
  for (const order of remote) {
    const prev = byId.get(order.id);
    if (!prev || orderActivityAt(order) >= orderActivityAt(prev)) {
      byId.set(order.id, prev ? { ...prev, ...order } : order);
      changed = true;
    }
  }
  if (!changed) return;
  writeOrders([...byId.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)));
  window.dispatchEvent(new Event("vgmf-cms"));
}

function rememberShipments(remote: ShipmentRecord[]) {
  if (!remote.length) return;
  const byId = new Map(getShipments().map((shipment) => [shipment.orderId, shipment]));
  let changed = false;
  for (const shipment of remote) {
    const prev = byId.get(shipment.orderId);
    if (!prev || shipmentActivityAt(shipment) >= shipmentActivityAt(prev)) {
      byId.set(shipment.orderId, prev ? { ...prev, ...shipment } : shipment);
      changed = true;
    }
  }
  if (!changed) return;
  writeShipments([...byId.values()]);
  window.dispatchEvent(new Event("vgmf-cms"));
}

async function publishSecrets() {
  try {
    const key = getSettings().apiKeys.googleMaps?.trim();
    if (key) {
      await fetch("/api/shop/maps-key", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key }),
      });
    }
  } catch {
    /* the map can still use a key already on the server */
  }
  try {
    const raw = window.localStorage.getItem("vgmf_integrations");
    if (!raw) return;
    const parsed = JSON.parse(raw) as { shipping?: unknown };
    if (!parsed.shipping) return;
    await fetch("/api/shop/shipping-creds", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shipping: parsed.shipping }),
    });
  } catch {
    /* tracking falls back to the keys on this browser */
  }
}

async function pushLocalCommerce() {
  const orders = getOrders();
  const shipments = getShipments();
  if (!orders.length && !shipments.length) return;
  const stamp = `${orders.length}:${shipments.length}:${orderActivityAt(orders[0] ?? {})}:${shipmentActivityAt(shipments[0] ?? {})}`;
  if (window.sessionStorage.getItem("vgmf_commerce_push") === stamp) return;
  const send = (url: string, body: unknown) =>
    fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => undefined);
  await Promise.all([
    ...orders.slice(0, 200).map((order) => send("/api/shop/orders", { order })),
    ...shipments.slice(0, 200).map((shipment) => send("/api/shop/shipments", { shipment })),
  ]);
  window.sessionStorage.setItem("vgmf_commerce_push", stamp);
}

async function pullCommerce() {
  const pulled = Number(window.sessionStorage.getItem("vgmf_commerce_pulled") || 0);
  if (Date.now() - pulled < 15000) return;
  const [ordersRes, shipsRes] = await Promise.all([
    fetch("/api/shop/orders?sync=1", { cache: "no-store", credentials: "same-origin" }),
    fetch("/api/shop/shipments?sync=1", { cache: "no-store", credentials: "same-origin" }),
  ]);
  if (ordersRes.ok) {
    const data = (await ordersRes.json()) as { orders?: Order[] };
    rememberOrders(data.orders ?? []);
  }
  if (shipsRes.ok) {
    const data = (await shipsRes.json()) as { shipments?: ShipmentRecord[] };
    rememberShipments(data.shipments ?? []);
  }
  window.sessionStorage.setItem("vgmf_commerce_pulled", String(Date.now()));
}

/** Publish this browser's bookings, then pull the server copy onto this device. */
export async function syncCommerce() {
  if (typeof window === "undefined") return;
  await publishSecrets();
  await pushLocalCommerce();
  await pullCommerce();
}
