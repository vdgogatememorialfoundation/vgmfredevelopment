import { useEffect, useState } from "react";
import { orderActivityAt, shipmentActivityAt } from "@/lib/commerce-stamp";
import { getSettings, getShipments } from "@/lib/admin-store";
import { getSession, isPortalRole } from "@/lib/auth";
import { getCart, getOrders, getWishlist, withAccountEmail } from "@/lib/store";
import { publishCartChange } from "@/lib/cart-store";
import type { CartItem, Order, ShipmentRecord } from "@/types";

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
    ...orders.slice(0, 200).map((order) => send("/api/shop/orders", { order: withAccountEmail(order) })),
    ...shipments.slice(0, 200).map((shipment) => send("/api/shop/shipments", { shipment })),
  ]);
  window.sessionStorage.setItem("vgmf_commerce_push", stamp);
}

async function pullCommerce() {
  const viewer = getSession()?.email?.toLowerCase() || "";
  const raw = window.sessionStorage.getItem("vgmf_commerce_pulled") || "";
  const splitAt = raw.lastIndexOf("|");
  const stamp = splitAt === -1 ? "" : raw.slice(0, splitAt);
  const at = Number(splitAt === -1 ? raw : raw.slice(splitAt + 1)) || 0;
  if (stamp === viewer && Date.now() - at < 15000) return;
  const [ordersRes, shipsRes] = await Promise.all([
    fetch("/api/shop/orders?sync=1", { cache: "no-store", credentials: "same-origin" }),
    fetch("/api/shop/shipments?sync=1", { cache: "no-store", credentials: "same-origin" }),
  ]);
  if (ordersRes.ok) {
    const data = (await ordersRes.json()) as { orders?: Order[]; deleted?: string[] };
    rememberOrders(data.orders ?? []);
    const gone = new Set(data.deleted ?? []);
    if (gone.size) {
      const orders = getOrders();
      const shipments = getShipments();
      if (orders.some((order) => gone.has(order.id)) || shipments.some((shipment) => gone.has(shipment.orderId))) {
        window.localStorage.setItem("vgmf_orders", JSON.stringify(orders.filter((order) => !gone.has(order.id))));
        window.localStorage.setItem("vgmf_shipments", JSON.stringify(shipments.filter((shipment) => !gone.has(shipment.orderId))));
        window.dispatchEvent(new Event("vgmf-cms"));
      }
    }
  }
  if (shipsRes.ok) {
    const data = (await shipsRes.json()) as { shipments?: ShipmentRecord[]; deleted?: string[] };
    const gone = new Set(data.deleted ?? []);
    if (gone.size && getShipments().some((shipment) => gone.has(shipment.id))) {
      writeShipments(getShipments().filter((shipment) => !gone.has(shipment.id)));
      window.dispatchEvent(new Event("vgmf-cms"));
    }
    rememberShipments((data.shipments ?? []).filter((shipment) => !gone.has(shipment.id)));
  }
  window.sessionStorage.setItem("vgmf_commerce_pulled", `${viewer}|${Date.now()}`);
}

async function syncWishlist() {
  const user = getSession();
  if (!user?.email || isPortalRole(user.role)) return;
  let at = Number(window.localStorage.getItem("vgmf_wishlist_at") || 0);
  const ids = getWishlist();
  if (!at && ids.length) {
    at = Date.now();
    window.localStorage.setItem("vgmf_wishlist_at", String(at));
  }
  if (at) {
    await fetch("/api/shop/wishlist", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids, at }),
    }).catch(() => undefined);
  }
  const response = await fetch("/api/shop/wishlist", { cache: "no-store", credentials: "same-origin" }).catch(() => undefined);
  if (!response?.ok) return;
  const data = (await response.json()) as { ids?: string[]; at?: number };
  if (!data.at || data.at <= at) return;
  window.localStorage.setItem("vgmf_wishlist", JSON.stringify(Array.isArray(data.ids) ? data.ids : []));
  window.localStorage.setItem("vgmf_wishlist_at", String(data.at));
  window.dispatchEvent(new Event("vgmf-wishlist"));
}

/** Keep the signed-in customer's cart the same on every device: the newest edit wins. */
export async function syncCart() {
  if (typeof window === "undefined") return;
  const user = getSession();
  if (!user?.email || isPortalRole(user.role)) return;
  const at = Number(window.localStorage.getItem("vgmf_cart_at") || 0);
  const items = getCart();
  if (at) {
    await fetch("/api/shop/cart", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items, at }),
    }).catch(() => undefined);
  }
  const response = await fetch("/api/shop/cart", { cache: "no-store", credentials: "same-origin" }).catch(() => undefined);
  if (!response?.ok) return;
  const data = (await response.json()) as { items?: CartItem[]; at?: number };
  if (!data.at || data.at <= at) return;
  window.localStorage.setItem("vgmf_cart", JSON.stringify(Array.isArray(data.items) ? data.items : []));
  window.localStorage.setItem("vgmf_cart_at", String(data.at));
  publishCartChange();
}

/** Publish this browser's bookings, then pull the server copy onto this device. */
export async function syncCommerce() {
  if (typeof window === "undefined") return;
  await publishSecrets();
  await pushLocalCommerce();
  await pullCommerce();
  await syncWishlist();
  await syncCart();
}

/** Load the signed-in account's orders onto this phone, then re-render when they arrive. */
export function useCommerceMirror() {
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((value) => value + 1);
    window.addEventListener("vgmf-cms", bump);
    window.addEventListener("vgmf-wishlist", bump);
    let live = true;
    void syncCommerce().finally(() => {
      if (!live) return;
      setReady(true);
      bump();
    });
    return () => {
      live = false;
      window.removeEventListener("vgmf-cms", bump);
      window.removeEventListener("vgmf-wishlist", bump);
    };
  }, []);
  return { ready, version };
}
