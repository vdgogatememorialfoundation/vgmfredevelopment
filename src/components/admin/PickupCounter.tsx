"use client";

import { useEffect, useState } from "react";
import { patchOrder, recordPayment, sendPickupOtp, setOrderStatus, updateOrderInStore } from "@/lib/admin-store";
import { getOrders, pickupOtp, pickupOtpReady } from "@/lib/store";
import type { Order } from "@/types";
import { Button, Panel, TextInput } from "@/components/admin/AdminUI";

function stamp(order: Order) {
  const last = order.history?.[order.history.length - 1]?.at || order.pickupArrivedAt || order.date;
  const time = Date.parse(last || "");
  return Number.isFinite(time) ? time : 0;
}

function matches(order: Order, query: string) {
  const needle = query.trim().toLowerCase();
  const digits = needle.replace(/\D/g, "");
  const phone = order.deliveryAddress?.phone?.replace(/\D/g, "") ?? "";
  const hay = [order.id, order.deliveryAddress?.fullName, order.deliveryAddress?.email, order.deliveryAddress?.phone]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(needle) || (digits.length >= 4 && phone.includes(digits));
}

export function PickupCounter() {
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [otp, setOtp] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = orders.find((order) => order.id === selectedId) ?? null;
  const otpReady = selected ? pickupOtpReady(selected) : false;
  const paid = selected?.paymentStatus === "Paid";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const open = getOrders()
        .filter((order) => order.deliveryMode === "store_pickup" && order.status !== "Delivered" && order.status !== "Cancelled")
        .sort((a, b) => stamp(b) - stamp(a));
      setOrders(open);
      setSelectedId(open[0]?.id ?? "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const refresh = (id: string) => {
    const next = getOrders().find((item) => item.id === id);
    if (next) setOrders((current) => current.map((item) => (item.id === id ? next : item)));
    return next;
  };

  const markPaid = () => {
    if (!selected) return;
    keep(selected);
    recordPayment(selected.id, { method: selected.paymentMethod === "Cash at Store" || !selected.paymentMethod ? "Cash at Store" : selected.paymentMethod });
    refresh(selected.id);
    setNote("Payment recorded as paid.");
    setError("");
  };

  const markReady = () => {
    if (!selected) return;
    keep(selected);
    setOrderStatus(selected.id, "Packed");
    refresh(selected.id);
    setNote("Marked ready for pickup. The pickup OTP was sent to the customer.");
    setError("");
  };

  const search = async () => {
    const q = query.trim();
    if (q.length < 3 && q.replace(/\D/g, "").length < 4) {
      setError("Enter at least 3 letters or 4 digits of the order, name, or phone.");
      setOrders([]);
      return;
    }
    setBusy(true);
    setError("");
    setNote("");
    try {
      const response = await fetch(`/api/shop/orders?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const data = (await response.json()) as { orders?: Order[] };
      const remote = Array.isArray(data.orders) ? data.orders : [];
      const local = getOrders().filter((order) => matches(order, q));
      const merged = new Map<string, Order>();
      for (const order of [...local, ...remote]) {
        const current = merged.get(order.id);
        if (!current || stamp(order) >= stamp(current)) merged.set(order.id, order);
      }
      const list = [...merged.values()].sort((a, b) => {
        const pickup = (order: Order) => (order.deliveryMode === "store_pickup" ? 0 : 1);
        return pickup(a) - pickup(b) || stamp(b) - stamp(a);
      });
      setOrders(list);
      setSelectedId(list[0]?.id ?? "");
      setOtp("");
      if (!list.length) setError("No order matches that search.");
    } catch {
      setError("Could not search orders. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const keep = (order: Order) => {
    updateOrderInStore(order);
    const next = getOrders().find((item) => item.id === order.id) ?? order;
    setOrders((current) => current.map((item) => (item.id === next.id ? next : item)));
    return next;
  };

  const arrived = () => {
    if (!selected) return;
    keep(selected);
    const next = patchOrder(selected.id, { pickupArrivedAt: new Date().toISOString() }, "Customer arrived at the clinic");
    if (!next) return;
    setOrders((current) => current.map((item) => (item.id === next.id ? next : item)));
    setNote("Marked as customer arrived.");
    setError("");
  };

  const verify = () => {
    if (!selected) return;
    if (!otpReady) {
      setError("The pickup OTP unlocks after the order is processed. Mark it ready for pickup first.");
      setNote("");
      return;
    }
    if (!paid) {
      setError("Payment is still pending. Mark the order as paid before handing it over.");
      setNote("");
      return;
    }
    if (otp.trim() !== pickupOtp(selected.id)) {
      setError("That OTP does not match this order.");
      setNote("");
      return;
    }
    keep(selected);
    setOrderStatus(selected.id, "Delivered");
    patchOrder(selected.id, {}, "Pickup OTP verified · picked up");
    refresh(selected.id);
    setNote("OTP verified. The order is marked as picked up.");
    setError("");
    setOtp("");
  };

  const resend = () => {
    if (!selected) return;
    if (!sendPickupOtp(selected)) {
      setError("The pickup OTP unlocks after the order is processed. Mark it ready for pickup first.");
      setNote("");
      return;
    }
    setNote("Pickup OTP sent again to the customer.");
    setError("");
  };

  return (
    <Panel
      title="Store pickup orders"
      description="Open pickup orders are listed below. Search by order ID, name, phone or email; mark ready, record payment, then verify the pickup OTP. The OTP works only after the order is processed."
    >
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <div className="min-w-56 flex-1">
          <TextInput
            value={query}
            placeholder="Order ID, customer name, phone or email"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Searching…" : "Search order"}
        </Button>
      </form>

      {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {note ? <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{note}</p> : null}

      {orders.length > 0 ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
          <ul className="space-y-2">
            {orders.map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(order.id);
                    setOtp("");
                    setError("");
                    setNote("");
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    order.id === selectedId ? "border-burgundy bg-warm-cream" : "border-border bg-white"
                  }`}
                >
                  <span className="block font-semibold text-text-primary">{order.id}</span>
                  <span className="block text-xs text-text-muted">
                    {order.deliveryAddress?.fullName || "Customer"} · {order.deliveryMode === "store_pickup" ? "Pickup" : order.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {selected ? (
            <div className="rounded-xl border border-border p-4">
              <p className="text-sm font-semibold text-text-primary">{selected.deliveryAddress?.fullName || "Customer"}</p>
              <p className="text-sm text-text-muted">
                {selected.deliveryAddress?.phone || "No phone"} · {selected.deliveryAddress?.email || "No email"}
              </p>
              <p className="mt-2 text-sm text-text-primary">
                {selected.items.map((item) => `${item.quantity} × ${item.title}`).join(", ")}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                ₹{selected.total.toLocaleString("en-IN")} · Payment {selected.paymentStatus}
                {selected.paymentMethod ? ` (${selected.paymentMethod})` : ""} · Status {selected.status}
                {selected.pickupArrivedAt ? " · Customer arrived" : ""}
                {selected.deliveryMode === "store_pickup" ? " · Store pickup" : ""}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" onClick={arrived} disabled={Boolean(selected.pickupArrivedAt)}>
                  {selected.pickupArrivedAt ? "Customer arrived" : "Mark customer arrived"}
                </Button>
                {!otpReady && selected.status !== "Cancelled" ? (
                  <Button variant="outline" onClick={markReady}>
                    Mark ready for pickup
                  </Button>
                ) : null}
                <Button variant="outline" onClick={markPaid} disabled={paid}>
                  {paid ? "Paid" : "Mark as paid"}
                </Button>
                <Button variant="outline" onClick={resend} disabled={!otpReady || selected.status === "Delivered"}>
                  Resend OTP
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-2">
                <label className="block min-w-40 flex-1">
                  <span className="mb-1 block text-sm font-semibold text-text-primary">Pickup OTP</span>
                  <TextInput
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    placeholder={otpReady ? "6-digit code" : "Unlocks after the order is processed"}
                    disabled={!otpReady || selected.status === "Delivered"}
                    onChange={(event) => setOtp(event.target.value)}
                  />
                </label>
                <Button variant="success" onClick={verify} disabled={selected.status === "Delivered" || !otpReady}>
                  {selected.status === "Delivered" ? "Picked up" : "Verify OTP"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
