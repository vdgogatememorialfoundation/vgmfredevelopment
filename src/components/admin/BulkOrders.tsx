"use client";

import { useMemo, useState } from "react";
import { createAdminOrder, getAccounts } from "@/lib/admin-store";
import { getLiveBooks } from "@/lib/product-data";
import { getOrderSettings } from "@/lib/integrations";
import { createPaymentLink } from "@/lib/payments-client";
import { accountToDelivery } from "@/lib/account-search";
import { downloadCsv } from "@/lib/export-file";
import { col, readSheetFile } from "@/lib/import-file";
import { isValidPhone } from "@/lib/geo";
import { AccountSearch } from "@/components/admin/AccountSearch";
import { Button, Field, SelectInput, TextInput } from "@/components/admin/AdminUI";
import type { DeliveryAddress, Order, User } from "@/types";

type Pay = "link" | "paid" | "collect" | "cod";

const blankAddress: DeliveryAddress = { fullName: "", phone: "", email: "", line1: "", landmark: "", city: "", state: "Maharashtra", pincode: "", country: "India", countryCode: "IN" };

const PAY_OPTIONS: [Pay, string][] = [
  ["link", "Send payment link"],
  ["paid", "Already paid"],
  ["collect", "Collect later"],
  ["cod", "Cash on delivery"],
];

