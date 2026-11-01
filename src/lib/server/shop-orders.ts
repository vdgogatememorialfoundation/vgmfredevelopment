import { readFileSync, writeFileSync } from "node:fs";
import { orderActivityAt, orderBelongsTo, phonesMatch, type AccountRef } from "@/lib/commerce-stamp";
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

function writeAll(orders: Order[]) {
  writeFileSync(file(), JSON.stringify(orders.slice(0, 2000)));
}

export function listShopOrders() {
  return readAll();
}

export function findShopOrder(id: string) {
  return readAll().find((order) => order.id === id);
}

export function ordersForEmail(email: string) {
  return ordersForAccount({ email });
}

export function ordersForAccount(account: AccountRef) {
  if (!account.email && !account.phone && !account.id) return [];
  return readAll().filter((order) => orderBelongsTo(order, account));
}

export function orderPhoneMatches(order: Order, phone: string) {
  return phonesMatch(order.deliveryAddress?.phone, phone);
}

export function upsertShopOrder(order: Order) {
  if (!order?.id) return;
  const all = readAll();
  const prev = all.find((item) => item.id === order.id);
  if (prev && orderActivityAt(prev) > orderActivityAt(order)) return prev;
  const orders = all.filter((item) => item.id !== order.id);
  orders.unshift(prev ? { ...prev, ...order } : order);
  writeAll(orders);
  return orders[0];
}

export function patchShopOrder(id: string, update: Partial<Order>) {
  const all = readAll();
  const index = all.findIndex((order) => order.id === id);
  if (index === -1) return;
  all[index] = { ...all[index], ...update };
  writeAll(all);
  return all[index];
}

export function searchShopOrders(query: string) {
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  if (q.length < 3 && digits.length < 4) return [];
  return readAll()
    .filter((order) => {
      const phone = order.deliveryAddress?.phone?.replace(/\D/g, "") ?? "";
      const hay = [order.id, order.accountEmail, order.deliveryAddress?.fullName, order.deliveryAddress?.email, order.deliveryAddress?.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q) || (digits.length >= 4 && phone.includes(digits));
    })
    .slice(0, 20);
}
