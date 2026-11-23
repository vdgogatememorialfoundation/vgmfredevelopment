import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { dataFile } from "@/lib/server/paths";
import { findShopShipment } from "@/lib/server/shop-shipments";
import type { Order } from "@/types";

export type MobileNotification = {
  id: string;
  title: string;
  body: string;
  category: "announcement" | "offer" | "event" | "update" | "order";
  href: string;
  /** "all" for broadcast to all app users, or a specific customer email. */
  target: string;
  active: boolean;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  pushSentCount?: number;
  createdBy?: string;
};

export type OrderStageKey = "ordered" | "packed" | "shipped" | "out_for_delivery" | "delivered";

export type OrderStageTemplate = {
  key: OrderStageKey;
  label: string;
  enabled: boolean;
  title: string;
  body: string;
};

export const DEFAULT_ORDER_STAGE_TEMPLATES: OrderStageTemplate[] = [
  {
    key: "ordered",
    label: "Ordered",
    enabled: true,
    title: "Order Confirmed · #{orderId}",
    body: "Namaste {name}! Your order for {items} (₹{total}) has been placed. We will pack it shortly.",
  },
  {
    key: "packed",
    label: "Packed",
    enabled: true,
    title: "Order Packed · #{orderId}",
    body: "Great news {name}! Your order ({items}) is packed and ready for dispatch.",
  },
  {
    key: "shipped",
    label: "Shipped",
    enabled: true,
    title: "Order Shipped · #{orderId}",
    body: "Your parcel ({items}) has been shipped via {courier} (AWB: {awb}). Expected delivery: {eta}.",
  },
  {
    key: "out_for_delivery",
    label: "Out for Delivery",
    enabled: true,
    title: "Out for Delivery Today · #{orderId}",
    body: "Your VGMF parcel ({items}) is out for delivery today with {courier}. Please keep your phone reachable.",
  },
  {
    key: "delivered",
    label: "Delivered",
    enabled: true,
    title: "Order Delivered · #{orderId}",
    body: "Your order ({items}) has been delivered! Thank you for choosing Vaidya Gogate Memorial Foundation.",
  },
];

const FILE = () => dataFile("mobile-notifications.json");
const STAGES_FILE = () => dataFile("mobile-order-stage-notifications.json");

export function listMobileNotifications(): MobileNotification[] {
  try {
    const raw = JSON.parse(readFileSync(FILE(), "utf8"));
    return Array.isArray(raw) ? (raw as MobileNotification[]) : [];
  } catch {
    return [];
  }
}

function writeAll(rows: MobileNotification[]) {
  const file = FILE();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(rows, null, 2));
}

export function getOrderStageNotifications(): OrderStageTemplate[] {
  try {
    const raw = JSON.parse(readFileSync(STAGES_FILE(), "utf8"));
    if (Array.isArray(raw)) {
      const byKey = new Map<string, Partial<OrderStageTemplate>>();
      for (const item of raw) {
        if (item && typeof item === "object" && "key" in item) {
          byKey.set(String((item as { key: string }).key), item as Partial<OrderStageTemplate>);
        }
      }
      return DEFAULT_ORDER_STAGE_TEMPLATES.map((def) => {
        const saved = byKey.get(def.key);
        return {
          key: def.key,
          label: def.label,
          enabled: saved?.enabled !== undefined ? Boolean(saved.enabled) : def.enabled,
          title: typeof saved?.title === "string" && saved.title.trim() ? saved.title.trim().slice(0, 140) : def.title,
          body: typeof saved?.body === "string" && saved.body.trim() ? saved.body.trim().slice(0, 400) : def.body,
        };
      });
    }
  } catch {
    /* default templates */
  }
  return DEFAULT_ORDER_STAGE_TEMPLATES.map((d) => ({ ...d }));
}

