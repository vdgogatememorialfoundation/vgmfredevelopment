"use client";

import { useMemo, useState } from "react";
import {
  adjustStoreCredit,
  createAdminOrder,
  displayName,
  getAccounts,
  getStoreCredit,
  patchOrder,
  printPosReceipt,
} from "@/lib/admin-store";
import { storeConfig } from "@/lib/constants";
import { getPickupLocation } from "@/lib/fulfillment";
import { payOnPaytmEdc, payOnRazorpayEdc, payWithRazorpay } from "@/lib/payments-client";
import { generateOrderId } from "@/lib/store";
import { useLiveBooks } from "@/lib/use-cms";
import type { Book, DeliveryAddress, Order } from "@/types";
import { Button, EmptyState, Field, Panel, SelectInput, TextInput } from "@/components/admin/AdminUI";
import { AccountSearch } from "@/components/admin/AccountSearch";
import { canOrder, isPurchasable } from "@/lib/product-data";

const METHODS = [
  { id: "cash", label: "Cash" },
  { id: "upi", label: "UPI (Razorpay)" },
  { id: "razorpay-edc", label: "Razorpay EDC" },
  { id: "paytm-edc", label: "Paytm EDC" },
] as const;

type MethodId = (typeof METHODS)[number]["id"];

const rupees = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

type Line = { bookId: string; quantity: number };

