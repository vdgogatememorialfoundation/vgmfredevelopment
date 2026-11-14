"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import OrderTrackingTimeline from "@/components/store/OrderTrackingTimeline";
import { rememberOrder, rememberShipment } from "@/lib/commerce-sync";
import type { Order, ShipmentRecord } from "@/types";

type Lookup = { ok?: boolean; error?: string; order?: Order; shipments?: ShipmentRecord[]; link?: string };

export default function TrackLookup() {
  const [ref, setRef] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get("order");
    if (!fromLink) return;
    const timer = setTimeout(() => setRef(fromLink), 0);
    return () => clearTimeout(timer);
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setOrder(null);
    setLink("");
    try {
      const response = await fetch(`/api/shop/track-lookup?ref=${encodeURIComponent(ref.trim())}&phone=${encodeURIComponent(phone.trim())}`, { cache: "no-store" });
      const data = (await response.json()) as Lookup;
      if (!response.ok || !data.order) {
        setMessage(data.error || "No order matches that number and mobile number.");
        return;
      }
      rememberOrder(data.order);
      for (const shipment of data.shipments ?? []) rememberShipment(shipment);
      setOrder(data.order);
      setLink(data.link ?? "");
    } catch {
      setMessage("Tracking could not be loaded. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container py-8">
      <h1 className="font-serif text-3xl text-ink">Track your order</h1>
      <p className="mt-2 max-w-xl text-sm text-text-muted">
        Enter your order ID or the courier tracking (AWB) number, with the mobile number on the order. This works for every courier we ship with.
      </p>
      <form onSubmit={onSubmit} className="mt-5 grid max-w-2xl gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-text-primary">Order ID or tracking number</span>
          <input value={ref} onChange={(event) => setRef(event.target.value)} required className="w-full rounded-xl border border-border bg-white px-3 py-3" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-text-primary">Mobile number</span>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} required className="w-full rounded-xl border border-border bg-white px-3 py-3" inputMode="tel" />
        </label>
        <button type="submit" disabled={busy} className="rounded-full bg-burgundy px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Checking…" : "Track"}
        </button>
      </form>
      {message ? <p className="mt-4 text-sm text-red-700">{message}</p> : null}
      {order ? (
        <div className="mt-6">
          {link ? (
            <p className="mb-4 text-sm text-text-muted">
              Your tracking link for this order (no sign-in needed):{" "}
              <Link href={link} className="font-semibold text-burgundy underline">
                {typeof window === "undefined" ? link : `${window.location.origin}${link}`}
              </Link>
            </p>
          ) : null}
          <OrderTrackingTimeline order={order} phone={phone.trim()} />
        </div>
      ) : null}
    </div>
  );
}
