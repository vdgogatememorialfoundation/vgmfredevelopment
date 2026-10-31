"use client";

import { useState } from "react";
import {
  cancelOrder,
  createAdminOrder,
  createReplacement,
  deleteOrder,
  exportOrdersCsv,
  getAccounts,
  getOrder as getOrderByAdmin,
  getSettings,
  getShipments,
  patchOrder,
  printOrderInvoice,
  printOrdersPdf,
  printPackagingSlip,
  printShippingLabel,
  recordPayment,
  refundToStoreCredit,
  resaveOrder,
  setOrderStatus,
} from "@/lib/admin-store";
import { getOrders, getReturnRequest, initiateReturn, updateReturnRequest } from "@/lib/store";
import { getLiveBooks } from "@/lib/product-data";
import { getIntegrations, getOrderSettings, shippingFeeFor, shippingFeeSummary } from "@/lib/integrations";
import {
  advanceDemoShipment,
  bookShipment,
  cancelShipment,
  createReturnShipment,
  downloadInvoice,
  downloadLabel,
  downloadManifest,
  fetchCourierRates,
  orderWeightKg,
  reallocateCourier,
  schedulePickup,
  trackShipment,
  type RateQuote,
} from "@/lib/shipping-client";
import { createPaymentLink, paymentMode, refreshPaymentLink, refundThroughGateway } from "@/lib/payments-client";
import { RatesTable } from "@/components/admin/SettingsDesks";
import OrderTrackingTimeline from "@/components/store/OrderTrackingTimeline";
import { formatDate } from "@/lib/utils";
import type { CourierRate, DeliveryAddress, Order, User } from "@/types";
import { Button, EmptyState, Field, ORDER_STATUS_TONES, Panel, SelectInput, StatusBadge, TextInput } from "@/components/admin/AdminUI";
import { AccountSearch } from "@/components/admin/AccountSearch";
import { accountToDelivery } from "@/lib/account-search";
import { COUNTRIES, countryByCode, isIndia, isValidPhone, isValidPostal, statesFor } from "@/lib/geo";
import { classNames, formatDateTime } from "@/lib/utils";
import { AdminModal } from "@/components/admin/AdminModal";

const ALL_STATUSES: Order["status"][] = [
  "Pending",
  "Processing",
  "Ordered",
  "Accepted",
  "Packed",
  "Ready to Ship",
  "To Ship",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Failed",
  "Cancelled",
];
const PAYMENT_TONES: Record<string, string> = {
  Paid: "bg-emerald-50 text-emerald-700",
  Pending: "bg-amber-50 text-amber-700",
  Failed: "bg-red-50 text-red-600",
  Refunded: "bg-slate-100 text-slate-600",
  "Partially Refunded": "bg-amber-50 text-amber-700",
};
const PAYMENT_METHODS = ["UPI", "Bank transfer", "Cash", "Card (POS)", "Cheque", "Razorpay (manual)", "Cash on delivery"];

const rupees = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

function useOrdersVersion() {
  const [version, setVersion] = useState(0);
  return [version, () => setVersion((value) => value + 1)] as const;
}

