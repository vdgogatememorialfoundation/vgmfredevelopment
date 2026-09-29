"use client";

import { useState } from "react";
import {
  createAdminOrder,
  getOrder as getOrderByAdmin,
  getShipments,
  setOrderStatus,
  cancelOrder,
  refundOrder,
  createReplacement,
  createShipment,
  printOrderInvoice,
  printPackagingSlip,
  printShippingLabel,
} from "@/lib/admin-store";
import { getOrders } from "@/lib/store";
import { getLiveBooks } from "@/lib/product-data";
import { formatDate } from "@/lib/utils";
import type { Order } from "@/types";
import {
  Button,
  EmptyState,
  Field,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_TONES,
  Panel,
  SelectInput,
  StatusBadge,
  TextInput,
} from "@/components/admin/AdminUI";
import { classNames, formatDateTime } from "@/lib/utils";

export function OrdersDashboard() {
  const [orders, setOrders] = useState<Order[]>(() => getOrders().slice(0, 200));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const refresh = () => setOrders(getOrders().slice(0, 200));
  const selected = selectedId ? getOrderByAdmin(selectedId) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Orders</h1>
          <p className="text-sm text-text-muted">
            Create orders, update status, book shipments and manage returns.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreate((v) => !v)}>+ Create Order</Button>
          <Button variant="outline" onClick={refresh}>Refresh</Button>
        </div>
      </div>

      {showCreate && (
        <CreateOrderForm onDone={() => { refresh(); setShowCreate(false); }} />
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        <Panel title="All orders" description={`${orders.length} orders in store`}>
          {orders.length === 0 ? (
            <EmptyState text="No orders yet." />
          ) : (
            <ul className="divide-y divide-border">
              {orders.map((order) => (
                <li key={order.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(order.id)}
                    className={classNames(
                      "flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-warm-cream/40",
                      selectedId === order.id && "bg-warm-cream/60"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block font-mono text-xs font-semibold text-text-primary">
                        #{order.id}
                      </span>
                      <span className="block truncate text-xs text-text-muted">
                        {order.items[0]?.title}
                        {order.items.length > 1 ? ` +${order.items.length - 1}` : ""}
                        {" · "}
                        {formatDate(order.date)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={order.status} mapping={ORDER_STATUS_TONES} />
                      <span className="text-sm font-bold text-text-primary">
                        ₹{order.total.toLocaleString("en-IN")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="lg:col-span-4">
          {selected ? (
            <OrderDetail
              key={selected.id}
              order={selected}
              onChanged={() => refresh()}
            />
          ) : (
            <Panel title="Order details">
              <EmptyState text="Select an order to view details, update status, book shipments and print labels." />
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateOrderForm({ onDone }: { onDone: () => void }) {
  const books = getLiveBooks();
  const [items, setItems] = useState<{ bookId: string; quantity: number }[]>([
    { bookId: books[0]?.id ?? "", quantity: 1 },
  ]);
  const [customer, setCustomer] = useState({
    fullName: "",
    phone: "",
    email: "",
    line1: "",
    city: "",
    state: "Maharashtra",
    pincode: "",
  });
  const [error, setError] = useState("");

  const addRow = () =>
    setItems((list) => [...list, { bookId: books[0]?.id ?? "", quantity: 1 }]);
  const setRow = (index: number, patch: Partial<{ bookId: string; quantity: number }>) =>
    setItems((list) => list.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const submit = () => {
    if (!customer.fullName || !customer.phone || !customer.city || !customer.pincode) {
      setError("Please fill customer name, phone, city and pincode.");
      return;
    }
    if (items.some((i) => !i.bookId || i.quantity < 1)) {
      setError("Add at least one valid item.");
      return;
    }
    createAdminOrder({
      userEmail: customer.email,
      deliverTo: customer,
      items,
    });
    onDone();
  };

  return (
    <Panel title="Create order" description="Admin-initiated order. Pack–pick–ship dates are computed automatically.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer name">
          <TextInput value={customer.fullName} onChange={(e) => setCustomer({ ...customer, fullName: e.target.value })} placeholder="Full name" />
        </Field>
        <Field label="Phone">
          <TextInput value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="+91 ..." />
        </Field>
        <Field label="Email">
          <TextInput value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} placeholder="For notifications" />
        </Field>
        <Field label="Address line">
          <TextInput value={customer.line1} onChange={(e) => setCustomer({ ...customer, line1: e.target.value })} />
        </Field>
        <Field label="City">
          <TextInput value={customer.city} onChange={(e) => setCustomer({ ...customer, city: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="State">
            <TextInput value={customer.state} onChange={(e) => setCustomer({ ...customer, state: e.target.value })} />
          </Field>
          <Field label="Pincode">
            <TextInput value={customer.pincode} onChange={(e) => setCustomer({ ...customer, pincode: e.target.value })} />
          </Field>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-sm font-semibold text-text-primary">Items</p>
        {items.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <SelectInput
              className="flex-1"
              value={row.bookId}
              onChange={(e) => setRow(index, { bookId: e.target.value })}
            >
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title} — ₹{book.price}
                </option>
              ))}
            </SelectInput>
            <TextInput
              className="w-20"
              type="number"
              min={1}
              value={row.quantity}
              onChange={(e) => setRow(index, { quantity: Number(e.target.value) })}
            />
            {index === items.length - 1 && (
              <Button variant="outline" onClick={addRow}>+</Button>
            )}
          </div>
        ))}
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex gap-2">
        <Button onClick={submit}>Place order</Button>
        <Button variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </Panel>
  );
}

function OrderDetail({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const [charges, setCharges] = useState(49);
  const [courier, setCourier] = useState("Shiprocket");
  const [note, setNote] = useState("");
  const shipments = getShipments().filter((s) => s.orderId === order.id);
  const shipment = shipments[0];

  const canShip = order.status === "Ordered" || order.status === "Packed";
  const canReturn = order.status === "Delivered" && !order.returnRequest;

  const couriers = [
    "Shiprocket",
    "Ekart Logistics",
    "Delhivery",
    "Blue Dart",
    "DTDC",
  ];

  const advanceStatus = () => {
    const idx = ORDER_STATUS_FLOW.indexOf(order.status as (typeof ORDER_STATUS_FLOW)[number]);
    if (idx === -1 || idx >= ORDER_STATUS_FLOW.length - 1) return;
    setOrderStatus(order.id, ORDER_STATUS_FLOW[idx + 1]);
    onChanged();
  };

  return (
    <Panel
      title={`Order #${order.id}`}
      description={`${formatDateTime(order.date)} · ${order.deliveryMode === "store_pickup" ? "Store pickup" : "Home delivery"}`}
      action={<StatusBadge status={order.status} mapping={ORDER_STATUS_TONES} />}
    >
      {order.replacementOf && (
        <p className="mb-3 rounded-lg bg-warm-cream px-3 py-2 text-xs text-text-muted">
          Replacement for original order #{order.replacementOf}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Items</h4>
          <ul className="space-y-2">
            {order.items.map((item) => (
              <li key={item.bookId} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate text-text-primary">{item.title}</span>
                <span className="text-text-muted">× {item.quantity}</span>
                <span className="font-medium text-text-primary">₹{(item.price * item.quantity).toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs">
            <div className="flex justify-between"><dt className="text-text-muted">Subtotal</dt><dd>₹{order.subtotal.toLocaleString("en-IN")}</dd></div>
            <div className="flex justify-between"><dt className="text-text-muted">GST</dt><dd>₹{order.gst.toLocaleString("en-IN")}</dd></div>
            <div className="flex justify-between"><dt className="text-text-muted">Shipping</dt><dd>{order.shipping === 0 ? "FREE" : `₹${order.shipping}`}</dd></div>
            <div className="flex justify-between text-sm font-bold"><dt>Total</dt><dd className="text-burgundy">₹{order.total.toLocaleString("en-IN")}</dd></div>
          </dl>
        </div>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
            Delivery & schedule
          </h4>
          <div className="space-y-1.5 text-xs">
            <p className="text-text-primary">
              {order.deliveryAddress?.fullName} · {order.deliveryAddress?.phone}
            </p>
            <p className="text-text-muted">
              {order.deliveryAddress?.line1}, {order.deliveryAddress?.city}{" "}
              {order.deliveryAddress?.state} {order.deliveryAddress?.pincode}
            </p>
          </div>
          {order.plan && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-warm-cream p-2">
                <p className="text-text-muted">Pack by</p>
                <p className="font-semibold text-text-primary">{formatDate(order.plan.packedBy)}</p>
              </div>
              <div className="rounded-lg bg-warm-cream p-2">
                <p className="text-text-muted">Pickup by</p>
                <p className="font-semibold text-text-primary">{formatDate(order.plan.pickedUpBy)}</p>
              </div>
              <div className="rounded-lg bg-warm-cream p-2">
                <p className="text-text-muted">Ship by</p>
                <p className="font-semibold text-text-primary">{formatDate(order.plan.shippedBy)}</p>
              </div>
              <div className="rounded-lg bg-warm-cream p-2">
                <p className="text-text-muted">Deliver by</p>
                <p className="font-semibold text-text-primary">{formatDate(order.plan.deliveredBy)}</p>
              </div>
              <div className="col-span-2 rounded-lg bg-emerald-50 p-2">
                <p className="text-text-muted">Packaging</p>
                <p className="font-semibold text-emerald-800">{order.plan.packagingLabel}</p>
              </div>
            </div>
          )}

          {shipment && (
            <div className="mt-3 rounded-lg border border-border p-3 text-xs">
              <p className="font-semibold text-text-primary">
                Shipment via {shipment.courier}
              </p>
              <p className="font-mono text-burgundy">{shipment.awb}</p>
              <p className="mt-1 text-text-muted">
                Charges ₹{shipment.charges} · {shipment.status}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button
          variant="success"
          onClick={advanceStatus}
          disabled={!canShip && order.status !== "Shipped" && order.status !== "Out for Delivery"}
        >
          Advance to {nextStatusLabel(order.status)}
        </Button>
        {canShip && (
          <>
            <SelectInput className="w-40" value={courier} onChange={(e) => setCourier(e.target.value)}>
              {couriers.map((c) => <option key={c}>{c}</option>)}
            </SelectInput>
            <TextInput className="w-24" type="number" min={0} value={charges} onChange={(e) => setCharges(Number(e.target.value))} />
            <Button onClick={() => { createShipment({ orderId: order.id, courier, charges }); setNote(`Shipment booked via ${courier} (₹${charges}) — shipping label, invoice and packaging slip are ready to print.`); onChanged(); }}>
              Book shipment
            </Button>
          </>
        )}
        {order.status !== "Cancelled" && order.status !== "Delivered" && (
          <Button variant="outline" onClick={() => { cancelOrder(order.id); onChanged(); }}>
            Cancel
          </Button>
        )}
        {order.status === "Delivered" && order.paymentStatus === "Paid" && (
          <Button variant="outline" onClick={() => { refundOrder(order.id); onChanged(); }}>
            Refund
          </Button>
        )}
        {canReturn && (
          <>
            <Button variant="outline" onClick={() => { createReplacement(order.id); onChanged(); }}>
              Create replacement
            </Button>
            <Button variant="danger" onClick={() => { cancelOrder(order.id); onChanged(); }}>
              Mark returned
            </Button>
          </>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => printOrderInvoice(order, shipment)}>
          Print invoice
        </Button>
        <Button variant="ghost" onClick={() => printPackagingSlip(order)}>
          Print packaging slip
        </Button>
        {shipment && (
          <Button variant="ghost" onClick={() => printShippingLabel(shipment)}>
            Print shipping label
          </Button>
        )}
      </div>

      {note && <p className="mt-3 text-xs text-text-muted">{note}</p>}
    </Panel>
  );
}

function nextStatusLabel(status: string) {
  const idx = ORDER_STATUS_FLOW.indexOf(status as (typeof ORDER_STATUS_FLOW)[number]);
  if (idx === -1 || idx >= ORDER_STATUS_FLOW.length - 1) return "next";
  return ORDER_STATUS_FLOW[idx + 1];
}