"use client";

import { useEffect, useMemo, useState } from "react";
import {
  adjustStoreCredit,
  createAdminOrder,
  displayName,
  fetchCustomerWallet,
  getAccounts,
  getStoreCredit,
  getStoreCreditExpiry,
  type WalletExpiry,
  verifyStoreCreditId,
  patchOrder,
  printPosReceipt,
  updateCustomer,
} from "@/lib/admin-store";
import { commerceCharges, getOrderSettings, preorderAdvance } from "@/lib/integrations";
import { formatDate } from "@/lib/utils";
import { getPickupLocation } from "@/lib/fulfillment";
import { payOnPaytmEdc, payOnRazorpayEdc, payWithRazorpay, waitForRazorpay } from "@/lib/payments-client";
import { generateOrderId } from "@/lib/store";
import { useLiveBooks } from "@/lib/use-cms";
import type { Book, DeliveryAddress, Order } from "@/types";
import { Button, EmptyState, Field, Panel, SelectInput, TextInput } from "@/components/admin/AdminUI";
import { AccountSearch } from "@/components/admin/AccountSearch";
import { canOrder, getProductByCode, isPurchasable } from "@/lib/product-data";
import { accountToDelivery } from "@/lib/account-search";
import { AddressFields, emptyDeliveryAddress } from "@/components/store/AddressFields";
import { BarcodeCamera } from "@/components/admin/BarcodeCamera";
import { matchesBarcode } from "@/lib/barcode";

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
  const [creditId, setCreditId] = useState("");
  const [creditIdFor, setCreditIdFor] = useState("");
  const [creditIdNote, setCreditIdNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [address, setAddress] = useState<DeliveryAddress>(emptyDeliveryAddress());
  const [scanOpen, setScanOpen] = useState(false);
  const [fulfil, setFulfil] = useState<"counter" | "delivery">("counter");
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const [preorderPay, setPreorderPay] = useState<"advance" | "full">("advance");
  const [wallet, setWallet] = useState<{ email: string; balance: number; expiring: WalletExpiry | null; error?: string } | null>(null);

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

  useEffect(() => {
    if (!accountEmail) return;
    let cancelled = false;
    fetchCustomerWallet(accountEmail)
      .then((live) => !cancelled && setWallet({ email: accountEmail, balance: live.balance, expiring: live.expiring }))
      .catch(() => !cancelled && setWallet({ email: accountEmail, balance: getStoreCredit(accountEmail), expiring: getStoreCreditExpiry(accountEmail), error: "Live wallet not reachable; showing this device's copy." }));
    return () => {
      cancelled = true;
    };
  }, [accountEmail]);

  const walletReady = Boolean(account && wallet?.email === account.email);
  const credit = account && walletReady ? wallet?.balance ?? 0 : 0;
  const rows = cart
    .map((line) => {
      const book = books.find((item) => item.id === line.bookId);
      return book ? { line, book } : null;
    })
    .filter(Boolean) as { line: Line; book: Book }[];
  const settings = getOrderSettings();
  const isPreorderBook = (book: Book) => Boolean(book.preorder?.enabled && book.stock <= 0);
  const hasPreorder = rows.some((row) => isPreorderBook(row.book));
  const mixed = hasPreorder && rows.some((row) => !isPreorderBook(row.book));
  const subtotal = rows.reduce((sum, row) => sum + row.book.price * row.line.quantity, 0);
  const { gst, platformFee } = rows.length ? commerceCharges(subtotal, settings) : { gst: 0, platformFee: 0 };
  const charge = fulfil === "delivery" ? Math.max(0, Math.round(Number(deliveryCharge) || 0)) : 0;
  // A pre-order sent by courier with no charge typed gets its courier charge added to the balance later, as on the website.
  const shippingLater = hasPreorder && fulfil === "delivery" && charge === 0;
  const grand = subtotal + gst + platformFee + charge;
  const creditApplied = useCredit && account && creditIdFor === account.email ? Math.min(credit, grand) : 0;
  const orderTotal = Math.max(0, Math.round((grand - creditApplied) * 100) / 100);
  const copies = rows.reduce((sum, row) => sum + row.line.quantity, 0);
  const advance = hasPreorder && orderTotal > 0 ? preorderAdvance(orderTotal, settings, { copies, platformFee: Math.max(0, platformFee - creditApplied) }) : orderTotal;
  const payAdvance = hasPreorder && (preorderPay === "advance" || shippingLater);
  const total = payAdvance ? advance : orderTotal;
  const balanceLater = Math.max(0, Math.round((orderTotal - total) * 100) / 100);

  const addByCode = (code: string) => {
    const book = getProductByCode(code) || books.find((item) => matchesBarcode(item, code));
    if (!book) {
      setError(`No product matched barcode ${code}.`);
      return;
    }
    add(book);
    setQuery(book.barcode || book.sku || book.title);
    setMessage(`Added ${book.title}.`);
  };

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
    if (mixed) {
      setError("Pre-order books go on their own sale. Remove either the pre-order or the in-stock items, then make a second sale.");
      return;
    }
    if (fulfil === "delivery" && (!address.line1.trim() || !address.city.trim() || !address.state.trim() || !/^\d{6}$/.test(address.pincode))) {
      setError("For home delivery, fill the customer's address, city, state and 6-digit pincode.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saleId = generateOrderId();
      const methodLabel = METHODS.find((item) => item.id === method)?.label ?? "Cash";
      let paymentMethod: string = total > 0 ? methodLabel : creditApplied > 0 ? "Store credit" : methodLabel;
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
            description: `Vaidya Gogate Memorial Foundation POS ${saleId}`,
            method: "upi",
            skipDemo: true,
          });
          if (outcome.kind === "holding") {
            setMessage("The payment is on hold until Razorpay confirms it. This sale is not recorded until then.");
            const confirmed = await waitForRazorpay(outcome.razorpayOrderId);
            if (!confirmed) {
              setMessage("The payment is still on hold. This sale is not recorded, and nothing is packed before Razorpay confirms it.");
              setBusy(false);
              return;
            }
            paymentMethod = "Razorpay UPI";
            paymentRef = confirmed;
            razorpayPaymentId = confirmed;
            razorpayOrderId = outcome.razorpayOrderId;
          } else {
            paymentMethod = outcome.live ? "Razorpay UPI" : "Razorpay UPI (demo)";
            paymentRef = outcome.paymentId;
            razorpayPaymentId = outcome.paymentId;
            razorpayOrderId = outcome.kind === "paid" ? outcome.razorpayOrderId : undefined;
          }
        } else if (method === "razorpay-edc") {
          setMessage("Sending the amount to the Razorpay EDC. Complete the payment on the machine.");
          const outcome = await payOnRazorpayEdc({
            amount: total,
            receipt: saleId,
            name,
            email: account?.email || walkIn.email,
            phone,
            description: `Vaidya Gogate Memorial Foundation POS ${saleId}`,
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
            description: `Vaidya Gogate Memorial Foundation POS ${saleId}`,
          });
          paymentMethod = outcome.method;
          paymentRef = outcome.reference ?? outcome.paymentId;
        }
      }

      const pickup = getPickupLocation();
      const registered = address.line1.trim()
        ? {
            ...address,
            fullName: name,
            phone,
            email: account?.email || walkIn.email || address.email,
          }
        : null;
      if (account && registered) {
        updateCustomer(account.email, {
          address: {
            line1: registered.line1,
            landmark: registered.landmark,
            city: registered.city,
            state: registered.state,
            pincode: registered.pincode,
            country: registered.country,
            countryCode: registered.countryCode,
          },
        });
      }
      const deliverTo: DeliveryAddress = registered ?? {
        fullName: name,
        phone,
        email: account?.email || walkIn.email,
        line1: pickup.address,
        city: "Pune",
        state: "Maharashtra",
        pincode: "411002",
        country: "India",
        countryCode: "IN",
      };
      const order = createAdminOrder({
        id: saleId,
        userEmail: deliverTo.email,
        userId: account?.id,
        deliverTo,
        items: cart,
        deliveryMode: fulfil === "delivery" ? "delivery" : "store_pickup",
        payment: "paid",
        paymentMethod,
        paymentRef,
        razorpayOrderId,
        razorpayPaymentId,
        channel: "pos",
        shippingOverride: charge,
      });
      if (creditApplied > 0 && total > 0) paymentMethod = `Store credit ${rupees(creditApplied)} + ${paymentMethod}`;
      // Pre-orders are not handed over at the counter: they wait in Orders until the book arrives.
      const updates: Partial<Order> = fulfil === "delivery" || hasPreorder ? {} : { status: "Delivered" };
      if (hasPreorder && (balanceLater > 0 || shippingLater)) {
        updates.paymentStatus = balanceLater > 0 ? "Partially Paid" : "Paid";
        updates.preorderPayment = {
          advance: total + creditApplied,
          balance: balanceLater,
          balanceWhen: settings.preorderPayment.balanceWhen,
          advancePaidAt: new Date().toISOString(),
          shippingDue: shippingLater || undefined,
        };
      }
      updates.paymentMethod = paymentMethod;
      const notes = [
        hasPreorder ? `Pre-order at counter · paid ${rupees(total + creditApplied)}${balanceLater > 0 ? ` · balance ${rupees(balanceLater)} by payment link when ready` : ""}${shippingLater ? " · courier charge added later" : ""}` : fulfil === "delivery" ? "Paid at counter · home delivery" : "Collected at counter",
      ];
      if (creditApplied > 0 && account) {
        const left = adjustStoreCredit(account.email, -creditApplied, `POS order ${order.id}`, order.id);
        updates.storeCreditUsed = creditApplied;
        updates.total = orderTotal;
        notes.push(`Store credit ₹${creditApplied} used · wallet ₹${left}`);
        setWallet({ email: account.email, balance: left, expiring: wallet?.expiring ?? null });
      }
      patchOrder(order.id, updates, notes.join(" · "));
      const paid = { ...order, ...updates, paymentMethod, paymentRef, razorpayOrderId, razorpayPaymentId };
      setLastOrder(paid);
      setCart([]);
      setReference("");
      setUseCredit(false);
      setCreditId("");
      setCreditIdFor("");
      setCreditIdNote("");
      setMessage(
        hasPreorder
          ? `Pre-order ${paid.id} recorded · ${rupees(total + creditApplied)} paid · ${paymentMethod}.${balanceLater > 0 ? ` Balance ${rupees(balanceLater)} is sent as a payment link when the book is ready.` : ""} It waits in Orders until the book arrives; stock is taken then.`
          : fulfil === "delivery"
            ? `Sale ${paid.id} recorded · ${rupees(total + creditApplied)} · ${paymentMethod}. Home delivery: it is in Orders for picking, packing and courier booking.`
            : `Sale ${paid.id} recorded · ${rupees(total + creditApplied)} · ${paymentMethod}.`
      );
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
      {scanOpen && (
        <BarcodeCamera
          label="Scan a product barcode to add it to the cart"
          onClose={() => setScanOpen(false)}
          onScan={(code) => {
            setScanOpen(false);
            addByCode(code);
          }}
        />
      )}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">In-store POS</h1>
        <p className="text-sm text-text-muted">Sell from the counter. Stock is deducted immediately and a receipt is printed.</p>
      </div>

      {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid gap-5 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Panel title="Products" description="Search by title, SKU, barcode or product code">
            <div className="flex flex-wrap gap-2">
              <div className="min-w-48 flex-1">
                <TextInput
                  placeholder="Scan or search…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    addByCode(query);
                  }}
                />
              </div>
              <Button variant="outline" onClick={() => setScanOpen(true)}>Camera</Button>
            </div>
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
      setCreditId("");
      setCreditIdFor("");
      setCreditIdNote("");
                  setWallet(null);
                  if (item) {
                    setWalkIn({
                      name: displayName(item, true),
                      phone: item.phone,
                      email: item.email,
                    });
                    setAddress(accountToDelivery(item));
                  } else {
                    setAddress(emptyDeliveryAddress());
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
              <div className="mt-2 space-y-1 text-xs text-text-muted">
                <p>
                  {account.phone} · {account.email}
                </p>
                <p className="font-semibold text-text-primary">
                  Store credit: {walletReady ? rupees(credit) : "checking…"}
                  {walletReady && wallet?.expiring ? (
                    <span className="font-normal text-amber-700"> · {rupees(wallet.expiring.amount)} expires {formatDate(wallet.expiring.at)}</span>
                  ) : null}
                </p>
                {wallet?.error && walletReady && <p className="text-amber-700">{wallet.error}</p>}
              </div>
            )}
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-text-primary">{fulfil === "delivery" ? "Delivery address" : "Registered address"}</p>
              <p className="mb-3 text-xs text-text-muted">
                The customer&apos;s saved address is shown when you pick an account. The counter can add or correct it.
              </p>
              <AddressFields value={address} onChange={setAddress} idPrefix="pos" showEmail={false} />
            </div>
          </Panel>

          <Panel title="Cart" description={`${rows.length} line${rows.length === 1 ? "" : "s"}`}>
            {rows.length === 0 ? (
              <EmptyState text="Scan or add products." />
            ) : mixed ? (
              <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">This cart mixes pre-order and in-stock items. Sell them as two separate sales.</p>
            ) : null}
            {rows.length > 0 && (
              <ul className="space-y-2">
                {rows.map(({ line, book }) => (
                  <li key={book.id} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {book.title}
                      {isPreorderBook(book) && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">Pre-order</span>}
                    </span>
                    <div className="w-16">
                      <TextInput type="number" min={1} value={line.quantity} onChange={(event) => setQty(book.id, Number(event.target.value))} />
                    </div>
                    <span className="w-16 text-right font-medium">{rupees(book.price * line.quantity)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-text-primary">Handover</p>
              <div className="flex flex-wrap gap-2">
                <Button variant={fulfil === "counter" ? "primary" : "outline"} onClick={() => setFulfil("counter")}>Take away now</Button>
                <Button variant={fulfil === "delivery" ? "primary" : "outline"} onClick={() => setFulfil("delivery")}>Home delivery</Button>
              </div>
              {fulfil === "delivery" && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Field label="Delivery charge (₹)">
                    <TextInput type="number" min={0} value={deliveryCharge} onChange={(event) => setDeliveryCharge(event.target.value)} />
                  </Field>
                  <p className="self-end text-xs text-text-muted">Ships to the address above. The order goes to Orders for picking, packing and courier booking.</p>
                </div>
              )}
            </div>
            <dl className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-text-muted">Subtotal</dt><dd>{rupees(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-text-muted">GST</dt><dd>{rupees(gst)}</dd></div>
              {fulfil === "delivery" && (
                <div className="flex justify-between"><dt className="text-text-muted">Delivery</dt><dd>{rupees(charge)}</dd></div>
              )}
              {creditApplied > 0 && (
                <div className="flex justify-between text-emerald-700"><dt>Store credit</dt><dd>−{rupees(creditApplied)}</dd></div>
              )}
              <div className="flex justify-between font-bold"><dt>To collect</dt><dd className="text-burgundy">{rupees(total)}</dd></div>
            </dl>
            {credit > 0 && account && creditIdFor !== account.email && (
              <div className="mt-3 space-y-1">
                <div className="flex gap-2">
                  <TextInput
                    className="w-36"
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="Store Credit ID"
                    aria-label="Store Credit ID"
                    value={creditId}
                    onChange={(event) => setCreditId(event.target.value.replace(/\D/g, "").slice(0, 5))}
                  />
                  <Button
                    variant="outline"
                    disabled={creditId.length !== 5}
                    onClick={async () => {
                      setCreditIdNote("");
                      const ok = await verifyStoreCreditId(account.email, creditId).catch(() => false);
                      if (ok) setCreditIdFor(account.email);
                      else setCreditIdNote("That Store Credit ID does not match this customer.");
                    }}
                  >
                    Verify ID
                  </Button>
                </div>
                <p className="text-xs text-text-muted">{creditIdNote || "Ask the customer for the 5-digit Store Credit ID shown in their wallet."}</p>
              </div>
            )}
            {credit > 0 && account && creditIdFor === account.email && (
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
