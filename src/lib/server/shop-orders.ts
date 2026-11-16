import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { orderActivityAt, orderBelongsTo, phonesMatch, type AccountRef } from "@/lib/commerce-stamp";
import { dataFile } from "@/lib/server/paths";
import { notifyOrderStage } from "@/lib/server/order-stage-mail";
import { vgmfTxnId } from "@/lib/transactions";
import type { Order } from "@/types";

/** Every payment, balance payment and refund gets a 12-digit VGMF ID once; a desk copy without them keeps the saved ones. */
function withTxnIds(order: Order, prev?: Order): Order {
  const next = { ...order };
  const paid = next.paymentStatus && next.paymentStatus !== "Pending" && next.paymentStatus !== "Failed";
  next.paymentTxnId = next.paymentTxnId || prev?.paymentTxnId || (paid ? vgmfTxnId() : undefined);
  if (!next.paymentTxnId) delete next.paymentTxnId;
  const plan = next.preorderPayment;
  if (plan?.balancePaidAt) next.preorderPayment = { ...plan, balanceTxnId: plan.balanceTxnId || prev?.preorderPayment?.balanceTxnId || vgmfTxnId() };
  if (next.refunds?.length) {
    next.refunds = next.refunds.map((refund) => (refund.vgmfId ? refund : { ...refund, vgmfId: prev?.refunds?.find((item) => item.id === refund.id)?.vgmfId || vgmfTxnId() }));
  }
  // An automatic refund already sent must not be marked due again by an older desk copy.
  if (prev?.autoRefund && prev.autoRefund.status !== "due") next.autoRefund = prev.autoRefund;
  return next;
}

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

export function findShopOrderByToken(token: string) {
  const clean = token.trim();
  if (clean.length < 12) return;
  return readAll().find((order) => order.trackToken === clean);
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

/** The order as a customer may see it: packing proof photos stay with the desk. */
export function forCustomer(order: Order): Order {
  if (!order.packPhotos) return order;
  const copy = { ...order };
  delete copy.packPhotos;
  return copy;
}

/** `quiet`: a desk edit; the customer is told only about a status change (e.g. the desk marks it Shipped). */
export function upsertShopOrder(order: Order, options: { quiet?: boolean } = {}) {
  if (!order?.id) return;
  // A browser with an old cached copy must not bring back an order the desk deleted.
  if (deletedShopOrderIds().includes(order.id)) return;
  const all = readAll();
  const prev = all.find((item) => item.id === order.id);
  if (prev && orderActivityAt(prev) > orderActivityAt(order)) return prev;
  const orders = all.filter((item) => item.id !== order.id);
  const trackToken = prev?.trackToken || order.trackToken || randomBytes(18).toString("base64url");
  orders.unshift(withTxnIds(prev ? { ...prev, ...order, trackToken } : { ...order, trackToken }, prev));
  writeAll(orders);
  void notifyOrderStage(prev, orders[0], { statusOnly: options.quiet }).catch(() => undefined);
  return orders[0];
}

function deletedFile() {
  return dataFile("shop-orders-deleted.json");
}

/** Ids the desk deleted, so customers' browsers drop their cached copy too. */
export function deletedShopOrderIds(): string[] {
  try {
    const parsed = JSON.parse(readFileSync(deletedFile(), "utf8"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function deleteShopOrder(id: string) {
  const clean = id.trim();
  if (!clean) return;
  writeAll(readAll().filter((order) => order.id !== clean));
  const gone = deletedShopOrderIds().filter((item) => item !== clean);
  writeFileSync(deletedFile(), JSON.stringify([clean, ...gone].slice(0, 2000)));
}

export function patchShopOrder(id: string, update: Partial<Order>) {
  const all = readAll();
  const index = all.findIndex((order) => order.id === id);
  if (index === -1) return;
  const prev = all[index];
  all[index] = withTxnIds({ ...prev, ...update }, prev);
  writeAll(all);
  void notifyOrderStage(prev, all[index]).catch(() => undefined);
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