/** One customer, every product in a list: type quantities for as many products as needed. */
export function BulkOrderForm({ onDone }: { onDone: (orderId?: string) => void }) {
  const books = useMemo(() => getLiveBooks(), []);
  const customers = useMemo(() => getAccounts().filter((account) => !account.role || account.role === "customer"), []);
  const settings = getOrderSettings();
  const [accountEmail, setAccountEmail] = useState("");
  const [to, setTo] = useState<DeliveryAddress>(blankAddress);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("");
  const [mode, setMode] = useState<Order["deliveryMode"]>(settings.deliveryEnabled ? "delivery" : "store_pickup");
  const [pay, setPay] = useState<Pay>("link");
  const [shipping, setShipping] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const list = books.filter((book) => !filter.trim() || `${book.title} ${book.sku ?? ""} ${book.language ?? ""}`.toLowerCase().includes(filter.trim().toLowerCase()));
  const chosen = books.filter((book) => (qty[book.id] ?? 0) > 0);
  const units = chosen.reduce((sum, book) => sum + qty[book.id], 0);
  const subtotal = chosen.reduce((sum, book) => sum + book.price * qty[book.id], 0);

  const submit = async () => {
    if (!chosen.length) return setError("Enter a quantity for at least one product.");
    if (!to.fullName || !isValidPhone(to.phone)) return setError("Enter the customer name and a valid phone with country code.");
    if (mode === "delivery" && (!to.line1 || !to.city || !to.pincode)) return setError("Enter the delivery address, city and postal code.");
    setBusy(true);
    setError("");
    try {
      const account = customers.find((item) => item.email === accountEmail);
      const order = createAdminOrder({
        userEmail: to.email,
        userId: account?.id,
        deliverTo: to,
        items: chosen.map((book) => ({ bookId: book.id, quantity: qty[book.id] })),
        deliveryMode: mode,
        payment: pay,
        paymentMethod: pay === "paid" ? "Recorded by admin" : undefined,
        shippingOverride: shipping !== "" ? Number(shipping) : undefined,
      });
      if (pay === "link") await createPaymentLink(order.id);
      onDone(order.id);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not create the order.");
    } finally {
      setBusy(false);
    }
  };

  const set = (patch: Partial<DeliveryAddress>) => setTo((current) => ({ ...current, ...patch }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Customer account (optional)">
          <AccountSearch
            accounts={customers}
            selectedEmail={accountEmail}
            onSelect={(account: User | null) => {
              setAccountEmail(account?.email ?? "");
              if (account) setTo((current) => accountToDelivery(account, current));
            }}
            emptyLabel="Guest / new customer"
          />
        </Field>
        <Field label="Name"><TextInput value={to.fullName} onChange={(event) => set({ fullName: event.target.value })} /></Field>
        <Field label="Phone (international)"><TextInput value={to.phone} onChange={(event) => set({ phone: event.target.value })} placeholder="+91 98765 43210" /></Field>
        <Field label="Email"><TextInput value={to.email ?? ""} onChange={(event) => set({ email: event.target.value })} /></Field>
        {mode === "delivery" && (
          <>
            <Field label="Address"><TextInput value={to.line1} onChange={(event) => set({ line1: event.target.value })} /></Field>
            <Field label="City"><TextInput value={to.city} onChange={(event) => set({ city: event.target.value })} /></Field>
            <Field label="State"><TextInput value={to.state} onChange={(event) => set({ state: event.target.value })} /></Field>
            <Field label="Pincode"><TextInput value={to.pincode} onChange={(event) => set({ pincode: event.target.value.slice(0, 12) })} /></Field>
          </>
        )}
        <Field label="Fulfilment">
          <SelectInput value={mode} onChange={(event) => setMode(event.target.value as Order["deliveryMode"])}>
            {settings.deliveryEnabled && <option value="delivery">Courier delivery</option>}
            {settings.pickupEnabled && <option value="store_pickup">Store pickup</option>}
          </SelectInput>
        </Field>
        <Field label="Payment">
          <SelectInput value={pay} onChange={(event) => setPay(event.target.value as Pay)}>
            {PAY_OPTIONS.filter(([id]) => id !== "cod" || settings.codEnabled).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </SelectInput>
        </Field>
        {mode === "delivery" && (
          <Field label="Shipping charge ₹ (blank = automatic)"><TextInput type="number" min={0} value={shipping} onChange={(event) => setShipping(event.target.value)} /></Field>
        )}
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-text-primary">Products · {chosen.length} chosen · {units} units · ₹{subtotal.toLocaleString("en-IN")}</p>
          <div className="w-64"><TextInput placeholder="Filter products" value={filter} onChange={(event) => setFilter(event.target.value)} /></div>
        </div>
        <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-xs uppercase tracking-wider text-text-muted">
              <tr><th className="px-3 py-2">Product</th><th className="px-3">Language</th><th className="px-3">Price</th><th className="px-3">Stock</th><th className="px-3">Qty</th></tr>
            </thead>
            <tbody>
              {list.map((book) => (
                <tr key={book.id} className={`border-t border-border ${(qty[book.id] ?? 0) > 0 ? "bg-burgundy/5" : ""}`}>
                  <td className="px-3 py-1.5 font-medium text-text-primary">{book.title}{book.sku ? <span className="block text-xs text-text-muted">SKU {book.sku}</span> : null}</td>
                  <td className="px-3 text-xs">{book.language ?? "—"}</td>
                  <td className="px-3">₹{book.price}</td>
                  <td className="px-3 text-xs">{book.stock}</td>
                  <td className="w-24 px-3">
                    <TextInput type="number" min={0} value={qty[book.id] ?? ""} onChange={(event) => setQty((current) => ({ ...current, [book.id]: Math.max(0, Math.floor(Number(event.target.value) || 0)) }))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <Button onClick={() => void submit()} disabled={busy}>{busy ? "Creating…" : `Create bulk order (${units} units)`}</Button>
    </div>
  );
}

const ORDER_COLUMNS = ["Order ref", "Customer name", "Phone", "Email", "Address", "City", "State", "Pincode", "Country", "Delivery (delivery/pickup)", "Payment (link/paid/collect/cod)", "Shipping charge", "SKU or product title", "Quantity"];

/** Many orders at once from a filled template: one row per product; rows with the same Order ref become one order. */
export function OrderImport({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const template = () => {
    const sample = getLiveBooks()[0];
    const product = sample?.sku || sample?.title || "Product title";
    downloadCsv("order-import-template", ORDER_COLUMNS, [
      ["1", "Dr. Asha Patil", "+91 98765 43210", "asha@example.com", "12 MG Road", "Pune", "Maharashtra", "411001", "India", "delivery", "link", "", product, 2],
      ["1", "Dr. Asha Patil", "+91 98765 43210", "asha@example.com", "12 MG Road", "Pune", "Maharashtra", "411001", "India", "delivery", "link", "", product, 1],
    ]);
  };

  const importFile = async (file: File) => {
    setBusy(true);
    setNote("");
    setError("");
    try {
      const rows = await readSheetFile(file);
      const books = getLiveBooks();
      const groups = new Map<string, Record<string, string>[]>();
      rows.forEach((row, index) => {
        const ref = col(row, "Order ref") || `row-${index}`;
        groups.set(ref, [...(groups.get(ref) ?? []), row]);
      });
      let created = 0;
      const problems: string[] = [];
      for (const [ref, lines] of groups) {
        const head = lines[0];
        const items: { bookId: string; quantity: number }[] = [];
        for (const line of lines) {
          const key = col(line, "SKU or product title", "SKU", "Product").toLowerCase();
          const book = books.find((item) => (item.sku && item.sku.toLowerCase() === key) || item.title.toLowerCase() === key || item.id === key);
          const quantity = Math.floor(Number(col(line, "Quantity", "Qty")) || 0);
          if (!book || quantity < 1) problems.push(`Order ${ref}: product "${key}" not found or quantity missing`);
          else items.push({ bookId: book.id, quantity });
        }
        const phone = col(head, "Phone");
        if (!items.length || !col(head, "Customer name") || !isValidPhone(phone)) {
          problems.push(`Order ${ref}: needs customer name, valid phone and at least one product`);
          continue;
        }
        const pickup = /pick/i.test(col(head, "Delivery (delivery/pickup)", "Delivery"));
        const payRaw = col(head, "Payment (link/paid/collect/cod)", "Payment").toLowerCase();
        const payment: Pay = (["link", "paid", "collect", "cod"] as Pay[]).find((value) => payRaw.startsWith(value)) ?? "collect";
        const shippingRaw = col(head, "Shipping charge");
        try {
          const order = createAdminOrder({
            userEmail: col(head, "Email"),
            deliverTo: {
              ...blankAddress,
              fullName: col(head, "Customer name"),
              phone,
              email: col(head, "Email"),
              line1: col(head, "Address"),
              city: col(head, "City"),
              state: col(head, "State") || "Maharashtra",
              pincode: col(head, "Pincode"),
              country: col(head, "Country") || "India",
            },
            items,
            deliveryMode: pickup ? "store_pickup" : "delivery",
            payment,
            paymentMethod: payment === "paid" ? "Recorded by admin (import)" : undefined,
            shippingOverride: shippingRaw !== "" && Number.isFinite(Number(shippingRaw)) ? Number(shippingRaw) : undefined,
          });
          if (payment === "link") await createPaymentLink(order.id).catch(() => undefined);
          created += 1;
        } catch (problem) {
          problems.push(`Order ${ref}: ${problem instanceof Error ? problem.message : "could not create"}`);
        }
      }
      setNote(`Created ${created} of ${groups.size} order${groups.size === 1 ? "" : "s"}.`);
      if (problems.length) setError(`${problems.length} problem${problems.length === 1 ? "" : "s"} — ${problems.slice(0, 5).join("; ")}${problems.length > 5 ? "; …" : ""}`);
      onDone();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not read the file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 text-sm">
      <ol className="list-decimal space-y-1 pl-5 text-text-muted">
        <li>Download the template and fill one row per product. Rows with the same <b>Order ref</b> become one order.</li>
        <li>Product: use the SKU or the exact product title. Payment: link, paid, collect or cod. Delivery: delivery or pickup.</li>
        <li>Save as CSV (or Excel 97-2003 .xls) and import it here. GST, fees and shipping are worked out like a normal order.</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={template}>Download order template</Button>
        <label className={`inline-flex cursor-pointer items-center rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? "Importing…" : "Import filled template"}
          <input
            type="file"
            accept=".csv,.xls,text/csv,application/vnd.ms-excel"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void importFile(file);
            }}
          />
        </label>
      </div>
      {note && <p className="text-emerald-700">{note}</p>}
      {error && <p className="text-red-700">{error}</p>}
    </div>
  );
}
