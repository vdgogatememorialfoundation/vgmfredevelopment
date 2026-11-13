"use client";

import OrderFeedback from "@/components/store/OrderFeedback";
import { DIRECT_COURIERS } from "@/lib/couriers";
import { isDeskScan } from "@/lib/order-pipeline";
import { useEffect, useRef, useState } from "react";
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
  printPackagingSlips,
  recordPayment,
  maxRefundable,
  refundToStoreCredit,
  resaveOrder,
  setOrderStatus,
  recordBalancePayment,
  recordCourierPayment,
  convertToStorePickup,
  convertToPreorder,
} from "@/lib/admin-store";
import { useCommerceMirror } from "@/lib/commerce-sync";
import { advanceReturnRequest, getOrders, getReturnRequest, initiateReturn, reviewReplacementRequest, sendReplacementAfterInspection, updateReturnRequest } from "@/lib/store";
import { currentProductTitle, getLiveBooks, orderItemBatch } from "@/lib/product-data";
import { getIntegrations, getOrderSettings, orderStatusText, preorderLate, shippingFeeFor, shippingFeeSummary } from "@/lib/integrations";
import {
  attachManualTracking,
  attachDirectTracking,
  bookShipment,
  MANUAL_PORTALS,
  cancelShipment,
  dropOrderShipments,
  createReturnShipment,
  downloadInvoice,
  downloadLabel,
  rescheduleOwnDelivery,
  downloadManifest,
  fetchCourierRates,
  selectPreorderCourier,
  bookPaidPreorders,
  orderWeightKg,
  reallocateCourier,
  schedulePickup,
  trackShipment,
  type RateQuote,
} from "@/lib/shipping-client";
import RefundDetails from "@/components/store/RefundDetails";
import { createPaymentLink, cancelOrderPaymentLinks, remainingDue, paymentMode, refreshPaymentLink, refundThroughGateway, refreshRefundStatus, createCourierPaymentLink, refreshCourierPaymentLink, createBalancePaymentLink, refreshBalancePaymentLink, createReturnChargeLink, emailReturnLabel } from "@/lib/payments-client";
import { RatesTable } from "@/components/admin/SettingsDesks";
import OrderTrackingTimeline from "@/components/store/OrderTrackingTimeline";
import { formatDate } from "@/lib/utils";
import { deliveryDatePhrase, statusStamp } from "@/lib/delivery-expectation";
import { isOwnFleet } from "@/lib/courier-label";
import type { CourierRate, DeliveryAddress, Order, User } from "@/types";
import { Button, EmptyState, Field, ORDER_STATUS_TONES, Panel, SelectInput, StatusBadge, TextInput } from "@/components/admin/AdminUI";
import { AccountSearch } from "@/components/admin/AccountSearch";
import { accountToDelivery } from "@/lib/account-search";
import { COUNTRIES, countryByCode, isIndia, isValidPhone, isValidPostal, statesFor } from "@/lib/geo";
import { fetchPostalPlace, postalLooksComplete } from "@/lib/postal-lookup";
import { classNames, formatDateTime } from "@/lib/utils";
import { AdminModal } from "@/components/admin/AdminModal";
import { goswiftNdrRequest, listPickupLocations } from "@/lib/shipping-client";
import { getOrder as getStoredOrder, patchOrder as patchStoredOrder } from "@/lib/admin-store";
import LabelSizePicker from "@/components/admin/LabelSizePicker";
import { BulkOrderForm, OrderImport } from "@/components/admin/BulkOrders";
import { beep } from "@/lib/scan-beep";
import { APPROVAL_LABELS, requestApproval } from "@/lib/approvals";
import type { ApprovalRequest } from "@/types";

