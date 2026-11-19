"use client";

import { useMemo, useState } from "react";
import { EmptyState, Panel, TextInput } from "@/components/admin/AdminUI";
import { useCommerceMirror } from "@/lib/commerce-sync";
import { downloadExcel } from "@/lib/export-file";
import { isSampleOrder } from "@/lib/order-pipeline";
import { getOrders } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import type { Order } from "@/types";

const rupees = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

type ProductLine = { key: string; sku: string; title: string; orders: number; quantity: number; amount: number; lastAt: string };
type CustomerRow = {
  key: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  orders: Order[];
  quantity: number;
  spent: number;
  firstAt: string;
  lastAt: string;
  products: ProductLine[];
};

function customerKey(order: Order) {
  const email = (order.accountEmail || order.deliveryAddress?.email || "").trim().toLowerCase();
  if (email) return email;
  const phone = (order.deliveryAddress?.phone || "").replace(/\D/g, "").slice(-10);
  return phone || order.userId || order.id;
}

function buildCustomers(orders: Order[]) {
  const map = new Map<string, CustomerRow & { productMap: Map<string, ProductLine> }>();
  for (const order of orders) {
    if (isSampleOrder(order) || order.status === "Cancelled") continue;
    const key = customerKey(order);
    const address = order.deliveryAddress;
    const row =
      map.get(key) ??
      {
        key,
        name: address?.fullName || "",
        phone: address?.phone || "",
        email: order.accountEmail || address?.email || "",
        city: address?.city || "",
        orders: [],
        quantity: 0,
        spent: 0,
        firstAt: order.date,
        lastAt: order.date,
        products: [],
        productMap: new Map<string, ProductLine>(),
      };
    row.orders.push(order);
    row.spent += Math.max(0, order.total - (order.refundAmount ?? 0));
    if (order.date < row.firstAt) row.firstAt = order.date;
    if (order.date >= row.lastAt) {
      row.lastAt = order.date;
      row.name = address?.fullName || row.name;
      row.phone = address?.phone || row.phone;
      row.city = address?.city || row.city;
    }
    for (const item of order.items) {
      const itemKey = item.sku || item.bookId;
      const line = row.productMap.get(itemKey) ?? { key: itemKey, sku: item.sku || "", title: item.title, orders: 0, quantity: 0, amount: 0, lastAt: order.date };
      line.orders += 1;
      line.quantity += item.quantity;
      line.amount += item.price * item.quantity;
      if (order.date >= line.lastAt) line.lastAt = order.date;
      row.productMap.set(itemKey, line);
      row.quantity += item.quantity;
    }
    map.set(key, row);
  }
  return [...map.values()]
    .map(({ productMap, ...row }) => ({ ...row, products: [...productMap.values()].sort((a, b) => b.quantity - a.quantity) }))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export function CustomerPurchasesDesk() {
  const { version } = useCommerceMirror();
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  // version changes whenever the live order mirror updates
  const customers = useMemo(() => {
    void version;
    return buildCustomers(getOrders());
  }, [version]);

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? customers.filter(
        (row) =>
          [row.name, row.phone, row.email, row.city].some((value) => value.toLowerCase().includes(needle)) ||
          row.products.some((line) => line.title.toLowerCase().includes(needle) || line.sku.toLowerCase().includes(needle))
      )
    : customers;

  const exportSummary = () =>
    downloadExcel(
      "vgmf-customer-purchases",
      "Customer purchases",
      ["Customer", "Phone", "Email", "City", "Orders", "Copies", "Amount spent", "First order", "Last order", "Products"],
      shown.map((row) => [
        row.name,
        row.phone,
        row.email,
        row.city,
        row.orders.length,
        row.quantity,
        row.spent,
        formatDate(row.firstAt),
        formatDate(row.lastAt),
        row.products.map((line) => `${line.title} × ${line.quantity} (${line.orders} order${line.orders === 1 ? "" : "s"})`).join("; "),
      ])
    );

  const exportDetail = () =>
    downloadExcel(
      "vgmf-customer-products",
      "Customer products",
      ["Customer", "Phone", "Email", "Product", "SKU", "Times ordered", "Copies", "Amount", "Last ordered"],
      shown.flatMap((row) =>
        row.products.map((line) => [row.name, row.phone, row.email, line.title, line.sku, line.orders, line.quantity, line.amount, formatDate(line.lastAt)])
      )
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Customer purchases</h1>
        <p className="mt-1 text-sm text-text-muted">
          Which customer ordered which products, how many times and how many copies. Cancelled orders are left out; refunds are taken off the amount spent.
        </p>
      </div>
      <Panel
        title={`${shown.length} customer${shown.length === 1 ? "" : "s"}`}
        description="Updates by itself as new orders come in."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportSummary} className="rounded-lg bg-burgundy px-3 py-1.5 text-sm font-semibold text-white">
              Excel · customers
            </button>
            <button type="button" onClick={exportDetail} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-text-primary">
              Excel · customer × product
            </button>
          </div>
        }
      >
        <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone, email, city, product or SKU" />
        {shown.length === 0 ? (
          <div className="mt-4">
            <EmptyState text="No customer orders yet." />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {shown.map((row) => (
              <li key={row.key} className="py-3">
                <button type="button" onClick={() => setOpenKey(openKey === row.key ? null : row.key)} className="flex w-full flex-wrap items-start justify-between gap-3 text-left">
                  <span className="min-w-0">
                    <span className="block font-semibold text-text-primary">{row.name || row.email || row.phone}</span>
                    <span className="block text-xs text-text-muted">{[row.phone, row.email, row.city].filter(Boolean).join(" · ")}</span>
                    <span className="mt-1 block text-xs text-text-primary">
                      {row.products.map((line) => `${line.title} × ${line.quantity}`).join(", ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-text-muted">
                    <span className="block text-sm font-bold text-text-primary">{rupees(row.spent)}</span>
                    {row.orders.length} order{row.orders.length === 1 ? "" : "s"} · {row.quantity} cop{row.quantity === 1 ? "y" : "ies"}
                    <span className="block">Last {formatDate(row.lastAt)}</span>
                  </span>
                </button>
                {openKey === row.key && (
                  <div className="mt-3 space-y-3 rounded-xl bg-warm-cream/40 p-3 text-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="text-text-muted">
                        <tr>
                          <th className="py-1">Product</th>
                          <th className="py-1">SKU</th>
                          <th className="py-1 text-right">Times ordered</th>
                          <th className="py-1 text-right">Copies</th>
                          <th className="py-1 text-right">Amount</th>
                          <th className="py-1 text-right">Last ordered</th>
                        </tr>
                      </thead>
                      <tbody>
                        {row.products.map((line) => (
                          <tr key={line.key} className="border-t border-border">
                            <td className="py-1 font-medium text-text-primary">{line.title}</td>
                            <td className="py-1">{line.sku}</td>
                            <td className="py-1 text-right">{line.orders}</td>
                            <td className="py-1 text-right">{line.quantity}</td>
                            <td className="py-1 text-right">{rupees(line.amount)}</td>
                            <td className="py-1 text-right">{formatDate(line.lastAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="text-xs text-text-muted">
                      Orders:{" "}
                      {row.orders
                        .slice()
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((order) => `#${order.id} (${formatDate(order.date)}, ${order.status}, ${rupees(order.total)})`)
                        .join(" · ")}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
