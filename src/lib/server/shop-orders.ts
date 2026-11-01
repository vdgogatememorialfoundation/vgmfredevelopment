import { readFileSync, writeFileSync } from "node:fs";
import { dataFile } from "@/lib/server/paths";
import type { Order } from "@/types";

function file() {
  return dataFile("shop-orders.json");
}

function readAll(): Order[] {
  try {
    const parsed = JSON.parse(readFileSync(file(), "utf8")) as Order[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function upsertShopOrder(order: Order) {
  if (!order?.id) return;
  const orders = readAll().filter((item) => item.id !== order.id);
  orders.unshift(order);
  writeFileSync(file(), JSON.stringify(orders.slice(0, 2000)));
}

export function searchShopOrders(query: string) {
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  if (q.length < 3 && digits.length < 4) return [];
  return readAll()
    .filter((order) => {
      const phone = order.deliveryAddress?.phone?.replace(/\D/g, "") ?? "";
      const hay = [order.id, order.deliveryAddress?.fullName, order.deliveryAddress?.email, order.deliveryAddress?.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q) || (digits.length >= 4 && phone.includes(digits));
    })
    .slice(0, 20);
}
