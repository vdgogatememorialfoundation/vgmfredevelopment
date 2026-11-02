"use client";

import { useState } from "react";
import OrderTrackingTimeline from "@/components/store/OrderTrackingTimeline";
import type { Order } from "@/types";

export default function TrackShipmentPage() {
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setOrder(null);
    try {
      const response = await fetch(
        `/api/shop/orders?id=${encodeURIComponent(orderId.trim())}&phone=${encodeURIComponent(phone.trim())}`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as { orders?: Order[] };
      const found = data.orders?.[0];
      if (!found) {
        setMessage("No shipment matches that order number and mobile number.");
        return;
      }
      setOrder(found);
    } catch {
      setMessage("Tracking could not be loaded. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container py-8">
      <h1 className="font-serif text-3xl text-ink">Track a shipment</h1>
      <p className="mt-2 max-w-xl text-sm text-text-muted">
        Enter the order number and the mobile number on the order. The rider’s name and phone appear after the courier is allotted and delivery has started.
      </p>
      <form onSubmit={onSubmit} className="mt-5 grid max-w-xl gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-text-primary">Order number</span>
          <input
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            required
            className="w-full rounded-xl border border-border bg-white px-3 py-3"
            inputMode="numeric"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-text-primary">Mobile number</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
            className="w-full rounded-xl border border-border bg-white px-3 py-3"
            inputMode="tel"
          />
        </label>
        <button type="submit" disabled={busy} className="rounded-full bg-burgundy px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Checking…" : "Track"}
        </button>
      </form>
      {message ? <p className="mt-4 text-sm text-red-700">{message}</p> : null}
      {order ? (
        <div className="mt-6">
          <OrderTrackingTimeline order={order} phone={phone.trim()} />
        </div>
      ) : null}
    </div>
  );
}
