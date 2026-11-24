import { randomBytes } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { orderActivityAt, orderBelongsTo, phonesMatch, uniqueHistory, type AccountRef } from "@/lib/commerce-stamp";
import { dataFile } from "@/lib/server/paths";
import { findAccount } from "@/lib/server/accounts";
import { notifyOrderStage } from "@/lib/server/order-stage-mail";
import { vgmfTxnId } from "@/lib/transactions";
import type { Order } from "@/types";

/** Every payment, balance payment and refund gets a 12-digit VGMF ID once; a desk copy without them keeps the saved ones. */
function withTxnIds(order: Order, prev?: Order): Order {
  const next = { ...order };
  // A book saved with "original price ₹0" once produced negative discounts; a discount is never below zero.
  if ((next.discount ?? 0) < 0) next.discount = 0;
  const paid = next.paymentStatus && next.paymentStatus !== "Pending" && next.paymentStatus !== "Failed";
  next.paymentTxnId = next.paymentTxnId || prev?.paymentTxnId || (paid ? vgmfTxnId() : undefined);
  if (!next.paymentTxnId) delete next.paymentTxnId;
  const plan = next.preorderPayment;
  if (plan?.balancePaidAt) next.preorderPayment = { ...plan, balanceTxnId: plan.balanceTxnId || prev?.preorderPayment?.balanceTxnId || vgmfTxnId() };
  if (next.refunds?.length) {
    next.refunds = next.refunds.map((refund) => (refund.vgmfId ? refund : { ...refund, vgmfId: prev?.refunds?.find((item) => item.id === refund.id)?.vgmfId || vgmfTxnId() }));
  }
  // Everything refundable returned (the platform fee is kept) counts as Refunded, not partial.
  if (next.paymentStatus === "Partially Refunded") {
    const collected = next.preorderPayment && !next.preorderPayment.balancePaidAt ? next.preorderPayment.advance : next.total;
    if ((next.refundAmount ?? 0) >= collected - Math.max(0, next.platformFee ?? 0) - 0.001) next.paymentStatus = "Refunded";
  }
  // An automatic refund already sent must not be marked due again by an older desk copy.
  if (prev?.autoRefund && prev.autoRefund.status !== "due") next.autoRefund = prev.autoRefund;
  return next;
}

function file() {
  return dataFile("shop-orders.json");
}

function readAll(): Order[] {
  let text: string;
  try {
    text = readFileSync(file(), "utf8");
  } catch {
    return [];
  }
  // A half-written or damaged file must never read as "no orders", or the next save would wipe every order.
  const parsed = JSON.parse(text) as Order[];
  if (!Array.isArray(parsed)) throw new Error("shop-orders.json is not a list.");
  return parsed;
}

function writeAll(orders: Order[]) {
  const target = file();
  const temp = `${target}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(orders.slice(0, 2000)));
  renameSync(temp, target);
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
  const all = readAll();
  const allIds = new Set(all.map((order) => order.id));
  const gone = new Set(deletedShopOrderIds());
  return all.filter((order) => {
    if (gone.has(order.id)) return false;
    if (order.splitInto?.length && order.splitInto.every((child) => gone.has(child.id) || !allIds.has(child.id))) {
      return false;
    }
    return orderBelongsTo(order, account);
  });
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
  const merged: Order = prev ? { ...prev, ...order, trackToken } : { ...order, trackToken };
  if (merged.deliveryAddress && !merged.deliveryAddress.phone) {
    const acct = findAccount(merged.accountEmail || merged.deliveryAddress.email || merged.createdBy || merged.userId || "");
    if (acct?.phone) {
      merged.deliveryAddress = {
        ...merged.deliveryAddress,
        phone: acct.phone,
        altPhone: merged.deliveryAddress.altPhone || acct.alternatePhone || acct.whatsapp || acct.phone,
      };
    }
  }
  // A field sent as null was cleared on the desk (e.g. Cancel picking); JSON drops undefined, so null is the "remove it" signal.
  for (const key of Object.keys(merged) as (keyof Order)[]) if (merged[key] === null) delete merged[key];
  // A split parent is never picked; an old browser copy must not bring its pick record back.
  if (merged.splitInto?.length) delete merged.pick;
  if (merged.history?.length) merged.history = uniqueHistory(merged.history);
  orders.unshift(withTxnIds(merged, prev));
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
  const all = readAll();
  const target = all.find((order) => order.id === clean);
  const toRemove = new Set<string>([clean]);
  if (target?.splitInto?.length) {
    for (const child of target.splitInto) {
      if (child?.id) toRemove.add(child.id);
    }
  }
  let next = all.filter((order) => !toRemove.has(order.id));
  if (target?.splitFrom) {
    const parentIdx = next.findIndex((order) => order.id === target.splitFrom);
    if (parentIdx !== -1) {
      const parent = next[parentIdx];
      const remaining = (parent.splitInto ?? []).filter((child) => !toRemove.has(child.id) && next.some((o) => o.id === child.id));
      if (remaining.length === 0) {
        toRemove.add(parent.id);
        next = next.filter((order) => order.id !== parent.id);
      } else {
        next[parentIdx] = { ...parent, splitInto: remaining };
      }
    }
  }
  writeAll(next);
  const gone = deletedShopOrderIds().filter((item) => !toRemove.has(item));
  writeFileSync(deletedFile(), JSON.stringify([...toRemove, ...gone].slice(0, 2000)));
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