export function PosDesk() {
  const books = useLiveBooks().filter((book) => book.active !== false);
  const customers = getAccounts().filter((account) => !account.role || account.role === "customer");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [accountEmail, setAccountEmail] = useState("");
  const [walkIn, setWalkIn] = useState({ name: "", phone: "", email: "" });
  const [method, setMethod] = useState<MethodId>("cash");
  const [reference, setReference] = useState("");
  const [useCredit, setUseCredit] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);

  const catalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? books.filter((book) =>
          [book.title, book.sku, book.productCode, book.barcode, book.isbn, book.author]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q))
        )
      : books;
    return list.slice(0, 40);
  }, [books, query]);

  const account = customers.find((item) => item.email === accountEmail);
  const credit = account ? getStoreCredit(account.email) : 0;
  const rows = cart
    .map((line) => {
      const book = books.find((item) => item.id === line.bookId);
      return book ? { line, book } : null;
    })
    .filter(Boolean) as { line: Line; book: Book }[];
  const subtotal = rows.reduce((sum, row) => sum + row.book.price * row.line.quantity, 0);
  const gst = Math.round(subtotal * storeConfig.gstRate);
  const creditApplied = useCredit ? Math.min(credit, subtotal + gst) : 0;
  const total = Math.max(0, subtotal + gst - creditApplied);

  const add = (book: Book) => {
    if (!canOrder(book)) return;
    setLastOrder(null);
    setCart((list) => {
      const existing = list.find((row) => row.bookId === book.id);
      const nextQty = (existing?.quantity ?? 0) + 1;
      if (isPurchasable(book) && nextQty > book.stock) return list;
      if (existing) return list.map((row) => (row.bookId === book.id ? { ...row, quantity: nextQty } : row));
      return [...list, { bookId: book.id, quantity: 1 }];
    });
  };

  const setQty = (bookId: string, quantity: number) => {
    if (quantity < 1) {
      setCart((list) => list.filter((row) => row.bookId !== bookId));
      return;
    }
    setCart((list) => list.map((row) => (row.bookId === bookId ? { ...row, quantity } : row)));
  };

  const checkout = async () => {
    const name = account ? displayName(account, true) : walkIn.name.trim();
    const phone = account?.phone || walkIn.phone.trim();
    if (!name || !phone) {
      setError("Select a customer or enter walk-in name and phone.");
      return;
    }
    if (rows.length === 0) {
      setError("Add at least one product.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saleId = generateOrderId();
      let paymentMethod: string = METHODS.find((item) => item.id === method)?.label ?? "Cash";
      let paymentRef = reference.trim() || undefined;
      let razorpayOrderId: string | undefined;
      let razorpayPaymentId: string | undefined;

      if (total > 0 && method !== "cash") {
        if (method === "upi") {
          setMessage("Opening Razorpay UPI…");
          const outcome = await payWithRazorpay({
            amount: total,
            receipt: saleId,
            name,
            email: account?.email || walkIn.email,
            phone,
            description: `VGMF POS ${saleId}`,
            method: "upi",
            skipDemo: true,
          });
          paymentMethod = outcome.live ? "Razorpay UPI" : "Razorpay UPI (demo)";
          paymentRef = outcome.paymentId;
          razorpayPaymentId = outcome.paymentId;
          razorpayOrderId = outcome.kind === "paid" ? outcome.razorpayOrderId : undefined;
        } else if (method === "razorpay-edc") {
          setMessage("Sending the amount to the Razorpay EDC. Complete the payment on the machine.");
          const outcome = await payOnRazorpayEdc({
            amount: total,
            receipt: saleId,
            name,
            email: account?.email || walkIn.email,
            phone,
            description: `VGMF POS ${saleId}`,
          });
          paymentMethod = outcome.method;
          paymentRef = outcome.reference ?? outcome.paymentId;
          razorpayPaymentId = outcome.paymentId;
          razorpayOrderId = outcome.razorpayOrderId;
        } else {
          setMessage("Sending the amount to the Paytm EDC. Complete the payment on the machine.");
          const outcome = await payOnPaytmEdc({
            amount: total,
            receipt: saleId,
            description: `VGMF POS ${saleId}`,
          });
          paymentMethod = outcome.method;
          paymentRef = outcome.reference ?? outcome.paymentId;
        }
      }

      const pickup = getPickupLocation();
      const deliverTo: DeliveryAddress = {
        fullName: name,
        phone,
        email: account?.email || walkIn.email,
        line1: pickup.address,
        city: "Pune",
        state: "Maharashtra",
        pincode: "411005",
        country: "India",
        countryCode: "IN",
      };
      const order = createAdminOrder({
        id: saleId,
        userEmail: deliverTo.email,
        userId: account?.id,
        deliverTo,
        items: cart,
        deliveryMode: "store_pickup",
        payment: "paid",
        paymentMethod,
        paymentRef,
        razorpayOrderId,
        razorpayPaymentId,
        channel: "pos",
        shippingOverride: 0,
      });
      const updates: Partial<Order> = { status: "Delivered" };
      if (creditApplied > 0 && account) {
        const balance = adjustStoreCredit(account.email, -creditApplied, `POS order ${order.id}`, order.id);
        updates.storeCreditUsed = creditApplied;
        updates.total = total;
        updates.subtotal = subtotal;
        updates.gst = gst;
        updates.shipping = 0;
        patchOrder(order.id, updates, `Store credit ₹${creditApplied} · balance ₹${balance}`);
      } else {
        patchOrder(order.id, updates, "Collected at counter");
      }
      const paid = { ...order, ...updates, paymentMethod, paymentRef, razorpayOrderId, razorpayPaymentId };
      setLastOrder(paid);
      setCart([]);
      setReference("");
      setUseCredit(false);
      setMessage(`Sale ${paid.id} recorded · ${rupees(total)} · ${paymentMethod}.`);
      printPosReceipt(paid);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not complete the sale.");
      setMessage("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">In-store POS</h1>
        <p className="text-sm text-text-muted">Sell from the counter. Stock is deducted immediately and a receipt is printed.</p>
      </div>

      {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid gap-5 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Panel title="Products" description="Search by title, SKU, barcode or product code">
            <TextInput placeholder="Scan or search…" value={query} onChange={(event) => setQuery(event.target.value)} />
            {catalog.length === 0 ? (
              <EmptyState text="No matching products." />
            ) : (
              <ul className="mt-3 max-h-[70vh] divide-y divide-border overflow-y-auto">
                {catalog.map((book) => (
                  <li key={book.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">{book.title}</p>
                      <p className="text-xs text-text-muted">
                        {book.sku} · {isPurchasable(book) ? `${book.stock} in stock` : book.preorder?.enabled ? "Pre-order" : "Out of stock"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-bold">{rupees(book.price)}</span>
                      <Button variant="outline" disabled={!canOrder(book)} onClick={() => add(book)}>
                        Add
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4 xl:col-span-2">
          <Panel title="Customer">
            <Field label="Account">
              <AccountSearch
                accounts={customers}
                selectedEmail={accountEmail}
                onSelect={(item) => {
                  setAccountEmail(item?.email ?? "");
                  setUseCredit(false);
                  if (item) {
                    setWalkIn({
                      name: displayName(item, true),
                      phone: item.phone,
                      email: item.email,
                    });
                  }
                }}
                placeholder="Search by name, phone or email"
                emptyLabel="Walk-in"
              />
            </Field>
            {!account && (
              <div className="mt-3 grid gap-2">
                <TextInput placeholder="Name" value={walkIn.name} onChange={(event) => setWalkIn({ ...walkIn, name: event.target.value })} />
                <TextInput placeholder="Phone" value={walkIn.phone} onChange={(event) => setWalkIn({ ...walkIn, phone: event.target.value })} />
                <TextInput placeholder="Email (optional)" value={walkIn.email} onChange={(event) => setWalkIn({ ...walkIn, email: event.target.value })} />
              </div>
            )}
            {account && (
              <p className="mt-2 text-xs text-text-muted">
                {account.phone} · {account.email}
                {credit > 0 ? ` · store credit ${rupees(credit)}` : ""}
              </p>
            )}
          </Panel>

          <Panel title="Cart" description={`${rows.length} line${rows.length === 1 ? "" : "s"}`}>
            {rows.length === 0 ? (
              <EmptyState text="Scan or add products." />
            ) : (
              <ul className="space-y-2">
                {rows.map(({ line, book }) => (
                  <li key={book.id} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{book.title}</span>
                    <div className="w-16">
                      <TextInput type="number" min={1} value={line.quantity} onChange={(event) => setQty(book.id, Number(event.target.value))} />
                    </div>
                    <span className="w-16 text-right font-medium">{rupees(book.price * line.quantity)}</span>
                  </li>
                ))}
              </ul>
            )}
            <dl className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-text-muted">Subtotal</dt><dd>{rupees(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-text-muted">GST</dt><dd>{rupees(gst)}</dd></div>
              {creditApplied > 0 && (
                <div className="flex justify-between text-emerald-700"><dt>Store credit</dt><dd>−{rupees(creditApplied)}</dd></div>
              )}
              <div className="flex justify-between font-bold"><dt>To collect</dt><dd className="text-burgundy">{rupees(total)}</dd></div>
            </dl>
            {credit > 0 && (
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={useCredit} onChange={(event) => setUseCredit(event.target.checked)} />
                Apply store credit ({rupees(credit)})
              </label>
            )}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <SelectInput
                value={method}
                onChange={(event) => setMethod(event.target.value as MethodId)}
                disabled={busy}
              >
                {METHODS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </SelectInput>
              {method === "cash" ? (
                <TextInput placeholder="Reference / UTR (optional)" value={reference} onChange={(event) => setReference(event.target.value)} />
              ) : (
                <p className="self-center text-xs text-text-muted">
                  {method === "upi"
                    ? "Creates a Razorpay UPI payment. The customer pays in the Razorpay window."
                    : method === "razorpay-edc"
                      ? "Pushes the amount to the Razorpay EDC machine."
                      : "Pushes the amount to the Paytm EDC machine."}
                </p>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => void checkout()} disabled={busy || rows.length === 0}>
                {busy
                  ? method === "cash"
                    ? "Saving…"
                    : "Waiting for payment…"
                  : method === "cash"
                    ? `Collect ${rupees(total)}`
                    : `Charge ${rupees(total)}`}
              </Button>
              <Button variant="outline" onClick={() => setCart([])} disabled={busy}>
                Clear
              </Button>
            </div>
            {lastOrder && (
              <Button className="mt-2" variant="ghost" onClick={() => printPosReceipt(lastOrder)}>
                Reprint receipt {lastOrder.id}
              </Button>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