export function saveOrderStageNotifications(incoming: Partial<OrderStageTemplate>[]): OrderStageTemplate[] {
  const byKey = new Map<string, Partial<OrderStageTemplate>>();
  for (const row of incoming) {
    if (row?.key) byKey.set(String(row.key), row);
  }
  const next = DEFAULT_ORDER_STAGE_TEMPLATES.map((def) => {
    const edit = byKey.get(def.key);
    return {
      key: def.key,
      label: def.label,
      enabled: edit?.enabled !== undefined ? Boolean(edit.enabled) : def.enabled,
      title: typeof edit?.title === "string" && edit.title.trim() ? edit.title.trim().slice(0, 140) : def.title,
      body: typeof edit?.body === "string" && edit.body.trim() ? edit.body.trim().slice(0, 400) : def.body,
    };
  });
  const file = STAGES_FILE();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(next, null, 2));
  return next;
}

export function stageKeyFromEvent(eventKey: string): OrderStageKey | null {
  if (eventKey === "placed" || eventKey === "status:Ordered" || eventKey === "status:Paid") return "ordered";
  if (eventKey === "status:Packed") return "packed";
  if (eventKey === "status:Shipped") return "shipped";
  if (eventKey === "status:Out for Delivery") return "out_for_delivery";
  if (eventKey === "status:Delivered") return "delivered";
  return null;
}

export function renderOrderStageNotification(stageKey: OrderStageKey, order: Order): { enabled: boolean; title: string; body: string; label: string } {
  const tpl = getOrderStageNotifications().find((t) => t.key === stageKey) ?? DEFAULT_ORDER_STAGE_TEMPLATES[0];
  const shipment = findShopShipment(order.id);
  const itemsText = (order.items ?? []).map((i) => `${i.title} × ${i.quantity}`).join(", ") || "VGMF Publication";
  const shortItems = itemsText.length > 90 ? `${itemsText.slice(0, 87)}…` : itemsText;
  const courier = order.courierName || shipment?.courier || "our courier partner";
  const awb = order.trackingId || shipment?.awb || "updating shortly";
  const rawEta = shipment?.expectedBy || order.eta || "";
  const eta = rawEta && !/yet to be dispatched/i.test(rawEta) ? rawEta : "shared in My Orders";
  const vars: Record<string, string> = {
    orderId: order.id,
    name: order.deliveryAddress?.fullName || "Reader",
    items: shortItems,
    total: Number(order.total || 0).toLocaleString("en-IN"),
    courier,
    awb,
    eta,
  };
  const fill = (str: string) => str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
  return {
    enabled: tpl.enabled,
    label: tpl.label,
    title: fill(tpl.title),
    body: fill(tpl.body),
  };
}

export function saveMobileNotification(input: {
  id?: string;
  title: string;
  body: string;
  category?: MobileNotification["category"];
  href?: string;
  target?: string;
  active?: boolean;
  pinned?: boolean;
  createdBy?: string;
  sentAt?: string;
  pushSentCount?: number;
}): MobileNotification {
  const rows = listMobileNotifications();
  const now = new Date().toISOString();
  const existingIdx = input.id ? rows.findIndex((r) => r.id === input.id) : -1;
  const cleanTarget = String(input.target || "all").trim().toLowerCase() || "all";
  const record: MobileNotification = {
    id: existingIdx >= 0 ? rows[existingIdx].id : `notif-${randomBytes(5).toString("hex")}`,
    title: String(input.title || "").trim().slice(0, 140),
    body: String(input.body || "").trim().slice(0, 600),
    category: input.category && ["announcement", "offer", "event", "update", "order"].includes(input.category) ? input.category : "announcement",
    href: String(input.href || "/").trim().slice(0, 160) || "/",
    target: cleanTarget,
    active: input.active !== false,
    pinned: Boolean(input.pinned),
    createdAt: existingIdx >= 0 ? rows[existingIdx].createdAt : now,
    updatedAt: now,
    sentAt: input.sentAt ?? (existingIdx >= 0 ? rows[existingIdx].sentAt : undefined),
    pushSentCount: input.pushSentCount ?? (existingIdx >= 0 ? rows[existingIdx].pushSentCount : undefined),
    createdBy: input.createdBy ?? (existingIdx >= 0 ? rows[existingIdx].createdBy : undefined),
  };
  if (existingIdx >= 0) {
    rows[existingIdx] = record;
  } else {
    rows.unshift(record);
  }
  writeAll(rows.slice(0, 200));
  return record;
}

export function deleteMobileNotification(id: string) {
  const rows = listMobileNotifications().filter((r) => r.id !== id);
  writeAll(rows);
  return rows;
}