const ALL_STATUSES: Order["status"][] = [
  "Pending",
  "Processing",
  "Awaiting Confirmation",
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
/** Store pickup has its own steps; the stored status stays canonical. */
const PICKUP_STATUSES: { status: Order["status"]; label: string }[] = [
  { status: "Awaiting Confirmation", label: "Awaiting Confirmation" },
  { status: "Ordered", label: "Order Confirmed" },
  { status: "Packed", label: "Ready for Pickup" },
  { status: "Delivered", label: "Picked Up" },
  { status: "Cancelled", label: "Cancelled" },
];
const PAYMENT_TONES: Record<string, string> = {
  Paid: "bg-emerald-50 text-emerald-700",
  Pending: "bg-amber-50 text-amber-700",
  Failed: "bg-red-50 text-red-600",
  Refunded: "bg-slate-100 text-slate-600",
  "Partially Refunded": "bg-amber-50 text-amber-700",
};
const PAYMENT_METHODS = ["UPI", "Bank transfer", "Cash", "Card (POS)", "Cheque", "Razorpay (manual)", "Cash on delivery", "Cash at Store"];

const rupees = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

function useOrdersVersion() {
  const [version, setVersion] = useState(0);
  return [version, () => setVersion((value) => value + 1)] as const;
}

export function OrdersDashboard() {
  const { version: remoteVersion } = useCommerceMirror();
  const [version, refresh] = useOrdersVersion();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState<"grid" | "import" | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [bulkBusy, setBulkBusy] = useState("");
  const [bulkNote, setBulkNote] = useState("");

  const orders = getOrders();
  useEffect(() => {
    void bookPaidPreorders(getOrders());
  }, [remoteVersion]);
  void version;
  void remoteVersion;
  const seenOrders = useRef<Set<string> | null>(null);
  const [newOrders, setNewOrders] = useState<string[]>([]);
  const orderIds = orders.map((order) => order.id).join(",");
  useEffect(() => {
    const ids = orderIds ? orderIds.split(",") : [];
    if (!seenOrders.current) {
      seenOrders.current = new Set(ids);
      const wanted = new URLSearchParams(window.location.search).get("order");
      if (wanted) setTimeout(() => setSelectedId(wanted), 0);
      return;
    }
    const seen = seenOrders.current;
    const placed = new Map(orders.map((order) => [order.id, Date.parse(order.date)]));
    const unseen = ids.filter((id) => !seen.has(id));
    unseen.forEach((id) => seen.add(id));
    // Only orders placed in the last 30 minutes count as new; older ones are synced copies.
    const fresh = unseen.filter((id) => Date.now() - (placed.get(id) ?? 0) < 30 * 60 * 1000);
    if (!fresh.length) return;
    beep("delivered");
    setTimeout(() => setNewOrders((current) => [...fresh, ...current].slice(0, 10)), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderIds]);
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
  const awaitingPayment = orders.filter((order) => order.paymentStatus === "Pending" && order.status !== "Cancelled" && order.paymentMethod !== "Cash on delivery" && order.paymentMethod !== "Cash at Store").length;
  const toShip = orders.filter((order) => order.status === "To Ship" || order.status === "Ready to Ship" || order.status === "Packed").length;
  const outForDelivery = orders.filter((order) => order.status === "Out for Delivery").length;
  const delivered = orders.filter((order) => order.status === "Delivered").length;
  const inTransit = orders.filter((order) => order.status === "Shipped" || order.status === "Out for Delivery").length;
  const returns = orders.filter((order) => getReturnRequest(order.id) && !["Refunded", "Replacement Created"].includes(getReturnRequest(order.id)!.status)).length;

  /** Store-pickup orders become ready at the counter (OTP unlocks); courier orders are packed and booked, one shipment each. */
  const readyForPickup = async () => {
    if (selectedIds.length === 0) return;
    setBulkBusy("Ready to pickup");
    setBulkNote("");
    let counter = 0;
    let booked = 0;
    const failed: string[] = [];
    for (const id of selectedIds) {
      const order = getOrderByAdmin(id);
      if (!order || order.status === "Cancelled" || order.status === "Delivered") continue;
      try {
        if (order.deliveryMode === "store_pickup") {
          setOrderStatus(id, "Packed");
          counter += 1;
        } else {
          setOrderStatus(id, isPreorderOrder(order) ? "Packed" : "Ready to Ship");
          if (isPreorderOrder(order)) {
            failed.push(`${id}: pre-order packed; create its shipment from the order`);
            continue;
          }
          await bookShipment(id);
          booked += 1;
        }
      } catch (error) {
        failed.push(`${id}: ${error instanceof Error ? error.message : "could not book"}`);
      }
    }
    setBulkNote(
      [`${counter} store-pickup order${counter === 1 ? "" : "s"} ready at the counter`, `${booked} courier shipment${booked === 1 ? "" : "s"} booked for pickup`, ...failed].join(" · ")
    );
    setPicked({});
    refresh();
    setBulkBusy("");
  };

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
      {newOrders.length ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span>
            <b>New order{newOrders.length > 1 ? "s" : ""}:</b>{" "}
            {newOrders.map((id) => (
              <button key={id} type="button" className="mr-2 font-mono font-semibold underline" onClick={() => setSelectedId(id)}>{id}</button>
            ))}
          </span>
          <Button variant="ghost" onClick={() => setNewOrders([])}>Dismiss</Button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Orders</h1>
          <p className="text-sm text-text-muted">Create orders, collect payment, book couriers, schedule pickups, print AWB labels, and handle returns and refunds.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowCreate(true)}>+ Create order</Button>
          <Button variant="outline" onClick={() => setShowBulk("grid")}>+ Bulk order</Button>
          <Button variant="outline" onClick={() => setShowBulk("import")}>Import orders</Button>
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
          <Button variant="outline" disabled={Boolean(bulkBusy)} onClick={() => bulk("Ordered", (id) => setOrderStatus(id, "Ordered"))}>Confirm</Button>
          <Button variant="outline" disabled={Boolean(bulkBusy)} onClick={() => bulk("Accepted", (id) => setOrderStatus(id, "Accepted"))}>Accept</Button>
          <Button variant="outline" disabled={Boolean(bulkBusy)} onClick={() => bulk("Packed", async (id) => {
            setOrderStatus(id, "Packed");
            const order = getOrderByAdmin(id);
            if (order?.deliveryMode === "delivery" && !isPreorderOrder(order) && getIntegrations().shipping.autoBookOnPack) await bookShipment(id);
          })}>Pack</Button>
          <Button variant="outline" disabled={Boolean(bulkBusy)} onClick={() => bulk("To Ship", async (id) => {
            setOrderStatus(id, "To Ship");
            const order = getOrderByAdmin(id);
            if (order?.deliveryMode === "delivery" && !isPreorderOrder(order)) await bookShipment(id);
          })}>To Ship</Button>
          <Button variant="outline" disabled={Boolean(bulkBusy)} onClick={() => void readyForPickup()}>Ready to pickup</Button>
          <Button variant="outline" disabled={Boolean(bulkBusy)} onClick={() => bulk("Out for Delivery", (id) => setOrderStatus(id, "Out for Delivery"))}>Out for Delivery</Button>
          <Button variant="outline" disabled={Boolean(bulkBusy)} onClick={() => bulk("Delivered", (id) => setOrderStatus(id, "Delivered"))}>Delivered</Button>
          <Button variant="outline" onClick={() => exportOrdersCsv(filtered.filter((order) => picked[order.id]))}>Excel</Button>
          <Button variant="outline" onClick={() => printOrdersPdf(filtered.filter((order) => picked[order.id]))}>PDF</Button>
          <Button variant="outline" disabled={Boolean(bulkBusy)} onClick={() => bulk("Labels", async (id) => {
            const shipment = getShipments().find((item) => item.orderId === id && item.note !== "Cancelled");
            if (shipment) await downloadLabel(shipment.id);
          })}>Labels</Button>
          <Button variant="outline" onClick={() => printPackagingSlips(filtered.filter((order) => picked[order.id]))}>Packaging slips</Button>
          <Button variant="outline" disabled={Boolean(bulkBusy)} onClick={() => bulk("Cancelled", async (id) => {
            await dropOrderShipments(id);
            cancelOrder(id, "Bulk cancel");
          })}>Cancel</Button>
          <Button variant="danger" disabled={Boolean(bulkBusy)} onClick={() => {
            if (!window.confirm(`Delete ${selectedIds.length} order(s)? This cannot be undone.`)) return;
            bulk("Deleted", async (id) => {
              await dropOrderShipments(id);
              await cancelOrderPaymentLinks(id);
              deleteOrder(id);
            });
          }}>Delete</Button>
        </div>
      )}

      {showBulk && (
        <AdminModal title={showBulk === "grid" ? "Bulk order" : "Import orders from a template"} wide onClose={() => setShowBulk(null)}>
          {showBulk === "grid" ? (
            <BulkOrderForm
              onDone={(id) => {
                refresh();
                setShowBulk(null);
                if (id) setSelectedId(id);
              }}
            />
          ) : (
            <OrderImport onDone={refresh} />
          )}
        </AdminModal>
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
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold text-text-primary">#{order.id}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isPreorderOrder(order) ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
                            {isPreorderOrder(order) ? "Pre-order" : "Normal"}
                          </span>
                        </span>
                        <span className="block truncate text-xs text-text-muted">
                          {order.deliveryAddress?.fullName || (order.items[0] ? currentProductTitle(order.items[0]) : "")} · {formatDate(order.date)}
                          {order.channel === "pos" ? " · POS" : ""}
                        </span>
                        <OrderRowPreview order={order} />
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

function OrderRowPreview({ order }: { order: ReturnType<typeof getOrders>[number] }) {
  const address = order.deliveryAddress;
  const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const place =
    order.deliveryMode === "store_pickup"
      ? "Store pickup"
      : address
        ? [address.line1, address.landmark, address.city, address.state, address.pincode].filter(Boolean).join(", ")
        : "";
  const contact = [address?.phone, address?.email || order.accountEmail].filter(Boolean).join(" · ");
  const payment = [
    order.paymentMethod,
    order.razorpayPaymentId || order.paymentRef,
    order.preorderPayment ? `Pre-order · advance ${rupees(order.preorderPayment.advance)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <span className="mt-1 block space-y-0.5 text-xs">
      {contact && <span className="block break-words text-text-muted">{contact}</span>}
      {place && <span className="block break-words text-text-muted">{place}</span>}
      <span className="block break-words font-medium text-text-primary">
        {quantity} item{quantity === 1 ? "" : "s"} · {order.items.map((item) => `${currentProductTitle(item)} × ${item.quantity} (${rupees(item.price * item.quantity)})`).join(", ")}
      </span>
      <span className="block break-words text-text-muted">
        Payment: {order.paymentStatus}
        {payment ? ` · ${payment}` : ""}
        {order.trackingId ? ` · AWB ${order.trackingId}` : ""}
      </span>
    </span>
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
  const [postalNote, setPostalNote] = useState("");
  const lastPostal = useRef("");
  const customerRef = useRef(customer);
  customerRef.current = customer;

  useEffect(() => {
    const pin = customer.pincode.trim();
    if (!postalLooksComplete(pin, customer.countryCode)) {
      setPostalNote("");
      return;
    }
    const key = `${customer.countryCode}:${pin}`;
    if (lastPostal.current === key) return;
    const timer = window.setTimeout(() => {
      lastPostal.current = key;
      void fetchPostalPlace(pin, customer.countryCode)
        .then((place) => {
          if (!place) {
            setPostalNote("Postal code not found. Enter city, state and country.");
            return;
          }
          const current = customerRef.current;
          const nextStates = statesFor(place.countryCode);
          lastPostal.current = `${place.countryCode}:${place.pincode || pin}`;
          setCustomer({
            ...current,
            city: place.city || current.city,
            state: nextStates.includes(place.state) ? place.state : place.state || current.state,
            country: place.country,
            countryCode: place.countryCode,
            pincode: place.pincode || pin,
          });
          setPostalNote(`${place.city}${place.state ? `, ${place.state}` : ""}, ${place.country}`);
          setQuote(null);
          setPicked(undefined);
        })
        .catch(() => setPostalNote("Could not look up this postal code."));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [customer.countryCode, customer.pincode]);

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
            <Field label="Phone (international)"><TextInput value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} placeholder={`${countryByCode(customer.countryCode).dial} 98765 43210`} /></Field>
            <Field label="Email"><TextInput value={customer.email ?? ""} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /></Field>
            <Field label={isIndia(customer.countryCode) ? "Pincode" : "Postal code"}>
              <TextInput
                value={customer.pincode}
                onChange={(event) => {
                  lastPostal.current = "";
                  setCustomer({
                    ...customer,
                    pincode: isIndia(customer.countryCode)
                      ? event.target.value.replace(/\D/g, "").slice(0, 6)
                      : event.target.value.slice(0, 12),
                  });
                  setQuote(null);
                  setPicked(undefined);
                }}
                placeholder={isIndia(customer.countryCode) ? "6-digit PIN fills city, state, country" : "Postal code fills city, state, country"}
              />
            </Field>
            <Field label="Country">
              <SelectInput
                value={customer.countryCode || "IN"}
                onChange={(event) => {
                  const next = countryByCode(event.target.value);
                  const nextStates = statesFor(next.code);
                  lastPostal.current = "";
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
              {postalNote ? <p className="sm:col-span-2 text-xs text-text-muted">{postalNote}</p> : null}
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

/** Who pays the return courier, the payment link for the customer, and the label email. */
function ReturnChargeBox({ order, run }: { order: Order; run: (label: string, task: () => Promise<string | void> | string | void) => void }) {
  const back = order.returnShipment!;
  const [amount, setAmount] = useState(String(back.charge ?? ""));
  const value = Number(amount) || 0;
  return (
    <div className="mb-3 space-y-2 rounded-xl border border-border bg-white p-3 text-xs">
      <p className="font-semibold text-text-primary">Return courier charge</p>
      <p className="text-text-muted">
        {back.chargePaidBy === "foundation"
          ? `Paid by the Foundation${back.charge ? ` · ₹${back.charge}` : ""}.`
          : back.chargePaidBy === "customer"
            ? back.chargePaidAt
              ? `Customer paid ₹${back.charge}${back.chargeRef ? ` · ${back.chargeRef}` : ""}.`
              : `Customer to pay ₹${back.charge} · link sent ${formatDateTime(back.chargeLink?.createdAt ?? "")}. Updates on its own once paid.`
            : "Choose who pays for the return courier."}
      </p>
      {!back.chargePaidAt ? (
        <div className="flex flex-wrap items-center gap-2">
          <TextInput type="number" min={0} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Charge ₹" className="w-28" />
          <Button variant="outline" onClick={() => run("return-charge", () => {
            patchOrder(order.id, { returnShipment: { ...back, charge: value || back.charge, chargePaidBy: "foundation", chargeLink: undefined } }, "Return courier charge borne by the Foundation");
            return "The Foundation pays the return courier.";
          })}>Foundation pays</Button>
          <Button onClick={() => run("return-charge", async () => {
            const link = await createReturnChargeLink(order.id, value);
            return `Payment link for ₹${link.amount} sent to the customer.`;
          })}>Customer pays · send link</Button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {back.labelUrl ? <a href={back.labelUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-burgundy underline">Open return label</a> : <span className="text-text-muted">No label link from the courier yet.</span>}
        <Button variant="ghost" onClick={() => run("return-label", () => {
          emailReturnLabel(order.id);
          return "Return label emailed to the customer. It is also on their My Orders page.";
        })}>{back.labelEmailedAt ? "Email label again" : "Email label to customer"}</Button>
      </div>
    </div>
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
  const [extraId, setExtraId] = useState("");
  const [pickupChoices, setPickupChoices] = useState<{ nickname: string; city: string; pincode: string; phone?: string; address?: string }[]>([]);
  const [pickupNick, setPickupNick] = useState("");
  const extraStatuses = getOrderSettings().customStatuses.filter((row) => row.label.trim());
  const [method, setMethod] = useState("UPI");
  const [linkMode, setLinkMode] = useState<"remaining" | "full" | "custom">("remaining");
  const [linkAmount, setLinkAmount] = useState("");
  const [reference, setReference] = useState("");
  const [refundFee, setRefundFee] = useState(() => {
    if (order.status !== "Cancelled") return false;
    const cancelled = order.history?.slice().reverse().find((entry) => entry.status === "Cancelled");
    return cancelled?.by === "Customer" ? preorderLate(order, getOrderSettings(), Date.parse(cancelled.at)) : getOrderSettings().cancellation.refundFeeOnDesk;
  });
  const refundCap = maxRefundable(order, { withPlatformFee: refundFee });
  const [refundAmount, setRefundAmount] = useState(String(refundCap));
  const [cancelReason, setCancelReason] = useState("");
  const [approvalKind, setApprovalKind] = useState<ApprovalRequest["kind"]>("cancellation");
  const [approvalNote, setApprovalNote] = useState("");
  const [quote, setQuote] = useState<RateQuote | null>(null);
  const [picked, setPicked] = useState<number | undefined>();
  const [typedCharge, setTypedCharge] = useState("");
  const [pickupDate, setPickupDate] = useState(() => shipment?.pickupScheduledFor?.slice(0, 10) || new Date(Date.now() + 864e5).toISOString().slice(0, 10));
  const [pickupSlot, setPickupSlot] = useState(shipment?.pickupSlot || settings.pickupTimeslots[0]?.label || "10:00 – 13:00");
  const [manualPortal, setManualPortal] = useState<string>("delhivery");
  const [manualAwb, setManualAwb] = useState("");
  const [manualCourier, setManualCourier] = useState("");
  const [deliveryWhen, setDeliveryWhen] = useState("");
  const [returnReason, setReturnReason] = useState(getOrderSettings().returns.reasons[0] ?? "");
  const [refundDest, setRefundDest] = useState<"original" | "store_credit">("original");
  const [editing, setEditing] = useState(false);
  const [editAddress, setEditAddress] = useState<DeliveryAddress>(order.deliveryAddress ?? { fullName: "", phone: "", email: "", line1: "", city: "", state: "", pincode: "", country: "India", countryCode: "IN" });
  const [editItems, setEditItems] = useState(order.items.map((item) => ({ ...item })));
  const [addBookId, setAddBookId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [editShipping, setEditShipping] = useState(String(order.shipping ?? 0));
  const catalogue = editing ? getLiveBooks().filter((book) => book.active !== false) : [];
  const addProduct = () => {
    const book = catalogue.find((row) => row.id === addBookId);
    if (!book || addQty < 1) return;
    setEditItems((list) =>
      list.some((row) => row.bookId === book.id)
        ? list.map((row) => (row.bookId === book.id ? { ...row, quantity: row.quantity + addQty } : row))
        : [
            ...list,
            {
              bookId: book.id,
              title: book.title,
              quantity: addQty,
              price: book.price,
              originalPrice: book.originalPrice,
              currency: book.currency,
              sku: book.sku,
              batchNo: book.batchNo,
              preorder: Boolean(book.preorder?.enabled && book.stock <= 0),
            },
          ]
    );
    setAddBookId("");
    setAddQty(1);
  };
  const saveEdit = () =>
    run("save", () => {
      const items = editItems.filter((item) => item.quantity > 0);
      if (!items.length) throw new Error("Keep at least one product in the order.");
      const shipping = Number(editShipping);
      if (!Number.isFinite(shipping) || shipping < 0) throw new Error("Enter a shipping charge of ₹0 or more.");
      const next = resaveOrder(order.id, { items, deliveryAddress: editAddress, shipping });
      setEditing(false);
      const due = remainingDue(next);
      return next.paymentStatus === "Partially Paid" && due > 0
        ? `Order saved. New total ${rupees(next.total)}. ${rupees(due)} is due from the customer: send a payment link for "Remaining" below.`
        : `Order saved. New total ${rupees(next.total)}.`;
    });
  const editSubtotal = editItems.reduce((sum, item) => sum + item.price * Math.max(0, item.quantity), 0);

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
        await dropOrderShipments(order.id);
        cancelOrder(order.id, cancelReason || "Cancelled by admin");
        return "Order cancelled. The shipment was removed from the desk.";
      }
      setOrderStatus(order.id, status);
      if ((status === "Packed" || status === "Ready to Ship") && order.deliveryMode === "delivery" && !shipment && isPreorderOrder(order)) {
        return `Status set to ${status}. This is a pre-order: create the shipment below once it is packed.`;
      }
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
      const locations = pickupChoices.length ? { locations: pickupChoices } : await listPickupLocations().catch(() => ({ locations: [] }));
      setPickupChoices(locations.locations ?? []);
      const from = (locations.locations ?? []).find((row) => row.nickname === pickupNick);
      const result = await fetchCourierRates({
        deliveryPincode: order.deliveryAddress?.pincode ?? "",
        pickupPincode: from?.pincode,
        weightKg: orderWeightKg(order),
        declaredValue: order.total,
        cod: order.paymentMethod === "Cash on delivery" && order.paymentStatus !== "Paid",
        bookIds: order.items.map((item) => item.bookId),
        dims: order.parcel,
      });
      setQuote(result);
      const current = order.courierChoice ? result.rates.findIndex((rate) => rate.courierId === order.courierChoice?.courierId && rate.provider === order.courierChoice?.provider) : -1;
      setPicked(current >= 0 ? current : result.rates.length ? 0 : undefined);
    });

  const paid = order.paymentStatus === "Paid";
  const collected = paid || order.paymentStatus === "Partially Paid" || order.paymentStatus === "Partially Refunded";
  const refundable = collected && refundCap > 0;
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
              } else {
                setEditShipping(String(order.shipping ?? 0));
                setEditing(true);
              }
            }}
            >
              {editing ? "Cancel edit" : "Edit order"}
            </Button>
          }
        >
          <ul className="space-y-2">
            {(editing ? editItems : order.items).map((item, index) => (
              <li key={item.bookId} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {currentProductTitle(item)}
                  {orderItemBatch(item) ? <span className="ml-1 text-xs text-text-muted">· Batch {orderItemBatch(item)}</span> : null}
                </span>
                {editing ? (
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Less"
                      className="h-8 w-8 rounded-lg border border-border font-bold"
                      onClick={() => setEditItems((list) => list.map((row, i) => (i === index ? { ...row, quantity: Math.max(0, row.quantity - 1) } : row)))}
                    >
                      −
                    </button>
                    <span className="w-16">
                      <TextInput
                        type="number"
                        min={0}
                        value={item.quantity}
                        onChange={(event) => setEditItems((list) => list.map((row, i) => (i === index ? { ...row, quantity: Math.max(0, Math.floor(Number(event.target.value) || 0)) } : row)))}
                      />
                    </span>
                    <button
                      type="button"
                      aria-label="More"
                      className="h-8 w-8 rounded-lg border border-border font-bold"
                      onClick={() => setEditItems((list) => list.map((row, i) => (i === index ? { ...row, quantity: row.quantity + 1 } : row)))}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="ml-1 text-xs font-semibold text-red-600"
                      onClick={() => setEditItems((list) => list.filter((_, i) => i !== index))}
                    >
                      Remove
                    </button>
                  </span>
                ) : (
                  <span className="text-text-muted">× {item.quantity}</span>
                )}
                <span className="font-medium">{rupees(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          {editing && (
            <div className="mt-3 space-y-2 rounded-lg border border-dashed border-border p-3">
              <p className="text-xs font-semibold text-text-primary">Add a product</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">
                  <SelectInput value={addBookId} onChange={(event) => setAddBookId(event.target.value)}>
                    <option value="">Choose a product…</option>
                    {catalogue.map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.title}
                        {book.language ? ` · ${book.language}` : ""} · {rupees(book.price)}
                        {book.stock <= 0 ? (book.preorder?.enabled ? " · pre-order" : " · out of stock") : ` · ${book.stock} in stock`}
                      </option>
                    ))}
                  </SelectInput>
                </span>
                <span className="w-20">
                  <TextInput type="number" min={1} value={addQty} onChange={(event) => setAddQty(Math.max(1, Math.floor(Number(event.target.value) || 1)))} />
                </span>
                <Button variant="ghost" onClick={addProduct} disabled={!addBookId}>
                  Add
                </Button>
              </div>
              <label className="flex flex-wrap items-center gap-2 text-xs font-semibold text-text-primary">
                Shipping charge ₹
                <span className="w-28">
                  <TextInput type="number" min={0} step="0.01" value={editShipping} onChange={(event) => setEditShipping(event.target.value)} />
                </span>
                <span className="font-normal text-text-muted">was {order.shipping === 0 ? "Free" : rupees(order.shipping)}. Raise it if the courier costs more.</span>
              </label>
              <p className="text-xs text-text-muted">
                New items subtotal {rupees(editSubtotal)} (was {rupees(order.subtotal)}). GST and fees are worked out again when you save. If the new total is more than the customer paid, the difference shows as Remaining for a payment link.
              </p>
              <Button onClick={saveEdit} disabled={busy === "save"}>
                {busy === "save" ? "Saving…" : "Save changes"}
              </Button>
            </div>
          )}
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
              <Button onClick={saveEdit} disabled={busy === "save"}>
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
                {order.deliveryMode === "store_pickup"
                  ? PICKUP_STATUSES.map((item) => <option key={item.status} value={item.status}>{orderStatusText(item.label)}</option>)
                  : ALL_STATUSES.map((item) => <option key={item} value={item}>{orderStatusText(item)}</option>)}
              </SelectInput>
            </div>
            <Button onClick={applyStatus} disabled={busy === "status" || status === order.status}>{busy === "status" ? "Saving…" : "Update status"}</Button>
          </div>
          {extraStatuses.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <div className="min-w-44 flex-1">
                <SelectInput value={extraId} onChange={(event) => setExtraId(event.target.value)}>
                  <option value="">Add a tracking update…</option>
                  {extraStatuses.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
                </SelectInput>
              </div>
              <Button
                disabled={!extraId || busy === "extra"}
                onClick={() =>
                  run("extra", () => {
                    const row = extraStatuses.find((item) => item.id === extraId);
                    if (!row) return;
                    const latest = getStoredOrder(order.id) ?? order;
                    patchStoredOrder(order.id, { history: [...(latest.history ?? []), { at: new Date().toISOString(), status: row.label, by: "admin", custom: row.stage }] });
                    setExtraId("");
                    return `Tracking update "${row.label}" added. The customer sees it in their tracking.`;
                  })
                }
              >
                Add update
              </Button>
            </div>
          )}
          {order.status !== "Cancelled" && (
            <div className="mt-3 rounded-lg border border-red-100 bg-red-50/60 p-3">
              {(() => {
                const hold = getOrderSettings().cancellation.pickupHoldDays;
                const ready = order.history?.slice().reverse().find((entry) => entry.status === "Packed")?.at;
                const days = ready ? Math.floor((Date.now() - Date.parse(ready)) / 864e5) : 0;
                return order.deliveryMode === "store_pickup" && order.status === "Packed" && hold > 0 && days >= hold ? (
                  <p className="mb-2 text-xs font-semibold text-red-800">Not collected for {days} days (limit {hold}). You may cancel and refund; the platform fee is kept.</p>
                ) : null;
              })()}
              {preorderLate(order) && <p className="mb-2 text-xs font-semibold text-red-800">This pre-order is past its announced date by more than {getOrderSettings().cancellation.delayDays} days: refund in full, including the platform fee.</p>}
              <p className="text-xs font-semibold text-red-800">Cancel this order</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <div className="min-w-48 flex-1"><TextInput placeholder="Reason for cancellation" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></div>
                <Button
                  variant="danger"
                  disabled={busy === "cancel"}
                  onClick={() => {
                    if (!window.confirm("Cancel this order? The customer is notified.")) return;
                    run("cancel", async () => {
                      await dropOrderShipments(order.id);
                      cancelOrder(order.id, cancelReason || "Cancelled by admin");
                      setStatus("Cancelled");
                      return "Order cancelled. The shipment was removed from the desk.";
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
            <p className="mt-2 text-xs text-text-muted">Ready to Ship books the courier and requests pickup on Shiprocket, Nimbuspost or iThink Logistics, including Porter / Shadowfax / Flash last-mile.</p>
          )}
              {order.cancelReason && <p className="mt-2 text-xs text-red-600">Cancelled: {order.cancelReason}</p>}
          {order.status === "Cancelled" && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-text-primary">Cancellation tracking</p>
              <OrderTrackingTimeline order={order} />
            </div>
          )}
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
                <SelectInput aria-label="Link amount" value={linkMode} onChange={(event) => setLinkMode(event.target.value as typeof linkMode)}>
                  <option value="remaining">Remaining {rupees(remainingDue(order))}</option>
                  <option value="full">Full amount {rupees(order.total)}</option>
                  <option value="custom">Custom amount</option>
                </SelectInput>
                {linkMode === "custom" && (
                  <TextInput className="w-28" type="number" min={1} placeholder="₹ amount" value={linkAmount} onChange={(event) => setLinkAmount(event.target.value)} />
                )}
                <Button variant="outline" disabled={busy === "link"} onClick={() => run("link", async () => {
                  const amount = linkMode === "full" ? order.total : linkMode === "custom" ? Number(linkAmount) : remainingDue(order);
                  const link = await createPaymentLink(order.id, amount);
                  return `Payment link for ${rupees(link.amount ?? amount)} sent, valid until ${formatDateTime(link.expiresAt ?? "")}: ${link.url}`;
                })}>
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
              <div className="w-28"><TextInput type="number" min={1} max={refundCap} value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} /></div>
              <SelectInput value={refundDest} onChange={(event) => setRefundDest(event.target.value as "original" | "store_credit")}>
                <option value="original">Original payment method</option>
                <option value="store_credit">Store credit</option>
              </SelectInput>
              <Button variant="danger" disabled={busy === "refund"} onClick={() => {
                if (!window.confirm(`Refund ₹${refundAmount} to ${refundDest === "store_credit" ? "store credit" : "the original method"}?`)) return;
                run("refund", () => refundDest === "store_credit"
                  ? (refundToStoreCredit(order.id, Number(refundAmount), undefined, { withPlatformFee: refundFee }), "Store credit issued.")
                  : refundThroughGateway(order.id, Number(refundAmount), { withPlatformFee: refundFee }));
              }}>
                {busy === "refund" ? "Refunding…" : refundDest === "store_credit" ? "Refund to store credit" : order.razorpayPaymentId && !order.razorpayPaymentId.startsWith("pay_demo") ? "Refund via Razorpay" : "Record refund"}
              </Button>
              {(order.platformFee ?? 0) > 0 && (
                <label className="flex w-full items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={refundFee} onChange={(event) => { const on = event.target.checked; setRefundFee(on); setRefundAmount(String(maxRefundable(order, { withPlatformFee: on }))); }} />
                  Also refund the platform fee (₹{order.platformFee}). Left unticked, the platform fee is kept.
                </label>
              )}
            </div>
          )}
          <RefundDetails order={order} busyId={busy} onCheck={(refund) => run(refund.id, () => refreshRefundStatus(order.id, refund.id))} />
        </Section>
      </div>

      {order.deliveryMode === "store_pickup" && order.status !== "Cancelled" && order.status !== "Delivered" && (
        <div className="mt-4">
          <Section
            title="Switch to courier delivery"
            action={<Button variant="outline" onClick={loadRates} disabled={busy === "rates"}>{busy === "rates" ? "Checking…" : "Show couriers & rates"}</Button>}
          >
            <p className="text-sm text-text-muted">
              If the customer cannot come to the store, send a link to pay only the courier charge. Once paid, the order becomes a courier delivery and can be booked.
            </p>
            {quote && <RatesTable quote={quote} picked={picked} onPick={setPicked} />}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                disabled={busy === "courier-link" || picked === undefined || !quote}
                onClick={() => run("courier-link", async () => {
                  const rate = picked !== undefined ? quote?.rates[picked] : undefined;
                  if (!rate) throw new Error("Pick a courier first.");
                  const link = await createCourierPaymentLink(order.id, rate);
                  return `Courier payment link sent: ${link.url}`;
                })}
              >
                {busy === "courier-link" ? "Creating…" : picked !== undefined && quote ? `Send link to pay ${rupees(quote.rates[picked]?.rate ?? 0)} for ${quote.rates[picked]?.courierName}` : "Send courier payment link"}
              </Button>
              {order.courierUpgrade?.link && (
                <>
                  <Button variant="ghost" onClick={() => { navigator.clipboard?.writeText(order.courierUpgrade!.link!.url); setMessage("Link copied."); }}>Copy link</Button>
                  <Button variant="ghost" onClick={() => run("courier-check", () => refreshCourierPaymentLink(order.id))}>Check status</Button>
                  <Button
                    variant="outline"
                    onClick={() => run("courier-paid", () => {
                      recordCourierPayment(order.id, { method, reference: reference || undefined });
                      return "Courier charge recorded. The order is now a courier delivery; book the courier below.";
                    })}
                  >
                    Record courier charge paid ({method})
                  </Button>
                </>
              )}
            </div>
            {order.courierUpgrade?.link && (
              <p className="mt-2 break-all rounded bg-warm-cream px-2 py-1 font-mono text-[11px] text-text-muted">
                {order.courierUpgrade.rate.courierName} · {rupees(order.courierUpgrade.amount)} · {order.courierUpgrade.link.url}
              </p>
            )}
          </Section>
        </div>
      )}

      {order.preorderPayment && order.status !== "Cancelled" && (
        <div className="mt-4">
          <Section title="Pre-order balance">
            <p className="text-sm text-text-muted">
              Advance {rupees(order.preorderPayment.advance)} {order.preorderPayment.advancePaidAt ? "paid" : "pending"} · balance {rupees(order.preorderPayment.balance)}{" "}
              {order.preorderPayment.balancePaidAt
                ? `paid ${formatDateTime(order.preorderPayment.balancePaidAt)}${order.preorderPayment.balanceRef ? ` · ${order.preorderPayment.balanceRef}` : ""}`
                : `due ${order.preorderPayment.balanceWhen === "on_ready" ? "when the item is ready" : "before dispatch"}`}
            </p>
            {!order.preorderPayment.balancePaidAt && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button disabled={busy === "balance-link"} onClick={() => run("balance-link", async () => {
                  const link = await createBalancePaymentLink(order.id);
                  return `Balance payment link sent: ${link.url}`;
                })}>
                  {busy === "balance-link" ? "Creating…" : `Send link to pay ${rupees(order.preorderPayment.balance)}`}
                </Button>
                {order.preorderPayment.link && (
                  <>
                    <Button variant="ghost" onClick={() => { navigator.clipboard?.writeText(order.preorderPayment!.link!.url); setMessage("Link copied."); }}>Copy link</Button>
                    <Button variant="ghost" onClick={() => run("balance-check", () => refreshBalancePaymentLink(order.id))}>Check status</Button>
                  </>
                )}
                <Button variant="outline" onClick={() => run("balance-paid", () => {
                  recordBalancePayment(order.id, { method, reference: reference || undefined });
                  return "Balance recorded. The order is fully paid.";
                })}>
                  Record balance paid ({method})
                </Button>
              </div>
            )}
          </Section>
        </div>
      )}

      {!isPreorderOrder(order) && !shipment && !["Packed", "Ready to Ship", "To Ship", "Shipped", "Out for Delivery", "Delivered", "Failed", "Cancelled"].includes(order.status) && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-warm-cream/50 p-3 text-sm">
          <span>Book not in stock yet?</span>
          <Button
            variant="outline"
            disabled={busy === "to-preorder"}
            onClick={() => {
              const date = window.prompt("Change this order to a pre-order. Expected date (YYYY-MM-DD), or leave blank if not announced:", "");
              if (date === null) return;
              const releaseDate = date.trim();
              if (releaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
                window.alert("Enter the date as YYYY-MM-DD, for example 2026-12-31.");
                return;
              }
              run("to-preorder", () => convertToPreorder(order.id, releaseDate || undefined));
            }}
          >
            Change to pre-order
          </Button>
        </div>
      )}

      {order.deliveryMode === "delivery" && !shipment && !["Shipped", "Out for Delivery", "Delivered", "Cancelled"].includes(order.status) && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-warm-cream/50 p-3 text-sm">
          <span>Customer will collect from the clinic instead?</span>
          <Button
            variant="outline"
            disabled={busy === "to-pickup"}
            onClick={() => {
              if (!window.confirm("Change this order to store pickup? The courier charge comes off the total.")) return;
              run("to-pickup", () => convertToStorePickup(order.id));
            }}
          >
            Change to store pickup
          </Button>
        </div>
      )}

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
                {pickupChoices.length > 0 && (
                  <div className="mt-3 max-w-md">
                    <SelectInput value={pickupNick} onChange={(event) => { setPickupNick(event.target.value); setQuote(null); setPicked(undefined); }}>
                      <option value="">Pickup from: default address in Shipping settings</option>
                      {pickupChoices.map((row) => <option key={row.nickname} value={row.nickname}>Pickup from: {row.nickname} · {[row.city, row.pincode].filter(Boolean).join(" ")}</option>)}
                    </SelectInput>
                    {!quote && <p className="mt-1 text-xs text-text-muted">Click Show couriers & rates again for rates from this pickup.</p>}
                  </div>
                )}
                <ParcelEditor key={`${order.id}:${order.weightKg ?? ""}:${order.parcel ? JSON.stringify(order.parcel) : ""}`} order={order} onSaved={() => { setQuote(null); setPicked(undefined); setMessage("Package saved. Click Show couriers & rates for rates with this package."); }} />
                {quote && <RatesTable quote={quote} picked={picked} onPick={setPicked} />}
                <div className="mt-3 flex flex-wrap gap-2">
                  {order.preorderPayment && !order.preorderPayment.balancePaidAt ? (
                    <>
                      <Button
                        disabled={busy === "preorder-courier" || picked === undefined || !quote}
                        onClick={() => run("preorder-courier", () => selectPreorderCourier(order.id, picked !== undefined ? quote?.rates[picked] : undefined))}
                      >
                        {picked !== undefined && quote ? `Select ${quote.rates[picked]?.courierName} & send balance link` : "Pick a courier from the rates"}
                      </Button>
                      <div className="flex items-center gap-2">
                        <TextInput className="w-32" inputMode="decimal" placeholder="Charge ₹" value={typedCharge} onChange={(event) => setTypedCharge(event.target.value)} />
                        <Button variant="outline" disabled={busy === "preorder-courier" || typedCharge.trim() === ""} onClick={() => run("preorder-courier", () => selectPreorderCourier(order.id, undefined, Number(typedCharge)))}>
                          Add charge & send link
                        </Button>
                      </div>
                      <p className="w-full text-xs text-text-muted">Pre-order: the courier charge is added only when you select the courier. The shipment is created automatically once the customer pays the balance.</p>
                    </>
                  ) : (
                  <Button
                    disabled={busy === "book"}
                    onClick={() => run("book", async () => (await bookShipment(order.id, picked !== undefined ? quote?.rates[picked] : undefined, pickupOverride(pickupChoices.find((row) => row.nickname === pickupNick)))).message)}
                  >
                    {busy === "book" ? "Booking…" : picked !== undefined && quote ? `Book ${quote.rates[picked]?.courierName}` : "Pack & book courier"}
                  </Button>
                  )}
                </div>
                <SplitShipments
                  order={order}
                  rate={picked !== undefined ? quote?.rates[picked] : undefined}
                  pickup={pickupOverride(pickupChoices.find((row) => row.nickname === pickupNick))}
                  onDone={(text) => { setMessage(text); onChanged(); }}
                />
                <p className="mt-2 text-xs text-text-muted">
                  Pack & book sends the order to the courier account the customer chose. Tookan, Shipday, Shiprocket, Nimbuspost, iThink and Shipyaari are booked for real when their API key is saved.
                </p>
                <div className="mt-4 rounded-xl border border-border p-3">
                  <p className="text-sm font-semibold text-text-primary">Shipped with another courier</p>
                  <p className="mt-1 text-xs text-text-muted">
                    Choose the courier and paste its tracking id. Status is fetched from the courier's own tracking site (or the tracking service in Shipping APIs); connected portals also send the delivery date.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
                    <SelectInput value={manualPortal} onChange={(event) => setManualPortal(event.target.value)}>
                      <optgroup label="Courier (opens its tracking page)">
                        {DIRECT_COURIERS.map((courier) => (
                          <option key={courier.id} value={courier.id}>{courier.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Connected portal (live scans)">
                        {MANUAL_PORTALS.map((portal) => (
                          <option key={portal.id} value={portal.id}>{portal.label}</option>
                        ))}
                      </optgroup>
                    </SelectInput>
                    <TextInput placeholder="Tracking id" value={manualAwb} onChange={(event) => setManualAwb(event.target.value)} />
                    <TextInput placeholder="Courier name, if you know it" value={manualCourier} onChange={(event) => setManualCourier(event.target.value)} />
                    <Button
                      disabled={busy === "manual"}
                      onClick={() =>
                        run("manual", async () => {
                          const portal = MANUAL_PORTALS.find((item) => item.id === manualPortal);
                          return portal ? attachManualTracking(order.id, portal.id, manualAwb, manualCourier) : attachDirectTracking(order.id, manualPortal, manualAwb, manualCourier);
                        })
                      }
                    >
                      {busy === "manual" ? "Fetching…" : "Fetch tracking"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-text-primary">{shipment.courier} <span className="text-xs font-normal uppercase text-text-muted">{shipment.provider || "courier"}{shipment.live ? " · live" : ""}</span></p>
                  <p className="font-mono text-burgundy">AWB {shipment.awb}</p>
                  <p className="text-xs text-text-muted">Status: <b>{shipment.status}</b></p>
                  <p className="text-xs text-text-muted">Delivery date: {deliveryDatePhrase(shipment.expectedBy) || "Waiting for the courier"}</p>
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
                    <LabelSizePicker />
                    <Button variant="outline" onClick={() => run("label", () => downloadLabel(shipment.id))}>Download AWB label</Button>
                    {shipment.provider === "shiprocket" && shipment.live && (
                      <>
                        <Button variant="outline" onClick={() => run("invoice", () => downloadInvoice(shipment.id))}>Courier invoice</Button>
                        <Button variant="outline" onClick={() => run("manifest", () => downloadManifest(shipment.id))}>Pickup manifest</Button>
                      </>
                    )}
                    <Button variant="outline" onClick={() => run("track", async () => `Tracking: ${await trackShipment(shipment.id)}`)}>Track</Button>
                    {shipment.provider === "goswift" && shipment.live && shipment.status !== "Delivered" && (
                      <>
                        <Button variant="outline" onClick={() => run("ndr-reattempt", () => goswiftNdrRequest(shipment.id, "Re-Attempt", { date: new Date(Date.now() + 864e5).toISOString() }))}>Ask GoSwift to re-attempt</Button>
                        <Button variant="outline" onClick={() => run("ndr-rto", () => goswiftNdrRequest(shipment.id, "RTO"))}>Return to us (RTO)</Button>
                      </>
                    )}
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
                  {isOwnFleet(shipment.provider) && shipment.status !== "Delivered" && (
                    <div className="rounded-xl border border-border p-3">
                      <p className="text-sm font-semibold text-text-primary">Reschedule Gogate Products delivery</p>
                      <p className="mt-1 text-xs text-text-muted">Customers see the date only. The time is sent to the courier task and kept for the tracking line.</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <TextInput type="datetime-local" value={deliveryWhen} onChange={(event) => setDeliveryWhen(event.target.value)} />
                        <Button
                          disabled={busy === "reschedule" || !deliveryWhen}
                          onClick={() => run("reschedule", () => rescheduleOwnDelivery(shipment.id, deliveryWhen))}
                        >
                          {busy === "reschedule" ? "Saving…" : "Save delivery time"}
                        </Button>
                      </div>
                    </div>
                  )}
                  {shipment.status !== "Delivered" && (
                    <Button variant="danger" onClick={() => {
                      if (!window.confirm("Cancel this shipment and assign a different courier?")) return;
                      run("cancel-shipment", async () => {
                        const text = await cancelShipment(shipment.id);
                        patchOrder(order.id, { shipmentId: undefined, trackingId: undefined, courierName: undefined }, "Courier booking cancelled");
                        return `${text} Choose another courier below.`;
                      });
                    }}>Cancel shipment and reassign</Button>
                  )}
                </div>
                <div className="lg:col-span-2 rounded-xl border border-border bg-warm-cream/40 p-3 text-xs">
                  <p className="font-semibold text-text-primary">Advanced courier tracking</p>
                  <p className="mt-1 text-text-muted">
                    {[
                      shipment.directCourier ? `${shipment.courier} (tracked from the courier's site)` : `${shipment.provider || "Courier"} · ${shipment.courier}`,
                      shipment.providerOrderId ? `order ${shipment.providerOrderId}` : "",
                      shipment.providerShipmentId ? `shipment ${shipment.providerShipmentId}` : "",
                      `AWB ${shipment.awb}`,
                      `status ${shipment.status}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {shipment.agentName || shipment.agentPhone ? (
                    <p className="mt-1 text-text-muted">
                      Agent {shipment.agentName || ""}
                      {shipment.agentPhone ? ` · ${shipment.agentPhone}` : ""}
                      {shipment.deliveryOtp ? ` · OTP ${shipment.deliveryOtp}` : ""}
                      {shipment.agentLeg ? ` · ${shipment.agentLeg}` : ""}
                    </p>
                  ) : null}
                  {shipment.pickupLat != null || shipment.dropLat != null || shipment.agentLat != null ? (
                    <p className="mt-1 text-text-muted">
                      Pickup {shipment.pickupLat ?? "—"}, {shipment.pickupLng ?? "—"} · drop {shipment.dropLat ?? "—"}, {shipment.dropLng ?? "—"}
                      {shipment.agentLat != null ? ` · rider ${shipment.agentLat}, ${shipment.agentLng}` : ""}
                    </p>
                  ) : null}
                  <p className="mt-2 break-all font-mono text-[11px] text-burgundy">
                    {typeof window !== "undefined" ? `${window.location.origin}/track/${order.trackToken || ""}` : `/track/${order.trackToken || ""}`}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => {
                      const token = order.trackToken || crypto.randomUUID().replace(/-/g, "");
                      if (!order.trackToken) patchOrder(order.id, { trackToken: token });
                      const url = `${window.location.origin}/track/${token}`;
                      void navigator.clipboard?.writeText(url);
                      setMessage("Tracking link copied. Anyone with this link can follow the shipment.");
                      onChanged();
                    }}>Copy tracking link</Button>
                  </div>
                  {shipment.tracking && shipment.tracking.length > 0 ? (
                    <ol className="mt-3 space-y-1 border-t border-border pt-3">
                      {shipment.tracking.filter((event) => !isDeskScan(event)).reverse().map((event, index) => (
                        <li key={index} className="flex gap-3"><span className="w-44 shrink-0 text-text-muted">{statusStamp(event.at)}</span><span>{event.status}{event.location ? ` · ${event.location}` : ""}</span></li>
                      ))}
                    </ol>
                  ) : <p className="mt-2 text-text-muted">No courier scans yet.</p>}
                </div>
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
          <OrderFeedback orderId={order.id} readOnly />
          {order.packPhotos?.length ? (
            <Section title="Packing photos (desk only)">
              <div className="flex flex-wrap gap-2">
                {order.packPhotos.map((photo) => (
                  <a key={photo.url} href={photo.url} target="_blank" rel="noreferrer" title={`${photo.by} · ${formatDateTime(photo.at)}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt="Packed items" className="h-20 w-20 rounded-lg border border-border object-cover" />
                  </a>
                ))}
              </div>
              <p className="mt-1 text-xs text-text-muted">Taken by the packer as proof of what was packed. Customers never see these.</p>
            </Section>
          ) : null}
          <Section title="Senior approval">
            {order.approval ? (
              <p className={`mb-2 rounded-lg p-2 text-xs ${order.approval.status === "Pending" ? "bg-amber-50 text-amber-900" : order.approval.status === "Approved" ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}>
                {APPROVAL_LABELS[order.approval.kind]}{order.approval.amount ? ` ${rupees(order.approval.amount)}` : ""} · {order.approval.status === "Pending" ? `waiting for approval (sent by ${order.approval.requestedBy}, ${formatDateTime(order.approval.requestedAt)})` : `${order.approval.status} by ${order.approval.decidedBy ?? "reviewer"}${order.approval.decisionNote ? ` · ${order.approval.decisionNote}` : ""}`}
              </p>
            ) : null}
            {order.approval?.status === "Pending" ? null : (
              <div className="flex flex-wrap gap-2">
                <SelectInput value={approvalKind} onChange={(event) => setApprovalKind(event.target.value as ApprovalRequest["kind"])}>
                  {Object.entries(APPROVAL_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </SelectInput>
                <div className="min-w-48 flex-1"><TextInput placeholder="Why it needs approval" value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} /></div>
                <Button variant="outline" disabled={busy === "approval"} onClick={() => run("approval", () => {
                  requestApproval(order.id, {
                    kind: approvalKind,
                    note: approvalNote.trim() || undefined,
                    ...(approvalKind === "refund" ? { amount: Number(refundAmount) || refundCap, destination: refundDest } : {}),
                  });
                  setApprovalNote("");
                  return "Sent for approval. It waits in Commerce → Approvals.";
                })}>Send for approval</Button>
              </div>
            )}
            {approvalKind === "refund" && order.approval?.status !== "Pending" ? <p className="mt-1 text-xs text-text-muted">The refund amount and destination are taken from the refund box below.</p> : null}
          </Section>
          <Section title="Returns, refunds & replacements">
            {getOrderSettings().adminActions.processAfterDelivery ? (
              <p className="mb-2 text-xs text-text-muted">Customers cannot cancel or return. The desk can cancel, modify, refund, open a return, or place a free replacement. Damaged-item requests from the customer wait here for accept or reject.</p>
            ) : null}
            {order.returnShipment && (
              <p className="mb-2 text-xs text-text-muted">
                Return AWB {order.returnShipment.awb || "pending"} · {order.returnShipment.courierName} · {order.returnShipment.live ? "live" : "demo"}
              </p>
            )}
            {order.returnShipment?.awb ? <ReturnChargeBox order={order} run={run} /> : null}
            {returnRequest ? (
              <div className="space-y-2 text-sm">
                <p><b>{returnRequest.kind === "replacement" ? "Replacement" : "Return"}</b> · {returnRequest.status}{returnRequest.source ? ` · ${returnRequest.source}` : ""}</p>
                <p className="text-xs text-text-muted">Reason: {returnRequest.reason} · requested {formatDateTime(returnRequest.requestedAt)}</p>
                {returnRequest.items?.length ? <p className="text-xs">Products: <b>{returnRequest.items.map((item) => `${item.quantity} × ${item.title}`).join(", ")}</b></p> : null}
                {returnRequest.resolution && <p className="text-xs">Customer wants: <b>{returnRequest.resolution === "refund" ? "Refund without return" : returnRequest.resolution === "return_refund" ? "Return for refund" : "Free replacement"}</b></p>}
                {returnRequest.replacementAddress && <p className="text-xs">Replacement address: {[returnRequest.replacementAddress.fullName, returnRequest.replacementAddress.phone, returnRequest.replacementAddress.line1, returnRequest.replacementAddress.city, returnRequest.replacementAddress.pincode].filter(Boolean).join(", ")}</p>}
                {returnRequest.note && <p className="text-xs text-text-muted">{returnRequest.note}</p>}
                {returnRequest.evidence?.video?.length ? <video src={returnRequest.evidence.video[0]} controls className="h-32 rounded-lg" /> : null}
                {returnRequest.images?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {returnRequest.images.map((src, index) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={`${returnRequest.id}-${index}`} src={src} alt={`Damage ${index + 1}`} className="h-16 w-16 rounded-lg object-cover" />
                    ))}
                  </div>
                ) : null}
                {returnRequest.kind === "return" && <p className="text-xs text-text-muted">Refund {rupees(returnRequest.refundAmount ?? 0)}{returnRequest.returnCharges ? ` after ₹${returnRequest.returnCharges} pickup charge` : " · no charge to the customer"}.</p>}
                <div className="flex flex-wrap gap-2">
                  {returnRequest.status === "Pending Review" && returnRequest.kind === "return" && (
                    <>
                      <Button variant="success" onClick={() => run("rt", () => {
                        reviewReplacementRequest(order.id, { accept: true, note: "Return accepted." });
                        return "Return accepted and the customer emailed. Arrange the free pickup next.";
                      })}>Accept return</Button>
                      <Button variant="danger" onClick={() => {
                        const reason = window.prompt("Reason for cancelling this return request? (sent to the customer)");
                        if (reason === null) return;
                        run("rt", () => {
                          reviewReplacementRequest(order.id, { accept: false, note: reason });
                          return "Return request cancelled and the customer emailed.";
                        });
                      }}>Cancel return</Button>
                    </>
                  )}
                  {returnRequest.status === "Pending Review" && returnRequest.kind === "replacement" && (
                    <>
                      <Button variant="success" onClick={() => run("rt", () => {
                        reviewReplacementRequest(order.id, { accept: true, note: "Accepted after reviewing photos." });
                        return "Accepted. Create the return AWB next; the replacement ships after the item is back and checked.";
                      })}>Accept & ask for the item back</Button>
                      <Button variant="danger" onClick={() => {
                        const reason = window.prompt("Reason for rejecting this replacement request?");
                        if (reason === null) return;
                        run("rt", () => {
                          reviewReplacementRequest(order.id, { accept: false, note: reason || "Rejected after reviewing photos." });
                          return "Replacement request rejected.";
                        });
                      }}>Reject</Button>
                    </>
                  )}
                  {returnRequest.status === "Return Requested" && (
                    <Button variant="outline" onClick={() => run("rt", () => { updateReturnRequest(order.id, { status: "Return Approved" }); return "Return approved."; })}>Approve</Button>
                  )}
                  {returnRequest.status === "Return Approved" && returnRequest.resolution !== "refund" && (
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
                          labelUrl: created.labelUrl,
                          charge: created.courierCost,
                        },
                      }, "Return pickup booked");
                      try {
                        emailReturnLabel(order.id);
                      } catch {
                        /* the label can be emailed from the return box */
                      }
                      if (returnRequest.kind === "replacement") {
                        advanceReturnRequest(order.id, "Pickup Scheduled", "return-label", `Return AWB ${created.awb} · ${created.courierName}. Download the label, paste it on the parcel and hand it to the courier.`);
                      } else {
                        updateReturnRequest(order.id, { status: "Pickup Scheduled" });
                      }
                      return created.note ?? `Return pickup booked. AWB ${created.awb}.`;
                    })}>Create return AWB & label</Button>
                  )}
                  {returnRequest.status === "Return Approved" && returnRequest.kind === "replacement" && (
                    <Button variant="ghost" onClick={() => {
                      const awb = window.prompt("Return AWB / tracking number")?.trim();
                      if (!awb) return;
                      const courierName = window.prompt("Courier for the return (e.g. India Post, DTDC)")?.trim() || "Courier";
                      const labelUrl = window.prompt("Link to the return label (optional)")?.trim() || undefined;
                      run("rt", () => {
                        patchOrder(order.id, { returnShipment: { provider: "local", live: false, awb, courierName, createdAt: new Date().toISOString(), labelUrl } }, `Return AWB ${awb} entered`);
                        advanceReturnRequest(order.id, "Pickup Scheduled", "return-label", `Return AWB ${awb} · ${courierName}. Download the label, paste it on the parcel and hand it to the courier.`);
                        return `Return AWB ${awb} shared with the customer.`;
                      });
                    }}>Enter return AWB manually</Button>
                  )}
                  {returnRequest.status === "Pickup Scheduled" && (
                    <Button variant="outline" onClick={() => run("rt", async () => {
                      if (returnRequest.kind === "replacement") {
                        advanceReturnRequest(order.id, "Picked Up", "return-pickup", "The courier collected the defective item.");
                        return "Marked as picked up. Check the item when it arrives, then send the replacement.";
                      }
                      advanceReturnRequest(order.id, "Picked Up", "pickup", "The courier collected the item.");
                      if (returnRequest.kind === "return" && getOrderSettings().refunds.autoRefundOnReturnPickup && paid) {
                        const text = await refundThroughGateway(order.id, returnRequest.refundAmount);
                        advanceReturnRequest(order.id, "Refunded", "refund", text || undefined);
                        return `Picked up. ${text}`;
                      }
                      return "Marked as picked up.";
                    })}>Mark picked up</Button>
                  )}
                  {returnRequest.kind === "replacement" && ["Picked Up", "Pickup Scheduled"].includes(returnRequest.status) && !returnRequest.replacementOrderId && (
                    <Button variant="success" onClick={() => {
                      if (!window.confirm("Has the defective item arrived and been checked? This places the free replacement order.")) return;
                      run("rt", () => {
                        const next = sendReplacementAfterInspection(order.id);
                        return `Checked. Free replacement order ${next.replacementOrderId} placed.`;
                      });
                    }}>Item received & checked — send replacement</Button>
                  )}
                  {returnRequest.kind === "return" && (returnRequest.status === "Picked Up" || (returnRequest.status === "Return Approved" && returnRequest.resolution === "refund")) && paid && (
                    <Button variant="danger" onClick={() => {
                      const back = returnRequest.status === "Picked Up";
                      if (back && !window.confirm("Has the returned item arrived and been checked? This sends the refund.")) return;
                      run("rt", async () => {
                        if (back) advanceReturnRequest(order.id, "Picked Up", "inspected", "The returned item was received and checked.");
                        const text = await refundThroughGateway(order.id, returnRequest.refundAmount);
                        advanceReturnRequest(order.id, "Refunded", "refund", text || undefined);
                        return text;
                      });
                    }}>{returnRequest.status === "Picked Up" ? "Item received & checked — refund" : "Send refund"} {rupees(returnRequest.refundAmount ?? 0)}</Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <SelectInput value={returnReason} onChange={(event) => setReturnReason(event.target.value)}>
                  {getOrderSettings().returns.reasons.map((reason) => <option key={reason}>{reason}</option>)}
                </SelectInput>
                <div className="flex flex-wrap gap-2">
                  {(order.deliveryMode !== "store_pickup" || getOrderSettings().returns.pickupReturns) && (
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
                        labelUrl: created.labelUrl,
                        charge: created.courierCost,
                      },
                    }, "Return opened");
                    try {
                      emailReturnLabel(order.id);
                    } catch {
                      /* the label can be emailed from the return box */
                    }
                    return created.note ?? "Return opened and reverse pickup requested.";
                  })}>Create return (reverse pickup)</Button>
                  )}
                  {(getOrderSettings().returns.replacementAllowed || getOrderSettings().adminActions.processAfterDelivery) &&
                    (order.deliveryMode !== "store_pickup" || getOrderSettings().returns.pickupReplacement) && (
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
        {shipment && <LabelSizePicker />}
        {shipment && <Button variant="ghost" onClick={() => run("label-print", () => downloadLabel(shipment.id))}>Print shipping label</Button>}
        <Button variant="danger" onClick={() => {
          if (!window.confirm(`Delete order ${order.id}? This cannot be undone.`)) return;
          run("delete", async () => {
            await dropOrderShipments(order.id);
            await cancelOrderPaymentLinks(order.id);
            deleteOrder(order.id);
            return "Order deleted. The shipment was removed from the desk.";
          });
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

function pickupOverride(row?: { nickname: string; city: string; pincode: string; phone?: string; address?: string }) {
  if (!row) return undefined;
  return { nickname: row.nickname, city: row.city, pincode: row.pincode, ...(row.address ? { line1: row.address } : {}), ...(row.phone ? { phone: row.phone } : {}) };
}

/** Box size, weight and count for this shipment; rates and the booking sent to the aggregator use these. */
function ParcelEditor({ order, onSaved }: { order: Order; onSaved: () => void }) {
  const box = getIntegrations().shipping.packageCm;
  const [form, setForm] = useState({
    kind: order.parcel?.kind ?? (order.items.reduce((sum, item) => sum + item.quantity, 0) > 1 ? "bulk" : "single"),
    boxes: String(order.parcel?.boxes ?? 1),
    length: String(order.parcel?.length ?? box.length),
    breadth: String(order.parcel?.breadth ?? box.breadth),
    height: String(order.parcel?.height ?? box.height),
    weight: String(orderWeightKg(order)),
    contents: order.parcel?.contents ?? "",
  });
  const [error, setError] = useState("");
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));
  const save = () => {
    const length = Number(form.length);
    const breadth = Number(form.breadth);
    const height = Number(form.height);
    const weightKg = Number(form.weight);
    const boxes = Math.max(1, Math.floor(Number(form.boxes) || 1));
    if (![length, breadth, height].every((value) => value > 0)) return setError("Enter length, breadth and height in cm.");
    if (!(weightKg > 0)) return setError("Enter the packed weight in kg.");
    setError("");
    patchOrder(
      order.id,
      { weightKg, parcel: { kind: form.kind === "bulk" ? "bulk" : "single", boxes, length, breadth, height, contents: form.contents.trim() || undefined } },
      `Package ${length}×${breadth}×${height} cm · ${weightKg} kg${boxes > 1 ? ` · ${boxes} boxes` : ""}`
    );
    onSaved();
  };
  return (
    <div className="mt-3 rounded-xl border border-border bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Package for this shipment</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Field label="Type">
          <SelectInput value={form.kind} onChange={(event) => set({ kind: event.target.value === "bulk" ? "bulk" : "single" })}>
            <option value="single">Single</option>
            <option value="bulk">Bulk</option>
          </SelectInput>
        </Field>
        <Field label="Boxes"><TextInput type="number" min={1} value={form.boxes} onChange={(event) => set({ boxes: event.target.value })} /></Field>
        <Field label="Length (cm)"><TextInput type="number" min={1} value={form.length} onChange={(event) => set({ length: event.target.value })} /></Field>
        <Field label="Breadth (cm)"><TextInput type="number" min={1} value={form.breadth} onChange={(event) => set({ breadth: event.target.value })} /></Field>
        <Field label="Height (cm)"><TextInput type="number" min={1} value={form.height} onChange={(event) => set({ height: event.target.value })} /></Field>
        <Field label="Weight (kg)"><TextInput type="number" min={0.01} step={0.01} value={form.weight} onChange={(event) => set({ weight: event.target.value })} /></Field>
        <Field label="Contents"><TextInput placeholder="e.g. Books" value={form.contents} onChange={(event) => set({ contents: event.target.value })} /></Field>
      </div>
      <p className="mt-1 text-xs text-text-muted">For several boxes, enter the total packed weight and the size of the largest box. Aggregators charge on the higher of actual and volumetric weight (L×B×H ÷ 5000).</p>
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
      <Button variant="outline" onClick={save}>Save package</Button>
    </div>
  );
}

/** Pre-orders are never booked automatically: the desk creates the shipment after packing. */
function isPreorderOrder(order?: Order | null) {
  return Boolean(order && (order.preorderPayment || order.items.some((item) => item.preorder)));
}

function SplitShipments({
  order,
  rate,
  pickup,
  onDone,
}: {
  order: Order;
  rate?: CourierRate;
  pickup?: ReturnType<typeof pickupOverride>;
  onDone: (message: string) => void;
}) {
  const parts = getShipments().filter((item) => item.orderId === order.id && item.part && item.note !== "Cancelled");
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const [open, setOpen] = useState(parts.length > 0);
  const [second, setSecond] = useState<Record<string, number>>(() =>
    Object.fromEntries(order.items.map((item, index) => [item.bookId, order.items.length > 1 ? (index % 2 ? item.quantity : 0) : Math.floor(item.quantity / 2)]))
  );
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState("");
  if (units < 2) return null;
  const itemsFor = (part: 1 | 2) =>
    order.items
      .map((item) => ({ bookId: item.bookId, quantity: part === 2 ? second[item.bookId] ?? 0 : item.quantity - (second[item.bookId] ?? 0) }))
      .filter((row) => row.quantity > 0);
  const book = async (part: 1 | 2) => {
    setBusy(part);
    setError("");
    try {
      const result = await bookShipment(order.id, rate, pickup, { part, items: itemsFor(part) });
      onDone(`Shipment ${part}: ${result.message}`);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not book this shipment.");
    } finally {
      setBusy(0);
    }
  };
  return (
    <div className="mt-4 rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-text-primary">Split into 2 shipments</p>
        <Button variant="ghost" onClick={() => setOpen(!open)}>{open ? "Hide" : "Split order"}</Button>
      </div>
      {open && (
        <div className="mt-2 space-y-2 text-sm">
          <p className="text-xs text-text-muted">Set how many of each item go in shipment 2; the rest go in shipment 1. Each shipment gets its own courier booking, AWB, label and tracking. The courier picked above (or the default rule) is used.</p>
          {order.items.map((item) => (
            <div key={item.bookId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-warm-cream/40 px-3 py-2">
              <span className="font-medium">{currentProductTitle(item)} × {item.quantity}</span>
              <span className="flex items-center gap-2 text-xs">
                Shipment 1: <b>{item.quantity - (second[item.bookId] ?? 0)}</b> · Shipment 2:
                <input
                  type="number"
                  min={0}
                  max={item.quantity}
                  className="w-16 rounded-lg border border-border px-2 py-1"
                  value={second[item.bookId] ?? 0}
                  disabled={parts.length > 0}
                  onChange={(event) => setSecond((current) => ({ ...current, [item.bookId]: Math.max(0, Math.min(item.quantity, Math.floor(Number(event.target.value) || 0))) }))}
                  aria-label={`Units of ${item.title} in shipment 2`}
                />
              </span>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {([1, 2] as const).map((part) => {
              const done = parts.find((item) => item.part === part);
              return done ? (
                <span key={part} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">Shipment {part}: {done.courier} · {done.awb}</span>
              ) : (
                <Button key={part} disabled={Boolean(busy) || !itemsFor(part).length} onClick={() => void book(part)}>
                  {busy === part ? "Booking…" : `Book shipment ${part}`}
                </Button>
              );
            })}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