export function OrdersDashboard() {
  const [version, refresh] = useOrdersVersion();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [bulkBusy, setBulkBusy] = useState("");
  const [bulkNote, setBulkNote] = useState("");

  const orders = getOrders();
  const filtered = orders
    .filter((order) => statusFilter === "All" || order.status === statusFilter)
    .filter((order) => paymentFilter === "All" || order.paymentStatus === paymentFilter)
    .filter((order) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return [order.id, order.deliveryAddress?.fullName, order.deliveryAddress?.phone, order.deliveryAddress?.email, order.trackingId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    })
    .slice(0, 300);
  const selected = selectedId ? getOrderByAdmin(selectedId) : null;

  const selectedIds = filtered.filter((order) => picked[order.id]).map((order) => order.id);
  const toPack = orders.filter((order) => order.status === "Ordered" || order.status === "Accepted").length;
  const awaitingPayment = orders.filter((order) => order.paymentStatus === "Pending" && order.status !== "Cancelled" && order.paymentMethod !== "Cash on delivery").length;
  const toShip = orders.filter((order) => order.status === "To Ship" || order.status === "Ready to Ship" || order.status === "Packed").length;
  const outForDelivery = orders.filter((order) => order.status === "Out for Delivery").length;
  const delivered = orders.filter((order) => order.status === "Delivered").length;
  const inTransit = orders.filter((order) => order.status === "Shipped" || order.status === "Out for Delivery").length;
  const returns = orders.filter((order) => getReturnRequest(order.id) && !["Refunded", "Replacement Created"].includes(getReturnRequest(order.id)!.status)).length;

  const bulk = async (label: string, task: (id: string) => Promise<void> | void) => {
    if (selectedIds.length === 0) return;
    setBulkBusy(label);
    setBulkNote("");
    try {
      for (const id of selectedIds) await task(id);
      setBulkNote(`${label} · ${selectedIds.length} order${selectedIds.length === 1 ? "" : "s"}`);
      setPicked({});
      refresh();
    } catch (error) {
      setBulkNote(error instanceof Error ? error.message : "Bulk action failed.");
    } finally {
      setBulkBusy("");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Orders</h1>
          <p className="text-sm text-text-muted">Create orders, collect payment, book couriers, schedule pickups, print AWB labels, and handle returns and refunds.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowCreate(true)}>+ Create order</Button>
          <Button variant="outline" onClick={() => exportOrdersCsv(selectedIds.length ? filtered.filter((order) => picked[order.id]) : filtered)}>Excel</Button>
          <Button variant="outline" onClick={() => printOrdersPdf(selectedIds.length ? filtered.filter((order) => picked[order.id]) : filtered)}>PDF</Button>
          <Button variant="outline" onClick={refresh}>Refresh</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {[
          ["To pack", toPack, "Accepted"],
          ["To Ship", toShip, "To Ship"],
          ["Out for Delivery", outForDelivery, "Out for Delivery"],
          ["Delivered", delivered, "Delivered"],
          ["Awaiting payment", awaitingPayment, "Pending"],
          ["In transit", inTransit, "Shipped"],
          ["Open returns", returns, "All"],
        ].map(([label, count, filter]) => (
          <button
            key={label as string}
            type="button"
            onClick={() => (label === "Awaiting payment" ? setPaymentFilter("Pending") : setStatusFilter(filter as string))}
            className="rounded-xl border border-border bg-white p-4 text-left transition hover:border-burgundy/40"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold text-text-primary">{count}</p>
          </button>
        ))}
      </div>

      {bulkNote && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{bulkNote}</p>}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white p-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{selectedIds.length} selected</span>
          <Button variant="outline" disabled={Boolean(bulkBusy)} onClick={() => bulk("Accepted", (id) => setOrderStatus(id, "Accepted"))}>Accept</Button>
          <Button variant="outline" disabled={Boolean(bulkBusy)} onClick={() => bulk("Packed", async (id) => {
            setOrderStatus(id, "Packed");
            const order = getOrderByAdmin(id);
            if (order?.deliveryMode === "delivery" && getIntegrations().shipping.autoBookOnPack) await bookShipment(id);
          })}>Pack</Button>
          <Button variant="outline" disabled={Boolean(bulkBusy)} onClick={() => bulk("To Ship", async (id) => {
            setOrderStatus(id, "To Ship");
            const order = getOrderByAdmin(id);
            if (order?.deliveryMode === "delivery") await bookShipment(id);
          })}>To Ship</Button>
          <Button variant="outline" disabled={Boolean(bulkBusy)} onClick={() => bulk("Out for Delivery", (id) => setOrderStatus(id, "Out for Delivery"))}>Out for Delivery</Button>
          <Button variant="outline" disabled={Boolean(bulkBusy)} onClick={() => bulk("Delivered", (id) => setOrderStatus(id, "Delivered"))}>Delivered</Button>
          <Button variant="outline" onClick={() => exportOrdersCsv(filtered.filter((order) => picked[order.id]))}>Excel</Button>
          <Button variant="outline" onClick={() => printOrdersPdf(filtered.filter((order) => picked[order.id]))}>PDF</Button>
          <Button variant="outline" disabled={Boolean(bulkBusy)} onClick={() => bulk("Labels", async (id) => {
            const shipment = getShipments().find((item) => item.orderId === id && item.note !== "Cancelled");
            if (shipment) await downloadLabel(shipment.id);
          })}>Labels</Button>
          <Button variant="outline" disabled={Boolean(bulkBusy)} onClick={() => bulk("Cancelled", (id) => cancelOrder(id, "Bulk cancel"))}>Cancel</Button>
          <Button variant="danger" disabled={Boolean(bulkBusy)} onClick={() => {
            if (!window.confirm(`Delete ${selectedIds.length} order(s)? This cannot be undone.`)) return;
            bulk("Deleted", (id) => deleteOrder(id));
          }}>Delete</Button>
        </div>
      )}

      {showCreate && (
        <AdminModal title="Create order" wide onClose={() => setShowCreate(false)}>
          <CreateOrderForm
            onDone={(id) => {
              refresh();
              setShowCreate(false);
              if (id) setSelectedId(id);
            }}
          />
        </AdminModal>
      )}

      {selected ? (
        <AdminModal title={`Order #${selected.id}`} wide onClose={() => setSelectedId(null)}>
          <OrderDetail key={`${selected.id}-${version}`} order={selected} onChanged={refresh} />
        </AdminModal>
      ) : null}

      <div className="grid gap-5">
        <div>
          <Panel
            title="All orders"
            description={`${filtered.length} of ${orders.length} orders`}
            action={
              <Button
                variant="ghost"
                onClick={() => {
                  const allOn = filtered.every((order) => picked[order.id]);
                  setPicked(allOn ? {} : Object.fromEntries(filtered.map((order) => [order.id, true])));
                }}
              >
                {filtered.length > 0 && filtered.every((order) => picked[order.id]) ? "Clear" : "Select all"}
              </Button>
            }
          >
            <div className="mb-3 grid gap-2 sm:grid-cols-3">
              <TextInput placeholder="Search id, name, phone, AWB" value={query} onChange={(event) => setQuery(event.target.value)} />
              <SelectInput value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option>All</option>
                {ALL_STATUSES.map((status) => <option key={status}>{status}</option>)}
              </SelectInput>
              <SelectInput value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
                <option>All</option>
                <option>Pending</option>
                <option>Paid</option>
                <option>Refunded</option>
                <option>Failed</option>
              </SelectInput>
            </div>
            {filtered.length === 0 ? (
              <EmptyState text="No orders match." />
            ) : (
              <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto">
                {filtered.map((order) => (
                  <li key={order.id} className="flex items-stretch">
                    <label className="flex items-center px-2">
                      <input
                        type="checkbox"
                        checked={Boolean(picked[order.id])}
                        onChange={(event) => setPicked((current) => ({ ...current, [order.id]: event.target.checked }))}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setSelectedId(order.id)}
                      className={classNames(
                        "flex min-w-0 flex-1 items-center justify-between gap-3 px-2 py-3 text-left transition hover:bg-warm-cream/40",
                        selectedId === order.id && "bg-warm-cream/70"
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block font-mono text-xs font-semibold text-text-primary">#{order.id}</span>
                        <span className="block truncate text-xs text-text-muted">
                          {order.deliveryAddress?.fullName || order.items[0]?.title} · {formatDate(order.date)}
                          {order.channel === "pos" ? " · POS" : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="flex gap-1">
                          <StatusBadge status={order.status} mapping={ORDER_STATUS_TONES} />
                          <StatusBadge status={order.paymentStatus} mapping={PAYMENT_TONES} />
                        </span>
                        <span className="text-sm font-bold text-text-primary">{rupees(order.total)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

type PaymentChoice = "link" | "collect" | "paid" | "cod";

function CreateOrderForm({ onDone }: { onDone: (orderId?: string) => void }) {
  const books = getLiveBooks();
  const orderSettings = getOrderSettings();
  const customers = getAccounts().filter((account) => !account.role || account.role === "customer");
  const [accountEmail, setAccountEmail] = useState("");
  const [items, setItems] = useState<{ bookId: string; quantity: number }[]>([{ bookId: books[0]?.id ?? "", quantity: 1 }]);
  const [customer, setCustomer] = useState<DeliveryAddress>({ fullName: "", phone: "", email: "", line1: "", landmark: "", city: "", state: "Maharashtra", pincode: "", country: "India", countryCode: "IN" });
  const [mode, setMode] = useState<Order["deliveryMode"]>(orderSettings.deliveryEnabled ? "delivery" : "store_pickup");
  const [quote, setQuote] = useState<RateQuote | null>(null);
  const [picked, setPicked] = useState<number | undefined>();
  const [loadingRates, setLoadingRates] = useState(false);
  const [payment, setPayment] = useState<PaymentChoice>("link");
  const [method, setMethod] = useState("UPI");
  const [reference, setReference] = useState("");
  const [shippingOverride, setShippingOverride] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const setRow = (index: number, patch: Partial<{ bookId: string; quantity: number }>) =>
    setItems((list) => list.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const pickAccount = (account: User | null) => {
    setAccountEmail(account?.email ?? "");
    if (account) setCustomer((current) => accountToDelivery(account, current));
  };

  const subtotal = items.reduce((sum, row) => sum + (books.find((book) => book.id === row.bookId)?.price ?? 0) * row.quantity, 0);
  const itemCount = items.reduce((sum, row) => sum + row.quantity, 0);
  const choice: CourierRate | undefined = picked !== undefined ? quote?.rates[picked] : undefined;
  const shippingFee = mode === "store_pickup" ? 0 : shippingOverride !== "" ? Number(shippingOverride) : shippingFeeFor(subtotal, itemCount, choice?.rate, orderSettings);

  const loadRates = async () => {
    if (!isIndia(customer.countryCode)) {
      setError("Live Indian courier rates apply only to India. International dispatch is confirmed after the order.");
      return;
    }
    if (!isValidPostal(customer.countryCode, customer.pincode)) {
      setError("Enter a valid postal code to check courier rates.");
      return;
    }
    setError("");
    setLoadingRates(true);
    const units = itemCount;
    const result = await fetchCourierRates({
      deliveryPincode: customer.pincode,
      weightKg: Math.max(getIntegrations().shipping.defaultWeightKg, units * getIntegrations().shipping.defaultWeightKg),
      declaredValue: subtotal,
      cod: payment === "cod",
      bookIds: items.map((row) => row.bookId),
    });
    setQuote(result);
    setPicked(result.rates.length ? 0 : undefined);
    setLoadingRates(false);
  };

  const submit = async () => {
    if (!customer.fullName || !customer.phone || (mode === "delivery" && (!customer.line1 || !customer.city || !customer.pincode))) {
      setError(mode === "delivery" ? "Fill the customer name, phone, address, city and postal code." : "Fill the customer name and phone.");
      return;
    }
    if (!isValidPhone(customer.phone)) {
      setError("Enter a valid international phone number, including country code.");
      return;
    }
    if (items.some((row) => !row.bookId || row.quantity < 1)) {
      setError("Add at least one valid item.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const account = customers.find((item) => item.email === accountEmail);
      const order = createAdminOrder({
        userEmail: customer.email,
        userId: account?.id,
        deliverTo: customer,
        items,
        deliveryMode: mode,
        payment,
        paymentMethod: payment === "paid" ? method : undefined,
        paymentRef: payment === "paid" ? reference : undefined,
        courierChoice: mode === "delivery" ? choice : undefined,
        shippingOverride: shippingOverride !== "" ? Number(shippingOverride) : undefined,
      });
      if (payment === "link") await createPaymentLink(order.id);
      onDone(order.id);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not create the order.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Create order" description="Place an order for a customer. Choose how they pay: send a payment link, record a payment you received, or cash on delivery.">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <Field label="Customer account (optional)">
            <AccountSearch
              accounts={customers}
              selectedEmail={accountEmail}
              onSelect={pickAccount}
              placeholder="Search by name, phone or email"
              emptyLabel="Guest / new customer"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><TextInput value={customer.fullName} onChange={(event) => setCustomer({ ...customer, fullName: event.target.value })} /></Field>
            <Field label="Phone"><TextInput value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} placeholder="+91" /></Field>
            <Field label="Email"><TextInput value={customer.email ?? ""} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /></Field>
            <Field label={isIndia(customer.countryCode) ? "Pincode" : "Postal code"}><TextInput value={customer.pincode} onChange={(event) => { setCustomer({ ...customer, pincode: event.target.value }); setQuote(null); setPicked(undefined); }} /></Field>
            <Field label="Country">
              <SelectInput
                value={customer.countryCode || "IN"}
                onChange={(event) => {
                  const next = countryByCode(event.target.value);
                  const nextStates = statesFor(next.code);
                  setCustomer({
                    ...customer,
                    countryCode: next.code,
                    country: next.name,
                    state: nextStates.includes(customer.state) ? customer.state : nextStates[0] || "",
                  });
                  setQuote(null);
                  setPicked(undefined);
                }}
              >
                {COUNTRIES.map((item) => (
                  <option key={item.code} value={item.code}>{item.name} ({item.dial})</option>
                ))}
              </SelectInput>
            </Field>
          </div>
          {mode === "delivery" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Address"><TextInput value={customer.line1} onChange={(event) => setCustomer({ ...customer, line1: event.target.value })} /></Field>
              <Field label="Landmark"><TextInput value={customer.landmark ?? ""} onChange={(event) => setCustomer({ ...customer, landmark: event.target.value })} /></Field>
              <Field label="City"><TextInput value={customer.city} onChange={(event) => setCustomer({ ...customer, city: event.target.value })} /></Field>
              <Field label="State / region">
                {statesFor(customer.countryCode).length ? (
                  <SelectInput value={customer.state} onChange={(event) => setCustomer({ ...customer, state: event.target.value })}>
                    {statesFor(customer.countryCode).map((state) => <option key={state}>{state}</option>)}
                  </SelectInput>
                ) : (
                  <TextInput value={customer.state} onChange={(event) => setCustomer({ ...customer, state: event.target.value })} />
                )}
              </Field>
            </div>
          )}
          <div>
            <p className="mb-1 text-sm font-semibold text-text-primary">Items</p>
            {items.map((row, index) => (
              <div key={index} className="mb-2 flex items-center gap-2">
                <div className="flex-1">
                  <SelectInput value={row.bookId} onChange={(event) => setRow(index, { bookId: event.target.value })}>
                    {books.map((book) => (
                      <option key={book.id} value={book.id}>{book.title} — ₹{book.price}</option>
                    ))}
                  </SelectInput>
                </div>
                <div className="w-20"><TextInput type="number" min={1} value={row.quantity} onChange={(event) => setRow(index, { quantity: Number(event.target.value) })} /></div>
                {items.length > 1 && <Button variant="ghost" onClick={() => setItems(items.filter((_, i) => i !== index))}>×</Button>}
              </div>
            ))}
            <Button variant="outline" onClick={() => setItems([...items, { bookId: books[0]?.id ?? "", quantity: 1 }])}>+ Add item</Button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-text-primary">Fulfilment</p>
            <div className="flex gap-2">
              {orderSettings.deliveryEnabled && (
                <Button variant={mode === "delivery" ? "primary" : "outline"} onClick={() => setMode("delivery")}>Courier delivery</Button>
              )}
              {orderSettings.pickupEnabled && (
                <Button variant={mode === "store_pickup" ? "primary" : "outline"} onClick={() => setMode("store_pickup")}>Store pickup</Button>
              )}
            </div>
          </div>
          {mode === "delivery" && (
            <div className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-text-primary">Courier for this pincode</p>
                <Button variant="outline" onClick={loadRates} disabled={loadingRates}>{loadingRates ? "Checking…" : "Show couriers & rates"}</Button>
              </div>
              {quote && <RatesTable quote={quote} picked={picked} onPick={setPicked} />}
              <p className="mt-2 text-xs text-text-muted">{shippingFeeSummary(orderSettings)}. The courier is booked automatically when the order is packed{getIntegrations().shipping.autoBookOnPack ? "" : " (turn on auto-booking in Shipping APIs)"}.</p>
            </div>
          )}
          <div>
            <p className="mb-2 text-sm font-semibold text-text-primary">Payment</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ["link", "Send payment link", paymentMode() === "demo" ? "Demo link on this site" : "Razorpay payment link"],
                ["paid", "Already paid", "Record UPI, cash, bank transfer…"],
                ["collect", "Collect later", "Order waits as Pending"],
                ...(orderSettings.codEnabled ? [["cod", "Cash on delivery", `COD fee ₹${orderSettings.codFee}`]] : []),
              ] as [PaymentChoice, string, string][]).map(([id, label, hint]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPayment(id)}
                  className={classNames("rounded-xl border p-3 text-left text-sm", payment === id ? "border-burgundy bg-burgundy/5" : "border-border")}
                >
                  <span className="block font-semibold text-text-primary">{label}</span>
                  <span className="block text-xs text-text-muted">{hint}</span>
                </button>
              ))}
            </div>
            {payment === "paid" && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <SelectInput value={method} onChange={(event) => setMethod(event.target.value)}>
                  {PAYMENT_METHODS.map((item) => <option key={item}>{item}</option>)}
                </SelectInput>
                <TextInput placeholder="Reference / UTR / receipt no." value={reference} onChange={(event) => setReference(event.target.value)} />
              </div>
            )}
          </div>
          <dl className="space-y-1.5 rounded-xl bg-warm-cream p-4 text-sm">
            <div className="flex justify-between"><dt className="text-text-muted">Items</dt><dd>{rupees(subtotal)}</dd></div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-text-muted">Shipping</dt>
              <dd className="flex items-center gap-2">
                <input className="w-20 rounded border border-border bg-white px-2 py-1 text-right text-xs" placeholder="auto" value={shippingOverride} onChange={(event) => setShippingOverride(event.target.value.replace(/[^\d]/g, ""))} />
                {shippingFee === 0 ? "Free" : rupees(shippingFee)}
              </dd>
            </div>
            <p className="text-[11px] text-text-muted">GST and any COD fee are added when the order is created.</p>
          </dl>
        </div>
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <div className="mt-5 flex gap-2">
        <Button onClick={submit} disabled={busy}>{busy ? "Creating…" : payment === "link" ? "Create order & send link" : "Create order"}</Button>
        <Button variant="outline" onClick={() => onDone()}>Cancel</Button>
      </div>
    </Panel>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function OrderDetail({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const settings = getSettings();
  const integrations = getIntegrations();
  const shipment = getShipments().find((item) => item.orderId === order.id && item.note !== "Cancelled");
  const returnRequest = getReturnRequest(order.id);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState<Order["status"]>(order.status);
  const [method, setMethod] = useState("UPI");
  const [reference, setReference] = useState("");
  const [refundAmount, setRefundAmount] = useState(String(order.total - (order.refundAmount ?? 0)));
  const [cancelReason, setCancelReason] = useState("");
  const [quote, setQuote] = useState<RateQuote | null>(null);
  const [picked, setPicked] = useState<number | undefined>();
  const [pickupDate, setPickupDate] = useState(() => shipment?.pickupScheduledFor?.slice(0, 10) || new Date(Date.now() + 864e5).toISOString().slice(0, 10));
  const [pickupSlot, setPickupSlot] = useState(shipment?.pickupSlot || settings.pickupTimeslots[0]?.label || "10:00 – 13:00");
  const [returnReason, setReturnReason] = useState(getOrderSettings().returns.reasons[0] ?? "");
  const [refundDest, setRefundDest] = useState<"original" | "store_credit">("original");
  const [editing, setEditing] = useState(false);
  const [editAddress, setEditAddress] = useState<DeliveryAddress>(order.deliveryAddress ?? { fullName: "", phone: "", email: "", line1: "", city: "", state: "", pincode: "", country: "India", countryCode: "IN" });
  const [editItems, setEditItems] = useState(order.items.map((item) => ({ ...item })));

  const run = async (label: string, task: () => Promise<string | void> | string | void) => {
    setBusy(label);
    setProblem("");
    setMessage("");
    try {
      const result = await task();
      if (result) setMessage(result);
      onChanged();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy("");
    }
  };

  const applyStatus = () =>
    run("status", async () => {
      if (status === "Cancelled") {
        if (shipment) await cancelShipment(shipment.id).catch(() => undefined);
        cancelOrder(order.id, cancelReason || "Cancelled by admin");
        return "Order cancelled. The customer is notified.";
      }
      setOrderStatus(order.id, status);
      if (status === "Packed" && order.deliveryMode === "delivery" && !shipment && integrations.shipping.autoBookOnPack) {
        const booking = await bookShipment(order.id);
        return `Status set to Packed. ${booking.message}`;
      }
      if (status === "Ready to Ship" && order.deliveryMode === "delivery") {
        const booking = await bookShipment(order.id);
        return `Ready to ship. ${booking.message}`;
      }
      return `Status set to ${status}. The customer is notified.`;
    });

  const loadRates = () =>
    run("rates", async () => {
      const result = await fetchCourierRates({
        deliveryPincode: order.deliveryAddress?.pincode ?? "",
        weightKg: orderWeightKg(order),
        declaredValue: order.total,
        cod: order.paymentMethod === "Cash on delivery" && order.paymentStatus !== "Paid",
        bookIds: order.items.map((item) => item.bookId),
      });
      setQuote(result);
      const current = order.courierChoice ? result.rates.findIndex((rate) => rate.courierId === order.courierChoice?.courierId && rate.provider === order.courierChoice?.provider) : -1;
      setPicked(current >= 0 ? current : result.rates.length ? 0 : undefined);
    });

  const paid = order.paymentStatus === "Paid";
  const refundable = paid && (order.refundAmount ?? 0) < order.total;
  const margin = shipment ? (shipment.customerPaid ?? order.shipping) - (shipment.courierCost ?? shipment.charges) : 0;

  return (
    <Panel
      title={`Order #${order.id}`}
      description={`${formatDateTime(order.date)} · ${order.deliveryMode === "store_pickup" ? "Store pickup" : "Courier delivery"}${order.channel ? ` · ${order.channel}` : ""}${order.createdBy ? ` · created by ${order.createdBy}` : ""}`}
      action={
        <span className="flex gap-1">
          <StatusBadge status={order.status} mapping={ORDER_STATUS_TONES} />
          <StatusBadge status={order.paymentStatus} mapping={PAYMENT_TONES} />
        </span>
      }
    >
      {order.replacementOf && <p className="mb-3 rounded-lg bg-warm-cream px-3 py-2 text-xs text-text-muted">Replacement for order #{order.replacementOf}</p>}
      {message && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {problem && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{problem}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Items & totals"
          action={
            <Button variant="ghost" onClick={() => {
              if (editing) {
                setEditing(false);
                setEditAddress(order.deliveryAddress ?? editAddress);
                setEditItems(order.items.map((item) => ({ ...item })));
              } else setEditing(true);
            }}
            >
              {editing ? "Cancel edit" : "Edit order"}
            </Button>
          }
        >
          <ul className="space-y-2">
            {(editing ? editItems : order.items).map((item, index) => (
              <li key={item.bookId} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                {editing ? (
                  <div className="w-16">
                    <TextInput
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) => setEditItems((list) => list.map((row, i) => (i === index ? { ...row, quantity: Number(event.target.value) } : row)))}
                    />
                  </div>
                ) : (
                  <span className="text-text-muted">× {item.quantity}</span>
                )}
                <span className="font-medium">{rupees(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 border-t border-border pt-3 text-xs">
            <div className="flex justify-between"><dt className="text-text-muted">Subtotal</dt><dd>{rupees(order.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-text-muted">GST</dt><dd>{rupees(order.gst)}</dd></div>
            <div className="flex justify-between"><dt className="text-text-muted">Shipping{order.paymentMethod === "Cash on delivery" ? " + COD" : ""}</dt><dd>{order.shipping === 0 ? "Free" : rupees(order.shipping)}</dd></div>
            {order.storeCreditUsed ? <div className="flex justify-between text-emerald-700"><dt>Store credit</dt><dd>−{rupees(order.storeCreditUsed)}</dd></div> : null}
            <div className="flex justify-between text-sm font-bold"><dt>Total</dt><dd className="text-burgundy">{rupees(order.total)}</dd></div>
            {order.refundAmount ? <div className="flex justify-between text-red-600"><dt>Refunded</dt><dd>−{rupees(order.refundAmount)}</dd></div> : null}
          </dl>
        </Section>

        <Section title="Customer">
          {editing ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <TextInput value={editAddress.fullName} onChange={(event) => setEditAddress({ ...editAddress, fullName: event.target.value })} placeholder="Name" />
              <TextInput value={editAddress.phone} onChange={(event) => setEditAddress({ ...editAddress, phone: event.target.value })} placeholder="Phone" />
              <TextInput value={editAddress.email ?? ""} onChange={(event) => setEditAddress({ ...editAddress, email: event.target.value })} placeholder="Email" />
              <TextInput value={editAddress.pincode} onChange={(event) => setEditAddress({ ...editAddress, pincode: event.target.value })} placeholder="Postal code" />
              <TextInput value={editAddress.line1} onChange={(event) => setEditAddress({ ...editAddress, line1: event.target.value })} placeholder="Address" />
              <TextInput value={editAddress.city} onChange={(event) => setEditAddress({ ...editAddress, city: event.target.value })} placeholder="City" />
              <TextInput value={editAddress.state} onChange={(event) => setEditAddress({ ...editAddress, state: event.target.value })} placeholder="State" />
              <SelectInput
                value={editAddress.countryCode || "IN"}
                onChange={(event) => {
                  const next = countryByCode(event.target.value);
                  setEditAddress({ ...editAddress, countryCode: next.code, country: next.name });
                }}
              >
                {COUNTRIES.map((item) => (
                  <option key={item.code} value={item.code}>{item.name}</option>
                ))}
              </SelectInput>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-text-primary">{order.deliveryAddress?.fullName}</p>
              <p className="text-xs text-text-muted">{order.deliveryAddress?.phone} · {order.deliveryAddress?.email || "no email"}</p>
              {order.deliveryMode === "delivery" ? (
                <p className="mt-2 text-xs text-text-muted">
                  {order.deliveryAddress?.line1}{order.deliveryAddress?.landmark ? `, ${order.deliveryAddress.landmark}` : ""}, {order.deliveryAddress?.city}, {order.deliveryAddress?.state} {order.deliveryAddress?.pincode}{order.deliveryAddress?.country ? `, ${order.deliveryAddress.country}` : ""}
                </p>
              ) : (
                <p className="mt-2 text-xs text-text-muted">Collects from the store.</p>
              )}
            </>
          )}
          {editing && (
            <div className="mt-3">
              <Button onClick={() => run("save", () => {
                resaveOrder(order.id, { items: editItems.filter((item) => item.quantity > 0), deliveryAddress: editAddress });
                setEditing(false);
                return "Order saved.";
              })}>
                Save changes
              </Button>
            </div>
          )}
          {order.plan && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {[["Pack by", order.plan.packedBy], ["Pickup by", order.plan.pickedUpBy], ["Ship by", order.plan.shippedBy], ["Deliver by", order.plan.deliveredBy]].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-warm-cream p-2">
                  <p className="text-text-muted">{label}</p>
                  <p className="font-semibold">{formatDate(value)}</p>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Status">
          <div className="flex flex-wrap gap-2">
            <div className="min-w-44 flex-1">
              <SelectInput value={status} onChange={(event) => setStatus(event.target.value as Order["status"])}>
                {ALL_STATUSES.map((item) => <option key={item}>{item}</option>)}
              </SelectInput>
            </div>
            <Button onClick={applyStatus} disabled={busy === "status" || status === order.status}>{busy === "status" ? "Saving…" : "Update status"}</Button>
          </div>
          {order.status !== "Cancelled" && (
            <div className="mt-3 rounded-lg border border-red-100 bg-red-50/60 p-3">
              <p className="text-xs font-semibold text-red-800">Cancel this order</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <div className="min-w-48 flex-1"><TextInput placeholder="Reason for cancellation" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></div>
                <Button
                  variant="danger"
                  disabled={busy === "cancel"}
                  onClick={() => {
                    if (!window.confirm("Cancel this order? The customer is notified.")) return;
                    run("cancel", async () => {
                      if (shipment) await cancelShipment(shipment.id).catch(() => undefined);
                      cancelOrder(order.id, cancelReason || "Cancelled by admin");
                      setStatus("Cancelled");
                      return "Order cancelled.";
                    });
                  }}
                >
                  {busy === "cancel" ? "Cancelling…" : "Cancel order"}
                </Button>
              </div>
            </div>
          )}
          {status === "Cancelled" && status !== order.status && (
            <div className="mt-2"><TextInput placeholder="Reason for cancellation" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></div>
          )}
          {status === "Packed" && order.deliveryMode === "delivery" && !shipment && (
            <p className="mt-2 text-xs text-text-muted">{integrations.shipping.autoBookOnPack ? "Setting Packed books the courier automatically." : "Auto-booking on Packed is off. Book the courier below."}</p>
          )}
          {status === "Ready to Ship" && order.deliveryMode === "delivery" && (
            <p className="mt-2 text-xs text-text-muted">Ready to Ship books the courier and requests pickup on Shiprocket / iThink / Tookan / Shipday.</p>
          )}
          {order.cancelReason && <p className="mt-2 text-xs text-red-600">Cancelled: {order.cancelReason}</p>}
        </Section>

        <Section title="Payment">
          <p className="text-sm">
            <b>{order.paymentStatus}</b>
            {order.paymentMethod && <span className="text-text-muted"> · {order.paymentMethod}</span>}
            {order.paymentRef && <span className="text-text-muted"> · {order.paymentRef}</span>}
          </p>
          {order.paidAt && <p className="text-xs text-text-muted">Paid {formatDateTime(order.paidAt)}</p>}
          {order.razorpayPaymentId && <p className="font-mono text-xs text-text-muted">{order.razorpayPaymentId}</p>}

          {!paid && order.status !== "Cancelled" && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={busy === "link"} onClick={() => run("link", async () => { const link = await createPaymentLink(order.id); return `Payment link sent: ${link.url}`; })}>
                  {order.paymentLink ? "Resend payment link" : "Send payment link"}
                </Button>
                {order.paymentLink && (
                  <>
                    <Button variant="ghost" onClick={() => { navigator.clipboard?.writeText(order.paymentLink!.url); setMessage("Link copied."); }}>Copy link</Button>
                    <Button variant="ghost" onClick={() => run("check", () => refreshPaymentLink(order.id))}>Check status</Button>
                  </>
                )}
              </div>
              {order.paymentLink && <p className="break-all rounded bg-warm-cream px-2 py-1 font-mono text-[11px] text-text-muted">{order.paymentLink.url}</p>}
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <SelectInput value={method} onChange={(event) => setMethod(event.target.value)}>
                  {PAYMENT_METHODS.map((item) => <option key={item}>{item}</option>)}
                </SelectInput>
                <TextInput placeholder="Reference / UTR" value={reference} onChange={(event) => setReference(event.target.value)} />
                <Button variant="success" onClick={() => run("record", () => { recordPayment(order.id, { method, reference }); return "Payment recorded. The order is confirmed."; })}>Record payment</Button>
              </div>
            </div>
          )}

          {refundable && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <div className="w-28"><TextInput type="number" min={1} max={order.total} value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} /></div>
              <SelectInput value={refundDest} onChange={(event) => setRefundDest(event.target.value as "original" | "store_credit")}>
                <option value="original">Original payment method</option>
                <option value="store_credit">Store credit</option>
              </SelectInput>
              <Button variant="danger" disabled={busy === "refund"} onClick={() => {
                if (!window.confirm(`Refund ₹${refundAmount} to ${refundDest === "store_credit" ? "store credit" : "the original method"}?`)) return;
                run("refund", () => refundDest === "store_credit"
                  ? (refundToStoreCredit(order.id, Number(refundAmount)), "Store credit issued.")
                  : refundThroughGateway(order.id, Number(refundAmount)));
              }}>
                {busy === "refund" ? "Refunding…" : refundDest === "store_credit" ? "Refund to store credit" : order.razorpayPaymentId && !order.razorpayPaymentId.startsWith("pay_demo") ? "Refund via Razorpay" : "Record refund"}
              </Button>
            </div>
          )}
        </Section>
      </div>

      {order.deliveryMode === "delivery" && order.status !== "Cancelled" && (
        <div className="mt-4">
          <Section
            title="Courier & shipment"
            action={!shipment && <Button variant="outline" onClick={loadRates} disabled={busy === "rates"}>{busy === "rates" ? "Checking…" : "Show couriers & rates"}</Button>}
          >
            {!shipment ? (
              <div>
                <p className="text-sm text-text-muted">
                  {order.courierChoice
                    ? <>Customer chose <b className="text-text-primary">{order.courierChoice.courierName}</b> ({rupees(order.courierChoice.rate)}, {order.courierChoice.etaDays} days).</>
                    : "No courier chosen yet. The cheapest or fastest is picked by the rule in Shipping APIs."}
                </p>
                {quote && <RatesTable quote={quote} picked={picked} onPick={setPicked} />}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    disabled={busy === "book"}
                    onClick={() => run("book", async () => (await bookShipment(order.id, picked !== undefined ? quote?.rates[picked] : undefined)).message)}
                  >
                    {busy === "book" ? "Booking…" : picked !== undefined && quote ? `Book ${quote.rates[picked]?.courierName}` : "Pack & book courier"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-text-muted">
                  Booking checks Shiprocket, Nimbuspost, iThink Logistics and Shipyaari wallets first. If credits are low the AWB is not created. Tookan and Shipday hyperlocal orders ping the agent on Google Maps.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-text-primary">{shipment.courier} <span className="text-xs font-normal uppercase text-text-muted">{shipment.provider === "local" || !shipment.provider ? "demo" : shipment.provider}{shipment.live ? " · live" : ""}</span></p>
                  <p className="font-mono text-burgundy">AWB {shipment.awb}</p>
                  <p className="text-xs text-text-muted">Status: <b>{shipment.status}</b></p>
                  {shipment.pickupScheduledFor && <p className="text-xs text-text-muted">Pickup: {formatDate(shipment.pickupScheduledFor)}{shipment.pickupSlot ? `, ${shipment.pickupSlot}` : ""}{shipment.pickupReference ? ` · ref ${shipment.pickupReference}` : ""}</p>}
                  {shipment.note && <p className="text-xs text-text-muted">{shipment.note}</p>}
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg bg-warm-cream p-2"><dt className="text-text-muted">Customer paid</dt><dd className="font-semibold">{rupees(shipment.customerPaid ?? order.shipping)}</dd></div>
                    <div className="rounded-lg bg-warm-cream p-2"><dt className="text-text-muted">Courier cost</dt><dd className="font-semibold">{rupees(shipment.courierCost ?? shipment.charges)}</dd></div>
                    <div className={classNames("rounded-lg p-2", margin >= 0 ? "bg-emerald-50" : "bg-red-50")}><dt className="text-text-muted">Difference</dt><dd className="font-semibold">{margin >= 0 ? "+" : "−"}{rupees(Math.abs(margin))}</dd></div>
                  </dl>
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => run("label", () => downloadLabel(shipment.id))}>Download AWB label</Button>
                    {shipment.provider === "shiprocket" && shipment.live && (
                      <>
                        <Button variant="outline" onClick={() => run("invoice", () => downloadInvoice(shipment.id))}>Courier invoice</Button>
                        <Button variant="outline" onClick={() => run("manifest", () => downloadManifest(shipment.id))}>Pickup manifest</Button>
                      </>
                    )}
                    <Button variant="outline" onClick={() => run("track", async () => `Tracking: ${await trackShipment(shipment.id)}`)}>Track</Button>
                    <Button variant="outline" onClick={() => run("realloc", async () => {
                      const quoteResult = quote ?? await fetchCourierRates({
                        deliveryPincode: order.deliveryAddress?.pincode ?? "",
                        weightKg: orderWeightKg(order),
                        declaredValue: order.total,
                        bookIds: order.items.map((item) => item.bookId),
                      });
                      if (!quote) {
                        setQuote(quoteResult);
                        setPicked(0);
                        return "Rates loaded. Pick a courier, then click Reallocate again.";
                      }
                      const choice = picked !== undefined ? quote.rates[picked] : undefined;
                      return (await reallocateCourier(order.id, choice)).message;
                    })}>Reallocate courier</Button>
                    {!shipment.live && shipment.status !== "Delivered" && (
                      <Button variant="ghost" onClick={() => run("advance", () => { advanceDemoShipment(shipment.id); return "Moved the demo shipment to the next scan."; })}>Next scan (demo)</Button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <TextInput type="date" value={pickupDate} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setPickupDate(event.target.value)} />
                    <SelectInput value={pickupSlot} onChange={(event) => setPickupSlot(event.target.value)}>
                      {(settings.pickupTimeslots.length
                        ? settings.pickupTimeslots
                        : [{ id: "fallback", label: "10:00 – 13:00", from: "10:00", to: "13:00" }]
                      ).map((slot) => (
                        <option key={slot.id} value={slot.label}>
                          {slot.label} ({slot.from} – {slot.to})
                        </option>
                      ))}
                    </SelectInput>
                    <Button onClick={() => run("pickup", () => schedulePickup(shipment.id, pickupDate, pickupSlot))}>Schedule pickup</Button>
                  </div>
                  {shipment.status === "Booked" && (
                    <Button variant="danger" onClick={() => {
                      if (!window.confirm("Cancel this courier booking?")) return;
                      run("cancel-shipment", async () => { const text = await cancelShipment(shipment.id); patchOrder(order.id, { shipmentId: undefined, trackingId: undefined }, "Courier booking cancelled"); return text; });
                    }}>Cancel courier booking</Button>
                  )}
                </div>
                {shipment.tracking && shipment.tracking.length > 0 && (
                  <ol className="space-y-1 border-t border-border pt-3 text-xs lg:col-span-2">
                    {shipment.tracking.slice().reverse().map((event, index) => (
                      <li key={index} className="flex gap-3"><span className="w-36 shrink-0 text-text-muted">{formatDateTime(event.at)}</span><span>{event.status}{event.location ? ` · ${event.location}` : ""}</span></li>
                    ))}
                  </ol>
                )}
                <div className="lg:col-span-2 space-y-4">
                  <OrderTrackingTimeline order={order} />
                </div>
              </div>
            )}
          </Section>
        </div>
      )}

      {(order.status === "Delivered" || returnRequest || order.returnShipment || getOrderSettings().adminActions.processAfterDelivery) && order.status !== "Cancelled" && (
        <div className="mt-4">
          <Section title="Returns, refunds & replacements">
            {getOrderSettings().adminActions.processAfterDelivery ? (
              <p className="mb-2 text-xs text-text-muted">Admin can process a cancellation, refund or replacement on this order even after delivery.</p>
            ) : null}
            {order.returnShipment && (
              <p className="mb-2 text-xs text-text-muted">
                Return AWB {order.returnShipment.awb || "pending"} · {order.returnShipment.courierName} · {order.returnShipment.live ? "live" : "demo"}
              </p>
            )}
            {returnRequest ? (
              <div className="space-y-2 text-sm">
                <p><b>Return</b> · {returnRequest.status}</p>
                <p className="text-xs text-text-muted">Reason: {returnRequest.reason} · requested {formatDateTime(returnRequest.requestedAt)}</p>
                {returnRequest.kind === "return" && <p className="text-xs text-text-muted">Refund {rupees(returnRequest.refundAmount ?? 0)} after ₹{returnRequest.returnCharges} pickup charge.</p>}
                <div className="flex flex-wrap gap-2">
                  {returnRequest.status === "Return Requested" && (
                    <Button variant="outline" onClick={() => run("rt", () => { updateReturnRequest(order.id, { status: "Return Approved" }); return "Return approved."; })}>Approve</Button>
                  )}
                  {returnRequest.status === "Return Approved" && (
                    <Button variant="outline" onClick={() => run("rt", async () => {
                      const created = await createReturnShipment(order.id);
                      patchOrder(order.id, {
                        returnShipment: {
                          provider: "shiprocket",
                          live: created.live,
                          awb: created.awb,
                          courierName: created.courierName,
                          createdAt: new Date().toISOString(),
                          note: created.note,
                        },
                      }, "Return pickup booked");
                      updateReturnRequest(order.id, { status: "Pickup Scheduled" });
                      return created.note ?? `Return pickup booked. AWB ${created.awb}.`;
                    })}>Book reverse pickup</Button>
                  )}
                  {returnRequest.status === "Pickup Scheduled" && (
                    <Button variant="outline" onClick={() => run("rt", async () => {
                      updateReturnRequest(order.id, { status: "Picked Up" });
                      if (returnRequest.kind === "return" && getOrderSettings().refunds.autoRefundOnReturnPickup && paid) {
                        const text = await refundThroughGateway(order.id, returnRequest.refundAmount);
                        updateReturnRequest(order.id, { status: "Refunded" });
                        return `Picked up. ${text}`;
                      }
                      return "Marked as picked up.";
                    })}>Mark picked up</Button>
                  )}
                  {returnRequest.kind === "return" && returnRequest.status === "Picked Up" && paid && (
                    <Button variant="danger" onClick={() => run("rt", async () => {
                      const text = await refundThroughGateway(order.id, returnRequest.refundAmount);
                      updateReturnRequest(order.id, { status: "Refunded" });
                      return text;
                    })}>Refund {rupees(returnRequest.refundAmount ?? 0)}</Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <SelectInput value={returnReason} onChange={(event) => setReturnReason(event.target.value)}>
                  {getOrderSettings().returns.reasons.map((reason) => <option key={reason}>{reason}</option>)}
                </SelectInput>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => run("rt", async () => {
                    initiateReturn(order, { kind: "return", reason: returnReason });
                    const created = await createReturnShipment(order.id);
                    patchOrder(order.id, {
                      returnShipment: {
                        provider: "shiprocket",
                        live: created.live,
                        awb: created.awb,
                        courierName: created.courierName,
                        createdAt: new Date().toISOString(),
                        note: created.note,
                      },
                    }, "Return opened");
                    return created.note ?? "Return opened and reverse pickup requested.";
                  })}>Create return (reverse pickup)</Button>
                  {(getOrderSettings().returns.replacementAllowed || getOrderSettings().adminActions.processAfterDelivery) && (
                    <Button variant="outline" onClick={() => run("rt", () => {
                      const replacement = createReplacement(order.id);
                      return replacement ? `Replacement order ${replacement.id} created separately.` : "Could not create replacement.";
                    })}>Create replacement order</Button>
                  )}
                </div>
              </div>
            )}
          </Section>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => printOrderInvoice(order, shipment)}>Print invoice</Button>
        <Button variant="ghost" onClick={() => printPackagingSlip(order)}>Print packing slip</Button>
        {shipment && <Button variant="ghost" onClick={() => printShippingLabel(shipment)}>Print shipping label</Button>}
        <Button variant="danger" onClick={() => {
          if (!window.confirm(`Delete order ${order.id}? This cannot be undone.`)) return;
          run("delete", () => { deleteOrder(order.id); return "Order deleted."; });
        }}>Delete order</Button>
      </div>

      {order.history && order.history.length > 0 && (
        <div className="mt-4">
          <Section title="History">
            <ol className="space-y-1.5 text-xs">
              {order.history.slice().reverse().map((entry, index) => (
                <li key={index} className="flex gap-3">
                  <span className="w-36 shrink-0 text-text-muted">{formatDateTime(entry.at)}</span>
                  <span><b>{entry.status}</b>{entry.note ? ` · ${entry.note}` : ""}{entry.by ? <span className="text-text-muted"> · {entry.by}</span> : null}</span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      )}
    </Panel>
  );
}
